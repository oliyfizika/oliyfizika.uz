// ==========================================================================
// Yordam markazi (dashboard/help.html) — OliyFizika 2.0.
// - Kontent statik (HTML ichida); Firebase so'rovi YO'Q. Sahifa mehmonlar uchun ham ochiq.
// - Accordion: button[aria-expanded] + aria-controls, panel[role=region][hidden].
// - Qidiruv: real vaqtda, katta-kichik harfga befarq, o'zbek apostroflari (‘ ’ ʻ ʼ ` ') bir xil.
//   Natijalar relevance bo'yicha saralanadi: sarlavha > kalit so'zlar > matn.
// - Mehmon: "Kirish / Ro'yxatdan o'tish" — mavjud auth oynasi (OFShell.openAuth);
//   himoyalangan sahifaga havola — mavjud auth gate (bindProtectedLinks).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { onSession } from "../core/session.js";
import { bindProtectedLinks } from "../auth/auth-gate.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Qidiruv uchun normallashtirish: kichik harf, apostroflar bir xil, diakritikasiz, ortiqcha bo'shliqsiz. */
export function norm(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´']/g, "'")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
// Apostrofsiz yozilgan so'zlar ham topilsin ("ozgartirish" ≈ "o'zgartirish")
const loose = (t) => t.replace(/'/g, "");

const page = $("#helpPage");
$$("[data-icon]", page).forEach((el) => { if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon); });

// ------------------------------------------------------------ accordion
function setOpen(item, open, { focus = false } = {}) {
  const btn = $(".of-help-acc__btn", item);
  const panel = document.getElementById(btn.getAttribute("aria-controls"));
  btn.setAttribute("aria-expanded", String(open));
  panel.hidden = !open;
  if (focus) btn.focus({ preventScroll: true });
}
page.addEventListener("click", (e) => {
  const btn = e.target.closest(".of-help-acc__btn");
  if (!btn) return;
  const item = btn.closest("[data-help-item]");
  setOpen(item, btn.getAttribute("aria-expanded") !== "true");
});

// ------------------------------------------------------------ indeks
const items = $$("[data-help-item]", page).map((el) => {
  const title = $(".of-help-acc__btn span", el).textContent.trim();
  const panel = $(".of-help-acc__panel", el);
  // Paragraf va ro'yxat bandlari orasida bo'shliq saqlansin (snippet uchun)
  const blocks = $$("p, li", panel).map((b) => b.textContent);
  const body = (blocks.length ? blocks.join(" ") : panel.textContent).replace(/\s+/g, " ").trim();
  const section = el.closest("[data-help-cat]");
  const n = { title: norm(title), kw: norm(el.dataset.keywords), body: norm(body), cat: norm(section?.dataset.helpCat) };
  return { el, id: el.id, title, body, category: section?.dataset.helpCat || "", n, loose: { title: loose(n.title), all: loose(`${n.title} ${n.kw} ${n.body} ${n.cat}`) } };
});

function score(entry, q, tokens) {
  const all = `${entry.n.title} ${entry.n.kw} ${entry.n.body} ${entry.n.cat}`;
  // Har bir so'z (qisman ham) kontentda bo'lishi shart
  const lq = tokens.map(loose);
  if (!tokens.every((t, i) => all.includes(t) || entry.loose.all.includes(lq[i]))) return 0;
  let s = 0;
  if (entry.n.title === q) s += 200;
  if (entry.n.title.startsWith(q)) s += 80;
  if (entry.n.title.includes(q) || entry.loose.title.includes(loose(q))) s += 60;
  tokens.forEach((t, i) => {
    if (entry.n.title.includes(t) || entry.loose.title.includes(lq[i])) s += 12;
    if (entry.n.kw.includes(t)) s += 6;
    if (entry.n.cat.includes(t)) s += 3;
    if (entry.n.body.includes(t)) s += 1;
  });
  return s;
}

function snippet(entry, tokens) {
  const text = entry.body;
  const low = norm(text);
  let at = -1;
  for (const t of tokens) { at = low.indexOf(t); if (at >= 0) break; }
  // norm() matn uzunligini deyarli saqlaydi (faqat bo'shliqlar) — taxminiy joy yetarli
  const start = Math.max(0, at - 40);
  let s = text.slice(start, start + 150).trim();
  if (start > 0) s = `…${s}`;
  if (start + 150 < text.length) s = `${s}…`;
  return s;
}

// ------------------------------------------------------------ qidiruv UI
const input = $("#helpSearch");
const clearBtn = $("[data-help-clear]");
const status = $("[data-help-status]");
const results = $("[data-help-results]");
const list = $("[data-help-results-list]");
const empty = $("[data-help-empty]");
const count = $("[data-help-count]");
const browse = $("[data-help-browse]");

function runSearch(raw) {
  const q = norm(raw);
  clearBtn.hidden = !raw;
  if (!q) {
    results.hidden = true;
    browse.hidden = false;
    list.replaceChildren();
    status.textContent = "";
    return 0;
  }
  const tokens = q.split(" ").filter(Boolean);
  const found = items
    .map((entry) => ({ entry, s: score(entry, q, tokens) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s);

  browse.hidden = true;
  results.hidden = false;
  empty.hidden = found.length > 0;
  count.textContent = found.length ? `(${found.length})` : "";
  list.innerHTML = found.map(({ entry }) => `
    <li>
      <a class="of-help-hit" href="#${esc(entry.id)}" data-help-goto="${esc(entry.id)}">
        <span class="of-help-hit__cat">${esc(entry.category)}</span>
        <span class="of-help-hit__title">${esc(entry.title)}</span>
        <span class="of-help-hit__snip">${esc(snippet(entry, tokens))}</span>
      </a>
    </li>`).join("");
  status.textContent = found.length ? `${found.length} ta natija topildi.` : "Hech narsa topilmadi. Qidiruv so‘zini o‘zgartirib ko‘ring.";
  return found.length;
}

let timer = null;
input.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(() => runSearch(input.value), 120);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && input.value) {
    e.preventDefault();
    e.stopPropagation();
    input.value = "";
    runSearch("");
  } else if (e.key === "ArrowDown" && !results.hidden) {
    const first = $(".of-help-hit", list);
    if (first) { e.preventDefault(); first.focus(); }
  }
});
$("[data-help-search-form]").addEventListener("submit", (e) => {
  e.preventDefault();
  clearTimeout(timer);
  runSearch(input.value);
  $(".of-help-hit", list)?.focus();
});
clearBtn.addEventListener("click", () => {
  input.value = "";
  runSearch("");
  input.focus();
});
// Natijalar ro'yxatida strelkalar bilan harakatlanish
list.addEventListener("keydown", (e) => {
  if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
  const hits = $$(".of-help-hit", list);
  const i = hits.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  if (e.key === "ArrowUp" && i === 0) { input.focus(); return; }
  hits[Math.min(hits.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))].focus();
});

// ------------------------------------------------------------ maqolaga o'tish (#id yoki natija)
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function openTarget(id, { clearSearch = true } = {}) {
  const target = document.getElementById(id);
  if (!target || !page.contains(target)) return false;
  if (clearSearch && !results.hidden) { input.value = ""; runSearch(""); }
  if (target.matches("[data-help-item]")) {
    setOpen(target, true, { focus: true });
    target.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" });
  } else {
    target.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" });
    target.focus({ preventScroll: true });
  }
  return true;
}
list.addEventListener("click", (e) => {
  const hit = e.target.closest("[data-help-goto]");
  if (!hit) return;
  e.preventDefault();
  history.replaceState(null, "", `#${hit.dataset.helpGoto}`);
  openTarget(hit.dataset.helpGoto);
});
page.addEventListener("click", (e) => {
  const a = e.target.closest("a[href^='#cat-'], a[href^='#faq']");
  if (!a) return;
  e.preventDefault();
  const id = a.getAttribute("href").slice(1);
  history.replaceState(null, "", `#${id}`);
  openTarget(id);
});
function fromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id) requestAnimationFrame(() => openTarget(id));
}
window.addEventListener("hashchange", fromHash);
if (document.body.classList.contains("of-has-shell")) fromHash();
else document.addEventListener("of:shell-ready", fromHash, { once: true });

// ------------------------------------------------------------ auth (mavjud tizim — o'zgartirilmaydi)
const guestBox = $("[data-help-guest]");
$$("[data-help-auth]", page).forEach((b) => b.addEventListener("click", () => window.OFShell?.openAuth(b.dataset.helpAuth)));
bindProtectedLinks(page, "a[data-help-protected]");
onSession((state) => {
  if (state.status === "loading") return;
  guestBox.hidden = state.status === "authenticated";
});
