const PLAYER_ID_KEY = "fishArcade.playerId";
const PLAYER_TOKEN_KEY = "fishArcade.playerToken";
const ROOM_ID_KEY = "fishArcade.roomId";

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
    this.roomId = localStorage.getItem(ROOM_ID_KEY) || "";
    this.connected = false;
    this.ws = null;
    this.wsConnected = false;
    this.nextRequestId = 1;
    this.pending = new Map();
    this.onField = null;
    this.onPlayers = null;
    this.onFire = null;
    this.onHit = null;
    this.onSkill = null;
    this.onClose = null;
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

  async createRoom() {
    const room = await requestJson("/api/room/create", {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, token: this.token })
    });
    this.setRoom(room.id);
    return room;
  }

  async joinRoom(roomId) {
    const room = await requestJson("/api/room/join", {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, token: this.token, roomId })
    });
    this.setRoom(room.id);
    return room;
  }

  setRoom(roomId) {
    this.roomId = String(roomId || "").trim().toUpperCase();
    if (this.roomId) localStorage.setItem(ROOM_ID_KEY, this.roomId);
    else localStorage.removeItem(ROOM_ID_KEY);
  }

  async spend(cost, state = {}) {
    if (this.wsConnected) return this.wsRequest("fire", { cost, state });
    return requestJson("/api/fire", {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, token: this.token, roomId: this.roomId, cost, state })
    });
  }

  async capture(gain, fishName) {
    return requestJson("/api/capture", {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, token: this.token, gain, fishName })
    });
  }

  async getField() {
    if (this.wsConnected) {
      this.wsSend({ type: "field" });
      return null;
    }
    return requestJson(`/api/field?playerId=${encodeURIComponent(this.playerId)}&token=${encodeURIComponent(this.token)}&roomId=${encodeURIComponent(this.roomId)}`);
  }

  async syncPlayerState(state) {
    if (this.wsConnected) {
      this.wsSend({ type: "playerState", state });
      return null;
    }
    return requestJson("/api/field/player", {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, token: this.token, roomId: this.roomId, ...state })
    });
  }

  async hitFish(fishId, power) {
    if (this.wsConnected) return this.wsRequest("hit", { fishId, power });
    return requestJson("/api/field/hit", {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, token: this.token, roomId: this.roomId, fishId, power })
    });
  }

  async useSkill(skillKey, state = {}) {
    if (this.wsConnected) return this.wsRequest("skill", { skillKey, state });
    return requestJson("/api/skill", {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, token: this.token, roomId: this.roomId, skillKey, state })
    });
  }

  connectRealtime({ onField, onPlayers, onFire, onHit, onSkill, onClose } = {}) {
    this.onField = onField || null;
    this.onPlayers = onPlayers || null;
    this.onFire = onFire || null;
    this.onHit = onHit || null;
    this.onSkill = onSkill || null;
    this.onClose = onClose || null;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
      this.wsConnected = false;
    }
    return new Promise((resolve, reject) => {
      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${scheme}//${window.location.host}/ws?playerId=${encodeURIComponent(this.playerId)}&token=${encodeURIComponent(this.token)}&roomId=${encodeURIComponent(this.roomId)}`;
      const ws = new WebSocket(url);
      this.ws = ws;
      const timer = window.setTimeout(() => {
        reject(new ApiError("WebSocket 连接超时"));
        ws.close();
      }, 5000);

      ws.addEventListener("open", () => {
        window.clearTimeout(timer);
        this.wsConnected = true;
        this.connected = true;
        resolve();
      });
      ws.addEventListener("message", (event) => this.handleWsMessage(event.data));
      ws.addEventListener("close", () => {
        this.wsConnected = false;
        for (const pending of this.pending.values()) pending.reject(new ApiError("WebSocket 已断开"));
        this.pending.clear();
        this.onClose?.();
      });
      ws.addEventListener("error", () => {
        this.wsConnected = false;
      });
    });
  }

  handleWsMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.type === "field") {
      this.onField?.(message.field);
      return;
    }
    if (message.type === "players") {
      this.onPlayers?.(message);
      return;
    }
    if (message.type === "fire") {
      this.onFire?.(message.fire);
      return;
    }
    if (message.type === "hit") {
      this.onHit?.(message.hit);
      return;
    }
    if (message.type === "skill") {
      this.onSkill?.(message.skill);
      return;
    }
    if (message.type === "reply") {
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      window.clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
      if (message.ok) pending.resolve(message.data);
      else pending.reject(new ApiError(message.error || "请求失败", 0, message.data));
    }
  }

  wsRequest(type, payload = {}) {
    if (!this.wsConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new ApiError("WebSocket 未连接"));
    }
    const requestId = String(this.nextRequestId++);
    this.wsSend({ type, requestId, ...payload });
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new ApiError("请求超时"));
      }, 4000);
      this.pending.set(requestId, { resolve, reject, timer });
    });
  }

  wsSend(payload) {
    if (!this.wsConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
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
