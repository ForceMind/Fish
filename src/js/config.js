export const PLATFORM_RTP = 0.99;
export const FIRE_INTERVAL = 0.18;
export const CANNON_SAFE_BOTTOM = 132;
export const BULLET_SPEED = 720;

export const fishTypes = [
  { key: "blue", name: "青鱼", hp: 2, speed: 62, size: 34, color: "#31d9ff", accent: "#eaffff", rate: 2 },
  { key: "redKoi", name: "红鲤", hp: 4, speed: 52, size: 42, color: "#ff4b43", accent: "#ffd36a", rate: 4 },
  { key: "goldKoi", name: "金锦鲤", hp: 8, speed: 45, size: 48, color: "#ffcf35", accent: "#fff3a6", rate: 8 },
  { key: "lantern", name: "灯笼鱼", hp: 12, speed: 40, size: 46, color: "#9e5cff", accent: "#5ff6ff", rate: 12 },
  { key: "jelly", name: "水母", hp: 18, speed: 34, size: 54, color: "#76f8ff", accent: "#d3a4ff", rate: 18 },
  { key: "turtle", name: "玄武龟", hp: 28, speed: 24, size: 60, color: "#2bc777", accent: "#ffd86e", rate: 28 },
  { key: "dragonFish", name: "龙鱼", hp: 45, speed: 36, size: 62, color: "#ff663a", accent: "#ffd84e", rate: 45 },
  { key: "boss", name: "金龙", hp: 120, speed: 21, size: 96, color: "#ffd337", accent: "#ff4242", rate: 120 }
];

export function weightedFishType() {
  const roll = Math.random();
  if (roll < 0.30) return fishTypes[0];
  if (roll < 0.52) return fishTypes[1];
  if (roll < 0.68) return fishTypes[2];
  if (roll < 0.80) return fishTypes[3];
  if (roll < 0.89) return fishTypes[4];
  if (roll < 0.95) return fishTypes[5];
  if (roll < 0.99) return fishTypes[6];
  return fishTypes[7];
}

export const bossFishType = fishTypes.find((fish) => fish.key === "boss");
