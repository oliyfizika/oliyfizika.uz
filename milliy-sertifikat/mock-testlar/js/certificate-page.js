// ==========================================================================
// Sertifikat sahifasi (milliy-sertifikat/mock-testlar/sertifikat.html)
//   ?session=<id> — ishtirokchi: e'lon qilingan natija bo'yicha sertifikat, rasm yuklash (3×4), otasining ismi, PNG/PDF yuklash.
//   ?cert=<raqam> — ommaviy tekshirish (QR kod shu yerga olib keladi): sertifikat ma'lumotlari, rasmsiz.
// Rasm Firestore'da (msMockProfiles/{uid}.photo, 300×400 JPEG data URL, ≤ 350 KB) — faqat egasi va admin o'qiydi.
// ==========================================================================
import { getSession as getUserSession, goToLogin } from "./session.js";
import * as ss from "./session-service.js";
import { drawCertificate, jpegToPdf, preparePhoto, PAGE } from "./certificate-draw.js";

const VERIFY_BASE = "https://oliyfizika.uz/milliy-sertifikat/mock-testlar/sertifikat.html?cert=";
const root = document.querySelector("[data-root]");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const comma = (v, d = 2) => (Number.isFinite(Number(v)) ? String(Math.round(Number(v) * 10 ** d) / 10 ** d).replace(".", ",") : "—");
const dateOf = (v) => { const ms = ss.toMs(v); return ms == null ? null : new Date(ms); };
const fmtDate = (d) => (d ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}` : "—");

function message(title, text, actions = "") {
  root.innerHTML = `<div class="of-card cert-verify"><h2>${esc(title)}</h2><p>${esc(text)}</p>${actions ? `<div class="cert-actions">${actions}</div>` : ""}</div>`;
}

// ------------------------------------------------------------------ ommaviy tekshirish
async function verify(certNo) {
  document.querySelector("[data-lead]").textContent = "Sertifikat haqiqiyligini tekshirish.";
  if (!/^OF\d{2}-\d{6}$/.test(certNo)) { message("Sertifikat topilmadi", "Sertifikat raqami noto‘g‘ri."); return; }
  const c = await ss.getCertificate(certNo);
  if (!c) { message("Sertifikat topilmadi", `«${certNo}» raqamli sertifikat OliyFizika.uz bazasida mavjud emas.`); return; }
  root.innerHTML = `<div class="of-card cert-verify" data-verified>
    <p><span class="of-badge of-badge--green">✓ Haqiqiy sertifikat</span></p>
    <h2>${esc(c.fullName || [c.lastName, c.firstName].filter(Boolean).join(" "))}</h2>
    <dl>
      <dt>Sertifikat raqami</dt><dd>${esc(c.certNo)}</dd>
      <dt>Fan</dt><dd>Fizika (O‘zbek)</dd>
      <dt>Mock test</dt><dd>№${esc(c.testNumber)}</dd>
      <dt>Ball (Rasch, 0–75)</dt><dd>${esc(comma(c.score))}</dd>
      <dt>Foiz ko‘rsatkichi</dt><dd>${esc(comma(c.percent))} %</dd>
      <dt>Daraja</dt><dd>${esc(c.level || "—")}</dd>
      <dt>Berilgan sana</dt><dd>${esc(fmtDate(dateOf(c.issuedAt)))}</dd>
    </dl>
    <p class="of-muted">Bu OliyFizika.uz mock test natijasi bo‘yicha sertifikat; davlat namunasidagi hujjat emas.</p>
  </div>`;
}

// ------------------------------------------------------------------ ishtirokchi sertifikati
async function own(sessionId) {
  const user = await getUserSession();
  if (!user.user) {
    message("Saytga kiring", "Sertifikatni ko‘rish uchun mock testni yechgan akkauntingiz bilan kiring.",
      `<button type="button" class="of-btn of-btn--primary" data-login>Kirish</button>`);
    root.querySelector("[data-login]").addEventListener("click", () => goToLogin());
    return;
  }
  const [attempt, session, profile] = await Promise.all([
    ss.getMyAttempt(sessionId, user.uid), ss.getSession(sessionId).catch(() => null), ss.getProfile(user.uid).catch(() => null),
  ]);
  const back = `<a class="of-btn of-btn--ghost" href="./">← Mock testlar</a>`;
  if (!attempt) { message("Natija topilmadi", "Siz bu sessiyada qatnashmagansiz.", back); return; }
  if (attempt.status !== "published" || !attempt.result) {
    message("Natija hali e’lon qilinmagan", "Sertifikat admin natijalarni yakunlab, e’lon qilgandan keyin paydo bo‘ladi.", back);
    return;
  }
  const r = attempt.result;
  if (!r.level || !r.certNo) {
    message("Sertifikat berilmaydi", `Sizning balingiz ${comma(r.score)}. Sertifikat 46 va undan yuqori ball (C darajasi va undan yuqori) uchun beriladi. Keyingi sessiyalarda omad!`, back);
    return;
  }

  const st = { photo: profile?.photo || "", patronymic: profile?.patronymic || "" };
  root.innerHTML = `<div class="cert-wrap">
    <section class="of-card cert-panel" aria-labelledby="certSide">
      <h2 id="certSide">Sertifikat ma’lumotlari</h2>
      <p class="of-muted">Ball: <b>${esc(comma(r.score))}</b> • Daraja: <b>${esc(r.level)}</b> • №${esc(r.certNo)}</p>
      <div class="cert-photo">
        <img data-photo-preview alt="Sertifikat uchun rasm" ${st.photo ? `src="${esc(st.photo)}"` : ""}>
        <div>
          <label class="of-btn of-btn--soft" for="certPhoto">Rasm yuklash (3×4)</label>
          <input id="certPhoto" type="file" accept="image/jpeg,image/png,image/webp" hidden>
          <p class="of-hint">JPG, PNG yoki WEBP, 8 MB gacha. Rasm 3×4 o‘lchamga keltiriladi.</p>
        </div>
      </div>
      <div class="of-field">
        <label class="of-label" for="certPatr">Otasining ismi (ixtiyoriy)</label>
        <input class="of-input" id="certPatr" type="text" maxlength="60" placeholder="Masalan: Erkin o‘g‘li" value="${esc(st.patronymic)}">
      </div>
      <div class="cert-actions">
        <button type="button" class="of-btn of-btn--primary" data-save>Saqlash</button>
      </div>
      <p class="cert-msg of-muted" data-msg role="status" aria-live="polite"></p>
      <hr>
      <div class="cert-actions">
        <button type="button" class="of-btn of-btn--primary" data-png>PNG yuklab olish</button>
        <button type="button" class="of-btn of-btn--ghost" data-pdf>PDF yuklab olish</button>
      </div>
      <p class="of-hint">Ism va familiya saytdagi profilingizdan olinadi. Rasm faqat sizga va administratorga ko‘rinadi.</p>
    </section>
    <section class="cert-preview" aria-label="Sertifikat ko‘rinishi"><canvas data-canvas width="${PAGE.w}" height="${PAGE.h}"></canvas></section>
  </div>`;

  const canvas = root.querySelector("[data-canvas]");
  const msg = root.querySelector("[data-msg]");
  const data = () => ({
    certNo: r.certNo,
    participantId: user.uid.slice(0, 10).toUpperCase(),
    lastName: r.lastName, firstName: r.firstName, patronymic: st.patronymic,
    subject: "Fizika (O‘zbek)", score: r.score, percent: r.percent, level: r.level,
    sections: (r.sections || []).map((x) => ({ label: x.label || x.id, score: x.score })),
    issuedAt: dateOf(attempt.publishedAt) || new Date(), testNumber: session?.testNumber, sessionDate: dateOf(session?.opensAt),
    verifyUrl: VERIFY_BASE + encodeURIComponent(r.certNo), photo: st.photo,
  });
  const redraw = () => drawCertificate(canvas, data()).catch((e) => console.error("[cert] chizish:", e));
  await redraw();

  root.querySelector("#certPhoto").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    msg.textContent = "Rasm tayyorlanmoqda…";
    try {
      st.photo = await preparePhoto(file);
      root.querySelector("[data-photo-preview]").src = st.photo;
      await redraw();
      await ss.saveProfile(user.uid, { photo: st.photo, patronymic: st.patronymic.slice(0, 60) });
      msg.textContent = "Rasm saqlandi.";
    } catch (error) {
      console.warn("[cert] rasm:", error);
      msg.textContent = error?.code ? "Rasmni saqlab bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring." : (error?.message || "Rasmni yuklab bo‘lmadi.");
    }
  });
  root.querySelector("#certPatr").addEventListener("input", (e) => { st.patronymic = e.target.value; });
  root.querySelector("#certPatr").addEventListener("change", redraw);
  root.querySelector("[data-save]").addEventListener("click", async () => {
    st.patronymic = root.querySelector("#certPatr").value.trim().slice(0, 60);
    await redraw();
    try {
      const patch = { patronymic: st.patronymic };
      if (st.photo) patch.photo = st.photo;
      await ss.saveProfile(user.uid, patch);
      msg.textContent = "Saqlandi.";
    } catch (error) {
      console.warn("[cert] saqlash:", error);
      msg.textContent = "Saqlab bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.";
    }
  });
  const fileBase = `OliyFizika-sertifikat-${r.certNo}`;
  const download = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  root.querySelector("[data-png]").addEventListener("click", async () => {
    await redraw();
    canvas.toBlob((b) => b && download(b, `${fileBase}.png`), "image/png");
  });
  root.querySelector("[data-pdf]").addEventListener("click", async () => {
    await redraw();
    canvas.toBlob(async (b) => {
      if (!b) return;
      const jpeg = new Uint8Array(await b.arrayBuffer());
      download(jpegToPdf(jpeg, canvas.width, canvas.height, fileBase), `${fileBase}.pdf`);
    }, "image/jpeg", 0.93);
  });
}

async function init() {
  const p = new URLSearchParams(location.search);
  try {
    if (p.get("cert")) await verify(p.get("cert").trim().toUpperCase());
    else if (p.get("session")) await own(p.get("session"));
    else message("Sertifikat", "Sertifikat mock test natijasi e’lon qilingandan keyin natija sahifasidan ochiladi.", `<a class="of-btn of-btn--primary" href="./">Mock testlar</a>`);
  } catch (error) {
    console.error("[cert]", error);
    message("Yuklab bo‘lmadi", "Internet aloqasini tekshirib, sahifani yangilang.");
  }
}

init();
