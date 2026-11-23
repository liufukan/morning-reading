"use strict";

// 真实开始时间固定不变；有效时长 = 累计运行毫秒，暂停期间不累加。
function mrCreateTimer(sessionKey, opts) {
  const idleMs = opts.idleMs || 60000;
  const raw = localStorage.getItem(sessionKey);
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}
  let realStart, accum;
  if (parsed && Number.isFinite(parsed.start) && Number.isFinite(parsed.accum)) {
    realStart = parsed.start;
    accum = parsed.accum;
  } else {
    const legacy = Number(raw);
    if (Number.isFinite(legacy) && legacy > 0) {
      realStart = legacy;
      accum = Math.max(0, Date.now() - legacy);
    } else {
      realStart = Date.now();
      accum = 0;
    }
  }

  let running = true;
  let lastResume = Date.now();
  let cause = null;
  let lastActivity = Date.now();
  let handle = null;

  function persist() {
    localStorage.setItem(sessionKey, JSON.stringify({ start: realStart, accum }));
  }
  persist();

  function elapsed() {
    return accum + (running ? Date.now() - lastResume : 0);
  }
  function tick() {
    opts.onTick(elapsed());
    if (running && Date.now() - lastActivity > idleMs) doPause("idle");
  }
  function startTicking() {
    tick();
    handle = setInterval(tick, 1000);
  }
  function stopTicking() {
    if (handle) clearInterval(handle);
    handle = null;
  }
  function doPause(c) {
    if (!running) return;
    accum += Date.now() - lastResume;
    running = false;
    cause = c;
    stopTicking();
    persist();
    opts.onTick(elapsed());
    opts.onPause(c);
  }
  function doResume() {
    if (running) return;
    running = true;
    cause = null;
    lastResume = Date.now();
    lastActivity = Date.now();
    persist();
    opts.onPause(null);
    startTicking();
  }
  function onActivity() {
    lastActivity = Date.now();
    if (cause === "idle" && !document.hidden && document.hasFocus()) doResume();
  }
  function onVisibility() {
    if (document.hidden || !document.hasFocus()) doPause("hidden");
    else if (cause === "hidden") doResume();
  }

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", onVisibility);
  window.addEventListener("focus", onVisibility);
  for (const ev of ["scroll", "pointerdown", "keydown", "wheel", "touchstart", "mousemove"]) {
    window.addEventListener(ev, onActivity, { passive: true });
  }

  startTicking();

  return {
    get start() { return realStart; },
    elapsed,
    pause: () => doPause("manual"),
    resume: doResume,
  };
}