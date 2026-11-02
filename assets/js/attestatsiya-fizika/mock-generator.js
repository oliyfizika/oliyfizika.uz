// ==========================================================================
// Attestatsiya → Fizika: PULLIK MOCK TEST generatori (mock-03 va keyingilari) — SOF funksiyalar (DOM/Firebase yo'q).
//
// Tarkib (har mock): 50 savol = 35 fizika (5 bob × 7) + 15 pedagogika; har savol 2 ball → 100 ball; 2 soat; paidOnly.
//   • fizika — mavjud savollar bankidan (kunlik testlarning joriy versiyasi: versions / keys / solutions + private/answer):
//     auto, mcq, kalit bor, keyStatus = valid, review.check yo'q, yechim full|theory, RASMSIZ (savol, variant, yechim);
//     bob ichida mavzular navbatma-navbat, qiyinlik ≈ 2 oson / 3 o'rta / 2 murakkab, oson → murakkab tartibda.
//   • pedagogika — attestatsiya/pedagogika-testlari/data/test*.js (FAQAT O'QILADI), 4 variantli, turli fayllardan.
// TAKRORLANMASLIK: bitta mock ichida ham, yangi mocklar orasida ham, avvalgi mocklar (01, 02, …) bilan ham —
//   bir xil ID yo'q va matni o'xshash (so'zlar to'plami bo'yicha Jaccard ≥ SIMILAR) savol yo'q.
// Deterministik: bir xil bank + bir xil seed → bir xil mock (tasodifiy emas).
// Natija — admin «Mock test importi» bilan bir xil formatdagi bundle (oliyfizika-attestation-mock-import).
// ==========================================================================

export const MOCK_GEN = {
  physicsSections: [
    ["mexanika", "Mexanika"],
    ["molekulyar", "Molekulyar fizika va termodinamika"],
    ["elektromagnetizm", "Elektr va magnetizm"],
    ["optika", "Optika"],
    ["atom-yadro", "Atom va yadro fizikasi"],
  ],
  perSection: 7,
  pedagogy: 15,
  diffTarget: { 1: 2, 2: 3, 3: 2 },
  points: 2,
  timeLimit: 7200,
  firstMockDay: 101,
};
export const SIMILAR = 0.8;
const PED_TITLE = "Pedagogika";
const LETTERS = "ABCDE";

/** FNV-1a (32 bit) — deterministik tartib uchun. */
export function hash(...parts) {
  let h = 0x811c9dc5;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Bloklardagi barcha matn (text maydonlari) — o'xshashlik tekshiruvi uchun. */
export function plainText(x) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      if (typeof v.text === "string") out.push(v.text);
      for (const [k, w] of Object.entries(v)) if (k !== "text" && typeof w === "object") walk(w);
    } else if (typeof v === "string") out.push(v);
  };
  walk(x);
  return out.join(" ");
}

/** So'zlar to'plami: kichik harf, LaTeX buyruqlari va tinish belgilarisiz; sonlar ham kiradi. */
export function tokens(text) {
  const s = String(text).toLowerCase()
    .replace(/\\[a-z]+/g, " ")
    .replace(/[‘’ʻʼ'`]/g, "")
    .replace(/[^a-z0-9а-яёўқғҳ,.]+/gi, " ")
    .replace(/(\d)[,.](\d)/g, "$1_$2")
    .replace(/[,.]/g, " ");
  return new Set(s.split(/\s+/).filter((w) => w.length >= 2 || /\d/.test(w)));
}

export function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

const hasFigure = (x) => JSON.stringify(x || null).includes('"t":"figure"');

/** Savolning to'liq matni (savol + variantlar) — takror tekshiruvi shu bo'yicha. */
const questionText = (q) => `${plainText(q.question)} ${plainText((q.options || []).map((o) => o.blocks))}`;

/**
 * Bank (kunlik testlar) → fizika nomzodlari.
 * @param {Array<{test, version, key, solutions}>} days  har kunning JORIY versiyasi
 * @param {Map<string, object>} privates                 qid → private/answer (keyStatus, review)
 */
export function physicsPool(days, privates) {
  const secKeys = new Set(MOCK_GEN.physicsSections.map(([k]) => k));
  const pool = [];
  const seen = new Set();
  for (const d of days) {
    const sol = new Map((d.solutions?.items || []).map((i) => [i.id, i]));
    for (const q of d.version?.questions || []) {
      if (seen.has(q.id)) continue;
      const s = sol.get(q.id);
      const letter = d.key?.answers?.[q.id];
      const p = privates.get(q.id);
      if (!secKeys.has(q.section) || q.evaluationType !== "auto" || q.type !== "mcq") continue;
      if (!letter || !(q.options || []).some((o) => o.key === letter)) continue;
      if (!s || !["full", "theory"].includes(s.solutionStatus) || !(s.solution || []).length || s.correctAnswer !== letter) continue;
      if (!p || p.keyStatus !== "valid" || p.review?.check) continue;
      if (hasFigure([q.question, q.options]) || hasFigure(s.solution)) continue;
      seen.add(q.id);
      pool.push({ id: q.id, section: q.section, topic: q.topic || "—", level: q.difficultyLevel || 2, letter, q, sol: s,
                  tok: tokens(questionText(q)) });
    }
  }
  return pool;
}

/** Pedagogika fayllari ([{file, n, question, answers, correct}]) → 4 variantli, ichida takrorlanmagan nomzodlar. */
export function pedagogyPool(items) {
  const pool = [];
  for (const it of [...items].sort((a, b) => a.file - b.file || a.n - b.n)) {
    if (!Array.isArray(it.answers) || it.answers.length !== 4 || !(it.correct >= 0 && it.correct < 4) || !String(it.question || "").trim()) continue;
    const tok = tokens(`${it.question} ${it.answers.join(" ")}`);
    if (pool.some((p) => similarity(p.tok, tok) >= SIMILAR)) continue;        // pedagogika bazasining o'zidagi takrorlar
    pool.push({ ...it, id: `PED-${String(it.file).padStart(2, "0")}-${String(it.n).padStart(2, "0")}`, letter: LETTERS[it.correct], tok });
  }
  return pool;
}

const para = (text) => [{ t: "p", text: String(text).split(/\s+/).filter(Boolean).join(" ") }];

/** Bitta mock uchun tanlov. used: {ids:Set, toks:Array<Set>} — barcha avvalgi va shu sessiyadagi mocklar (o'zgartiriladi). */
function pickOne(number, phys, ped, used) {
  const seed = `mock-${number}`;
  const isFree = (c) => !used.ids.has(c.id) && !used.toks.some((t) => similarity(t, c.tok) >= SIMILAR);
  const take = (c) => { used.ids.add(c.id); used.toks.push(c.tok); };
  const letters = {};
  const chosen = [];
  for (const [key] of MOCK_GEN.physicsSections) {
    const byTopic = new Map();
    for (const c of phys.filter((x) => x.section === key).sort((a, b) => hash(seed, "q", a.id) - hash(seed, "q", b.id))) {
      if (!byTopic.has(c.topic)) byTopic.set(c.topic, []);
      byTopic.get(c.topic).push(c);
    }
    const topics = [...byTopic.keys()].sort((a, b) => hash(seed, "t", key, a) - hash(seed, "t", key, b));
    const need = { ...MOCK_GEN.diffTarget };
    const usedTopic = new Map(topics.map((t) => [t, 0]));
    const picked = [];
    let progress = true;
    while (picked.length < MOCK_GEN.perSection && progress) {
      progress = false;
      for (const t of topics) {
        if (picked.length >= MOCK_GEN.perSection) break;
        const cands = byTopic.get(t).filter(isFree);
        if (!cands.length) continue;
        const live = topics.filter((x) => byTopic.get(x).some(isFree));
        if (Math.min(...live.map((x) => usedTopic.get(x))) < usedTopic.get(t)) continue;
        const want = cands.filter((c) => (need[c.level] || 0) > 0);
        const list = (want.length ? want : cands).sort((a, b) => (letters[a.letter] || 0) - (letters[b.letter] || 0) || hash(seed, "p", a.id) - hash(seed, "p", b.id));
        const c = list[0];
        picked.push(c); take(c);
        usedTopic.set(t, usedTopic.get(t) + 1);
        need[c.level] = (need[c.level] || 0) - 1;
        letters[c.letter] = (letters[c.letter] || 0) + 1;
        progress = true;
      }
    }
    if (picked.length < MOCK_GEN.perSection) throw new Error(`Mock ${number}: «${key}» bobida takrorlanmaydigan savol yetmadi (${picked.length}/${MOCK_GEN.perSection})`);
    picked.sort((a, b) => a.level - b.level || hash(seed, "o", a.id) - hash(seed, "o", b.id));
    chosen.push(picked);
  }
  // pedagogika: fayllar bo'yicha navbatma-navbat (turli fayllardan), javob harflari muvozanatli
  const files = [...new Set(ped.map((p) => p.file))].sort((a, b) => hash(seed, "pf", a) - hash(seed, "pf", b));
  const peds = [];
  let progress = true;
  while (peds.length < MOCK_GEN.pedagogy && progress) {
    progress = false;
    for (const f of files) {
      if (peds.length >= MOCK_GEN.pedagogy) break;
      const cands = ped.filter((p) => p.file === f && isFree(p))
        .sort((a, b) => (letters[a.letter] || 0) - (letters[b.letter] || 0) || hash(seed, "pq", a.id) - hash(seed, "pq", b.id));
      if (!cands.length) continue;
      peds.push(cands[0]); take(cands[0]);
      letters[cands[0].letter] = (letters[cands[0].letter] || 0) + 1;
      progress = true;
    }
  }
  if (peds.length < MOCK_GEN.pedagogy) throw new Error(`Mock ${number}: takrorlanmaydigan pedagogika savoli yetmadi (${peds.length}/${MOCK_GEN.pedagogy})`);
  peds.sort((a, b) => a.file - b.file || a.n - b.n);
  return { chosen, peds };
}

function bundleFor(number, { chosen, peds }) {
  const tid = `att-fizika-mock-${String(number).padStart(2, "0")}`;
  const day = MOCK_GEN.firstMockDay + number - 1;
  const topics = [...MOCK_GEN.physicsSections.map(([, t]) => t), PED_TITLE];
  const ids = [], questions = [], answers = {}, solutions = [], topicIdx = [];
  chosen.forEach((list, si) => {
    for (const c of list) {
      const e = { ...c.q, position: ids.length + 1, sectionTitle: topics[si] };
      ids.push(c.id); questions.push(e); answers[c.id] = c.letter; solutions.push(c.sol); topicIdx.push(si);
    }
  });
  for (const p of peds) {
    questions.push({
      id: p.id, section: "pedagogika", sectionTitle: PED_TITLE, topic: PED_TITLE, type: "mcq", evaluationType: "auto",
      difficulty: "medium", difficultyLevel: 2, question: para(p.question),
      options: p.answers.map((a, i) => ({ key: LETTERS[i], blocks: para(a) })), optionCount: 4,
      position: ids.length + 1, bookNumber: `P${p.file}.${p.n}`, contentVersion: 1,
    });
    solutions.push({ id: p.id, evaluationType: "auto", correctAnswer: p.letter, solutionResult: p.letter, solutionStatus: "theory",
                     solution: [{ t: "answer", blocks: para(`${p.letter}) ${p.answers[p.correct]}`) }] });
    ids.push(p.id); answers[p.id] = p.letter; topicIdx.push(topics.length - 1);
  }
  const n = ids.length;
  const nPhys = n - peds.length;
  const diff = { 1: 0, 2: 0, 3: 0, 4: 0 };
  questions.forEach((q) => { diff[q.difficultyLevel || 2] = (diff[q.difficultyLevel || 2] || 0) + 1; });
  const planHash = String(hash(JSON.stringify([ids, Object.values(answers)])).toString(16)).padStart(8, "0")
    + String(hash("2", JSON.stringify([ids, Object.values(answers)])).toString(16)).padStart(8, "0");
  const comp = { fizika: nPhys, pedagogika: peds.length };
  const maxScore = n * MOCK_GEN.points;
  const test = {
    id: tid, course: "fizika", kind: "mock", schemaVersion: 1, dayNumber: day, mockNumber: number,
    section: "mock", sectionTitle: `Mock test ${number}`, topics, topicParts: [], questionIds: ids, questionCount: n,
    questionTopicIdx: topicIdx, questionEval: ids.map(() => "a"), scorableCount: n, openCount: 0, unreliableCount: 0,
    difficulty: diff, bookRange: "", pointsPerQuestion: MOCK_GEN.points, maxScore,
    physicsCount: nPhys, pedagogyCount: peds.length, composition: comp, paidOnly: true,
    status: "draft", published: false, publishAt: null, publishedAt: null, publishedBy: null,
    solutionAvailableAt: null, archivedAt: null, timeLimitSeconds: MOCK_GEN.timeLimit, currentVersion: 1, planHash,
    notification: { title: `Mock test ${number} tayyor!`, body: `${n} savol · ${nPhys} fizika + ${peds.length} pedagogika · ${maxScore} ball`,
                    href: `attestatsiya/fizika-test.html?day=${day}` },
    figureCount: 0,
  };
  const base = `attestationPhysicsDailyTests/${tid}`;
  const ops = [
    { op: "set", path: base, data: test },
    { op: "create", path: `${base}/versions/v1`, data: { testId: tid, version: 1, dayNumber: day, questionIds: ids, questions } },
    { op: "create", path: `${base}/keys/v1`, data: { testId: tid, version: 1, questionIds: ids, answers, scorableCount: n } },
    { op: "create", path: `${base}/solutions/v1`, data: { testId: tid, version: 1, questionIds: ids, items: solutions } },
  ];
  return {
    format: "oliyfizika-attestation-mock-import", schemaVersion: 1, testId: tid, dayNumber: day,
    counts: { questions: n, physics: nPhys, pedagogy: peds.length, maxScore, figures: 0, solutionFigures: 0 },
    planHash, ops,
  };
}

const nestedArray = (v, inArr = false) => Array.isArray(v)
  ? (inArr || v.some((x) => nestedArray(x, true)))
  : (v && typeof v === "object" ? Object.values(v).some((x) => nestedArray(x, false)) : false);

/** Bundle tekshiruvi (Python generatorlaridagi validate() bilan bir xil mezonlar) — xatolar ro'yxati. */
export function validateMockBundle(b) {
  const errs = [];
  const ok = (c, m) => { if (!c) errs.push(m); };
  const [t, ver, key, sol] = b.ops.map((o) => o.data);
  const ids = t.questionIds;
  ok(ids.length === 50 && new Set(ids).size === 50, "50 ta noyob savol");
  ok(t.maxScore === 100 && t.timeLimitSeconds === 7200 && t.paidOnly === true, "100 ball / 2 soat / paidOnly");
  const per = {};
  t.questionTopicIdx.forEach((i) => { per[i] = (per[i] || 0) + 1; });
  ok([0, 1, 2, 3, 4].every((i) => per[i] === MOCK_GEN.perSection) && per[5] === MOCK_GEN.pedagogy, "5 bob × 7 + 15 pedagogika");
  ok(JSON.stringify(Object.keys(key.answers)) === JSON.stringify(ids) && key.scorableCount === 50, "kalit tartibi");
  ok(JSON.stringify(ver.questions.map((q) => q.id)) === JSON.stringify(ids) && JSON.stringify(sol.items.map((i) => i.id)) === JSON.stringify(ids), "version/solution tartibi");
  ok(sol.items.every((i) => i.correctAnswer === key.answers[i.id]), "yechim javobi kalit bilan bir xil");
  const verJson = JSON.stringify(ver);
  ok(!["correctAnswer", "solution", "bookAnswer", "solutionResult", "answers", "review", "verify"].some((k) => verJson.includes(`"${k}"`)), "version (public) javob maydonlarisiz");
  ok(!hasFigure(ver) && !hasFigure(sol), "rasm yo'q");
  for (const q of ver.questions) ok(q.optionCount === q.options.length && q.options.some((o) => o.key === key.answers[q.id]), `${q.id}: javob variantlar ichida`);
  const toks = ver.questions.map((q) => tokens(questionText(q)));
  for (let i = 0; i < toks.length; i++) for (let j = i + 1; j < toks.length; j++) {
    if (similarity(toks[i], toks[j]) >= SIMILAR) errs.push(`takror: ${ids[i]} ≈ ${ids[j]}`);
  }
  for (const o of b.ops) {
    ok(!nestedArray(o.data), `${o.path}: ichma-ich massiv`);
    ok(new TextEncoder().encode(JSON.stringify(o.data)).length < 900_000, `${o.path}: hajm`);
  }
  return errs;
}

/** Bundle'lar orasida (va avvalgi mocklar bilan) takror yo'qligini tekshiradi. prev: [{id, tok}] */
export function crossDuplicates(bundles, prev = []) {
  const all = [...prev];
  const errs = [];
  for (const b of bundles) {
    for (const q of b.ops[1].data.questions) {
      const tok = tokens(questionText(q));
      const hit = all.find((p) => p.id === q.id || similarity(p.tok, tok) >= SIMILAR);
      if (hit) errs.push(`${b.testId}: ${q.id} ≈ ${hit.id}${hit.testId ? ` (${hit.testId})` : ""}`);
      all.push({ id: q.id, tok, testId: b.testId });
    }
  }
  return errs;
}

/**
 * Asosiy kirish: yangi pullik mocklar.
 * @param {object} p
 * @param {number[]} p.numbers           masalan [3, 4, 5]
 * @param {Array} p.days                 physicsPool() uchun kunlik testlar
 * @param {Map} p.privates               qid → private/answer
 * @param {Array} p.pedagogy             pedagogika fayllaridagi savollar
 * @param {Array} p.existingMocks        [{testId, questions}] — avvalgi mocklar (takrorlanmasligi uchun)
 */
export function generateMocks({ numbers, days, privates, pedagogy, existingMocks = [] }) {
  const phys = physicsPool(days, privates);
  const ped = pedagogyPool(pedagogy);
  const prev = [];
  const used = { ids: new Set(), toks: [] };
  for (const m of existingMocks) {
    for (const q of m.questions || []) {
      const tok = tokens(questionText(q));
      used.ids.add(q.id); used.toks.push(tok); prev.push({ id: q.id, tok, testId: m.testId });
    }
  }
  const bundles = numbers.map((n) => bundleFor(n, pickOne(n, phys, ped, used)));
  const errors = [];
  for (const b of bundles) for (const e of validateMockBundle(b)) errors.push(`${b.testId}: ${e}`);
  errors.push(...crossDuplicates(bundles, prev));
  return { bundles, errors, pool: { physics: phys.length, pedagogy: ped.length } };
}

/** pedagogika-testlari/data/testN.js matnini o'qiydi (window.testQuestions = [...]); faylning o'zi o'zgarmaydi. */
export function parsePedagogyFile(src, file) {
  const i = src.indexOf(".testQuestions");
  if (i < 0) return [];
  const w = {};
  // test8.js boshida «indow» xatosi bor — faqat o'qishda tuzatiladi (python generatoridagi kabi)
  new Function("window", `window${src.slice(i)}`)(w);
  return (w.testQuestions || []).map((q, j) => ({ file, n: j + 1, question: q.question, answers: q.answers, correct: q.correct }));
}
