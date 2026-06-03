// Firebase SDK import

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// Firebase Config

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDywME5vn5ujZZ-8LRbuB2dhNEZwV8Gwjo",
  authDomain: "oliy-fizika.firebaseapp.com",
  projectId: "oliy-fizika",
  storageBucket: "oliy-fizika.firebasestorage.app",
  messagingSenderId: "988726708702",
  appId: "1:988726708702:web:0458247b4ea92acc1ef54f",
  measurementId: "G-41BF224BJF"
};


// Initialize Firebase

const app = initializeApp(firebaseConfig);


// Services

const auth = getAuth(app);

const db = getFirestore(app);


// Export

export { auth, db };