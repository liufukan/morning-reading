"use strict";

(function () {
  const $ = (s) => document.querySelector(s);
  const nameEl = $("#vName"), idEl = $("#vId"), startEl = $("#vStart"), endEl = $("#vEnd"), codeEl = $("#vCode");
  const btn = $("#verifyBtn"), out = $("#verifyResult");
  const THRESHOLD = 30 * 60 * 1000;

  function parseDT(s) {
    const t = new Date(String(s).trim().replace(" ", "T"));
    return isNaN(t.getTime()) ? null : t.getTime();
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
    const name = nameEl.value.trim(), id = idEl.value.trim();
    const s = startEl.value.trim(), e = endEl.value.trim(), code = codeEl.value.trim();
    if (!name || !id || !s || !e || !code) {
      show("warn", "请填写全部字段：姓名、学号、开始时间、结束时间、审核码。");
      return;
    }
    const st = parseDT(s), en = parseDT(e);
    if (st == null || en == null) {
      show("warn", "时间格式应为 YYYY-MM-DD HH:MM:SS，例如 2026-11-20 07:30:00。");
      return;
    }
    if (en < st) {
      show("warn", "结束时间早于开始时间，请核对截图。");
      return;
    }
    let expected;
    try {
      expected = await mrComputeCode(name, id, s, e);
    } catch {
      show("warn", "当前环境不支持核验（需 HTTPS 或 localhost）。");
      return;
    }
    const dur = en - st;
    const ok = dur >= THRESHOLD;
    if (mrNormalizeCode(code) !== mrNormalizeCode(expected)) {
      show("bad", "❌ 审核码不匹配，疑似伪造（P 图）。请核对截图上的姓名、学号、起止时间与审核码是否一致。");
      return;
    }
    if (ok) show("good", "✅ 审核码匹配，时长 " + fmtCN(dur) + "，已达 30 分钟，可发学时。");
    else show("warn", "⚠️ 审核码匹配，但时长 " + fmtCN(dur) + "，未达 30 分钟。");
  });
})();