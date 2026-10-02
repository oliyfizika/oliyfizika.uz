// E2E mock: firebase-auth. Foydalanuvchi localStorage "mock-auth" dan ({uid, email, displayName}).
import { state, setUser, FirebaseError } from "./core.js";

const auth = {
  get currentUser() { return state.user; },
  languageCode: "uz",
};
export function getAuth() { return auth; }
export function onAuthStateChanged(_a, cb) {
  state.listeners.add(cb);
  setTimeout(() => cb(state.user), 0);
  return () => state.listeners.delete(cb);
}
export async function signOut() { setUser(null); }
export async function getRedirectResult() { return null; }
export function isSignInWithEmailLink() { return false; }
export class GoogleAuthProvider { setCustomParameters() {} }
export const EmailAuthProvider = { credential: () => ({}) };
const unsupported = async () => { throw new FirebaseError("auth/operation-not-supported-in-this-environment"); };
export const signInWithPopup = unsupported;
export const signInWithRedirect = unsupported;
export const signInWithEmailAndPassword = unsupported;
export const signInWithEmailLink = unsupported;
export const sendSignInLinkToEmail = unsupported;
export const sendPasswordResetEmail = unsupported;
export const reauthenticateWithCredential = unsupported;
export const updatePassword = unsupported;
export async function updateProfile() {}
export function setPersistence() { return Promise.resolve(); }
export const browserLocalPersistence = {};
export const browserSessionPersistence = {};
