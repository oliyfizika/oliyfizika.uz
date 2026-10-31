/* Simulyatsiya va laboratoriya sahifalari uchun avtomatik tarjima (ru | en). Klassik skript: sahifa modullaridan OLDIN ishlaydi.
 *
 * Kod o'zgartirilmaydi: o'zbekcha matn qayerda paydo bo'lmasin (DOM matni, aria-label/title/placeholder/alt, canvas fillText),
 * lug'atdagi tarjimaga almashtiriladi. Lug'at kaliti — o'zbekcha matn, sonlar `{#}` bilan almashtirilgan:
 *   "Bosim kuchi" -> "Сила давления";  "Tezlik: {#} m/s" -> "Скорость: {#} м/с"  (sonlar tartib bilan qaytariladi; {#2} — tartibni o'zgartirish).
 * Lug'at fayllari: assets/i18n/<til>/sim/common.json va sim/<sahifa-nomi>.json. Tarjima topilmasa — o'zbekcha matn qoladi.
 * O'zbek tilida skript hech narsa qilmaydi. */
(function () {
  var lang = "uz";
  try { lang = JSON.parse(localStorage.getItem("oliyfizika:lang") || '"uz"'); } catch (e) { /* ignore */ }
  if (lang !== "ru" && lang !== "en") return;
  var me = document.currentScript;
  if (!me || !me.src) return;
  var base = new URL("../../i18n/" + lang + "/sim/", me.src).href;
  var page = location.pathname.split("/").pop().replace(/\.html?$/, "") || "index";

  var D = Object.create(null);
  function load(name) {
    try {
      var x = new XMLHttpRequest();
      x.open("GET", base + name + ".json", false); // sinxron: sahifa modullari ishga tushishidan oldin tayyor bo'lishi kerak
      x.send();
      if (x.status === 200) { var j = JSON.parse(x.responseText); for (var k in j) D[k] = j[k]; }
    } catch (e) { /* tarjima yo'q — o'zbekcha */ }
  }
  load("common");
  load(page);

  var NUM = /\d+(?:[.,]\d+)?/g;
  var cache = new Map();
  function compute(s) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    var core = m[2];
    if (!core) return s;
    var nums = [];
    var key = core.replace(NUM, function (x) { nums.push(x); return "{#}"; });
    var t = D[key];
    if (t == null) return s;
    var i = 0;
    t = t.replace(/\{#(\d*)\}/g, function (_, n) { var v = n ? nums[+n - 1] : nums[i++]; return v == null ? "" : v; });
    return m[1] + t + m[3];
  }
  function tx(s) {
    if (typeof s !== "string" || s.length < 2 || !/[A-Za-z]/.test(s)) return s;
    var c = cache.get(s);
    if (c !== undefined) return c;
    var out = compute(s);
    if (cache.size > 6000) cache.clear();
    cache.set(s, out);
    return out;
  }

  /* DOM */
  var ATTRS = ["aria-label", "title", "placeholder", "alt"];
  var SKIP = /^(SCRIPT|STYLE|CANVAS|TEXTAREA)$/;
  function fixEl(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute && el.getAttribute(ATTRS[i]);
      if (v) { var t = tx(v); if (t !== v) el.setAttribute(ATTRS[i], t); }
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { var p = root.parentNode; if (!p || !SKIP.test(p.nodeName)) { var t = tx(root.nodeValue); if (t !== root.nodeValue) root.nodeValue = t; } return; }
    if (root.nodeType !== 1 || SKIP.test(root.nodeName)) return;
    fixEl(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (!SKIP.test(n.parentNode.nodeName)) { var t2 = tx(n.nodeValue); if (t2 !== n.nodeValue) n.nodeValue = t2; } }
      else if (!SKIP.test(n.nodeName)) fixEl(n);
    }
  }
  var pending = [];
  var scheduled = false;
  function flush() {
    scheduled = false;
    var list = pending; pending = [];
    for (var i = 0; i < list.length; i++) walk(list[i]);
  }
  var mo = new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === "characterData") pending.push(r.target);
      else if (r.type === "attributes") fixEl(r.target);
      else for (var j = 0; j < r.addedNodes.length; j++) pending.push(r.addedNodes[j]);
    }
    if (pending.length && !scheduled) { scheduled = true; Promise.resolve().then(flush); }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  function fixTitle() { var t = tx(document.title); if (t !== document.title) document.title = t; }
  document.addEventListener("DOMContentLoaded", function () { walk(document.body); fixTitle(); });
  window.addEventListener("load", function () { walk(document.body); fixTitle(); });

  /* Canvas matnlari */
  var C = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (C) {
    ["fillText", "strokeText", "measureText"].forEach(function (fn) {
      var orig = C[fn];
      if (!orig) return;
      C[fn] = function (text) { arguments[0] = tx(String(text)); return orig.apply(this, arguments); };
    });
  }
})();
