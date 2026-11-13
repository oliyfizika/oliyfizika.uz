// ==========================================================================
// Bosh sahifa: «Milliy sertifikat — bepul mock testlar» karuseli (3D kartochkalar, o'rtadagisi faol).
// • Kartochkalar HTML'da (index.html) — Firestore/tarmoq so'rovi yo'q, tashqi kutubxona yo'q.
// • Har kartochka mock testga olib boradi; mehmonga kirish oynasi home.js dagi data-protected orqali.
// • Yon kartochka bosilsa — o'rtaga keladi (havola ochilmaydi). Nuqtalar, ← → tugmalari, surish (swipe).
// • Bitta setInterval; sahifa yashirin / sichqoncha yoki fokus karusel ustida / pauza bosilsa — to'xtaydi.
// • pagehide da tozalanadi; prefers-reduced-motion: animatsiyasiz va sekinroq.
// ==========================================================================
import { t } from "../core/i18n.js";

const root = document.querySelector("[data-promo]");

function mount(el) {
  const cards = [...el.querySelectorAll("[data-cf-card]")];
  const stage = el.querySelector("[data-cf]");
  const dots = el.querySelector("[data-promo-dots]");
  const pauseBtn = el.querySelector("[data-promo-pause]");
  const live = el.querySelector("[data-cf-live]");
  const n = cards.length;
  if (!stage || n < 2) return null;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const period = () => (reduce?.matches ? 7000 : 5000);
  let i = 0;
  let timer = null;
  let userPaused = false;
  let hover = false;

  dots.innerHTML = cards.map((c, k) => {
    const title = c.querySelector(".of-cf__title")?.textContent.trim() || "";
    return `<li><button type="button" aria-label="${t("home.promoGo", "{n}-kartochka", { n: k + 1 })}: ${title}"></button></li>`;
  }).join("");
  const dotBtns = [...dots.querySelectorAll("button")];

  // Aylana bo'yicha nisbiy o'rin: -2 … 2 (qolganlari yashirin).
  const rel = (k) => {
    let d = (k - i) % n;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  function paint(announce = false) {
    cards.forEach((c, k) => {
      const d = rel(k);
      c.dataset.pos = Math.abs(d) <= 2 ? String(d) : "far";
      const active = d === 0;
      c.setAttribute("aria-hidden", String(!active));
      const link = c.querySelector("a");
      if (link) link.tabIndex = active ? 0 : -1;
    });
    dotBtns.forEach((b, k) => {
      b.classList.toggle("is-active", k === i);
      b.setAttribute("aria-current", k === i ? "true" : "false");
    });
    if (announce && live) live.textContent = cards[i].querySelector(".of-cf__title")?.textContent.trim() || "";
  }

  function go(next, announce = true) {
    i = ((next % n) + n) % n;
    paint(announce);
  }

  const running = () => timer !== null;
  function start() {
    if (running() || userPaused || hover || document.hidden) return;
    timer = setInterval(() => go(i + 1, false), period());
  }
  function stop() { clearInterval(timer); timer = null; }
  function sync() { (userPaused || hover || document.hidden) ? stop() : start(); }
  function restart() { stop(); sync(); }

  // Yon kartochka bosilsa — o'rtaga olib kelinadi (havola ham, kirish oynasi ham ochilmaydi).
  let swiped = false;
  stage.addEventListener("click", (e) => {
    const card = e.target.closest("[data-cf-card]");
    if (!card) return;
    if (swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; return; }
    const k = cards.indexOf(card);
    if (k !== i) {
      e.preventDefault();
      e.stopPropagation();
      go(k);
      restart();
    }
  });

  // Surish (sensorli ekran va sichqoncha).
  let x0 = null;
  stage.addEventListener("pointerdown", (e) => { x0 = e.clientX; swiped = false; });
  stage.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) { swiped = true; go(dx < 0 ? i + 1 : i - 1); restart(); }
  });
  stage.addEventListener("pointercancel", () => { x0 = null; });

  dotBtns.forEach((b, k) => b.addEventListener("click", () => { go(k); restart(); }));
  el.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (!el.contains(document.activeElement) || e.target.closest("input, textarea")) return;
    e.preventDefault();
    go(e.key === "ArrowRight" ? i + 1 : i - 1);
    // Fokus nuqtada bo'lsa — faol nuqtaga o'tadi; kartochkada bo'lsa — yangi faol kartochkaga.
    if (e.target.closest("[data-promo-dots]")) dotBtns[i].focus();
    else if (e.target.closest("[data-cf-card]")) cards[i].querySelector("a")?.focus();
  });

  pauseBtn?.addEventListener("click", () => {
    userPaused = !userPaused;
    pauseBtn.setAttribute("aria-pressed", String(userPaused));
    pauseBtn.setAttribute("aria-label", userPaused
      ? t("home.promoResume", "Kartochkalar almashinuvini davom ettirish")
      : t("home.promoPause", "Kartochkalar almashinuvini to‘xtatish"));
    sync();
  });
  const enter = () => { hover = true; sync(); };
  const leave = () => { hover = el.matches(":hover") || el.contains(document.activeElement); sync(); };
  el.addEventListener("mouseenter", enter);
  el.addEventListener("mouseleave", leave);
  el.addEventListener("focusin", enter);
  el.addEventListener("focusout", () => setTimeout(leave, 0));
  const onVis = () => sync();
  document.addEventListener("visibilitychange", onVis);
  const onHide = () => stop();
  const onShow = (e) => { if (e.persisted) sync(); };
  window.addEventListener("pagehide", onHide);
  window.addEventListener("pageshow", onShow);
  const destroy = () => {
    onHide();
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pagehide", onHide);
    window.removeEventListener("pageshow", onShow);
  };

  paint();
  el.classList.add("is-ready");
  start();
  return { destroy, go, get index() { return i; }, get running() { return running(); } };
}

if (root) {
  try { window.__ofPromo = mount(root); } catch (error) { console.error("[home] promo:", error); }
}
