"use strict";

(function () {
  const timerEl = document.getElementById("bigTimer");
  const exitBtn = document.getElementById("exitBtn");

  const cardModal = document.getElementById("cardModal");
  const cardEmoji = document.getElementById("cardEmoji");
  const cardTitle = document.getElementById("cardTitle");
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
  function fmtCardDay(t) {
    const d = new Date(t);
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  const pauseHint = document.getElementById("pauseHint");
  const timer = mrCreateTimer(sessionKey, {
    onTick: (ms) => { timerEl.textContent = fmtClock(ms); },
    onPause: (c) => {
      if (!pauseHint) return;
      if (c === "hidden") {
        pauseHint.textContent = "已暂停：离开页面或切换窗口，回来自动继续。";
        pauseHint.classList.remove("hidden");
      } else if (c === "idle") {
        pauseHint.textContent = "已暂停：长时间无操作，滚动或点击继续。";
        pauseHint.classList.remove("hidden");
      } else {
        pauseHint.classList.add("hidden");
      }
    },
  });

  async function settle() {
    timer.pause();
    const end = Date.now();
    const start = timer.start;
    const duration = timer.elapsed();
    const ok = duration >= THRESHOLD;

    cardEmoji.textContent = ok ? "🎉" : "⏳";
    cardTitle.textContent = fmtCardDay(end) + (ok ? "已完成" : "未完成");
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
      cardCode.textContent = await mrComputeCode(identity.id, start, end, duration);
    } catch {
      cardCode.textContent = "（本环境无法生成）";
    }
    cardModal.classList.remove("hidden");
  }

  exitBtn.addEventListener("click", settle);
  cardContinue.addEventListener("click", () => {
    cardModal.classList.add("hidden");
    timer.resume();
  });
  cardHome.addEventListener("click", () => {
    localStorage.removeItem(sessionKey);
    location.href = "index.html";
  });
})();