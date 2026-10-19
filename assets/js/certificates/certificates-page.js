// ==========================================================================
// Sertifikatlarim sahifasi (certificates/index.html).
//   • Bo'lim holati — courseProgress jamlanmasidan (haqiqiy natijalarga bog'langan; rules tekshiradi).
//   • Avvalgi natijalar bir marta jamlanmaga o'tkaziladi (syncProgress), yangilari test tugaganda yoziladi.
//   • "Olish" — issueCertificate: sertifikat + indeks atomik yoziladi; rules nomzodlikni qayta tekshiradi.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { openModal } from "../ui/modal.js";
import { toast, friendlyError } from "../ui/feedback.js";
import { onSession } from "../core/session.js";
import { CERT_SECTIONS, CERT_FULL, CERT_PENDING_SECTIONS } from "../../../umumiy-fizika/data/certificates.js";
import {
  getProgress, getIndexes, getCertificate, syncProgress, sectionStatus, issueCertificate, profileFullName,
} from "./cert-service.js";
import { renderCertificate, downloadPng, downloadPdf, verifyLink, formatAvg } from "./cert-render.js";

const page = document.getElementById("certPage");
const $ = (s, r = page) => r.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const state = { profile: null, uid: null, progress: {}, indexes: {}, busy: false };

function showAlert(message) {
  const box = $("[data-alert]");
  box.hidden = !message;
  if (!message) { box.textContent = ""; return; }
  box.innerHTML = `${icon("alert")}<span></span>`;
  box.querySelector("span").textContent = message;
}

const ROOT_PREFIX = "../";

// ------------------------------------------------------------ Chizish
function sectionCard(section) {
  const st = sectionStatus(section, state.progress[section.id]);
  const issued = state.indexes[section.id];
  const status = issued ? "issued" : st.tooFast ? "toofast" : st.complete ? "ready" : "progress";
  const badge = {
    issued: '<span class="of-badge of-badge--green">Olingan</span>',
    ready: '<span class="of-badge of-badge--blue">Olishga tayyor</span>',
    toofast: '<span class="of-badge of-badge--orange">Tekshiruv kerak</span>',
    progress: '<span class="of-badge">Jarayonda</span>',
  }[status];
  const left = st.required - st.count;
  const avg = st.avg != null ? ` · o‘rtacha <b>${formatAvg(Math.round(st.avg * 10))}</b>` : "";
  let foot;
  if (status === "issued") {
    foot = `<button type="button" class="of-btn of-btn--soft" data-act="view" data-id="${section.id}">${icon("certificate")}Sertifikatni ko‘rish</button>`;
  } else if (status === "ready") {
    foot = `<button type="button" class="of-btn of-btn--primary" data-act="issue" data-id="${section.id}">${icon("certificate")}Sertifikatni olish</button>`;
  } else if (status === "toofast") {
    foot = `<p class="cert-card__note">${icon("info")}<span>Natijalar juda qisqa vaqt ichida qayd etilgan, shuning uchun sertifikat avtomatik berilmaydi. Administratorga murojaat qiling.</span></p>`;
  } else {
    foot = `<p class="cert-card__note">${icon("info")}<span>Yana <b>${left}</b> ta mavzu testidan 80% va undan yuqori natija kerak.</span></p>
      <a class="of-btn of-btn--ghost of-btn--sm" href="${ROOT_PREFIX}umumiy-fizika/${section.id}.html">Kursga o‘tish ${icon("arrowRight")}</a>`;
  }
  return `
    <li class="of-card cert-card" data-state="${status}">
      <div class="cert-card__head">
        <span class="cert-card__icon">${icon(status === "issued" ? "checkCircle" : "certificate")}</span>
        <h3>${esc(section.title)}</h3>${badge}
      </div>
      <p class="cert-card__meta"><b>${st.count}</b> / ${st.required} mavzu${avg}</p>
      <div class="of-progress ${status === "issued" ? "of-progress--success" : ""}" role="progressbar" aria-label="${esc(section.title)} progressi" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${st.percent}" style="--value:${st.percent}"><span></span></div>
      <div class="cert-card__foot">${foot}</div>
    </li>`;
}

function pendingCard(p) {
  return `
    <li class="of-card cert-card" data-state="soon">
      <div class="cert-card__head"><span class="cert-card__icon">${icon("lock")}</span><h3>${esc(p.title)}</h3><span class="of-badge">Tez orada</span></div>
      <p class="cert-card__meta">Bu bo‘lim testlari hali tayyorlanmoqda. Testlar qo‘shilgach, sertifikat ham beriladi.</p>
    </li>`;
}

function renderSections() {
  const box = $("[data-sections]");
  box.innerHTML = CERT_SECTIONS.map(sectionCard).join("") + CERT_PENDING_SECTIONS.map(pendingCard).join("");
  box.removeAttribute("aria-busy");

  const have = CERT_FULL.sections.filter((id) => state.indexes[id]).length;
  const total = CERT_FULL.sections.length;
  const full = state.indexes[CERT_FULL.id];
  const ready = have === total && !full;
  const checks = CERT_FULL.sections.map((id) => {
    const title = CERT_SECTIONS.find((s) => s.id === id).title;
    return `<li class="${state.indexes[id] ? "is-done" : ""}">${icon(state.indexes[id] ? "checkCircle" : "lock")}<span>${esc(title)}</span></li>`;
  }).join("");
  $("[data-full]").innerHTML = `
    <div class="of-card cert-full" data-state="${full ? "issued" : ready ? "ready" : "progress"}">
      <div class="cert-full__main">
        <span class="cert-card__icon cert-card__icon--lg">${icon(full ? "trophy" : "certificate")}</span>
        <div>
          <h3>${esc(CERT_FULL.title)} — to‘liq kurs</h3>
          <p class="of-muted">${full ? "Siz butun kursni muvaffaqiyatli yakunladingiz. Tabriklaymiz!" : "Barcha bo‘lim sertifikatlarini olganingizdan so‘ng, to‘liq kurs sertifikati beriladi."}</p>
        </div>
      </div>
      <ul class="cert-full__checks">${checks}</ul>
      <div class="cert-card__foot">
        ${full
          ? `<button type="button" class="of-btn of-btn--soft" data-act="view" data-id="${CERT_FULL.id}">${icon("trophy")}Sertifikatni ko‘rish</button>`
          : ready
            ? `<button type="button" class="of-btn of-btn--primary" data-act="issue" data-id="${CERT_FULL.id}">${icon("trophy")}Sertifikatni olish</button>`
            : `<span class="of-badge">${have} / ${total} bo‘lim sertifikati</span>`}
      </div>
    </div>`;
}

// ------------------------------------------------------------ Ko'rish
async function viewCertificate(id) {
  const index = state.indexes[id];
  if (!index) return;
  const cert = await getCertificate(index.certId);
  if (!cert) { toast("Sertifikat topilmadi."); return; }
  showCertificateModal(cert);
}

async function showCertificateModal(cert) {
  const holder = document.createElement("div");
  holder.className = "cert-preview";
  holder.innerHTML = '<span class="of-skeleton" style="height:240px;width:100%"></span>';
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${cert.courseTitle} sertifikati — ${cert.fullName}, raqam ${cert.number}`);
  let ready = false;
  renderCertificate(cert, { canvas }).then(() => { holder.replaceChildren(canvas); ready = true; }).catch((e) => {
    console.error("[sertifikat] chizishda xato:", e);
    holder.textContent = "Sertifikatni chizib bo‘lmadi.";
  });
  openModal({
    title: "Sertifikat",
    text: `Raqam: ${cert.number}`,
    content: holder,
    className: "cert-modal",
    actions: [
      { label: "PDF yuklab olish", variant: "primary", onClick: async () => { if (ready) await downloadPdf(cert, canvas); } },
      { label: "PNG yuklab olish", variant: "soft", onClick: async () => { if (ready) await downloadPng(cert, canvas); } },
      {
        label: "Tekshirish havolasini nusxalash", variant: "ghost",
        onClick: async () => {
          try { await navigator.clipboard.writeText(verifyLink(cert.number)); toast("Havola nusxalandi."); }
          catch { toast(verifyLink(cert.number), { timeout: 8000 }); }
        },
      },
    ],
  });
}

// ------------------------------------------------------------ Olish
function confirmIssue(id) {
  const title = id === CERT_FULL.id ? CERT_FULL.title : CERT_SECTIONS.find((s) => s.id === id).title;
  const name = profileFullName(state.profile);
  if (!name) {
    openModal({
      title: "Avval ismingizni to‘ldiring",
      text: "Sertifikat profildagi ism-familiya bilan beriladi. Profilingizda ism va familiya to‘liq kiritilmagan.",
      iconName: "info",
      actions: [{ label: "Profilni tahrirlash", variant: "primary", href: `${ROOT_PREFIX}dashboard/settings.html#profile` }],
    });
    return;
  }
  const content = document.createElement("p");
  content.className = "cert-confirm";
  content.innerHTML = `Sertifikatdagi ism: <b></b>`;
  content.querySelector("b").textContent = name;
  const modal = openModal({
    title: `«${title}» sertifikati`,
    text: "Ism berilgandan keyin o‘zgartirib bo‘lmaydi. Iltimos, to‘g‘riligini tekshiring.",
    iconName: "certificate",
    content,
    actions: [
      {
        label: "Tasdiqlash va olish", variant: "primary",
        onClick: async (event) => {
          const btn = event.currentTarget;
          btn.disabled = true;
          btn.textContent = "Berilmoqda…";
          try {
            const { cert, created } = await issueCertificate(id, state.profile);
            state.indexes = await getIndexes();
            renderSections();
            modal.close();
            toast(created ? "Tabriklaymiz! Sertifikat berildi." : "Sertifikat allaqachon berilgan.");
            showCertificateModal(cert);
          } catch (error) {
            console.error("[sertifikat] berilmadi:", error);
            btn.disabled = false;
            btn.textContent = "Tasdiqlash va olish";
            toast(error?.code === "permission-denied"
              ? "Sertifikat berilmadi: shartlar hali bajarilmagan yoki natijalar tekshiruvdan o‘tmadi."
              : friendlyError(error));
          }
        },
      },
      { label: "Profilni tahrirlash", variant: "ghost", href: `${ROOT_PREFIX}dashboard/settings.html#profile` },
    ],
  });
}

// ------------------------------------------------------------ Yuklash
async function loadAll() {
  const [indexes, ...docs] = await Promise.all([getIndexes(), ...CERT_SECTIONS.map((s) => getProgress(s.id))]);
  state.indexes = indexes;
  CERT_SECTIONS.forEach((s, i) => { state.progress[s.id] = docs[i]; });
}

async function runSync() {
  const key = `oliyfizika:cert-sync:${state.uid}`;
  try { if (sessionStorage.getItem(key)) return; } catch { /* storage yo'q */ }
  const box = $("[data-sync]");
  const bar = $("[data-sync-bar]");
  const text = $("[data-sync-text]");
  try {
    const result = await syncProgress({
      onStep: (i, n) => {
        box.hidden = false;
        const pct = Math.round((i / n) * 100);
        text.textContent = `Natijalaringiz tekshirilmoqda… ${i} / ${n}`;
        bar.setAttribute("aria-valuenow", String(pct));
        bar.style.setProperty("--value", String(pct));
      },
    });
    if (!result.failed) { try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ } }
    else showAlert("Ba’zi natijalarni tekshirib bo‘lmadi. Sahifani keyinroq yangilab ko‘ring.");
    if (result.added) await loadAll();
  } finally {
    box.hidden = true;
  }
}

async function init(session) {
  if (state.busy || state.uid === session.user.uid) return;
  state.uid = session.user.uid;
  state.profile = session.profile;
  state.busy = true;
  try {
    showAlert("");
    await loadAll();
    renderSections();
    await runSync();
    renderSections();
  } catch (error) {
    console.error("[sertifikat] yuklanmadi:", error);
    showAlert("Sertifikat ma’lumotlarini yuklab bo‘lmadi. Internet aloqasini tekshirib, sahifani yangilang.");
    state.uid = null;
  } finally {
    state.busy = false;
  }
}

page.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-act]");
  if (!btn) return;
  if (btn.dataset.act === "issue") confirmIssue(btn.dataset.id);
  if (btn.dataset.act === "view") viewCertificate(btn.dataset.id).catch((e) => { console.error(e); toast(friendlyError(e)); });
});

onSession((s) => {
  if (s.status === "authenticated" && s.profileLoaded) init(s);
});
