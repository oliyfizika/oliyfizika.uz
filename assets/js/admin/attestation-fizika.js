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
import { listAllTests, publishTest, archiveTest, unarchiveTest, listAttemptsForTest, uploadFigure } from "../attestatsiya-fizika/api.js";
import { COL, SETTINGS_DOC, nextMidnightTashkent, formatTashkent } from "../attestatsiya-fizika/core.js";
import { showQuestionStats } from "./attestation-question-stats.js";
import { toggleAttempts, changeVersion, exportExcel, resetAttempts, detailsRow } from "./attestation-attempts.js";
import { finalizeOverdueList } from "../attestatsiya-fizika/finalize.js";

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
  const cur = settings.figureBackend || "storage";
  const next = cur === "storage" ? "firestore" : "storage";
  // Tugma joriy (serverdagi) qiymatni va aniq maqsadni ko'rsatadi — «almashtirish» ikki marta bosilsa qaytib ketardi
  $("[data-backend]").textContent = `Rasm manbai: ${cur} → «${next}» ga o‘tkazish`;
  $("[data-backend]").dataset.current = cur;
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
  resetAttempts();
  body.innerHTML = tests.map((t) => {
    const action = t.status === "draft"
      ? `<button type="button" class="of-btn of-btn--primary of-btn--sm" data-publish="${esc(t.id)}">PUBLISH</button>`
      : t.status === "published" ? `<button type="button" class="of-btn of-btn--sm" data-archive="${esc(t.id)}">Archive</button>`
      : t.status === "archived" ? `<button type="button" class="of-btn of-btn--sm" data-unarchive="${esc(t.id)}">Arxivdan chiqarish</button>` : "—";
    return `<tr>
      <td data-label="Day" class="of-num"><b>${t.dayNumber}</b></td>
      <td data-label="Section">${esc(t.sectionTitle)}</td>
      <td data-label="Topics"><span class="of-admin-sub">${esc(t.topics.join(", "))}</span></td>
      <td data-label="Savollar" class="of-num">${t.questionCount}<br><span class="of-admin-sub">${t.scorableCount} ballga</span></td>
      <td data-label="Status">${STATUS[t.status] || esc(t.status)}</td>
      <td data-label="Publish date">${t.publishedAt ? esc(formatTashkent(t.publishedAt)) : "—"}</td>
      <td data-label="Solution date">${t.solutionAvailableAt ? esc(formatTashkent(t.solutionAvailableAt)) : "—"}</td>
      <td data-label="Urinishlar">${t.status === "draft" && !t.publishedAt ? "—" : `<div class="att-row-actions">${t.status === "draft" ? "" : `<button type="button" class="of-btn of-btn--ghost of-btn--sm" data-action="view-attempts" data-test-id="${esc(t.id)}" data-attempts="${esc(t.id)}" aria-expanded="false">Ko‘rish</button>`}<button type="button" class="of-btn of-btn--ghost of-btn--sm" data-qstats="${esc(t.id)}">Savollar statistikasi</button></div>`}</td>
      <td data-label="Action">${action}</td></tr>${t.status === "draft" ? "" : detailsRow(t, 9)}`;
  }).join("");
}

body.addEventListener("click", async (e) => {
  const pub = e.target.closest("[data-publish]");
  const arc = e.target.closest("[data-archive]");
  const unarc = e.target.closest("[data-unarchive]");
  const att = e.target.closest('[data-action="view-attempts"]');
  const exp = e.target.closest("[data-att-export]");
  const qst = e.target.closest("[data-qstats]");
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
  if (unarc) {
    const t = tests.find((x) => x.id === unarc.dataset.unarchive);
    if (!t || t.status !== "archived") {
      toast("Faqat arxivlangan kunni arxivdan chiqarish mumkin.");
      return;
    }
    const ok = await confirmAction({
      title: `Day ${t.dayNumber} ni arxivdan chiqarib, draft holatiga qaytarishni xohlaysizmi?`,
      text: `Faqat holat o‘zgaradi (archived → draft). Versiya (v${t.currentVersion}), savollar, mavjud urinishlar va natijalar o‘zgarmaydi. Draft holatida test foydalanuvchilarga ko‘rinmaydi; qayta e’lon qilish — alohida PUBLISH bilan.`,
      confirmLabel: "Arxivdan chiqarish",
    });
    if (!ok) return;
    unarc.classList.add("is-loading");
    try {
      await unarchiveTest(t);
      toast(`Day ${t.dayNumber} arxivdan chiqarildi va draft holatiga qaytarildi.`);
      await load();
    } catch (err) {
      unarc.classList.remove("is-loading");
      toast(errorText(err, `Day ${t.dayNumber} ni arxivdan chiqarib bo‘lmadi. Holat o‘zgarmadi.`));
    }
  }
  if (qst) showQuestionStats(tests.find((x) => x.id === qst.dataset.qstats));
  if (att) toggleAttempts(tests.find((x) => x.id === att.dataset.testId), att, body);
  if (exp) exportExcel(tests.find((x) => x.id === exp.dataset.attExport), exp);
});

body.addEventListener("change", (e) => {
  const sel = e.target.closest("[data-att-version]");
  if (sel) changeVersion(tests.find((x) => x.id === sel.dataset.attVersion), sel);
});


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
    // Hisoblar bundle'ning o'zida e'lon qilinadi (tiklangan kalitlar auto sonini o'zgartiradi); eski bundle — 865
    const c = data.counts || { auto: 865, open: 81, unreliable: 81 };
    if (q !== 1027 || p !== 1027 || t !== 32 || auto !== c.auto || c.auto + c.open + c.unreliable !== 1027) {
      throw new Error(`hisob mos emas: ${q}/${p}/${t}/${auto} (kutilgan auto ${c.auto})`);
    }
    const bad = preflightNestedArrays(data.ops);
    if (bad.length) {
      console.error("[admin] nested arrays:", bad);
      info.textContent = nestedArrayError(bad).message;
      return;
    }
    bundle = data;
    info.textContent = `Tekshirildi: 1027 savol (${auto} auto), 32 kunlik test, ${data.ops.length} operatsiya · planHash ${data.planHash}. Dry-run uchun «Import qilish» ni bosing.`;
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

/** Firestore muqobili tayyormi: har bir testda figures/solutionFigures hujjatlari soni (faqat hisob, ma'lumot yuklanmaydi). */
async function firestoreFiguresReady() {
  const { collection, getCountFromServer } = fb.fsSdk;
  const missing = [];
  for (const t of tests) {
    const n = (await getCountFromServer(collection(fb.db, COL.tests, t.id, "figures"))).data().count;
    if (n < (t.figureCount || 0)) missing.push(`Day ${t.dayNumber}: ${n}/${t.figureCount}`);
  }
  return missing;
}

$("[data-backend]").addEventListener("click", async () => {
  await loadSettings();                                   // serverdagi haqiqiy qiymat
  const cur = settings.figureBackend || "storage";
  const next = cur === "storage" ? "firestore" : "storage";
  let note = "Foydalanuvchilar rasmlarni shu manbadan oladi.";
  if (next === "firestore") {
    try {
      const missing = await firestoreFiguresReady();
      if (missing.length) {
        toast(`Firestore rasm hujjatlari to‘liq emas: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}. Avval «Firestore'ga yozish».`);
        return;
      }
      note += " Barcha kunlar uchun Firestore rasm hujjatlari tekshirildi.";
    } catch (err) {
      toast(errorText(err));
      return;
    }
  } else {
    note += " Storage'ga rasmlar yuklangan va bucket ishlayotganiga ishonch hosil qiling.";
  }
  const ok = await confirmAction({ title: `Rasm manbai: «${cur}» → «${next}»?`, text: note, confirmLabel: `«${next}» ga o‘tkazish` });
  if (!ok) return;
  try {
    await updateDoc(doc(fb.db, COL.settings, SETTINGS_DOC), { figureBackend: next });
    await loadSettings();
    const saved = settings.figureBackend || "storage";
    toast(saved === next ? `Saqlandi: rasm manbai — ${saved}` : `Diqqat: serverda hali «${saved}»`);
  } catch (err) {
    toast(errorText(err));
  }
});

await load();
await sweepOverdueAttempts();

/**
 * Avtomatik yakunlash (lazy, admin): yechim vaqti o'tgan, lekin yakunlanmagan rasmiy urinishlar (foydalanuvchi qaytmagan
 * bo'lsa ham) sahifa ochilganda yakunlanadi va baholanadi. Qaror Rules'da (server vaqti >= solutionAvailableAt).
 */
async function sweepOverdueAttempts() {
  try {
    const { collection, query, where, getDocs } = fb.fsSdk;
    const snap = await getDocs(query(collection(fb.db, COL.attempts), where("status", "in", ["in_progress", "submitted"])));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const { finalized, graded } = await finalizeOverdueList(list, new Map(tests.map((t) => [t.id, t])));
    const msg = [finalized ? `${finalized} ta yakunlanmagan urinish yechim vaqti kelgani uchun avtomatik yakunlandi va baholandi` : "",
      graded ? `${graded} ta topshirilgan urinish baholandi` : ""].filter(Boolean).join("; ");
    if (msg) toast(`${msg}.`);
  } catch (err) {
    console.warn("[admin] avtomatik yakunlash:", err?.code || err);
  }
}

// ------------------------------------------------------------------ 3. Canonical yangilanish (migratsiya / rollback)
// Fayl: tools/attestatsiya-fizika/migration_plan.py natijasi. Faqat ruxsat etilgan yo'llar; o'chirish yo'q;
// urinishlar va sozlamalar taqiqlangan. Idempotent: create — mavjud bo'lsa o'tkaziladi; patch — `requires` mos bo'lsa.
const MIG_PATH_OK = [
  /^attestationPhysicsQuestions\/[A-Za-z0-9_-]+$/,
  /^attestationPhysicsQuestions\/[A-Za-z0-9_-]+\/private\/answer$/,
  /^attestationPhysicsDailyTests\/[A-Za-z0-9_-]+$/,
  /^attestationPhysicsDailyTests\/[A-Za-z0-9_-]+\/(versions|keys|solutions)\/v\d+$/,
  /^attestationPhysicsDailyTests\/[A-Za-z0-9_-]+\/(figures|solutionFigures)\/[A-Za-z0-9_.-]+$/,
];
let mig = null;

function validateMigration(data) {
  if (!["oliyfizika-attestation-migration", "oliyfizika-attestation-rollback"].includes(data.format) || !Array.isArray(data.ops)) {
    throw new Error("format: migration.json yoki rollback.json kerak");
  }
  for (const o of data.ops) {
    if (!["create", "update", "patch"].includes(o.op)) throw new Error(`ruxsat etilmagan amal: ${o.op}`);
    if (!MIG_PATH_OK.some((re) => re.test(o.path))) throw new Error(`ruxsat etilmagan yo‘l: ${o.path}`);
    if (o.op === "patch" && !/^attestationPhysicsDailyTests\/[^/]+$/.test(o.path)) throw new Error(`patch faqat test meta uchun: ${o.path}`);
  }
  const bad = preflightNestedArrays(data.ops);
  if (bad.length) throw nestedArrayError(bad);
}

async function attemptSummary(testId) {
  const list = await listAttemptsForTest(testId);
  const users = new Set(list.map((a) => a.userId));
  const by = (s) => list.filter((a) => a.status === s).length;
  return { total: list.length, users: users.size, graded: by("graded"), inProgress: by("in_progress"), submitted: by("submitted"),
           userIds: [...users] };
}

$("[data-mig]").addEventListener("change", async (e) => {
  const info = $("[data-mig-info]");
  mig = null;
  $("[data-mig-apply]").disabled = true;
  try {
    const data = JSON.parse(await e.target.files[0].text());
    validateMigration(data);
    const kinds = {};
    for (const o of data.ops) kinds[o.op] = (kinds[o.op] || 0) + 1;
    const patches = data.ops.filter((o) => o.op === "patch");
    const lines = [`<p>${esc(data.format === "oliyfizika-attestation-rollback" ? "ROLLBACK" : "Migratsiya")}: <b>${data.ops.length}</b> amal
      (${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(", ")}) · ${esc(data.from || "")} → ${esc(data.to || "")} · hash ${esc(data.hash || "")}</p>`];
    for (const p of patches) {
      const tid = p.path.split("/")[1];
      const t = tests.find((x) => x.id === tid);
      const s = await attemptSummary(tid);
      const cur = t?.currentVersion;
      const ok = Object.entries(p.requires || {}).every(([k, v]) => t?.[k] === v);
      lines.push(`<p data-mig-test="${esc(tid)}"><b>Day ${t?.dayNumber ?? "?"}</b> (${esc(t?.status || "?")}): versiya ${cur} → ${p.data.currentVersion}
        ${ok ? "" : " — <b>talab mos emas, o‘tkazib yuboriladi</b>"} · urinishlar: <b data-mig-attempts>${s.total}</b>
        (userlar ${s.users}; graded ${s.graded}, jarayonda ${s.inProgress}) — ular o‘zgarmaydi va eski versiyada qoladi.
        ${s.userIds.length ? `<br><span class="of-subtle">uid: ${s.userIds.slice(0, 10).map((u) => esc(u.slice(-6))).join(", ")}${s.userIds.length > 10 ? "…" : ""}</span>` : ""}</p>`);
    }
    info.innerHTML = lines.join("");
    mig = data;
    $("[data-mig-apply]").disabled = false;
  } catch (err) {
    info.textContent = `Fayl yaroqsiz: ${err.message}. Hech narsa yozilmadi.`;
  }
});

$("[data-mig-apply]").addEventListener("click", async (e) => {
  if (!mig) return;
  const btn = e.currentTarget;
  const info = $("[data-mig-info]");
  const bar = $("[data-mig-bar]");
  const reopen = $("[data-mig-reopen]").checked;
  const ok = await confirmAction({
    title: "Migratsiyani qo‘llaysizmi?",
    text: `${mig.ops.length} amal. E’lon qilingan kunlar yangi versiyaga o‘tadi (eski versiya va urinishlar saqlanadi)${reopen ? ", yechim vaqti keyingi 00:00 ga suriladi" : ""}. Hech narsa o‘chirilmaydi.`,
    confirmLabel: "Qo‘llash",
  });
  if (!ok) return;
  const { getDoc, setDoc, updateDoc, Timestamp } = fb.fsSdk;
  btn.classList.add("is-loading");
  bar.hidden = false;
  let done = 0, skipped = 0;
  try {
    for (const o of mig.ops) {
      const ref = doc(fb.db, ...o.path.split("/"));
      if (o.op === "create") {
        if ((await getDoc(ref)).exists()) skipped++;
        else await setDoc(ref, o.data);
      } else if (o.op === "update") {
        await setDoc(ref, o.data);
      } else {
        const cur = (await getDoc(ref)).data() || {};
        if (Object.entries(o.requires || {}).some(([k, v]) => cur[k] !== v)) {
          skipped++;
        } else {
          const patch = { ...o.data };
          if (o.solutionAvailableAt === "nextMidnightTashkent" && reopen) patch.solutionAvailableAt = Timestamp.fromDate(nextMidnightTashkent(new Date()));
          await updateDoc(ref, patch);
        }
      }
      done++;
      if (done % 10 === 0 || done === mig.ops.length) {
        bar.style.setProperty("--value", Math.round((done * 100) / mig.ops.length));
        bar.setAttribute("aria-valuenow", Math.round((done * 100) / mig.ops.length));
        info.textContent = `Yozilmoqda… ${done}/${mig.ops.length} (o‘tkazib yuborildi ${skipped})`;
      }
    }
    info.textContent = `Tayyor: ${done} amal, o‘tkazib yuborildi ${skipped}.`;
    toast("Migratsiya qo‘llandi.");
    await load();
  } catch (err) {
    info.textContent = `To‘xtadi: ${done}/${mig.ops.length} — ${errorText(err, "Migratsiya xatosi.")} Qayta ishga tushirish xavfsiz.`;
  } finally {
    btn.classList.remove("is-loading");
  }
});
