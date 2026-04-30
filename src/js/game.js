import { ApiError, GameApi } from "./api.js";
import { BULLET_SPEED, CANNON_SAFE_BOTTOM, cannonSkins, FIRE_INTERVAL, fishTypeByKey, fishTypes, PLAYER_SYNC_INTERVAL, skillTypes } from "./config.js";
import { Renderer } from "./renderer.js";
import { clamp, formatNumber, rand, shortPlayerId } from "./utils.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const els = {
  coinText: document.getElementById("coinText"),
  rateText: document.getElementById("rateText"),
  comboText: document.getElementById("comboText"),
  fpsText: document.getElementById("fpsText"),
  powerText: document.getElementById("powerText"),
  lockText: document.getElementById("lockText"),
  lockTarget: document.getElementById("lockTarget"),
  lockBtn: document.getElementById("lockBtn"),
  lockModeText: document.getElementById("lockModeText"),
  autoBtn: document.getElementById("autoBtn"),
  autoModeText: document.getElementById("autoModeText"),
  cannonNameText: document.getElementById("cannonNameText"),
  playerIdText: document.getElementById("playerIdText"),
  toast: document.getElementById("toast"),
  networkBanner: document.getElementById("networkBanner"),
  roomOverlay: document.getElementById("roomOverlay"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  roomBadge: document.getElementById("roomBadge"),
  fishAtlasBtn: document.getElementById("fishAtlasBtn"),
  fishAtlasOverlay: document.getElementById("fishAtlasOverlay"),
  fishAtlasList: document.getElementById("fishAtlasList"),
  fishAtlasCloseBtn: document.getElementById("fishAtlasCloseBtn"),
  plusBtn: document.getElementById("plusBtn"),
  minusBtn: document.getElementById("minusBtn"),
  bombBtn: document.getElementById("bombBtn"),
  laserBtn: document.getElementById("laserBtn"),
  bombCostText: document.getElementById("bombCostText"),
  laserCostText: document.getElementById("laserCostText")
};

class FishGame {
  constructor() {
    this.renderer = new Renderer(ctx);
    this.api = new GameApi();
    this.W = 0;
    this.H = 0;
    this.DPR = 1;
    this.last = performance.now();
    this.coins = 0;
    this.cannonIndex = 0;
    this.cannonPower = cannonSkins[this.cannonIndex].power;
    this.combo = 0;
    this.aim = { x: 0, y: 0 };
    this.cannon = { x: 0, y: 0, angle: -Math.PI / 2 };
    this.fishList = [];
    this.bullets = [];
    this.remoteBullets = [];
    this.nets = [];
    this.beams = [];
    this.floatTexts = [];
    this.particles = [];
    this.bubbles = [];
    this.remotePlayers = [];
    this.remoteFireSeen = new Map();
    this.lockedFish = null;
    this.fieldW = 1000;
    this.fieldH = 620;
    this.tickRate = 60;
    this.tickMs = 1000 / this.tickRate;
    this.serverClockOffset = 0;
    this.roomStartedAt = Date.now();
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsElapsed = 0;
    this.debugHudElapsed = 0;
    this.lockMode = false;
    this.autoFire = false;
    this.isPointerFiring = false;
    this.fireCooldown = 0;
    this.fireInFlight = false;
    this.playerSyncCooldown = 0;
    this.skillCooldowns = { bomb: 0, laser: 0 };
    this.pendingSkillKey = null;
    this.room = null;
    this.playerReady = false;
    this.ready = false;

    this.resize();
    this.bindEvents();
    this.seedScene();
    this.updateHud();
    this.initPlayer();
    requestAnimationFrame((now) => this.loop(now));
  }

  async initPlayer() {
    try {
      const player = await this.api.initPlayer();
      this.playerReady = true;
      this.ready = false;
      this.coins = player.coins;
      els.networkBanner.hidden = true;
      if (els.roomCodeInput && this.api.roomId) els.roomCodeInput.value = this.api.roomId;
      if (els.roomOverlay) els.roomOverlay.hidden = false;
      this.updateHud();
      this.showToast(`玩家 ${player.id}`);
      return;
      this.showToast(`玩家 ${player.id}`);
      /*
      await this.api.connectRealtime({
        onField: (field) => this.applyField(field),
        onClose: () => {
          els.networkBanner.hidden = false;
          this.showToast("实时连接已断开");
        }
      });
      this.syncPlayerState();
      */
    } catch (error) {
      this.ready = false;
      this.playerReady = false;
      els.networkBanner.hidden = false;
      this.showToast(this.describeApiError(error));
      this.updateHud();
    }
  }

  async enterRoom(room) {
    this.room = room;
    this.api.setRoom(room.id);
    this.ready = false;
    els.networkBanner.hidden = false;
    try {
      await this.api.connectRealtime({
        onField: (field) => this.applyField(field),
        onPlayers: (message) => this.applyPlayers(message),
        onFire: (fire) => this.applyRemoteFire(fire),
        onHit: (hit) => this.applyRemoteHit(hit),
        onSkill: (skill) => this.applyRemoteSkill(skill),
        onClose: () => {
          this.ready = false;
          els.networkBanner.hidden = false;
          this.showToast("实时连接已断开");
        }
      });
      this.ready = true;
      this.fishList = [];
      this.lockedFish = null;
      els.networkBanner.hidden = true;
      if (els.roomOverlay) els.roomOverlay.hidden = true;
      this.updateHud();
      this.showToast(`房间 ${room.id}`);
      this.syncPlayerState();
    } catch (error) {
      this.ready = false;
      els.networkBanner.hidden = false;
      if (els.roomOverlay) els.roomOverlay.hidden = false;
      this.showToast(this.describeApiError(error));
      this.updateHud();
    }
  }

  async refreshPlayer() {
    if (!this.api.playerId || !this.ready) return;
    try {
      const player = await this.api.refreshPlayer();
      this.coins = player.coins;
      els.networkBanner.hidden = true;
      this.updateHud();
    } catch {
      els.networkBanner.hidden = false;
    }
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());
    els.plusBtn.addEventListener("pointerdown", () => {
      this.switchCannon(1);
    });
    els.minusBtn.addEventListener("pointerdown", () => {
      this.switchCannon(-1);
    });
    els.lockBtn.addEventListener("pointerdown", () => this.toggleLockMode());
    els.autoBtn.addEventListener("pointerdown", () => this.toggleAutoFire());
    els.bombBtn?.addEventListener("pointerdown", () => this.useSkill("bomb"));
    els.laserBtn?.addEventListener("pointerdown", () => this.useSkill("laser"));
    els.createRoomBtn?.addEventListener("pointerdown", () => this.createRoom());
    els.joinRoomBtn?.addEventListener("pointerdown", () => this.joinRoom());
    els.roomBadge?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      this.copyRoomId();
    });
    els.fishAtlasBtn?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      this.openFishAtlas();
    });
    els.fishAtlasCloseBtn?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      this.closeFishAtlas();
    });
    els.fishAtlasOverlay?.addEventListener("pointerdown", (event) => {
      if (event.target === els.fishAtlasOverlay) this.closeFishAtlas();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.closeFishAtlas();
    });
    els.roomCodeInput?.addEventListener("input", () => {
      els.roomCodeInput.value = els.roomCodeInput.value.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 6);
    });
    els.roomCodeInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.joinRoom();
    });

    canvas.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    canvas.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    canvas.addEventListener("pointerup", (event) => this.stopPointerFire(event));
    canvas.addEventListener("pointercancel", (event) => this.stopPointerFire(event));
    canvas.addEventListener("lostpointercapture", () => {
      this.isPointerFiring = false;
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  resize() {
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    canvas.width = Math.floor(this.W * this.DPR);
    canvas.height = Math.floor(this.H * this.DPR);
    canvas.style.width = `${this.W}px`;
    canvas.style.height = `${this.H}px`;
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.cannon.x = this.W / 2;
    this.cannon.y = Math.max(210, this.H - CANNON_SAFE_BOTTOM);
    this.waterTop = 0;
    this.waterBottom = Math.max(260, this.H - CANNON_SAFE_BOTTOM - 22);
    this.waterHeight = Math.max(180, this.waterBottom - this.waterTop);
    this.aim.x = this.W / 2;
    this.aim.y = this.H / 2;
  }

  getBulletBottomLimit() {
    return Math.min(this.H - 8, Math.max(this.waterBottom, this.cannon.y + 86));
  }

  seedScene() {
    for (let i = 0; i < 28; i += 1) {
      this.bubbles.push({ x: rand(0, this.W), y: rand(0, this.H), r: rand(1, 4), s: rand(10, 38), a: rand(0.12, 0.42) });
    }
  }

  syncClock(now, startedAt, tickRate = 60) {
    if (Number.isFinite(now)) this.serverClockOffset = now - performance.now();
    if (Number.isFinite(startedAt)) this.roomStartedAt = startedAt;
    if (Number.isFinite(tickRate) && tickRate > 0) {
      this.tickRate = tickRate;
      this.tickMs = 1000 / tickRate;
    }
  }

  currentServerNow() {
    return performance.now() + this.serverClockOffset;
  }

  currentTick() {
    return Math.max(0, Math.floor((this.currentServerNow() - this.roomStartedAt) / this.tickMs));
  }

  async createRoom() {
    if (!this.playerReady) return;
    try {
      const room = await this.api.createRoom();
      await this.enterRoom(room);
    } catch (error) {
      this.showToast(this.describeApiError(error));
    }
  }

  async joinRoom() {
    if (!this.playerReady) return;
    const roomId = (els.roomCodeInput?.value || "").trim().toUpperCase();
    if (!/^[A-F0-9]{6}$/.test(roomId)) {
      this.showToast("请输入6位房间号");
      return;
    }
    try {
      const room = await this.api.joinRoom(roomId);
      await this.enterRoom(room);
    } catch (error) {
      this.showToast(this.describeApiError(error));
    }
  }

  async copyRoomId() {
    const roomId = this.room?.id || this.api.roomId || "";
    if (!roomId) {
      this.showToast("还没有房间号");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(roomId);
      else this.fallbackCopyText(roomId);
      this.showToast(`房间号 ${roomId} 已复制`);
    } catch {
      if (this.fallbackCopyText(roomId)) this.showToast(`房间号 ${roomId} 已复制`);
      else this.showToast(`房间号 ${roomId}`);
    }
  }

  fallbackCopyText(text) {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-999px";
    document.body.appendChild(input);
    input.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    input.remove();
    return copied;
  }

  openFishAtlas() {
    this.renderFishAtlas();
    if (els.fishAtlasOverlay) els.fishAtlasOverlay.hidden = false;
  }

  closeFishAtlas() {
    if (els.fishAtlasOverlay) els.fishAtlasOverlay.hidden = true;
  }

  renderFishAtlas() {
    if (!els.fishAtlasList) return;
    els.fishAtlasList.innerHTML = fishTypes.map((fish) => `
      <article class="fishAtlasCard">
        <span class="atlasFishIcon" style="--fish-color: ${escapeHtml(fish.color)}; --fish-accent: ${escapeHtml(fish.accent)};"></span>
        <div>
          <strong>${escapeHtml(fish.name)}</strong>
          <span>固定价值 ${formatNumber(fish.value)} · 血量 ${formatNumber(fish.hp)}</span>
          <small>速度 ${formatNumber(Math.round(fish.speed))} · 参考赔率 x${formatNumber(fish.rate)}</small>
        </div>
      </article>
    `).join("");
  }

  switchCannon(delta) {
    this.cannonIndex = clamp(this.cannonIndex + delta, 0, cannonSkins.length - 1);
    this.cannonPower = cannonSkins[this.cannonIndex].power;
    this.updateHud();
    this.syncPlayerState();
  }

  async syncField() {
    if (!this.ready || !this.api.connected) return;
    try {
      const field = await this.api.getField();
      this.applyField(field);
      els.networkBanner.hidden = true;
    } catch {
      els.networkBanner.hidden = false;
    }
  }

  async syncPlayerState() {
    if (!this.ready || !this.api.connected) return;
    try {
      const field = await this.api.syncPlayerState(this.buildPlayerState());
      if (field) this.applyField(field);
      els.networkBanner.hidden = true;
    } catch {
      els.networkBanner.hidden = false;
    }
  }

  buildPlayerState(isFiring = false) {
    return {
      aimX: clamp(this.aim.x / Math.max(this.W, 1), 0, 1),
      aimY: clamp((this.aim.y - this.waterTop) / Math.max(this.waterHeight, 1), 0, 1),
      angle: this.cannon.angle,
      cannonIndex: this.cannonIndex,
      power: this.cannonPower,
      lockMode: this.lockMode,
      autoFire: this.autoFire,
      targetFishId: this.lockMode && this.lockedFish && !this.lockedFish.dead ? this.lockedFish.id : "",
      isFiring
    };
  }

  applyField(field) {
    if (!field) return;
    this.syncClock(field.now, field.startedAt || field.room?.startedAt, field.tickRate || field.room?.tickRate);
    this.fieldW = field.width || this.fieldW;
    this.fieldH = field.height || this.fieldH;
    if (field.room) {
      this.room = field.room;
      this.api.setRoom(field.room.id);
    }
    if (field.self) this.coins = field.self.coins;
    const oldById = new Map(this.fishList.map((fish) => [fish.id, fish]));
    this.fishList = field.fish.map((fish) => {
      const old = oldById.get(fish.id);
      const mapped = this.mapFieldFish(fish);
      if (old) {
        mapped.hitFlash = old.hitFlash;
        mapped.deathT = old.deathT;
      }
      return mapped;
    });
    this.applyPlayers({ room: field.room, self: field.self, players: field.players || [], now: field.now }, false);
    if (this.lockedFish) {
      const lockedId = this.lockedFish.id;
      this.lockedFish = this.fishList.find((fish) => fish.id === lockedId && this.isFishLockable(fish)) || null;
    }
    if (this.lockMode && !this.lockedFish) this.lockHighestRateFish();
    this.updateHud();
  }

  applyPlayers(message, updateHud = true) {
    if (!message) return;
    this.syncClock(message.now, message.room?.startedAt, message.room?.tickRate);
    if (message.room) {
      this.room = message.room;
      this.api.setRoom(message.room.id);
    }
    if (message.self) this.coins = message.self.coins;
    const previousById = new Map(this.remotePlayers.map((player) => [player.id, player]));
    const players = (message.players || []).slice(0, 3);
    this.remotePlayers = players.map((player, index) => {
      const previous = previousById.get(player.id);
      const pose = this.getRemoteCannonPose(player, index, Math.max(1, players.length));
      return {
        ...player,
        displayAngle: Number.isFinite(previous?.displayAngle)
          ? previous.displayAngle
          : this.getRemoteShotAngle({ ...player, targetFishId: "" }, pose),
        lastFireLocalAt: previous?.lastFireLocalAt || 0
      };
    });
    if (updateHud) this.updateHud();
  }

  applyRemoteFire(fire) {
    if (!fire || fire.playerId === this.api.playerId) return;
    const fireId = fire.id || `${fire.playerId}-${fire.firedAt || Date.now()}`;
    if (this.remoteFireSeen.get(fire.playerId) === fireId) return;
    this.remoteFireSeen.set(fire.playerId, fireId);
    let index = this.remotePlayers.findIndex((item) => item.id === fire.playerId);
    const basePlayer = index >= 0 ? this.remotePlayers[index] : { id: fire.playerId, relativeSeat: 2 };
    let player = {
      ...basePlayer,
      aimX: fire.aimX,
      aimY: fire.aimY,
      angle: fire.angle,
      cannonIndex: fire.cannonIndex,
      power: fire.power,
      targetFishId: fire.targetFishId,
      lastFireLocalAt: performance.now()
    };
    if (index >= 0) {
      this.remotePlayers[index] = player;
    } else {
      this.remotePlayers = [...this.remotePlayers, player].slice(0, 3);
      index = this.remotePlayers.findIndex((item) => item.id === fire.playerId);
    }
    const safeIndex = Math.max(0, index);
    const count = Math.max(1, this.remotePlayers.length);
    const pose = this.getRemoteCannonPose(player, safeIndex, count);
    player = {
      ...player,
      displayAngle: this.getRemoteShotAngle(player, pose)
    };
    this.remotePlayers[safeIndex] = player;
    this.createRemoteBullet({ ...player, id: fireId, playerId: fire.playerId, fireTick: fire.fireTick, seed: fire.seed }, safeIndex, count);
  }

  applyRemoteHit(hit) {
    if (!hit || hit.playerId === this.api.playerId) return;
    this.applyHitEvent(hit, false);
  }

  applyRemoteSkill(skill) {
    if (!skill || skill.playerId === this.api.playerId) return;
    this.applySkillEvent(skill, false);
  }

  applyHitEvent(hit, isSelf = false) {
    if (!hit) return;
    const fish = this.fishList.find((item) => item.id === hit.fishId);
    if (!fish) return;
    this.advanceFish(fish, Number.isInteger(hit.hitTick) ? hit.hitTick : this.currentTick());
    if (isSelf && Number.isFinite(hit.coins)) this.coins = hit.coins;
    const seed = hit.seed || hashSeed(hit.playerId || "hit", hit.fishId || "", hit.hitTick || this.currentTick());
    const luckyCatch = Boolean(hit.luckyCatch || hit.instantKill);
    this.spawnHitParticles(fish.x, fish.y, seed, hit.captured || luckyCatch || hit.critical);
    fish.hitFlash = 0.12;
    this.nets.push({ x: fish.x, y: fish.y, r: luckyCatch ? 18 : 8, maxR: fish.size * (luckyCatch ? 1.35 : 0.78), life: luckyCatch ? 0.58 : 0.28, power: 10, dud: false, instantKill: luckyCatch });
    if (!hit.effective) {
      this.floatTexts.push({ x: fish.x, y: fish.y - 10, text: "MISS", life: 0.55, vy: -34, size: 16, miss: true });
      if (isSelf) this.updateHud();
      return;
    }
    if (luckyCatch) {
      this.floatTexts.push({ x: fish.x, y: fish.y - 30, text: "鸿运爆捕", life: 0.95, vy: -62, size: fish.type.boss ? 38 : 30, jackpot: true });
      this.spawnInstantKillEffect(fish.x, fish.y, fish.size, seed);
    } else if (hit.critical) {
      this.floatTexts.push({ x: fish.x, y: fish.y - 26, text: `暴击 x${hit.criticalMultiplier || 2}`, life: 0.72, vy: -48, size: fish.type.boss ? 28 : 22, critical: true });
    }
    if (hit.fish) {
      fish.hp = hit.fish.hp;
      fish.maxHp = hit.fish.maxHp;
    } else {
      fish.hp = Math.max(0, fish.hp - Math.max(1, Number(hit.damage || 1)));
    }
    this.floatTexts.push({ x: fish.x, y: fish.y - 10, text: `-${Math.max(1, Number(hit.damage || 1))}`, life: 0.42, vy: -30, size: 15, miss: true });
    if (hit.captured && !fish.dead) {
      fish.dead = true;
      if (isSelf) this.combo += 1;
      this.floatTexts.push({
        x: fish.x,
        y: fish.y - 10,
        text: `+${hit.gain}`,
        life: luckyCatch ? 1.35 : 1,
        vy: luckyCatch ? -58 : -48,
        size: luckyCatch ? (fish.type.boss ? 44 : 32) : (fish.type.boss ? 36 : 24),
        rewardOwner: isSelf ? "self" : "remote",
        jackpot: luckyCatch
      });
      this.explode(fish.x, fish.y, fish.size, fish.type.boss || luckyCatch, seed);
      if (this.lockedFish === fish) {
        this.lockedFish = null;
        this.lockHighestRateFish();
      }
    }
    if (isSelf) this.updateHud();
  }

  mapFieldFish(fish) {
    const type = fishTypeByKey[fish.typeKey] || fishTypeByKey.blue;
    const targetX = (fish.x / this.fieldW) * this.W;
    const targetY = this.waterTop + (fish.y / this.fieldH) * this.waterHeight;
    const path = fish.path ? { ...fish.path } : { kind: "wave", travelT: 0, baseYDrift: 0, amp: 12, waveSpeed: 1, verticalSpeed: 0 };
    const mapped = {
      id: fish.id,
      type,
      x: targetX,
      y: targetY,
      targetX,
      targetY,
      spawnTick: fish.spawnTick || 0,
      spawnX: fish.spawnX ?? fish.x,
      spawnY: fish.spawnY ?? fish.y,
      spawnBaseY: fish.spawnBaseY ?? fish.baseY ?? fish.y,
      fieldX: fish.x,
      fieldY: fish.y,
      fieldBaseY: fish.baseY ?? fish.y,
      fieldVx: fish.vx || 0,
      fieldVy: fish.vy || 0,
      dir: fish.dir,
      value: fish.value ?? type.value ?? type.rate * 10,
      speed: 0,
      size: fish.size,
      initialPhase: fish.initialPhase ?? fish.phase ?? 0,
      phase: fish.phase,
      path,
      hitFlash: 0,
      dead: fish.dead,
      deathT: 0,
      hitCount: 0,
      hp: fish.hp,
      maxHp: fish.maxHp
    };
    this.advanceFish(mapped, this.currentTick());
    return mapped;
  }

  fieldToScreen(fieldX, fieldY) {
    return {
      x: (Number(fieldX || 0) / this.fieldW) * this.W,
      y: this.waterTop + (Number(fieldY || 0) / this.fieldH) * this.waterHeight
    };
  }

  isFishLockable(fish) {
    if (!fish || fish.dead) return false;
    const x = fish.targetX ?? fish.x;
    const y = fish.targetY ?? fish.y;
    const margin = Math.max(18, fish.size * 0.35);
    return x >= margin && x <= this.W - margin && y >= this.waterTop + margin && y <= this.waterBottom - margin;
  }

  toggleLockMode() {
    this.lockMode = !this.lockMode;
    if (this.lockMode) {
      this.lockHighestRateFish();
      if (this.lockedFish) this.showToast(`锁定 ${this.lockedFish.type.name} ${formatNumber(this.lockedFish.value)}币`);
      else this.showToast("当前没有可锁定目标");
    } else {
      this.lockedFish = null;
    }
    this.updateHud();
    this.syncPlayerState();
  }

  toggleAutoFire() {
    this.autoFire = !this.autoFire;
    this.fireCooldown = 0;
    this.updateHud();
    this.syncPlayerState();
    this.showToast(this.autoFire ? "自动开火已开启" : "自动开火已关闭");
  }

  lockHighestRateFish() {
    if (!this.lockMode) {
      this.lockedFish = null;
      return;
    }
    let best = null;
    for (const fish of this.fishList) {
      if (!this.isFishLockable(fish)) continue;
      if (!best) {
        best = fish;
        continue;
      }
      const fishScore = (fish.value || fish.type.rate * 10) * 1000 - Math.abs(fish.x - this.W / 2);
      const bestScore = (best.value || best.type.rate * 10) * 1000 - Math.abs(best.x - this.W / 2);
      if (fishScore > bestScore) best = fish;
    }
    this.lockedFish = best;
    if (best) {
      this.aim.x = best.x;
      this.aim.y = best.y;
    }
    this.updateHud();
  }

  handlePointerMove(event) {
    this.setAim(event);
  }

  handlePointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    this.setAim(event);
    if (this.pendingSkillKey) {
      const skillKey = this.pendingSkillKey;
      this.pendingSkillKey = null;
      this.updateHud();
      this.releaseSkillAt(skillKey, this.aim.x, this.aim.y);
      return;
    }
    canvas.setPointerCapture?.(event.pointerId);
    const selectedFish = this.findFishAt(this.aim.x, this.aim.y);
    if (this.lockMode && selectedFish) {
      this.lockedFish = selectedFish;
      this.aim.x = selectedFish.x;
      this.aim.y = selectedFish.y;
      this.showToast(`锁定 ${selectedFish.type.name} ${formatNumber(selectedFish.value)}币`);
      this.updateHud();
    }
    this.isPointerFiring = true;
    this.fireCooldown = 0;
    this.fireOnce();
  }

  stopPointerFire(event) {
    this.isPointerFiring = false;
    if (event?.pointerId !== undefined) canvas.releasePointerCapture?.(event.pointerId);
  }

  setAim(event) {
    const rect = canvas.getBoundingClientRect();
    this.aim.x = event.clientX - rect.left;
    this.aim.y = event.clientY - rect.top;
  }

  findFishAt(x, y) {
    for (let i = this.fishList.length - 1; i >= 0; i -= 1) {
      const fish = this.fishList[i];
      const distance = Math.hypot(x - fish.x, y - fish.y);
      if (this.isFishLockable(fish) && distance < fish.size * 0.72) return fish;
    }
    return null;
  }

  async fireOnce() {
    if (this.fireInFlight) return;
    if (!this.ready || !this.api.connected) {
      this.showToast("请先启动服务器");
      this.autoFire = false;
      this.isPointerFiring = false;
      this.updateHud();
      return;
    }
    if (this.coins < this.cannonPower) {
      this.showToast("金币不足，请联系管理员充值");
      this.autoFire = false;
      this.isPointerFiring = false;
      this.updateHud();
      return;
    }

    this.fireInFlight = true;
    try {
      const result = await this.api.spend(this.cannonPower, this.buildPlayerState(true));
      this.coins = result.coins;
      this.updateHud();
      this.createBullet(result.fire || null);
    } catch (error) {
      this.showToast(this.describeApiError(error));
      if (error instanceof ApiError && error.status === 402) {
        this.autoFire = false;
        this.isPointerFiring = false;
        this.updateHud();
      }
    } finally {
      this.fireInFlight = false;
    }
  }

  async useSkill(skillKey) {
    const skill = skillTypes[skillKey];
    if (!skill) return;
    if (!this.ready || !this.api.connected) {
      this.showToast("请先启动服务器");
      return;
    }
    if (this.skillCooldowns[skillKey] > 0) return;
    if (this.coins < skill.cost) {
      this.showToast(`${skill.name} 金币不足`);
      return;
    }

    if (this.pendingSkillKey === skillKey) {
      this.pendingSkillKey = null;
      this.updateHud();
      this.showToast(`${skill.name} 已取消`);
      return;
    }

    this.pendingSkillKey = skillKey;
    this.updateHud();
    this.showToast(`${skill.name} 已选择，点击渔场释放`);
  }

  async releaseSkillAt(skillKey, x, y) {
    const skill = skillTypes[skillKey];
    if (!skill) return;
    if (!this.ready || !this.api.connected) {
      this.showToast("请先启动服务器");
      return;
    }
    if (this.skillCooldowns[skillKey] > 0) return;
    if (this.coins < skill.cost) {
      this.showToast(`${skill.name} 金币不足`);
      return;
    }

    this.skillCooldowns[skillKey] = skillKey === "laser" ? 1.2 : 0.9;
    const state = this.buildSkillState(skillKey, { x, y });
    try {
      const result = await this.api.useSkill(skillKey, state);
      this.coins = result.coins;
      this.updateHud();
      if (result.skill) this.applySkillEvent(result.skill, true);
    } catch (error) {
      this.skillCooldowns[skillKey] = 0;
      this.showToast(this.describeApiError(error));
    }
  }

  buildSkillState(skillKey, point = null) {
    const selectedFish = point ? this.findFishAt(point.x, point.y) : null;
    const target = point || (this.lockMode && this.isFishLockable(this.lockedFish) ? this.lockedFish : this.aim);
    const angle = skillKey === "laser" ? Math.atan2(target.y - this.cannon.y, target.x - this.cannon.x) : this.cannon.angle;
    return {
      aimX: clamp(target.x / Math.max(this.W, 1), 0, 1),
      aimY: clamp((target.y - this.waterTop) / Math.max(this.waterHeight, 1), 0, 1),
      angle,
      targetFishId: selectedFish?.id || (!point && target?.id) || ""
    };
  }

  applySkillEvent(skill, isSelf = false) {
    if (!skill) return;
    if (isSelf && Number.isFinite(skill.coins)) this.coins = skill.coins;
    if (skill.key === "bomb") this.showBombEffect(skill);
    if (skill.key === "laser") this.showLaserEffect(skill, isSelf);
    for (const hit of skill.hits || []) this.applyHitEvent(hit, isSelf && hit.playerId === this.api.playerId);
    if (isSelf) this.updateHud();
  }

  showBombEffect(skill) {
    const point = this.fieldToScreen(skill.x, skill.y);
    const radius = ((skill.radius || 150) / this.fieldW) * this.W;
    this.nets.push({ x: point.x, y: point.y, r: 24, maxR: radius, life: 0.62, power: skill.power, boom: true, instantKill: true });
    const rng = seededRandom(skill.seed || 1);
    const colors = ["#ff5c42", "#ffd84e", "#fff7bb", "#8ef8ff"];
    for (let i = 0; i < 42; i += 1) {
      const angle = rng() * Math.PI * 2;
      const speed = lerp(70, 320, rng());
      this.particles.push({
        x: point.x,
        y: point.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: lerp(2, 7, rng()),
        life: lerp(0.36, 0.86, rng()),
        max: 0.86,
        color: colors[Math.floor(rng() * colors.length)]
      });
    }
  }

  showLaserEffect(skill, isSelf = false) {
    const player = isSelf ? null : this.remotePlayers.find((item) => item.id === skill.playerId);
    const remoteIndex = isSelf ? 0 : this.remotePlayers.findIndex((item) => item.id === skill.playerId);
    const pose = isSelf ? { x: this.cannon.x, y: this.cannon.y } : this.getRemoteCannonPose(player || { id: skill.playerId, relativeSeat: 2 }, Math.max(0, remoteIndex), Math.max(1, this.remotePlayers.length));
    const target = isSelf ? this.fieldToScreen(skill.x, skill.y) : this.getRemoteAimPoint({ ...(player || {}), aimX: skill.aimX, aimY: skill.aimY, targetFishId: skill.targetFishId }, pose);
    const angle = Math.atan2(target.y - pose.y, target.x - pose.x);
    const length = Math.max(this.W, this.H) * 1.35;
    this.beams.push({
      x1: pose.x,
      y1: pose.y,
      x2: pose.x + Math.cos(angle) * length,
      y2: pose.y + Math.sin(angle) * length,
      life: 0.28,
      max: 0.28,
      color: isSelf ? "#fff7bb" : "#8ef8ff",
      width: 18
    });
  }

  createBullet(fire = null) {
    if (this.lockMode && !this.isFishLockable(this.lockedFish)) this.lockHighestRateFish();
    const lockedTarget = this.lockMode && this.isFishLockable(this.lockedFish) ? this.lockedFish : null;
    const target = lockedTarget || this.aim;
    const angle = Number.isFinite(fire?.angle) ? fire.angle : Math.atan2(target.y - this.cannon.y, target.x - this.cannon.x);
    const startTick = Number.isInteger(fire?.fireTick) ? fire.fireTick : this.currentTick();
    this.bullets.push({
      id: fire?.id || `local-${startTick}-${this.bullets.length}`,
      x: this.cannon.x,
      y: this.cannon.y,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      startTick,
      lastTick: startTick,
      seed: fire?.seed || hashSeed("local", startTick, this.api.playerId),
      power: fire?.power || this.cannonPower,
      life: 1,
      maxLife: 1,
      angle,
      targetFishId: fire?.targetFishId || (lockedTarget ? lockedTarget.id : null),
      hitFishIds: new Set(),
      bounce: 0,
      maxBounce: Number.POSITIVE_INFINITY
    });
    this.createMuzzle(this.cannon.x, this.cannon.y, angle);
  }

  getRemoteCannonPose(player, index = 0, count = 1) {
    if (count === 1) {
      return { x: this.W / 2, y: 78, side: "top", viewSeat: 2 };
    }
    if (count === 2) {
      return { x: this.W * (index === 0 ? 0.28 : 0.72), y: 78, side: "top", viewSeat: 2 };
    }
    const relativeSeat = Number(player.relativeSeat || 0);
    if (relativeSeat === 1) {
      return { x: this.W - 56, y: this.waterTop + this.waterHeight * 0.52, side: "right", viewSeat: 1 };
    }
    if (relativeSeat === 3) {
      return { x: 56, y: this.waterTop + this.waterHeight * 0.52, side: "left", viewSeat: 3 };
    }
    return { x: this.W / 2, y: 78, side: "top", viewSeat: 2 };
  }

  getRemoteAimPoint(player, pose = null) {
    if (player.targetFishId) {
      const targetFish = this.fishList.find((fish) => fish.id === player.targetFishId && !fish.dead);
      if (targetFish) return { x: targetFish.x, y: targetFish.y };
    }
    const localX = clamp(player.aimX ?? 0.5, 0, 1);
    const localY = clamp(player.aimY ?? 0.5, 0, 1);
    const point = transformRemotePoint(localX, localY, pose?.viewSeat ?? Number(player.relativeSeat || 2));
    return {
      x: point.x * this.W,
      y: this.waterTop + point.y * this.waterHeight
    };
  }

  getRemoteShotAngle(player, pose) {
    const target = this.getRemoteAimPoint(player, pose);
    return Math.atan2(target.y - pose.y, target.x - pose.x);
  }

  createRemoteBullet(player, index, count) {
    const pose = this.getRemoteCannonPose(player, index, count);
    const angle = Number.isFinite(player.displayAngle) ? player.displayAngle : this.getRemoteShotAngle(player, pose);
    const startTick = Number.isInteger(player.fireTick) ? player.fireTick : this.currentTick();
    this.remoteBullets.push({
      id: player.id || `remote-${startTick}-${this.remoteBullets.length}`,
      x: pose.x,
      y: pose.y,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      startTick,
      lastTick: startTick,
      seed: player.seed || hashSeed("remote", player.playerId || player.id, startTick),
      angle,
      life: 1,
      maxLife: 1,
      remote: true,
      power: player.power || 10,
      targetFishId: player.targetFishId || null,
      hitFishIds: new Set(),
      bounce: 0,
      maxBounce: Number.POSITIVE_INFINITY
    });
  }

  advanceBulletToTick(bullet, targetTick, owner = "local") {
    if (!Number.isInteger(bullet.lastTick)) bullet.lastTick = Number.isInteger(bullet.startTick) ? bullet.startTick : targetTick;
    const maxSteps = 180;
    let steps = 0;
    while (bullet.lastTick < targetTick && bullet.life > 0 && steps < maxSteps) {
      this.stepBullet(bullet, 1 / this.tickRate, owner);
      bullet.lastTick += 1;
      steps += 1;
    }
  }

  stepBullet(bullet, dt, owner = "local") {
    this.trackBulletTarget(bullet, dt);
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.angle = Math.atan2(bullet.vy, bullet.vx);

    if (bullet.x < 8 || bullet.x > this.W - 8) {
      bullet.x = clamp(bullet.x, 8, this.W - 8);
      bullet.vx *= -1;
      bullet.bounce += 1;
      this.createBounceSpark(bullet.x, bullet.y);
    }
    const bottomLimit = this.getBulletBottomLimit();
    if (bullet.y < 8 || bullet.y > bottomLimit) {
      bullet.y = clamp(bullet.y, 8, bottomLimit);
      bullet.vy *= -1;
      bullet.bounce += 1;
      this.createBounceSpark(bullet.x, bullet.y);
    }

    for (const fish of this.fishList) {
      if (bullet.targetFishId && fish.id !== bullet.targetFishId) continue;
      if (fish.dead || bullet.hitFishIds.has(fish.id)) continue;
      const distance = Math.hypot(bullet.x - fish.x, bullet.y - fish.y);
      if (distance < fish.size * 0.52 + 5) {
        bullet.life = 0;
        if (owner === "local") {
          this.hitFish(fish, bullet);
        } else {
          bullet.hitFishIds.add(fish.id);
          fish.hitFlash = Math.max(fish.hitFlash, 0.08);
          this.nets.push({ x: fish.x, y: fish.y, r: 8, maxR: fish.size * 0.64, life: 0.22, power: bullet.power, dud: false });
        }
        break;
      }
    }
  }

  trackBulletTarget(bullet, dt) {
    if (!bullet.targetFishId) return;
    const target = this.fishList.find((fish) => fish.id === bullet.targetFishId && !fish.dead);
    if (!target || !this.isFishLockable(target)) {
      bullet.targetFishId = null;
      return;
    }

    const speed = Math.hypot(bullet.vx, bullet.vy) || BULLET_SPEED;
    const desiredAngle = Math.atan2(target.y - bullet.y, target.x - bullet.x);
    const currentAngle = Math.atan2(bullet.vy, bullet.vx);
    const angleDelta = Math.atan2(Math.sin(desiredAngle - currentAngle), Math.cos(desiredAngle - currentAngle));
    const nextAngle = currentAngle + angleDelta * Math.min(1, dt * 9);
    bullet.vx = Math.cos(nextAngle) * speed;
    bullet.vy = Math.sin(nextAngle) * speed;
    bullet.angle = nextAngle;
  }

  createMuzzle(x, y, angle) {
    for (let i = 0; i < 8; i += 1) {
      const a = angle + rand(-0.45, 0.45);
      this.particles.push({ x, y, vx: Math.cos(a) * rand(80, 180), vy: Math.sin(a) * rand(80, 180), r: rand(2, 5), life: rand(0.18, 0.34), max: 0.34, color: "#ffd84e" });
    }
  }

  async hitFish(fish, bullet) {
    if (bullet.hitFishIds.has(fish.id)) return;
    bullet.hitFishIds.add(fish.id);

    let result;
    try {
      result = await this.api.hitFish(fish.id, bullet.power);
    } catch (error) {
      this.showToast(this.describeApiError(error));
      return;
    }

    this.applyHitEvent(result, true);
    if (result.captured) this.showToast(`${(result.luckyCatch || result.instantKill) ? "鸿运爆捕 " : "捕获 "}${fish.type.name} +${result.gain}`);
  }

  spawnHitParticles(x, y, seed, strong = false) {
    const rng = seededRandom(seed);
    const count = strong ? 14 : 8;
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        x,
        y,
        vx: lerp(-120, 120, rng()),
        vy: lerp(-120, 80, rng()),
        r: lerp(1.5, strong ? 5 : 4, rng()),
        life: lerp(0.24, strong ? 0.64 : 0.5, rng()),
        max: strong ? 0.64 : 0.5,
        color: rng() < 0.5 ? "#fff2a2" : "#ffd84e"
      });
    }
  }

  spawnInstantKillEffect(x, y, size, seed) {
    const rng = seededRandom(hashSeed(seed, "lucky-catch"));
    const colors = ["#fff7bb", "#ffdd4a", "#ff5c42", "#8ef8ff"];
    for (let i = 0; i < 34; i += 1) {
      const angle = rng() * Math.PI * 2;
      const speed = lerp(120, 360, rng());
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: lerp(2.5, 7, rng()),
        life: lerp(0.42, 0.9, rng()),
        max: 0.9,
        color: colors[Math.floor(rng() * colors.length)]
      });
    }
    this.nets.push({ x, y, r: size * 0.35, maxR: size * 1.85, life: 0.7, power: 0, boom: true, instantKill: true });
  }

  explode(x, y, size, boss = false, seed = 1) {
    const rng = seededRandom(seed);
    const count = boss ? 80 : 24;
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const speed = lerp(40, boss ? 280 : 160, rng());
      const colors = ["#ffd84e", "#fff2a2", "#ff5c42", "#67f7ff"];
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: lerp(2, boss ? 8 : 5, rng()), life: lerp(0.45, boss ? 1.1 : 0.72, rng()), max: 1.1, color: colors[Math.floor(rng() * colors.length)] });
    }
    this.nets.push({ x, y, r: 16, maxR: boss ? 140 : 72, life: boss ? 0.75 : 0.42, power: 0, boom: true });
  }

  advanceFish(fish, tick = this.currentTick()) {
    const elapsed = Math.max(0, (tick - (fish.spawnTick || 0)) / this.tickRate);
    const phase = (fish.initialPhase ?? fish.phase ?? 0) + elapsed * 6;
    const path = fish.path || {};
    const pathT = (path.startT ?? path.travelT ?? 0) + elapsed;
    fish.path = path;
    const spawnX = fish.spawnX ?? fish.fieldX ?? 0;
    const spawnBaseY = fish.spawnBaseY ?? fish.fieldBaseY ?? fish.fieldY ?? 0;
    fish.fieldX = spawnX + (fish.fieldVx || 0) * elapsed;
    fish.fieldBaseY = spawnBaseY + (fish.fieldVy || 0) * elapsed;
    const minY = 70 + fish.size * 0.35;
    const maxY = this.fieldH - 90;

    if (path.kind === "drift") {
      fish.fieldBaseY += Math.sin(pathT * 0.6 + (path.baseYDrift || 0)) * (path.verticalSpeed || 0) * 1.2;
      fish.fieldBaseY = clamp(fish.fieldBaseY, minY, maxY);
      fish.fieldY = fish.fieldBaseY + Math.sin(pathT * (path.waveSpeed || 1) + phase) * (path.amp || 0) * 0.28;
    } else if (path.kind === "zigzag") {
      const zig = Math.asin(Math.sin(pathT * (path.waveSpeed || 1))) / (Math.PI / 2);
      fish.fieldY = fish.fieldBaseY + zig * (path.amp || 0) * 0.55;
    } else if (path.kind === "swoop") {
      fish.fieldY = fish.fieldBaseY + Math.sin(pathT * (path.waveSpeed || 1) + phase) * (path.amp || 0) * 0.55 + Math.sin(pathT * (path.waveSpeed || 1) * 0.42) * (path.amp || 0) * 0.18;
    } else if (path.kind === "arc") {
      const progress = clamp(fish.fieldX / this.fieldW, 0, 1);
      fish.fieldY = fish.fieldBaseY + Math.sin(progress * Math.PI + (path.baseYDrift || 0)) * (path.amp || 0) * 0.45 + Math.sin(pathT * (path.waveSpeed || 1)) * 5;
    } else {
      fish.fieldY = fish.fieldBaseY + Math.sin(pathT * (path.waveSpeed || 1) + phase) * (path.amp || 0) * 0.42;
    }

    fish.fieldY = clamp(fish.fieldY, -140, this.fieldH + 140);
    fish.x = (fish.fieldX / this.fieldW) * this.W;
    fish.y = this.waterTop + (fish.fieldY / this.fieldH) * this.waterHeight;
    fish.targetX = fish.x;
    fish.targetY = fish.y;
    fish.dir = (fish.fieldVx || 0) >= 0 ? 1 : -1;
    fish.phase = phase;
  }

  update(dt) {
    if (this.lockedFish && (this.lockedFish.dead || !this.fishList.includes(this.lockedFish) || !this.isFishLockable(this.lockedFish))) {
      this.lockedFish = null;
    }
    if (this.lockMode && !this.lockedFish) {
      this.lockHighestRateFish();
    }

    const targetForAim = this.lockMode && this.lockedFish && !this.lockedFish.dead ? this.lockedFish : this.aim;
    if (targetForAim !== this.aim) {
      this.aim.x = targetForAim.x;
      this.aim.y = targetForAim.y;
    }
    this.cannon.angle = Math.atan2(targetForAim.y - this.cannon.y, targetForAim.x - this.cannon.x);

    if (this.autoFire || this.isPointerFiring) {
      this.fireCooldown -= dt;
      if (this.fireCooldown <= 0) {
        this.fireOnce();
        this.fireCooldown = FIRE_INTERVAL;
      }
    }
    for (const key of Object.keys(this.skillCooldowns)) {
      this.skillCooldowns[key] = Math.max(0, this.skillCooldowns[key] - dt);
    }

    this.playerSyncCooldown -= dt * 1000;
    if (this.playerSyncCooldown <= 0) {
      this.syncPlayerState();
      this.playerSyncCooldown = PLAYER_SYNC_INTERVAL;
    }

    for (const bubble of this.bubbles) {
      bubble.y -= bubble.s * dt;
      bubble.x += Math.sin(performance.now() / 600 + bubble.y * 0.02) * dt * 8;
      if (bubble.y < -10) {
        bubble.y = this.H + 10;
        bubble.x = rand(0, this.W);
      }
    }

    const logicTick = this.currentTick();
    for (const fish of this.fishList) {
      if (!fish.dead) {
        this.advanceFish(fish, logicTick);
        fish.hitFlash = Math.max(0, fish.hitFlash - dt);
      } else {
        fish.deathT += dt;
        fish.y -= 18 * dt;
      }
    }
    this.fishList = this.fishList.filter((fish) => {
      if (fish.deathT >= 0.9) return false;
      if (fish.dead) return true;
      return fish.fieldX > -130 && fish.fieldX < this.fieldW + 130 && fish.fieldY > -120 && fish.fieldY < this.fieldH + 120;
    });

    for (const bullet of this.bullets) {
      this.advanceBulletToTick(bullet, logicTick, "local");
    }
    this.bullets = this.bullets.filter((bullet) => bullet.life > 0);

    for (const bullet of this.remoteBullets) {
      this.advanceBulletToTick(bullet, logicTick, "remote");
    }
    this.remoteBullets = this.remoteBullets.filter((bullet) => bullet.life > 0);

    for (const net of this.nets) {
      net.life -= dt;
      net.r += (net.maxR - net.r) * dt * 12;
    }
    this.nets = this.nets.filter((net) => net.life > 0);

    for (const beam of this.beams) beam.life -= dt;
    this.beams = this.beams.filter((beam) => beam.life > 0);

    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.985;
      particle.vy *= 0.985;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);

    for (const text of this.floatTexts) {
      text.y += text.vy * dt;
      text.life -= dt;
    }
    this.floatTexts = this.floatTexts.filter((text) => text.life > 0);
  }

  createBounceSpark(x, y) {
    for (let i = 0; i < 5; i += 1) {
      this.particles.push({ x, y, vx: rand(-70, 70), vy: rand(-70, 70), r: rand(1.5, 3), life: 0.22, max: 0.22, color: "#8ef8ff" });
    }
  }

  updateHud() {
    els.coinText.textContent = formatNumber(this.coins);
    els.rateText.textContent = this.cannonPower;
    els.powerText.textContent = this.cannonPower;
    els.cannonNameText.textContent = cannonSkins[this.cannonIndex].name;
    els.comboText.textContent = this.combo;
    const hasLock = this.lockMode && this.lockedFish && !this.lockedFish.dead;
    els.lockText.textContent = hasLock ? `${this.lockedFish.type.name} ${formatNumber(this.lockedFish.value)}币` : "无";
    els.lockTarget.hidden = !hasLock;
    els.lockModeText.textContent = this.lockMode ? "开启" : "关闭";
    els.lockBtn.classList.toggle("isOn", this.lockMode);
    els.lockBtn.setAttribute("aria-pressed", String(this.lockMode));
    els.autoModeText.textContent = this.autoFire ? "开启" : "关闭";
    els.autoBtn.classList.toggle("isOn", this.autoFire);
    els.autoBtn.setAttribute("aria-pressed", String(this.autoFire));
    els.playerIdText.textContent = shortPlayerId(this.api.playerId);
    if (els.bombCostText) els.bombCostText.textContent = formatNumber(skillTypes.bomb.cost);
    if (els.laserCostText) els.laserCostText.textContent = formatNumber(skillTypes.laser.cost);
    els.bombBtn?.classList.toggle("isArmed", this.pendingSkillKey === "bomb");
    els.laserBtn?.classList.toggle("isArmed", this.pendingSkillKey === "laser");
    els.bombBtn?.setAttribute("aria-pressed", String(this.pendingSkillKey === "bomb"));
    els.laserBtn?.setAttribute("aria-pressed", String(this.pendingSkillKey === "laser"));
    if (els.roomBadge) els.roomBadge.textContent = this.room?.id ? `房间 ${this.room.id}` : "房间 --";
    this.updateDebugHud();
  }

  updateDebugStats(rawDt) {
    const frameDt = Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 1) : 0;
    this.fpsFrames += 1;
    this.fpsElapsed += frameDt;
    this.debugHudElapsed += frameDt;
    if (this.fpsElapsed >= 0.25) {
      const instantFps = this.fpsFrames / this.fpsElapsed;
      this.fps = this.fps ? this.fps * 0.65 + instantFps * 0.35 : instantFps;
      this.fpsFrames = 0;
      this.fpsElapsed = 0;
    }
    if (this.debugHudElapsed >= 0.1) {
      this.updateDebugHud();
      this.debugHudElapsed = 0;
    }
  }

  updateDebugHud() {
    if (els.fpsText) els.fpsText.textContent = this.fps > 0 ? String(Math.round(this.fps)) : "--";
  }

  showToast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 760);
  }

  describeApiError(error) {
    if (error instanceof ApiError) {
      if (error.status === 402) return "金币不足，请联系管理员充值";
      if (error.status === 403) return "玩家会话失效，请刷新页面";
      return error.message;
    }
    return "请求失败";
  }

  loop(now) {
    const rawDt = (now - this.last) / 1000;
    const dt = Math.min(rawDt, 0.033);
    this.last = now;
    this.updateDebugStats(rawDt);
    this.update(dt);
    this.renderer.draw(this);
    requestAnimationFrame((next) => this.loop(next));
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lerp(min, max, t) {
  return min + (max - min) * t;
}

function hashSeed(...parts) {
  let hash = 2166136261;
  const text = parts.map((part) => String(part)).join("|");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function transformRemotePoint(x, y, viewSeat) {
  const seat = ((Number(viewSeat) % 4) + 4) % 4;
  if (seat === 1) return { x: y, y: 1 - x };
  if (seat === 2) return { x: 1 - x, y: 1 - y };
  if (seat === 3) return { x: 1 - y, y: x };
  return { x, y };
}

new FishGame();
