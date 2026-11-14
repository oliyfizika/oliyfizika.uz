// ==========================================================================
// OliyFizika.uz mock test sertifikati — canvas chizish va PDF (tashqi kutubxonasiz).
//
// Dizayn: Milliy sertifikat uslubidagi oltin naqshli fon, yuqorida emblema, sarlavha, raqam, shaxsiy ma'lumotlar va rasm,
// ball/foiz/daraja, bo'limlar bo'yicha natija, sana, QR kod. Davlat idorasi nomi va gerbi ISHLATILMAYDI — o'rniga
// OliyFizika.uz emblemasi va nomi; pastda sayt manzillari va «davlat namunasidagi hujjat emas» izohi.
// ==========================================================================
import { qrMatrix, drawQr } from "../../../assets/js/simulations/lab-qr.js";

export const PAGE = Object.freeze({ w: 1240, h: 1754 }); // A4, 150 dpi
export const SITE_LINE = "oliyfizika.uz   •   Telegram: @oliyfizika_uz   •   oliyfizika@gmail.com";
const FONT = '"PT Serif", "Noto Serif", Georgia, "Times New Roman", serif';
const INK = "#1c1a14";
const GOLD = "#b8933f";
const GOLD_DARK = "#8a6a22";

const comma = (v, d) => (Number.isFinite(Number(v)) ? Number(v).toFixed(d).replace(".", ",") : "—");
const upper = (s) => String(s || "").toLocaleUpperCase("uz-UZ").replace(/O‘/g, "O‘").replace(/G‘/g, "G‘");

/** Fon: oltin gradient, olti burchakli yulduz naqshi, ikki qatorli ramka, burchak bezaklari. */
function drawBackground(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 80, W / 2, H * 0.55, H * 0.75);
  g.addColorStop(0, "#fbf6e6");
  g.addColorStop(0.55, "#efe1b6");
  g.addColorStop(1, "#d9c084");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Naqsh: uchburchakli to'r (olti burchakli yulduzlar)
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#fffaf0";
  ctx.lineWidth = 1.2;
  const s = 34;
  const hgt = s * Math.sqrt(3) / 2;
  for (let y = -hgt; y < H + hgt; y += hgt) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let k = -H; k < W + H; k += s) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + H / Math.sqrt(3), H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k - H / Math.sqrt(3), H); ctx.stroke();
  }
  ctx.restore();

  // Ramka
  ctx.save();
  ctx.strokeStyle = "#fffaf0";
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.restore();

  // Burchak bezaklari (yuqori o'ng, pastki chap): oq romb-yulduzlar
  cornerOrnament(ctx, W - 44, 44, -1, 1);
  cornerOrnament(ctx, 44, H - 44, 1, -1);
}

function cornerOrnament(ctx, x0, y0, dx, dy) {
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(dx, dy);
  ctx.beginPath();
  ctx.rect(0, 0, 270, 270);
  ctx.clip();
  const R = 50;
  const hex = (cx, cy) => {
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(a - 0.35), cy + R * Math.sin(a - 0.35));
      ctx.lineTo(cx + R * 1.18 * Math.cos(a), cy + R * 1.18 * Math.sin(a));
      ctx.lineTo(cx + R * Math.cos(a + 0.35), cy + R * Math.sin(a + 0.35));
      ctx.closePath();
      ctx.fillStyle = "rgba(255,252,242,0.42)";
      ctx.fill();
      ctx.strokeStyle = "rgba(184,147,63,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };
  const step = R * 2.05;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4 - i; j++) {
      hex(R * 0.9 + j * step + (i % 2) * step / 2, R * 0.9 + i * step * 0.87);
    }
  }
  ctx.restore();
}

/** OliyFizika.uz emblemasi: oltin halqa, ichida atom va «OF». */
function drawEmblem(ctx, cx, cy, r) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, "#fff6d8");
  g.addColorStop(1, "#d4b05a");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = GOLD_DARK; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = "#123a7a"; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = "#f2d98b"; ctx.stroke();
  // halqa yozuvi
  ctx.fillStyle = "#3d2c08";
  ctx.font = `bold ${Math.round(r * 0.15)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = "• OLIYFIZIKA.UZ • FIZIKA • OLIYFIZIKA.UZ • FIZIKA ";
  const chars = [...label];
  chars.forEach((c, i) => {
    const a = -Math.PI / 2 + (i / chars.length) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(c, 0, 0);
    ctx.restore();
  });
  // atom
  ctx.strokeStyle = "#f2d98b";
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((Math.PI / 3) * k);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "#f2d98b";
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#123a7a";
  ctx.font = `bold ${Math.round(r * 0.13)}px ${FONT}`;
  ctx.fillText("OF", cx, cy + 1);
  ctx.restore();
}

function text(ctx, s, x, y, { size = 26, bold = false, align = "left", color = INK, italic = false } = {}) {
  ctx.font = `${italic ? "italic " : ""}${bold ? "bold " : ""}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}

function rule(ctx, x1, x2, y, { width = 1.2, color = "rgba(120,96,40,0.45)" } = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.restore();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Sertifikatni chizish.
 * @param {HTMLCanvasElement} canvas
 * @param {{certNo, participantId, lastName, firstName, patronymic, subject, score, percent, level, sections:{label,score}[],
 *          issuedAt:Date, testNumber, sessionDate:Date, verifyUrl, photo?:string, author?:string}} d
 */
export async function drawCertificate(canvas, d) {
  const W = PAGE.w;
  const H = PAGE.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  try { await document.fonts?.load(`bold 30px "PT Serif"`); await document.fonts?.load(`30px "PT Serif"`); } catch { /* tizim shrifti */ }

  drawBackground(ctx, W, H);
  drawEmblem(ctx, W / 2, 168, 84);

  const L = 132;
  const R = W - 132;
  text(ctx, "OLIYFIZIKA.UZ — FIZIKA FANIDAN ONLAYN TA’LIM PLATFORMASI", W / 2, 304, { size: 26, bold: true, align: "center" });
  text(ctx, "MILLIY SERTIFIKAT FORMATIDAGI MOCK TEST NATIJASI", W / 2, 340, { size: 26, bold: true, align: "center" });
  rule(ctx, L, R, 372, { width: 5, color: INK });

  text(ctx, "UMUMTA’LIM FANINI BILISH DARAJASI", W / 2, 432, { size: 36, bold: true, align: "center" });
  text(ctx, "TO‘G‘RISIDA SERTIFIKAT", W / 2, 476, { size: 36, bold: true, align: "center" });

  let y = 540;
  text(ctx, "Sertifikat raqami:", L + 8, y, { size: 27 });
  text(ctx, d.certNo || "—", 790, y, { size: 30, bold: true });
  rule(ctx, L, R, y + 34);

  // Shaxsiy ma'lumotlar + rasm
  y = 636;
  const rows = [
    ["Ishtirokchi ID:", d.participantId || "—"],
    ["Familiyasi:", upper(d.lastName) || "—"],
    ["Ismi:", upper(d.firstName) || "—"],
    ["Otasining ismi:", upper(d.patronymic) || "—"],
  ];
  rows.forEach(([k, v], i) => {
    text(ctx, k, L + 8, y + i * 52, { size: 27 });
    text(ctx, v, 490, y + i * 52, { size: 28, bold: true });
  });
  const px = R - 158;
  const py = 596;
  const pw = 150;
  const ph = 200;
  ctx.save();
  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);
  ctx.strokeStyle = "rgba(90,70,30,0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px - 4, py - 4, pw + 8, ph + 8);
  if (d.photo) {
    try {
      const img = await loadImage(d.photo);
      const s = Math.max(pw / img.width, ph / img.height);
      const sw = pw / s;
      const sh = ph / s;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, px, py, pw, ph);
    } catch { /* rasm o'qilmadi */ }
  } else {
    ctx.fillStyle = "#e9dfc3";
    ctx.fillRect(px, py, pw, ph);
    text(ctx, "3×4", px + pw / 2, py + ph / 2, { size: 26, align: "center", color: "#8a7a55" });
  }
  ctx.restore();
  rule(ctx, L, R, 830);

  // Natija
  y = 892;
  const res = [
    ["Umumta’lim fani:", d.subject || "Fizika (O‘zbek)"],
    ["Umumiy to‘plagan bali:", comma(d.score, 2)],
    ["Umumiy ballga nisbatan foiz ko‘rsatkichi:", `${comma(d.percent, d.percent % 1 ? 2 : 0)} %`],
    ["Sertifikat darajasi:", d.level || "—"],
  ];
  res.forEach(([k, v], i) => {
    text(ctx, k, L + 8, y + i * 54, { size: 29 });
    text(ctx, v, 790, y + i * 54, { size: 31, bold: true });
  });

  y = 1124;
  text(ctx, "Bo‘limlar bo‘yicha test sinovi natijalari:", L, y, { size: 27, bold: true });
  (d.sections || []).forEach((s, i) => {
    const yy = y + 46 + i * 38;
    text(ctx, s.label, L + 16, yy, { size: 25 });
    text(ctx, comma(s.score, 3), R - 8, yy, { size: 25, align: "right" });
  });
  const afterSec = y + 46 + Math.max(1, (d.sections || []).length) * 38 - 18;
  rule(ctx, L, R, afterSec + 14);

  // Sana va mock
  y = afterSec + 62;
  const date = (v) => (v instanceof Date && !Number.isNaN(v.getTime()) ? `${String(v.getDate()).padStart(2, "0")}.${String(v.getMonth() + 1).padStart(2, "0")}.${v.getFullYear()}` : "—");
  ctx.font = `27px ${FONT}`;
  text(ctx, "Berilgan sanasi: ", L + 8, y, { size: 27 });
  text(ctx, date(d.issuedAt), L + 8 + ctx.measureText("Berilgan sanasi: ").width, y, { size: 28, bold: true });
  const right = `Mock test №${d.testNumber ?? "—"}, sessiya: `;
  ctx.font = `bold 28px ${FONT}`;
  const dw = ctx.measureText(date(d.sessionDate)).width;
  text(ctx, date(d.sessionDate), R, y, { size: 28, bold: true, align: "right" });
  text(ctx, right, R - dw, y, { size: 27, align: "right" });

  // QR + imzo
  const qs = 170;
  const qx = W / 2 - qs / 2;
  const qy = y + 26;
  if (d.verifyUrl) {
    try { drawQr(ctx, qrMatrix(d.verifyUrl), qx, qy, qs, { quiet: 3, dark: "#111", light: "#ffffff" }); } catch (e) { console.warn("QR:", e); }
  }
  text(ctx, "Loyiha muallifi", qx - 40, qy + qs / 2 + 10, { size: 27, bold: true, align: "right" });
  text(ctx, upper(d.author || "S. Amirov"), qx + qs + 40, qy + qs / 2 + 10, { size: 27, bold: true });

  // Pastki qism: sayt manzillari va izoh
  const fy = H - 112;
  rule(ctx, L, R, fy - 32, { width: 1.5, color: "rgba(120,96,40,0.6)" });
  text(ctx, SITE_LINE, W / 2, fy, { size: 24, bold: true, align: "center", color: "#3d2c08" });
  text(ctx, "Ushbu sertifikat OliyFizika.uz mock test natijasini tasdiqlaydi va davlat namunasidagi hujjat hisoblanmaydi.", W / 2, fy + 30, { size: 19, italic: true, align: "center", color: "#4a3b18" });
  text(ctx, "Haqiqiyligini QR kod orqali tekshirish mumkin.", W / 2, fy + 54, { size: 19, italic: true, align: "center", color: "#4a3b18" });
  return canvas;
}

// ------------------------------------------------------------------ PDF (bitta sahifa, JPEG rasm, A4)
function bytesOf(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

/** JPEG (Uint8Array, px o'lchami bilan) → PDF Blob (A4, rasm butun sahifani egallaydi). */
export function jpegToPdf(jpeg, wPx, hPx, title = "Sertifikat") {
  const pw = 595.28;
  const ph = 841.89;
  const parts = [];
  const offsets = [];
  let pos = 0;
  const push = (chunk) => { const b = typeof chunk === "string" ? bytesOf(chunk) : chunk; parts.push(b); pos += b.length; };
  const obj = (n, body) => { offsets[n] = pos; push(`${n} 0 obj\n${body}\nendobj\n`); };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = pos;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push("\nendstream\nendobj\n");
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const safeTitle = String(title).replace(/[^\x20-\x7E]/g, "").replace(/[()\\]/g, "");
  obj(6, `<< /Title (${safeTitle}) /Creator (OliyFizika.uz) >>`);
  const xref = pos;
  let x = "xref\n0 7\n0000000000 65535 f \n";
  for (let n = 1; n <= 6; n++) x += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(`${x}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}

/** Foydalanuvchi rasmini 3×4 (300×400) JPEG data URL ga keltirish (markazdan, yuqoriroq kesish). */
export async function preparePhoto(file, { maxBytes = 8 * 1024 * 1024, maxChars = 340000 } = {}) {
  if (!file) throw new Error("Rasm tanlanmagan");
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Faqat JPG, PNG yoki WEBP rasm yuklang");
  if (file.size > maxBytes) throw new Error("Rasm hajmi 8 MB dan oshmasin");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (img.width < 120 || img.height < 160) throw new Error("Rasm juda kichik (kamida 120×160 piksel)");
    const W = 300;
    const H = 400;
    const s = Math.max(W / img.width, H / img.height);
    const sw = W / s;
    const sh = H / s;
    const sx = (img.width - sw) / 2;
    const sy = Math.max(0, (img.height - sh) * 0.35); // yuz odatda yuqoriroqda
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    for (const q of [0.88, 0.8, 0.7, 0.6, 0.5]) {
      const data = c.toDataURL("image/jpeg", q);
      if (data.length <= maxChars) return data;
    }
    throw new Error("Rasmni siqib bo‘lmadi");
  } finally {
    URL.revokeObjectURL(url);
  }
}
