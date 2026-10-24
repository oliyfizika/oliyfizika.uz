// ==========================================================================
// Elektr zanjiri — virtual laboratoriya: maydon to'ri va tayyor zanjirlar (DOM'siz).
// To'r: COLS × ROWS tugun. Har bir qirra (qo'shni ikki tugun orasi) bo'sh yoki bitta element bo'ladi.
// Qirra tartibi: avval gorizontal (r qator, c ustun), keyin vertikal. Element qirraning a → b yo'nalishida.
// ==========================================================================

import { MATERIALS } from "./circuit-physics.js";

export const COLS = 9;
export const ROWS = 5;
export const NODE_COUNT = COLS * ROWS;
export const nodeId = (c, r) => r * COLS + c;
export const nodeCR = (n) => ({ c: n % COLS, r: Math.floor(n / COLS) });

const H_COUNT = (COLS - 1) * ROWS;
export const hEdge = (c, r) => r * (COLS - 1) + c;           // (c,r) — (c+1,r)
export const vEdge = (c, r) => H_COUNT + r * COLS + c;       // (c,r) — (c,r+1)

export const EDGES = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 1; c++) EDGES.push({ i: EDGES.length, a: nodeId(c, r), b: nodeId(c + 1, r), orient: "h", c, r });
for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) EDGES.push({ i: EDGES.length, a: nodeId(c, r), b: nodeId(c, r + 1), orient: "v", c, r });

export const TYPE_INFO = {
  wire:      { label: "Sim",          prefix: "" },
  switch:    { label: "Kalit",        prefix: "K" },
  resistor:  { label: "Rezistor",     prefix: "R" },
  rheostat:  { label: "Reostat",      prefix: "Rh" },
  conductor: { label: "Sim (ρ, l, S)", prefix: "Rc" },
  lamp:      { label: "Lampochka",    prefix: "L" },
  battery:   { label: "Batareya",     prefix: "ε" },
  ammeter:   { label: "Ampermetr",    prefix: "A" },
  voltmeter: { label: "Voltmetr",     prefix: "V" },
  diode:     { label: "Diod",         prefix: "D" },
  led:       { label: "Yorug‘lik diodi (LED)", prefix: "LED" },
};

export function defaultProps(type) {
  switch (type) {
    case "wire": return { type };
    case "switch": return { type, closed: true };
    case "resistor": return { type, R: 10 };
    case "rheostat": return { type, Rmax: 50, pos: 0.4 };
    case "conductor": return { type, mat: "nixrom", l: 3, S: 0.5 };
    case "lamp": return { type, R: 12, pNom: 3 };     // 6 V / 3 W
    case "battery": return { type, emf: 9, r: 0, plus: "a" };
    case "ammeter": return { type };
    case "voltmeter": return { type, plus: "a" };
    case "diode": return { type, rev: false };
    case "led": return { type, rev: false, color: "red" };
    default: throw new Error("noma'lum tur: " + type);
  }
}

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n) => String(n).split("").map((d) => SUB[+d]).join("");

/** Qirralar bo'yicha nomlar: R₁, L₂, ε₁, A₃ ... (qirra tartibida). */
export function labelsFor(cells) {
  const count = {}, out = new Map();
  [...cells.keys()].sort((x, y) => x - y).forEach((i) => {
    const t = cells.get(i).type, p = TYPE_INFO[t].prefix;
    if (!p) return;
    count[t] = (count[t] || 0) + 1;
    out.set(i, p + sub(count[t]));
  });
  return out;
}

/** Hujayralar → solve() uchun elementlar ro'yxati. index[k] — elementning qirra raqami. */
export function toElements(cells) {
  const index = [...cells.keys()].sort((x, y) => x - y);
  const elements = index.map((i) => ({ ...cells.get(i), a: EDGES[i].a, b: EDGES[i].b }));
  return { elements, index };
}

/* ------------------------------------------------------------------ Tayyor zanjirlar */

const rectEdges = (c0, r0, c1, r1) => {
  const out = [];
  for (let c = c0; c < c1; c++) out.push(hEdge(c, r0));
  for (let r = r0; r < r1; r++) out.push(vEdge(c1, r));
  for (let c = c0; c < c1; c++) out.push(hEdge(c, r1));
  for (let r = r0; r < r1; r++) out.push(vEdge(c0, r));
  return out;
};

/** Voltmetr ulash: gorizontal element (c,r)–(c+1,r) ustidan; vertikal element (c,r)–(c,r+1) o'ngidan yoki chapidan. */
const vmAbove = (c, r) => ({ wires: [vEdge(c, r - 1), vEdge(c + 1, r - 1)], put: [[hEdge(c, r - 1), { type: "voltmeter", plus: "a" }]] });
const vmRight = (c, r) => ({ wires: [hEdge(c, r), hEdge(c, r + 1)], put: [[vEdge(c + 1, r), { type: "voltmeter", plus: "a" }]] });
const vmLeft = (c, r) => ({ wires: [hEdge(c - 1, r), hEdge(c - 1, r + 1)], put: [[vEdge(c - 1, r), { type: "voltmeter", plus: "a" }]] });

function make(...specs) {
  const cells = new Map();
  specs.forEach((s) => (s.wires || []).forEach((i) => cells.set(i, { type: "wire" })));
  specs.forEach((s) => (s.put || []).forEach(([i, props]) => cells.set(i, props)));
  return cells;
}
const bat = (emf, r = 0) => ({ ...defaultProps("battery"), emf, r, plus: "a" }); // vertikal chap qirrada musbat qutb yuqorida
const rails = (c0, c1) => { const w = []; for (let c = c0; c < c1; c++) w.push(hEdge(c, 1), hEdge(c, 3)); return w; };

export const PRESETS = {
  ohm: {
    title: "Om qonuni",
    lesson: "Qarshilik o‘zgarmas bo‘lsa, tok kuchi kuchlanishga to‘g‘ri proporsional: I = U/R. Batareyani tanlab EYuK ni o‘zgartiring — ampermetr va voltmetr ko‘rsatishini kuzating.",
    build: () => make(
      { wires: rectEdges(1, 1, 7, 3), put: [[vEdge(1, 2), bat(6)], [hEdge(2, 1), { type: "ammeter" }], [hEdge(5, 1), { type: "resistor", R: 20 }]] },
      vmAbove(5, 1),
    ),
    select: hEdge(5, 1), tab: "iu",
  },
  series: {
    title: "Ketma-ket ulash",
    lesson: "Ketma-ket ulashda tok hamma joyda bir xil, kuchlanishlar qo‘shiladi: U = U₁ + U₂ + U₃, R = R₁ + R₂ + R₃. Voltmetr R₂ dagi kuchlanishni ko‘rsatyapti.",
    build: () => make(
      { wires: rectEdges(1, 1, 7, 3), put: [[vEdge(1, 2), bat(12)], [hEdge(2, 1), { type: "resistor", R: 10 }], [hEdge(3, 1), { type: "resistor", R: 20 }], [hEdge(4, 1), { type: "resistor", R: 30 }], [hEdge(6, 1), { type: "ammeter" }]] },
      vmAbove(3, 1),
    ),
    select: hEdge(3, 1), tab: "bars",
  },
  parallel: {
    title: "Parallel ulash",
    lesson: "Parallel ulashda kuchlanish hamma shoxchada bir xil, toklar qo‘shiladi: I = I₁ + I₂ + I₃, 1/R = 1/R₁ + 1/R₂ + 1/R₃. Har shoxchada o‘z ampermetri bor.",
    build: () => {
      const put = [[vEdge(1, 2), bat(6)], [vEdge(1, 1), { type: "ammeter" }]];
      [[3, 10], [5, 20], [7, 30]].forEach(([c, R]) => { put.push([vEdge(c, 1), { type: "ammeter" }], [vEdge(c, 2), { type: "resistor", R }]); });
      return make({ wires: rails(1, 7), put }, { wires: [hEdge(7, 1), vEdge(8, 2), hEdge(7, 3)], put: [[vEdge(8, 1), { type: "voltmeter", plus: "a" }]] });
    },
    select: vEdge(5, 2), tab: "bars",
  },
  mixed: {
    title: "Aralash ulash",
    lesson: "R₁ ketma-ket, R₂ va R₃ parallel: R = R₁ + R₂R₃/(R₂ + R₃). Ikki voltmetr ko‘rsatishlari yig‘indisi manba kuchlanishiga teng.",
    build: () => make(
      {
        wires: [hEdge(1, 1), hEdge(3, 1), hEdge(4, 1), hEdge(5, 1), vEdge(4, 1), vEdge(6, 1), hEdge(1, 3), hEdge(2, 3), hEdge(3, 3), hEdge(4, 3), hEdge(5, 3)],
        put: [[vEdge(1, 2), bat(12)], [vEdge(1, 1), { type: "ammeter" }], [hEdge(2, 1), { type: "resistor", R: 10 }], [vEdge(4, 2), { type: "resistor", R: 20 }], [vEdge(6, 2), { type: "resistor", R: 30 }]],
      },
      vmAbove(2, 1), vmRight(6, 2),
    ),
    select: hEdge(2, 1), tab: "bars",
  },
  emf: {
    title: "To‘liq zanjir (EYuK, r)",
    lesson: "Manba ichki qarshiligi r ga ega: I = ε/(R + r), qisqichlardagi kuchlanish U = ε − Ir. Reostat qarshiligini kamaytirsangiz voltmetr ko‘rsatishi kamayadi.",
    build: () => make(
      { wires: rectEdges(1, 1, 6, 3), put: [[vEdge(1, 2), bat(12, 2)], [hEdge(2, 1), { type: "ammeter" }], [hEdge(4, 1), { type: "rheostat", Rmax: 20, pos: 0.5 }]] },
      vmLeft(1, 2),
    ),
    select: vEdge(1, 2), tab: "src",
  },
  cells: {
    title: "Tok manbalarini ulash",
    lesson: "Ikki batareya ketma-ket ulangan: EYuK lar va ichki qarshiliklar qo‘shiladi, ε = ε₁ + ε₂, r = r₁ + r₂. Chapdagi voltmetr ikkala manbaning umumiy kuchlanishini ko‘rsatadi. Batareyalardan birini tanlab «Qutblarni almashtirish» ni bosing — qarama-qarshi ulanganda EYuK lar ayiriladi va lampochka o‘chadi.",
    build: () => make(
      { wires: rectEdges(1, 1, 7, 3), put: [[vEdge(1, 1), bat(4.5, 0.5)], [vEdge(1, 2), bat(4.5, 0.5)], [hEdge(3, 1), { type: "ammeter" }], [vEdge(7, 2), { type: "lamp", R: 18, pNom: 4.5 }]] },
      { wires: [hEdge(0, 1), hEdge(0, 3), vEdge(0, 2)], put: [[vEdge(0, 1), { type: "voltmeter", plus: "a" }]] },
    ),
    select: vEdge(1, 1), tab: "bars",
  },
  rheostat: {
    title: "Reostat bilan tokni rostlash",
    lesson: "Reostat siljitgichini surib zanjirdagi tok kuchini va lampochka yorqinligini rostlang. Kalitni bosib zanjirni uzing yoki ulang.",
    build: () => make(
      { wires: rectEdges(1, 1, 7, 3), put: [[vEdge(1, 2), bat(9)], [hEdge(2, 1), { type: "switch", closed: true }], [hEdge(3, 1), { type: "rheostat", Rmax: 30, pos: 0.3 }], [hEdge(5, 1), { type: "ammeter" }], [vEdge(7, 2), { type: "lamp", R: 12, pNom: 3 }]] },
      vmRight(7, 2),
    ),
    select: hEdge(3, 1), tab: "bars",
  },
  conductor: {
    title: "O‘tkazgich qarshiligi",
    lesson: "Sim qarshiligi R = ρ·l/S: uzunlikka to‘g‘ri, kesim yuzaga teskari proporsional va materialga bog‘liq. Materialni, l va S ni o‘zgartiring.",
    build: () => make(
      { wires: rectEdges(1, 1, 6, 3), put: [[vEdge(1, 2), bat(6)], [hEdge(2, 1), { type: "conductor", mat: "nixrom", l: 3, S: 0.5 }], [hEdge(4, 1), { type: "ammeter" }]] },
      vmAbove(2, 1),
    ),
    select: hEdge(2, 1), tab: "iu",
  },
  lamps: {
    title: "Lampochkalar va kalitlar",
    lesson: "Turmushda iste’molchilar parallel ulanadi: har biri o‘z kalitiga ega, kuchlanish bir xil, jami tok esa ulanganlar toklari yig‘indisi.",
    build: () => {
      const put = [[vEdge(1, 2), bat(6)], [vEdge(1, 1), { type: "ammeter" }]];
      [3, 5, 7].forEach((c) => { put.push([vEdge(c, 1), { type: "switch", closed: c !== 7 }], [vEdge(c, 2), { type: "lamp", R: 12, pNom: 3 }]); });
      return make({ wires: rails(1, 7), put });
    },
    select: vEdge(3, 2), tab: "bars",
  },
  diode: {
    title: "Diod: bir tomonlama o‘tkazuvchanlik",
    lesson: "Diod tokni faqat bir yo‘nalishda o‘tkazadi. To‘g‘ri ulanganda unda ≈ 0,7 V tushadi. Diodni yoki batareyani tanlab «Yo‘nalishni almashtirish» ni bosing — tok to‘xtaydi, voltmetr esa butun kuchlanishni ko‘rsatadi.",
    build: () => make(
      { wires: rectEdges(1, 1, 7, 3), put: [[vEdge(1, 2), bat(5)], [hEdge(2, 1), { type: "ammeter" }], [hEdge(3, 1), { type: "resistor", R: 100 }], [hEdge(5, 1), { type: "diode", rev: false }]] },
      vmAbove(5, 1),
    ),
    select: hEdge(5, 1), tab: "iu",
  },
  led: {
    title: "Yorug‘lik diodi (LED)",
    lesson: "LED ochilish kuchlanishi rangga bog‘liq (qizil ≈ 1,9 V, ko‘k ≈ 2,6 V). Uni cheklovchi qarshiliksiz ulash mumkin emas: tok 20 mA atrofida bo‘lishi kerak. Reostat bilan yorqinlikni rostlang.",
    build: () => make(
      { wires: rectEdges(1, 1, 7, 3), put: [[vEdge(1, 2), bat(6)], [hEdge(2, 1), { type: "switch", closed: true }], [hEdge(3, 1), { type: "rheostat", Rmax: 500, pos: 0.44 }], [hEdge(5, 1), { type: "ammeter" }], [vEdge(7, 2), { type: "led", rev: false, color: "red" }]] },
      vmRight(7, 2),
    ),
    select: vEdge(7, 2), tab: "iu",
  },
  antiled: {
    title: "Qarama-qarshi ulangan LEDlar",
    lesson: "Ikki LED qarama-qarshi yo‘nalishda parallel ulangan: faqat to‘g‘ri yo‘nalishdagisi yonadi. Batareyani tanlab qutblarini almashtiring — endi ikkinchi LED yonadi.",
    build: () => make({
      wires: [...rectEdges(1, 1, 7, 3), vEdge(5, 1)],
      put: [[vEdge(1, 2), bat(6)], [hEdge(2, 1), { type: "resistor", R: 200 }], [hEdge(3, 1), { type: "ammeter" }], [vEdge(5, 2), { type: "led", rev: false, color: "red" }], [vEdge(7, 2), { type: "led", rev: true, color: "green" }]],
    }),
    select: vEdge(1, 2), tab: "bars",
  },
};

export const PRESET_ORDER = ["ohm", "series", "parallel", "mixed", "emf", "cells", "rheostat", "conductor", "lamps", "diode", "led", "antiled"];
export { MATERIALS };
