import { auth, db } from "./firebase.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const STORAGE_KEY = "mechanicsUnlockedLesson";
const LEGACY_LESSON_2_KEY = "lesson2Unlocked";


// ==================================================
// ODDIY PROGRESS
// ==================================================

export function getMechanicsUnlockedLesson() {

  const stored =
    Number(
      localStorage.getItem(STORAGE_KEY)
    ) || 1;

  const legacyLesson =
    localStorage.getItem(
      LEGACY_LESSON_2_KEY
    ) === "true"
      ? 2
      : 1;

  return Math.max(
    1,
    stored,
    legacyLesson
  );
}


// ==================================================
// DARS OCHISH
// ==================================================

export function unlockMechanicsLesson(
  lessonNumber
) {

  const currentLesson =
    getMechanicsUnlockedLesson();

  const nextLesson =
    Math.max(
      currentLesson,
      Number(lessonNumber) || 1
    );

  localStorage.setItem(
    STORAGE_KEY,
    String(nextLesson)
  );

  if (nextLesson >= 2) {

    localStorage.setItem(
      LEGACY_LESSON_2_KEY,
      "true"
    );
  }
}


// ==================================================
// FULL ACCESS
// ==================================================

async function checkFullAccess() {

  const user = auth.currentUser;

  if (!user) {
    return false;
  }

  try {

    const snapshot =
      await getDoc(
        doc(
          db,
          "users",
          user.uid
        )
      );

    if (!snapshot.exists()) {
      return false;
    }

    return (
      snapshot.data()?.fullAccess === true
    );

  } catch (error) {

    console.error(
      "Full access tekshirishda xatolik:",
      error
    );

    return false;
  }
}


// ==================================================
// DARSlarni RENDER QILISH
// ==================================================

export async function renderMechanicsLessons(
  lessons,
  container
) {

  if (!container) {
    console.error(
      "Videos container topilmadi."
    );
    return;
  }


  // -----------------------------------------------
  // FULL ACCESS
  // -----------------------------------------------

  const fullAccess =
    await checkFullAccess();


  // -----------------------------------------------
  // ODDIY UNLOCK
  // -----------------------------------------------

  const unlockedLesson =
    getMechanicsUnlockedLesson();


  console.log(
    "Full Access:",
    fullAccess
  );

  console.log(
    "Unlocked Lesson:",
    unlockedLesson
  );


  // -----------------------------------------------
  // CARDLAR
  // -----------------------------------------------

  const fragment =
    document.createDocumentFragment();


  lessons.forEach((lesson) => {

    const card =
      document.createElement("article");

    card.className =
      "video-card";

    card.dataset.lesson =
      String(lesson.number);


    // ---------------------------------------------
    // LOCK
    // ---------------------------------------------

    const isLocked =
      !fullAccess &&
      lesson.number > unlockedLesson;


    if (isLocked) {

      card.classList.add(
        "is-locked"
      );
    }


    // ---------------------------------------------
    // VIDEO
    // ---------------------------------------------

    const iframe =
      document.createElement("iframe");

    iframe.src =
      `https://www.youtube.com/embed/${lesson.youtubeId}`;

    iframe.title =
      `${lesson.number}-mavzu | ${lesson.title}`;

    iframe.allowFullscreen =
      true;

    iframe.loading =
      "lazy";

    iframe.referrerPolicy =
      "strict-origin-when-cross-origin";

    card.appendChild(
      iframe
    );


    // ---------------------------------------------
    // INFO
    // ---------------------------------------------

    const info =
      document.createElement("div");

    info.className =
      "video-info";


    const heading =
      document.createElement("h3");

    heading.textContent =
      `${
        lesson.numberLabel ||
        `${lesson.number}-mavzu`
      } | ${lesson.title}`;

    info.appendChild(
      heading
    );


    // ---------------------------------------------
    // TEST
    // ---------------------------------------------

    if (lesson.testUrl) {

      const testLink =
        document.createElement("a");

      testLink.href =
        lesson.testUrl;

      testLink.className =
        "test-btn";

      testLink.textContent =
        "Testni boshlash";

      info.appendChild(
        testLink
      );

    } else {

      const status =
        document.createElement("span");

      status.className =
        "test-status";

      status.textContent =
        "Test tayyorlanmoqda";

      info.appendChild(
        status
      );
    }


    card.appendChild(
      info
    );


    // ---------------------------------------------
    // LOCK OVERLAY
    // ---------------------------------------------

    if (isLocked) {

      const overlay =
        document.createElement("div");

      overlay.className =
        "lock-overlay";

      overlay.textContent =
        `Avval ${
          lesson.number - 1
        }-mavzu testidan kamida 80% o‘ting`;

      card.appendChild(
        overlay
      );
    }


    fragment.appendChild(
      card
    );

  });


  // -----------------------------------------------
  // SAHIFAGA JOYLASHTIRISH
  // -----------------------------------------------

  container.replaceChildren(
    fragment
  );
}