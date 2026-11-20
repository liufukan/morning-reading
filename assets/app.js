"use strict";

const ID_KEY = "mr_identity";
const $ = (sel) => document.querySelector(sel);
let pendingReadId = null;
let pendingFree = false;

function getIdentity() {
  try {
    return JSON.parse(localStorage.getItem(ID_KEY)) || null;
  } catch {
    return null;
  }
}

function setIdentity(identity) {
  localStorage.setItem(ID_KEY, JSON.stringify(identity));
}

function renderIdentity() {
  const who = $("#who");
  const btn = $("#loginBtn");
  if (!who || !btn) return;
  const identity = getIdentity();
  if (identity && identity.name && identity.id) {
    who.textContent = `${identity.name} · ${identity.id}`;
    who.classList.remove("hidden");
    btn.textContent = "切换";
  } else {
    who.classList.add("hidden");
    btn.textContent = "登录";
  }
}

function openLogin(reason) {
  const identity = getIdentity();
  $("#nameInput").value = identity?.name || "";
  $("#idInput").value = identity?.id || "";
  const sub = $("#loginSub");
  if (sub) {
    sub.textContent = reason === "read" || reason === "free"
      ? "阅读前请先填写姓名和学号。"
      : "填写姓名和学号，仅保存在你自己的浏览器里。";
  }
  $("#loginModal").classList.remove("hidden");
  $("#nameInput").focus();
}

function closeLogin() {
  pendingReadId = null;
  pendingFree = false;
  $("#loginModal").classList.add("hidden");
}

function saveLogin() {
  const name = $("#nameInput").value.trim();
  const sid = $("#idInput").value.trim();
  if (!name || !sid) {
    alert("请填写姓名和学号");
    return;
  }
  const target = pendingReadId;
  const free = pendingFree;
  pendingReadId = null;
  pendingFree = false;
  setIdentity({ name, id: sid });
  renderIdentity();
  closeLogin();
  if (free) location.href = "free.html";
  else if (target) location.href = "read.html?id=" + encodeURIComponent(target);
}

function initLogin() {
  const btn = $("#loginBtn");
  if (!btn) return;
  renderIdentity();
  btn.addEventListener("click", () => openLogin());
  const freeBtn = $("#freeBtn");
  if (freeBtn) {
    freeBtn.addEventListener("click", () => {
      const idn = getIdentity();
      if (idn && idn.name && idn.id) {
        location.href = "free.html";
        return;
      }
      pendingFree = true;
      openLogin("free");
    });
  }
  $("#loginCancel").addEventListener("click", closeLogin);
  $("#loginSave").addEventListener("click", saveLogin);
  $("#loginModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeLogin();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLogin();
  });
  if (new URLSearchParams(location.search).get("login") === "1") openLogin("read");
}

function renderList(items) {
  const list = $("#list");
  if (!list) return;
  list.innerHTML = "";
  const sorted = [...items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  if (!sorted.length) {
    list.innerHTML = '<li class="empty">暂无阅读材料</li>';
    return;
  }
  for (const m of sorted) {
    const li = document.createElement("li");
    li.className = "material-item";

    const date = document.createElement("div");
    date.className = "material-date";
    date.textContent = m.title || m.date || m.id;

    const actions = document.createElement("div");
    actions.className = "material-actions";

    const dl = document.createElement("a");
    dl.className = "btn btn-ghost";
    dl.href = m.file;
    dl.setAttribute("download", "");
    dl.textContent = "下载";

    const enter = document.createElement("a");
    enter.className = "btn btn-primary";
    enter.href = "read.html?id=" + encodeURIComponent(m.id);
    enter.textContent = "进入";
    enter.addEventListener("click", (e) => {
      const idn = getIdentity();
      if (idn && idn.name && idn.id) return;
      e.preventDefault();
      pendingReadId = m.id;
      openLogin("read");
    });

    actions.append(dl, enter);
    li.append(date, actions);
    list.append(li);
  }
}

async function initList() {
  const list = $("#list");
  if (!list) return;
  try {
    const res = await fetch("manifest.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const items = await res.json();
    renderList(Array.isArray(items) ? items : []);
  } catch {
    list.innerHTML = '<li class="empty">材料清单加载失败，请刷新重试。</li>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initList();
});