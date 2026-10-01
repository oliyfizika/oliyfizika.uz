// Ilmiy kalkulyator. Asl testlardagi tugmalar va DEG/RAD rejimi saqlangan,
// lekin eval/Function o'rniga xavfsiz (recursive-descent) parser ishlatiladi.
import { $, h, clear } from "./dom.js";

const KEYS = ["DEG", "(", ")", "⌫", "C", "sin(", "cos(", "tan(", "√", "^", "7", "8", "9", "÷", "π", "4", "5", "6", "×", "e", "1", "2", "3", "−", "ln(", "0", ".", "log(", "+", "="];
const OPS = ["÷", "×", "−", "+", "^", "√"];
const FUNCS = ["sin", "cos", "tan", "ln", "log", "sqrt"];

function tokenize(src) {
  const s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/√/g, "sqrt").replace(/,/g, ".");
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
    if (num) { tokens.push({ t: "num", v: parseFloat(num[0]) }); i += num[0].length; continue; }
    const word = /^[a-zA-Zπ]+/.exec(s.slice(i));
    if (word) {
      let w = word[0];
      // "sinπ" kabi birikmalarni ajratish
      while (w.length) {
        const f = FUNCS.find((fn) => w.startsWith(fn));
        if (f) { tokens.push({ t: "fn", v: f }); w = w.slice(f.length); continue; }
        if (w.startsWith("pi")) { tokens.push({ t: "num", v: Math.PI }); w = w.slice(2); continue; }
        if (w[0] === "π") { tokens.push({ t: "num", v: Math.PI }); w = w.slice(1); continue; }
        if (w[0] === "e" || w[0] === "E") { tokens.push({ t: "num", v: Math.E }); w = w.slice(1); continue; }
        throw new Error("bad token");
      }
      i += word[0].length;
      continue;
    }
    if ("+-*/^()".includes(c)) { tokens.push({ t: "op", v: c }); i++; continue; }
    throw new Error("bad char");
  }
  // yashirin ko'paytirish: 2π, 3(4), )( , 2sin(30)
  const out = [];
  tokens.forEach((tk, k) => {
    const prev = tokens[k - 1];
    const prevEnds = prev && (prev.t === "num" || (prev.t === "op" && prev.v === ")"));
    const curStarts = tk.t === "num" || tk.t === "fn" || (tk.t === "op" && tk.v === "(");
    if (prevEnds && curStarts) out.push({ t: "op", v: "*" });
    out.push(tk);
  });
  return out;
}

export function evaluate(expr, degrees = true) {
  const tokens = tokenize(expr);
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (v) => {
    const tk = tokens[pos];
    if (!tk || (v !== undefined && tk.v !== v)) throw new Error("syntax");
    pos++;
    return tk;
  };
  const trig = (fn, x) => fn(degrees ? (x * Math.PI) / 180 : x);
  const apply = (name, x) => ({
    sin: () => trig(Math.sin, x),
    cos: () => trig(Math.cos, x),
    tan: () => trig(Math.tan, x),
    ln: () => Math.log(x),
    log: () => Math.log10(x),
    sqrt: () => Math.sqrt(x),
  })[name]();

  function expression() {
    let v = term();
    while (peek() && (peek().v === "+" || peek().v === "-") && peek().t === "op") {
      const op = eat().v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = unary();
    while (peek() && peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = eat().v;
      const r = unary();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function unary() {
    if (peek() && peek().t === "op" && (peek().v === "-" || peek().v === "+")) {
      const op = eat().v;
      const v = unary();
      return op === "-" ? -v : v;
    }
    return power();
  }
  function power() {
    const base = primary();
    if (peek() && peek().t === "op" && peek().v === "^") {
      eat();
      return Math.pow(base, unary()); // o'ngdan assotsiativ
    }
    return base;
  }
  function primary() {
    const tk = peek();
    if (!tk) throw new Error("syntax");
    if (tk.t === "num") { eat(); return tk.v; }
    if (tk.t === "fn") {
      eat();
      if (peek() && peek().v === "(") {
        eat("(");
        const v = expression();
        if (peek() && peek().v === ")") eat(")"); // yopilmagan qavsga ruxsat
        return apply(tk.v, v);
      }
      return apply(tk.v, unary());
    }
    if (tk.v === "(") {
      eat("(");
      const v = expression();
      if (peek() && peek().v === ")") eat(")");
      return v;
    }
    throw new Error("syntax");
  }

  const value = expression();
  if (pos !== tokens.length) throw new Error("syntax");
  return value;
}

export function initCalculator(root) {
  let expr = "";
  let degrees = true;
  const input = h("input", { id: "calcInput", class: "calc-input", readOnly: true, inputmode: "none", "aria-label": "Ifoda" });
  const result = h("div", { class: "calc-result", "aria-live": "polite" });
  const mode = h("span", { class: "calc-mode" }, "DEG");
  const grid = h("div", { class: "calc-grid" });

  function render(commit = false) {
    mode.textContent = degrees ? "DEG" : "RAD";
    const degBtn = grid.querySelector('[data-k="DEG"]');
    if (degBtn) degBtn.textContent = degrees ? "DEG" : "RAD";
    input.value = expr;
    if (!expr) { result.textContent = ""; return; }
    try {
      const r = evaluate(expr, degrees);
      if (!Number.isFinite(r)) { result.textContent = "Xatolik"; return; }
      const shown = String(Math.round((r + Number.EPSILON) * 1e12) / 1e12);
      result.textContent = shown;
      if (commit) { expr = String(r); input.value = expr; }
    } catch {
      result.textContent = "Xatolik";
    }
  }

  function press(k) {
    if (k === "DEG") { degrees = !degrees; return render(); }
    if (k === "C") { expr = ""; return render(); }
    if (k === "⌫") { expr = expr.slice(0, -1); return render(); }
    if (k === "=") return render(true);
    expr += k === "√" ? "√(" : k;
    render();
  }

  KEYS.forEach((k) => {
    const cls = k === "=" ? "eq" : k === "C" ? "clr" : OPS.includes(k) ? "op" : "";
    grid.append(h("button", { type: "button", class: cls, dataset: { k }, onclick: () => press(k) }, k));
  });

  clear(root).append(
    h("div", { class: "calc-display" },
      h("div", { class: "calc-mini" }, mode, h("span", {}, "OliyFizika.uz")),
      input,
      result),
    grid);
  render();

  // Fizik klaviaturadan ham kiritish (faqat kalkulyator oynasi ochiq bo'lganda).
  const keyMap = { "*": "×", "/": "÷", "-": "−", "Enter": "=", "=": "=", "Backspace": "⌫", "Delete": "C" };
  return {
    handleKey(e) {
      if (/^[0-9.+()^]$/.test(e.key)) { press(e.key); e.preventDefault(); return true; }
      if (keyMap[e.key]) { press(keyMap[e.key]); e.preventDefault(); return true; }
      return false;
    },
  };
}
