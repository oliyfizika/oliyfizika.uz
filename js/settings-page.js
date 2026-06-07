import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const homeUrl = new URL("../index.html", import.meta.url).href;

const form = document.getElementById("settingsForm");
const fullNameInput = document.getElementById("settingsFullName");
const phoneInput = document.getElementById("settingsPhone");
const emailInput = document.getElementById("settingsEmail");
const submitButton = document.getElementById("settingsSubmit");
const status = document.getElementById("settingsStatus");

let currentUser = null;
let hasProfileDocument = false;

onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.replace(homeUrl);
    return;
  }

  currentUser = user;
  await loadSettings(user);
});

form?.addEventListener("submit", saveSettings);

async function loadSettings(user){
  try{
    const snapshot = await getDoc(doc(db, "users", user.uid));
    const profile = snapshot.exists() ? snapshot.data() : null;

    hasProfileDocument = Boolean(profile);

    fullNameInput.value = profile?.fullName || "";
    phoneInput.value = profile?.phone || "";
    emailInput.value = profile?.email || user.email || "";

    if(!profile){
      setStatus("Profil hujjati topilmadi. Saqlash orqali yangi profil yaratiladi.");
    }else{
      setStatus("");
    }
  }catch(error){
    console.error("Settings load failed:", error);
    setStatus("Sozlamalarni yuklashda xatolik yuz berdi.", "error");
  }
}

async function saveSettings(event){
  event.preventDefault();

  if(!currentUser) return;

  const fullName = fullNameInput.value.trim();
  const phone = phoneInput.value.trim();
  const email = currentUser.email || emailInput.value.trim();

  if(!fullName || !phone){
    setStatus("Full Name va Phone maydonlarini to'ldiring.", "error");
    return;
  }

  setLoading(true);

  try{
    const userRef = doc(db, "users", currentUser.uid);

    if(hasProfileDocument){
      await updateDoc(userRef, {
        fullName,
        phone,
        email
      });
    }else{
      await setDoc(userRef, {
        fullName,
        phone,
        email,
        xp: 0,
        level: 1,
        createdAt: serverTimestamp()
      });
      hasProfileDocument = true;
    }

    setStatus("Ma'lumotlar saqlandi.", "success");
  }catch(error){
    console.error("Settings save failed:", error);
    setStatus("Ma'lumotlarni saqlashda xatolik yuz berdi.", "error");
  }finally{
    setLoading(false);
  }
}

function setLoading(isLoading){
  if(!submitButton) return;

  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Saqlanmoqda..." : "Saqlash";
}

function setStatus(message, type = ""){
  if(!status) return;

  status.textContent = message;
  status.className = `status ${type}`.trim();
}
