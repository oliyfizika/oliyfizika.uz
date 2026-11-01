// ==========================================================================
// Interaktiv o‘yinlar — to‘plam tanlash paneli va to‘plam muharriri (umumiy UI).
//
//   mountSetPicker(container, { game, mode, onSelect })
//     mode: "mcq"  — test variantli o‘yinlar (Formulani top, Arqon tortish)
//           "open" — og‘zaki javobli o‘yin (Baraban): javob va variantlar ixtiyoriy, ball bor
//   openSetEditor(set | null, { mode, onSaved })
// ==========================================================================

import { icon } from "../../assets/js/ui/icons.js";
import { toast } from "../../assets/js/ui/feedback.js";
import { SYMBOLS } from "./sample-sets.js";
import {
  SAMPLE_SETS, LIMITS, getUserSets, onSetsChange, saveUserSet, deleteUserSet, copyOf, exportSet,
  importSetFile, normalizeSet, playableCount, kindLabel, rememberLast, lastUsed, findSet,
} from "./game-sets.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const CLOUD_TEXT = {
  off: "To‘plamlaringiz shu brauzerda saqlanadi. Tizimga kirsangiz, boshqa qurilmada ham ochiladi.",
  syncing: "Hisobingiz bilan sinxronlanmoqda…",
  on: "To‘plamlaringiz hisobingizda saqlanadi.",
  error: "Hisobga saqlab bo‘lmadi — to‘plamlar shu brauzerda saqlandi.",
};

// ========================================================================== picker
/**
 * Qo‘shimcha (ixtiyoriy) sozlamalar yangi o‘yinlar uchun:
 *   sampleFilter(set)  — qaysi namunalar ko‘rsatiladi (masalan, faqat formulalar);
 *   countPlayable(set) — o‘yinga yaraydigan elementlar soni; minPlayable — eng kam soni;
 *   unusableText       — yetarli bo‘lmaganda kartada chiqadigan izoh.
 */
export function mountSetPicker(container, { game, mode = "mcq", onSelect, sampleFilter, countPlayable, minPlayable, unusableText }) {
  const samples = sampleFilter ? SAMPLE_SETS.filter(sampleFilter) : SAMPLE_SETS;
  const fallbackId = samples[0]?.id || SAMPLE_SETS[0].id;
  let tab = "samples";
  let selectedId = lastUsed(game);
  if (!findSet(selectedId) || (findSet(selectedId).sample && !samples.some((x) => x.id === selectedId))) selectedId = fallbackId;
  if (getUserSets().some((s) => s.id === selectedId)) tab = "mine";

  container.classList.add("gm-picker");
  container.innerHTML = `
    <div class="gm-picker__bar">
      <div class="of-segment" role="tablist" aria-label="To‘plam turi">
        <button type="button" role="tab" data-tab="samples">Namunalar</button>
        <button type="button" role="tab" data-tab="mine">Mening to‘plamlarim <span class="gm-count" data-mine-count></span></button>
      </div>
      <div class="gm-picker__actions">
        <button type="button" class="of-btn of-btn--soft of-btn--sm" data-new>${icon("sparkles")} Yangi to‘plam</button>
        <label class="of-btn of-btn--ghost of-btn--sm gm-file">${icon("file")} Fayldan
          <input type="file" accept="application/json,.json" data-import hidden>
        </label>
      </div>
    </div>
    <p class="gm-picker__cloud of-hint" data-cloud></p>
    <ul class="gm-sets" data-list role="listbox" aria-label="To‘plamlar"></ul>`;

  const list = container.querySelector("[data-list]");
  const cloudEl = container.querySelector("[data-cloud]");

  const select = (id, { silent = false } = {}) => {
    const set = findSet(id);
    if (!set) return;
    selectedId = id;
    rememberLast(game, id);
    list.querySelectorAll("[data-id]").forEach((li) => li.setAttribute("aria-selected", String(li.dataset.id === id)));
    if (!silent) onSelect?.(set);
  };

  const openEditor = (set) => openSetEditor(set, {
    mode,
    onSaved: (saved) => { tab = "mine"; selectedId = saved.id; render(); select(saved.id); },
  });

  function card(set) {
    const playable = countPlayable ? countPlayable(set) : mode === "mcq" ? playableCount(set) : set.items.length;
    const unusable = playable < (minPlayable ?? (mode === "mcq" ? 2 : 1));
    const li = document.createElement("li");
    li.className = "gm-set";
    li.dataset.id = set.id;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", String(set.id === selectedId));
    if (unusable) li.dataset.unusable = "true";
    li.innerHTML = `
      <button type="button" class="gm-set__main" data-pick>
        <span class="gm-set__radio" aria-hidden="true">${icon("check")}</span>
        <span class="gm-set__body">
          <span class="gm-set__title">${esc(set.title)}</span>
          <span class="gm-set__topics">${set.topics.map((t) => `<span class="of-badge">${esc(t)}</span>`).join("")}</span>
          <span class="gm-set__meta">${kindLabel(set)} · ${set.items.length} ta${unusable ? ` · <b>${unusableText || (mode === "mcq" ? "kamida 2 ta javobli savol kerak" : "savol yo‘q")}</b>` : ""}</span>
        </span>
      </button>
      <span class="gm-set__tools">
        ${set.sample
          ? `<button type="button" class="of-btn of-btn--ghost of-btn--sm" data-copy title="Nusxa olib, o‘zingizga moslang">${icon("clipboard")} Nusxa</button>`
          : `<button type="button" class="of-btn of-btn--ghost of-btn--sm" data-edit>Tahrirlash</button>
             <button type="button" class="of-icon-btn" data-export aria-label="Faylga yuklab olish" title="Faylga yuklab olish (ulashish uchun)">${icon("external")}</button>
             <button type="button" class="of-icon-btn" data-delete aria-label="O‘chirish" title="O‘chirish">${icon("close")}</button>`}
      </span>`;
    li.querySelector("[data-pick]").addEventListener("click", () => {
      if (unusable) { openEditor(set.sample ? copyOf(set) : set); return; }
      select(set.id);
    });
    li.querySelector("[data-copy]")?.addEventListener("click", () => openEditor(copyOf(set)));
    li.querySelector("[data-edit]")?.addEventListener("click", () => openEditor(set));
    li.querySelector("[data-export]")?.addEventListener("click", () => exportSet(set));
    li.querySelector("[data-delete]")?.addEventListener("click", async () => {
      if (!confirm(`“${set.title}” to‘plami o‘chirilsinmi?`)) return;
      await deleteUserSet(set.id);
      if (selectedId === set.id) select(fallbackId);
      toast("To‘plam o‘chirildi.");
    });
    return li;
  }

  function render() {
    const mine = getUserSets();
    container.querySelector("[data-mine-count]").textContent = mine.length ? mine.length : "";
    container.querySelectorAll("[data-tab]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.tab === tab));
      b.setAttribute("aria-selected", String(b.dataset.tab === tab));
    });
    list.innerHTML = "";
    const sets = tab === "samples" ? samples : mine;
    if (!sets.length) {
      list.innerHTML = `<li class="gm-empty">
        <p>Hali o‘z to‘plamingiz yo‘q. Mavzu nomini yozing va unga mos ${mode === "open" ? "savollarni" : "formulalar yoki savollarni"} kiriting — to‘plam saqlanadi va uni barcha o‘yinlarda ishlatish mumkin.</p>
        <button type="button" class="of-btn of-btn--primary of-btn--sm" data-new-empty>${icon("sparkles")} Birinchi to‘plamni yaratish</button>
      </li>`;
      list.querySelector("[data-new-empty]").addEventListener("click", () => openEditor(null));
      return;
    }
    sets.forEach((s) => list.append(card(s)));
  }

  container.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
  container.querySelector("[data-new]").addEventListener("click", () => openEditor(null));
  container.querySelector("[data-import]").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const set = await importSetFile(file);
      tab = "mine";
      render();
      select(set.id);
      toast(`“${set.title}” to‘plami qo‘shildi.`);
    } catch (error) {
      toast(error?.message || "Faylni o‘qib bo‘lmadi.");
    }
  });

  onSetsChange((_, status) => {
    cloudEl.textContent = CLOUD_TEXT[status] || CLOUD_TEXT.off;
    cloudEl.dataset.status = status;
    render();
    if (!findSet(selectedId)) select(fallbackId);
  });
  select(selectedId);

  return { get selected() { return findSet(selectedId); }, select };
}

// ========================================================================== editor
export function openSetEditor(source, { mode = "mcq", onSaved } = {}) {
  const draft = source ? normalizeSet(JSON.parse(JSON.stringify(source))) : normalizeSet({ kind: mode === "open" ? "question" : "formula", items: [] });
  if (source?.sample) draft.id = copyOf(source).id;
  const isNew = !source || source.sample || !getUserSets().some((s) => s.id === source.id);
  if (!draft.items.length) draft.items = [{ q: "", a: "", w: [] }, { q: "", a: "", w: [] }, { q: "", a: "", w: [] }, { q: "", a: "", w: [] }];
  const showPts = mode === "open";

  const dlg = document.createElement("dialog");
  dlg.className = "gm-editor of-chrome";
  dlg.setAttribute("aria-labelledby", "gmEditorTitle");
  dlg.innerHTML = `
    <form method="dialog" class="gm-editor__form" novalidate>
      <header class="gm-editor__head">
        <div>
          <h2 id="gmEditorTitle">${isNew ? "Yangi to‘plam" : "To‘plamni tahrirlash"}</h2>
          <p class="of-hint">To‘plam barcha o‘yinlarda ishlaydi: Formulani top, Arqon tortish va Baraban.</p>
        </div>
        <button type="button" class="of-icon-btn" data-cancel aria-label="Yopish">${icon("close")}</button>
      </header>

      <div class="gm-editor__scroll">
        <div class="gm-editor__meta">
          <div class="of-field">
            <span class="of-label">Turi</span>
            <div class="of-segment" role="group" aria-label="To‘plam turi" data-kind>
              <button type="button" data-v="formula">Formulalar</button>
              <button type="button" data-v="question">Savollar</button>
            </div>
          </div>
          <label class="of-field">
            <span class="of-label">Mavzu</span>
            <input class="of-input" name="topic" maxlength="${LIMITS.topic}" placeholder="Masalan: Kinematika" required>
          </label>
          <label class="of-field">
            <span class="of-label">To‘plam nomi <span class="of-hint">(ixtiyoriy)</span></span>
            <input class="of-input" name="title" maxlength="${LIMITS.title}" placeholder="Masalan: 9-sinf, 1-chorak formulalari">
          </label>
        </div>

        <p class="gm-editor__help of-hint" data-help></p>

        <div class="gm-symbols" aria-label="Belgilar">
          <span class="of-hint">Belgilar:</span>
          ${SYMBOLS.map((s) => `<button type="button" class="gm-sym" data-sym="${esc(s)}" tabindex="-1">${esc(s)}</button>`).join("")}
        </div>

        <ol class="gm-rows" data-rows></ol>
        <button type="button" class="of-btn of-btn--soft gm-add-row" data-add>＋ <span data-add-label>Formula qo‘shish</span></button>
      </div>

      <footer class="gm-editor__foot">
        <span class="of-hint" data-count></span>
        <button type="button" class="of-btn of-btn--ghost" data-cancel>Bekor qilish</button>
        <button type="submit" class="of-btn of-btn--primary" data-save>Saqlash</button>
      </footer>
    </form>`;
  document.body.append(dlg);

  const form = dlg.querySelector("form");
  const rowsEl = dlg.querySelector("[data-rows]");
  form.topic.value = draft.topics[0] || "";
  form.title.value = source ? draft.title : "";
  let lastField = null;

  const labels = () => draft.kind === "formula"
    ? { q: "Formula nomi", qph: "Masalan: Nyutonning ikkinchi qonuni", a: "To‘g‘ri formula", aph: "F = ma", w: "Noto‘g‘ri formulalar", add: "Formula qo‘shish",
        help: mode === "open"
          ? "Har bir qatorga formula nomini va formulani yozing. Baraban o‘yinida formula nomi savol bo‘lib chiqadi, formula esa “Javobni ko‘rsatish” tugmasida ochiladi."
          : "Har bir qatorga formula nomini va to‘g‘ri formulani yozing. Noto‘g‘ri variantlarni yozmasangiz, ular shu to‘plamdagi boshqa formulalardan olinadi (kamida 4 ta formula yozing)." }
    : { q: "Savol", qph: "Savol matni", a: mode === "open" ? "Javob (ixtiyoriy)" : "To‘g‘ri javob", aph: "To‘g‘ri javob", w: "Noto‘g‘ri variantlar", add: "Savol qo‘shish",
        help: mode === "open"
          ? "Baraban uchun javob va variantlar ixtiyoriy: javobni boshlovchi tekshiradi. Javobni yozsangiz, uni o‘yinda ochib ko‘rsatish mumkin."
          : "Test o‘yinlari uchun har savolga to‘g‘ri javob va iloji bo‘lsa 3 ta noto‘g‘ri variant yozing." };

  function rowEl(item, index) {
    const L = labels();
    const li = document.createElement("li");
    li.className = "gm-row";
    const wrong = [0, 1, 2].map((k) => item.w[k] || "");
    li.innerHTML = `
      <span class="gm-row__num">${index + 1}</span>
      <div class="gm-row__fields">
        <label class="gm-row__q"><span class="gm-row__lbl">${L.q}</span>
          <input class="of-input" data-f="q" maxlength="${LIMITS.text}" placeholder="${esc(L.qph)}" value="${esc(item.q)}"></label>
        <label class="gm-row__a"><span class="gm-row__lbl">${L.a}</span>
          <input class="of-input gm-formula" data-f="a" maxlength="${LIMITS.text}" placeholder="${esc(L.aph)}" value="${esc(item.a)}"></label>
        ${showPts ? `<label class="gm-row__pts"><span class="gm-row__lbl">Ball</span>
          <input class="of-input" type="number" min="1" max="10" data-f="pts" value="${item.pts || 1}"></label>` : ""}
        <details class="gm-row__wrong" ${wrong.some(Boolean) ? "open" : ""}>
          <summary>${L.w} <span class="of-hint">(ixtiyoriy)</span></summary>
          <div class="gm-row__wgrid">
            ${wrong.map((w, k) => `<input class="of-input gm-formula" data-w="${k}" maxlength="${LIMITS.text}" placeholder="${k + 1}-noto‘g‘ri variant" value="${esc(w)}">`).join("")}
          </div>
        </details>
      </div>
      <button type="button" class="of-icon-btn gm-row__del" aria-label="${index + 1}-qatorni o‘chirish" title="O‘chirish">${icon("close")}</button>`;
    li.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("focus", () => { lastField = inp; });
      inp.addEventListener("input", () => {
        if (inp.dataset.f === "pts") item.pts = Math.max(1, Math.min(10, Math.round(Number(inp.value) || 1)));
        else if (inp.dataset.f) item[inp.dataset.f] = inp.value;
        else item.w[Number(inp.dataset.w)] = inp.value;
        updateCount();
      });
    });
    li.querySelector(".gm-row__del").addEventListener("click", () => {
      draft.items.splice(draft.items.indexOf(item), 1);
      renderRows();
    });
    return li;
  }

  function renderRows() {
    rowsEl.innerHTML = "";
    draft.items.forEach((it, i) => { it.w = it.w || []; rowsEl.append(rowEl(it, i)); });
    updateCount();
  }

  function updateCount() {
    const filled = draft.items.filter((it) => String(it.q).trim()).length;
    dlg.querySelector("[data-count]").textContent = `${filled} ta to‘ldirilgan`;
  }

  function applyKind() {
    const L = labels();
    dlg.querySelectorAll("[data-kind] button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === draft.kind)));
    dlg.querySelector("[data-help]").textContent = L.help;
    dlg.querySelector("[data-add-label]").textContent = L.add;
    renderRows();
  }

  dlg.querySelectorAll("[data-kind] button").forEach((b) => b.addEventListener("click", () => { draft.kind = b.dataset.v; applyKind(); }));
  dlg.querySelector("[data-add]").addEventListener("click", () => {
    if (draft.items.length >= LIMITS.items) { toast(`Bitta to‘plamda ko‘pi bilan ${LIMITS.items} ta savol bo‘ladi.`); return; }
    draft.items.push({ q: "", a: "", w: [] });
    renderRows();
    rowsEl.lastElementChild?.querySelector("input")?.focus();
  });
  dlg.querySelectorAll(".gm-sym").forEach((b) => {
    b.addEventListener("mousedown", (e) => e.preventDefault()); // fokus maydonda qolsin
    b.addEventListener("click", () => {
      const inp = lastField && dlg.contains(lastField) ? lastField : null;
      if (!inp) { toast("Avval belgini qo‘yadigan maydonni tanlang."); return; }
      const { selectionStart: s = inp.value.length, selectionEnd: e = inp.value.length } = inp;
      inp.setRangeText(b.dataset.sym, s, e, "end");
      inp.dispatchEvent(new Event("input"));
      inp.focus();
    });
  });

  const close = () => { dlg.close(); dlg.remove(); };
  dlg.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", close));
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const topic = form.topic.value.trim();
    if (!topic) { form.topic.setAttribute("aria-invalid", "true"); form.topic.focus(); toast("Mavzu nomini yozing."); return; }
    form.topic.removeAttribute("aria-invalid");
    const items = draft.items.filter((it) => String(it.q).trim());
    if (!items.length) { toast("Kamida bitta savol yoki formula yozing."); return; }
    const needAnswer = draft.kind === "formula" || mode === "mcq";
    const missing = items.findIndex((it) => needAnswer && !String(it.a).trim());
    if (missing >= 0) {
      toast(`${draft.items.indexOf(items[missing]) + 1}-qatorda ${draft.kind === "formula" ? "formula" : "to‘g‘ri javob"} yozilmagan.`);
      rowsEl.children[draft.items.indexOf(items[missing])]?.querySelector('[data-f="a"]')?.focus();
      return;
    }
    const saved = await saveUserSet({ ...draft, topics: [topic], title: form.title.value.trim() || topic, items });
    if (mode === "mcq" && playableCount(saved) < 2) toast("Saqlandi. Test o‘yinlari uchun kamida 2 ta javobli savol yoki noto‘g‘ri variantlar kerak.");
    else toast(`“${saved.title}” saqlandi.`);
    close();
    onSaved?.(saved);
  });

  applyKind();
  dlg.showModal();
  form.topic.focus();
  return dlg;
}
