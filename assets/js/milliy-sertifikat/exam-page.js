// ==========================================================================
// Mock test sahifasi — sahifa darajasidagi qulayliklar (engine mantig'iga TEGMAYDI).
// Engine (js/test-engine.js) DOM'ni o'zgartirganda shu modul faqat kuzatadi va:
//   1) test nomini qobiq sarlavhasi/breadcrumb'ga qo'yadi (#brandTitle dan);
//   2) qolgan vaqtni ekran o'quvchilarga muhim nuqtalarda e'lon qiladi (#timer matnidan, taymerga ta'sir qilmaydi);
//   3) savollar paneli tugmalariga holatni aria-label orqali qo'shadi (javob berilgan / qisman / belgilangan / joriy);
//   4) natija ekrani ochilganda fokusni unga o'tkazadi.
// ==========================================================================

const $ = (s) => document.querySelector(s);

function whenShell(fn) {
  if (window.OFShell) fn();
  else document.addEventListener("of:shell-ready", fn, { once: true });
}

// 1) Sarlavha
const brand = $("#brandTitle");
if (brand) {
  const sync = () => {
    const t = brand.textContent.trim();
    if (t && t !== "Mock test") whenShell(() => window.OFShell?.setTitle?.(t));
  };
  new MutationObserver(sync).observe(brand, { childList: true, characterData: true, subtree: true });
}

// 2) Taymer e'lonlari (faqat o'qiydi)
const timerEl = $("#timer");
const live = $("#timerAnnounce");
if (timerEl && live) {
  const MARKS = [60, 30, 10, 5, 1]; // daqiqa
  let lastBucket = null;
  const bucketOf = (min) => MARKS.filter((m) => min < m).pop() ?? null; // eng kichik o'tilgan chegara
  new MutationObserver(() => {
    const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(timerEl.textContent.trim());
    if (!m) return;
    const left = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
    const bucket = bucketOf(left / 60);
    if (lastBucket === null) { lastBucket = bucket; return; } // birinchi o'qish — e'lon qilinmaydi
    if (bucket !== lastBucket && bucket !== null) {
      live.textContent = `Diqqat: ${bucket} daqiqadan kam vaqt qoldi.`;
    }
    lastBucket = bucket;
  }).observe(timerEl, { childList: true, characterData: true, subtree: true });
}

// 3) Savollar paneli holati
const grid = $("#navgrid");
if (grid) {
  const label = (b) => {
    const n = b.textContent.trim();
    const parts = [`${n}-savol`];
    if (b.classList.contains("answered")) parts.push("javob berilgan");
    else if (b.classList.contains("partial")) parts.push("qisman javob berilgan");
    else parts.push("javobsiz");
    if (b.classList.contains("marked")) parts.push("belgilangan");
    const next = parts.join(", ");
    if (b.getAttribute("aria-label") !== next) b.setAttribute("aria-label", next);
  };
  new MutationObserver((records) => {
    const seen = new Set();
    records.forEach((r) => {
      if (r.type === "childList") grid.querySelectorAll(".navbtn").forEach((b) => seen.add(b));
      else if (r.target.classList?.contains("navbtn")) seen.add(r.target);
    });
    seen.forEach(label);
  }).observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}

// 4) Natija ekrani fokus
const result = $("#resultScreen");
if (result) {
  new MutationObserver(() => {
    if (!result.hidden) result.focus({ preventScroll: true });
  }).observe(result, { attributes: true, attributeFilter: ["hidden"] });
}
