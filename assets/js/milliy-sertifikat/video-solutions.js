// ==========================================================================
// Mock test video/PDF yechimlari (milliy-sertifikat/mock-tests.html) — OliyFizika 2.0 ko'rinishi.
//
// Ma'lumot: ../../milliy-sertifikat/mock-tests-data.js (o'zgarmagan): 10 ta variant, Drive PDF, har birida 9 YouTube ID.
// Ruxsat mantig'i eski mock-tests.js dagi bilan AYNAN bir xil:
//   - foydalanuvchi yo'q        -> "Mock testlarni ko‘rish uchun tizimga kiring." + Telegram havolasi
//   - mockTestsAccess !== true  -> "Bu bo‘lim uchun sizda ruxsat mavjud emas." + Telegram havolasi
//   - xato                      -> "Ruxsatni tekshirib bo‘lmadi. Iltimos, keyinroq urinib ko‘ring."
//   - ruxsat bor                -> ro'yxat va yechimlar
// Qo'shimcha (ixtiyoriy): mehmon uchun saytning mavjud "Kirish" oynasi tugmasi.
// YouTube iframe'lar faqat "Ko‘rish" bosilganda yaratiladi (sahifa ochilganda hech bir pleyer yuklanmaydi).
// ==========================================================================

import { mockTests } from "../../../milliy-sertifikat/mock-tests-data.js";
import { auth, db } from "../../../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { icon } from "../ui/icons.js";
import { showAuthGate } from "../auth/auth-gate.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/№/g, " ").replace(/\s+/g, " ").trim();

const list = $("#mockTestsList");
const detail = $("#mockTestDetail");
const status = $("#accessStatus");
const telegramLink = $("#telegramAccessLink");
const loginBtn = $("[data-login]");
let rendered = false;
let query = "";

$$("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
loginBtn.addEventListener("click", () => showAuthGate(location.href));

// ------------------------------------------------------------ ro'yxat
function renderTestCards() {
  list.innerHTML = mockTests.map((test) => `
    <li data-search-text="${esc(`${test.title} mock test ${test.id} 45 ta savol pdf video yechim`)}">
      <article class="of-card of-vs-card" aria-labelledby="vs-title-${test.id}">
        <span class="of-vs-card__num" aria-hidden="true">${String(test.id).padStart(2, "0")}</span>
        <h3 class="of-vs-card__title" id="vs-title-${test.id}">${esc(test.title)}</h3>
        <p class="of-vs-card__meta">45 ta savol</p>
        <p class="of-vs-card__res"><span>${icon("file")}PDF</span><span>${icon("video")}${test.videos.length} ta video yechim</span></p>
        <button type="button" class="of-btn of-btn--soft of-vs-card__open" data-open="${test.id}" aria-controls="mockTestDetail" aria-expanded="false"
          aria-label="${esc(`${test.title}: PDF va video yechimlarni ko‘rish`)}">Yechimlarni ko‘rish ${icon("arrowRight")}</button>
      </article>
    </li>`).join("");
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) showTest(Number(b.dataset.open));
  });
  applyFilter();
}

// ------------------------------------------------------------ bitta test: PDF + videolar
function showTest(id) {
  const test = mockTests.find((item) => item.id === id);
  if (!test) return;
  $$("[data-open]", list).forEach((b) => b.setAttribute("aria-expanded", String(Number(b.dataset.open) === id)));
  detail.innerHTML = `
    <div class="of-vs-detail__head">
      <h2 id="vsDetailTitle">${esc(test.title)}</h2>
      <button type="button" class="of-btn of-btn--ghost of-btn--sm" data-close-detail>Yopish</button>
    </div>
    <section class="of-vs-pdf" aria-labelledby="vsPdfTitle">
      <span class="of-vs-pdf__icon" aria-hidden="true">${icon("file")}</span>
      <div>
        <h3 id="vsPdfTitle">Test varianti</h3>
        <p>45 ta savoldan iborat test variantini PDF shaklida oching.</p>
      </div>
      <a class="of-btn of-btn--primary" href="${esc(test.pdf)}" target="_blank" rel="noopener noreferrer"
         aria-label="${esc(`${test.title}: PDF testni ochish (yangi oynada)`)}">PDF testni ochish ${icon("external")}</a>
    </section>
    <h3 class="of-vs-videos-title">Video yechimlar</h3>
    <ul class="of-vs-videos">
      ${test.videos.map((video, i) => `
        <li class="of-vs-video" data-test="${test.id}" data-vidx="${i}" data-video="${esc(video.youtubeId)}">
          <h4>${esc(video.title)}</h4>
          <div class="of-vs-player">
            <button type="button" class="of-vs-poster" data-play aria-label="${esc(`Ko‘rish: ${test.title}, ${video.title}`)}">
              <span class="of-vs-poster__play" aria-hidden="true">${icon("play")}</span>
              <span class="of-vs-poster__text">Ko‘rish</span>
            </button>
          </div>
        </li>`).join("")}
    </ul>`;
  detail.hidden = false;
  detail.querySelector("[data-close-detail]").addEventListener("click", () => {
    detail.hidden = true;
    const opener = $(`[data-open="${id}"]`, list);
    opener?.setAttribute("aria-expanded", "false");
    opener?.focus();
  });
  detail.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  detail.focus({ preventScroll: true });
}

// Pleyer faqat bosilganda (mavjud URL va parametrlar eski sahifadagidek; autoplay — ikkinchi bosishsiz ijro uchun)
detail.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-play]");
  if (!btn) return;
  const item = btn.closest("[data-video]");
  const test = mockTests.find((t) => t.id === Number(item.dataset.test));
  const video = test?.videos[Number(item.dataset.vidx)];
  if (!video) return;
  const frame = document.createElement("iframe");
  frame.src = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1`;
  frame.title = `${test.title}: ${video.title}`;
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;
  btn.replaceWith(frame);
  frame.focus();
});

// ------------------------------------------------------------ qidiruv
function applyFilter() {
  let visible = 0;
  $$(":scope > li", list).forEach((li) => {
    const ok = !query || norm(li.dataset.searchText).includes(query);
    li.hidden = !ok;
    if (ok) visible++;
  });
  $("[data-video-count]").textContent = visible === mockTests.length ? `${mockTests.length} ta variant` : `${visible} / ${mockTests.length} ta variant`;
  let note = $("#mockTestsList + .of-search-empty");
  if (!visible) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      note.setAttribute("role", "status");
      list.after(note);
    }
    note.textContent = "Qidiruv bo‘yicha mock test topilmadi.";
  } else note?.remove();
  return visible;
}
function enableSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: "Mock testni qidirish…",
    label: "Mock test yechimlari bo‘yicha qidirish",
    onQuery: (q) => { query = norm(q); return rendered ? applyFilter() : 0; },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

// ------------------------------------------------------------ ruxsat (eski mock-tests.js bilan bir xil)
async function checkAccess(user) {
  if (!user) return false;
  const profile = await getDoc(doc(db, "users", user.uid));
  return profile.exists() && profile.data()?.mockTestsAccess === true;
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!(await checkAccess(user))) {
      status.textContent = user ? "Bu bo‘lim uchun sizda ruxsat mavjud emas." : "Mock testlarni ko‘rish uchun tizimga kiring.";
      telegramLink.hidden = false;
      loginBtn.hidden = Boolean(user);
      return;
    }
    $("[data-access-box]").hidden = true;
    document.querySelector("#protectedContent").hidden = false;
    if (!rendered) { renderTestCards(); rendered = true; enableSearch(); }
  } catch (error) {
    console.error("Mock testlar ruxsatini tekshirib bo‘lmadi:", error);
    status.textContent = "Ruxsatni tekshirib bo‘lmadi. Iltimos, keyinroq urinib ko‘ring.";
  }
});
