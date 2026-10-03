// ==========================================================================
// Attestatsiya → Fizika: rasm pipeline diagnostikasi (FAQAT O'QIYDI — hech narsa yozmaydi, test boshlamaydi).
//
// Ishlatish: oliyfizika.uz da ODDIY user bilan tizimga kiring, istalgan attestatsiya sahifasini oching
// (masalan attestatsiya/fizika-yechimlar.html), DevTools → Console ga shu faylni to'liq joylang va Enter.
// Natija: jadval (console.table) + window.__attFigDiag (JSON) — shu JSON'ni yuboring.
//
// Har bosqichni alohida tekshiradi:  sozlama → test holati → snapshot'dagi rasm havolasi →
// figures/{id} hujjati (Rules) → base64 → Blob → <img> yuklanishi; Storage yo'li ham (agar ishlatilsa).
// ==========================================================================
(async () => {
  const out = { at: new Date().toISOString(), ua: navigator.userAgent, steps: [], rows: [] };
  const step = (name, ok, detail) => { out.steps.push({ step: name, ok, detail }); };
  const short = (e) => (e && (e.code || e.message || String(e))) || null;
  try {
    const api = await import("/assets/js/attestatsiya-fizika/api.js");
    const { loadFirebase } = await import("/assets/js/core/session.js");
    const fb = await loadFirebase();
    const { doc, getDoc } = fb.fsSdk;
    const user = fb.auth.currentUser;
    step("auth", Boolean(user), user ? { uid: user.uid, email: user.email } : "tizimga kirilmagan");
    if (!user) throw new Error("Avval tizimga kiring");

    let settings;
    try {
      const s = await getDoc(doc(fb.db, "attestationPhysicsSettings", "config"));
      settings = s.exists() ? s.data() : null;
      step("settings", Boolean(settings), settings && { figureBackend: settings.figureBackend, accessMode: settings.accessMode, storageRoot: settings.storageRoot });
    } catch (e) { step("settings", false, short(e)); }

    const tests = await api.listVisibleTests();
    step("published tests", tests.length > 0, tests.map((t) => ({ id: t.id, day: t.dayNumber, status: t.status, v: t.currentVersion, figureCount: t.figureCount })));

    const walk = (bs, acc) => {
      for (const b of bs || []) {
        if (b.t === "figure") acc.push(b);
        if (b.blocks) walk(b.blocks, acc);
        for (const it of (b.t === "list" ? b.items || [] : [])) walk(Array.isArray(it) ? it : it.blocks, acc);
        for (const r of (b.t === "table" ? b.rows || [] : [])) for (const c of (Array.isArray(r) ? r : r.cells)) walk(c.blocks, acc);
      }
      return acc;
    };

    for (const t of tests) {
      let snap;
      try { snap = await api.getSnapshot(t.id, t.currentVersion); }
      catch (e) { step(`snapshot ${t.id}`, false, short(e)); continue; }
      for (const q of snap.questions) {
        const figs = [...walk(q.question, []), ...q.options.flatMap((o) => walk(o.blocks, []))];
        for (const f of figs) {
          const row = { questionId: q.id, figureId: f.id ?? null, legacyFigKey: f.fig ?? null, w: f.w, h: f.h,
            firestorePath: `attestationPhysicsDailyTests/${t.id}/figures/${f.id}`, docExists: null, mime: null,
            dataLen: null, bytesField: null, decodeOk: null, blobSize: null, figureUrl: null, imgLoad: null, natural: null, error: null };
          try {
            const d = await getDoc(doc(fb.db, "attestationPhysicsDailyTests", t.id, "figures", String(f.id)));
            row.docExists = d.exists();
            if (d.exists()) {
              const x = d.data();
              row.mime = x.mime; row.dataLen = x.data?.length ?? null; row.bytesField = x.bytes;
              const bin = atob(x.data);
              row.decodeOk = bin.length === x.bytes;
            }
          } catch (e) { row.error = `getDoc: ${short(e)}`; }
          try {
            const url = await api.figureUrl(t.id, f.id, "question");
            row.figureUrl = url.slice(0, 30);
            const img = new Image();
            await new Promise((res) => { img.onload = res; img.onerror = res; img.src = url; });
            row.imgLoad = img.naturalWidth > 0;
            row.natural = `${img.naturalWidth}x${img.naturalHeight}`;
            const blob = await (await fetch(url)).blob();
            row.blobSize = blob.size;
          } catch (e) { row.error = (row.error ? row.error + " | " : "") + `figureUrl: ${short(e)}`; }
          out.rows.push(row);
        }
      }
    }
    // Sahifadagi haqiqiy DOM holati (agar test/yechim sahifasi ochiq bo'lsa)
    out.dom = [...document.querySelectorAll(".att-fig")].map((f) => {
      const img = f.querySelector("img");
      return { state: f.dataset.state, src: (img?.getAttribute("src") || "").slice(0, 30), natural: img ? `${img.naturalWidth}x${img.naturalHeight}` : null,
               display: getComputedStyle(f).display, box: `${Math.round(f.getBoundingClientRect().width)}x${Math.round(f.getBoundingClientRect().height)}` };
    });
  } catch (e) {
    step("fatal", false, short(e));
  }
  out.summary = { figures: out.rows.length, loaded: out.rows.filter((r) => r.imgLoad).length,
                  failed: out.rows.filter((r) => !r.imgLoad).length };
  window.__attFigDiag = out;
  console.table(out.steps);
  console.table(out.rows);
  console.log("JSON (nusxa olish uchun):", JSON.stringify(out));
  return out.summary;
})();
