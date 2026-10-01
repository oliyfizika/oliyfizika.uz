// Admin: bitta foydalanuvchi (admin/user.html?id=UID).
// Ko'rish: profil (telefon ko'rsatilmaydi). O'zgartirish: faqat role / fullAccess / mockTestsAccess —
// har biri tasdiqlash oynasidan keyin, bitta maydonli updateDoc bilan (Rules: adminAccessUpdate).
// Admin o'z role maydonini o'zgartira olmaydi (UI bloklaydi, Rules ham rad etadi).
import { requireAdmin, $, $$, esc, fillIcons, fullNameOf, splitNames, fmtDate, formatDateTime, stateBox, errorText, num,
  confirmAction, updateAccess, ACCESS_LABEL, yesNo } from "./admin-common.js";
import { toast } from "../ui/feedback.js";

fillIcons($("#adminPage"));
const { state, fb } = await requireAdmin();
const { doc, getDoc, getDocs, collection, query, where, limit } = fb.fsSdk;

const uid = new URLSearchParams(location.search).get("id") || "";
const stateEl = $("[data-user-state]");
const content = $("[data-user-content]");
const msg = $("[data-access-msg]");
const isSelf = uid === state.user.uid;
let data = null;
let busy = false;

function setMsg(text, type = "success") {
  if (!text) { msg.hidden = true; msg.textContent = ""; return; }
  msg.hidden = false;
  msg.className = `of-alert ${type === "error" ? "of-alert--error" : "of-alert--success"}`;
  msg.setAttribute("role", type === "error" ? "alert" : "status");
  msg.textContent = text;
}

function value(field) {
  return field === "role" ? data.role === "admin" : data[field] === true;
}

function renderSwitches() {
  $$("[data-access]").forEach((btn) => {
    const field = btn.dataset.access;
    const on = value(field);
    btn.setAttribute("aria-checked", String(on));
    btn.querySelector("[data-switch-state]").textContent = on ? "Yoqilgan" : "O‘chirilgan";
    btn.disabled = busy || (field === "role" && isSelf);
  });
  $("[data-self-note]").hidden = !isSelf;
}

function renderProfile() {
  const n = splitNames(data);
  const name = fullNameOf(data);
  $("[data-user-title]").textContent = name;
  $("[data-user-sub]").textContent = data.email || uid;
  window.OFShell?.setTitle(name);
  const rows = [
    ["UID", `<code class="of-admin-break">${esc(uid)}</code>`],
    ["Ism", esc(n.first)], ["Familiya", esc(n.last)], ["To‘liq ism", esc(data.fullName || "—")],
    ["Email", `<span class="of-admin-break">${esc(data.email || "—")}</span>`],
    ["Ro‘yxat sanasi", esc(fmtDate(data.createdAt))], ["Oxirgi faollik", esc(formatDateTime(data.lastActiveAt))],
    ["XP", esc(num(data.xp))], ["Daraja", esc(num(data.level))],
    ["Role", data.role === "admin" ? "Admin" : "Foydalanuvchi"],
    ["Full Access", yesNo(data.fullAccess)], ["Mock Test Access", yesNo(data.mockTestsAccess)],
  ];
  $("[data-user-profile]").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  fillIcons($("[data-user-profile]"));
}

async function loadResults() {
  const box = $("[data-user-results]");
  $("[data-user-results-link]").href = `results.html?uid=${encodeURIComponent(uid)}`;
  try {
    // where(uid ==) — indeks talab qilinmaydi; tartiblash brauzerda (bitta foydalanuvchi natijalari).
    const snap = await getDocs(query(collection(fb.db, "results"), where("uid", "==", uid), limit(200)));
    const list = snap.docs.map((d) => d.data()).sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0));
    box.innerHTML = list.length ? `<ul class="of-admin-mini">${list.slice(0, 10).map((r) => `
      <li><div><b>${esc(`${r.lessonId ?? "?"}-mavzu`)} · ${esc(`${r.percent ?? "—"}%`)}</b><span>${esc(`${r.score ?? "—"}/${r.totalQuestions ?? "—"}`)} · ${r.passed ? "O‘tgan" : "O‘tmagan"}</span></div>
      <time>${esc(formatDateTime(r.completedAt))}</time></li>`).join("")}</ul>
      <p class="of-admin-note">Jami: ${list.length} ta natija${snap.docs.length >= 200 ? " (birinchi 200 tasi)" : ""}.</p>`
      : stateBox("empty", "Bu foydalanuvchida test natijalari yo‘q.");
  } catch (error) {
    box.innerHTML = stateBox("error", "Natijalarni yuklab bo‘lmadi.", errorText(error));
  }
  box.setAttribute("aria-busy", "false");
}

// XP tarixi (Phase 19C): har bir mukofot qaysi natija uchun berilgani. Faqat o'qish.
async function loadXpGrants() {
  const box = $("[data-user-xp]");
  try {
    const snap = await getDocs(query(collection(fb.db, "users", uid, "xpGrants"), limit(150)));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const total = list.reduce((sum, g) => sum + (Number(g.xp) || 0), 0);
    const profileXp = Number(data.xp) || 0;
    box.innerHTML = (list.length ? `<ul class="of-admin-mini">${list.slice(0, 20).map((g) => `
      <li><div><b>${esc(`${g.lessonId ?? "?"}-mavzu · +${g.xp ?? 0} XP`)}</b>
        <span>${esc(`${g.percent ?? "—"}% · ${num(g.previousXp)} → ${num(g.newXp)} XP · ${g.level ?? "—"}-daraja`)}</span>
        <span class="of-admin-break">Natija: <code>${esc(g.resultId || "—")}</code></span></div>
      <time>${esc(formatDateTime(g.createdAt))}</time></li>`).join("")}</ul>`
      : stateBox("empty", "Jurnalda XP mukofoti yo‘q.")) +
      `<p class="of-admin-note">Jurnaldagi XP: ${esc(num(total))} · Profildagi XP: ${esc(num(profileXp))}${profileXp !== total ? " — farq XP jurnali joriy etilishidan (Phase 19C) oldin berilgan XP’dan iborat bo‘lishi mumkin." : "."}</p>`;
  } catch (error) {
    box.innerHTML = stateBox("error", "XP tarixini yuklab bo‘lmadi.", errorText(error));
  }
  box.setAttribute("aria-busy", "false");
}

async function toggle(field) {
  if (busy || (field === "role" && isSelf)) return;
  const next = !value(field);
  const name = fullNameOf(data);
  const text = field === "role"
    ? (next ? `${name} administrator bo‘ladi: barcha foydalanuvchilar va natijalarni ko‘ra oladi hamda huquqlarni o‘zgartira oladi.` : `${name} administrator huquqidan mahrum bo‘ladi.`)
    : `${name} uchun ${ACCESS_LABEL[field]} ${next ? "yoqiladi" : "o‘chiriladi"}.`;
  const ok = await confirmAction({
    title: field === "role" ? (next ? "Administrator qilasizmi?" : "Adminlikdan olasizmi?") : `${ACCESS_LABEL[field]}ni ${next ? "yoqmoqchimisiz" : "o‘chirmoqchimisiz"}?`,
    text, confirmLabel: "Tasdiqlash", danger: !next,
  });
  if (!ok) return;
  busy = true;
  renderSwitches();
  const btn = $(`[data-access="${field}"]`);
  btn.classList.add("is-busy");
  btn.setAttribute("aria-busy", "true");
  setMsg("");
  try {
    await updateAccess(fb, uid, field, field === "role" ? (next ? "admin" : "user") : next);
    if (field === "role") data.role = next ? "admin" : "user"; else data[field] = next;
    const done = `${ACCESS_LABEL[field]}: ${next ? "yoqildi" : "o‘chirildi"} (${name}).`;
    setMsg(done);
    toast(done);
    renderProfile();
  } catch (error) {
    setMsg(errorText(error, "Huquqni o‘zgartirib bo‘lmadi. Iltimos, qayta urinib ko‘ring."), "error");
  } finally {
    busy = false;
    btn.classList.remove("is-busy");
    btn.setAttribute("aria-busy", "false");
    renderSwitches();
    btn.focus();
  }
}

$$("[data-access]").forEach((btn) => btn.addEventListener("click", () => toggle(btn.dataset.access)));

(async () => {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    stateEl.innerHTML = stateBox("error", "Foydalanuvchi ko‘rsatilmagan.", "Foydalanuvchilar ro‘yxatidan birini tanlang.");
    return;
  }
  stateEl.innerHTML = `<div class="of-admin-loading"><span class="of-skeleton of-skeleton--title"></span><span class="of-skeleton of-skeleton--text"></span></div>`;
  try {
    const snap = await getDoc(doc(fb.db, "users", uid));
    if (!snap.exists()) { stateEl.innerHTML = stateBox("empty", "Foydalanuvchi topilmadi.", "Bu UID bo‘yicha profil hujjati yo‘q."); return; }
    data = snap.data();
    stateEl.innerHTML = "";
    content.hidden = false;
    renderProfile();
    renderSwitches();
    loadResults();
    loadXpGrants();
  } catch (error) {
    stateEl.innerHTML = stateBox("error", "Profilni yuklab bo‘lmadi.", errorText(error));
  }
})();
