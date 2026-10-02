// E2E mock: firebase-storage (getBlob / getMetadata / uploadBytes) — har bir so'rov storage.rules bilan tekshiriladi.
import { api, FirebaseError } from "./core.js";

const storage = { type: "storage" };
export function getStorage() { return storage; }
export function ref(_s, path) { return { fullPath: path, name: path.split("/").pop() }; }

export async function getBlob(r) {
  try {
    const out = await api("st_get", { path: r.fullPath });
    const bin = atob(out.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: out.contentType });
  } catch (e) {
    throw new FirebaseError(e.code === "permission-denied" ? "storage/unauthorized" : "storage/object-not-found", e.message);
  }
}
export async function getMetadata(r) {
  try {
    return await api("st_meta", { path: r.fullPath });
  } catch (e) {
    throw new FirebaseError(e.code === "permission-denied" ? "storage/unauthorized" : "storage/object-not-found", e.message);
  }
}
export async function uploadBytes(r, file, meta = {}) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  await api("st_upload", { path: r.fullPath, data: btoa(s), contentType: meta.contentType || file.type });
  return { ref: r, metadata: meta };
}
export async function getDownloadURL() {
  throw new FirebaseError("storage/unauthorized", "E2E: token URL ishlatilmaydi");
}
