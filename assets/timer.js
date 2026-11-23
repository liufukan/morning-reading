"use strict";

// 暂停期间不计入阅读时长：恢复时把暂停时长从起点扣除，
// 使 卡片时长 = 核验码时长 = 实际阅读时长。
function mrCreateTimer(sessionKey, opts) {
  const idleMs = opts.idleMs || 60000;
  const stored = Number(localStorage.getItem(sessionKey));
  let start = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
  localStorage.setItem(sessionKey, String(start));

  let running = true;
  let pausedAt = null;
  let cause = null;
  let lastActivity = Date.now();
  let handle = null;

  function elapsed() {
    return (running ? Date.now() : pausedAt) - start;
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
    running = false;
    cause = c;
    pausedAt = Date.now();
    stopTicking();
    opts.onTick(elapsed());
    opts.onPause(c);
  }
  function doResume() {
    if (running) return;
    start += Date.now() - pausedAt;
    localStorage.setItem(sessionKey, String(start));
    running = true;
    cause = null;
    pausedAt = null;
    lastActivity = Date.now();
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
    get start() { return start; },
    elapsed,
    pause: () => doPause("manual"),
    resume: doResume,
  };
}