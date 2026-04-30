import { formatNumber } from "./utils.js";

const playersBody = document.getElementById("playersBody");
const refreshBtn = document.getElementById("refreshBtn");
const cleanupTempBtn = document.getElementById("cleanupTempBtn");
const coinForm = document.getElementById("coinForm");
const playerIdInput = document.getElementById("playerIdInput");
const amountInput = document.getElementById("amountInput");
const message = document.getElementById("message");
const roomsBody = document.getElementById("roomsBody");
const activeRoomsText = document.getElementById("activeRoomsText");
const totalPoolText = document.getElementById("totalPoolText");
const totalRtpText = document.getElementById("totalRtpText");
const missRateText = document.getElementById("missRateText");

refreshBtn.addEventListener("click", () => loadDashboard());
cleanupTempBtn?.addEventListener("click", () => deleteTemporaryPlayers());
coinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const playerId = playerIdInput.value.trim().toUpperCase();
  const amount = Number(amountInput.value);
  if (!playerId || !Number.isFinite(amount) || amount <= 0) {
    setMessage("请填写有效玩家号和加币数量");
    return;
  }
  try {
    const result = await requestJson("/api/admin/add-coins", {
      method: "POST",
      body: JSON.stringify({ playerId, amount })
    });
    setMessage(`${result.id} 已加 ${formatNumber(amount)}，余额 ${formatNumber(result.coins)}`);
    await loadDashboard();
  } catch (error) {
    setMessage(error.message);
  }
});

playersBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-player-id]");
  if (!button) return;
  const { action, playerId } = button.dataset;
  if (action === "rename") {
    renamePlayer(playerId, button.dataset.playerName || playerId);
    return;
  }
  if (action === "delete") {
    deletePlayer(playerId);
    return;
  }
  playerIdInput.value = playerId;
  amountInput.focus();
});

loadDashboard();
window.setInterval(loadRooms, 1000);
window.setInterval(loadPlayers, 3000);

async function loadDashboard() {
  await Promise.all([loadPlayers(), loadRooms()]);
}

async function loadPlayers() {
  try {
    const players = await requestJson("/api/admin/players");
    renderPlayers(players);
    const temporaryCount = players.filter((player) => player.temporary).length;
    setMessage(`共 ${players.length} 个玩家，空临时账号 ${temporaryCount} 个`);
  } catch (error) {
    playersBody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
    setMessage(error.message);
  }
}

async function loadRooms() {
  try {
    const data = await requestJson("/api/admin/rooms");
    renderRoomSummary(data.totals);
    renderRooms(data.rooms);
  } catch (error) {
    if (roomsBody) roomsBody.innerHTML = `<tr><td colspan="13">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function deleteTemporaryPlayers() {
  const ok = window.confirm("将删除金币为0、无充值、无消费、无捕获且不在线的临时账号。此操作不可恢复，是否继续？");
  if (!ok) return;
  try {
    const result = await requestJson("/api/admin/delete-temp-players", {
      method: "POST",
      body: JSON.stringify({ confirm: "DELETE_TEMP_PLAYERS" })
    });
    setMessage(`已删除 ${formatNumber(result.deleted)} 个临时账号，剩余 ${formatNumber(result.remaining)} 个玩家`);
    await loadDashboard();
  } catch (error) {
    setMessage(error.message);
  }
}

async function renamePlayer(playerId, currentName) {
  const name = window.prompt("输入新的玩家名称", currentName || playerId);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) {
    setMessage("名称不能为空");
    return;
  }
  try {
    const result = await requestJson("/api/admin/rename-player", {
      method: "POST",
      body: JSON.stringify({ playerId, name: trimmed })
    });
    setMessage(`${result.id} 已改名为 ${result.name}`);
    await loadDashboard();
  } catch (error) {
    setMessage(error.message);
  }
}

async function deletePlayer(playerId) {
  const ok = window.confirm(`确定删除账号 ${playerId}？此操作不可恢复。在线玩家不能删除。`);
  if (!ok) return;
  try {
    const result = await requestJson("/api/admin/delete-player", {
      method: "POST",
      body: JSON.stringify({ playerId, confirm: "DELETE_PLAYER" })
    });
    setMessage(`已删除账号 ${result.playerId}，剩余 ${formatNumber(result.remaining)} 个玩家`);
    await loadDashboard();
  } catch (error) {
    setMessage(error.message);
  }
}

function renderPlayers(players) {
  if (!players.length) {
    playersBody.innerHTML = '<tr><td colspan="7" class="muted">暂无玩家进入游戏</td></tr>';
    return;
  }
  playersBody.innerHTML = players.map((player) => `
    <tr class="${player.temporary ? "tempRow" : ""}">
      <td>
        <strong>${escapeHtml(player.id)}</strong>${player.temporary ? '<span class="statusBadge">临时</span>' : ""}
        <span class="playerName">${escapeHtml(player.name || player.id)}</span>
      </td>
      <td class="money">${formatNumber(player.coins)}</td>
      <td>${formatNumber(player.totalPurchased)}</td>
      <td>${formatNumber(player.totalSpent)}</td>
      <td>${formatNumber(player.totalWon)}</td>
      <td>${formatDate(player.lastSeenAt)}</td>
      <td>
        <div class="actionGroup">
          <button class="quickBtn" type="button" data-action="fill" data-player-id="${escapeHtml(player.id)}">填入</button>
          <button class="quickBtn" type="button" data-action="rename" data-player-id="${escapeHtml(player.id)}" data-player-name="${escapeHtml(player.name || player.id)}">改名</button>
          <button class="quickBtn dangerSmallBtn" type="button" data-action="delete" data-player-id="${escapeHtml(player.id)}">删除</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderRoomSummary(totals = {}) {
  if (activeRoomsText) activeRoomsText.textContent = formatNumber(totals.rooms || 0);
  if (totalPoolText) totalPoolText.textContent = formatNumber(Math.floor(totals.pool || 0));
  if (totalRtpText) totalRtpText.textContent = formatPercent(totals.rtp || 0);
  const missRate = totals.hitRequests ? (totals.misses || 0) / totals.hitRequests : 0;
  if (missRateText) missRateText.textContent = formatPercent(missRate);
}

function renderRooms(rooms) {
  if (!roomsBody) return;
  if (!rooms.length) {
    roomsBody.innerHTML = '<tr><td colspan="13" class="muted">暂无在线房间</td></tr>';
    return;
  }
  roomsBody.innerHTML = rooms.map((room) => {
    const stats = room.stats || {};
    const bank = room.bank || {};
    return `
      <tr>
        <td><strong>${escapeHtml(room.id)}</strong></td>
        <td>${formatNumber(room.players)}</td>
        <td>${formatNumber(room.fish)}</td>
        <td class="money">${formatNumber(bank.pool || 0)}</td>
        <td>${formatPercent(bank.targetRtp || 0)}</td>
        <td>${formatPercent(bank.rtp || 0)}</td>
        <td>${formatNumber(stats.shots || 0)}</td>
        <td>${formatNumber(stats.hits || 0)} / ${formatNumber(stats.misses || 0)}</td>
        <td>${formatNumber(stats.criticalHits || 0)}</td>
        <td>${formatNumber(stats.captures || 0)}</td>
        <td>${formatNumber(stats.luckyCatches || stats.instantKills || 0)}</td>
        <td>${formatNumber(stats.skillUses || 0)}</td>
        <td>${formatDate(room.lastActiveAt)}</td>
      </tr>
    `;
  }).join("");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.error || `请求失败 ${response.status}`);
  return payload;
}

function setMessage(text) {
  message.textContent = text;
}

function formatDate(value) {
  if (!value) return "未在线";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
