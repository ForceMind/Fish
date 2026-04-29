const PLAYER_ID_KEY = "fishArcade.playerId";
const PLAYER_TOKEN_KEY = "fishArcade.playerToken";

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export class GameApi {
  constructor() {
    this.playerId = localStorage.getItem(PLAYER_ID_KEY) || "";
    this.token = localStorage.getItem(PLAYER_TOKEN_KEY) || "";
    this.connected = false;
  }

  async initPlayer() {
    const player = await requestJson("/api/player", {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, token: this.token })
    });

    this.connected = true;
    this.playerId = player.id;
    this.token = player.token;
    localStorage.setItem(PLAYER_ID_KEY, this.playerId);
    localStorage.setItem(PLAYER_TOKEN_KEY, this.token);
    return player;
  }

  async refreshPlayer() {
    const player = await requestJson(`/api/player?playerId=${encodeURIComponent(this.playerId)}&token=${encodeURIComponent(this.token)}`);
    this.connected = true;
    return player;
  }

  async spend(cost) {
    return requestJson("/api/fire", {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, token: this.token, cost })
    });
  }

  async capture(gain, fishName) {
    return requestJson("/api/capture", {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, token: this.token, gain, fishName })
    });
  }
}

async function requestJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
  } catch (error) {
    throw new ApiError("无法连接服务器", 0, error);
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(payload?.error || `请求失败 ${response.status}`, response.status, payload);
  }
  return payload;
}
