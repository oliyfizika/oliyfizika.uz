// localStorage bilan xavfsiz ishlash (maxfiy rejim yoki bloklangan storage holatida ham xato bermaydi).
import { STORAGE_PREFIX } from "./config.js";

// Kalitlar foydalanuvchi (uid) bo'yicha ajratilgan: bitta qurilmada bir nechta akkaunt aralashmaydi.
const key = (testId, uid) => `${STORAGE_PREFIX}${uid}:${testId}:state:v1`;
const historyKey = (testId, uid) => `${STORAGE_PREFIX}${uid}:${testId}:attempts:v1`;

function read(k) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(k, value) {
  try {
    localStorage.setItem(k, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadState = (testId, uid) => read(key(testId, uid));
export const saveState = (testId, uid, state) => write(key(testId, uid), state);
export function clearState(testId, uid) {
  try { localStorage.removeItem(key(testId, uid)); } catch { /* ignore */ }
}

/** Topshirilgan urinishlar tarixi (lokal nusxa; kelajakda server bilan sinxronlash mumkin). */
export function appendAttempt(testId, uid, record) {
  const list = read(historyKey(testId, uid)) || [];
  list.push(record);
  write(historyKey(testId, uid), list.slice(-20));
}
export const loadAttempts = (testId, uid) => read(historyKey(testId, uid)) || [];

export function readPref(name, fallback) {
  const v = read(`${STORAGE_PREFIX}pref:${name}`);
  return v === null ? fallback : v;
}
export const writePref = (name, value) => write(`${STORAGE_PREFIX}pref:${name}`, value);
