const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { URL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const PLAYERS_FILE = path.join(DATA_DIR, "players.json");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const STARTING_COINS = Number(process.env.STARTING_COINS || 0);
const FIELD_W = 1000;
const FIELD_H = 620;
const MAX_FIELD_FISH = 24;
const MAX_ROOM_PLAYERS = 4;
const PLAYER_TTL_MS = 12000;
const ROOM_TTL_MS = 30 * 60 * 1000;
const FIELD_BROADCAST_INTERVAL_MS = 250;
const SIM_TICK_RATE = 60;
const SIM_TICK_MS = 1000 / SIM_TICK_RATE;
const TARGET_RTP = clampNumber(Number(process.env.TARGET_RTP || 0.97), 0.5, 0.99, 0.97);
const ROOM_JACKPOT_SEED = Math.max(0, Math.floor(Number(process.env.ROOM_JACKPOT_SEED || 3000)));
const DAMAGE_UNIT = 10;
const MIN_HIT_CHANCE = 0.62;
const MAX_HIT_CHANCE = 0.95;
const MIN_LUCKY_CATCH_CHANCE = 0.0015;
const MAX_LUCKY_CATCH_CHANCE = 0.024;
const SKILLS = {
  bomb: { key: "bomb", name: "爆炎弹", cost: 120, power: 90, radius: 150, maxTargets: 7 },
  laser: { key: "laser", name: "龙魂激光", cost: 180, power: 130, width: 42, maxTargets: 9 }
};

const FISH_TYPES = [
  { key: "blue", name: "青鱼", hp: 2, value: 20, speed: 62, size: 34, rate: 2, spawnWeight: 30 },
  { key: "redKoi", name: "红鲤", hp: 4, value: 40, speed: 52, size: 42, rate: 4, spawnWeight: 22 },
  { key: "goldKoi", name: "金锦鲤", hp: 8, value: 80, speed: 45, size: 48, rate: 8, spawnWeight: 16 },
  { key: "lantern", name: "灯笼鱼", hp: 12, value: 120, speed: 40, size: 46, rate: 12, spawnWeight: 12 },
  { key: "jelly", name: "水母", hp: 18, value: 180, speed: 34, size: 54, rate: 18, spawnWeight: 9 },
  { key: "turtle", name: "玄武龟", hp: 28, value: 280, speed: 24, size: 60, rate: 28, spawnWeight: 6 },
  { key: "dragonFish", name: "龙鱼", hp: 45, value: 450, speed: 36, size: 62, rate: 45, spawnWeight: 3.6 },
  { key: "manta", name: "鬼影魟", hp: 65, value: 650, speed: 30, size: 78, rate: 65, spawnWeight: 2.4 },
  { key: "phoenixFish", name: "凤尾神鱼", hp: 80, value: 800, speed: 32, size: 82, rate: 80, spawnWeight: 1.8 },
  { key: "whale", name: "巨鲸", hp: 100, value: 1000, speed: 19, size: 104, rate: 100, spawnWeight: 1.15 },
  { key: "boss", name: "金龙", hp: 120, value: 1200, speed: 21, size: 96, rate: 120, spawnWeight: 0.65, boss: true },
  { key: "thunderDragon", name: "雷龙王", hp: 180, value: 1800, speed: 18, size: 116, rate: 180, spawnWeight: 0.34, boss: true },
  { key: "whaleBoss", name: "金鲸王", hp: 220, value: 2200, speed: 14, size: 132, rate: 220, spawnWeight: 0.24, boss: true },
  { key: "blackDragonBoss", name: "玄冥黑龙", hp: 300, value: 3000, speed: 16, size: 128, rate: 300, spawnWeight: 0.16, boss: true }
];
const FISH_BY_KEY = Object.fromEntries(FISH_TYPES.map((fish) => [fish.key, fish]));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

let store = loadStore();
const localAddressSet = collectLocalAddresses();
const rooms = new Map();
const wsClients = new Set();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    if ((url.pathname === "/admin" || url.pathname === "/admin.html") && !isLocalRequest(req)) {
      sendJson(res, 403, { error: "管理后台仅允许本机访问" });
      return;
    }

    serveStatic(req, res, url.pathname);
  } catch (error) {
    if (error.status) {
      sendJson(res, error.status, { error: error.message });
      return;
    }
    console.error(error);
    sendJson(res, 500, { error: "服务器内部错误" });
  }
});

server.listen(PORT, HOST, () => {
  const urls = getLanUrls(PORT);
  console.log("");
  console.log("Fish Arcade LAN server started");
  console.log(`Local game:  http://localhost:${PORT}/`);
  console.log(`Local admin: http://localhost:${PORT}/admin`);
  for (const url of urls) console.log(`LAN game:    ${url}`);
  console.log("");
  console.log("Keep this window open while LAN players are in game.");
});

server.on("upgrade", (req, socket) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname !== "/ws") {
      socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
      return;
    }
    const player = requirePlayer(url.searchParams.get("playerId"), url.searchParams.get("token"), req);
    const room = requireRoom(url.searchParams.get("roomId"));
    if (!room.players.has(player.id) && room.players.size >= MAX_ROOM_PLAYERS) {
      throw httpError(409, "房间已满，最多支持4个玩家同时游戏");
    }
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }

    const accept = crypto
      .createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n"
    ].join("\r\n"));

    markSeen(player, req);
    updateFieldPlayer(room, player, {});
    const client = { socket, playerId: player.id, roomId: room.id, buffer: Buffer.alloc(0), alive: true };
    wsClients.add(client);
    socket.on("data", (chunk) => handleWsData(client, chunk));
    socket.on("close", () => {
      wsClients.delete(client);
      room.players.delete(client.playerId);
    });
    socket.on("error", () => {
      wsClients.delete(client);
      room.players.delete(client.playerId);
    });
    sendWsJson(socket, { type: "hello", player: exposePlayerWithToken(player) });
    sendWsJson(socket, { type: "field", field: exposeField(room, player.id) });
  } catch (error) {
    socket.end(`HTTP/1.1 ${error.status || 500} ${error.message || "Error"}\r\n\r\n`);
  }
});

setInterval(() => {
  updateRooms();
  broadcastRoomSnapshots();
}, FIELD_BROADCAST_INTERVAL_MS);

async function handleApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/player") {
    const body = await readJson(req);
    const player = getOrCreatePlayer(body.playerId, body.token, req);
    saveStore();
    sendJson(res, 200, exposePlayerWithToken(player));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/player") {
    const player = requirePlayer(url.searchParams.get("playerId"), url.searchParams.get("token"), req);
    saveStore();
    sendJson(res, 200, exposePlayerWithToken(player));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/room/create") {
    const body = await readJson(req);
    const player = requirePlayer(body.playerId, body.token, req);
    const room = createRoom();
    markSeen(player, req);
    sendJson(res, 200, exposeRoom(room));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/room/join") {
    const body = await readJson(req);
    const player = requirePlayer(body.playerId, body.token, req);
    const room = requireRoom(body.roomId);
    if (!room.players.has(player.id) && room.players.size >= MAX_ROOM_PLAYERS) {
      sendJson(res, 409, { error: "房间已满，最多支持4个玩家同时游戏" });
      return;
    }
    markSeen(player, req);
    sendJson(res, 200, exposeRoom(room));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/fire") {
    const body = await readJson(req);
    const player = requirePlayer(body.playerId, body.token, req);
    const room = requireRoom(body.roomId);
    const cost = toPositiveInteger(body.cost, 1, 1000);
    const result = processFire(room, player, cost, req, body.state || {});
    if (!result.ok) sendJson(res, result.status, { error: result.error, coins: result.coins });
    else sendJson(res, 200, result.player);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/capture") {
    sendJson(res, 410, { error: "捕获奖励必须由服务端命中结算发放" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/field") {
    const player = requirePlayer(url.searchParams.get("playerId"), url.searchParams.get("token"), req);
    const room = requireRoom(url.searchParams.get("roomId"));
    markSeen(player, req);
    updateField(room);
    sendJson(res, 200, exposeField(room, player.id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/field/player") {
    const body = await readJson(req);
    const player = requirePlayer(body.playerId, body.token, req);
    const room = requireRoom(body.roomId);
    markSeen(player, req);
    updateFieldPlayer(room, player, body);
    updateField(room);
    sendJson(res, 200, exposeField(room, player.id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/field/hit") {
    const body = await readJson(req);
    const player = requirePlayer(body.playerId, body.token, req);
    const room = requireRoom(body.roomId);
    const power = toPositiveInteger(body.power, 1, 1000);
    const result = processFieldHit(room, player, String(body.fishId), power, req);
    if (result.notFound) sendJson(res, 404, result);
    else sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/skill") {
    const body = await readJson(req);
    const player = requirePlayer(body.playerId, body.token, req);
    const room = requireRoom(body.roomId);
    const result = processSkill(room, player, String(body.skillKey || ""), body.state || {}, req);
    if (!result.ok) sendJson(res, result.status, { error: result.error, coins: result.coins });
    else {
      broadcastSkillEvent(room, player.id, result.skill);
      sendJson(res, 200, { ...result.player, skill: result.skill });
    }
    return;
  }

  if (url.pathname.startsWith("/api/admin/")) {
    if (!isLocalRequest(req)) {
      sendJson(res, 403, { error: "管理接口仅允许本机访问" });
      return;
    }
    await handleAdminApi(req, res, url);
    return;
  }

  sendJson(res, 404, { error: "接口不存在" });
}

async function handleAdminApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/admin/players") {
    const players = Object.values(store.players)
      .map(exposePlayer)
      .sort((a, b) => new Date(b.lastSeenAt || b.createdAt) - new Date(a.lastSeenAt || a.createdAt));
    sendJson(res, 200, players);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/rooms") {
    updateRooms();
    sendJson(res, 200, exposeAdminRooms());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/add-coins") {
    const body = await readJson(req);
    const playerId = normalizePlayerId(body.playerId);
    const amount = toPositiveInteger(body.amount, 1, 1000000000);
    const player = store.players[playerId];
    if (!player) {
      sendJson(res, 404, { error: "玩家号不存在，请先让玩家进入游戏" });
      return;
    }
    player.coins += amount;
    player.totalPurchased += amount;
    player.purchases.push({ amount, at: new Date().toISOString() });
    saveStore();
    sendJson(res, 200, exposePlayer(player));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/rename-player") {
    const body = await readJson(req);
    const playerId = normalizePlayerId(body.playerId);
    const name = normalizePlayerName(body.name);
    const player = store.players[playerId];
    if (!player) {
      sendJson(res, 404, { error: "玩家号不存在" });
      return;
    }
    player.name = name;
    syncOnlinePlayerName(playerId, name);
    saveStore();
    sendJson(res, 200, exposePlayer(player));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/delete-player") {
    const body = await readJson(req);
    const playerId = normalizePlayerId(body.playerId);
    if (body.confirm !== "DELETE_PLAYER") {
      sendJson(res, 400, { error: "缺少确认参数，未删除账号" });
      return;
    }
    if (!store.players[playerId]) {
      sendJson(res, 404, { error: "玩家号不存在" });
      return;
    }
    if (isPlayerOnline(playerId)) {
      sendJson(res, 409, { error: "玩家在线，不能删除；请先让玩家退出房间" });
      return;
    }
    delete store.players[playerId];
    saveStore();
    sendJson(res, 200, {
      deleted: 1,
      playerId,
      remaining: Object.keys(store.players).length
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/delete-temp-players") {
    const body = await readJson(req);
    if (body.confirm !== "DELETE_TEMP_PLAYERS") {
      sendJson(res, 400, { error: "缺少确认参数，未删除任何账号" });
      return;
    }
    const deletedIds = [];
    for (const player of Object.values(store.players)) {
      if (!isTemporaryPlayer(player)) continue;
      deletedIds.push(player.id);
      delete store.players[player.id];
    }
    if (deletedIds.length) saveStore();
    sendJson(res, 200, {
      deleted: deletedIds.length,
      deletedIds,
      remaining: Object.keys(store.players).length
    });
    return;
  }

  sendJson(res, 404, { error: "管理接口不存在" });
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  let requested = decodeURIComponent(pathname);
  if (requested === "/") requested = "/index.html";
  if (requested === "/admin") requested = "/admin.html";

  const filePath = path.resolve(ROOT, `.${requested}`);
  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not Found" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    if (req.method === "HEAD") res.end();
    else res.end(data);
  });
}

function getOrCreatePlayer(playerId, token, req) {
  const normalizedId = normalizeOptionalPlayerId(playerId);
  if (normalizedId) {
    const existing = store.players[normalizedId];
    if (existing) {
      if (existing.token !== token) throw httpError(403, "玩家会话不匹配");
      markSeen(existing, req);
      return existing;
    }
  }

  const id = createPlayerId();
  const player = {
    id,
    name: id,
    token: crypto.randomBytes(18).toString("hex"),
    coins: Math.max(0, Math.floor(STARTING_COINS)),
    totalPurchased: 0,
    totalSpent: 0,
    totalWon: 0,
    purchases: [],
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    lastIp: remoteAddress(req),
    userAgent: req.headers["user-agent"] || ""
  };
  store.players[id] = player;
  return player;
}

function requirePlayer(playerId, token, req) {
  const id = normalizePlayerId(playerId);
  const player = store.players[id];
  if (!player || player.token !== token) throw httpError(403, "玩家会话失效");
  markSeen(player, req);
  return player;
}

function markSeen(player, req) {
  player.lastSeenAt = new Date().toISOString();
  player.lastIp = remoteAddress(req);
  player.userAgent = req.headers["user-agent"] || "";
}

function isTemporaryPlayer(player) {
  return Number(player.coins || 0) === 0
    && Number(player.totalPurchased || 0) === 0
    && Number(player.totalSpent || 0) === 0
    && Number(player.totalWon || 0) === 0
    && (!Array.isArray(player.purchases) || player.purchases.length === 0)
    && !isPlayerOnline(player.id);
}

function isPlayerOnline(playerId) {
  for (const room of rooms.values()) {
    if (room.players.has(playerId)) return true;
  }
  for (const client of wsClients) {
    if (!client.socket.destroyed && client.playerId === playerId) return true;
  }
  return false;
}

function syncOnlinePlayerName(playerId, name) {
  for (const room of rooms.values()) {
    const player = room.players.get(playerId);
    if (!player) continue;
    player.name = name || playerId;
    room.lastActiveAt = Date.now();
  }
}

function assignRoomSeat(room) {
  const used = new Set(Array.from(room.players.values()).map((player) => player.seat).filter(Number.isInteger));
  for (let seat = 0; seat < MAX_ROOM_PLAYERS; seat += 1) {
    if (!used.has(seat)) return seat;
  }
  return 0;
}

function updateFieldPlayer(room, player, state = {}) {
  const current = room.players.get(player.id) || {};
  const seat = Number.isInteger(current.seat) ? current.seat : assignRoomSeat(room);
  room.players.set(player.id, {
    id: player.id,
    name: player.name || player.id,
    seat,
    coins: player.coins,
    aimX: clampNumber(Number(state.aimX ?? current.aimX), 0, 1, 0.5),
    aimY: clampNumber(Number(state.aimY ?? current.aimY), 0, 1, 0.5),
    angle: clampNumber(Number(state.angle ?? current.angle), -Math.PI * 2, Math.PI * 2, -Math.PI / 2),
    cannonIndex: clampInteger(Number(state.cannonIndex ?? current.cannonIndex), 0, 7, 0),
    power: clampInteger(Number(state.power ?? current.power), 10, 100, 10),
    lockMode: Boolean(state.lockMode ?? current.lockMode),
    autoFire: Boolean(state.autoFire ?? current.autoFire),
    isFiring: Boolean(state.isFiring ?? current.isFiring),
    lastFireAt: current.lastFireAt || 0,
    lastSeenAt: Date.now()
  });
  room.lastActiveAt = Date.now();
}

function processFire(room, player, cost, req, state = {}) {
  if (player.coins < cost) {
    return { ok: false, status: 402, error: "金币不足", coins: player.coins };
  }
  player.coins -= cost;
  player.totalSpent += cost;
  room.stats.shots += 1;
  room.bank.totalIn += cost;
  room.bank.pool += cost * room.bank.targetRtp;
  room.bank.lastRtp = calculateRoomRtp(room);
  room.lastActiveAt = Date.now();
  markSeen(player, req);
  updateFieldPlayer(room, player, { ...state, isFiring: true });
  const fieldPlayer = room.players.get(player.id);
  if (fieldPlayer) {
    fieldPlayer.coins = player.coins;
    fieldPlayer.lastFireAt = Date.now();
  }
  saveStore();
  return { ok: true, player: exposePlayer(player) };
}

function processFieldHit(room, player, fishId, power, req) {
  updateField(room);
  const fish = room.fish.find((item) => item.id === fishId);
  if (!fish || fish.dead) {
    return { notFound: true, error: "鱼已离开", captured: false, effective: false, coins: player.coins };
  }

  const result = settleFishHit(room, player, fish, power, ["bullet", room.stats.hitRequests + 1]);
  finishPlayerAction(room, player, req);
  saveStore();
  return result;
}

function processSkill(room, player, skillKey, state = {}, req) {
  const skill = SKILLS[skillKey];
  if (!skill) return { ok: false, status: 400, error: "技能不存在", coins: player.coins };
  if (player.coins < skill.cost) return { ok: false, status: 402, error: "金币不足", coins: player.coins };

  updateField(room);
  player.coins -= skill.cost;
  player.totalSpent += skill.cost;
  room.stats.skillUses += 1;
  if (skill.key === "bomb") room.stats.bombUses += 1;
  if (skill.key === "laser") room.stats.laserUses += 1;
  room.bank.totalIn += skill.cost;
  room.bank.pool += skill.cost * room.bank.targetRtp;
  room.bank.lastRtp = calculateRoomRtp(room);
  updateFieldPlayer(room, player, { ...state, isFiring: false });

  const aimX = clampNumber(Number(state.aimX), 0, 1, 0.5);
  const aimY = clampNumber(Number(state.aimY), 0, 1, 0.5);
  const angle = clampNumber(Number(state.angle), -Math.PI * 2, Math.PI * 2, -Math.PI / 2);
  const targets = selectSkillTargets(room, skill, aimX, aimY, angle);
  const skillTick = getRoomTick(room);
  const seed = deterministicSeed(room.id, player.id, skill.key, skillTick, room.stats.skillUses);
  const hits = targets.map((fish, index) => settleFishHit(room, player, fish, skill.power, ["skill", skill.key, room.stats.skillUses, index]));

  finishPlayerAction(room, player, req);
  saveStore();
  return {
    ok: true,
    player: exposePlayer(player),
    skill: {
      id: `${player.id}-${skill.key}-${skillTick}-${room.stats.skillUses}`,
      playerId: player.id,
      key: skill.key,
      name: skill.name,
      cost: skill.cost,
      power: skill.power,
      skillTick,
      seed,
      aimX,
      aimY,
      angle,
      targetFishId: String(state.targetFishId || ""),
      x: aimX * FIELD_W,
      y: aimY * FIELD_H,
      radius: skill.radius || 0,
      width: skill.width || 0,
      hits,
      coins: player.coins,
      pool: exposeRoomBank(room)
    }
  };
}

function selectSkillTargets(room, skill, aimX, aimY, angle) {
  const liveFish = room.fish.filter((fish) => !fish.dead);
  if (skill.key === "bomb") {
    const x = aimX * FIELD_W;
    const y = aimY * FIELD_H;
    return liveFish
      .map((fish) => ({ fish, distance: Math.hypot(fish.x - x, fish.y - y) - fish.size * 0.35 }))
      .filter((item) => item.distance <= skill.radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, skill.maxTargets)
      .map((item) => item.fish);
  }

  if (skill.key === "laser") {
    const startX = FIELD_W / 2;
    const startY = FIELD_H + 82;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    return liveFish
      .map((fish) => {
        const fx = fish.x - startX;
        const fy = fish.y - startY;
        const projection = fx * dirX + fy * dirY;
        const closestX = startX + dirX * projection;
        const closestY = startY + dirY * projection;
        return { fish, projection, distance: Math.hypot(fish.x - closestX, fish.y - closestY) };
      })
      .filter((item) => item.projection > 0 && item.distance <= skill.width + item.fish.size * 0.45)
      .sort((a, b) => a.projection - b.projection)
      .slice(0, skill.maxTargets)
      .map((item) => item.fish);
  }

  return [];
}

function settleFishHit(room, player, fish, power, seedParts = []) {
  const hpBefore = fish.hp;
  const type = FISH_BY_KEY[fish.typeKey];
  const hitTick = getRoomTick(room);
  const hitSeed = deterministicSeed(room.id, fish.id, player.id, hitTick, ...seedParts);
  const hitChance = calculateHitChance(room, fish, power);
  const luckyCatchChance = calculateLuckyCatchChance(room, fish, power);
  const effective = Math.random() < hitChance;
  room.stats.hitRequests += 1;

  if (!effective) {
    room.stats.misses += 1;
    return {
      effective: false,
      captured: false,
      gain: 0,
      damage: 0,
      fishId: fish.id,
      playerId: player.id,
      hitTick,
      seed: hitSeed,
      hitChance,
      critical: false,
      criticalMultiplier: 1,
      luckyCatch: false,
      instantKill: false,
      luckyCatchChance,
      instantKillChance: luckyCatchChance,
      coins: player.coins,
      pool: exposeRoomBank(room),
      fish: exposeFieldFish(fish)
    };
  }

  room.stats.hits += 1;

  let damage = 0;
  let captured = false;
  let luckyCatch = false;
  let gain = 0;
  let pool = exposeRoomBank(room);
  const captureGain = calculateCaptureGain(room, fish, player, power);
  let criticalMultiplier = 1;
  let damagePower = power;

  if (Math.random() < luckyCatchChance && shouldPayCapture(room, captureGain)) {
    luckyCatch = true;
    captured = true;
    gain = captureGain;
    damage = hpBefore;
    fish.remainingPower = 0;
    fish.hp = 0;
    captureFish(room, fish, player, type, gain);
    room.stats.luckyCatches += 1;
    room.stats.instantKills += 1;
    pool = exposeRoomBank(room);
  } else {
    criticalMultiplier = rollCriticalMultiplier(room, fish, power);
    damagePower = power * criticalMultiplier;
    if (criticalMultiplier > 1) room.stats.criticalHits += 1;
    fish.damageByPlayer[player.id] = (fish.damageByPlayer[player.id] || 0) + damagePower;
    fish.powerDamage += damagePower;
    fish.weightedPower += power * damagePower;
    fish.remainingPower = Math.max(0, fish.remainingPower - damagePower);
    fish.hp = Math.max(0, Math.ceil(fish.remainingPower / DAMAGE_UNIT));
    damage = Math.max(0, hpBefore - fish.hp);

    if (fish.remainingPower <= 0) {
      gain = captureGain;
      if (shouldPayCapture(room, gain)) {
        captured = true;
        captureFish(room, fish, player, type, gain);
      } else {
        fish.remainingPower = Math.max(1, Math.ceil(fish.requiredPower * 0.08));
        fish.hp = Math.max(1, Math.ceil(fish.remainingPower / DAMAGE_UNIT));
        gain = 0;
      }
      pool = exposeRoomBank(room);
    }
  }
  return {
    effective,
    captured,
    gain,
    damage,
    fishId: fish.id,
    playerId: player.id,
    hitTick,
    seed: hitSeed,
    hitChance,
    critical: criticalMultiplier > 1,
    criticalMultiplier,
    luckyCatch,
    instantKill: luckyCatch,
    luckyCatchChance,
    instantKillChance: luckyCatchChance,
    coins: player.coins,
    pool,
    fish: fish.dead ? null : exposeFieldFish(fish)
  };
}

function calculateCaptureGain(room, fish, player, power) {
  return Math.max(1, Math.round(Number(fish.value || fish.requiredPower || power)));
}

function captureFish(room, fish, player, type, gain) {
  fish.dead = true;
  fish.deathAt = Date.now();
  room.bank.pool = Math.max(0, room.bank.pool - gain);
  room.bank.totalOut += gain;
  room.bank.lastRtp = calculateRoomRtp(room);
  player.coins += gain;
  player.totalWon += gain;
  player.lastCapture = { fishName: type.name, gain, at: new Date().toISOString() };
  room.stats.captures += 1;
  if (type.boss) room.nextFishAt = Math.min(room.nextFishAt, Date.now() + 2400);
  markRoomFishChanged(room);
}

function finishPlayerAction(room, player, req) {
  markSeen(player, req);
  room.lastActiveAt = Date.now();
  const fieldPlayer = room.players.get(player.id);
  if (fieldPlayer) fieldPlayer.coins = player.coins;
}

function calculateHitChance(room, fish, power) {
  const type = FISH_BY_KEY[fish.typeKey];
  const powerLevel = clampNumber((power - DAMAGE_UNIT) / 90, 0, 1, 0);
  const ratePenalty = clampNumber(Math.log2(Math.max(2, type.rate)) * 0.019, 0.015, 0.15, 0.07);
  const currentRtp = calculateRoomRtp(room);
  const rtpPressure = clampNumber((room.bank.targetRtp - currentRtp) * 0.1, -0.045, 0.045, 0);
  const expectedPrize = Math.max(1, Number(fish.value || fish.requiredPower || power));
  const poolPressure = clampNumber((room.bank.pool / expectedPrize - 1) * 0.035, -0.055, 0.055, 0);
  const chance = 0.82 + powerLevel * 0.07 - ratePenalty + rtpPressure + poolPressure;
  return clampNumber(chance, MIN_HIT_CHANCE, MAX_HIT_CHANCE, 0.82);
}

function calculateLuckyCatchChance(room, fish, power) {
  const type = FISH_BY_KEY[fish.typeKey];
  const value = Math.max(1, Number(fish.value || fish.requiredPower || power));
  const costRatio = clampNumber(power / value, 0.005, 0.5, 0.02);
  const currentRtp = calculateRoomRtp(room);
  const poolRatio = room.bank.pool / value;
  const rtpPressure = clampNumber((room.bank.targetRtp - currentRtp) * 0.035, -0.008, 0.014, 0);
  const poolPressure = clampNumber((poolRatio - 0.9) * 0.0045, -0.009, 0.013, 0);
  const bossPenalty = type.boss ? 0.45 : 1;
  const chance = (0.004 + costRatio * 0.055) * bossPenalty + rtpPressure + poolPressure;
  return clampNumber(chance, MIN_LUCKY_CATCH_CHANCE, MAX_LUCKY_CATCH_CHANCE, 0.004);
}

function rollCriticalMultiplier(room, fish, power) {
  const value = Math.max(1, Number(fish.value || fish.requiredPower || power));
  const currentRtp = calculateRoomRtp(room);
  const poolRatio = room.bank.pool / value;
  const powerBoost = clampNumber((power / value) * 0.7, 0, 0.08, 0);
  const rtpPressure = clampNumber((room.bank.targetRtp - currentRtp) * 0.08, -0.04, 0.045, 0);
  const poolPressure = clampNumber((poolRatio - 0.8) * 0.018, -0.035, 0.04, 0);
  const criticalChance = clampNumber(0.105 + powerBoost + rtpPressure + poolPressure, 0.045, 0.22, 0.105);
  if (Math.random() >= criticalChance) return 1;
  const roll = Math.random();
  if (roll < 0.46) return 2;
  if (roll < 0.72) return 3;
  if (roll < 0.86) return 4;
  if (roll < 0.94) return 5;
  if (roll < 0.985) return 8;
  return 10;
}

function shouldPayCapture(room, gain) {
  if (gain <= 0) return false;
  const currentRtp = calculateRoomRtp(room);
  const projectedRtp = (room.bank.totalOut + gain) / Math.max(1, room.bank.totalIn);
  const poolRatio = room.bank.pool / Math.max(1, gain);
  if (room.bank.pool < gain && projectedRtp > room.bank.targetRtp) return false;
  if (projectedRtp > room.bank.targetRtp + 0.025 && poolRatio < 1.35) return false;

  const rtpPressure = room.bank.targetRtp - currentRtp;
  const chance = clampNumber(0.28 + Math.min(poolRatio, 2) * 0.25 + rtpPressure * 0.75, 0.05, 0.95, 0.34);
  return Math.random() < chance;
}

function exposePlayer(player) {
  return {
    id: player.id,
    name: player.name || player.id,
    coins: player.coins,
    totalPurchased: player.totalPurchased || 0,
    totalSpent: player.totalSpent || 0,
    totalWon: player.totalWon || 0,
    createdAt: player.createdAt,
    lastSeenAt: player.lastSeenAt,
    lastIp: player.lastIp,
    lastCapture: player.lastCapture || null,
    temporary: isTemporaryPlayer(player)
  };
}

function exposePlayerWithToken(player) {
  return { ...exposePlayer(player), token: player.token };
}

function loadStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PLAYERS_FILE)) return { players: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(PLAYERS_FILE, "utf8"));
    return { players: parsed.players || {} };
  } catch {
    const backup = `${PLAYERS_FILE}.${Date.now()}.bak`;
    fs.copyFileSync(PLAYERS_FILE, backup);
    return { players: {} };
  }
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${PLAYERS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, PLAYERS_FILE);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        req.destroy();
        reject(httpError(413, "请求体过大"));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(httpError(400, "JSON 格式错误"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function toPositiveInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw httpError(400, "数字参数无效");
  return number;
}

function normalizeOptionalPlayerId(value) {
  if (!value) return "";
  return normalizePlayerId(value);
}

function normalizePlayerId(value) {
  const id = String(value || "").trim().toUpperCase();
  if (!/^P[A-F0-9]{6}$/.test(id)) throw httpError(400, "玩家号格式无效");
  return id;
}

function normalizePlayerName(value) {
  const name = String(value || "").trim().replace(/[\u0000-\u001f\u007f]/g, "");
  if (!name || name.length > 20) throw httpError(400, "名称需为 1-20 个字符");
  return name;
}

function createPlayerId() {
  let id;
  do {
    id = `P${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  } while (store.players[id]);
  return id;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isLocalRequest(req) {
  const address = remoteAddress(req);
  return address === "127.0.0.1" || address === "::1" || localAddressSet.has(address);
}

function remoteAddress(req) {
  const raw = req.socket.remoteAddress || "";
  if (raw.startsWith("::ffff:")) return raw.slice(7);
  return raw;
}

function collectLocalAddresses() {
  const addresses = new Set(["127.0.0.1", "::1"]);
  for (const items of Object.values(os.networkInterfaces())) {
    for (const item of items || []) {
      if (!item.internal) addresses.add(item.address);
    }
  }
  return addresses;
}

function getLanUrls(port) {
  const urls = [];
  for (const items of Object.values(os.networkInterfaces())) {
    for (const item of items || []) {
      if (item.family === "IPv4" && !item.internal) urls.push(`http://${item.address}:${port}/`);
    }
  }
  return urls;
}

function createRoom() {
  let id;
  do {
    id = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(id));

  const now = Date.now();
  const room = {
    id,
    fish: [],
    players: new Map(),
    startedAt: now,
    tickRate: SIM_TICK_RATE,
    lastUpdate: now,
    lastActiveAt: now,
    nextFishAt: now,
    revision: 0,
    lastBroadcastRevision: -1,
    stats: {
      shots: 0,
      hitRequests: 0,
      hits: 0,
      misses: 0,
      criticalHits: 0,
      luckyCatches: 0,
      instantKills: 0,
      skillUses: 0,
      bombUses: 0,
      laserUses: 0,
      captures: 0
    },
    bank: {
      pool: ROOM_JACKPOT_SEED,
      seed: ROOM_JACKPOT_SEED,
      targetRtp: TARGET_RTP,
      totalIn: 0,
      totalOut: 0,
      lastRtp: 0
    }
  };
  rooms.set(id, room);
  seedField(room);
  return room;
}

function requireRoom(roomId) {
  const id = normalizeRoomId(roomId);
  const room = rooms.get(id);
  if (!room) throw httpError(404, "房间不存在，请重新创建或确认房间号");
  room.lastActiveAt = Date.now();
  return room;
}

function normalizeRoomId(value) {
  const id = String(value || "").trim().toUpperCase();
  if (!/^[A-F0-9]{6}$/.test(id)) throw httpError(400, "房间号格式无效");
  return id;
}

function exposeRoom(room) {
  return {
    id: room.id,
    players: room.players.size,
    startedAt: room.startedAt,
    tickRate: room.tickRate || SIM_TICK_RATE,
    tick: getRoomTick(room),
    bank: exposeRoomBank(room),
    stats: exposeRoomStats(room)
  };
}

function exposeRoomBank(room) {
  return {
    pool: Math.floor(room.bank.pool),
    targetRtp: room.bank.targetRtp,
    rtp: calculateRoomRtp(room),
    totalIn: room.bank.totalIn,
    totalOut: room.bank.totalOut
  };
}

function exposeRoomStats(room) {
  const requests = room.stats.hitRequests || 0;
  return {
    shots: room.stats.shots || 0,
    hitRequests: requests,
    hits: room.stats.hits || 0,
    misses: room.stats.misses || 0,
    criticalHits: room.stats.criticalHits || 0,
    luckyCatches: room.stats.luckyCatches || room.stats.instantKills || 0,
    instantKills: room.stats.instantKills || 0,
    skillUses: room.stats.skillUses || 0,
    bombUses: room.stats.bombUses || 0,
    laserUses: room.stats.laserUses || 0,
    captures: room.stats.captures || 0,
    hitRate: requests ? (room.stats.hits || 0) / requests : 0
  };
}

function exposeAdminRooms() {
  const roomList = Array.from(rooms.values())
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .map((room) => ({
      id: room.id,
      players: room.players.size,
      fish: room.fish.filter((fish) => !fish.dead).length,
      bank: exposeRoomBank(room),
      stats: exposeRoomStats(room),
      lastActiveAt: new Date(room.lastActiveAt).toISOString()
    }));
  const totals = roomList.reduce((acc, room) => {
    acc.players += room.players;
    acc.fish += room.fish;
    acc.pool += room.bank.pool;
    acc.totalIn += room.bank.totalIn;
    acc.totalOut += room.bank.totalOut;
    acc.shots += room.stats.shots;
    acc.hitRequests += room.stats.hitRequests;
    acc.hits += room.stats.hits;
    acc.misses += room.stats.misses;
    acc.criticalHits += room.stats.criticalHits || 0;
    acc.luckyCatches += room.stats.luckyCatches || room.stats.instantKills || 0;
    acc.instantKills += room.stats.instantKills;
    acc.skillUses += room.stats.skillUses || 0;
    acc.captures += room.stats.captures;
    return acc;
  }, { rooms: roomList.length, players: 0, fish: 0, pool: 0, totalIn: 0, totalOut: 0, shots: 0, hitRequests: 0, hits: 0, misses: 0, criticalHits: 0, luckyCatches: 0, instantKills: 0, skillUses: 0, captures: 0 });
  totals.rtp = totals.totalIn ? totals.totalOut / totals.totalIn : 0;
  totals.hitRate = totals.hitRequests ? totals.hits / totals.hitRequests : 0;
  return { rooms: roomList, totals, now: new Date().toISOString() };
}

function calculateRoomRtp(room) {
  if (!room.bank.totalIn) return 0;
  return room.bank.totalOut / room.bank.totalIn;
}

function getRoomTick(room, now = Date.now()) {
  return Math.max(0, Math.floor((now - room.startedAt) / SIM_TICK_MS));
}

function deterministicSeed(...parts) {
  return crypto
    .createHash("sha256")
    .update(parts.map((part) => String(part)).join("|"))
    .digest()
    .readUInt32BE(0);
}

function updateRooms() {
  const now = Date.now();
  for (const room of rooms.values()) updateField(room);
  for (const [id, room] of rooms.entries()) {
    if (room.players.size === 0 && now - room.lastActiveAt > ROOM_TTL_MS) rooms.delete(id);
  }
}

function markRoomFishChanged(room) {
  room.revision = (room.revision || 0) + 1;
}

function seedField(room) {
  for (let i = 0; i < 18; i += 1) spawnFieldFish(room, i === 0, true);
}

function updateField(room) {
  const now = Date.now();
  const tick = getRoomTick(room, now);
  room.lastUpdate = now;

  for (const fish of room.fish) {
    if (fish.dead) continue;
    applyFishAtTick(fish, tick);
  }
  const beforeCount = room.fish.length;
  room.fish = room.fish.filter((fish) => {
    if (fish.dead) return now - fish.deathAt < 850;
    return fish.x > -130 && fish.x < FIELD_W + 130 && fish.y > -120 && fish.y < FIELD_H + 120;
  });
  if (room.fish.length !== beforeCount) markRoomFishChanged(room);

  while (room.fish.filter((fish) => !fish.dead).length < 16) spawnFieldFish(room, false, false);
  if (room.fish.length < MAX_FIELD_FISH && now >= room.nextFishAt) {
    spawnFieldFish(room, false, false);
    room.nextFishAt = now + 650 + Math.random() * 900;
  }

  for (const [id, player] of room.players.entries()) {
    if (now - player.lastSeenAt > PLAYER_TTL_MS) room.players.delete(id);
  }
}

function spawnFieldFish(room, forceBoss = false, visible = false) {
  const type = forceBoss ? weightedBossFishType() : weightedFieldFishType();
  const spawn = createFieldSpawn(type, visible);
  const requiredPower = type.hp * DAMAGE_UNIT;
  const value = type.value || requiredPower;
  const tick = getRoomTick(room);
  const fish = {
    id: crypto.randomBytes(6).toString("hex"),
    typeKey: type.key,
    x: spawn.x,
    y: spawn.y,
    spawnTick: tick,
    spawnX: spawn.x,
    spawnY: spawn.y,
    spawnBaseY: spawn.y,
    baseY: spawn.y,
    dir: spawn.vx >= 0 ? 1 : -1,
    vx: spawn.vx,
    vy: spawn.vy,
    size: type.size,
    phase: randNumber(0, Math.PI * 2),
    hp: type.hp,
    maxHp: type.hp,
    value,
    requiredPower,
    remainingPower: requiredPower,
    powerDamage: 0,
    weightedPower: 0,
    damageByPlayer: {},
    dead: false,
    deathAt: 0,
    path: createFieldPath()
  };
  fish.initialPhase = fish.phase;
  room.fish.push(fish);
  markRoomFishChanged(room);
}

function createFieldSpawn(type, visible) {
  const speed = type.speed * randNumber(0.82, 1.18);
  if (visible) {
    const angle = randNumber(-0.35, 0.35) + (Math.random() < 0.5 ? 0 : Math.PI);
    return {
      x: randNumber(type.size + 40, FIELD_W - type.size - 40),
      y: randNumber(80, FIELD_H - 92),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.45
    };
  }

  const roll = Math.random();
  if (roll < 0.50) return createHorizontalSpawn(type, speed);
  if (roll < 0.78) return createDiagonalSpawn(type, speed);
  return createVerticalSpawn(type, speed);
}

function createHorizontalSpawn(type, speed) {
  const fromLeft = Math.random() < 0.5;
  const angle = (fromLeft ? 0 : Math.PI) + randNumber(-0.18, 0.18);
  const offset = type.size * 0.65 + randNumber(0, 44);
  return {
    x: fromLeft ? -offset : FIELD_W + offset,
    y: randNumber(80, FIELD_H - 92),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed * 0.55
  };
}

function createDiagonalSpawn(type, speed) {
  const fromLeft = Math.random() < 0.5;
  const fromTop = Math.random() < 0.5;
  const xOffset = type.size * 0.65 + randNumber(0, 48);
  const yOffset = type.size * 0.55 + randNumber(0, 42);
  const x = fromLeft ? -xOffset : FIELD_W + xOffset;
  const y = fromTop ? -yOffset : FIELD_H + yOffset;
  const targetX = fromLeft ? randNumber(FIELD_W * 0.55, FIELD_W * 0.95) : randNumber(FIELD_W * 0.05, FIELD_W * 0.45);
  const targetY = fromTop ? randNumber(FIELD_H * 0.45, FIELD_H * 0.85) : randNumber(FIELD_H * 0.15, FIELD_H * 0.55);
  const angle = Math.atan2(targetY - y, targetX - x);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed
  };
}

function createVerticalSpawn(type, speed) {
  const fromTop = Math.random() < 0.5;
  const x = randNumber(type.size + 60, FIELD_W - type.size - 60);
  const yOffset = type.size * 0.6 + randNumber(0, 38);
  const y = fromTop ? -yOffset : FIELD_H + yOffset;
  const targetX = clampNumber(x + randNumber(-FIELD_W * 0.22, FIELD_W * 0.22), 80, FIELD_W - 80, x);
  const targetY = fromTop ? FIELD_H + type.size : -type.size;
  const angle = Math.atan2(targetY - y, targetX - x);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed * 0.9,
    vy: Math.sin(angle) * speed * 0.9
  };
}

function weightedFieldFishType() {
  return weightedFishType(FISH_TYPES);
}

function weightedBossFishType() {
  const bosses = FISH_TYPES.filter((fish) => fish.boss);
  return weightedFishType(bosses.length ? bosses : [FISH_BY_KEY.boss]);
}

function weightedFishType(types) {
  const total = types.reduce((sum, fish) => sum + Number(fish.spawnWeight || 1), 0);
  let roll = Math.random() * total;
  for (const fish of types) {
    roll -= Number(fish.spawnWeight || 1);
    if (roll <= 0) return fish;
  }
  return types[types.length - 1];
}

function createFieldPath() {
  const startT = randNumber(0, Math.PI * 2);
  return {
    kind: pickValue(["wave", "zigzag", "swoop", "drift", "arc"]),
    baseYDrift: randNumber(-10, 10),
    amp: randNumber(8, 34),
    waveSpeed: randNumber(0.9, 2.0),
    startT,
    travelT: startT,
    verticalSpeed: randNumber(-10, 10)
  };
}

function applyFishAtTick(fish, tick) {
  const elapsed = Math.max(0, (tick - (fish.spawnTick || 0)) / SIM_TICK_RATE);
  const phase = (fish.initialPhase ?? fish.phase ?? 0) + elapsed * 6;
  const path = fish.path || {};
  const pathT = (path.startT ?? path.travelT ?? 0) + elapsed;
  const spawnX = fish.spawnX ?? fish.x;
  const spawnBaseY = fish.spawnBaseY ?? fish.baseY ?? fish.y;
  const x = spawnX + fish.vx * elapsed;
  let baseY = spawnBaseY + fish.vy * elapsed;
  const minY = 70 + fish.size * 0.35;
  const maxY = FIELD_H - 90;
  let y;

  if (path.kind === "drift") {
    baseY += Math.sin(pathT * 0.6 + (path.baseYDrift || 0)) * (path.verticalSpeed || 0) * 1.2;
    baseY = clampNumber(baseY, minY, maxY, baseY);
    y = baseY + Math.sin(pathT * path.waveSpeed + phase) * path.amp * 0.28;
  } else if (path.kind === "zigzag") {
    const zig = Math.asin(Math.sin(pathT * path.waveSpeed)) / (Math.PI / 2);
    y = baseY + zig * path.amp * 0.55;
  } else if (path.kind === "swoop") {
    y = baseY + Math.sin(pathT * path.waveSpeed + phase) * path.amp * 0.55 + Math.sin(pathT * path.waveSpeed * 0.42) * path.amp * 0.18;
  } else if (path.kind === "arc") {
    const progress = clampNumber(x / FIELD_W, 0, 1, 0);
    y = baseY + Math.sin(progress * Math.PI + path.baseYDrift) * path.amp * 0.45 + Math.sin(pathT * path.waveSpeed) * 5;
  } else {
    y = baseY + Math.sin(pathT * path.waveSpeed + phase) * path.amp * 0.42;
  }

  fish.x = x;
  fish.baseY = baseY;
  fish.y = clampNumber(y, -140, FIELD_H + 140, y);
  fish.phase = phase;
  fish.pathTravelT = pathT;
  fish.dir = fish.vx >= 0 ? 1 : -1;
}

function exposeField(room, currentPlayerId) {
  const now = Date.now();
  const tick = getRoomTick(room, now);
  return {
    room: exposeRoom(room),
    width: FIELD_W,
    height: FIELD_H,
    now,
    startedAt: room.startedAt,
    tickRate: room.tickRate || SIM_TICK_RATE,
    tick,
    self: store.players[currentPlayerId] ? exposePlayer(store.players[currentPlayerId]) : null,
    fish: room.fish.map(exposeFieldFish),
    players: exposeFieldPlayers(room, currentPlayerId)
  };
}

function exposeFieldPlayers(room, currentPlayerId) {
  const now = Date.now();
  const selfSeat = room.players.get(currentPlayerId)?.seat ?? 0;
  return Array.from(room.players.values())
    .filter((player) => player.id !== currentPlayerId && now - player.lastSeenAt <= PLAYER_TTL_MS)
    .sort((a, b) => ((a.seat - selfSeat + MAX_ROOM_PLAYERS) % MAX_ROOM_PLAYERS) - ((b.seat - selfSeat + MAX_ROOM_PLAYERS) % MAX_ROOM_PLAYERS))
    .map((player, index) => {
      const stored = store.players[player.id] || {};
      const relativeSeat = (player.seat - selfSeat + MAX_ROOM_PLAYERS) % MAX_ROOM_PLAYERS;
      return {
        ...player,
        name: stored.name || player.name || player.id,
        coins: stored.coins ?? player.coins ?? 0,
        relativeSeat,
        slot: index
      };
    });
}

function exposeFieldFish(fish) {
  const type = FISH_BY_KEY[fish.typeKey];
  return {
    id: fish.id,
    typeKey: fish.typeKey,
    name: type.name,
    x: fish.x,
    y: fish.y,
    dir: fish.dir,
    size: fish.size,
    phase: fish.phase,
    hp: fish.hp,
    maxHp: fish.maxHp,
    value: fish.value || fish.requiredPower || type.hp * DAMAGE_UNIT,
    spawnTick: fish.spawnTick || 0,
    spawnX: fish.spawnX ?? fish.x,
    spawnY: fish.spawnY ?? fish.y,
    spawnBaseY: fish.spawnBaseY ?? fish.baseY,
    initialPhase: fish.initialPhase ?? fish.phase,
    baseY: fish.baseY,
    vx: fish.vx,
    vy: fish.vy,
    path: fish.path,
    dead: fish.dead
  };
}

function randNumber(min, max) {
  return Math.random() * (max - min) + min;
}

function pickValue(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function clampInteger(value, min, max, fallback) {
  if (!Number.isInteger(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function handleWsData(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  while (client.buffer.length >= 2) {
    const parsed = parseWsFrame(client.buffer);
    if (!parsed) return;
    client.buffer = client.buffer.slice(parsed.consumed);
    if (parsed.opcode === 0x8) {
      client.socket.end();
      return;
    }
    if (parsed.opcode === 0x9) {
      sendWsFrame(client.socket, parsed.payload, 0xA);
      continue;
    }
    if (parsed.opcode !== 0x1) continue;
    let message;
    try {
      message = JSON.parse(parsed.payload.toString("utf8"));
    } catch {
      sendWsJson(client.socket, { type: "error", error: "消息格式错误" });
      continue;
    }
    handleRoomWsMessage(client, message);
  }
}

function handleRoomWsMessage(client, message) {
  const player = store.players[client.playerId];
  if (!player) {
    sendWsReply(client.socket, message.requestId, false, null, "玩家不存在");
    return;
  }
  const room = rooms.get(client.roomId);
  if (!room) {
    sendWsReply(client.socket, message.requestId, false, null, "房间已关闭，请重新创建或加入房间");
    return;
  }

  try {
    if (message.type === "playerState") {
      updateFieldPlayer(room, player, message.state || {});
      return;
    }

    if (message.type === "fire") {
      const cost = toPositiveInteger(message.cost, 1, 1000);
      const result = processFire(room, player, cost, { socket: { remoteAddress: client.socket.remoteAddress }, headers: {} }, message.state || {});
      if (!result.ok) sendWsReply(client.socket, message.requestId, false, { coins: result.coins }, result.error);
      else {
        const fire = createFireEvent(room, player.id, message.state || {});
        sendWsReply(client.socket, message.requestId, true, { ...result.player, fire });
        broadcastFireEvent(room, player.id, fire);
      }
      return;
    }

    if (message.type === "hit") {
      const power = toPositiveInteger(message.power, 1, 1000);
      const result = processFieldHit(room, player, String(message.fishId || ""), power, { socket: { remoteAddress: client.socket.remoteAddress }, headers: {} });
      if (result.notFound) sendWsReply(client.socket, message.requestId, false, result, result.error);
      else sendWsReply(client.socket, message.requestId, true, result);
      if (!result.notFound) broadcastHitEvent(room, player.id, result);
      return;
    }

    if (message.type === "skill") {
      const result = processSkill(room, player, String(message.skillKey || ""), message.state || {}, { socket: { remoteAddress: client.socket.remoteAddress }, headers: {} });
      if (!result.ok) sendWsReply(client.socket, message.requestId, false, { coins: result.coins }, result.error);
      else {
        sendWsReply(client.socket, message.requestId, true, { ...result.player, skill: result.skill });
        broadcastSkillEvent(room, player.id, result.skill);
      }
      return;
    }

    if (message.type === "field") {
      sendWsJson(client.socket, { type: "field", field: exposeField(room, client.playerId) });
      return;
    }

    sendWsReply(client.socket, message.requestId, false, null, "未知消息类型");
  } catch (error) {
    sendWsReply(client.socket, message.requestId, false, null, error.message || "处理失败");
  }
}

function parseWsFrame(buffer) {
  const first = buffer[0];
  const second = buffer[1];
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  let length = second & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null;
    const high = buffer.readUInt32BE(offset);
    const low = buffer.readUInt32BE(offset + 4);
    if (high !== 0) throw httpError(413, "WebSocket 帧过大");
    length = low;
    offset += 8;
  }

  const maskOffset = offset;
  if (masked) offset += 4;
  if (buffer.length < offset + length) return null;

  let payload = buffer.slice(offset, offset + length);
  if (masked) {
    const mask = buffer.slice(maskOffset, maskOffset + 4);
    payload = Buffer.from(payload);
    for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
  }
  return { opcode, payload, consumed: offset + length };
}

function sendWsReply(socket, requestId, ok, data, error = "") {
  if (!requestId) return;
  sendWsJson(socket, { type: "reply", requestId, ok, data, error });
}

function broadcastRoomSnapshots() {
  for (const room of rooms.values()) {
    if (room.lastBroadcastRevision !== room.revision) {
      broadcastField(room.id);
      room.lastBroadcastRevision = room.revision;
      continue;
    }
    broadcastPlayers(room.id);
  }
}

function broadcastField(roomId = "") {
  for (const client of wsClients) {
    if (client.socket.destroyed) {
      wsClients.delete(client);
      continue;
    }
    if (roomId && client.roomId !== roomId) continue;
    const room = rooms.get(client.roomId);
    if (!room) continue;
    sendWsJson(client.socket, { type: "field", field: exposeField(room, client.playerId) });
  }
}

function broadcastPlayers(roomId) {
  for (const client of wsClients) {
    if (client.socket.destroyed) {
      wsClients.delete(client);
      continue;
    }
    if (client.roomId !== roomId) continue;
    const room = rooms.get(client.roomId);
    if (!room) continue;
    sendWsJson(client.socket, {
      type: "players",
      now: Date.now(),
      room: exposeRoom(room),
      self: store.players[client.playerId] ? exposePlayer(store.players[client.playerId]) : null,
      players: exposeFieldPlayers(room, client.playerId)
    });
  }
}

function createFireEvent(room, playerId, state = {}) {
  const fieldPlayer = room.players.get(playerId) || {};
  const firedAt = Date.now();
  const fireTick = getRoomTick(room, firedAt);
  const power = clampInteger(Number(state.power ?? fieldPlayer.power), 10, 100, 10);
  const id = `${playerId}-${fireTick}-${room.stats.shots || 0}`;
  return {
    id,
    playerId,
    firedAt,
    fireTick,
    seed: deterministicSeed(room.id, id, "fire"),
    aimX: clampNumber(Number(state.aimX ?? fieldPlayer.aimX), 0, 1, 0.5),
    aimY: clampNumber(Number(state.aimY ?? fieldPlayer.aimY), 0, 1, 0.5),
    angle: clampNumber(Number(state.angle ?? fieldPlayer.angle), -Math.PI * 2, Math.PI * 2, -Math.PI / 2),
    cannonIndex: clampInteger(Number(state.cannonIndex ?? fieldPlayer.cannonIndex), 0, 7, 0),
    power,
    targetFishId: String(state.targetFishId || "")
  };
}

function broadcastFireEvent(room, playerId, fire) {
  broadcastWs(room.id, { type: "fire", fire }, playerId);
}

function broadcastHitEvent(room, playerId, result) {
  broadcastWs(room.id, {
    type: "hit",
    hit: {
      playerId,
      fishId: result.fishId,
      hitTick: result.hitTick,
      seed: result.seed,
      effective: result.effective,
      critical: result.critical,
      criticalMultiplier: result.criticalMultiplier,
      luckyCatch: result.luckyCatch,
      instantKill: result.instantKill,
      captured: result.captured,
      gain: result.gain,
      damage: result.damage,
      coins: result.coins,
      fish: result.fish || null
    }
  }, playerId);
}

function broadcastSkillEvent(room, playerId, skill) {
  broadcastWs(room.id, { type: "skill", skill }, playerId);
}

function broadcastWs(roomId, payload, excludePlayerId = "") {
  for (const client of wsClients) {
    if (client.socket.destroyed) {
      wsClients.delete(client);
      continue;
    }
    if (client.roomId !== roomId || client.playerId === excludePlayerId) continue;
    sendWsJson(client.socket, payload);
  }
}

function sendWsJson(socket, payload) {
  if (socket.destroyed) return;
  sendWsFrame(socket, Buffer.from(JSON.stringify(payload), "utf8"), 0x1);
}

function sendWsFrame(socket, payload, opcode = 0x1) {
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(length, 6);
  }
  socket.write(Buffer.concat([header, payload]));
}

process.on("uncaughtException", (error) => {
  console.error(error);
});

process.on("unhandledRejection", (error) => {
  console.error(error);
});
