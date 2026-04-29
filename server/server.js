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
  console.log("国潮像素捕鱼服务器已启动");
  console.log(`本机游戏: http://localhost:${PORT}/`);
  console.log(`本机后台: http://localhost:${PORT}/admin`);
  for (const url of urls) console.log(`局域网游戏: ${url}`);
  console.log("");
  console.log("保持此窗口打开，局域网玩家即可访问上面的局域网游戏地址。");
});

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

  if (req.method === "POST" && url.pathname === "/api/fire") {
    const body = await readJson(req);
    const player = requirePlayer(body.playerId, body.token, req);
    const cost = toPositiveInteger(body.cost, 1, 1000);
    if (player.coins < cost) {
      sendJson(res, 402, { error: "金币不足", coins: player.coins });
      return;
    }
    player.coins -= cost;
    player.totalSpent += cost;
    markSeen(player, req);
    saveStore();
    sendJson(res, 200, exposePlayer(player));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/capture") {
    const body = await readJson(req);
    const player = requirePlayer(body.playerId, body.token, req);
    const gain = toPositiveInteger(body.gain, 0, 1000000);
    player.coins += gain;
    player.totalWon += gain;
    player.lastCapture = {
      fishName: String(body.fishName || "").slice(0, 32),
      gain,
      at: new Date().toISOString()
    };
    markSeen(player, req);
    saveStore();
    sendJson(res, 200, exposePlayer(player));
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

function exposePlayer(player) {
  return {
    id: player.id,
    coins: player.coins,
    totalPurchased: player.totalPurchased || 0,
    totalSpent: player.totalSpent || 0,
    totalWon: player.totalWon || 0,
    createdAt: player.createdAt,
    lastSeenAt: player.lastSeenAt,
    lastIp: player.lastIp,
    lastCapture: player.lastCapture || null
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

process.on("uncaughtException", (error) => {
  console.error(error);
});

process.on("unhandledRejection", (error) => {
  console.error(error);
});
