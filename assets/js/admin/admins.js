// ==========================================================================
// Admin System 2.0 — Adminlar va bo'limlar (admin/admins.html). FAQAT owner.
//  • Email bo'yicha foydalanuvchini topish → bo'limlarni belgilash → admin tayinlash / bo'limlarini o'zgartirish.
//  • Joriy adminlar ro'yxati (role == "admin"): turi, bo'limlari, tahrirlash / adminlikdan olish.
//  • Amallar jurnali (adminAuditLog, at desc) — sahifalab.
// Himoya — firestore.rules: ownerAdminUpdate (role/adminSections), adminAuditLog o'qish — isSiteOwner.
// ==========================================================================
import { requireAdmin, $, esc, fillIcons, fullNameOf, stateBox, errorText, confirmAction, setAdminRole, formatDateTime } from "./admin-common.js";
import { ADMIN_SECTIONS, adminPerms, sectionLabel } from "./permissions.js";
import { toast } from "../ui/feedback.js";
import { icon } from "../ui/icons.js";

fillIcons($("#adminPage"));
const { state, fb } = await requireAdmin({ owner: true });
const { collection, query, where, orderBy, limit, startAfter, getDocs, getDoc, doc, documentId } = fb.fsSdk;
const users = collection(fb.db, "users");

const msg = $("[data-msg]");
const editor = $("[data-editor]");
const sectionsBox = $("[data-editor-sections]");
let current = null;          // { id, data }
let saving = false;

function setMsg(text, type = "success") {
  if (!text) { msg.hidden = true; msg.textContent = ""; return; }
  msg.hidden = false;
  msg.className = `of-alert ${type === "error" ? "of-alert--error" : "of-alert--success"}`;
  msg.setAttribute("role", type === "error" ? "alert" : "status");
  msg.textContent = text;
}

function chips(u) {
  const p = adminPerms(u);
  if (p.owner) return `<span class="of-admin-chip">${icon("shield")}Owner — hamma narsa</span>`;
  if (p.legacy) return `<span class="of-admin-chip">Barcha bo‘limlar (eski to‘liq admin)</span>`;
  return p.sections.length ? p.sections.map((s) => `<span class="of-admin-chip">${esc(sectionLabel(s))}</span>`).join("")
    : `<span class="of-admin-chip of-admin-chip--muted">Bo‘lim biriktirilmagan</span>`;
}

// ------------------------------------------------------------ tahrirlovchi
sectionsBox.insertAdjacentHTML("beforeend", ADMIN_SECTIONS.map((s) => `
  <label class="of-admin-section-opt">
    <input type="checkbox" value="${esc(s.id)}" data-section>
    <span><b>${esc(s.label)}</b><span>${esc(s.desc)}</span></span>
  </label>`).join(""));

function openEditor(id, data) {
  if (id === state.user.uid) { setMsg("O‘z huquqlaringizni bu yerda o‘zgartira olmaysiz (siz owner’siz).", "error"); return; }
  const p = adminPerms(data);
  if (p.owner) { setMsg("Owner’ni panel orqali o‘zgartirib bo‘lmaydi — faqat Firebase Console’da.", "error"); return; }
  current = { id, data };
  $("[data-editor-name]").textContent = fullNameOf(data);
  $("[data-editor-sub]").textContent = `${data.email || id} · ${p.isAdmin ? (p.legacy ? "hozir: to‘liq admin (barcha bo‘limlar)" : "hozir: bo‘limli admin") : "hozir: oddiy foydalanuvchi"}`;
  sectionsBox.querySelectorAll("[data-section]").forEach((cb) => { cb.checked = p.isAdmin && p.sections.includes(cb.value); });
  $("[data-editor-save]").textContent = p.isAdmin ? "Bo‘limlarni saqlash" : "Admin tayinlash";
  $("[data-editor-remove]").hidden = !p.isAdmin;
  editor.hidden = false;
  setMsg("");
  editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  sectionsBox.querySelector("[data-section]")?.focus();
}

function closeEditor() {
  current = null;
  editor.hidden = true;
}

async function save(remove = false) {
  if (!current || saving) return;
  const { id, data } = current;
  const name = fullNameOf(data);
  const p = adminPerms(data);
  const picked = remove ? null : [...sectionsBox.querySelectorAll("[data-section]:checked")].map((cb) => cb.value);
  const labels = picked?.map(sectionLabel).join(", ") || "hech qaysi bo‘lim";
  const ok = await confirmAction(remove
    ? { title: "Adminlikdan olasizmi?", text: `${name} administrator huquqidan mahrum bo‘ladi va admin panelga kira olmaydi.`, confirmLabel: "Adminlikdan olish", danger: true }
    : { title: p.isAdmin ? "Bo‘limlarni o‘zgartirasizmi?" : "Admin tayinlaysizmi?",
        text: `${name} quyidagi bo‘limlarni boshqaradi: ${labels}.`, confirmLabel: p.isAdmin ? "Saqlash" : "Tayinlash" });
  if (!ok) return;
  saving = true;
  editor.querySelectorAll("button").forEach((b) => { b.disabled = true; });
  try {
    await setAdminRole(fb, state, id, picked, { target: { name, email: data.email }, before: p.isAdmin ? (p.legacy ? ["*"] : p.sections) : null });
    const done = remove ? `${name} adminlikdan olindi.` : p.isAdmin ? `${name}: bo‘limlar saqlandi.` : `${name} admin etib tayinlandi.`;
    toast(done);
    closeEditor();
    setMsg(done);
    loadAdmins();
    loadLog();
  } catch (error) {
    setMsg(errorText(error, "Saqlab bo‘lmadi. Iltimos, qayta urinib ko‘ring."), "error");
  } finally {
    saving = false;
    editor.querySelectorAll("button").forEach((b) => { b.disabled = false; });
  }
}

$("[data-editor-save]").addEventListener("click", () => save(false));
$("[data-editor-remove]").addEventListener("click", () => save(true));
$("[data-editor-cancel]").addEventListener("click", () => { closeEditor(); setMsg(""); });

// ------------------------------------------------------------ email bo'yicha topish
const found = new Map();
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
    const snap = await getDocs(query(users, where("email", "in", [...new Set([v, v.toLowerCase()])]), limit(5)));
    snap.docs.forEach((d) => found.set(d.id, d.data()));
    findOut.innerHTML = snap.empty ? stateBox("empty", "Bu email bilan profil topilmadi.", "Foydalanuvchi avval saytda ro‘yxatdan o‘tishi kerak.")
      : `<ul class="of-admin-list of-admin-list--found">${snap.docs.map((d) => {
        const u = d.data();
        const p = adminPerms(u);
        return `<li class="of-admin-list__item"><div class="of-admin-list__who"><b>${esc(fullNameOf(u))}</b><span class="of-admin-break">${esc(u.email || "")}</span>
          <div class="of-admin-chips">${p.isAdmin ? chips(u) : '<span class="of-admin-chip of-admin-chip--muted">Oddiy foydalanuvchi</span>'}</div></div>
          <div class="of-admin-list__actions">${p.owner || d.id === state.user.uid ? '<span class="of-admin-note">Owner</span>'
            : `<button type="button" class="of-btn of-btn--primary of-btn--sm" data-edit="${esc(d.id)}">${p.isAdmin ? "Bo‘limlarni o‘zgartirish" : "Bo‘limlarni tanlash"}</button>`}</div></li>`;
      }).join("")}</ul>`;
  } catch (error) {
    findOut.innerHTML = stateBox("error", "Qidiruvni bajarib bo‘lmadi.", errorText(error));
  }
});

// ------------------------------------------------------------ joriy adminlar
const list = $("[data-admins-list]");
const listState = $("[data-admins-state]");
async function loadAdmins() {
  list.setAttribute("aria-busy", "true");
  try {
    const snap = await getDocs(query(users, where("role", "==", "admin"), orderBy(documentId()), limit(200)));
    snap.docs.forEach((d) => found.set(d.id, d.data()));
    const rows = snap.docs.map((d) => ({ id: d.id, u: d.data() }))
      .sort((a, b) => Number(adminPerms(b.u).owner) - Number(adminPerms(a.u).owner) || fullNameOf(a.u).localeCompare(fullNameOf(b.u)));
    $("[data-admins-count]").textContent = `${rows.length} ta`;
    list.innerHTML = rows.map(({ id, u }) => {
      const p = adminPerms(u);
      const locked = p.owner || id === state.user.uid;
      return `<li class="of-admin-list__item"><div class="of-admin-list__who"><b>${esc(fullNameOf(u))}</b><span class="of-admin-break">${esc(u.email || id)}</span>
        <div class="of-admin-chips">${chips(u)}</div></div>
        <div class="of-admin-list__actions">
          <a class="of-btn of-btn--ghost of-btn--sm" href="user.html?id=${encodeURIComponent(id)}">Profil</a>
          ${locked ? "" : `<button type="button" class="of-btn of-btn--soft of-btn--sm" data-edit="${esc(id)}">Tahrirlash</button>`}
        </div></li>`;
    }).join("");
    listState.innerHTML = rows.length ? "" : stateBox("empty", "Adminlar topilmadi.");
  } catch (error) {
    listState.innerHTML = stateBox("error", "Adminlar ro‘yxatini yuklab bo‘lmadi.", errorText(error));
  }
  list.setAttribute("aria-busy", "false");
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-edit]");
  if (!btn) return;
  const id = btn.dataset.edit;
  if (found.has(id)) openEditor(id, found.get(id));
});

// ------------------------------------------------------------ amallar jurnali
const LOG_PAGE = 30;
const logList = $("[data-log]");
const logState = $("[data-log-state]");
const logMore = $("[data-log-more]");
let logCursor = null;
const SECTION_TEXT = { adminlar: "Adminlar", umumiy: "Umumiy" };

async function loadLog({ reset = true } = {}) {
  if (reset) { logCursor = null; logList.innerHTML = ""; }
  logList.setAttribute("aria-busy", "true");
  logMore.disabled = true;
  try {
    const cons = [orderBy("at", "desc")];
    if (logCursor) cons.push(startAfter(logCursor));
    cons.push(limit(LOG_PAGE));
    const snap = await getDocs(query(collection(fb.db, "adminAuditLog"), ...cons));
    logList.insertAdjacentHTML("beforeend", snap.docs.map((d) => {
      const r = d.data();
      const who = r.actorName || r.actorEmail || r.actorUid;
      return `<li><div><b>${esc(r.summary || r.action)}</b>
        <span>${esc(who)}${r.actorEmail && r.actorName ? ` · ${esc(r.actorEmail)}` : ""}</span>
        <span class="of-admin-chip of-admin-chip--muted">${esc(SECTION_TEXT[r.section] || sectionLabel(r.section))} · ${esc(r.action)}</span></div>
        <time>${esc(formatDateTime(r.at))}</time></li>`;
    }).join(""));
    logCursor = snap.docs[snap.docs.length - 1] || logCursor;
    logMore.hidden = snap.docs.length < LOG_PAGE;
    logState.innerHTML = logList.children.length ? "" : stateBox("empty", "Hali yozuv yo‘q.", "Admin amallari (huquq berish, admin tayinlash, test e’lon qilish va h.k.) shu yerda ko‘rinadi.");
  } catch (error) {
    logState.innerHTML = stateBox("error", "Jurnalni yuklab bo‘lmadi.", errorText(error));
    logMore.hidden = true;
  }
  logList.setAttribute("aria-busy", "false");
  logMore.disabled = false;
}
logMore.addEventListener("click", () => loadLog({ reset: false }));

// ------------------------------------------------------------ ?uid= (foydalanuvchi sahifasidan)
const preUid = new URLSearchParams(location.search).get("uid");
await loadAdmins();
loadLog();
if (preUid && /^[A-Za-z0-9_-]{1,128}$/.test(preUid)) {
  try {
    const snap = await getDoc(doc(fb.db, "users", preUid));
    if (snap.exists()) { found.set(preUid, snap.data()); openEditor(preUid, snap.data()); }
  } catch (error) {
    setMsg(errorText(error), "error");
  }
}
