"use strict";

(function () {
  const $ = (s) => document.querySelector(s);
  const idEl = $("#vId"), codeEl = $("#vCode");
  const btn = $("#verifyBtn"), out = $("#verifyResult");

  function fmtDT(ms) {
    const d = new Date(ms), p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }
  function fmtCN(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h > 0 ? h + " 小时 " : "") + m + " 分 " + sec + " 秒";
  }
  function show(cls, text) {
    out.className = "verify-result " + cls;
    out.textContent = text;
  }

  btn.addEventListener("click", async () => {
    const id = idEl.value.trim(), code = codeEl.value.trim();
    if (!id || !code) {
      show("warn", "请填写学号和核验码。");
      return;
    }
    let res;
    try {
      res = await mrCheckCode(id, code);
    } catch {
      show("warn", "当前环境不支持核验（需 HTTPS 或 localhost）。");
      return;
    }
    if (!res.match) {
      show("bad", "❌ 不合格：学号与核验码不对应（疑似伪造，或学号填错）。");
      return;
    }
    const detail = "\n开始：" + fmtDT(res.startMs) + "\n结束：" + fmtDT(res.endMs) + "\n时长：" + fmtCN(res.durationMs);
    if (res.ok) show("good", "✅ 合格：核验码匹配，已达 30 分钟，可发学时。" + detail);
    else show("warn", "❌ 不合格：核验码匹配，但时长不足 30 分钟。" + detail);
  });
})();