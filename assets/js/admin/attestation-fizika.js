// ==========================================================================
// Admin: Attestatsiya → Fizika → Kunlik testlar (admin/attestatsiya-fizika.html)
//  • 32 kun jadvali: Day · Section · Topics · Savollar · Status · Publish date · Solution date · Urinishlar · Action
//  • PUBLISH (draft → published): publishedAt = server vaqti, solutionAvailableAt = ertasi 00:00 (Toshkent).
//    Bildirishnoma: test hujjatidagi `notification` payload + publishedAt — foydalanuvchilarning bildirishnomalar
//    markazi shundan "Bugungi attestatsiya testi tayyor!" yozuvini hosil qiladi (yangi infratuzilma yo'q).
//  • ARCHIVE (published → archived): yashiriladi, o'chirilmaydi.
//  • Import: firestore-import.json (savollar + testlar), Storage rasmlari, Firestore rasm muqobili.
// Xavfsizlik — Rules'da (isAdmin). Bu sahifa faqat qulay interfeys.
// ==========================================================================
import { requireAdmin, $, esc, fillIcons, stateBox, errorText, confirmAction } from "./admin-common.js";
import { toast } from "../ui/feedback.js";
import { listAllTests, publishTest, archiveTest, listAttemptsForTest, uploadFigure } from "../attestatsiya-fizika/api.js";
import { COL, SETTINGS_DOC, nextMidnightTashkent, formatTashkent, formatDuration, toMs } from "../attestatsiya-fizika/core.js";

fillIcons($("#adminPage"));
const { fb } = await requireAdmin();
const { doc, getDoc, setDoc, writeBatch, updateDoc } = fb.fsSdk;

const body = $("[data-body]");
const note = $("[data-note]");
let tests = [];
let settings = {};

const STATUS = {
  draft: '<span class="of-badge of-admin-badge--off">draft</span>',
  published: '<span class="of-badge of-badge--green">published</span>',
  archived: '<span class="of-badge">archived</span>',
};

async function loadSettings() {
  const snap = await getDoc(doc(fb.db, COL.settings, SETTINGS_DOC));
  settings = snap.exists() ? snap.data() : {};
  $('[data-stat="access"]').textContent = settings.accessMode || "—";
  $("[data-backend]").textContent = `Rasm manbai: ${settings.figureBackend || "storage"} (almashtirish)`;
}

async function load() {
  try {
    await loadSettings();
    tests = await listAllTests();
  } catch (e) {
    body.innerHTML = `<tr><td colspan="9">${stateBox("error", "Yuklab bo‘lmadi", errorText(e))}</td></tr>`;
    return;
  }
  const count = (s) => tests.filter((t) => t.status === s).length;
  $('[data-stat="total"]').textContent = tests.length;
  $('[data-stat="published"]').textContent = count("published") + count("archived");
  $('[data-stat="draft"]').textContent = count("draft");
  if (!tests.length) {
    body.innerHTML = `<tr><td colspan="9">${stateBox("empty", "Hali import qilinmagan", "Pastdagi «Import» bo‘limida firestore-import.json faylini tanlang.")}</td></tr>`;
    return;
  }
  const nextDraft = tests.find((t) => t.status === "draft");
  note.textContent = nextDraft ? `Keyingi e’lon qilinadigan kun: Day ${nextDraft.dayNumber}.` : "Barcha kunlar e’lon qilingan.";
  body.innerHTML = tests.map((t) => {
    const action = t.status === "draft"
      ? `<button type="button" class="of-btn of-btn--primary of-btn--sm" data-publish="${esc(t.id)}">PUBLISH</button>`
      : t.status === "published" ? `<button type="button" class="of-btn of-btn--sm" data-archive="${esc(t.id)}">Archive</button>` : "—";
    return `<tr>
      <td data-label="Day" class="of-num"><b>${t.dayNumber}</b></td>
      <td data-label="Section">${esc(t.sectionTitle)}</td>
      <td data-label="Topics"><span class="of-admin-sub">${esc(t.topics.join(", "))}</span></td>
      <td data-label="Savollar" class="of-num">${t.questionCount}<br><span class="of-admin-sub">${t.scorableCount} ballga</span></td>
      <td data-label="Status">${STATUS[t.status] || esc(t.status)}</td>
      <td data-label="Publish date">${t.publishedAt ? esc(formatTashkent(t.publishedAt)) : "—"}</td>
      <td data-label="Solution date">${t.solutionAvailableAt ? esc(formatTashkent(t.solutionAvailableAt)) : "—"}</td>
      <td data-label="Urinishlar">${t.status === "draft" ? "—" : `<button type="button" class="of-btn of-btn--ghost of-btn--sm" data-attempts="${esc(t.id)}">Ko‘rish</button>`}</td>
      <td data-label="Action">${action}</td></tr>`;
  }).join("");
}

body.addEventListener("click", async (e) => {
  const pub = e.target.closest("[data-publish]");
  const arc = e.target.closest("[data-archive]");
  const att = e.target.closest("[data-attempts]");
  if (pub) {
    const t = tests.find((x) => x.id === pub.dataset.publish);
    const solAt = nextMidnightTashkent(new Date());
    const nextDraft = tests.find((x) => x.status === "draft");
    const order = nextDraft && nextDraft.id !== t.id ? ` Diqqat: navbatdagi kun Day ${nextDraft.dayNumber}, siz Day ${t.dayNumber} ni tanladingiz.` : "";
    const ok = await confirmAction({
      title: `Day ${t.dayNumber} testini foydalanuvchilarga e’lon qilishni xohlaysizmi?`,
      text: `${t.sectionTitle} · ${t.topics.join(", ")} · ${t.questionCount} savol. Test darhol ochiladi; yechimlar ${formatTashkent(solAt)} da (Toshkent) ochiladi. Bu amalni ortga qaytarib bo‘lmaydi (faqat arxivlash mumkin).${order}`,
      confirmLabel: "PUBLISH",
    });
    if (!ok) return;
    pub.classList.add("is-loading");
    try {
      await publishTest(t, solAt);
      document.dispatchEvent(new CustomEvent("of:attestation-published", { detail: { testId: t.id, dayNumber: t.dayNumber, notification: t.notification } }));
      toast(`Day ${t.dayNumber} e’lon qilindi.`);
      await load();
    } catch (err) {
      pub.classList.remove("is-loading");
      toast(errorText(err, "E’lon qilib bo‘lmadi."));
    }
  }
  if (arc) {
    const t = tests.find((x) => x.id === arc.dataset.archive);
    const ok = await confirmAction({
      title: `Day ${t.dayNumber} testini arxivlaysizmi?`,
      text: "Test «Bugungi test»dan olib tashlanadi va yangi rasmiy urinish boshlab bo‘lmaydi. Natijalar va yechimlar saqlanadi (hech narsa o‘chirilmaydi).",
      confirmLabel: "Arxivlash", danger: true,
    });
    if (!ok) return;
    try {
      await archiveTest(t);
      toast(`Day ${t.dayNumber} arxivlandi.`);
      await load();
    } catch (err) {
      toast(errorText(err, "Arxivlab bo‘lmadi."));
    }
  }
  if (att) showAttempts(tests.find((x) => x.id === att.dataset.attempts));
});

async function showAttempts(t) {
  const panel = $("[data-attempts-panel]");
  const box = $("[data-attempts]");
  panel.hidden = false;
  $("[data-attempts-title]").textContent = `Day ${t.dayNumber} — urinishlar`;
  box.innerHTML = '<p class="of-subtle">Yuklanmoqda…</p>';
  try {
    const list = (await listAttemptsForTest(t.id)).sort((a, b) => (toMs(b.completedAt) || 0) - (toMs(a.completedAt) || 0));
    if (!list.length) { box.innerHTML = stateBox("empty", "Hali urinish yo‘q"); return; }
    const graded = list.filter((a) => a.status === "graded");
    const avg = graded.length ? Math.round(graded.reduce((s, a) => s + a.scorePercent, 0) / graded.length) : null;
    box.innerHTML = `<p class="of-subtle">Jami ${list.length} · baholangan ${graded.length}${avg == null ? "" : ` · o‘rtacha ${avg}%`}</p>
      <div class="of-admin-table-wrap"><table class="of-admin-table"><thead><tr><th>Foydalanuvchi</th><th>Holat</th><th>Natija</th><th>T/N/J</th><th>Vaqt</th><th>Topshirilgan</th></tr></thead><tbody>
      ${list.map((a) => `<tr><td data-label="Foydalanuvchi"><a href="user.html?id=${encodeURIComponent(a.userId)}">${esc(a.userId)}</a></td>
        <td data-label="Holat">${esc(a.status)}</td><td data-label="Natija" class="of-num">${a.status === "graded" ? `${a.scorePercent}%` : "—"}</td>
        <td data-label="T/N/J" class="of-num">${a.status === "graded" ? `${a.correctAnswers}/${a.wrongAnswers}/${a.unanswered}` : "—"}</td>
        <td data-label="Vaqt">${a.status === "graded" ? esc(formatDuration(a.timeSpentSeconds)) : "—"}</td>
        <td data-label="Topshirilgan">${a.completedAt ? esc(formatTashkent(a.completedAt)) : "—"}</td></tr>`).join("")}
      </tbody></table></div>`;
  } catch (err) {
    box.innerHTML = stateBox("error", "Yuklab bo‘lmadi", errorText(err));
  }
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ------------------------------------------------------------------ Firestore preflight
// Firestore massiv ichida massivni saqlamaydi (batch.set() "Nested arrays are not supported" bilan rad etadi).
// Import fayli Firestore'ga yozishdan OLDIN to'liq tekshiriladi; topilsa — hech narsa yozilmaydi.
function nestedArrayPath(v, path = "", inArray = false) {
  if (Array.isArray(v)) {
    if (inArray) return path;
    for (let i = 0; i < v.length; i++) {
      const p = nestedArrayPath(v[i], `${path}[${i}]`, true);
      if (p) return p;
    }
    return null;
  }
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      const p = nestedArrayPath(x, path ? `${path}.${k}` : k, false);
      if (p) return p;
    }
  }
  return null;
}
function preflightNestedArrays(ops) {
  const bad = [];
  for (const o of ops) {
    const p = nestedArrayPath(o.data);
    if (p) bad.push(`${o.path} → ${p}`);
  }
  return bad;
}
function nestedArrayError(bad) {
  return new Error(`Firestore massiv ichidagi massivni qabul qilmaydi: ${bad.length} ta hujjatda topildi (birinchisi: ${bad[0]}). `
    + "Import fayli eski formatda — prepare_attestation_data.py ni qayta ishga tushirib, yangi firestore-import.json ni tanlang. Hech narsa yozilmadi.");
}

// ------------------------------------------------------------------ Import 1: savollar + testlar
let bundle = null;
$("[data-bundle]").addEventListener("change", async (e) => {
  const info = $("[data-bundle-info]");
  bundle = null;
  $("[data-import]").disabled = true;
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (data.format !== "oliyfizika-attestation-import" || !Array.isArray(data.ops)) throw new Error("format");
    const count = (re) => data.ops.filter((o) => re.test(o.path)).length;
    const q = count(/^attestationPhysicsQuestions\/[^/]+$/);
    const p = count(/^attestationPhysicsQuestions\/[^/]+\/private\/answer$/);
    const t = count(/^attestationPhysicsDailyTests\/[^/]+$/);
    const auto = data.ops.filter((o) => /^attestationPhysicsQuestions\/[^/]+$/.test(o.path) && o.data.evaluationType === "auto").length;
    if (q !== 1027 || p !== 1027 || t !== 32 || auto !== 865) throw new Error(`hisob mos emas: ${q}/${p}/${t}/${auto}`);
    const bad = preflightNestedArrays(data.ops);
    if (bad.length) {
      console.error("[admin] nested arrays:", bad);
      info.textContent = nestedArrayError(bad).message;
      return;
    }
    bundle = data;
    info.textContent = `Tekshirildi: 1027 savol (865 auto), 32 kunlik test, ${data.ops.length} operatsiya · planHash ${data.planHash}. Dry-run uchun «Import qilish» ni bosing.`;
    $("[data-import]").disabled = false;
  } catch (err) {
    info.textContent = `Fayl yaroqsiz (${err.message}). _private/attestatsiya-fizika/firestore-import.json ni tanlang.`;
  }
});

$("[data-import]").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const info = $("[data-bundle-info]");
  const existing = new Set(tests.map((t) => t.id));
  const settingsExists = Object.keys(settings).length > 0;
  // Mavjud testga tegishli hamma narsa o'tkazib yuboriladi (published/draft holati saqlanadi)
  const ops = bundle.ops.filter((o) => {
    const m = /^attestationPhysicsDailyTests\/([^/]+)/.exec(o.path);
    if (m && existing.has(m[1])) return false;
    if (o.path === `${COL.settings}/${SETTINGS_DOC}` && settingsExists) return false;
    return true;
  });
  const ok = await confirmAction({
    title: "Import qilinsinmi?",
    text: `Yoziladi: ${ops.length} hujjat. O‘tkazib yuboriladi: ${bundle.ops.length - ops.length} (mavjud testlar${settingsExists ? " va sozlamalar" : ""}). Hech narsa o‘chirilmaydi.`,
    confirmLabel: "Import",
  });
  if (!ok) return;
  // Qayta preflight (yozishdan oldin, filtrlangan ro'yxat bo'yicha) — xato bo'lsa batch umuman ochilmaydi
  const bad = preflightNestedArrays(ops);
  if (bad.length) {
    console.error("[admin] nested arrays:", bad);
    info.textContent = nestedArrayError(bad).message;
    return;
  }
  btn.classList.add("is-loading");
  try {
    // Kichik batch'lar: Rules har bir yozuvda isAdmin() uchun get() qiladi; batch uchun get() chegarasi 20.
    const CHUNK = 10;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = writeBatch(fb.db);
      ops.slice(i, i + CHUNK).forEach((o) => batch.set(doc(fb.db, ...o.path.split("/")), o.data));
      await batch.commit();
      info.textContent = `Yozilmoqda… ${Math.min(i + CHUNK, ops.length)}/${ops.length}`;
    }
    info.textContent = `Tayyor: ${ops.length} hujjat yozildi.`;
    toast("Import yakunlandi.");
    await load();
  } catch (err) {
    info.textContent = errorText(err, "Import xatosi.");
  } finally {
    btn.classList.remove("is-loading");
  }
});

// ------------------------------------------------------------------ Import 2: Storage rasmlari
let figFiles = [];
$("[data-figs]").addEventListener("change", (e) => {
  figFiles = [...e.target.files]
    .map((f) => ({ f, path: (f.webkitRelativePath || f.name).replace(/^.*?(attestation-physics\/)/, "$1") }))
    .filter((x) => /^attestation-physics\/(questions|solutions)\/[^/]+\/[0-9a-f]{16}\.(svg|webp|png)$/.test(x.path));
  $("[data-figs-info]").textContent = figFiles.length
    ? `${figFiles.length} ta rasm topildi (kutilgan: 415 = 408 savol + 7 yechim).`
    : "Mos rasm topilmadi. _private/attestatsiya-fizika/storage papkasini tanlang.";
  $("[data-upload]").disabled = !figFiles.length;
});

$("[data-upload]").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const barEl = $("[data-up-bar]");
  barEl.hidden = false;
  btn.classList.add("is-loading");
  let done = 0, uploaded = 0, skipped = 0, failed = 0;
  const queue = figFiles.slice();
  const worker = async () => {
    while (queue.length) {
      const { f, path } = queue.shift();
      const type = path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".png") ? "image/png" : "image/webp";
      try {
        const r = await uploadFigure(path, f, type);
        if (r === "exists") skipped++; else uploaded++;
      } catch (err) {
        failed++;
        console.warn("[admin] upload:", path, err?.code || err);
      }
      done++;
      barEl.style.setProperty("--value", Math.round((done * 100) / figFiles.length));
      barEl.setAttribute("aria-valuenow", Math.round((done * 100) / figFiles.length));
      $("[data-figs-info]").textContent = `${done}/${figFiles.length} · yuklandi ${uploaded} · mavjud ${skipped} · xato ${failed}`;
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  btn.classList.remove("is-loading");
  toast(failed ? `Rasmlar: ${failed} ta xato (konsolga qarang).` : "Rasmlar Storage’ga yuklandi.");
});

// ------------------------------------------------------------------ Muqobil: Firestore rasm hujjatlari
let figBundle = null;
$("[data-figdocs]").addEventListener("change", async (e) => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (data.format !== "oliyfizika-attestation-figures") throw new Error("format");
    if (preflightNestedArrays(data.ops).length) throw new Error("nested");
    figBundle = data;
    $("[data-figdocs-info]").textContent = `${data.ops.length} ta rasm hujjati.`;
    $("[data-figdocs-import]").disabled = false;
  } catch {
    $("[data-figdocs-info]").textContent = "Fayl yaroqsiz (firestore-figures.json kerak).";
  }
});
$("[data-figdocs-import]").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.classList.add("is-loading");
  let written = 0, skipped = 0;
  try {
    for (const o of figBundle.ops) {
      const ref = doc(fb.db, ...o.path.split("/"));
      if ((await getDoc(ref)).exists()) { skipped++; continue; }
      await setDoc(ref, o.data);
      written++;
      $("[data-figdocs-info]").textContent = `Yozildi ${written} · mavjud ${skipped}`;
    }
    toast("Rasm hujjatlari yozildi.");
  } catch (err) {
    $("[data-figdocs-info]").textContent = errorText(err, "Yozib bo‘lmadi.");
  } finally {
    btn.classList.remove("is-loading");
  }
});

$("[data-backend]").addEventListener("click", async () => {
  const next = (settings.figureBackend || "storage") === "storage" ? "firestore" : "storage";
  const ok = await confirmAction({ title: `Rasm manbaini «${next}» ga o‘zgartirasizmi?`, text: "Foydalanuvchilar rasmlarni shu manbadan oladi. Avval tegishli rasmlar yuklanganiga ishonch hosil qiling.", confirmLabel: "O‘zgartirish" });
  if (!ok) return;
  try {
    await updateDoc(doc(fb.db, COL.settings, SETTINGS_DOC), { figureBackend: next });
    await loadSettings();
    toast(`Rasm manbai: ${next}`);
  } catch (err) {
    toast(errorText(err));
  }
});

await load();
