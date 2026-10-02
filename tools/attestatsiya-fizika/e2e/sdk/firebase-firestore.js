// E2E mock: firebase-firestore (sayt ishlatadigan API qismi). Har bir so'rov serverda Rules bilan tekshiriladi.
import { api, FirebaseError } from "./core.js";

export class Timestamp {
  constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static fromDate(d) { const ms = d.getTime(); return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static fromMillis(ms) { return Timestamp.fromDate(new Date(ms)); }
  static now() { return Timestamp.fromDate(new Date()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate() { return new Date(this.toMillis()); }
  isEqual(o) { return o && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds; }
  valueOf() { return String(this.toMillis()).padStart(16, "0"); }
}
const SERVER = { __server: 1 };
export const serverTimestamp = () => SERVER;
export const deleteField = () => ({ __delete: 1 });
export const increment = (n) => ({ __inc: n });

// Haqiqiy Firestore SDK kabi: massivning bevosita elementi massiv bo'lsa, yozuv serverga yuborilmasdan rad etiladi.
// (Firestore xabari: "Function WriteBatch.set() called with invalid data. Nested arrays are not supported (found in document …)")
function hasNestedArray(v, inArray = false) {
  if (Array.isArray(v)) return inArray || v.some((x) => hasNestedArray(x, true));
  if (v && typeof v === "object" && !(v instanceof Timestamp) && !(v instanceof Date)) return Object.values(v).some((x) => hasNestedArray(x, false));
  return false;
}
function validate(fn, ref, data) {
  if (hasNestedArray(data)) {
    throw new FirebaseError("invalid-argument", `Function ${fn}() called with invalid data. Nested arrays are not supported (found in document ${ref.path})`);
  }
}

function enc(v) {
  if (v === SERVER) return SERVER;
  if (v instanceof Timestamp) return { __ts: [v.seconds, v.nanoseconds] };
  if (v instanceof Date) return enc(Timestamp.fromDate(v));
  if (Array.isArray(v)) return v.map(enc);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, enc(x)]));
  return v;
}
function dec(v) {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === "object") {
    if ("__ts" in v) return new Timestamp(v.__ts[0], v.__ts[1]);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]));
  }
  return v;
}

const db = { type: "firestore" };
export function getFirestore() { return db; }
export function initializeFirestore() { return db; }

class DocRef { constructor(path) { this.path = path; this.id = path.split("/").pop(); this.type = "document"; } }
class ColRef { constructor(path) { this.path = path; this.id = path.split("/").pop(); this.type = "collection"; } }

export function doc(parent, ...segs) {
  const base = parent === db ? [] : [parent.path];
  if (parent instanceof ColRef && !segs.length) segs = [Math.random().toString(36).slice(2, 12)];
  return new DocRef([...base, ...segs].join("/"));
}
export function collection(parent, ...segs) {
  const base = parent === db ? [] : [parent.path];
  return new ColRef([...base, ...segs].join("/"));
}
export function documentId() { return "__name__"; }
export const where = (field, op, value) => ({ kind: "where", field, op, value });
export const orderBy = (field, dir = "asc") => ({ kind: "orderBy", field, dir });
export const limit = (n) => ({ kind: "limit", n });
export const startAfter = (...v) => ({ kind: "startAfter", v });
export function query(col, ...cs) { return { col, cs }; }

class DocSnap {
  constructor(ref, exists, data) { this.ref = ref; this.id = ref.id; this._e = exists; this._d = data; }
  exists() { return this._e; }
  data() { return this._e ? dec(this._d) : undefined; }
  get(f) { return this.data()?.[f]; }
}

export async function getDoc(ref) {
  const r = await api("get", { path: ref.path });
  return new DocSnap(ref, r.exists, r.data);
}
export async function getDocs(q) {
  const col = q instanceof ColRef ? q : q.col;
  const cs = q instanceof ColRef ? [] : q.cs;
  const filters = cs.filter((c) => c.kind === "where").map((c) => [c.field, c.op, enc(c.value)]);
  const order = cs.filter((c) => c.kind === "orderBy").map((c) => [c.field, c.dir]);
  const lim = cs.find((c) => c.kind === "limit")?.n || null;
  const rows = await api("query", { col: col.path, filters, order, limit: lim });
  const docs = rows.map((r) => new DocSnap(new DocRef(r.path), true, r.data));
  return { docs, size: docs.length, empty: !docs.length, forEach: (fn) => docs.forEach(fn) };
}
export async function getCountFromServer(q) {
  const s = await getDocs(q);
  return { data: () => ({ count: s.size }) };
}
export async function setDoc(ref, data, opts = {}) {
  validate("setDoc", ref, data);
  await api("commit", { writes: [{ type: "set", path: ref.path, data: enc(data), merge: Boolean(opts.merge) }] });
}
export async function updateDoc(ref, data) {
  validate("updateDoc", ref, data);
  await api("commit", { writes: [{ type: "update", path: ref.path, data: enc(data) }] });
}
export async function addDoc(col, data) {
  const ref = doc(col);
  await setDoc(ref, data);
  return ref;
}
export async function deleteDoc(ref) {
  await api("commit", { writes: [{ type: "delete", path: ref.path }] });
}
export function writeBatch() {
  const writes = [];
  return {
    set(ref, data, opts = {}) { validate("WriteBatch.set", ref, data); writes.push({ type: "set", path: ref.path, data: enc(data), merge: Boolean(opts.merge) }); return this; },
    update(ref, data) { validate("WriteBatch.update", ref, data); writes.push({ type: "update", path: ref.path, data: enc(data) }); return this; },
    delete(ref) { writes.push({ type: "delete", path: ref.path }); return this; },
    async commit() { await api("commit", { writes }); },
  };
}
export async function runTransaction(_db, fn) {
  const writes = [];
  const tx = {
    get: (ref) => getDoc(ref),
    set(ref, data, opts = {}) { validate("Transaction.set", ref, data); writes.push({ type: "set", path: ref.path, data: enc(data), merge: Boolean(opts.merge) }); return tx; },
    update(ref, data) { validate("Transaction.update", ref, data); writes.push({ type: "update", path: ref.path, data: enc(data) }); return tx; },
  };
  const out = await fn(tx);
  await api("commit", { writes });
  return out;
}
export { FirebaseError };
