// ==========================================================================
// Virtual laboratoriyalar — katalog sahifasi (simulations/labs.html)
// Ma'lumot: simulations/data/manifest.json dagi `lab` maydoni bor yozuvlar:
//   'maktab' — darslik laboratoriya ishlari (`grades`: ["7"], ["7","8"] …), 'otm' — oliy ta'lim laboratoriyalari.
// Filtrlar: sinf (Barchasi / 7…11 / OTM, ?sinf= URL da saqlanadi) va bo'lim chiplari; qidiruv — OFShell orqali.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";
import { ART } from "./sim-art.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/\s+/g, " ").trim();

const GRADES = [["", "Barchasi"], ["7", "7-sinf"], ["8", "8-sinf"], ["9", "9-sinf"], ["10", "10-sinf"], ["11", "11-sinf"], ["otm", "Oliy ta’lim"]];
const BADGE = { mexanika: " of-badge--blue", elektr: " of-badge--green", issiqlik: " of-badge--orange", atom: " of-badge--purple", kvant: " of-badge--purple" };
const state = { labs: [], topics: [], grade: "", topic: "", query: "" };

const gradesOf = (s) => (s.lab === "otm" ? ["otm"] : s.grades || []);
const gradeLabel = (s) => (s.lab === "otm" ? "Oliy ta’lim" : `${gradesOf(s).join("–")}-sinf`);

function card(s, topics) {
  const topic = topics.get(s.topic);
  const text = [s.title, s.description, topic?.title, gradeLabel(s), (s.params || []).join(" "), s.keywords].join(" ");
  return `
    <li data-topic="${esc(s.topic)}" data-grades="${esc(gradesOf(s).join(" "))}" data-search-text="${esc(text)}">
      <article class="of-card of-sim-card" data-topic="${esc(s.topic)}">
        <svg class="of-sim-card__art" viewBox="0 0 160 90" aria-hidden="true" focusable="false">${ART[s.id] || ART[s.art] || ""}</svg>
        <div class="of-sim-card__body">
          <p class="of-sim-card__tags"><span class="of-badge${BADGE[s.topic] || ""}">${esc(topic?.title || "")}</span><span class="of-badge">${esc(gradeLabel(s))}</span></p>
          <h3 class="of-sim-card__title">${esc(s.title.replace(/ \(laboratoriya ishi\)$/, ""))}</h3>
          ${s.formula ? `<p class="of-sim-card__formula">${esc(s.formula)}</p>` : ""}
          <p class="of-sim-card__desc">${esc(s.description)}</p>
          ${s.params?.length ? `<p class="of-sim-card__params"><span class="of-sr-only">Asboblar: </span>${s.params.map((p) => `<span>${esc(p)}</span>`).join("")}</p>` : ""}
          <div class="of-sim-card__foot">
            <a class="of-btn of-btn--soft" href="${esc(s.href)}" aria-label="Boshlash: ${esc(s.title)}">Boshlash ${icon("arrowRight")}</a>
          </div>
        </div>
      </article>
    </li>`;
}

function renderGrades() {
  const box = $("[data-grades]");
  box.innerHTML = GRADES.map(([g, t]) => `<button type="button" data-grade="${g}" aria-pressed="${g === state.grade}">${t}</button>`).join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-grade]");
    if (b) setGrade(b.dataset.grade);
  });
  box.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const btns = $$("[data-grade]", box), i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const j = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
    btns[j].focus();
    setGrade(btns[j].dataset.grade);
  });
}

function setGrade(g, { updateUrl = true } = {}) {
  state.grade = GRADES.some(([x]) => x === g) ? g : "";
  $$("[data-grade]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.grade === state.grade)));
  renderChips();
  if (updateUrl) {
    const url = new URL(location.href);
    if (state.grade) url.searchParams.set("sinf", state.grade); else url.searchParams.delete("sinf");
    try { history.replaceState(null, "", url); } catch { /* file:// */ }
  }
  announce(applyFilters());
}

/** Chiplar joriy sinf bo'yicha sanaladi; tanlangan bo'lim bu sinfda bo'lmasa — «Barcha bo'limlar». */
function renderChips() {
  const inGrade = state.labs.filter((s) => !state.grade || gradesOf(s).includes(state.grade));
  const counts = new Map();
  inGrade.forEach((s) => counts.set(s.topic, (counts.get(s.topic) || 0) + 1));
  if (state.topic && !counts.get(state.topic)) state.topic = "";
  const chips = [{ id: "", title: "Barcha bo‘limlar", n: inGrade.length }, ...state.topics.map((t) => ({ ...t, n: counts.get(t.id) || 0 }))].filter((c) => c.n > 0);
  $("[data-chips]").innerHTML = chips
    .map((c) => `<li><button type="button" class="of-chip" data-topic="${esc(c.id)}" aria-pressed="${c.id === state.topic}">${esc(c.title)} <small>${c.n}</small></button></li>`)
    .join("");
}

function applyFilters() {
  let visible = 0;
  $$("[data-sims] > li").forEach((li) => {
    const match = (!state.grade || li.dataset.grades.split(" ").includes(state.grade))
      && (!state.topic || li.dataset.topic === state.topic)
      && (!state.query || norm(li.dataset.searchText).includes(state.query));
    li.hidden = !match;
    if (match) visible++;
  });
  const total = state.labs.length;
  $("[data-sim-count]").textContent = visible === total ? `${total} ta laboratoriya ishi` : `${visible} / ${total} ta laboratoriya ishi`;
  let note = $("[data-sims] + .of-search-empty");
  if (!visible) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      note.setAttribute("role", "status");
      $("[data-sims]").after(note);
    }
    note.textContent = "Bu so‘rov bo‘yicha laboratoriya ishi topilmadi. Boshqa so‘z bilan urinib ko‘ring yoki «Barchasi» ni tanlang.";
  } else note?.remove();
  return visible;
}

function announce(n) {
  const status = document.querySelector("[data-search-status]");
  if (status) status.textContent = `${n} ta laboratoriya ishi ko‘rsatilmoqda`;
}

function setupSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: "Laboratoriya ishini qidirish…",
    label: "Virtual laboratoriyalar bo‘yicha qidirish",
    onQuery: (q) => { state.query = q; return state.labs.length ? applyFilters() : 0; },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

async function init() {
  setupSearch();
  let data;
  try {
    const res = await fetch(new URL("data/manifest.json", location.href), { cache: "no-cache" });
    if (!res.ok) throw new Error(`manifest.json ${res.status}`);
    data = await res.json();
  } catch (error) {
    console.error("[laboratoriyalar] ro'yxat yuklanmadi:", error);
    $("[data-sims]").outerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Laboratoriyalar ro‘yxatini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
    return;
  }
  // Tartib: maktab ishlari sinf bo'yicha (manifestdagi tartib saqlanadi), so'ng oliy ta'lim laboratoriyalari
  const rank = (s) => (s.lab === "otm" ? 99 : Math.min(...gradesOf(s).map(Number)));
  state.labs = data.simulations.filter((s) => s.lab).map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
  state.topics = data.topics;
  const topics = new Map(data.topics.map((t) => [t.id, t]));
  const list = $("[data-sims]");
  list.innerHTML = state.labs.map((s) => card(s, topics)).join("");
  list.removeAttribute("aria-busy");
  renderGrades();
  $("[data-chips]").addEventListener("click", (e) => {
    const b = e.target.closest(".of-chip");
    if (!b) return;
    state.topic = b.dataset.topic;
    $$(".of-chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    announce(applyFilters());
  });
  setGrade(new URLSearchParams(location.search).get("sinf") || "", { updateUrl: false });
  revealOnScroll(list.children, { maxIndex: 6 });
}

init();
