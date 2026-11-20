"use strict";

(function () {
  const CFG = { owner: "liufukan", repo: "morning-reading", branch: "main" };
  const API = "https://api.github.com";
  const PAT_KEY = "mr_admin_pat";

  const patInput = document.getElementById("patInput");
  const patSave = document.getElementById("patSave");
  const patStatus = document.getElementById("patStatus");
  const dateInput = document.getElementById("dateInput");
  const titleInput = document.getElementById("titleInput");
  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const logEl = document.getElementById("adminLog");

  function log(msg, kind) {
    const line = document.createElement("div");
    line.className = "log-line" + (kind ? " " + kind : "");
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function headers(pat) {
    return {
      Authorization: "Bearer " + pat,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
  }

  async function ghGet(pat, path) {
    const url = API + "/repos/" + CFG.owner + "/" + CFG.repo + "/contents/" + path + "?ref=" + CFG.branch;
    const res = await fetch(url, { headers: headers(pat) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("读取 " + path + " 失败（HTTP " + res.status + "）");
    return res.json();
  }

  async function ghPut(pat, path, body) {
    const url = API + "/repos/" + CFG.owner + "/" + CFG.repo + "/contents/" + path;
    const res = await fetch(url, { method: "PUT", headers: headers(pat), body: JSON.stringify(body) });
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try {
        const j = await res.json();
        if (j && j.message) msg = j.message;
      } catch {}
      throw new Error("写入 " + path + " 失败：" + msg);
    }
    return res.json();
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = () => reject(new Error("读取文件失败"));
      r.readAsDataURL(file);
    });
  }

  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    const bytes = Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function defaultTitle(date) {
    return parseInt(date.slice(5, 7), 10) + "月" + parseInt(date.slice(8, 10), 10) + "日阅读";
  }

  function refreshPatStatus() {
    const saved = localStorage.getItem(PAT_KEY);
    patStatus.textContent = saved ? "已保存令牌" : "尚未保存令牌";
    patStatus.className = "pat-status " + (saved ? "ok" : "");
  }

  patSave.addEventListener("click", () => {
    const v = patInput.value.trim();
    if (!v) {
      log("请先粘贴令牌再保存", "err");
      return;
    }
    localStorage.setItem(PAT_KEY, v);
    refreshPatStatus();
    log("令牌已保存到本浏览器", "ok");
  });

  dateInput.addEventListener("change", () => {
    if (dateInput.value) titleInput.value = defaultTitle(dateInput.value);
  });

  uploadBtn.addEventListener("click", async () => {
    const pat = patInput.value.trim() || localStorage.getItem(PAT_KEY);
    if (!pat) {
      log("请先填写并保存 GitHub 令牌", "err");
      return;
    }
    const file = fileInput.files[0];
    if (!file) {
      log("请选择 PDF 文件", "err");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      log("请选择 PDF 文件", "err");
      return;
    }
    const date = dateInput.value;
    if (!date) {
      log("请选择日期", "err");
      return;
    }
    const title = titleInput.value.trim() || defaultTitle(date);
    const id = date;
    const path = "materials/" + id + ".pdf";

    uploadBtn.disabled = true;
    try {
      log("上传 PDF「" + title + "」…");
      const base64 = await fileToBase64(file);
      const existing = await ghGet(pat, path);
      const putBody = { message: "add material " + id, content: base64, branch: CFG.branch };
      if (existing && existing.sha) putBody.sha = existing.sha;
      await ghPut(pat, path, putBody);

      log("PDF 已上传，正在更新清单…");
      const man = await ghGet(pat, "manifest.json");
      let items = [];
      let manSha = null;
      if (man) {
        manSha = man.sha;
        try {
          items = JSON.parse(base64ToUtf8(man.content));
        } catch {
          items = [];
        }
      }
      if (!Array.isArray(items)) items = [];
      const entry = { id, date, title, file: path };
      const idx = items.findIndex((m) => m.id === id);
      if (idx >= 0) items[idx] = entry;
      else items.push(entry);
      items.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

      const manText = JSON.stringify(items, null, 2) + "\n";
      const manBody = { message: "update manifest " + id, content: utf8ToBase64(manText), branch: CFG.branch };
      if (manSha) manBody.sha = manSha;
      await ghPut(pat, "manifest.json", manBody);

      log("✅ 完成！GitHub Pages 约 1 分钟后重新发布，刷新首页即可看到「" + title + "」。", "ok");
    } catch (e) {
      log("失败：" + (e && e.message ? e.message : e), "err");
    } finally {
      uploadBtn.disabled = false;
    }
  });

  dateInput.value = todayStr();
  titleInput.value = defaultTitle(dateInput.value);
  const saved = localStorage.getItem(PAT_KEY);
  if (saved) patInput.value = saved;
  refreshPatStatus();
})();