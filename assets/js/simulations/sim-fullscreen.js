// ==========================================================================
// OliyFizika.uz — simulyatsiya sahnasi uchun «To‘liq ekran» tugmasi
// - Har bir `.sim-stage` (simulyatsiya va laboratoriya sahifalari) asboblar qatoriga tugma qo‘shadi.
// - Fullscreen API (prefiksli webkit varianti ham); API bo‘lmasa (iPhone Safari) — CSS fallback
//   (`position: fixed` bilan butun oynani egallaydi), Esc yoki «Chiqish» tugmasi bilan chiqiladi.
// - Sahna o‘lchami `createStage` (sim-kit.js) da `fullscreenHeight()` orqali qayta hisoblanadi.
// - app-shell.js `body.of-sim-page` sahifalarida avtomatik yuklaydi — sahifalarni alohida tahrirlash shart emas.
// ==========================================================================

const FS_CLASS = "is-fs";
const PSEUDO_CLASS = "is-fs-pseudo";
const LOCK_CLASS = "of-sim-fs-lock";

const ICON_ENTER = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_EXIT = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
const TEXT_ENTER = "To‘liq ekran";
const TEXT_EXIT = "Chiqish";

const nativeElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const canNative = (el) => !!(el.requestFullscreen || el.webkitRequestFullscreen) &&
  (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true);

let pseudoStage = null;

function setButton(stage, on) {
  const btn = stage.querySelector("[data-sim-fs]");
  if (!btn) return;
  btn.innerHTML = `${on ? ICON_EXIT : ICON_ENTER}<span class="sim-fs-btn__text">${on ? TEXT_EXIT : TEXT_ENTER}</span>`;
  const label = on ? "To‘liq ekrandan chiqish (Esc)" : "Sahnani to‘liq ekranga yoyish";
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", label);
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function mark(stage, on) {
  stage.classList.toggle(FS_CLASS, on);
  setButton(stage, on);
  // Sahna o‘lchamini qayta hisoblash: ResizeObserver o‘zi ham sezadi, lekin `height(w)` funksiyalari window resize’ni kutadi.
  requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
}

function enterPseudo(stage) {
  pseudoStage = stage;
  stage.classList.add(PSEUDO_CLASS);
  document.documentElement.classList.add(LOCK_CLASS);
  mark(stage, true);
}

function exitPseudo() {
  const stage = pseudoStage;
  if (!stage) return;
  pseudoStage = null;
  stage.classList.remove(PSEUDO_CLASS);
  document.documentElement.classList.remove(LOCK_CLASS);
  mark(stage, false);
}

async function toggle(stage) {
  if (pseudoStage === stage) { exitPseudo(); return; }
  if (nativeElement() === stage) {
    try { await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.()); } catch { /* ignore */ }
    return;
  }
  if (canNative(stage)) {
    try {
      await (stage.requestFullscreen ? stage.requestFullscreen({ navigationUI: "hide" }) : stage.webkitRequestFullscreen());
      return;
    } catch { /* rad etildi — CSS fallback */ }
  }
  enterPseudo(stage);
}

function onNativeChange() {
  const cur = nativeElement();
  document.querySelectorAll(`.sim-stage.${FS_CLASS}`).forEach((s) => {
    if (s !== cur && s !== pseudoStage) mark(s, false);
  });
  if (cur && cur.matches?.(".sim-stage") && !cur.classList.contains(FS_CLASS)) mark(cur, true);
}

function attach(stage) {
  if (stage.dataset.simFsReady) return;
  if (!stage.querySelector(".sim-canvas-wrap")) return;
  stage.dataset.simFsReady = "1";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "of-btn of-btn--sm sim-fs-btn";
  btn.dataset.simFs = "";
  btn.addEventListener("click", () => toggle(stage));

  const bar = stage.querySelector(".sim-toolbar");
  if (bar) bar.appendChild(btn);
  else { btn.classList.add("sim-fs-btn--float"); stage.querySelector(".sim-canvas-wrap").appendChild(btn); }
  setButton(stage, false);
}

function scan(root = document) {
  root.querySelectorAll?.(".sim-stage").forEach(attach);
}

export function initSimFullscreen() {
  if (initSimFullscreen.done) return;
  initSimFullscreen.done = true;
  scan();
  // Laboratoriya sahifalari (lab-core.js) sahnani keyinroq yaratadi.
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches(".sim-stage")) attach(n); else scan(n);
    }
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener("fullscreenchange", onNativeChange);
  document.addEventListener("webkitfullscreenchange", onNativeChange);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pseudoStage) { e.preventDefault(); exitPseudo(); }
  });
}

initSimFullscreen();
