// ==========================================================================
// Sertifikatni canvas'ga chizish (A4 gorizontal, 1754×1240 ≈ 150 dpi) + PNG/PDF yuklash.
// Tashqi kutubxonasiz: QR — ./qr.js, PDF — JPEG'ni joylaydigan minimal yozuvchi.
// ==========================================================================

import { qrMatrix, drawQr } from "./qr.js";
import { VERIFY_URL, SITE_NAME } from "../../../umumiy-fizika/data/certificates.js";

export const CERT_W = 1754;
export const CERT_H = 1240;

const C = {
  paper: "#fbfaf6", ink: "#0b1220", muted: "#4b5873", blue: "#1d4ed8", navy: "#0f2a6b", soft: "#dbe7ff", green: "#16a34a",
};
const DISPLAY = '"Manrope", "Inter", system-ui, sans-serif';
const SANS = '"Inter", system-ui, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

export function verifyLink(number) {
  return `${VERIFY_URL}?id=${encodeURIComponent(number)}`;
}

export function formatDate(ts) {
  const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Tashkent" })
      .format(d).replace(/\//g, ".");
  } catch { return d.toLocaleDateString(); }
}

export const formatAvg = (avgX10) => `${(avgX10 / 10).toFixed(1).replace(".", ",")}%`;

function fit(ctx, text, maxWidth, size, weight, family) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 28) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

function spaced(ctx, text, x, y, spacing) {
  // Harflar orasi: canvas letterSpacing'ni hamma brauzer qo'llamaydi — qo'lda chizamiz (markazlashgan)
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (widths.length - 1);
  let cx = x - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = prev;
}

async function loadFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`800 60px Manrope`), document.fonts.load(`700 30px Manrope`),
      document.fonts.load(`600 24px Inter`), document.fonts.load(`500 24px Inter`),
    ]);
  } catch { /* zaxira shriftlar ishlatiladi */ }
}

function atomMark(ctx, cx, cy, r) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, "#1d4ed8"); g.addColorStop(1, "#16a34a");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = r * 0.09; ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((i * Math.PI) / 3);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.66, r * 0.26, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, r * 0.11, 0, Math.PI * 2); ctx.fill();
}

/** @param {object} cert  certificates/{id} hujjati (+ id). @returns {Promise<HTMLCanvasElement>} */
export async function renderCertificate(cert, { canvas } = {}) {
  await loadFonts();
  const cv = canvas || document.createElement("canvas");
  cv.width = CERT_W; cv.height = CERT_H;
  const ctx = cv.getContext("2d");
  const W = CERT_W; const H = CERT_H; const cx = W / 2;
  ctx.textBaseline = "alphabetic";

  // Qog'oz + ramka
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.blue; ctx.lineWidth = 6; ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = "#9db8f5"; ctx.lineWidth = 2; ctx.strokeRect(58, 58, W - 116, H - 116);
  [[58, 58, 1, 1], [W - 58, 58, -1, 1], [58, H - 58, 1, -1], [W - 58, H - 58, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.strokeStyle = C.blue; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y + sy * 70); ctx.lineTo(x, y); ctx.lineTo(x + sx * 70, y); ctx.stroke();
  });

  // Yengil suv belgisi: kichik, zich joylashgan
  ctx.save();
  ctx.translate(cx, H / 2); ctx.rotate(-Math.PI / 9);
  ctx.globalAlpha = 0.04; ctx.fillStyle = C.navy; ctx.font = `800 44px ${DISPLAY}`; ctx.textAlign = "center";
  for (let row = -12; row <= 12; row++) for (let col = -6; col <= 6; col++) ctx.fillText(SITE_NAME, col * 330 + (row % 2) * 165, row * 110);
  ctx.restore();
  ctx.globalAlpha = 1;

  // Sarlavha
  atomMark(ctx, cx - 190, 150, 34);
  ctx.textAlign = "left"; ctx.fillStyle = C.navy; ctx.font = `800 40px ${DISPLAY}`;
  ctx.fillText("OliyFizika", cx - 140, 164);
  const w1 = ctx.measureText("OliyFizika").width;
  ctx.fillStyle = C.blue; ctx.fillText(".uz", cx - 140 + w1, 164);

  ctx.textAlign = "center"; ctx.fillStyle = C.navy; ctx.font = `800 88px ${DISPLAY}`;
  spaced(ctx, "SERTIFIKAT", cx, 330, 16);
  ctx.fillStyle = C.muted; ctx.font = `500 28px ${SANS}`;
  ctx.fillText("Ushbu sertifikat", cx, 400);

  // Ism
  ctx.fillStyle = C.ink;
  const nameSize = fit(ctx, cert.fullName, 1350, 84, 800, DISPLAY);
  ctx.font = `800 ${nameSize}px ${DISPLAY}`;
  ctx.fillText(cert.fullName, cx, 505);
  ctx.strokeStyle = C.blue; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 380, 535); ctx.lineTo(cx + 380, 535); ctx.stroke();

  // Matn
  const isFull = cert.kind === "full";
  const text = isFull
    ? "«Umumiy fizika» kursining barcha bo‘limlarini (Mexanika, Molekulyar fizika, Elektr va magnetizm, Optika) muvaffaqiyatli yakunlagani uchun taqdirlanadi."
    : `«Umumiy fizika» kursining «${cert.courseTitle}» bo‘limini muvaffaqiyatli yakunlagani uchun taqdirlanadi.`;
  ctx.fillStyle = C.ink; ctx.font = `500 32px ${SANS}`;
  wrap(ctx, text, 1280).forEach((line, i) => ctx.fillText(line, cx, 605 + i * 46));

  // Sana (kichik)
  ctx.fillStyle = C.muted; ctx.font = `500 26px ${SANS}`; ctx.textAlign = "center";
  ctx.fillText(`Berilgan sana: ${formatDate(cert.issuedAt)}`, cx, 800);

  // Pastki qism: raqam + tekshirish + QR
  ctx.textAlign = "left";
  ctx.fillStyle = C.muted; ctx.font = `600 20px ${SANS}`;
  ctx.fillText("SERTIFIKAT RAQAMI", 130, 955);
  ctx.fillStyle = C.ink; ctx.font = `700 46px ${MONO}`;
  ctx.fillText(cert.number, 130, 1010);
  ctx.fillStyle = C.muted; ctx.font = `500 24px ${SANS}`;
  ctx.fillText("Haqiqiyligini tekshirish: skanerlang yoki quyidagi sahifada raqamni kiriting", 130, 1062);
  ctx.fillStyle = C.blue; ctx.font = `600 26px ${SANS}`;
  ctx.fillText(VERIFY_URL.replace("https://", ""), 130, 1100);

  const qr = qrMatrix(verifyLink(cert.number));
  const qs = 250; const qx = W - 130 - qs; const qy = 910;
  ctx.fillStyle = "#fff"; ctx.strokeStyle = C.soft; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(qx - 8, qy - 8, qs + 16, qs + 16, 14); ctx.fill(); ctx.stroke();
  drawQr(ctx, qr, qx, qy, qs, { quiet: 2, dark: C.ink });

  if (cert.revoked) {
    ctx.save();
    ctx.translate(cx, H / 2); ctx.rotate(-Math.PI / 12);
    ctx.globalAlpha = 0.22; ctx.fillStyle = "#b91c1c"; ctx.font = `800 170px ${DISPLAY}`; ctx.textAlign = "center";
    ctx.fillText("BEKOR QILINGAN", 0, 40);
    ctx.restore();
  }
  return cv;
}

// ------------------------------------------------------------ Yuklash
function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const toBlob = (canvas, type, q) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("canvas"))), type, q));

export async function downloadPng(cert, canvas) {
  save(await toBlob(canvas, "image/png"), `${cert.number}.png`);
}

/** Minimal PDF: bitta A4 gorizontal sahifa, JPEG rasm to'liq sahifaga. */
export function buildPdf(jpegBytes, imgW, imgH) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let length = 0;
  const push = (data) => { const b = typeof data === "string" ? enc.encode(data) : data; parts.push(b); length += b.length; };
  const obj = (n, body) => { offsets[n] = length; push(`${n} 0 obj\n`); push(body); push("\nendobj\n"); };
  const PW = 842; const PH = Math.round((842 * imgH) / imgW);

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  push(jpegBytes); push("\nendstream\nendobj\n");
  const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = length;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  const out = new Uint8Array(length);
  let p = 0;
  parts.forEach((b) => { out.set(b, p); p += b.length; });
  return out;
}

export async function downloadPdf(cert, canvas) {
  const jpeg = new Uint8Array(await (await toBlob(canvas, "image/jpeg", 0.93)).arrayBuffer());
  save(new Blob([buildPdf(jpeg, canvas.width, canvas.height)], { type: "application/pdf" }), `${cert.number}.pdf`);
}
