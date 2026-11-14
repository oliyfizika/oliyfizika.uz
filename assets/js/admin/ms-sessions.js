// ==========================================================================
// Admin: Milliy sertifikat → Mock sessiyalar (admin/milliy-sertifikat-sessiyalar.html).
//
//   • Sessiya ochish: msMockSessions/{id} — testId, opensAt..closesAt (Toshkent vaqti kiritiladi), durationMinutes.
//   • «Hozir yopish»: closesAt = hozir (yangi ishtirokchi boshlay olmaydi; boshlaganlar o'z vaqti ichida tugatadi).
//   • «Yakunlash va natijani hisoblash»: msMockAttempts (sessionId ==) → finalize-core.computeSessionResults() (Rasch JMLE)
//     → har bir urinishga result + status 'published', darajasi borlarga msMockCertificates/{certNo}, sessiya 'finalized'.
//     Qayta hisoblash mumkin (masalan, kalitda xato tuzatilsa) — sertifikat raqamlari saqlanib qoladi.
//   • Erkin mashq: msMockSettings/config.practiceTests.
// Xavfsizlik — firestore.rules (canManage('milliy-sertifikat')). Kirish huquqlari (mockTestsAccess) va pullik
// yechimlar bilan aloqasi yo'q.
// ==========================================================================
import { requireAdmin, $, esc, fillIcons, stateBox, errorText, confirmAction, num } from "./admin-common.js";
import { auditEntry } from "./audit-log.js";
import { toast } from "../ui/feedback.js";
import { computeSessionResults } from "../../../milliy-sertifikat/mock-testlar/js/finalize-core.js";
import { sessionPhase, toMs, COL } from "../../../milliy-sertifikat/mock-testlar/js/session-service.js";
import { MIN_PARTICIPANTS, RECOMMENDED_PARTICIPANTS } from "../../../milliy-sertifikat/mock-testlar/js/rasch.js";
import { listImportedTests, loadImportedTest } from "../../../milliy-sertifikat/mock-testlar/js/remote-test.js";

const DATA = "../milliy-sertifikat/mock-testlar/";
const TZ_OFFSET_MS = 5 * 3600 * 1000; // Asia/Tashkent, UTC+5 (yozgi vaqt yo'q)

fillIcons($("#adminPage"));
const { fb, state: sessionState } = await requireAdmin({ section: "milliy-sertifikat" });
const fs = fb.fsSdk;
const db = fb.db;

const bodyEl = $("[data-body]");
const noteEl = $("[data-note]");
let tests = [];          // [{ id, number, title, durationMinutes, file }]
let sessions = [];
const counts = new Map();
const testCache = new Map();

// ------------------------------------------------------------------ vaqt
const pad = (n) => String(n).padStart(2, "0");
/** datetime-local (Toshkent) → Date */
function fromLocal(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v || "");
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - TZ_OFFSET_MS);
}
function toLocal(ms) {
  const d = new Date(ms + TZ_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function fmt(ms) {
  if (ms == null) return "—";
  const d = new Date(ms + TZ_OFFSET_MS);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
const comma = (v, d = 2) => (Number.isFinite(Number(v)) ? String(Math.round(Number(v) * 10 ** d) / 10 ** d).replace(".", ",") : "—");

// ------------------------------------------------------------------ testlar
async function loadTests() {
  const cat = await fetch(`${DATA}data/tests.json`, { cache: "no-cache" }).then((r) => r.json());
  const list = await Promise.all((cat.tests || []).map(async (e) => {
    try {
      const t = await fetch(DATA + e.file, { cache: "no-cache" }).then((r) => r.json());
      testCache.set(t.id, t);
      return { id: t.id, number: t.number, title: t.title, durationMinutes: t.durationMinutes || 180 };
    } catch {
      return { id: e.id, number: Number(e.id.replace(/\D+/g, "")), title: e.id, durationMinutes: 180 };
    }
  }));
  const imported = await listImportedTests();
  imported.forEach((m) => {
    const t = { id: m.id, number: m.number, title: m.title, durationMinutes: m.durationMinutes || 180, imported: true, meta: m };
    testCache.delete(m.id); // import qilingan versiya ustun
    const i = list.findIndex((x) => x.id === m.id);
    if (i >= 0) list[i] = t; else list.push(t);
  });
  tests = list.sort((a, b) => a.number - b.number);
  $("#msTest").innerHTML = tests.map((t) => `<option value="${esc(t.id)}">Mock №${esc(t.number)} — ${esc(t.title)}${t.imported ? " (import)" : ""}</option>`).join("");
  renderImported(imported);
  const now = Date.now();
  const start = Math.ceil((now + 3600000) / 3600000) * 3600000;
  $("#msOpen").value = toLocal(start);
  $("#msClose").value = toLocal(start + 12 * 3600000);
}

async function getTest(id) {
  const imp = tests.find((x) => x.id === id && x.imported);
  if (imp) {
    const t = await loadImportedTest(imp.meta, { figures: false });
    if (t.locked || !t.keyed) throw new Error("Import qilingan test savollari yoki kaliti o‘qilmadi");
    return t;
  }
  if (testCache.has(id)) return testCache.get(id);
  const cat = await fetch(`${DATA}data/tests.json`, { cache: "no-cache" }).then((r) => r.json());
  const e = cat.tests.find((x) => x.id === id);
  if (!e) throw new Error(`${id} katalogda topilmadi`);
  const t = await fetch(DATA + e.file, { cache: "no-cache" }).then((r) => r.json());
  testCache.set(id, t);
  return t;
}

// ------------------------------------------------------------------ sessiyalar ro'yxati
const PHASE = {
  upcoming: '<span class="of-badge of-badge--orange">kutilmoqda</span>',
  open: '<span class="of-badge of-badge--green">ochiq</span>',
  closed: '<span class="of-badge of-badge--blue">yopilgan • yakunlanmagan</span>',
  finalized: '<span class="of-badge of-badge--purple">natija e’lon qilingan</span>',
};

async function loadSessions() {
  const snap = await fs.getDocs(fs.collection(db, COL.sessions));
  sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMs(b.opensAt) - toMs(a.opensAt));
  await Promise.all(sessions.map(async (s) => {
    try {
      const c = await fs.getCountFromServer(fs.query(fs.collection(db, COL.attempts), fs.where("sessionId", "==", s.id)));
      counts.set(s.id, c.data().count);
    } catch (e) {
      console.warn("[ms] count:", e?.code || e);
      counts.set(s.id, null);
    }
  }));
  render();
}

function render() {
  if (!sessions.length) {
    bodyEl.innerHTML = `<tr><td colspan="7">${stateBox("empty", "Hozircha sessiya yo‘q", "Yuqoridagi formadan birinchi sessiyani oching. Sessiya ochilmagan mocklar foydalanuvchilarga yopiq.")}</td></tr>`;
    return;
  }
  const now = Date.now();
  bodyEl.innerHTML = sessions.map((s) => {
    const ph = sessionPhase(s, now);
    const n = counts.get(s.id);
    const t = tests.find((x) => x.id === s.testId);
    const runningUntil = toMs(s.closesAt) + s.durationMinutes * 60000;
    const acts = [];
    if (ph === "open") acts.push(`<button type="button" class="of-btn of-btn--sm" data-close="${esc(s.id)}">Hozir yopish</button>`);
    if (ph === "closed" || ph === "open") acts.push(`<button type="button" class="of-btn of-btn--primary of-btn--sm" data-finalize="${esc(s.id)}">Yakunlash va natijani hisoblash</button>`);
    if (ph === "finalized") {
      acts.push(`<button type="button" class="of-btn of-btn--ghost of-btn--sm" data-results="${esc(s.id)}">Natijalar</button>`);
      acts.push(`<button type="button" class="of-btn of-btn--ghost of-btn--sm" data-finalize="${esc(s.id)}" data-again="1">Qayta hisoblash</button>`);
    }
    if ((ph === "upcoming" || !n) && ph !== "finalized") acts.push(`<button type="button" class="of-btn of-btn--ghost of-btn--sm" data-delete="${esc(s.id)}">O‘chirish</button>`);
    const sub = ph === "closed" && now < runningUntil ? `<br><small class="of-muted">oxirgi ishtirokchi ${esc(fmt(runningUntil))} gacha yechishi mumkin</small>` : "";
    return `<tr data-row="${esc(s.id)}">
      <td data-label="Mock test"><b>Mock №${esc(t?.number ?? s.testNumber ?? "?")}</b>${s.note ? `<br><small class="of-muted">${esc(s.note)}</small>` : ""}</td>
      <td data-label="Ochiladi">${esc(fmt(toMs(s.opensAt)))}</td>
      <td data-label="Yopiladi">${esc(fmt(toMs(s.closesAt)))}${sub}</td>
      <td data-label="Vaqt">${esc(s.durationMinutes)} daq</td>
      <td data-label="Holat">${PHASE[ph] || esc(ph)}</td>
      <td data-label="Ishtirokchilar" class="of-num">${n == null ? "—" : num(n)}</td>
      <td data-label="Amallar"><div class="ms-actions">${acts.join("")}</div></td></tr>
      <tr class="ms-detail-row" data-detail="${esc(s.id)}" hidden><td colspan="7" class="ms-detail"></td></tr>`;
  }).join("");
}

// ------------------------------------------------------------------ yangi sessiya
$("[data-new-form]").addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = tests.find((x) => x.id === $("#msTest").value);
  const o = fromLocal($("#msOpen").value);
  const c = fromLocal($("#msClose").value);
  const dur = Math.round(Number($("#msDur").value));
  if (!t || !o || !c) { toast("Mock va vaqtlarni to‘liq kiriting"); return; }
  if (c <= o) { toast("Yopilish vaqti ochilishdan keyin bo‘lishi kerak"); return; }
  if (!(dur >= 10 && dur <= 600)) { toast("Vaqt 10–600 daqiqa oralig‘ida bo‘lsin"); return; }
  const clash = sessions.find((s) => s.testId === t.id && s.status !== "finalized" && toMs(s.opensAt) < c.getTime() && toMs(s.closesAt) > o.getTime());
  if (clash) { toast(`Mock №${t.number} uchun shu vaqtda boshqa sessiya bor`); return; }
  const reused = t.imported && t.meta?.reviewOpen === true;
  const ok = await confirmAction({
    title: `Mock №${t.number} sessiyasini ochish`,
    text: `${fmt(o.getTime())} — ${fmt(c.getTime())} (Toshkent vaqti), har bir ishtirokchiga ${dur} daqiqa. Shu oraliqda test barcha kirgan foydalanuvchilarga ochiladi.`
      + (reused ? " DIQQAT: bu mock natijalari avval e’lon qilingan — javoblari ochiq bo‘lgan. Yangi sessiya ochilsa, avvalgi ishtirokchilar savollar sharhini sessiya tugaguncha ko‘ra olmaydi." : ""),
    confirmLabel: "Sessiyani ochish",
  });
  if (!ok) return;
  const d = new Date(o.getTime() + TZ_OFFSET_MS);
  const id = `${t.id}-${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${Math.random().toString(36).slice(2, 6)}`;
  const data = {
    testId: t.id, testNumber: t.number, testTitle: String(t.title).slice(0, 200),
    opensAt: fs.Timestamp.fromDate(o), closesAt: fs.Timestamp.fromDate(c), durationMinutes: dur,
    status: "scheduled", createdAt: fs.serverTimestamp(), createdBy: sessionState.user?.uid || "",
  };
  const note = $("#msNote").value.trim();
  if (note) data.note = note.slice(0, 200);
  try {
    const batch = fs.writeBatch(db);
    batch.set(fs.doc(db, COL.sessions, id), data);
    if (t.imported) {
      // Savollar shu oynada ochiladi: ochilishdan — yopilish + vaqt + 10 daqiqagacha (mavjud oyna bilan birlashtiriladi)
      const m = t.meta || {};
      const from = Math.min(o.getTime(), toMs(m.openFrom) && toMs(m.openUntil) > Date.now() ? toMs(m.openFrom) : Infinity);
      const until = Math.max(c.getTime() + (dur + 10) * 60000, toMs(m.openUntil) > Date.now() ? toMs(m.openUntil) : 0);
      batch.update(fs.doc(db, "msMockTests", t.id), { openFrom: fs.Timestamp.fromDate(new Date(from)), openUntil: fs.Timestamp.fromDate(new Date(until)), reviewOpen: false, updatedAt: fs.serverTimestamp() });
    }
    const au = auditEntry(fb, sessionState, { action: "ms-session-create", section: "milliy-sertifikat", summary: `Mock №${t.number} sessiyasi ochildi: ${fmt(o.getTime())} — ${fmt(c.getTime())}`, details: { sessionId: id } });
    batch.set(au.ref, au.data);
    await batch.commit();
    toast("Sessiya ochildi");
    $("#msNote").value = "";
    await loadSessions();
  } catch (error) {
    toast(errorText(error, "Sessiyani ochib bo‘lmadi"));
  }
});

// ------------------------------------------------------------------ amallar
bodyEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.close || btn.dataset.finalize || btn.dataset.delete || btn.dataset.results;
  const s = sessions.find((x) => x.id === id);
  if (!s) return;
  if (btn.dataset.close) return closeNow(s);
  if (btn.dataset.delete) return removeSession(s);
  if (btn.dataset.results) return toggleResults(s);
  if (btn.dataset.finalize) return finalize(s, !!btn.dataset.again, btn);
});

async function closeNow(s) {
  const ok = await confirmAction({ title: "Sessiyani hozir yopish", text: "Yangi ishtirokchilar testni boshlay olmaydi. Boshlaganlar o‘z vaqti tugaguncha yechishda davom etadi.", confirmLabel: "Yopish", danger: true });
  if (!ok) return;
  try {
    const now = fs.Timestamp.fromDate(new Date(Math.max(Date.now(), toMs(s.opensAt) + 60000)));
    await fs.updateDoc(fs.doc(db, COL.sessions, s.id), { closesAt: now, updatedAt: fs.serverTimestamp() });
    toast("Sessiya yopildi");
    await loadSessions();
  } catch (error) {
    toast(errorText(error, "Yopib bo‘lmadi"));
  }
}

async function removeSession(s) {
  const ok = await confirmAction({ title: "Sessiyani o‘chirish", text: "Faqat ishtirokchisi yo‘q sessiyani o‘chiring. Bu amalni qaytarib bo‘lmaydi.", confirmLabel: "O‘chirish", danger: true });
  if (!ok) return;
  try {
    await fs.deleteDoc(fs.doc(db, COL.sessions, s.id));
    toast("Sessiya o‘chirildi");
    await loadSessions();
  } catch (error) {
    toast(errorText(error, "O‘chirib bo‘lmadi"));
  }
}

// ------------------------------------------------------------------ yakunlash (Rasch)
function randomCertNo(yy) {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000;
  return `OF${yy}-${n}`;
}

async function uniqueCertNo(yy, used) {
  for (let i = 0; i < 20; i++) {
    const c = randomCertNo(yy);
    if (used.has(c)) continue;
    const snap = await fs.getDoc(fs.doc(db, COL.certificates, c));
    if (!snap.exists()) { used.add(c); return c; }
  }
  throw new Error("Sertifikat raqamini yaratib bo‘lmadi");
}

function splitName(profile, fallback) {
  const last = String(profile?.lastName || "").trim();
  const first = String(profile?.firstName || "").trim();
  if (last || first) return { last, first, full: [last, first].filter(Boolean).join(" ") };
  const parts = String(profile?.fullName || fallback || "").trim().split(/\s+/).filter(Boolean);
  // users.fullName odatda «Ism Familiya» — sertifikatda Familiya / Ism alohida
  return { first: parts[0] || "", last: parts.slice(1).join(" "), full: parts.join(" ") };
}

async function finalize(s, again, btn) {
  const now = Date.now();
  const ph = sessionPhase(s, now);
  const runningUntil = toMs(s.closesAt) + s.durationMinutes * 60000;
  let warn = "";
  if (ph === "open") warn = " DIQQAT: sessiya hali ochiq — yakunlangandan keyin hech kim boshlay/topshira olmaydi.";
  else if (now < runningUntil) warn = ` DIQQAT: ba’zi ishtirokchilar ${fmt(runningUntil)} gacha yechishi mumkin — hozir yakunlansa, ularning oxirgi saqlangan javoblari baholanadi.`;
  const ok = await confirmAction({
    title: again ? "Natijani qayta hisoblash" : "Yakunlash va natijani hisoblash",
    text: `Mock №${s.testNumber} — ${counts.get(s.id) ?? "?"} ishtirokchi. Barcha javoblar asosida Rasch modeli bo‘yicha ball hisoblanib, har bir ishtirokchiga e’lon qilinadi${again ? " (avvalgi natijalar yangilanadi, sertifikat raqamlari saqlanadi)" : ""}.${warn}`,
    confirmLabel: again ? "Qayta hisoblash" : "Yakunlash va hisoblash",
    danger: !!warn,
  });
  if (!ok) return;
  btn.disabled = true;
  noteEl.textContent = "Javoblar yuklanmoqda…";
  try {
    const [test, snap] = await Promise.all([
      getTest(s.testId),
      fs.getDocs(fs.query(fs.collection(db, COL.attempts), fs.where("sessionId", "==", s.id))),
    ]);
    const attempts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    noteEl.textContent = `${attempts.length} ta urinish. Rasch hisoblanmoqda…`;
    const { rows, stats, warnings } = computeSessionResults(test, attempts);

    // Ismlar (users profili) va sertifikat raqamlari
    const byId = new Map(attempts.map((a) => [a.id, a]));
    const profiles = new Map();
    await Promise.all([...new Set(attempts.map((a) => a.uid))].map(async (uid) => {
      try {
        const p = await fs.getDoc(fs.doc(db, "users", uid));
        profiles.set(uid, p.exists() ? p.data() : null);
      } catch { profiles.set(uid, null); }
    }));
    const yy = String(new Date(toMs(s.opensAt) + TZ_OFFSET_MS).getUTCFullYear()).slice(-2);
    const used = new Set();
    for (const r of rows) {
      const a = byId.get(r.attemptId);
      const nm = splitName(profiles.get(r.uid), a.name);
      r.result.lastName = nm.last.slice(0, 100);
      r.result.firstName = nm.first.slice(0, 100);
      r.result.fullName = (nm.full || a.name || "").slice(0, 200);
      if (r.result.level) r.result.certNo = a.result?.certNo || await uniqueCertNo(yy, used);
    }

    noteEl.textContent = "Natijalar e’lon qilinmoqda…";
    const ops = [];
    for (const r of rows) {
      ops.push((b) => b.update(fs.doc(db, COL.attempts, r.attemptId), { status: "published", result: r.result, publishedAt: fs.serverTimestamp() }));
      if (r.result.certNo) {
        ops.push((b) => b.set(fs.doc(db, COL.certificates, r.result.certNo), {
          certNo: r.result.certNo, uid: r.uid, sessionId: s.id, testId: s.testId, testNumber: Number(s.testNumber) || 0, testTitle: String(s.testTitle || test.title).slice(0, 200),
          lastName: r.result.lastName, firstName: r.result.firstName, fullName: r.result.fullName,
          score: r.result.score, level: r.result.level, percent: r.result.percent, sections: r.result.sections, issuedAt: fs.serverTimestamp(),
        }));
      }
    }
    const cleanStats = { ...stats, warnings: warnings.slice(0, 3) };
    if (test.imported) ops.push((b) => b.update(fs.doc(db, "msMockTests", s.testId), { reviewOpen: true, updatedAt: fs.serverTimestamp() }));
    ops.push((b) => b.update(fs.doc(db, COL.sessions, s.id), { status: "finalized", finalizedAt: fs.serverTimestamp(), finalizedBy: sessionState.user?.uid || "", stats: cleanStats }));
    const au = auditEntry(fb, sessionState, { action: again ? "ms-session-rescore" : "ms-session-finalize", section: "milliy-sertifikat",
      summary: `Mock №${s.testNumber} sessiyasi ${again ? "qayta hisoblandi" : "yakunlandi"}: ${stats.participants} ishtirokchi (Rasch)`, details: { sessionId: s.id, participants: stats.participants } });
    ops.push((b) => b.set(au.ref, au.data));
    for (let i = 0; i < ops.length; i += 400) {
      const b = fs.writeBatch(db);
      ops.slice(i, i + 400).forEach((fn) => fn(b));
      await b.commit();
    }
    noteEl.textContent = "";
    toast(`Natijalar e’lon qilindi: ${stats.participants} ishtirokchi`);
    await loadSessions();
    const fresh = sessions.find((x) => x.id === s.id);
    if (fresh) await toggleResults(fresh, true);
  } catch (error) {
    console.error("[ms] yakunlash:", error);
    noteEl.textContent = "";
    toast(error?.code ? errorText(error, "Yakunlab bo‘lmadi") : (error?.message || "Yakunlab bo‘lmadi"));
    btn.disabled = false;
  }
}

// ------------------------------------------------------------------ natijalar jadvali + CSV
async function toggleResults(s, forceOpen = false) {
  const row = bodyEl.querySelector(`[data-detail="${CSS.escape(s.id)}"]`);
  if (!row) return;
  if (!row.hidden && !forceOpen) { row.hidden = true; return; }
  row.hidden = false;
  const cell = row.firstElementChild;
  cell.innerHTML = "Yuklanmoqda…";
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, COL.attempts), fs.where("sessionId", "==", s.id)));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.result?.score ?? -1) - (a.result?.score ?? -1));
    const st = s.stats || {};
    const lv = st.levels || {};
    const chips = [
      `Ishtirokchilar: <b>${esc(st.participants ?? list.length)}</b>`,
      `O‘rtacha xom ball: <b>${esc(comma(st.meanRaw))}/${esc(st.maxRaw ?? "")}</b>`,
      `Ishonchlilik: <b>${esc(st.reliability == null ? "—" : comma(st.reliability, 3))}</b>`,
      ...["A+", "A", "B+", "B", "C+", "C", "none"].map((k) => `${k === "none" ? "Darajasiz" : k}: <b>${esc(lv[k] || 0)}</b>`),
    ];
    const warns = (st.warnings || []).map((w) => `<p class="ms-warn">${esc(w)}</p>`).join("");
    cell.innerHTML = `<h3>Mock №${esc(s.testNumber)} — natijalar</h3>${warns}
      <div class="ms-stats">${chips.map((c) => `<span class="of-admin-chip">${c}</span>`).join("")}</div>
      <div class="of-admin-table-wrap"><table class="of-admin-table"><thead><tr>
        <th class="of-num">O‘rin</th><th>Ishtirokchi</th><th class="of-num">Xom ball</th><th class="of-num">Rasch ball</th><th>Daraja</th><th class="of-num">Foiz</th><th>Sertifikat</th><th>Izoh</th></tr></thead>
      <tbody>${list.map((a) => {
        const r = a.result || {};
        const note = [r.excluded ? "javob yo‘q" : "", r.submitted === false ? "topshirilmagan (qoralama baholandi)" : "", a.autoSubmitted ? "vaqt tugab yuborilgan" : ""].filter(Boolean).join("; ");
        return `<tr><td class="of-num">${esc(r.rank ?? "—")}</td><td>${esc(r.fullName || a.name || a.uid)}<br><small class="of-muted">${esc(a.email || a.uid)}</small></td>
          <td class="of-num">${esc(r.raw ?? "—")}/${esc(r.maxRaw ?? "")}</td><td class="of-num"><b>${esc(comma(r.score))}</b></td><td>${esc(r.level || "—")}</td>
          <td class="of-num">${esc(comma(r.percent))}%</td><td>${r.certNo ? `<a href="../milliy-sertifikat/mock-testlar/sertifikat.html?cert=${encodeURIComponent(r.certNo)}" target="_blank" rel="noopener">${esc(r.certNo)}</a>` : "—"}</td><td>${esc(note)}</td></tr>`;
      }).join("")}</tbody></table></div>
      <p><button type="button" class="of-btn of-btn--ghost of-btn--sm" data-csv>CSV yuklash</button></p>`;
    cell.querySelector("[data-csv]").addEventListener("click", () => downloadCsv(s, list));
  } catch (error) {
    cell.innerHTML = stateBox("error", "Natijalarni yuklab bo‘lmadi", errorText(error));
  }
}

function downloadCsv(s, list) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["O‘rin", "Familiya", "Ism", "Email", "UID", "Xom ball", "Maks", "Rasch ball", "Daraja", "Foiz", "Theta", "Sertifikat"].map(q).join(";")];
  list.forEach((a) => {
    const r = a.result || {};
    lines.push([r.rank, r.lastName, r.firstName, a.email, a.uid, r.raw, r.maxRaw, comma(r.score), r.level || "", comma(r.percent), r.theta == null ? "" : comma(r.theta, 4), r.certNo || ""].map(q).join(";"));
  });
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mock-${s.testNumber}-${s.id}-natijalar.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ------------------------------------------------------------------ erkin mashq
async function loadPractice() {
  let cfg = {};
  try {
    const snap = await fs.getDoc(fs.doc(db, COL.settings, "config"));
    cfg = snap.exists() ? snap.data() : {};
  } catch (e) { console.warn("[ms] settings:", e?.code || e); }
  const on = new Set(cfg.practiceTests || []);
  $("[data-practice]").innerHTML = tests.filter((t) => !t.imported).map((t) => `<label><input type="checkbox" value="${esc(t.id)}" ${on.has(t.id) ? "checked" : ""}> Mock №${esc(t.number)}</label>`).join("");
}

$("[data-save-practice]").addEventListener("click", async () => {
  const ids = [...document.querySelectorAll("[data-practice] input:checked")].map((i) => i.value);
  try {
    await fs.setDoc(fs.doc(db, COL.settings, "config"), { practiceTests: ids, updatedAt: fs.serverTimestamp(), updatedBy: sessionState.user?.uid || "" });
    toast(ids.length ? `Erkin mashq: ${ids.length} ta mock ochiq` : "Barcha mocklar yopiq (faqat sessiyalar)");
  } catch (error) {
    toast(errorText(error, "Saqlab bo‘lmadi"));
  }
});

// ------------------------------------------------------------------ mock import (Attestatsiya mock importi kabi)
// Fayl: tools/milliy-sertifikat/build_mock_import.py → ms-mock-import-NN.json (javoblar bilan — repoga qo'yilmaydi).
let bundle = null;
function renderImported(list) {
  const el = $("[data-imported]");
  if (!el) return;
  el.innerHTML = list.length
    ? list.sort((a, b) => a.number - b.number).map((m) => `<span class="of-admin-chip">Mock №${esc(m.number)} • ${esc(m.questionCount)} savol • ${esc(m.figureCount || 0)} rasm${m.reviewOpen ? " • javoblar ochiq" : ""}</span>`).join("")
    : '<span class="of-muted">Hozircha import qilingan mock yo‘q.</span>';
}

function validBundle(d) {
  if (d?.format !== "oliyfizika-ms-mock-import" || !Array.isArray(d.ops) || !/^mock-test-\d{1,3}$/.test(d.testId)) return "format";
  const pre = `msMockTests/${d.testId}`;
  if (!d.ops.every((o) => o.path === pre || o.path.startsWith(`${pre}/content/`) || o.path.startsWith(`${pre}/figures/`))) return "begona yo‘l";
  const has = (p) => d.ops.some((o) => o.path === p);
  if (!has(pre) || !has(`${pre}/content/questions`) || !has(`${pre}/content/key`)) return "meta/savollar/kalit yetishmaydi";
  const q = d.ops.find((o) => o.path === `${pre}/content/questions`).data.questions;
  const k = d.ops.find((o) => o.path === `${pre}/content/key`).data.answers;
  if (!Array.isArray(q) || !q.length || Object.keys(k || {}).length !== q.length) return "savollar va kalit soni mos emas";
  if (q.some((x) => "answer" in x || (x.parts || []).some((p) => "answer" in p))) return "savollar hujjatida javob bor";
  return "";
}

$("[data-bundle]")?.addEventListener("change", async (e) => {
  const info = $("[data-bundle-info]");
  bundle = null;
  $("[data-import]").disabled = true;
  try {
    const d = JSON.parse(await e.target.files[0].text());
    const err = validBundle(d);
    if (err) throw new Error(err);
    bundle = d;
    const exists = tests.find((t) => t.id === d.testId);
    const busy = sessions.some((s) => s.testId === d.testId && s.status !== "finalized");
    info.textContent = `Tekshirildi: Mock №${d.number} — ${d.counts.questions} savol (${d.counts.mcq} test, ${d.counts.items} band), ${d.counts.figures} rasm, ${d.ops.length} hujjat.`
      + (exists ? (exists.imported ? " Bu mock avval import qilingan — qayta yozilsa yangilanadi." : " Repodagi shu raqamli mock o‘rniga import qilingan versiya ishlatiladi.") : "")
      + (busy ? " DIQQAT: bu mockning yakunlanmagan sessiyasi bor — import qilib bo‘lmaydi." : "");
    $("[data-import]").disabled = busy;
  } catch (err) {
    info.textContent = `Fayl yaroqsiz (${err.message}). build_mock_import.py yaratgan ms-mock-import-NN.json ni tanlang.`;
  }
});

$("[data-import]")?.addEventListener("click", async (e) => {
  if (!bundle) return;
  const btn = e.currentTarget;
  const ok = await confirmAction({ title: `Mock №${bundle.number} import qilinsinmi?`, text: `${bundle.ops.length} hujjat yoziladi. Test yopiq holda saqlanadi — foydalanuvchilarga faqat siz ochgan sessiya vaqtida ko‘rinadi.`, confirmLabel: "Import" });
  if (!ok) return;
  btn.disabled = true;
  const info = $("[data-bundle-info]");
  try {
    const metaOp = bundle.ops[0].path === `msMockTests/${bundle.testId}` ? bundle.ops[0] : bundle.ops.find((o) => o.path === `msMockTests/${bundle.testId}`);
    const rest = bundle.ops.filter((o) => o !== metaOp);
    const toRef = (p) => fs.doc(db, ...p.split("/"));
    // Avval meta (reviewOpen: false, oyna yo'q — yopiq), so'ng kontent; figuralar hajmi katta — kichik batchlarda
    const meta = { ...metaOp.data, reviewOpen: false, importedAt: fs.serverTimestamp(), importedBy: sessionState.user?.uid || "" };
    await fs.setDoc(toRef(metaOp.path), meta);
    let batch = fs.writeBatch(db);
    let size = 0;
    let n = 0;
    for (const o of rest) {
      const len = JSON.stringify(o.data).length;
      if (n && (size + len > 8_000_000 || n >= 400)) { await batch.commit(); batch = fs.writeBatch(db); size = 0; n = 0; }
      batch.set(toRef(o.path), o.data);
      size += len;
      n++;
      info.textContent = `Yozilmoqda… ${o.path.split("/").slice(-1)[0]}`;
    }
    if (n) await batch.commit();
    const au = auditEntry(fb, sessionState, { action: "ms-mock-import", section: "milliy-sertifikat", summary: `Mock №${bundle.number} import qilindi (${bundle.counts.questions} savol)`, details: { testId: bundle.testId } });
    await fs.setDoc(au.ref, au.data).catch(() => {});
    const num = bundle.number;
    bundle = null;
    await loadTests();
    await loadPractice();
    info.textContent = `Mock №${num} import qilindi. Endi uni yuqoridagi formadan sessiyaga qo‘yishingiz mumkin.`;
    toast(`Mock №${num} import qilindi`);
  } catch (error) {
    console.error("[ms] import:", error);
    info.textContent = errorText(error, "Import qilib bo‘lmadi. Faylni qayta tanlab urinib ko‘ring.");
    btn.disabled = false;
  }
});

$("#msTest").addEventListener("change", () => {
  const t = tests.find((x) => x.id === $("#msTest").value);
  if (t) $("#msDur").value = t.durationMinutes;
});

$("[data-reload]").addEventListener("click", () => loadSessions().catch((e) => toast(errorText(e))));

try {
  await loadTests();
  await Promise.all([loadSessions(), loadPractice()]);
  if (MIN_PARTICIPANTS && RECOMMENDED_PARTICIPANTS) {
    noteEl.textContent = `Rasch hisobi kamida ${MIN_PARTICIPANTS} ta javob bergan ishtirokchi bilan ishlaydi; ishonchli natija uchun ${RECOMMENDED_PARTICIPANTS}+ tavsiya etiladi.`;
  }
} catch (error) {
  bodyEl.innerHTML = `<tr><td colspan="7">${stateBox("error", "Ma’lumotlarni yuklab bo‘lmadi", errorText(error))}</td></tr>`;
}
