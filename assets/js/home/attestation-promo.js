// ==========================================================================
// Bosh sahifa: «Attestatsiya — Fizika» kurs banneri — xabarlar ketma-ket almashadi (bitta matn elementi, DOM qayta
// chizilmaydi). CTA (Telegram) o'zgarmaydi. Firestore/tarmoq so'rovi yo'q, tashqi kutubxona yo'q.
// • Bitta setInterval; sahifa yashirin bo'lsa / sichqoncha yoki fokus banner ustida bo'lsa / pauza bosilsa — to'xtaydi.
// • pagehide da tozalanadi (taymer sahifadan chiqqandan keyin ishlamaydi).
// • prefers-reduced-motion: animatsiyasiz almashadi (CSS) va sekinroq.
// • Ekran o'quvchi uchun barcha xabarlar sr-only ro'yxatda; aylanayotgan matn aria-hidden (har 4 s e'lon qilinmaydi).
// ==========================================================================
const root = document.querySelector("[data-promo]");

function mount(el) {
  const msg = el.querySelector("[data-promo-msg]");
  const dots = el.querySelector("[data-promo-dots]");
  const pauseBtn = el.querySelector("[data-promo-pause]");
  const items = [...el.querySelectorAll("[data-promo-list] li")].map((li) => li.textContent.trim()).filter(Boolean);
  if (!msg || items.length < 2) return null;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const period = () => (reduce?.matches ? 6000 : 4000);
  let i = Math.max(0, items.indexOf(msg.textContent.trim()));
  let timer = null;
  let swapTimer = null;
  let userPaused = false;
  let hover = false;

  dots.innerHTML = items.map(() => "<li></li>").join("");
  const paintDots = () => [...dots.children].forEach((d, k) => d.classList.toggle("is-active", k === i));
  paintDots();

  function show(next) {
    i = next % items.length;
    clearTimeout(swapTimer);
    if (reduce?.matches) {                    // animatsiyasiz
      msg.textContent = items[i];
      paintDots();
      return;
    }
    msg.classList.add("is-leaving");
    swapTimer = setTimeout(() => {
      msg.textContent = items[i];
      msg.classList.remove("is-leaving");
      paintDots();
    }, 260);
  }

  const running = () => timer !== null;
  function start() {
    if (running() || userPaused || hover || document.hidden) return;
    timer = setInterval(() => show(i + 1), period());
  }
  function stop() {
    clearInterval(timer);
    timer = null;
  }
  function sync() { (userPaused || hover || document.hidden) ? stop() : start(); }

  pauseBtn?.addEventListener("click", () => {
    userPaused = !userPaused;
    pauseBtn.setAttribute("aria-pressed", String(userPaused));
    pauseBtn.setAttribute("aria-label", userPaused ? "Xabarlar almashinuvini davom ettirish" : "Xabarlar almashinuvini to‘xtatish");
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
  // Sahifadan chiqishda taymer to'xtaydi; bfcache'dan qaytsa — qayta boshlanadi.
  const onHide = () => { stop(); clearTimeout(swapTimer); };
  const onShow = (e) => { if (e.persisted) sync(); };
  window.addEventListener("pagehide", onHide);
  window.addEventListener("pageshow", onShow);
  const destroy = () => {
    onHide();
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pagehide", onHide);
    window.removeEventListener("pageshow", onShow);
  };
  start();
  return { destroy, get index() { return i; }, get running() { return running(); } };
}

if (root) {
  try { window.__ofPromo = mount(root); } catch (error) { console.error("[home] promo:", error); }
}
