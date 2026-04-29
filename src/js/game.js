import { ApiError, GameApi } from "./api.js";
import { bossFishType, BULLET_SPEED, CANNON_SAFE_BOTTOM, FIRE_INTERVAL, PLATFORM_RTP, weightedFishType } from "./config.js";
import { Renderer } from "./renderer.js";
import { clamp, formatNumber, pick, rand, shortPlayerId } from "./utils.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const els = {
  coinText: document.getElementById("coinText"),
  rateText: document.getElementById("rateText"),
  comboText: document.getElementById("comboText"),
  powerText: document.getElementById("powerText"),
  lockText: document.getElementById("lockText"),
  playerIdText: document.getElementById("playerIdText"),
  toast: document.getElementById("toast"),
  networkBanner: document.getElementById("networkBanner"),
  plusBtn: document.getElementById("plusBtn"),
  minusBtn: document.getElementById("minusBtn")
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
    this.cannonPower = 10;
    this.combo = 0;
    this.aim = { x: 0, y: 0 };
    this.cannon = { x: 0, y: 0, angle: -Math.PI / 2 };
    this.fishList = [];
    this.bullets = [];
    this.nets = [];
    this.floatTexts = [];
    this.particles = [];
    this.bubbles = [];
    this.lockedFish = null;
    this.isPointerFiring = false;
    this.fireCooldown = 0;
    this.fireInFlight = false;
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
      this.ready = true;
      this.coins = player.coins;
      els.networkBanner.hidden = true;
      this.updateHud();
      this.showToast(`玩家 ${player.id}`);
      this.refreshTimer = window.setInterval(() => this.refreshPlayer(), 5000);
    } catch (error) {
      this.ready = false;
      els.networkBanner.hidden = false;
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
      this.cannonPower = clamp(this.cannonPower + 10, 10, 100);
      this.updateHud();
    });
    els.minusBtn.addEventListener("pointerdown", () => {
      this.cannonPower = clamp(this.cannonPower - 10, 10, 100);
      this.updateHud();
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
    this.aim.x = this.W / 2;
    this.aim.y = this.H / 2;
  }

  seedScene() {
    for (let i = 0; i < 16; i += 1) this.spawnFish(i === 0, true);
    for (let i = 0; i < 28; i += 1) {
      this.bubbles.push({ x: rand(0, this.W), y: rand(0, this.H), r: rand(1, 4), s: rand(10, 38), a: rand(0.12, 0.42) });
    }
    this.lockHighestRateFish();
  }

  spawnFish(forceBoss = false, visible = false) {
    const type = forceBoss ? bossFishType : weightedFishType();
    const fromLeft = Math.random() < 0.5;
    const y = rand(70, Math.max(90, this.H - 190));
    const size = type.size;
    const fish = {
      id: Math.random().toString(36).slice(2),
      type,
      x: visible ? rand(size + 24, Math.max(size + 24, this.W - size - 24)) : (fromLeft ? -size - rand(0, 120) : this.W + size + rand(0, 120)),
      y,
      dir: visible ? (Math.random() < 0.5 ? 1 : -1) : (fromLeft ? 1 : -1),
      speed: type.speed * rand(0.82, 1.22),
      size,
      phase: rand(0, Math.PI * 2),
      hitFlash: 0,
      dead: false,
      deathT: 0,
      hitCount: 0,
      hp: type.hp,
      maxHp: type.hp
    };
    this.fishList.push(fish);
    if (!this.lockedFish) this.lockHighestRateFish();
  }

  lockHighestRateFish() {
    let best = null;
    for (const fish of this.fishList) {
      if (fish.dead) continue;
      if (!best) {
        best = fish;
        continue;
      }
      const fishScore = fish.type.rate * 1000 - Math.abs(fish.x - this.W / 2);
      const bestScore = best.type.rate * 1000 - Math.abs(best.x - this.W / 2);
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
    canvas.setPointerCapture?.(event.pointerId);
    const selectedFish = this.findFishAt(this.aim.x, this.aim.y);
    if (selectedFish) {
      this.lockedFish = selectedFish;
      this.aim.x = selectedFish.x;
      this.aim.y = selectedFish.y;
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
      if (!fish.dead && distance < fish.size * 0.72) return fish;
    }
    return null;
  }

  async fireOnce() {
    if (this.fireInFlight) return;
    if (!this.ready || !this.api.connected) {
      this.showToast("请先启动服务器");
      return;
    }
    if (this.coins < this.cannonPower) {
      this.showToast("金币不足，请联系管理员充值");
      this.isPointerFiring = false;
      return;
    }

    this.fireInFlight = true;
    try {
      const result = await this.api.spend(this.cannonPower);
      this.coins = result.coins;
      this.updateHud();
      this.createBullet();
    } catch (error) {
      this.showToast(this.describeApiError(error));
      if (error instanceof ApiError && error.status === 402) this.isPointerFiring = false;
    } finally {
      this.fireInFlight = false;
    }
  }

  createBullet() {
    const target = this.lockedFish && !this.lockedFish.dead ? this.lockedFish : this.aim;
    const angle = Math.atan2(target.y - this.cannon.y, target.x - this.cannon.x);
    this.bullets.push({
      x: this.cannon.x,
      y: this.cannon.y,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      power: this.cannonPower,
      life: 4.6,
      maxLife: 4.6,
      angle,
      hitFishIds: new Set(),
      bounce: 0,
      maxBounce: 8
    });
    this.createMuzzle(this.cannon.x, this.cannon.y, angle);
  }

  createMuzzle(x, y, angle) {
    for (let i = 0; i < 8; i += 1) {
      const a = angle + rand(-0.45, 0.45);
      this.particles.push({ x, y, vx: Math.cos(a) * rand(80, 180), vy: Math.sin(a) * rand(80, 180), r: rand(2, 5), life: rand(0.18, 0.34), max: 0.34, color: "#ffd84e" });
    }
  }

  getEffectiveHitProbability() {
    return PLATFORM_RTP;
  }

  hitFish(fish, bullet) {
    if (bullet.hitFishIds.has(fish.id)) return;
    bullet.hitFishIds.add(fish.id);
    fish.hitCount += 1;
    fish.hitFlash = 0.12;

    const effectiveHit = Math.random() < this.getEffectiveHitProbability(fish, bullet.power);
    this.nets.push({ x: fish.x, y: fish.y, r: 8, maxR: fish.size * 0.78, life: 0.28, power: bullet.power, dud: !effectiveHit });
    for (let i = 0; i < 8; i += 1) {
      this.particles.push({ x: fish.x, y: fish.y, vx: rand(-120, 120), vy: rand(-120, 80), r: rand(1.5, 4), life: rand(0.24, 0.5), max: 0.5, color: effectiveHit ? pick(["#fff2a2", "#ffd84e"]) : "#6ff7ff" });
    }

    if (!effectiveHit) {
      this.floatTexts.push({ x: fish.x, y: fish.y - 10, text: "MISS", life: 0.55, vy: -34, size: 16, miss: true });
      return;
    }

    fish.hp -= 1;
    this.floatTexts.push({ x: fish.x, y: fish.y - 10, text: "-1", life: 0.42, vy: -30, size: 15, miss: true });

    if (fish.hp <= 0 && !fish.dead) {
      fish.dead = true;
      this.combo += 1;
      const gain = bullet.power * fish.type.rate;
      this.coins += gain;
      this.floatTexts.push({ x: fish.x, y: fish.y - 10, text: `+${gain}`, life: 1, vy: -48, size: fish.type.key === "boss" ? 36 : 24 });
      this.showToast(`捕获 ${fish.type.name} +${gain}`);
      this.explode(fish.x, fish.y, fish.size, fish.type.key === "boss");
      this.creditCapture(gain, fish.type.name);
      if (this.lockedFish === fish) {
        this.lockedFish = null;
        this.lockHighestRateFish();
      }
      if (fish.type.key === "boss") window.setTimeout(() => this.spawnFish(true), 2600);
      this.updateHud();
    }
  }

  async creditCapture(gain, fishName) {
    try {
      const result = await this.api.capture(gain, fishName);
      this.coins = result.coins;
      this.updateHud();
    } catch {
      els.networkBanner.hidden = false;
    }
  }

  explode(x, y, size, boss = false) {
    const count = boss ? 80 : 24;
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(40, boss ? 280 : 160);
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: rand(2, boss ? 8 : 5), life: rand(0.45, boss ? 1.1 : 0.72), max: 1.1, color: pick(["#ffd84e", "#fff2a2", "#ff5c42", "#67f7ff"]) });
    }
    this.nets.push({ x, y, r: 16, maxR: boss ? 140 : 72, life: boss ? 0.75 : 0.42, power: 0, boom: true });
  }

  update(dt) {
    if (!this.lockedFish || this.lockedFish.dead || !this.fishList.includes(this.lockedFish)) {
      this.lockedFish = null;
      this.lockHighestRateFish();
    }

    const targetForAim = this.lockedFish && !this.lockedFish.dead ? this.lockedFish : this.aim;
    this.aim.x = targetForAim.x;
    this.aim.y = targetForAim.y;
    this.cannon.angle = Math.atan2(targetForAim.y - this.cannon.y, targetForAim.x - this.cannon.x);

    if (this.isPointerFiring) {
      this.fireCooldown -= dt;
      if (this.fireCooldown <= 0) {
        this.fireOnce();
        this.fireCooldown = FIRE_INTERVAL;
      }
    }

    if (Math.random() < dt * 1.25 && this.fishList.length < 24) this.spawnFish(false);

    for (const bubble of this.bubbles) {
      bubble.y -= bubble.s * dt;
      bubble.x += Math.sin(performance.now() / 600 + bubble.y * 0.02) * dt * 8;
      if (bubble.y < -10) {
        bubble.y = this.H + 10;
        bubble.x = rand(0, this.W);
      }
    }

    for (const fish of this.fishList) {
      fish.phase += dt * 6;
      if (!fish.dead) {
        fish.x += fish.dir * fish.speed * dt;
        fish.y += Math.sin(fish.phase) * 12 * dt;
        fish.hitFlash = Math.max(0, fish.hitFlash - dt);
      } else {
        fish.deathT += dt;
        fish.y -= 18 * dt;
      }
    }
    this.fishList = this.fishList.filter((fish) => fish.x > -180 && fish.x < this.W + 180 && fish.deathT < 0.9);

    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      bullet.angle = Math.atan2(bullet.vy, bullet.vx);

      if (bullet.x < 8 || bullet.x > this.W - 8) {
        bullet.x = clamp(bullet.x, 8, this.W - 8);
        bullet.vx *= -1;
        bullet.bounce += 1;
        this.createBounceSpark(bullet.x, bullet.y);
      }
      const bottomLimit = Math.max(120, this.H - 112);
      if (bullet.y < 8 || bullet.y > bottomLimit) {
        bullet.y = clamp(bullet.y, 8, bottomLimit);
        bullet.vy *= -1;
        bullet.bounce += 1;
        this.createBounceSpark(bullet.x, bullet.y);
      }

      for (const fish of this.fishList) {
        if (fish.dead) continue;
        const distance = Math.hypot(bullet.x - fish.x, bullet.y - fish.y);
        if (distance < fish.size * 0.52 + 5) {
          this.hitFish(fish, bullet);
          bullet.life = 0;
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((bullet) => bullet.life > 0 && bullet.bounce <= bullet.maxBounce);

    for (const net of this.nets) {
      net.life -= dt;
      net.r += (net.maxR - net.r) * dt * 12;
    }
    this.nets = this.nets.filter((net) => net.life > 0);

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
    els.comboText.textContent = this.combo;
    els.lockText.textContent = this.lockedFish && !this.lockedFish.dead ? `${this.lockedFish.type.name} x${this.lockedFish.type.rate}` : "无";
    els.playerIdText.textContent = shortPlayerId(this.api.playerId);
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
    const dt = Math.min((now - this.last) / 1000, 0.033);
    this.last = now;
    this.update(dt);
    this.renderer.draw(this);
    requestAnimationFrame((next) => this.loop(next));
  }
}

new FishGame();
