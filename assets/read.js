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
  const cardCode = document.getElementById("cardCode");
  const cardContinue = document.getElementById("cardContinue");
  const cardHome = document.getElementById("cardHome");

  const THRESHOLD = 30 * 60 * 1000;

  const identity = getIdentity();
  if (!identity || !identity.name || !identity.id) {
    location.replace("index.html?login=1");
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

  async function settle() {
    stopTicking();
    const end = Date.now();
    const duration = end - start;
    const ok = duration >= THRESHOLD;
    const startStr = fmtDateTime(start);
    const endStr = fmtDateTime(end);

    cardEmoji.textContent = ok ? "🎉" : "⏳";
    cardTitle.textContent = (titleEl.textContent || "晨读") + "已完成";
    cardBadge.textContent = ok
      ? "✅ 已达 30 分钟，可换学时"
      : "⚠️ 未达 30 分钟，还差 " + fmtCN(THRESHOLD - duration);
    cardBadge.className = "card-badge " + (ok ? "ok" : "warn");
    cardName.textContent = identity.name;
    cardId.textContent = identity.id;
    cardStart.textContent = startStr;
    cardEnd.textContent = endStr;
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

  async function load() {
    let item;
    try {
      const res = await fetch("manifest.json?v=" + Date.now(), { cache: "no-store" });
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
      const viewports = [];
      const topbar = document.querySelector(".topbar");

      function scrollToDest(pageIndex, yOffset) {
        const targetWrap = container.children[pageIndex];
        if (!targetWrap) return;
        const offset = (topbar ? topbar.offsetHeight : 0) + 12;
        const y = targetWrap.getBoundingClientRect().top + window.scrollY + yOffset - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }

      async function resolveDest(dest) {
        if (typeof dest === "string") dest = await pdf.getDestination(dest);
        if (!Array.isArray(dest) || dest[0] == null) return null;
        let pageIndex;
        if (typeof dest[0] === "number") {
          pageIndex = dest[0];
        } else {
          try { pageIndex = await pdf.getPageIndex(dest[0]); } catch { return null; }
        }
        if (pageIndex == null || pageIndex < 0) return null;
        const vp = viewports[pageIndex];
        let yOffset = 0;
        const kind = dest[1] && dest[1].name;
        if (vp && kind === "XYZ" && typeof dest[3] === "number") {
          yOffset = vp.convertToViewportPoint(typeof dest[2] === "number" ? dest[2] : 0, dest[3])[1];
        } else if (vp && (kind === "FitH" || kind === "FitBH") && typeof dest[2] === "number") {
          yOffset = vp.convertToViewportPoint(0, dest[2])[1];
        }
        return { pageIndex, yOffset };
      }
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, (baseWidth - 24) / base.width);
        const viewport = page.getViewport({ scale });
        viewports[n - 1] = viewport;

        const wrap = document.createElement("div");
        wrap.className = "pdf-page-wrap";
        wrap.style.width = viewport.width + "px";
        wrap.style.height = viewport.height + "px";
        wrap.style.setProperty("--scale-factor", String(scale));

        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = document.createElement("canvas");
        canvas.className = "pdf-page";
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
        wrap.appendChild(canvas);

        const textDiv = document.createElement("div");
        textDiv.className = "textLayer";
        wrap.appendChild(textDiv);

        const linkDiv = document.createElement("div");
        linkDiv.className = "pdf-link-layer";
        wrap.appendChild(linkDiv);

        container.appendChild(wrap);
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport, transform }).promise;

        try {
          pdfjsLib.renderTextLayer({
            textContentSource: page.streamTextContent(),
            container: textDiv,
            viewport,
          });
        } catch {}

        try {
          const annotations = await page.getAnnotations();
          for (const a of annotations) {
            if (a.subtype !== "Link") continue;
            const r = viewport.convertToViewportRectangle(a.rect);
            const left = Math.min(r[0], r[2]);
            const top = Math.min(r[1], r[3]);
            const w = Math.abs(r[2] - r[0]);
            const h = Math.abs(r[3] - r[1]);
            const link = document.createElement("a");
            link.className = "pdf-link";
            link.style.left = left + "px";
            link.style.top = top + "px";
            link.style.width = w + "px";
            link.style.height = h + "px";
            if (a.url) {
              link.href = a.url;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              link.title = a.url;
            } else if (a.dest) {
              const target = await resolveDest(a.dest);
              if (!target) continue;
              link.href = "#";
              link.title = "跳转到文内引用";
              link.addEventListener("click", (e) => {
                e.preventDefault();
                scrollToDest(target.pageIndex, target.yOffset);
              });
            } else {
              continue;
            }
            linkDiv.appendChild(link);
          }
        } catch {}
      }
    } catch (e) {
      statusEl.classList.remove("hidden");
      statusEl.textContent = "PDF 加载失败：" + (e && e.message ? e.message : e);
    }
  }

  load();
})();