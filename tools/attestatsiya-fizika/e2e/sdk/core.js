// E2E: Firebase SDK o'rnini bosuvchi umumiy holat (auth + HTTP mijoz). Faqat lokal testlar uchun.
export const state = { user: null, listeners: new Set() };

function loadUser() {
  try {
    const raw = localStorage.getItem("mock-auth");
    state.user = raw ? JSON.parse(raw) : null;
  } catch { state.user = null; }
  if (state.user) {
    state.user.emailVerified = true;
    state.user.providerData = [{ providerId: "password" }];
    state.user.getIdToken = async () => "mock";
    state.user.reload = async () => {};
  }
}
loadUser();

export class FirebaseError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.name = "FirebaseError";
  }
}

export async function api(op, payload = {}) {
  const res = await fetch("/__mock/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, uid: state.user?.uid || null, ...payload }),
  });
  const j = await res.json();
  if (!j.ok) throw new FirebaseError(j.code || "internal", j.message);
  return j.result;
}

export function setUser(u) {
  if (u) localStorage.setItem("mock-auth", JSON.stringify(u)); else localStorage.removeItem("mock-auth");
  loadUser();
  state.listeners.forEach((cb) => { try { cb(state.user); } catch (e) { console.error(e); } });
}
