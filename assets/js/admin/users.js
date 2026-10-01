// Admin: foydalanuvchilar ro'yxati (admin/users.html).
// - Sahifalash: limit(20) + startAfter; hamma hujjat birdaniga yuklanmaydi.
// - Tartib: bitta maydon bo'yicha orderBy (kompozit indeks talab qilinmaydi).
//   Firestore'da orderBy maydoni YO'Q hujjatlar natijaga kirmaydi — "Barchasi (hujjat ID)" tartibi hammasini ko'rsatadi.
// - Filtr: where(field == value) + documentId tartibi (indekssiz). "Oddiy foydalanuvchilar" — adminlar sahifada chiqarib tashlanadi.
// - Qidiruv: email / to'liq ism prefiksi (katta-kichik harfga sezgir — Firestore cheklovi) yoki aniq UID.
import { requireAdmin, $, esc, fillIcons, splitNames, fmtDate, formatDateTime, yesNo, roleBadge, stateBox, errorText, num, PAGE_SIZE } from "./admin-common.js";
import { icon } from "../ui/icons.js";

fillIcons($("#adminPage"));
const { fb } = await requireAdmin();
const { collection, query, where, orderBy, limit, startAfter, getDocs, getDoc, doc, documentId } = fb.fsSdk;
const col = collection(fb.db, "users");

const body = $("[data-users-body]");
const stateEl = $("[data-users-state]");
const more = $("[data-users-more]");
const hint = $("[data-users-hint]");
const filterSel = $("#userFilter");
const sortSel = $("#userSort");
const search = $("#userSearch");

let cursor = null;
let loading = false;
let token = 0;

function row(id, u) {
  const n = splitNames(u);
  const cells = [
    ["Ism", esc(n.first)], ["Familiya", esc(n.last)], ["Email", `<span class="of-admin-break">${esc(u.email || "—")}</span>`],
    ["Role", roleBadge(u.role)], ["Full Access", yesNo(u.fullAccess)], ["Mock Access", yesNo(u.mockTestsAccess)],
    ["XP", num(u.xp)], ["Daraja", num(u.level)], ["Ro‘yxat sanasi", esc(fmtDate(u.createdAt))], ["Oxirgi faollik", esc(formatDateTime(u.lastActiveAt))],
  ];
  return `<tr>${cells.map(([l, v], i) => `<td data-label="${l}"${i === 6 || i === 7 ? ' class="of-num"' : ""}>${v}</td>`).join("")}
    <td class="of-admin-cell-action"><a class="of-btn of-btn--soft of-btn--sm" href="user.html?id=${encodeURIComponent(id)}" aria-label="${esc(`${n.first} ${n.last} — batafsil`)}">Ochish${icon("chevronRight")}</a></td></tr>`;
}

function buildQuery() {
  const f = filterSel.value;
  const cons = [];
  if (f === "admin") cons.push(where("role", "==", "admin"), orderBy(documentId()));
  else if (f === "fullAccess") cons.push(where("fullAccess", "==", true), orderBy(documentId()));
  else if (f === "mock") cons.push(where("mockTestsAccess", "==", true), orderBy(documentId()));
  else {
    const s = sortSel.value;
    if (s === "__id") cons.push(orderBy(documentId()));
    else cons.push(orderBy(s, s === "fullName" ? "asc" : "desc"));
  }
  if (cursor) cons.push(startAfter(cursor));
  cons.push(limit(PAGE_SIZE));
  return query(col, ...cons);
}

function updateHint() {
  const f = filterSel.value;
  sortSel.disabled = f !== "all" && f !== "user";
  const parts = [];
  if (sortSel.disabled) parts.push("Filtr tanlanganda ro‘yxat hujjat ID bo‘yicha tartiblanadi.");
  else if (sortSel.value !== "__id") parts.push("Bu tartibda tanlangan maydoni yo‘q hisoblar ko‘rinmaydi — hammasi uchun “Barchasi (hujjat ID)” tartibini tanlang.");
  if (f === "user") parts.push("Adminlar sahifadan chiqarib tashlanadi, shu sababli sahifada 20 tadan kam qator bo‘lishi mumkin.");
  hint.textContent = parts.join(" ");
}

async function load({ reset = false } = {}) {
  if (loading && !reset) return;
  const my = ++token;
  if (reset) { cursor = null; body.innerHTML = ""; }
  loading = true;
  more.disabled = true;
  body.setAttribute("aria-busy", "true");
  stateEl.innerHTML = reset ? `<div class="of-admin-loading"><span class="of-skeleton of-skeleton--text"></span><span class="of-skeleton of-skeleton--text"></span></div>` : "";
  try {
    const snap = await getDocs(buildQuery());
    if (my !== token) return;
    let docs = snap.docs;
    if (filterSel.value === "user") docs = docs.filter((d) => d.data().role !== "admin");
    body.insertAdjacentHTML("beforeend", docs.map((d) => row(d.id, d.data())).join(""));
    cursor = snap.docs[snap.docs.length - 1] || cursor;
    more.hidden = snap.docs.length < PAGE_SIZE;
    stateEl.innerHTML = body.children.length ? ""
      : !more.hidden ? stateBox("empty", "Bu sahifada mos foydalanuvchi yo‘q.", "“Ko‘proq yuklash” orqali keyingi sahifani ko‘ring.")
      : stateBox("empty", "Foydalanuvchi topilmadi.", "Filtr yoki tartibni o‘zgartirib ko‘ring.");
  } catch (error) {
    if (my !== token) return;
    stateEl.innerHTML = stateBox("error", "Ro‘yxatni yuklab bo‘lmadi.", errorText(error));
    more.hidden = true;
  } finally {
    if (my === token) { loading = false; more.disabled = false; body.setAttribute("aria-busy", "false"); }
  }
}

// ------------------------------------------------------------ qidiruv
async function runSearch(raw) {
  const q = raw.trim();
  const my = ++token;
  if (q.length < 2) { updateHint(); return load({ reset: true }); }
  body.innerHTML = "";
  more.hidden = true;
  body.setAttribute("aria-busy", "true");
  stateEl.innerHTML = `<div class="of-admin-loading"><span class="of-skeleton of-skeleton--text"></span></div>`;
  hint.textContent = "Qidiruv filtr va tartibdan mustaqil ishlaydi (eng ko‘pi bilan 20 ta natija).";
  const prefix = (field, value) => query(col, where(field, ">=", value), where(field, "<=", `${value}`), orderBy(field), limit(PAGE_SIZE));
  const cap = q.charAt(0).toUpperCase() + q.slice(1);
  const jobs = [getDocs(prefix("email", q.toLowerCase())), getDocs(prefix("fullName", q))];
  if (cap !== q) jobs.push(getDocs(prefix("fullName", cap)));
  if (/^[A-Za-z0-9_-]{16,128}$/.test(q)) jobs.push(getDoc(doc(fb.db, "users", q)).then((s) => ({ docs: s.exists() ? [s] : [] })));
  try {
    const found = new Map();
    for (const r of await Promise.allSettled(jobs)) {
      if (r.status === "fulfilled") r.value.docs.forEach((d) => found.set(d.id, d));
      else throw r.reason;
    }
    if (my !== token) return;
    const docs = [...found.values()].slice(0, PAGE_SIZE);
    body.innerHTML = docs.map((d) => row(d.id, d.data())).join("");
    stateEl.innerHTML = docs.length ? "" : stateBox("empty", "Hech narsa topilmadi.", "Email, ism boshlanishi (katta harf bilan) yoki to‘liq UID kiriting.");
  } catch (error) {
    if (my !== token) return;
    stateEl.innerHTML = stateBox("error", "Qidiruvni bajarib bo‘lmadi.", errorText(error));
  } finally {
    if (my === token) body.setAttribute("aria-busy", "false");
  }
}

let timer = null;
search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => runSearch(search.value), 400); });
search.addEventListener("keydown", (e) => { if (e.key === "Escape" && search.value) { search.value = ""; runSearch(""); } });
$("[data-users-form]").addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(timer); runSearch(search.value); });
filterSel.addEventListener("change", () => { search.value = ""; updateHint(); load({ reset: true }); });
sortSel.addEventListener("change", () => { search.value = ""; updateHint(); load({ reset: true }); });
more.addEventListener("click", () => load());

updateHint();
load({ reset: true });
