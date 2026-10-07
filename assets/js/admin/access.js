// Admin: Access boshqaruvi (admin/access.html).
// To'rt ro'yxat (tab): role == "admin", fullAccess == true, mockTestsAccess == true, attestationAccess == true — where + documentId tartibi,
// limit(20) sahifalab (indekssiz). Har qatorda "Olib tashlash" (tasdiqlash bilan) va "Ochish".
// Huquq berish — foydalanuvchi sahifasida (email bo'yicha topish shu yerda).
import { requireAdmin, $, $$, esc, fillIcons, fullNameOf, stateBox, errorText, confirmAction, updateAccess, ACCESS_LABEL, PAGE_SIZE } from "./admin-common.js";
import { toast } from "../ui/feedback.js";
import { icon } from "../ui/icons.js";

fillIcons($("#adminPage"));
const { state, fb } = await requireAdmin();
const { collection, query, where, orderBy, limit, startAfter, getDocs, documentId, getCountFromServer } = fb.fsSdk;
const col = collection(fb.db, "users");

const TABS = {
  admin: { field: "role", on: "admin", off: "user", revoke: "Adminlikdan olish" },
  fullAccess: { field: "fullAccess", on: true, off: false, revoke: "Full Accessni o‘chirish" },
  mockTestsAccess: { field: "mockTestsAccess", on: true, off: false, revoke: "Mock Accessni o‘chirish" },
  attestationAccess: { field: "attestationAccess", on: true, off: false, revoke: "Attestatsiya ruxsatini olish" },
};
const list = $("[data-access-list]");
const stateEl = $("[data-access-state]");
const more = $("[data-access-more]");
const msg = $("[data-access-msg]");
const panel = $("#panel-access");
let tab = "admin";
let cursor = null;
let token = 0;
const busy = new Set();

function setMsg(text, type = "success") {
  if (!text) { msg.hidden = true; return; }
  msg.hidden = false;
  msg.className = `of-alert ${type === "error" ? "of-alert--error" : "of-alert--success"}`;
  msg.setAttribute("role", type === "error" ? "alert" : "status");
  msg.textContent = text;
}

function item(id, u) {
  const t = TABS[tab];
  const self = id === state.user.uid && tab === "admin";
  const name = fullNameOf(u);
  return `<li class="of-admin-list__item" data-uid="${esc(id)}">
    <div class="of-admin-list__who"><b>${esc(name)}</b><span class="of-admin-break">${esc(u.email || id)}</span></div>
    <div class="of-admin-list__actions">
      <a class="of-btn of-btn--ghost of-btn--sm" href="user.html?id=${encodeURIComponent(id)}" aria-label="${esc(`${name} — ochish`)}">Ochish</a>
      ${self ? '<span class="of-admin-note">Siz (o‘zgartirib bo‘lmaydi)</span>'
        : `<button type="button" class="of-btn of-btn--soft of-btn--sm of-admin-revoke" data-revoke data-name="${esc(name)}" aria-label="${esc(`${name}: ${t.revoke}`)}">${esc(t.revoke)}</button>`}
    </div></li>`;
}

async function loadCounts() {
  await Promise.all(Object.entries(TABS).map(async ([key, t]) => {
    try {
      const snap = await getCountFromServer(query(col, where(t.field, "==", t.on)));
      $(`[data-tab-count="${key}"]`).textContent = `(${snap.data().count})`;
    } catch { $(`[data-tab-count="${key}"]`).textContent = ""; }
  }));
}

async function load({ reset = true } = {}) {
  const my = ++token;
  const t = TABS[tab];
  if (reset) { cursor = null; list.innerHTML = ""; stateEl.innerHTML = `<div class="of-admin-loading"><span class="of-skeleton of-skeleton--text"></span></div>`; }
  list.setAttribute("aria-busy", "true");
  more.disabled = true;
  try {
    const cons = [where(t.field, "==", t.on), orderBy(documentId())];
    if (cursor) cons.push(startAfter(cursor));
    cons.push(limit(PAGE_SIZE));
    const snap = await getDocs(query(col, ...cons));
    if (my !== token) return;
    list.insertAdjacentHTML("beforeend", snap.docs.map((d) => item(d.id, d.data())).join(""));
    cursor = snap.docs[snap.docs.length - 1] || cursor;
    more.hidden = snap.docs.length < PAGE_SIZE;
    stateEl.innerHTML = list.children.length ? "" : stateBox("empty", `${ACCESS_LABEL[t.field]} huquqiga ega foydalanuvchi yo‘q.`);
  } catch (error) {
    if (my !== token) return;
    stateEl.innerHTML = stateBox("error", "Ro‘yxatni yuklab bo‘lmadi.", errorText(error));
    more.hidden = true;
  } finally {
    if (my === token) { list.setAttribute("aria-busy", "false"); more.disabled = false; }
  }
}

// ------------------------------------------------------------ tablar (klaviatura: ← → Home End)
const tabs = $$("[role='tab']");
function select(btn, focus = false) {
  tabs.forEach((b) => { const on = b === btn; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  panel.setAttribute("aria-labelledby", btn.id);
  if (focus) btn.focus();
  tab = btn.dataset.tab;
  setMsg("");
  load();
}
tabs.forEach((b, i) => {
  b.addEventListener("click", () => select(b));
  b.addEventListener("keydown", (e) => {
    const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    select(tabs[(k + tabs.length) % tabs.length], true);
  });
});

// ------------------------------------------------------------ olib tashlash
list.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-revoke]");
  if (!btn) return;
  const li = btn.closest("[data-uid]");
  const uid = li.dataset.uid;
  const t = TABS[tab];
  if (busy.has(uid) || (tab === "admin" && uid === state.user.uid)) return;
  const name = btn.dataset.name;
  const ok = await confirmAction({
    title: tab === "admin" ? "Adminlikdan olasizmi?" : `${ACCESS_LABEL[t.field]}ni o‘chirmoqchimisiz?`,
    text: tab === "admin" ? `${name} administrator huquqidan mahrum bo‘ladi.` : `${name} uchun ${ACCESS_LABEL[t.field]} o‘chiriladi.`,
    confirmLabel: "Tasdiqlash", danger: true,
  });
  if (!ok) return;
  busy.add(uid);
  btn.disabled = true;
  btn.classList.add("is-loading");
  try {
    await updateAccess(fb, uid, t.field, t.off);
    li.remove();
    const done = `${ACCESS_LABEL[t.field]} o‘chirildi (${name}).`;
    setMsg(done);
    toast(done);
    loadCounts();
    if (!list.children.length) stateEl.innerHTML = stateBox("empty", `${ACCESS_LABEL[t.field]} huquqiga ega foydalanuvchi yo‘q.`);
  } catch (error) {
    btn.disabled = false;
    btn.classList.remove("is-loading");
    setMsg(errorText(error, "Huquqni o‘zgartirib bo‘lmadi."), "error");
  } finally {
    busy.delete(uid);
  }
});

// ------------------------------------------------------------ email bo'yicha topish
const findForm = $("[data-find-form]");
const findInput = $("#findEmail");
const findErr = $("#findEmail-err");
const findOut = $("[data-find-results]");
findForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = findInput.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
    findInput.setAttribute("aria-invalid", "true");
    findErr.textContent = "To‘g‘ri email manzil kiriting.";
    findInput.focus();
    return;
  }
  findInput.setAttribute("aria-invalid", "false");
  findErr.textContent = "";
  findOut.innerHTML = `<div class="of-admin-loading"><span class="of-skeleton of-skeleton--text"></span></div>`;
  try {
    const snap = await getDocs(query(col, where("email", "in", [...new Set([v, v.toLowerCase()])]), limit(5)));
    findOut.innerHTML = snap.empty ? stateBox("empty", "Bu email bilan profil topilmadi.")
      : `<ul class="of-card of-admin-list of-admin-list--found">${snap.docs.map((d) => {
        const u = d.data();
        return `<li class="of-admin-list__item"><div class="of-admin-list__who"><b>${esc(fullNameOf(u))}</b><span class="of-admin-break">${esc(u.email || "")}</span></div>
          <div class="of-admin-list__actions"><a class="of-btn of-btn--primary of-btn--sm" href="user.html?id=${encodeURIComponent(d.id)}">Huquqlarni boshqarish${icon("chevronRight")}</a></div></li>`;
      }).join("")}</ul>`;
  } catch (error) {
    findOut.innerHTML = stateBox("error", "Qidiruvni bajarib bo‘lmadi.", errorText(error));
  }
});

loadCounts();
load();
