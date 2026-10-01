// Admin: sozlamalar (admin/settings.html) — minimal: joriy hisob, mavzu, chiqish, xavfsizlik holati.
// Qo'shimcha Firestore o'qishi yo'q: ma'lumot session.js profilidan.
import { requireAdmin, $, $$, esc, fillIcons, fullNameOf, fmtDate } from "./admin-common.js";
import { getThemePref, setThemePref } from "../core/prefs.js";

fillIcons($("#adminPage"));
const { state } = await requireAdmin();
const p = state.profile || {};
$("[data-me]").innerHTML = [
  ["Ism", esc(fullNameOf(p))],
  ["Email", `<span class="of-admin-break">${esc(state.user.email || p.email || "—")}</span>`],
  ["UID", `<code class="of-admin-break">${esc(state.user.uid)}</code>`],
  ["Role", "Administrator"],
  ["Ro‘yxat sanasi", esc(fmtDate(p.createdAt))],
].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

const radios = $$("input[name='theme']");
const sync = () => { const v = getThemePref(); radios.forEach((r) => { r.checked = r.value === v; }); };
sync();
radios.forEach((r) => r.addEventListener("change", () => r.checked && setThemePref(r.value)));
document.addEventListener("of:themechange", sync);

// Chiqish — qobiqdagi mavjud ishlovchi (signOutUser + keshlar + himoyalangan sahifadan bosh sahifaga)
$("[data-admin-logout]").addEventListener("click", (e) => {
  const shellLogout = document.querySelector("#of-user-menu [data-logout]");
  if (!shellLogout) return;
  e.currentTarget.disabled = true;
  shellLogout.click();
});
