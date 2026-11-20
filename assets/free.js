"use strict";

(function () {
  const timerEl = document.getElementById("bigTimer");
  const exitBtn = document.getElementById("exitBtn");

  const cardModal = document.getElementById("cardModal");
  const cardEmoji = document.getElementById("cardEmoji");
  const cardBadge = document.getElementById("cardBadge");
  const cardName = document.getElementById("cardName");
  const cardId = document.getElementById("cardId");
  const cardStart = document.getElementById("cardStart");
  const cardEnd = document.getElementById("cardEnd");
  const cardDuration = document.getElementById("cardDuration");
  const cardCode = document.getElementById("cardCode");
  const cardContinue = document.getElementById("cardContinue");
  const cardHome = document.getElementById("cardHome");

  const THRESHOLD = 30 * 60 * 1000;

  const identity = getIdentity();
  if (!identity || !identity.name || !identity.id) {
    location.replace("index.html?login=1");
    return;
  }

  const sessionKey = "mr_session_" + identity.id + "_free";
  const stored = Number(localStorage.getItem(sessionKey));
  const start = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
  localStorage.setItem(sessionKey, String(start));

  function fmtClock(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h > 0 ? p(h) + ":" + p(m) + ":" + p(sec) : p(m) + ":" + p(sec);
  }
  function fmtDateTime(t) {
    const d = new Date(t);
    const p = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
    );
  }
  function fmtCN(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return (h > 0 ? h + " 小时 " : "") + m + " 分 " + sec + " 秒";
  }

  let timerHandle = null;
  function tick() {
    timerEl.textContent = fmtClock(Date.now() - start);
  }
  function startTicking() {
    tick();
    timerHandle = setInterval(tick, 1000);
  }
  function stopTicking() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }
  startTicking();

  async function settle() {
    stopTicking();
    const end = Date.now();
    const duration = end - start;
    const ok = duration >= THRESHOLD;

    cardEmoji.textContent = ok ? "🎉" : "⏳";
    cardBadge.textContent = ok
      ? "✅ 已达 30 分钟，可换学时"
      : "⚠️ 未达 30 分钟，还差 " + fmtCN(THRESHOLD - duration);
    cardBadge.className = "card-badge " + (ok ? "ok" : "warn");
    cardName.textContent = identity.name;
    cardId.textContent = identity.id;
    cardStart.textContent = fmtDateTime(start);
    cardEnd.textContent = fmtDateTime(end);
    cardDuration.textContent = fmtCN(duration);
    try {
      cardCode.textContent = await mrComputeCode(identity.id, start, end);
    } catch {
      cardCode.textContent = "（本环境无法生成）";
    }
    cardModal.classList.remove("hidden");
  }

  exitBtn.addEventListener("click", settle);
  cardContinue.addEventListener("click", () => {
    cardModal.classList.add("hidden");
    startTicking();
  });
  cardHome.addEventListener("click", () => {
    localStorage.removeItem(sessionKey);
    location.href = "index.html";
  });
})();