// ==========================================================================
// Interaktiv mock testlar katalogi (milliy-sertifikat/mock-testlar/index.html) — OliyFizika 2.0 qobig'ida.
//
// Test engine'iga TEGILMAYDI. Katalog mavjud modullardan faqat o'qiydi:
//   config.js       — CATALOG_URL (data/tests.json)
//   access-gate.js  — checkMockAccess() (engine bilan bir xil ruxsat mantig'i, REQUIRE_MOCK_ACCESS)
//   storage.js      — loadState() (qurilmadagi urinish holati: davom etmoqda / yakunlangan)
//   scoring.js      — itemCount(), countFilledItems() (band sonlari)
// Kartadagi sonlar test JSON faylining o'zidan hisoblanadi (eski catalog.js dagi kabi).
// Mehmon "Kirish va boshlash" ni bossa — saytning mavjud kirish oynasi; kirgandan so'ng aynan shu testga qaytadi.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";
import { bindProtectedLinks } from "../auth/auth-gate.js";
import { CATALOG_URL } from "../../../milliy-sertifikat/mock-testlar/js/config.js";
import { checkMockAccess } from "../../../milliy-sertifikat/mock-testlar/js/access-gate.js";
import { loadState } from "../../../milliy-sertifikat/mock-testlar/js/storage.js";
import { itemCount, countFilledItems } from "../../../milliy-sertifikat/mock-testlar/js/scoring.js";
import { fetchOverlay, applyOverlay } from "../../../milliy-sertifikat/mock-testlar/js/i18n-content.js";
import { t } from "../core/i18n.js";
import * as ss from "../../../milliy-sertifikat/mock-testlar/js/session-service.js";

const BASE = new URL("../../../milliy-sertifikat/mock-testlar/", import.meta.url);
const resolve = (p) => new URL(p, BASE).href;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/№/g, " ").replace(/\s+/g, " ").trim();

const state = { tests: [], uid: null, query: "", sessions: [], practice: [], myAttempts: [] };

const fmtDate = (ms) => ss.fmtTashkent(ms, { year: false });
const comma = (v) => (Number.isFinite(Number(v)) ? String(Math.round(Number(v) * 100) / 100).replace(".", ",") : "—");

/**
 * Yopiq rejim (sessiyalar): { kind, label, tone, href, open } yoki null.
 *   open — ochiq sessiya; mine — foydalanuvchi qatnashgan (natija kutilmoqda / e'lon qilingan); upcoming — keyingi sessiya.
 */
function sessionInfo(test) {
  const list = state.sessions.filter((s) => s.testId === test.id);
  const open = list.find((s) => ss.sessionPhase(s) === "open");
  const mine = state.myAttempts.filter((a) => a.testId === test.id)
    .map((a) => ({ a, s: list.find((s) => s.id === a.sessionId) })).filter((x) => x.s)
    .sort((x, y) => ss.toMs(y.s.opensAt) - ss.toMs(x.s.opensAt));
  const href = (s) => `test.html?id=${encodeURIComponent(test.id)}&session=${encodeURIComponent(s.id)}`;
  if (open) {
    const my = mine.find((x) => x.s.id === open.id);
    if (my && my.a.status !== "in_progress") return { kind: "pending", label: "Topshirildi • natija kutilmoqda", tone: "blue", href: href(open), cta: "Holatni ko‘rish" };
    return { kind: "open", label: `Ochiq • ${fmtDate(ss.toMs(open.closesAt))} gacha`, tone: "green", href: href(open), cta: my ? "Davom ettirish" : "Testni boshlash", open: true };
  }
  if (mine.length) {
    const { a, s } = mine[0];
    if (a.status === "published" && a.result) return { kind: "published", label: `Natija: ${comma(a.result.score)} ball${a.result.level ? ` • ${a.result.level}` : ""}`, tone: "green", href: href(s), cta: "Natijani ko‘rish" };
    return { kind: "pending", label: "Natija kutilmoqda", tone: "blue", href: href(s), cta: "Holatni ko‘rish" };
  }
  const up = list.filter((s) => ss.sessionPhase(s) === "upcoming").sort((x, y) => ss.toMs(x.opensAt) - ss.toMs(y.opensAt))[0];
  if (up) return { kind: "upcoming", label: `Ochiladi: ${fmtDate(ss.toMs(up.opensAt))}`, tone: "orange", href: `test.html?id=${encodeURIComponent(test.id)}`, cta: "Batafsil" };
  return null;
}

/** Qurilmadagi urinish holati (eski catalog.js bilan bir xil qoidalar). */
function attemptStatus(test) {
  if (!state.uid) return null;
  const saved = loadState(test.id, state.uid);
  if (!saved || !saved.attemptId) return null;
  if (saved.submitted) return { kind: "done", label: t("ms.card.done", "Yakunlangan") };
  if (Date.now() < saved.deadlineTs) {
    const n = countFilledItems(test.questions, saved.answers || {});
    return { kind: "progress", label: t("ms.card.progress", `Davom etmoqda • ${n}/${itemCount(test.questions)}`, { a: n, b: itemCount(test.questions) }) };
  }
  return { kind: "expired", label: t("ms.card.expired", "Vaqti tugagan") };
}

function card(test) {
  const total = test.questions.length;
  const mcq = test.questions.filter((q) => q.type === "mcq").length;
  const bands = itemCount(test.questions);
  const sess = sessionInfo(test);
  const practice = state.practice.includes(test.id);
  const local = attemptStatus(test);
  // Yopiq rejim: sessiya holati ustun; aks holda erkin mashq yoki avvalgi (saqlangan) mashq natijasi; qolgani — yopiq.
  let st = sess || (practice ? local : local?.kind === "done" ? local : null);
  if (!st && !practice) st = { kind: "closed", label: "Yopiq" };
  if (practice && !sess) st = st ? { ...st, label: `Mashq • ${st.label}` } : { kind: "practice", label: "Erkin mashq" };
  const href = sess?.href || `test.html?id=${encodeURIComponent(test.id)}`;
  const saved = state.uid ? loadState(test.id, state.uid) : null;
  const label = !state.uid ? t("ms.card.login", "Kirish va boshlash")
    : sess ? sess.cta
      : saved?.submitted ? t("ms.card.result", "Natijani ko‘rish")
        : !practice ? "Batafsil"
          : saved && saved.attemptId ? t("ms.card.resume", "Davom ettirish") : t("ms.card.start", "Testni boshlash");
  const tone = st?.tone || (st?.kind === "done" ? "green" : st?.kind === "progress" ? "blue" : st?.kind === "closed" ? "gray" : "orange");
  const search = [test.title, `mock test ${test.number}`, test.number, test.sourceVariant, test.subtitle].join(" ");
  return `
    <li data-search-text="${esc(search)}">
      <article class="of-card of-mock" aria-labelledby="mock-${esc(test.id)}">
        <div class="of-mock__top">
          <span class="of-mock__num">${esc(t("ms.card.num", `Mock test №${test.number}`, { n: test.number }))}</span>
          ${st ? `<span class="of-badge of-badge--${tone}">${esc(st.label)}</span>` : ""}
        </div>
        <h3 class="of-mock__title" id="mock-${esc(test.id)}">${esc(test.title)}</h3>
        ${test.sourceVariant ? `<p class="of-mock__variant">${esc(test.sourceVariant)}</p>` : ""}
        <ul class="of-mock__meta" aria-label="${esc(t("ms.card.meta", "Test tarkibi"))}">
          <li>${t("ms.card.questions", `<b>${total}</b> ta savol`, { n: total })}</li>
          <li>${t("ms.card.minutes", `<b>${esc(test.durationMinutes)}</b> daqiqa`, { n: esc(test.durationMinutes) })}</li>
          <li>${t("ms.card.kinds", `<b>${mcq} + ${total - mcq}</b> test / ochiq`, { a: mcq, b: total - mcq })}</li>
          <li>${t("ms.card.bands", `<b>${bands}</b> ta band`, { n: bands })}</li>
        </ul>
        <a class="of-btn ${st?.kind === "open" || (practice && st?.kind !== "done") ? "of-btn--primary" : "of-btn--soft"} of-mock__cta" href="${esc(href)}" data-mock-start
           aria-label="${esc(`${label}: ${test.title}`)}">${esc(label)} ${icon("arrowRight")}</a>
      </article>
    </li>`;
}

function applyFilter() {
  let visible = 0;
  $$("[data-mock-list] > li").forEach((li) => {
    const ok = !state.query || norm(li.dataset.searchText).includes(state.query);
    li.hidden = !ok;
    if (ok) visible++;
  });
  const total = state.tests.length;
  $("[data-mock-count]").textContent = visible === total ? t("ms.cat.count", `${total} ta test`, { n: total }) : t("ms.cat.countOf", `${visible} / ${total} ta test`, { a: visible, b: total });
  let note = $("[data-mock-list] + .of-search-empty");
  if (!visible) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      note.setAttribute("role", "status");
      $("[data-mock-list]").after(note);
    }
    note.textContent = t("ms.cat.empty", "Qidiruv bo‘yicha mock test topilmadi.");
  } else note?.remove();
  return visible;
}

function setupSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: t("ms.cat.placeholder", "Mock testni qidirish…"),
    label: t("ms.cat.searchLabel", "Mock testlar bo‘yicha qidirish"),
    onQuery: (q) => { state.query = norm(q); return state.tests.length ? applyFilter() : 0; },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

function showError(text) {
  const list = $("[data-mock-list]");
  list.outerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>${esc(text)}</span></div>`;
}

async function init() {
  $$("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  setupSearch();

  const access = await checkMockAccess();
  const hint = $("[data-user-hint]");
  if (access.allowed) {
    state.uid = access.session.uid;
    hint.textContent = t("ms.cat.hintIn", `Siz ${access.session.name} sifatida kirgansiz. Natijalar shu nom bilan saqlanadi.`, { name: access.session.name });
    hint.hidden = false;
  } else if (access.reason === "login") {
    hint.textContent = t("ms.cat.hintLogin", "Testni boshlash uchun saytdagi akkauntingiz bilan kiring — ism va familiya profilingizdan olinadi.");
    hint.hidden = false;
  } else {
    showError(access.reason === "access" ? t("ms.cat.noAccess", "Bu bo‘lim uchun sizda ruxsat mavjud emas.") : t("ms.cat.accessFail", "Ruxsatni tekshirib bo‘lmadi. Sahifani yangilang."));
    return;
  }

  try {
    const catalog = await fetch(resolve(CATALOG_URL), { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Katalog yuklanmadi (${r.status})`);
      return r.json();
    });
    const results = await Promise.allSettled(catalog.tests.map(async (entry) => {
      const [test, overlay] = await Promise.all([
        fetch(resolve(entry.file), { cache: "no-cache" }).then((r) => {
          if (!r.ok) throw new Error(`${entry.file}: ${r.status}`);
          return r.json();
        }),
        fetchOverlay(entry.file),
      ]);
      return applyOverlay(test, overlay);
    }));
    results.filter((r) => r.status === "rejected").forEach((r) => console.error("Test yuklanmadi:", r.reason));
    const [settings, sessions, mine] = await Promise.all([
      ss.getSettings(),
      ss.listSessions().catch((e) => { console.warn("[ms] sessiyalar:", e?.code || e); return []; }),
      state.uid ? ss.listMyAttempts(state.uid).catch((e) => { console.warn("[ms] urinishlar:", e?.code || e); return []; }) : [],
    ]);
    state.practice = settings.practiceTests || [];
    state.sessions = sessions;
    state.myAttempts = mine;
    state.tests = results.filter((r) => r.status === "fulfilled").map((r) => r.value).sort((a, b) => (a.number || 0) - (b.number || 0));
  } catch (error) {
    console.error("Mock testlar katalogini yuklab bo‘lmadi:", error);
    showError(t("ms.cat.loadFail", "Testlarni yuklab bo‘lmadi. Sahifani yangilab ko‘ring."));
    return;
  }

  const rank = (tt) => { const k = sessionInfo(tt)?.kind; return k === "open" ? 0 : k === "pending" || k === "published" ? 1 : k === "upcoming" ? 2 : state.practice.includes(tt.id) ? 3 : 4; };
  state.tests.sort((a, b) => rank(a) - rank(b) || (a.number || 0) - (b.number || 0));
  const list = $("[data-mock-list]");
  list.innerHTML = state.tests.map(card).join("");
  list.removeAttribute("aria-busy");
  if (!state.uid) bindProtectedLinks(list, "a[data-mock-start]");
  applyFilter();
  revealOnScroll(list.children, { maxIndex: 6 });
}

init();
