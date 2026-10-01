// ==========================================================================
// Simulyatsiyalar — katalog sahifasi (simulations/simulations.html)
// Ma'lumot: simulations/data/manifest.json (bitta kichik fayl).
// Simulyatsiya kodlari (canvas dvigatellari) bu sahifada YUKLANMAYDI — faqat havolalar.
// Qidiruv: nom, tavsif, mavzu, parametrlar va kalit so'zlar. Filtr: mavzu chiplari.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/\s+/g, " ").trim();

const state = { data: null, topic: "", query: "" };

// Sxematik chizmalar (bezak; ekran o'quvchilardan yashirilgan). viewBox 160×90.
// .a — asosiy (ko'k), .b — ikkinchi (yashil), .m — yordamchi chiziq.
const ART = {
  projectile: '<path class="m" d="M14 76h134M14 76V12"/><path class="a" d="M16 76C44 8 96 8 124 76" stroke-dasharray="4 5"/><circle class="b f" cx="98" cy="30" r="5"/>',
  pendulum: '<path class="m" d="M52 12h56"/><path class="a" d="M80 12 104 66"/><circle class="b f" cx="104" cy="66" r="8"/><path class="m" d="M80 12v58" stroke-dasharray="3 4"/><path class="m" d="M56 64a30 30 0 0 0 48 2"/>',
  spring: '<path class="m" d="M18 22v50M18 72h130"/><path class="a" d="M18 47h10l5-10 8 20 8-20 8 20 8-20 8 20 5-10h8"/><rect class="b f" x="96" y="33" width="30" height="28" rx="5"/>',
  "circular-motion": '<circle class="m" cx="80" cy="45" r="30" stroke-dasharray="4 5"/><circle class="m f" cx="80" cy="45" r="2.5"/><path class="a" d="M80 45 101 24"/><circle class="b f" cx="101" cy="24" r="6"/><path class="a" d="M101 24l20 20"/>',
  "vertical-motion": '<path class="m" d="M40 78h80M60 78V12"/><path class="a" d="M80 74V20" stroke-dasharray="4 5"/><path class="a" d="m73 28 7-10 7 10"/><circle class="b f" cx="80" cy="46" r="6"/>',
  "gravity-law": '<circle class="a f" cx="48" cy="45" r="16"/><circle class="b f" cx="118" cy="45" r="9"/><path class="m" d="M68 45h38"/><path class="m" d="m74 40-6 5 6 5M100 40l6 5-6 5"/>',
  "newton-second-law": '<path class="m" d="M14 70h132"/><rect class="b f" x="60" y="42" width="34" height="28" rx="4"/><path class="a" d="M94 56h36"/><path class="a" d="m124 50 8 6-8 6"/>',
  "inclined-plane": '<path class="m" d="M18 76h128L18 22Z"/><rect class="b f" x="54" y="30" width="22" height="18" rx="3" transform="rotate(22.9 65 39)"/><path class="a" d="M110 70a22 22 0 0 0-4-10"/>',
  "coulomb-law": '<circle class="a f" cx="46" cy="45" r="13"/><circle class="b f" cx="114" cy="45" r="13"/><path class="w" d="M40 45h12M46 39v12M108 45h12"/><path class="m" d="M64 45h32" stroke-dasharray="3 4"/>',
  "ohm-law": '<path class="m" d="M30 22h100v48H30Z"/><path class="a" d="M62 22v-6l6 12 6-12 6 12 6-12 6 12v-6"/><path class="b" d="M30 38v16M24 42v8"/><circle class="a f" cx="110" cy="70" r="3"/><circle class="a f" cx="70" cy="70" r="3"/>',
  lorentz: '<g class="m f"><circle cx="30" cy="22" r="1.8"/><circle cx="60" cy="22" r="1.8"/><circle cx="90" cy="22" r="1.8"/><circle cx="120" cy="22" r="1.8"/><circle cx="30" cy="68" r="1.8"/><circle cx="60" cy="68" r="1.8"/><circle cx="90" cy="68" r="1.8"/><circle cx="120" cy="68" r="1.8"/></g><path class="a" d="M14 45h40a24 24 0 1 0 24-24"/><circle class="b f" cx="54" cy="45" r="5"/>',
  "refraction-law": '<path class="m" d="M14 45h132"/><rect class="m f o" x="14" y="45" width="132" height="36"/><path class="m" d="M80 8v74" stroke-dasharray="3 4"/><path class="a" d="M44 10 80 45"/><path class="b" d="M80 45l22 36"/>',
};

function hydrateIcons(r = document) {
  $$("[data-icon]", r).forEach((el) => { if (!el.dataset.iconDone) { el.innerHTML = icon(el.dataset.icon); el.dataset.iconDone = "1"; } });
}

function card(sim, topics) {
  const topic = topics.get(sim.topic);
  const text = [sim.title, sim.description, topic?.title, (sim.params || []).join(" "), sim.keywords].join(" ");
  return `
    <li data-topic="${esc(sim.topic)}" data-search-text="${esc(text)}">
      <article class="of-card of-sim-card" data-topic="${esc(sim.topic)}">
        <svg class="of-sim-card__art" viewBox="0 0 160 90" aria-hidden="true" focusable="false">${ART[sim.id] || ""}</svg>
        <div class="of-sim-card__body">
          <span class="of-badge${sim.topic === "mexanika" ? " of-badge--blue" : sim.topic === "elektr" ? " of-badge--green" : ""}">${esc(topic?.title || "")}</span>
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
  const chips = [{ id: "", title: "Barchasi", n: state.data.simulations.length }, ...state.data.topics.map((t) => ({ ...t, n: counts.get(t.id) || 0 }))]
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
  if (status) status.textContent = `${n} ta simulyatsiya ko‘rsatilmoqda`;
}

function applyFilters() {
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
    placeholder: "Simulyatsiyani qidirish…",
    label: "Simulyatsiyalar bo‘yicha qidirish",
    onQuery: (q) => { state.query = q; return state.data ? applyFilters() : 0; },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

async function init() {
  hydrateIcons();
  setupSearch();
  try {
    const res = await fetch(new URL("data/manifest.json", location.href), { cache: "no-cache" });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    state.data = await res.json();
  } catch (error) {
    console.error("[simulyatsiyalar] ro'yxat yuklanmadi:", error);
    $("[data-sims]").outerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Simulyatsiyalar ro‘yxatini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
    return;
  }
  renderChips();
  renderList();
}

init();
