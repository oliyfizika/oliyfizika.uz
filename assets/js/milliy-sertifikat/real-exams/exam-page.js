// ==========================================================================
// Real imtihonlar — bitta imtihon: metadata, manba ma'lumoti, PDF (imtihon.html?id=EXAM_ID).
// ==========================================================================
import { getAdapter } from "./data.js";
import { runGate, fillIcons, ic } from "./ui.js";
import { mountPdf } from "./pdf-viewer.js";
import { esc, examTitle, summaryText, SOURCE_GROUP } from "./labels.js";
import { loadKatex, inline } from "./render.js";

fillIcons();
const examId = new URLSearchParams(location.search).get("id");

runGate(async () => {
  const adapter = await getAdapter();
  const exam = await adapter.getExam(examId);
  const title = examTitle(exam);
  document.title = `${title} — Real imtihonlar | OliyFizika.uz`;
  const setTitle = () => window.OFShell?.setTitle?.(title);
  if (window.OFShell) setTitle(); else document.addEventListener("of:shell-ready", setTitle, { once: true });
  const prov = exam.sourceProvenance || {};
  const view = document.querySelector("[data-view]");
  view.innerHTML = `
    <header class="rx-head">
      <a class="rx-back" href="./">${ic("chevronLeft")}Real imtihonlar</a>
      <h1>${esc(title)}</h1>
      <p class="rx-sub">${exam.includedCount} ta savol · ${esc(summaryText(exam.solutionSummary))}</p>
      <div class="rx-head__actions">
        <a class="of-btn of-btn--primary" href="yechimlar.html?id=${encodeURIComponent(exam.examId)}">${ic("book")}Yechimlarni ko‘rish</a>
      </div>
    </header>
    <section class="of-card rx-prov" aria-labelledby="rxProvTitle">
      <h2 id="rxProvTitle">Manba</h2>
      <dl class="rx-dl">
        <div><dt>Rasmiy manba</dt><dd>${exam.officialSource === true ? "Ha" : "Yo‘q — rasmiy manba ekanligi tasdiqlanmagan"}</dd></div>
        <div><dt>Manba turi</dt><dd>${esc(SOURCE_GROUP[exam.sourceGroup] || exam.sourceType)}</dd></div>
        ${prov.publisherHeader ? `<div><dt>Tuzuvchi / nashr</dt><dd>${esc(prov.publisherHeader)}</dd></div>` : ""}
        ${prov.printedTitle ? `<div><dt>PDF dagi sarlavha</dt><dd>${esc(prov.printedTitle)}</dd></div>` : ""}
        ${prov.generalConditions ? `<div><dt>Umumiy shart (manbada)</dt><dd data-general></dd></div>` : ""}
      </dl>
      ${(exam.warnings || []).length ? `<ul class="rx-warn">${exam.warnings.map((w) => `<li>${ic("alert")}<span>${esc(w)}</span></li>`).join("")}</ul>` : ""}
    </section>
    <section class="of-card rx-pdf" aria-labelledby="rxPdfTitle">
      <h2 id="rxPdfTitle">Imtihon PDF</h2>
      <div class="rx-pdf__host" data-pdf></div>
    </section>`;
  const gen = view.querySelector("[data-general]");
  if (gen) { await loadKatex().catch(() => null); gen.append(inline(prov.generalConditions)); }
  try {
    await mountPdf(view.querySelector("[data-pdf]"), adapter, exam.examId, title);
  } catch (error) {
    console.error("[real-imtihonlar] PDF:", error);
    const host = view.querySelector("[data-pdf]");
    host.dataset.state = "error";
    host.innerHTML = `<p class="rx-pdf__status" role="status">${error?.code === "not-enabled" ? "PDF hali e’lon qilinmagan." : "PDF ni yuklab bo‘lmadi."}</p>`;
  }
});
