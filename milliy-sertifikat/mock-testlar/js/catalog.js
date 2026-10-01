// Mock testlar katalogi: data/tests.json dagi har bir test uchun kartochka chiqaradi.
// Savollar soni, bandlar va vaqt test JSON faylining o'zidan olinadi (qo'lda yozilmaydi).
import { SITE, CATALOG_URL } from "./config.js";
import { $, h, clear, authorFooter } from "./dom.js";
import { loadState } from "./storage.js";
import { itemCount, countFilledItems } from "./scoring.js";
import { checkMockAccess } from "./access-gate.js";
import { goToLogin } from "./session.js";
import { initTheme } from "./theme.js";

const BASE_URL = new URL("../", import.meta.url);
const resolveUrl = (p) => new URL(p, BASE_URL).href;
let uid = null; // kirgan foydalanuvchi (progress uid bo'yicha saqlanadi)

function statusBadge(test) {
  if (!uid) return null;
  const saved = loadState(test.id, uid);
  if (!saved || !saved.attemptId) return null;
  if (saved.submitted) return h("span", { class: "badge badge-done" }, "✓ Yakunlangan");
  if (Date.now() < saved.deadlineTs) {
    const n = countFilledItems(test.questions, saved.answers || {});
    return h("span", { class: "badge badge-progress" }, `⏳ Davom etmoqda • ${n}/${itemCount(test.questions)}`);
  }
  return h("span", { class: "badge badge-progress" }, "⏱ Vaqti tugagan");
}

function card(test) {
  const total = test.questions.length;
  const mcq = test.questions.filter((q) => q.type === "mcq").length;
  const saved = uid ? loadState(test.id, uid) : null;
  const label = saved && saved.attemptId && !saved.submitted ? "DAVOM ETTIRISH" : saved?.submitted ? "NATIJANI KO‘RISH" : "TESTNI BOSHLASH";
  const href = `test.html?id=${encodeURIComponent(test.id)}`;
  const action = uid
    ? h("a", { class: "btn btn-primary btn-block", href }, label)
    : h("button", { type: "button", class: "btn btn-primary btn-block", onclick: () => goToLogin(href) }, "KIRISH VA BOSHLASH");
  return h("article", { class: "test-card glass" },
    h("div", { class: "test-card__top" },
      h("span", { class: "test-card__num" }, `MOCK TEST №${test.number}`),
      statusBadge(test)),
    h("h2", {}, test.title),
    test.sourceVariant ? h("p", { class: "test-card__variant" }, test.sourceVariant) : null,
    h("ul", { class: "test-card__meta" },
      h("li", {}, h("b", {}, String(total)), " ta savol"),
      h("li", {}, h("b", {}, String(test.durationMinutes)), " daqiqa"),
      h("li", {}, h("b", {}, `${mcq} + ${total - mcq}`), " test / ochiq"),
      h("li", {}, h("b", {}, String(itemCount(test.questions))), " ta band")),
    action);
}

async function init() {
  initTheme($("#themeBtn"));
  $("#footerSlot").replaceWith(authorFooter(SITE));
  const grid = $("#testGrid");
  const status = $("#catalogStatus");

  const access = await checkMockAccess();
  if (access.allowed) {
    uid = access.session.uid;
    $("#userHint").textContent = `Siz ${access.session.name} sifatida kirgansiz. Natijalar shu nom bilan saqlanadi.`;
  } else if (access.reason === "login") {
    $("#userHint").textContent = "Testni boshlash uchun saytdagi akkauntingiz bilan kiring — ism va familiya profilingizdan olinadi.";
  } else {
    status.textContent = access.reason === "access" ? "Bu bo‘lim uchun sizda ruxsat mavjud emas." : "Ruxsatni tekshirib bo‘lmadi. Sahifani yangilang.";
    return;
  }

  try {
    const catalog = await fetch(resolveUrl(CATALOG_URL), { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Katalog yuklanmadi (${r.status})`);
      return r.json();
    });
    const results = await Promise.allSettled(catalog.tests.map((entry) =>
      fetch(resolveUrl(entry.file), { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error(`${entry.file}: ${r.status}`);
        return r.json();
      })));
    const tests = results.filter((r) => r.status === "fulfilled").map((r) => r.value).sort((a, b) => (a.number || 0) - (b.number || 0));
    results.filter((r) => r.status === "rejected").forEach((r) => console.error("Test yuklanmadi:", r.reason));
    clear(grid).append(...tests.map(card));
    status.remove();
  } catch (error) {
    console.error("Mock testlar katalogini yuklab bo‘lmadi:", error);
    status.textContent = "Testlarni yuklab bo‘lmadi. Sahifani yangilab ko‘ring.";
  }
}

init();
