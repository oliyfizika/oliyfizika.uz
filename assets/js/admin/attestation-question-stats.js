// ==========================================================================
// Admin → Attestatsiya → Fizika: «Savollar statistikasi» paneli (faqat o'qish).
// Hisob: ../attestatsiya-fizika/question-stats.js (formula va filtrlar o'sha faylda hujjatlangan).
// So'rovlar (har ochilganda real ma'lumotdan qayta hisoblanadi, kesh/statik qiymat yo'q):
//   keys/v{n} (1 hujjat) + attempts where testId == X && testVersion == n + count(testId == X).
// Ruxsat: Firestore Rules — attempts list va keys faqat admin (users/{uid}.role == "admin").
// ==========================================================================
import { $, esc, stateBox, errorText } from "./admin-common.js";
import { getKey, listAttemptsForVersion, countAttemptsForTest } from "../attestatsiya-fizika/api.js";
import { computeQuestionStats } from "../attestatsiya-fizika/question-stats.js";

const panel = $("[data-qstats-panel]");
const titleEl = $("[data-qstats-title]");
const select = $("[data-qstats-version]");
const box = $("[data-qstats-body]");
let current = null;
let token = 0;
let totalAll = null;          // kun bo'yicha jami urinishlar (count) — panel ochilganda bir marta; versiya almashganda qayta so'ralmaydi

const fmt = (v) => (v == null ? "—" : `${v}%`);

function row(r) {
  if (!r.scored) {
    return `<li class="att-qstat att-qstat--off" data-q="${r.number}">
      <span class="att-qstat__label">${r.number}</span>
      <span class="att-qstat__note">${r.duplicate ? "Takroriy savol (kalitda)" : "Ballga kirmaydi"}</span><span class="att-qstat__value">—</span></li>`;
  }
  const detail = `${r.number}-savol: to‘g‘ri ${r.correct}, noto‘g‘ri ${r.wrong}, javobsiz ${r.unanswered} (jami ${r.total})`;
  return `<li class="att-qstat" data-q="${r.number}" data-pct="${r.correctPct}" title="${esc(detail)}">
    <span class="att-qstat__label">${r.number}</span>
    <div class="of-progress att-qstat__bar" role="progressbar" aria-label="${esc(detail)}" aria-valuemin="0" aria-valuemax="100"
      aria-valuenow="${r.correctPct}" style="--value:${r.correctPct}"><span></span></div>
    <span class="att-qstat__value"><b>${fmt(r.correctPct)}</b><small>${r.correct}/${r.total}</small></span></li>`;
}

function rankList(items, kind, n, empty) {
  if (!items.length) return `<p class="of-subtle" data-qstats-empty="${kind}">${esc(empty)}</p>`;
  return `<ol class="att-qrank" data-qstats-list="${kind}">${items.map((x) => `
    <li class="att-qstat att-qstat--${kind}" data-q="${x.number}" data-pct="${x.pct}" title="${x.count} / ${n}">
      <span class="att-qstat__name">${x.number}-savol</span>
      <div class="of-progress att-qstat__bar" aria-hidden="true" style="--value:${x.pct}"><span></span></div>
      <span class="att-qstat__value"><b>${fmt(x.pct)}</b><small>${x.count}/${n}</small></span></li>`).join("")}</ol>`;
}

function render(test, st, totalAll) {
  const meta = `<ul class="att-qstat-meta" aria-label="Statistika manbai">
      <li><span>Versiya</span><b>v${st.version}</b></li>
      <li><span>Hisobga olingan urinishlar</span><b data-qstats-n>${st.attempts}</b></li>
      <li><span>Savollar</span><b>${st.questionCount}</b><small>${st.scorableCount} ballga</small></li>
      <li><span>Kun bo‘yicha jami urinishlar</span><b data-qstats-all>${totalAll ?? "—"}</b><small>barcha versiya va holatlar</small></li>
    </ul>`;
  if (!st.attempts) {
    return `${meta}${stateBox("empty", "Statistika uchun hali yetarli urinish mavjud emas.",
      `Day ${test.dayNumber} v${st.version} bo‘yicha baholangan rasmiy urinish yo‘q. Boshqa versiyalardagi urinishlar bu versiyaga qo‘shilmaydi.`)}`;
  }
  const notes = [];
  if (st.excluded) notes.push(`${st.excluded} ta urinish hali baholanmagan yoki rasmiy emas — hisobga olinmadi.`);
  if (st.regraded) notes.push(`${st.regraded} ta eski sxemadagi urinishda savollar ro‘yxati yo‘q edi — javoblar v${st.version} kaliti bilan solishtirildi (urinish o‘zgartirilmadi).`);
  return `${meta}
    <section class="att-qstat-block" aria-labelledby="qsCorrect">
      <h3 id="qsCorrect">Savollar bo‘yicha to‘g‘ri javoblar</h3>
      <p class="of-muted">Har bir savolni foydalanuvchilar nechta foiz holatda to‘g‘ri bajarganini ko‘rsatadi.</p>
      <p class="of-subtle att-qstat-formula" data-qstats-formula>Foiz = to‘g‘ri javoblar ÷ ${st.attempts} ta hisobga olingan urinish × 100.
        Javobsiz qoldirilganlar maxrajga kiradi (natija foizi bilan bir xil usul). Faqat rasmiy, baholangan, v${st.version} urinishlari.</p>
      <ul class="att-qstat-list" data-qstats-rows tabindex="0" aria-label="Savollar bo‘yicha to‘g‘ri javoblar foizi">${st.rows.map(row).join("")}</ul>
    </section>
    <div class="att-qstat-grid">
      <section class="att-qstat-block" aria-labelledby="qsWrong">
        <h3 id="qsWrong">Eng ko‘p xato qilingan savollar</h3>
        <p class="of-subtle">Xato foizi = noto‘g‘ri javoblar ÷ ${st.attempts} × 100, kamayish tartibida.</p>
        ${rankList(st.mostWrong, "wrong", st.attempts, "Noto‘g‘ri javob qayd etilmagan.")}
      </section>
      <section class="att-qstat-block" aria-labelledby="qsSkip">
        <h3 id="qsSkip">Javobsiz qoldirilgan savollar</h3>
        <p class="of-subtle">Javobsiz foizi = javob berilmagan holatlar ÷ ${st.attempts} × 100, kamayish tartibida.</p>
        ${rankList(st.mostUnanswered, "skip", st.attempts, "Javobsiz qoldirilgan savol qayd etilmagan.")}
      </section>
    </div>
    ${notes.length ? `<p class="of-subtle" data-qstats-notes>${notes.map(esc).join(" ")}</p>` : ""}`;
}

async function load() {
  const test = current;
  const version = Number(select.value);
  const my = ++token;
  box.innerHTML = '<p class="of-subtle">Yuklanmoqda…</p>';
  box.setAttribute("aria-busy", "true");
  try {
    const [key, attempts, total] = await Promise.all([
      getKey(test.id, version),
      listAttemptsForVersion(test.id, version),
      totalAll ?? countAttemptsForTest(test.id).catch(() => null),
    ]);
    if (my === token && total != null) totalAll = total;
    if (my !== token) return;
    if (!key || !Array.isArray(key.questionIds)) {
      box.innerHTML = stateBox("error", "Versiya kaliti topilmadi", `keys/v${version} mavjud emas yoki buzilgan — statistika hisoblanmadi.`);
      return;
    }
    box.innerHTML = render(test, computeQuestionStats(key, attempts), totalAll);
  } catch (err) {
    if (my === token) box.innerHTML = stateBox("error", "Statistikani yuklab bo‘lmadi", errorText(err));
  } finally {
    if (my === token) box.removeAttribute("aria-busy");
  }
}

/** Jadvaldagi «Savollar statistikasi» tugmasi. Standart — joriy versiya (currentVersion). */
export function showQuestionStats(test) {
  if (!test) return;
  current = test;
  totalAll = null;
  panel.hidden = false;
  titleEl.textContent = `DAY ${test.dayNumber} — SAVOLLAR STATISTIKASI`;
  const n = Number(test.currentVersion) || 1;
  select.innerHTML = Array.from({ length: n }, (_, i) => n - i)
    .map((v) => `<option value="${v}">v${v}${v === n ? " (joriy)" : ""}</option>`).join("");
  select.value = String(n);
  load();
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

select.addEventListener("change", () => { if (current) load(); });
