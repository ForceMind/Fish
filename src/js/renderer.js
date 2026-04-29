import { clamp, pick } from "./utils.js";

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  draw(state) {
    const { ctx } = this;
    ctx.clearRect(0, 0, state.W, state.H);
    this.drawBackground(state);
    this.drawAimLine(state);
    for (const fish of state.fishList) this.drawFish(fish);
    for (const bullet of state.bullets) this.drawBullet(bullet);
    for (const net of state.nets) this.drawNet(net);
    for (const particle of state.particles) this.drawParticle(particle);
    this.drawCannon(state);
    for (const text of state.floatTexts) this.drawFloatText(text);
  }

  drawBackground(state) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#7cf7ff";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const y = 90 + i * 74 + Math.sin(performance.now() / 900 + i) * 8;
      ctx.beginPath();
      for (let x = -20; x < state.W + 20; x += 16) {
        const yy = y + Math.sin(x * 0.02 + i) * 9;
        if (x === -20) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const bubble of state.bubbles) {
      ctx.globalAlpha = bubble.a;
      ctx.strokeStyle = "#d7ffff";
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.drawSeaweed(28, state.H - 40, 50);
    this.drawSeaweed(state.W - 46, state.H - 38, 64);
    this.drawSeaweed(state.W * 0.16, state.H - 44, 42);
    ctx.restore();
  }

  drawSeaweed(x, y, h) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = "#30de8a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + i * 10, y);
      ctx.quadraticCurveTo(x + i * 10 + Math.sin(performance.now() / 600 + i) * 12, y - h * 0.5, x + i * 8, y - h);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawAimLine(state) {
    const { ctx } = this;
    const { cannon, aim, lockedFish } = state;
    ctx.save();
    ctx.globalAlpha = state.isPointerFiring ? 0.34 : 0.2;
    ctx.strokeStyle = state.isPointerFiring ? "#fff2a2" : "#fff6a8";
    ctx.setLineDash([8, 10]);
    ctx.lineWidth = state.isPointerFiring ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(cannon.x, cannon.y);
    ctx.lineTo(aim.x, aim.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (lockedFish && !lockedFish.dead) {
      const pulse = Math.sin(performance.now() / 120) * 3;
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "#fff2a2";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lockedFish.x, lockedFish.y, lockedFish.size * 0.75 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lockedFish.x - 10, lockedFish.y);
      ctx.lineTo(lockedFish.x + 10, lockedFish.y);
      ctx.moveTo(lockedFish.x, lockedFish.y - 10);
      ctx.lineTo(lockedFish.x, lockedFish.y + 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFish(fish) {
    const { ctx } = this;
    const size = fish.size;
    const flip = fish.dir < 0 ? -1 : 1;
    const wiggle = Math.sin(fish.phase) * size * 0.07;
    const alpha = fish.dead ? Math.max(0, 1 - fish.deathT * 1.2) : 1;

    ctx.save();
    ctx.translate(fish.x, fish.y);
    ctx.scale(flip, 1);
    ctx.globalAlpha = alpha;
    if (fish.hitFlash > 0) {
      ctx.shadowColor = "#fff8bd";
      ctx.shadowBlur = 20;
    } else {
      ctx.shadowColor = fish.type.accent;
      ctx.shadowBlur = fish.type.key === "boss" ? 24 : 10;
    }

    if (fish.type.key === "jelly") this.drawJelly(size, fish);
    else if (fish.type.key === "turtle") this.drawTurtle(size, fish);
    else if (fish.type.key === "boss") this.drawDragonBoss(size, fish, wiggle);
    else this.drawBasicFish(size, fish, wiggle);

    ctx.shadowBlur = 0;
    if (!fish.dead) this.drawHpBar(fish, -size * 0.5, -size * 0.72, size);
    ctx.restore();
  }

  drawBasicFish(size, fish, wiggle) {
    const { ctx } = this;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#062336";
    ctx.fillStyle = fish.hitFlash > 0 ? "#fff7bb" : fish.type.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.46, size * 0.29, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = fish.type.accent;
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, 0);
    ctx.lineTo(-size * 0.72, -size * 0.23 + wiggle);
    ctx.lineTo(-size * 0.66, size * 0.22 + wiggle);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff8d0";
    ctx.beginPath();
    ctx.arc(size * 0.22, -size * 0.08, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#06192c";
    ctx.fillRect(size * 0.225, -size * 0.09, 3, 3);
    ctx.strokeStyle = fish.type.accent;
    ctx.lineWidth = 2;
    for (let i = -1; i < 2; i += 1) {
      ctx.beginPath();
      ctx.arc(-size * 0.05 + i * 7, 2, size * 0.18, -0.7, 0.7);
      ctx.stroke();
    }
    if (fish.type.key === "dragonFish") {
      ctx.fillStyle = "#ffd84e";
      ctx.beginPath();
      ctx.moveTo(size * 0.02, -size * 0.3);
      ctx.lineTo(size * 0.16, -size * 0.52);
      ctx.lineTo(size * 0.24, -size * 0.24);
      ctx.fill();
      ctx.stroke();
    }
    if (fish.type.key === "lantern") {
      ctx.strokeStyle = "#9effff";
      ctx.beginPath();
      ctx.moveTo(size * 0.35, -size * 0.16);
      ctx.quadraticCurveTo(size * 0.58, -size * 0.42, size * 0.75, -size * 0.2);
      ctx.stroke();
      ctx.fillStyle = "#e9ffff";
      ctx.beginPath();
      ctx.arc(size * 0.78, -size * 0.18, size * 0.08 + Math.sin(fish.phase) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawJelly(size, fish) {
    const { ctx } = this;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#062336";
    ctx.fillStyle = fish.hitFlash > 0 ? "#fff7bb" : "rgba(118, 248, 255, .72)";
    ctx.beginPath();
    ctx.arc(0, -size * 0.1, size * 0.32, Math.PI, 0);
    ctx.lineTo(size * 0.32, size * 0.05);
    ctx.quadraticCurveTo(0, size * 0.22, -size * 0.32, size * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#d3a4ff";
    ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * size * 0.1, size * 0.08);
      ctx.quadraticCurveTo(i * size * 0.12 + Math.sin(fish.phase + i) * 8, size * 0.35, i * size * 0.08, size * 0.52);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff8d0";
    ctx.beginPath();
    ctx.arc(size * 0.11, -size * 0.12, 4, 0, Math.PI * 2);
    ctx.arc(-size * 0.09, -size * 0.12, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTurtle(size, fish) {
    const { ctx } = this;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#062336";
    ctx.fillStyle = fish.hitFlash > 0 ? "#fff7bb" : "#176b55";
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.44, size * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2bc777";
    ctx.beginPath();
    ctx.ellipse(size * 0.42, -size * 0.02, size * 0.18, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd86e";
    for (let i = -1; i <= 1; i += 1) {
      ctx.strokeRect(-size * 0.14 + i * size * 0.1, -size * 0.12, size * 0.09, size * 0.22);
    }
    ctx.fillStyle = "#fff8d0";
    ctx.beginPath();
    ctx.arc(size * 0.49, -size * 0.06, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawDragonBoss(size, fish, wiggle) {
    const { ctx } = this;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#3a1600";
    ctx.fillStyle = fish.hitFlash > 0 ? "#fff7bb" : "#ffd337";
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.44, size * 0.25, Math.sin(fish.phase) * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff4242";
    ctx.beginPath();
    ctx.moveTo(-size * 0.38, 0);
    ctx.lineTo(-size * 0.7, -size * 0.28 + wiggle);
    ctx.lineTo(-size * 0.62, size * 0.28 + wiggle);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.12 + i * size * 0.1, -size * 0.24);
      ctx.lineTo(-size * 0.04 + i * size * 0.1, -size * 0.45);
      ctx.lineTo(size * 0.03 + i * size * 0.1, -size * 0.22);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#fff8d0";
    ctx.beginPath();
    ctx.arc(size * 0.28, -size * 0.08, size * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#fff0a0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-size * 0.1, 0, size * 0.22, 0, Math.PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.1, 0.5, size * 0.18, Math.PI * 0.2, Math.PI * 1.5);
    ctx.stroke();
  }

  drawHpBar(fish, x, y, width) {
    const { ctx } = this;
    const ratio = clamp(fish.hp / fish.maxHp, 0, 1);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0, 0, 0, .5)";
    ctx.fillRect(x, y, width, 5);
    ctx.fillStyle = ratio > 0.45 ? "#55ff88" : ratio > 0.2 ? "#ffe052" : "#ff4d4d";
    ctx.fillRect(x, y, width * ratio, 5);
    ctx.restore();
  }

  drawBullet(bullet) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(bullet.angle);
    ctx.shadowColor = "#fff2a2";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#ffe45e";
    ctx.strokeStyle = "#5b2500";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawNet(net) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(net.x, net.y);
    ctx.globalAlpha = net.dud ? 0.36 : (net.boom ? 0.6 : 0.72);
    ctx.strokeStyle = net.dud ? "#8ef8ff" : (net.boom ? "#ffd84e" : "#dfffff");
    ctx.lineWidth = net.boom ? 4 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, net.r, 0, Math.PI * 2);
    ctx.stroke();
    if (!net.boom) {
      for (let i = 0; i < 8; i += 1) {
        const angle = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * net.r, Math.sin(angle) * net.r);
        ctx.stroke();
      }
      for (let r = net.r * 0.35; r < net.r; r += net.r * 0.28) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawParticle(particle) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCannon(state) {
    const { ctx } = this;
    const { cannon } = state;
    ctx.save();
    ctx.translate(cannon.x, cannon.y);
    ctx.rotate(cannon.angle + Math.PI / 2);
    ctx.shadowColor = "#ffd84e";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#d13c30";
    ctx.strokeStyle = "#401200";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-16, -54, 32, 68, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd84e";
    ctx.beginPath();
    ctx.roundRect(-10, -66, 20, 28, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(cannon.x, cannon.y + 12);
    ctx.fillStyle = "#1e5d79";
    ctx.strokeStyle = "#062336";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 38, Math.PI, 0);
    ctx.lineTo(38, 22);
    ctx.lineTo(-38, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff2a2";
    ctx.font = "900 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("龙炮", 0, 13);
    ctx.restore();
  }

  drawFloatText(text) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = clamp(text.life, 0, 1);
    ctx.font = `900 ${text.size}px system-ui`;
    ctx.textAlign = "center";
    ctx.lineWidth = 5;
    ctx.strokeStyle = text.miss ? "#003d55" : "#7a2600";
    ctx.fillStyle = text.miss ? "#8ef8ff" : "#fff2a2";
    ctx.shadowColor = text.miss ? "#8ef8ff" : "#ffd84e";
    ctx.shadowBlur = 14;
    ctx.strokeText(text.text, text.x, text.y);
    ctx.fillText(text.text, text.x, text.y);
    ctx.restore();
  }

  randomBurstColors() {
    return pick(["#ffd84e", "#fff2a2", "#ff5c42", "#67f7ff"]);
  }
}
