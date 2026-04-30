export const PLATFORM_RTP = 0.99;
export const FIRE_INTERVAL = 0.18;
export const CANNON_SAFE_BOTTOM = 178;
export const BULLET_SPEED = 720;
export const FIELD_SYNC_INTERVAL = 220;
export const PLAYER_SYNC_INTERVAL = 180;

export const fishTypes = [
  { key: "blue", name: "青鱼", hp: 2, value: 20, speed: 62, size: 34, color: "#31d9ff", accent: "#eaffff", rate: 2, spawnWeight: 30 },
  { key: "redKoi", name: "红鲤", hp: 4, value: 40, speed: 52, size: 42, color: "#ff4b43", accent: "#ffd36a", rate: 4, spawnWeight: 22 },
  { key: "goldKoi", name: "金锦鲤", hp: 8, value: 80, speed: 45, size: 48, color: "#ffcf35", accent: "#fff3a6", rate: 8, spawnWeight: 16 },
  { key: "lantern", name: "灯笼鱼", hp: 12, value: 120, speed: 40, size: 46, color: "#9e5cff", accent: "#5ff6ff", rate: 12, spawnWeight: 12 },
  { key: "jelly", name: "水母", hp: 18, value: 180, speed: 34, size: 54, color: "#76f8ff", accent: "#d3a4ff", rate: 18, spawnWeight: 9 },
  { key: "turtle", name: "玄武龟", hp: 28, value: 280, speed: 24, size: 60, color: "#2bc777", accent: "#ffd86e", rate: 28, spawnWeight: 6 },
  { key: "dragonFish", name: "龙鱼", hp: 45, value: 450, speed: 36, size: 62, color: "#ff663a", accent: "#ffd84e", rate: 45, spawnWeight: 3.6 },
  { key: "manta", name: "鬼影魟", hp: 65, value: 650, speed: 30, size: 78, color: "#2f4de4", accent: "#8ef8ff", rate: 65, spawnWeight: 2.4 },
  { key: "phoenixFish", name: "凤尾神鱼", hp: 80, value: 800, speed: 32, size: 82, color: "#ff6f3c", accent: "#fff07a", rate: 80, spawnWeight: 1.8 },
  { key: "whale", name: "巨鲸", hp: 100, value: 1000, speed: 19, size: 104, color: "#2e89d8", accent: "#b9f4ff", rate: 100, spawnWeight: 1.15 },
  { key: "boss", name: "金龙", hp: 120, value: 1200, speed: 21, size: 96, color: "#ffd337", accent: "#ff4242", rate: 120, spawnWeight: 0.65, boss: true },
  { key: "thunderDragon", name: "雷龙王", hp: 180, value: 1800, speed: 18, size: 116, color: "#8b5cff", accent: "#ffe66d", rate: 180, spawnWeight: 0.34, boss: true },
  { key: "whaleBoss", name: "金鲸王", hp: 220, value: 2200, speed: 14, size: 132, color: "#ffb02e", accent: "#7ff6ff", rate: 220, spawnWeight: 0.24, boss: true },
  { key: "blackDragonBoss", name: "玄冥黑龙", hp: 300, value: 3000, speed: 16, size: 128, color: "#34294f", accent: "#ff5d8f", rate: 300, spawnWeight: 0.16, boss: true }
];

export function weightedFishType() {
  const total = fishTypes.reduce((sum, fish) => sum + Number(fish.spawnWeight || 1), 0);
  let roll = Math.random() * total;
  for (const fish of fishTypes) {
    roll -= Number(fish.spawnWeight || 1);
    if (roll <= 0) return fish;
  }
  return fishTypes[fishTypes.length - 1];
}

export const bossFishType = fishTypes.find((fish) => fish.key === "boss");

export const fishTypeByKey = Object.fromEntries(fishTypes.map((fish) => [fish.key, fish]));

export const skillTypes = {
  bomb: { key: "bomb", name: "爆炎弹", cost: 120, power: 90 },
  laser: { key: "laser", name: "龙魂激光", cost: 180, power: 130 }
};

export const cannonSkins = [
  { name: "铜鲤炮", power: 10, body: "#c96b2c", trim: "#ffd467", glow: "#ffcf55", barrel: "#f05a32", base: "#1f6886" },
  { name: "青鳞炮", power: 20, body: "#1f9ca0", trim: "#a8fff8", glow: "#5ff6ff", barrel: "#2bb5b8", base: "#164f72" },
  { name: "赤焰炮", power: 30, body: "#d43f34", trim: "#ffd36a", glow: "#ff7658", barrel: "#f05a32", base: "#75313a" },
  { name: "紫电炮", power: 40, body: "#7947d8", trim: "#e3c7ff", glow: "#b68cff", barrel: "#5b55e8", base: "#25336f" },
  { name: "金鳞炮", power: 50, body: "#e2a922", trim: "#fff0a0", glow: "#ffd84e", barrel: "#ff7a2f", base: "#72531d" },
  { name: "玄武炮", power: 60, body: "#2aa56f", trim: "#d7ffd8", glow: "#6cffae", barrel: "#187f68", base: "#174c49" },
  { name: "龙吟炮", power: 80, body: "#e65e2e", trim: "#fff2a2", glow: "#ff9f55", barrel: "#c8282f", base: "#57305b" },
  { name: "天宫炮", power: 100, body: "#f2d24b", trim: "#ffffff", glow: "#fff07a", barrel: "#ef4940", base: "#8a6725" }
];
