// ==========================================================================
// Sertifikatni tekshirish (certificates/verify.html) — ommaviy, kirish talab qilinmaydi.
// Faqat aniq raqam bo'yicha o'qiladi; natija: haqiqiy / bekor qilingan / topilmadi.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { getCertificate, NUMBER_RE } from "./cert-service.js";
import { renderCertificate, formatDate, formatAvg } from "./cert-render.js";

const page = document.getElementById("verifyPage");
const form = page.querySelector("[data-form]");
const input = page.querySelector("#certNumber");
const out = page.querySelector("[data-result]");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function banner(tone, iconName, title, text) {
  return `<div class="of-card cert-status cert-status--${tone}" role="status">
    <span class="cert-status__icon">${icon(iconName)}</span>
    <div><h2>${esc(title)}</h2><p>${esc(text)}</p></div></div>`;
}

async function verify(raw) {
  const number = String(raw || "").trim().toUpperCase();
  if (!number) { out.innerHTML = ""; return; }
  if (!NUMBER_RE.test(number)) {
    out.innerHTML = banner("bad", "alert", "Raqam formati noto‘g‘ri", "Sertifikat raqami OF-MEX-XXXX-XXXX-XXXX ko‘rinishida bo‘ladi.");
    return;
  }
  out.innerHTML = '<div class="of-card cert-status"><span class="of-skeleton of-skeleton--title"></span></div>';
  let cert;
  try {
    cert = await getCertificate(number);
  } catch (error) {
    console.error("[tekshirish]", error);
    out.innerHTML = banner("bad", "alert", "Tekshirib bo‘lmadi", "Internet aloqasini tekshirib, qayta urinib ko‘ring.");
    return;
  }
  if (!cert) {
    out.innerHTML = banner("bad", "alert", "Sertifikat topilmadi", "Bunday raqamli sertifikat mavjud emas. Raqamni tekshirib qayta kiriting.");
    return;
  }
  const revoked = cert.revoked === true;
  const rows = [
    ["Ism-familiya", cert.fullName],
    ["Kurs", `Umumiy fizika${cert.kind === "full" ? " (to‘liq kurs)" : ` — ${cert.courseTitle}`}`],
    ["O‘rtacha ball", formatAvg(cert.avgX10)],
    ["Yakunlangan mavzular", String(cert.lessonCount)],
    ["Berilgan sana", formatDate(cert.issuedAt)],
    ["Sertifikat raqami", cert.number],
  ];
  out.innerHTML = `
    ${revoked
      ? banner("bad", "alert", "Sertifikat bekor qilingan", "Bu sertifikat administrator tomonidan bekor qilingan va haqiqiy hisoblanmaydi.")
      : banner("ok", "shield", "Sertifikat haqiqiy", "Ushbu sertifikat OliyFizika.uz tomonidan berilgan.")}
    <div class="of-card cert-detail"><dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>
    <div class="cert-preview" data-preview><span class="of-skeleton" style="height:240px;width:100%"></span></div>
    <p class="of-muted cert-disclaimer">Sertifikat o‘quv rag‘bati uchun beriladi va davlat hujjati hisoblanmaydi.</p>`;
  const holder = out.querySelector("[data-preview]");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${cert.courseTitle} sertifikati — ${cert.fullName}`);
  renderCertificate(cert, { canvas }).then(() => holder.replaceChildren(canvas)).catch(() => holder.remove());
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = input.value.trim().toUpperCase();
  const url = new URL(location.href);
  if (value) url.searchParams.set("id", value); else url.searchParams.delete("id");
  history.replaceState(null, "", url);
  verify(value);
});

const initial = new URLSearchParams(location.search).get("id");
if (initial) { input.value = initial.toUpperCase(); verify(initial); }
