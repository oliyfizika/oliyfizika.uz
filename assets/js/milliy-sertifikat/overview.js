// ==========================================================================
// Milliy sertifikat — umumiy sahifa (milliy-sertifikat/milliy-sertifikat.html).
// Faqat ikonlar va haqiqiy sonlar: testlar soni mock-testlar/data/tests.json dan olinadi
// (savollar fayllari bu sahifada YUKLANMAYDI). Ruxsat tekshiruvi — mavjud milliy-sertifikat-access.js.
// ==========================================================================

import { icon } from "../ui/icons.js";

document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

async function renderSummary() {
  const box = document.querySelector("[data-tests-summary]");
  try {
    const res = await fetch(new URL("mock-testlar/data/tests.json", location.href), { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const list = Array.isArray(data?.tests) ? data.tests : [];
    if (!list.length) { box.textContent = "Hozircha interaktiv testlar yo‘q."; return; }
    box.textContent = `${list.length} ta interaktiv mock test mavjud. Natijalar va javoblaringiz shu qurilmada saqlanadi.`;
    const facts = document.querySelector("[data-solve-facts]");
    const li = document.createElement("li");
    li.innerHTML = `<b>${list.length}</b> ta test`;
    facts.prepend(li);
  } catch (error) {
    console.error("[milliy-sertifikat] testlar ro'yxati:", error);
    box.textContent = "Testlar ro‘yxatini yuklab bo‘lmadi.";
  }
}

renderSummary();
