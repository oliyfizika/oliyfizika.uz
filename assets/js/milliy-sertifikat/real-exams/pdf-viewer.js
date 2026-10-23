// ==========================================================================
// Real imtihonlar — PDF ko'ruvchi adapteri.
// Production: Storage getBlob() (Rules: mockTestsAccess) -> Blob -> Object URL -> brauzer PDF ko'ruvchisi.
// Ommaviy URL (getDownloadURL / repo'dagi fayl) ishlatilmaydi. Lokal: dummy fixture PDF.
// Object URL sahifadan chiqilganda bekor qilinadi.
// ==========================================================================

let current = null;

export function revokePdf() {
  if (current) { URL.revokeObjectURL(current); current = null; }
}

/**
 * @param {HTMLElement} host  ko'ruvchi joylashadigan element
 * @param {{ getPdfBlob:(id)=>Promise<{blob:Blob, fixture:boolean}> }} adapter
 * @param {string} examId
 */
export async function mountPdf(host, adapter, examId, title) {
  host.dataset.state = "loading";
  host.innerHTML = `<p class="rx-pdf__status" role="status">PDF yuklanmoqda…</p>`;
  const { blob, fixture } = await adapter.getPdfBlob(examId);
  if (!blob || blob.type && blob.type !== "application/pdf") throw Object.assign(new Error("PDF emas"), { code: "unavailable" });
  revokePdf();
  current = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: "application/pdf" }));
  host.dataset.state = "ready";
  host.innerHTML = "";
  if (fixture) {
    const note = document.createElement("p");
    note.className = "rx-pdf__fixture";
    note.textContent = "Lokal test fixture — haqiqiy imtihon PDF emas (PDF Storage’ga keyingi bosqichda yuklanadi).";
    host.append(note);
  }
  const frame = document.createElement("iframe");
  frame.className = "rx-pdf__frame";
  frame.title = `${title} — PDF`;
  frame.src = current;
  const open = document.createElement("a");
  open.className = "of-btn of-btn--ghost of-btn--sm rx-pdf__open";
  open.href = current;
  open.target = "_blank";
  open.rel = "noopener";
  open.textContent = "Yangi oynada ochish";
  host.append(frame, open);
}

addEventListener("pagehide", revokePdf);
