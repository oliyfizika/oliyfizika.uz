import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const homeUrl = new URL("../index.html", import.meta.url).href;

const elements = {
  fullName: document.getElementById("profileFullName"),
  email: document.getElementById("profileEmail"),
  phone: document.getElementById("profilePhone"),
  xp: document.getElementById("profileXp"),
  level: document.getElementById("profileLevel"),
  createdAt: document.getElementById("profileCreatedAt"),
  status: document.getElementById("profileStatus")
};

onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.replace(homeUrl);
    return;
  }

  await renderProfile(user);
});

async function renderProfile(user){
  try{
    const snapshot = await getDoc(doc(db, "users", user.uid));
    const profile = snapshot.exists() ? snapshot.data() : null;

    setText(elements.fullName, profile?.fullName || "Kiritilmagan");
    setText(elements.email, profile?.email || user.email || "Kiritilmagan");
    setText(elements.phone, profile?.phone || "Kiritilmagan");
    setText(elements.xp, String(profile?.xp ?? 0));
    setText(elements.level, String(profile?.level ?? 1));
    setText(elements.createdAt, formatDate(profile?.createdAt));

    if(!profile){
      setStatus("Profil hujjati topilmadi. Sozlamalar sahifasida ma'lumotlarni saqlang.", "error");
      return;
    }

    setStatus("");
  }catch(error){
    console.error("Profile load failed:", error);
    setStatus("Profil ma'lumotlarini yuklashda xatolik yuz berdi.", "error");
  }
}

function setText(element, value){
  if(!element) return;

  element.textContent = value;
}

function setStatus(message, type = ""){
  if(!elements.status) return;

  elements.status.textContent = message;
  elements.status.className = `status ${type}`.trim();
}

function formatDate(value){
  if(!value) return "Mavjud emas";

  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);

  if(Number.isNaN(date.getTime())){
    return "Mavjud emas";
  }

  return new Intl.DateTimeFormat("uz-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}
