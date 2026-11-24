"use strict";

(function () {
  const KEY_STORE = "mr_llm_key";
  const MODEL_STORE = "mr_llm_model";
  const API = "https://api.llm.ustc.edu.cn/v1/chat/completions";
  // 部署代理后把 PROXY_URL_DEFAULT 填为 worker 地址，同学即免 key；留空则回退到本地 key 模式。
  const PROXY_URL_DEFAULT = "";
  const PROXY_URL = localStorage.getItem("mr_llm_proxy") || PROXY_URL_DEFAULT;
  const MAX_CHARS = 2000;

  const container = document.getElementById("pdfContainer");
  const panel = document.getElementById("transPanel");
  const toggle = document.getElementById("transToggle");
  const closeBtn = document.getElementById("transClose");
  const srcEl = document.getElementById("transSrc");
  const outEl = document.getElementById("transOut");
  const statusEl = document.getElementById("transStatus");
  const keyRow = document.getElementById("transKeyRow");
  const keyInput = document.getElementById("transKeyInput");
  const keySave = document.getElementById("transKeySave");
  const modelSel = document.getElementById("transModel");
  const retryBtn = document.getElementById("transRetry");
  const copyBtn = document.getElementById("transCopy");

  let controller = null;
  let lastText = "";
  let dismissed = "";
  let isOpen = false;

  const getKey = () => localStorage.getItem(KEY_STORE) || "";
  const model = () => modelSel.value;

  modelSel.value = localStorage.getItem(MODEL_STORE) || "qwen3.8-chat";
  if (![...modelSel.options].some((o) => o.value === modelSel.value)) modelSel.value = "qwen3.8-chat";
  modelSel.addEventListener("change", () => localStorage.setItem(MODEL_STORE, modelSel.value));

  function setOpen(v) {
    isOpen = v;
    panel.classList.toggle("open", v);
    toggle.setAttribute("aria-expanded", String(v));
    if (!v && controller) controller.abort();
  }
  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = "trans-status" + (cls ? " " + cls : "");
    outEl.classList.toggle("streaming", cls === "busy");
  }
  function showKeyGate(v) {
    keyRow.classList.toggle("hidden", !v);
    if (v) keyInput.focus();
  }

  async function translate(text) {
    lastText = text;
    srcEl.textContent = text;
    outEl.textContent = "";
    const useProxy = !!PROXY_URL;
    const key = getKey();
    if (!useProxy && !key) {
      showKeyGate(true);
      setStatus("首次使用请填写学校 API key，仅保存在你自己的浏览器里。", "warn");
      return;
    }
    showKeyGate(false);
    if (controller) controller.abort();
    controller = new AbortController();
    setStatus("等待响应…（学校服务有时较慢）", "busy");
    try {
      const headers = { "Content-Type": "application/json" };
      if (!useProxy) headers.Authorization = "Bearer " + key;
      const res = await fetch(useProxy ? PROXY_URL : API, {
        method: "POST",
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model: model(),
          stream: true,
          messages: [
            { role: "system", content: "你是英语学习助手。把用户给出的英文翻译成自然、准确的中文。只输出译文，不要解释。" },
            { role: "user", content: text },
          ],
        }),
      });
      if (!res.ok) {
        if (!useProxy && (res.status === 401 || res.status === 403)) {
          showKeyGate(true);
          setStatus("key 无效或无该模型权限（" + res.status + "）。请检查 key 或换模型。", "err");
        } else if (useProxy && (res.status === 401 || res.status === 403 || res.status === 500)) {
          setStatus("代理未配置 key 或拒绝请求（" + res.status + "）。", "err");
        } else {
          setStatus("请求失败：" + res.status, "err");
        }
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            const d = j.choices && j.choices[0] && j.choices[0].delta;
            const piece = d && d.content ? d.content : "";
            if (piece) {
              outEl.textContent += piece;
              setStatus("翻译中…", "busy");
            }
          } catch {}
        }
      }
      setStatus(outEl.textContent ? "翻译完成" : "模型未返回内容，可点重译。", outEl.textContent ? "ok" : "warn");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      setStatus("网络错误或服务不可达：" + (e && e.message ? e.message : e), "err");
    }
  }

  function grabSelection() {
    const sel = window.getSelection();
    const t = sel ? String(sel).trim() : "";
    if (!t || !sel.anchorNode || !container.contains(sel.anchorNode)) {
      dismissed = "";
      return;
    }
    const text = t.slice(0, MAX_CHARS);
    if (text === dismissed) return;
    if (text === lastText && isOpen) return;
    setOpen(true);
    translate(text);
  }

  document.addEventListener("mouseup", () => setTimeout(grabSelection, 0));
  document.addEventListener("keyup", (e) => {
    if (e.shiftKey || e.key === "ArrowLeft" || e.key === "ArrowRight") setTimeout(grabSelection, 0);
  });

  toggle.addEventListener("click", () => {
    if (isOpen) {
      dismissed = lastText;
      setOpen(false);
    } else {
      setOpen(true);
    }
  });
  closeBtn.addEventListener("click", () => {
    dismissed = lastText;
    setOpen(false);
  });
  retryBtn.addEventListener("click", () => { if (lastText) translate(lastText); });
  copyBtn.addEventListener("click", async () => {
    if (!outEl.textContent) return;
    try {
      await navigator.clipboard.writeText(outEl.textContent);
      setStatus("已复制译文", "ok");
    } catch {
      setStatus("复制失败，请手动选择译文复制。", "warn");
    }
  });
  keySave.addEventListener("click", () => {
    const k = keyInput.value.trim();
    if (!k) return;
    localStorage.setItem(KEY_STORE, k);
    keyInput.value = "";
    showKeyGate(false);
    if (lastText) translate(lastText);
  });
})();