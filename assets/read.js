"use strict";

(function () {
  const timerEl = document.getElementById("timer");
  const titleEl = document.getElementById("readTitle");
  const container = document.getElementById("pdfContainer");
  const statusEl = document.getElementById("pdfStatus");
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
  const cardContinue = document.getElementById("cardContinue");
  const cardHome = document.getElementById("cardHome");

  const THRESHOLD = 30 * 60 * 1000;

  const identity = getIdentity();
  if (!identity || !identity.name || !identity.id) {
    location.replace("index.html");
    return;
  }

  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    statusEl.textContent = "缺少材料编号";
    return;
  }

  const sessionKey = "mr_session_" + identity.id + "_" + id;
  const stored = Number(localStorage.getItem(sessionKey));
  const start = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
  localStorage.setItem(sessionKey, String(start));

  function fmtClock(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
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

  function settle() {
    stopTicking();
    const end = Date.now();
    const duration = end - start;
    const ok = duration >= THRESHOLD;

    cardEmoji.textContent = ok ? "🎉" : "⏳";
    cardTitle.textContent = (titleEl.textContent || "晨读") + "已完成";
    cardBadge.textContent = ok
      ? "✅ 已达 30 分钟，可换学时"
      : "⚠️ 未达 30 分钟，还差 " + fmtCN(THRESHOLD - duration);
    cardBadge.className = "card-badge " + (ok ? "ok" : "warn");
    cardName.textContent = identity.name;
    cardId.textContent = identity.id;
    cardStart.textContent = fmtDateTime(start);
    cardEnd.textContent = fmtDateTime(end);
    cardDuration.textContent = fmtCN(duration);
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

  async function load() {
    let item;
    try {
      const res = await fetch("manifest.json", { cache: "no-cache" });
      const items = await res.json();
      item = (items || []).find((m) => m.id === id);
    } catch {
      statusEl.textContent = "清单加载失败，请刷新重试";
      return;
    }
    if (!item) {
      statusEl.textContent = "未找到该材料";
      return;
    }

    titleEl.textContent = item.title || item.date || id;
    document.title = (item.title || "晨读") + " · MorningRead";

    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/vendor/pdf.worker.min.js";
      const pdf = await pdfjsLib.getDocument(item.file).promise;
      statusEl.classList.add("hidden");
      const baseWidth = container.clientWidth || 720;
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, (baseWidth - 24) / base.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.className = "pdf-page";
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      }
    } catch (e) {
      statusEl.classList.remove("hidden");
      statusEl.textContent = "PDF 加载失败：" + (e && e.message ? e.message : e);
    }
  }

  load();
})();