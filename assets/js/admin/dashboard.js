// Admin dashboard (admin/index.html).
// Statistika: Firestore count (getCountFromServer) — aniq son, hujjatlar brauzerga yuklanmaydi.
// So'nggi ro'yxatlar: limit(5). Hech qanday taxminiy/soxta son ko'rsatilmaydi: xato bo'lsa "—" va izoh.
import { requireAdmin, $, esc, fillIcons, fullNameOf, fmtDate, formatDateTime, stateBox, errorText, num } from "./admin-common.js";

fillIcons($("#adminPage"));
const { fb } = await requireAdmin();
const { collection, query, where, orderBy, limit, getDocs, getCountFromServer } = fb.fsSdk;
const users = collection(fb.db, "users");
const results = collection(fb.db, "results");

const STATS = {
  users: query(users),
  admins: query(users, where("role", "==", "admin")),
  fullAccess: query(users, where("fullAccess", "==", true)),
  mock: query(users, where("mockTestsAccess", "==", true)),
  results: query(results),
};

async function loadStats() {
  let failed = null;
  await Promise.all(Object.entries(STATS).map(async ([key, q]) => {
    const el = $(`[data-stat="${key}"]`);
    try {
      const snap = await getCountFromServer(q);
      el.textContent = num(snap.data().count);
    } catch (error) {
      failed = error;
      el.textContent = "—";
      el.title = "Hisoblab bo‘lmadi";
    }
  }));
  $("[data-stats]").setAttribute("aria-busy", "false");
  if (failed) $("[data-stats]").insertAdjacentHTML("afterend", stateBox("error", "Ba’zi ko‘rsatkichlarni hisoblab bo‘lmadi.", errorText(failed)));
}

async function loadRecentUsers() {
  const box = $("[data-recent-users]");
  try {
    const snap = await getDocs(query(users, orderBy("createdAt", "desc"), limit(5)));
    box.innerHTML = snap.empty ? stateBox("empty", "Hali foydalanuvchi yo‘q.") : `<ul class="of-admin-mini">${snap.docs.map((d) => {
      const u = d.data();
      return `<li><a href="user.html?id=${encodeURIComponent(d.id)}"><b>${esc(fullNameOf(u))}</b><span>${esc(u.email || "—")}</span></a><time>${esc(fmtDate(u.createdAt))}</time></li>`;
    }).join("")}</ul>`;
  } catch (error) {
    box.innerHTML = stateBox("error", "Ro‘yxatni yuklab bo‘lmadi.", errorText(error));
  }
  box.setAttribute("aria-busy", "false");
}

async function loadRecentResults() {
  const box = $("[data-recent-results]");
  try {
    const snap = await getDocs(query(results, orderBy("completedAt", "desc"), limit(5)));
    box.innerHTML = snap.empty ? stateBox("empty", "Hali test natijalari yo‘q.") : `<ul class="of-admin-mini">${snap.docs.map((d) => {
      const r = d.data();
      return `<li><a href="user.html?id=${encodeURIComponent(r.uid || "")}"><b>${esc(r.fullName || r.email || r.uid || "—")}</b>
        <span>${esc(`${r.lessonId ?? "?"}-mavzu`)} · ${esc(`${r.percent ?? "—"}%`)} · ${r.passed ? "O‘tgan" : "O‘tmagan"}</span></a><time>${esc(formatDateTime(r.completedAt))}</time></li>`;
    }).join("")}</ul>`;
  } catch (error) {
    box.innerHTML = stateBox("error", "Natijalarni yuklab bo‘lmadi.", errorText(error));
  }
  box.setAttribute("aria-busy", "false");
}

await Promise.all([loadStats(), loadRecentUsers(), loadRecentResults()]);
