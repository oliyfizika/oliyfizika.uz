import { auth, db } from "./firebase.js";

import {

  doc,
  setDoc,
  getDoc

}

from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";



/* SAVE PROGRESS */

async function unlockLesson(lessonName){

  const user = auth.currentUser;

  if(!user) return;


  await setDoc(

    doc(db, "progress", user.uid),

    {

      [lessonName]: true

    },

    { merge:true }

  );

}



/* CHECK PROGRESS */

async function isLessonUnlocked(lessonName){

  const user = auth.currentUser;

  if(!user) return false;


  const docRef =
  doc(db, "progress", user.uid);

  const docSnap =
  await getDoc(docRef);


  if(docSnap.exists()){

    return docSnap.data()[lessonName] === true;

  }

  return false;

}


export {

  unlockLesson,
  isLessonUnlocked

};