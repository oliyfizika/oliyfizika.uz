// ==========================================================================
// Milliy sertifikat: bo'limlar (sertifikatdagi «Bo'limlar bo'yicha test sinovi natijalari»).
// Savolda `"section": "<id>"` maydoni bo'lsa — o'sha ishlatiladi; bo'lmasa savol matnidan kalit so'zlar bo'yicha
// aniqlanadi (classifySection). Aniqlik uchun muhim testlarda JSON'ga `section` qo'shib qo'yish mumkin.
// ==========================================================================

export const SECTIONS = Object.freeze([
  { id: "mexanika", label: "Mexanika" },
  { id: "molekulyar", label: "Molekulyar fizika va termodinamika" },
  { id: "elektr", label: "Elektr va magnetizm" },
  { id: "optika", label: "Zamonaviy fizika va optika" },
  { id: "amaliy", label: "Amaliy, hayotiy va mantiqiy fikrlashga oid masalalar" },
]);

export const sectionLabel = (id) => SECTIONS.find((s) => s.id === id)?.label || id;

const KEYWORDS = {
  elektr: [/zaryad/, /\btok\b/, /tok kuchi/, /kuchlanish/, /qarshilik/, /kondensator/, /sig[‘'’ʻ]?im/, /eyuk/, /magnit/, /induksiya/, /induktiv/,
    /elektr/, /potensial/, /kulon/, /amperm/, /voltm/, /rezistor/, /lorens/, /solenoid/, /transformator/, /o[‘'’ʻ]?tkazgich/, /ω/, /\bom\b/,
    /galvanometr/, /lampa/, /zanjir/, /dielektrik/, /g[‘'’ʻ]altak/, /elektromagnit/, /elektrostatik/, /μf|mkf|\bpf\b|\bnf\b/, /\bvolt\b/, /\bwatt?\b/],
  molekulyar: [/\bgaz/, /harorat/, /issiqlik/, /molekula/, /izobar/, /izoterm/, /izoxor/, /adiabat/, /termodinamik/, /kapillyar/, /sirt taranglik/,
    /namlik/, /erish/, /bug[‘'’ʻ]?lan/, /\bmol\b/, /kelvin/, /°c/, /\bk ga\b/, /entropiya/, /issiqlik dvigatel/, /ideal gaz/, /avogadro/,
    /bolsman/, /qaynash/, /muz\b/, /suyuqlik.*harorat/, /kristall/, /diffuziya/, /bug[‘'’ʻ]/, /ichki energiya/, /karno/],
  optika: [/linza/, /\bnur/, /yorug[‘'’ʻ]?lik/, /ko[‘'’ʻ]?zgu/, /sindirish/, /difraksi/, /interferen/, /foton/, /fotoeffekt/, /\batom/, /yadro/,
    /radioaktiv/, /yarim yemirilish/, /orbita/, /spektr/, /relyativ/, /mezon/, /proton/, /neytron/, /izotop/, /nyuton halqa/, /dioptriya/,
    /to[‘'’ʻ]?lqin uzunligi/, /qizil chegara/, /chiqish ishi/, /annigilyatsiya/, /reaksiya/, /massa soni/, /\bion\b/, /lazer/, /prizma/,
    /qutblan/, /tasvir/, /\bko[‘'’ʻ]?z\b/, /yorug[‘'’ʻ]/, /kvant/, /plank/, /elektron.*energiya/, /yemiril/, /nuklon/, /α-|β-|γ-|alfa|beta zarra/],
};
const PRIORITY = ["optika", "elektr", "molekulyar"];

const textOf = (q) => [q.note, q.text, q.reaction, ...(q.parts || []).map((p) => p.text), ...(q.options || []).map((o) => (typeof o === "string" ? o : o?.text))]
  .filter(Boolean).join(" ").toLowerCase();

/** Savol bo'limi: q.section yoki kalit so'zlar bo'yicha (topilmasa — mexanika). */
export function classifySection(q) {
  if (q.section && SECTIONS.some((s) => s.id === q.section)) return q.section;
  const t = textOf(q);
  let best = "mexanika";
  let bestScore = 0;
  PRIORITY.forEach((id) => {
    const score = KEYWORDS[id].reduce((s, re) => s + (re.test(t) ? 1 : 0), 0);
    if (score > bestScore) { best = id; bestScore = score; }
  });
  return best;
}

/** Atomik bandlar (scoring.gradeLocal().atomic tartibida) uchun bo'lim id lari. */
export function itemSections(test) {
  const out = [];
  test.questions.forEach((q) => {
    const id = classifySection(q);
    if (q.type === "mcq") out.push(id);
    else q.parts.forEach(() => out.push(id));
  });
  return out;
}

/** Testda uchraydigan bo'limlar (SECTIONS tartibida). */
export function sectionsOfTest(test) {
  const used = new Set(itemSections(test));
  return SECTIONS.filter((s) => used.has(s.id)).map((s) => s.id);
}
