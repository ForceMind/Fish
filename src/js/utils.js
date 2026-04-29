export function rand(min, max) {
  return Math.random() * (max - min) + min;
}

export function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Math.floor(Number(value) || 0));
}

export function shortPlayerId(playerId) {
  return playerId || "未连接";
}
