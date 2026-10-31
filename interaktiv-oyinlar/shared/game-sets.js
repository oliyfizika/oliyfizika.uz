// ==========================================================================
// Interaktiv o‘yinlar — savollar to‘plamlari (umumiy qatlam).
// Formulani top, Arqon tortish va Baraban bir xil formatdan foydalanadi:
//
//   {
//     id, kind: "formula" | "question", title, topics: ["Mavzu", …],
//     items: [{ q: "Savol / formula nomi", a: "To‘g‘ri javob", w: ["noto‘g‘ri", …], pts?: 1 }],
//     createdAt, updatedAt
//   }
//
// Saqlash:
//   • har doim shu brauzerda (localStorage) — tizimga kirmasdan ham ishlaydi;
//   • tizimga kirgan bo‘lsa, qo‘shimcha ravishda Firestore: users/{uid}/gameSets/{id}
//     (boshqa qurilmada ham ko‘rinadi). Bulut yozuvi rad etilsa (masalan, qoidalar hali
//     qo‘yilmagan bo‘lsa) — o‘yin baribir lokal nusxa bilan ishlayveradi.
// ==========================================================================

import { SAMPLE_SETS } from "./sample-sets.js";
import { onSession, loadFirebase } from "../../assets/js/core/session.js";

export { SAMPLE_SETS };

const LS_KEY = "oliyfizika:game-sets:v1";
const LAST_KEY = "oliyfizika:game-sets:last";
export const LIMITS = { title: 80, topic: 60, text: 300, items: 150 };

// ------------------------------------------------------------------ yordamchilar
export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const clean = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function newId() {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Foydalanuvchi kiritgan to‘plamni tozalash (bo‘sh qatorlar tashlanadi, uzunliklar cheklanadi). */
export function normalizeSet(raw) {
  const items = (Array.isArray(raw?.items) ? raw.items : [])
    .map((it) => ({
      q: clean(it?.q, LIMITS.text),
      a: clean(it?.a, LIMITS.text),
      w: (Array.isArray(it?.w) ? it.w : []).map((x) => clean(x, LIMITS.text)).filter(Boolean).slice(0, 5),
      ...(Number(it?.pts) > 1 ? { pts: Math.min(10, Math.round(Number(it.pts))) } : {}),
    }))
    .filter((it) => it.q)
    .slice(0, LIMITS.items);
  const topics = (Array.isArray(raw?.topics) ? raw.topics : [raw?.topic])
    .map((t) => clean(t, LIMITS.topic)).filter(Boolean).slice(0, 6);
  return {
    id: /^[A-Za-z0-9_-]{4,40}$/.test(raw?.id || "") ? raw.id : newId(),
    kind: raw?.kind === "question" ? "question" : "formula",
    title: clean(raw?.title, LIMITS.title) || topics[0] || "Nomsiz to‘plam",
    topics,
    items,
    createdAt: Number(raw?.createdAt) || Date.now(),
    updatedAt: Number(raw?.updatedAt) || Date.now(),
  };
}

/**
 * Savolni o‘yinga tayyorlash: variantlar har safar aralashadi.
 * Noto‘g‘ri variantlar yetmasa, shu to‘plamdagi boshqa javoblardan to‘ldiriladi.
 * @returns {{ q, a, options: string[], correct: number, pts: number } | null}
 */
export function buildQuestion(item, set, optionCount = 4) {
  const answer = item.a;
  if (!answer) return null;
  const seen = new Set([answer.toLowerCase()]);
  const wrong = [];
  const take = (x) => {
    const key = String(x || "").toLowerCase();
    if (!key || seen.has(key) || wrong.length >= optionCount - 1) return;
    seen.add(key);
    wrong.push(x);
  };
  shuffle(item.w || []).forEach(take);
  if (wrong.length < optionCount - 1) shuffle(set.items.filter((o) => o !== item).map((o) => o.a)).forEach(take);
  if (!wrong.length) return null;
  const options = shuffle([answer, ...wrong]);
  return { q: item.q, a: answer, options, correct: options.indexOf(answer), pts: item.pts || 1 };
}

/** O‘yin uchun savollar ro‘yxati: tartib aralashadi, variantlar aralashadi. */
export function buildRound(set, count = Infinity) {
  return shuffle(set.items)
    .map((item) => buildQuestion(item, set))
    .filter(Boolean)
    .slice(0, count);
}

/** Test variantli o‘yinlarga (Formulani top, Arqon tortish) yaroqli savollar soni. */
export function playableCount(set) {
  return set.items.filter((item) => buildQuestion(item, set)).length;
}

export function kindLabel(set) {
  return set.kind === "question" ? "Savollar" : "Formulalar";
}

// ------------------------------------------------------------------ lokal saqlash
function readLocal() {
  try {
    const list = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(list) ? list.map(normalizeSet) : [];
  } catch {
    return [];
  }
}

function writeLocal(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* storage to‘la yoki yopiq */ }
}

let userSets = readLocal();
let cloud = { uid: null, status: "off" }; // off | syncing | on | error
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(getUserSets(), cloud.status); } catch (e) { console.error(e); } });

export function getUserSets() {
  return [...userSets].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getAllSets() {
  return [...getUserSets(), ...SAMPLE_SETS];
}

export function findSet(id) {
  return getAllSets().find((s) => s.id === id) || null;
}

/** O‘zgarishlarni tinglash: fn(userSets, cloudStatus). */
export function onSetsChange(fn) {
  listeners.add(fn);
  fn(getUserSets(), cloud.status);
  return () => listeners.delete(fn);
}

export function rememberLast(game, id) {
  try { localStorage.setItem(`${LAST_KEY}:${game}`, id); } catch { /* ignore */ }
}
export function lastUsed(game) {
  try { return localStorage.getItem(`${LAST_KEY}:${game}`); } catch { return null; }
}

// ------------------------------------------------------------------ bulut (Firestore)
async function cloudCall(fn) {
  if (!cloud.uid) return false;
  try {
    const fb = await loadFirebase();
    await fn(fb, fb.fsSdk);
    return true;
  } catch (error) {
    console.warn("[game-sets] bulutga yozib bo‘lmadi:", error?.code || error);
    cloud.status = "error";
    emit();
    return false;
  }
}

const cloudDoc = (fb, sdk, id) => sdk.doc(fb.db, "users", cloud.uid, "gameSets", id);

async function syncFromCloud(uid) {
  cloud = { uid, status: "syncing" };
  emit();
  try {
    const fb = await loadFirebase();
    const sdk = fb.fsSdk;
    const snap = await sdk.getDocs(sdk.collection(fb.db, "users", uid, "gameSets"));
    if (cloud.uid !== uid) return;
    const remote = new Map();
    snap.forEach((d) => remote.set(d.id, normalizeSet({ ...d.data(), id: d.id })));
    const merged = new Map(remote);
    const toUpload = [];
    userSets.forEach((local) => {
      const r = remote.get(local.id);
      if (!r || local.updatedAt > r.updatedAt) {
        merged.set(local.id, local);
        toUpload.push(local);
      }
    });
    userSets = [...merged.values()];
    writeLocal(userSets);
    cloud.status = "on";
    emit();
    for (const s of toUpload) await cloudCall((f, k) => k.setDoc(cloudDoc(f, k, s.id), s));
  } catch (error) {
    console.warn("[game-sets] bulutdan o‘qib bo‘lmadi:", error?.code || error);
    if (cloud.uid === uid) { cloud.status = "error"; emit(); }
  }
}

onSession((s) => {
  const uid = s.status === "authenticated" ? s.user?.uid : null;
  if (uid && uid !== cloud.uid) syncFromCloud(uid);
  else if (!uid && s.status !== "loading" && cloud.uid) { cloud = { uid: null, status: "off" }; emit(); }
});

// ------------------------------------------------------------------ CRUD
export async function saveUserSet(raw) {
  const set = normalizeSet({ ...raw, updatedAt: Date.now() });
  const i = userSets.findIndex((s) => s.id === set.id);
  if (i >= 0) { set.createdAt = userSets[i].createdAt; userSets[i] = set; } else userSets.push(set);
  writeLocal(userSets);
  emit();
  await cloudCall((fb, sdk) => sdk.setDoc(cloudDoc(fb, sdk, set.id), set));
  return set;
}

export async function deleteUserSet(id) {
  userSets = userSets.filter((s) => s.id !== id);
  writeLocal(userSets);
  emit();
  await cloudCall((fb, sdk) => sdk.deleteDoc(cloudDoc(fb, sdk, id)));
}

/** Namuna yoki o‘z to‘plamidan tahrirlanadigan nusxa. */
export function copyOf(set) {
  return normalizeSet({
    ...JSON.parse(JSON.stringify(set)),
    id: newId(),
    title: `${set.title} (nusxa)`,
    createdAt: Date.now(),
  });
}

// ------------------------------------------------------------------ fayl (ulashish)
export function exportSet(set) {
  const data = { format: "oliyfizika-game-set", version: 1, set: { ...set, sample: undefined } };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(set.title || "toplam").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "toplam"}.json`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export async function importSetFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const raw = data?.set || data;
  if (!raw || !Array.isArray(raw.items)) throw new Error("Fayl to‘plam formatida emas.");
  const set = normalizeSet({ ...raw, id: newId(), createdAt: Date.now() });
  if (!set.items.length) throw new Error("Faylda savollar topilmadi.");
  return saveUserSet(set);
}
