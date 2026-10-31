// ==========================================================================
// Milliy sertifikat — umumiy sahifa (milliy-sertifikat/milliy-sertifikat.html).
// Faqat ikonlar va haqiqiy sonlar: testlar soni mock-testlar/data/tests.json dan olinadi
// (savollar fayllari bu sahifada YUKLANMAYDI). Ruxsat tekshiruvi — mavjud milliy-sertifikat-access.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { t, currentLang } from "../core/i18n.js";

document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

async function renderSummary() {
  const box = document.querySelector("[data-tests-summary]");
  try {
    const res = await fetch(new URL("mock-testlar/data/tests.json", location.href), { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const list = Array.isArray(data?.tests) ? data.tests : [];
    if (!list.length) { box.textContent = t("ms.summary.none", "Hozircha interaktiv testlar yo‘q."); return; }
    box.textContent = t("ms.summary.count", `${list.length} ta interaktiv mock test mavjud. Natijalar va javoblaringiz shu qurilmada saqlanadi.`, { n: list.length });
    const facts = document.querySelector("[data-solve-facts]");
    const li = document.createElement("li");
    li.innerHTML = t("ms.fact.tests", `<b>${list.length}</b> ta test`, { n: list.length });
    facts.prepend(li);
  } catch (error) {
    console.error("[milliy-sertifikat] testlar ro'yxati:", error);
    box.textContent = t("ms.summary.error", "Testlar ro‘yxatini yuklab bo‘lmadi.");
  }
}

renderSummary();

// Ruxsat xabarlari milliy-sertifikat-access.js tomonidan o'zbekcha yoziladi (u fayl o'zgartirilmaydi);
// bu yerda faqat ko'rinadigan matn tanlangan tilga o'giriladi.
if (currentLang !== "uz") {
  const msg = document.querySelector("#mockTestsAccessMessage");
  const MAP = {
    "Mock testlar uchun tizimga kiring va ruxsatga ega bo‘ling.": "ms.access.login",
    "Mock testlar faqat ruxsat berilgan foydalanuvchilar uchun ochiq.": "ms.access.denied",
    "Ruxsatni tekshirib bo‘lmadi. Iltimos, keyinroq urinib ko‘ring.": "ms.access.error",
  };
  if (msg) {
    new MutationObserver(() => {
      const key = MAP[msg.textContent.trim()];
      if (key) msg.textContent = t(key, msg.textContent);
    }).observe(msg, { childList: true, characterData: true, subtree: true });
  }
}
