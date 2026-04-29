import { formatNumber } from "./utils.js";

const playersBody = document.getElementById("playersBody");
const refreshBtn = document.getElementById("refreshBtn");
const coinForm = document.getElementById("coinForm");
const playerIdInput = document.getElementById("playerIdInput");
const amountInput = document.getElementById("amountInput");
const message = document.getElementById("message");

refreshBtn.addEventListener("click", () => loadPlayers());
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
    await loadPlayers();
  } catch (error) {
    setMessage(error.message);
  }
});

playersBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-player-id]");
  if (!button) return;
  playerIdInput.value = button.dataset.playerId;
  amountInput.focus();
});

loadPlayers();

async function loadPlayers() {
  try {
    const players = await requestJson("/api/admin/players");
    renderPlayers(players);
    setMessage(`共 ${players.length} 个玩家`);
  } catch (error) {
    playersBody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
    setMessage(error.message);
  }
}

function renderPlayers(players) {
  if (!players.length) {
    playersBody.innerHTML = '<tr><td colspan="7" class="muted">暂无玩家进入游戏</td></tr>';
    return;
  }
  playersBody.innerHTML = players.map((player) => `
    <tr>
      <td><strong>${escapeHtml(player.id)}</strong></td>
      <td class="money">${formatNumber(player.coins)}</td>
      <td>${formatNumber(player.totalPurchased)}</td>
      <td>${formatNumber(player.totalSpent)}</td>
      <td>${formatNumber(player.totalWon)}</td>
      <td>${formatDate(player.lastSeenAt)}</td>
      <td><button class="quickBtn" type="button" data-player-id="${escapeHtml(player.id)}">填入</button></td>
    </tr>
  `).join("");
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
