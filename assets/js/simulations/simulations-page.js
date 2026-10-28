// ==========================================================================
// Simulyatsiyalar — katalog sahifasi (simulations/simulations.html)
// Ma'lumot: simulations/data/manifest.json va data/curriculum.json (darsliklar mundarijasi).
// Simulyatsiya kodlari (canvas dvigatellari) bu sahifada YUKLANMAYDI — faqat havolalar.
// Ko'rinish: «Barchasi» — mavzu chiplari + kartochkalar to'ri; «7-sinf»…«11-sinf» — darslik mundarijasi
// bob-bob, har mavzuda kerakli preset bilan «Ochish» (?sinf=8 URL da saqlanadi).
// Qidiruv: nom, tavsif, mavzu, parametrlar va kalit so'zlar; sinf ichida — raqam, mavzu va simulyatsiya nomi.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";
import { ART } from "./sim-art.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/\s+/g, " ").trim();

const state = { data: null, all: [], curriculum: null, grade: "", topic: "", query: "" };
const GRADES = ["7", "8", "9", "10", "11"];


function hydrateIcons(r = document) {
  $$("[data-icon]", r).forEach((el) => { if (!el.dataset.iconDone) { el.innerHTML = icon(el.dataset.icon); el.dataset.iconDone = "1"; } });
}

function card(sim, topics) {
  const topic = topics.get(sim.topic);
  const text = [sim.title, sim.description, topic?.title, (sim.params || []).join(" "), sim.keywords].join(" ");
  return `
    <li data-topic="${esc(sim.topic)}" data-search-text="${esc(text)}">
      <article class="of-card of-sim-card" data-topic="${esc(sim.topic)}">
        <svg class="of-sim-card__art" viewBox="0 0 160 90" aria-hidden="true" focusable="false">${ART[sim.id] || ART[sim.art] || ""}</svg>
        <div class="of-sim-card__body">
          <span class="of-badge${sim.topic === "mexanika" ? " of-badge--blue" : sim.topic === "elektr" ? " of-badge--green" : sim.topic === "issiqlik" ? " of-badge--orange" : sim.topic === "atom" || sim.topic === "kvant" ? " of-badge--purple" : ""}">${esc(topic?.title || "")}</span>
          <h3 class="of-sim-card__title">${esc(sim.title)}</h3>
          <p class="of-sim-card__desc">${esc(sim.description)}</p>
          ${sim.params?.length ? `<p class="of-sim-card__params"><span class="of-sr-only">Parametrlar: </span>${sim.params.map((p) => `<span>${esc(p)}</span>`).join("")}</p>` : ""}
          <div class="of-sim-card__foot">
            <a class="of-btn of-btn--soft" href="${esc(sim.href)}" aria-label="Boshlash: ${esc(sim.title)}">Boshlash ${icon("arrowRight")}</a>
          </div>
        </div>
      </article>
    </li>`;
}

function renderChips() {
  const counts = new Map();
  state.data.simulations.forEach((s) => counts.set(s.topic, (counts.get(s.topic) || 0) + 1));
  // Faqat simulyatsiyasi bor mavzular ko'rsatiladi
  const chips = [{ id: "", title: "Barcha bo‘limlar", n: state.data.simulations.length }, ...state.data.topics.map((t) => ({ ...t, n: counts.get(t.id) || 0 }))]
    .filter((c) => c.n > 0);
  const box = $("[data-chips]");
  box.innerHTML = chips
    .map((c) => `<li><button type="button" class="of-chip" data-topic="${esc(c.id)}" aria-pressed="${c.id === state.topic}">${esc(c.title)} <small>${c.n}</small></button></li>`)
    .join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".of-chip");
    if (!b) return;
    state.topic = b.dataset.topic;
    $$(".of-chip", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const n = applyFilters();
    announce(n);
  });
}

function renderList() {
  const topics = new Map(state.data.topics.map((t) => [t.id, t]));
  const list = $("[data-sims]");
  list.innerHTML = state.data.simulations.map((s) => card(s, topics)).join("");
  list.removeAttribute("aria-busy");
  applyFilters();
  revealOnScroll(list.children, { maxIndex: 6 });
}

function announce(n) {
  const status = document.querySelector("[data-search-status]");
  if (status) status.textContent = state.grade ? `${n} ta mavzu ko‘rsatilmoqda` : `${n} ta simulyatsiya ko‘rsatilmoqda`;
}

/* ------------------------------------------------------------------ Sinflar (darslik mundarijasi) */

function renderGrades() {
  const box = $("[data-grades]");
  box.innerHTML = [["", "Barchasi"], ...GRADES.map((g) => [g, `${g}-sinf`])]
    .map(([g, t]) => `<button type="button" data-grade="${g}" aria-pressed="${g === state.grade}">${t}</button>`)
    .join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-grade]");
    if (b) setGrade(b.dataset.grade);
  });
  // Klaviatura: ← → bilan qo'shni sinfga o'tish (Tab bilan ham har tugmaga boriladi)
  box.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    const btns = $$("[data-grade]", box);
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const j = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
    btns[j].focus();
    setGrade(btns[j].dataset.grade);
  });
}

function setGrade(g, { updateUrl = true } = {}) {
  state.grade = GRADES.includes(g) ? g : "";
  $$("[data-grade]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.grade === state.grade)));
  $("[data-chips]").hidden = !!state.grade;
  $("[data-sims]").hidden = !!state.grade;
  $("[data-sims] + .of-search-empty")?.remove();
  const toc = $("[data-toc]");
  toc.hidden = !state.grade;
  if (state.grade) renderToc(); else toc.innerHTML = "";
  if (updateUrl) {
    const url = new URL(location.href);
    if (state.grade) url.searchParams.set("sinf", state.grade); else url.searchParams.delete("sinf");
    try { history.replaceState(null, "", url); } catch { /* file:// */ }
  }
  setupSearch();
  announce(applyFilters());
}

const simHref = (sim, preset) => sim.href + (preset ? `?preset=${encodeURIComponent(preset)}` : "");

/** Mavzu qatori: qaysi havola ochiladi va qanday ko'rinadi. null — qator ko'rsatilmaydi. */
function rowOf(m, sims) {
  if (m.tur === "matn") return null;
  const sim = m.sim ? sims.get(m.sim) : null;
  if (m.tur === "masala" && !sim) return null;
  if (m.tur === "lab") {
    const lab = m.lab ? sims.get(m.lab) : null;
    if (lab) return { kind: "lab", href: lab.href, target: lab };
    if (sim) return { kind: "lab", href: simHref(sim, m.preset), target: sim, note: "Laboratoriya varianti tayyorlanmoqda — hozircha oddiy simulyatsiya ochiladi" };
    return { kind: "lab", href: null, note: "Laboratoriya ishi tayyorlanmoqda" };
  }
  if (sim) return { kind: "sim", href: simHref(sim, m.preset), target: sim };
  return { kind: "sim", href: null, note: "Simulyatsiya tayyorlanmoqda" };
}

function renderToc() {
  const toc = $("[data-toc]");
  if (!state.curriculum) {
    toc.innerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Darsliklar mundarijasini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
    return;
  }
  const g = state.curriculum.sinflar.find((x) => String(x.sinf) === state.grade);
  const sims = new Map(state.all.map((s) => [s.id, s]));
  let shown = 0, linked = 0;
  const bobs = g.boblar.map((bob) => {
    const rows = bob.mavzular.map((m) => {
      const r = rowOf(m, sims);
      if (!r) return "";
      shown++;
      if (r.href) linked++;
      const label = `${m.raqam}. ${m.nom}`;
      const text = [m.raqam, `${m.raqam}-mavzu`, m.nom, r.target?.title, r.kind === "lab" ? "laboratoriya ishi" : "simulyatsiya"].join(" ");
      const badge = r.kind === "lab" ? `<span class="of-badge of-badge--green">Laboratoriya ishi</span>` : `<span class="of-badge of-badge--blue">Simulyatsiya</span>`;
      const action = r.href
        ? `<a class="of-btn of-btn--soft of-btn--sm" href="${esc(r.href)}" aria-label="Ochish: ${esc(label)} — ${esc(r.target.title)}">Ochish ${icon("arrowRight")}</a>`
        : `<span class="of-btn of-btn--sm of-toc__wait" aria-disabled="true">Tayyorlanmoqda</span>`;
      return `
        <li class="of-toc__row${r.href ? "" : " is-wait"}" data-search-text="${esc(text)}">
          <span class="of-toc__num" aria-hidden="true">${m.raqam}</span>
          <div class="of-toc__main">
            <span class="of-toc__name"><span class="of-sr-only">${m.raqam}-mavzu. </span>${esc(m.nom)}${m.taxminiy ? ` <small class="of-toc__guess" title="Nomi darslik PDF idan tekshirilmoqda">taxminiy nom</small>` : ""}</span>
            ${r.target ? `<span class="of-toc__sim">${esc(r.target.title)}</span>` : ""}
            ${r.note ? `<span class="of-toc__note">${esc(r.note)}</span>` : ""}
          </div>
          <span class="of-toc__badge">${badge}</span>
          <span class="of-toc__act">${action}</span>
        </li>`;
    }).join("");
    if (!rows) return "";
    return `
      <section class="of-toc__bob">
        <h3 class="of-toc__bob-title">${esc(bob.nom)}</h3>
        <ol class="of-toc__list" role="list">${rows}</ol>
      </section>`;
  }).join("");
  toc.innerHTML = `
    <div class="of-toc__head">
      <h2 class="of-toc__title">${g.sinf}-sinf fizika darsligi</h2>
      <p class="of-toc__meta">${g.nashr}-yil nashri · ${esc(g.fan)} · ${shown} ta mavzudan ${linked} tasi ochiladi</p>
      <p class="of-toc__hint of-subtle">Mavzu raqami va nomi darslikdagidek; boblar mavzular bo‘yicha guruhlangan. «Ochish» simulyatsiyani shu mavzuga mos tayyor tajriba bilan ochadi.</p>
    </div>
    ${bobs}`;
  hydrateIcons(toc);
}

function applyTocFilter() {
  let visible = 0;
  $$("[data-toc] .of-toc__bob").forEach((bob) => {
    let n = 0;
    $$(".of-toc__row", bob).forEach((li) => {
      const match = !state.query || norm(li.dataset.searchText).includes(state.query);
      li.hidden = !match;
      if (match) n++;
    });
    bob.hidden = !n;
    visible += n;
  });
  const total = $$("[data-toc] .of-toc__row").length;
  $("[data-sim-count]").textContent = state.query && visible !== total ? `${visible} / ${total} ta mavzu` : `${total} ta mavzu`;
  let note = $("[data-toc] .of-search-empty");
  if (!visible && total) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      note.setAttribute("role", "status");
      $("[data-toc]").append(note);
    }
    note.textContent = "Bu sinf darsligida bunday mavzu topilmadi. Boshqa so‘z bilan urinib ko‘ring yoki «Barchasi» ni tanlang.";
  } else note?.remove();
  return visible;
}

function applyFilters() {
  if (state.grade) return applyTocFilter();
  let visible = 0;
  $$("[data-sims] > li").forEach((li) => {
    const match = (!state.topic || li.dataset.topic === state.topic) && (!state.query || norm(li.dataset.searchText).includes(state.query));
    li.hidden = !match;
    if (match) visible++;
  });
  const total = state.data.simulations.length;
  $("[data-sim-count]").textContent = visible === total ? `${total} ta simulyatsiya` : `${visible} / ${total} ta simulyatsiya`;
  let note = $("[data-sims] + .of-search-empty");
  if (!visible) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      note.setAttribute("role", "status");
      $("[data-sims]").after(note);
    }
    note.textContent = "Bu so‘rov bo‘yicha simulyatsiya topilmadi. Boshqa so‘z bilan urinib ko‘ring.";
  } else note?.remove();
  return visible;
}

function setupSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: state.grade ? `${state.grade}-sinf mavzularidan qidirish…` : "Simulyatsiyani qidirish…",
    label: state.grade ? `${state.grade}-sinf darsligi mavzulari bo‘yicha qidirish` : "Simulyatsiyalar bo‘yicha qidirish",
    onQuery: (q) => { state.query = q; return state.data ? applyFilters() : 0; },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

async function init() {
  hydrateIcons();
  setupSearch();
  const load = async (name) => {
    const res = await fetch(new URL(`data/${name}`, location.href), { cache: "no-cache" });
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return res.json();
  };
  const curriculum = load("curriculum.json").catch((error) => { console.error("[simulyatsiyalar] mundarija yuklanmadi:", error); return null; });
  try {
    state.data = await load("manifest.json");
  } catch (error) {
    console.error("[simulyatsiyalar] ro'yxat yuklanmadi:", error);
    $("[data-sims]").outerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Simulyatsiyalar ro‘yxatini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
    return;
  }
  state.all = state.data.simulations;
  state.data = { ...state.data, simulations: state.all.filter((s) => s.lab !== "maktab") };
  state.curriculum = await curriculum;
  renderGrades();
  renderChips();
  renderList();
  const g = new URLSearchParams(location.search).get("sinf");
  if (GRADES.includes(g)) setGrade(g, { updateUrl: false });
}

init();
