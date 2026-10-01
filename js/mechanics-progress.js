// ==================================================
// MEXANIKA PROGRESS
// ==================================================

const STORAGE_KEY =
  "mechanicsUnlockedLesson";

const LEGACY_LESSON_2_KEY =
  "lesson2Unlocked";


// ==================================================
// OCHILGAN DARSNI OLISH
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
// KEYINGI DARSNI OCHISH
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
// FULL ACCESS TEKSHIRISH
// ==================================================

async function checkFullAccess() {

  try {

    // Firebase faylini dinamik yuklaymiz.
    // Shu sababli Firebase xatosi videolarni
    // render qilishga xalaqit bermaydi.

    const firebaseModule =
      await import("./firebase.js");


    const auth =
      firebaseModule.auth;

    const db =
      firebaseModule.db;


    if (!auth || !db) {
      return false;
    }


    // Foydalanuvchi hali aniqlanmagan bo‘lsa,
    // bir oz kutib ko‘ramiz.

    let user =
      auth.currentUser;


    if (!user) {

      const authModule =
        await import(
          "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
        );


      user =
        await new Promise((resolve) => {

          let finished = false;

          const unsubscribe =
            authModule.onAuthStateChanged(
              auth,
              (currentUser) => {

                if (finished) {
                  return;
                }

                finished = true;

                unsubscribe();

                resolve(
                  currentUser
                );
              }
            );

        });
    }


    if (!user) {
      return false;
    }


    // Firestore'dan foydalanuvchi profilini olamiz.

    const firestoreModule =
      await import(
        "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
      );


    const userRef =
      firestoreModule.doc(
        db,
        "users",
        user.uid
      );


    const snapshot =
      await firestoreModule.getDoc(
        userRef
      );


    if (!snapshot.exists()) {
      return false;
    }


    const data =
      snapshot.data();


    return data?.fullAccess === true;

  } catch (error) {

    console.warn(
      "Full access tekshirilmadi:",
      error
    );

    // Muhim:
    // Firebase xato bersa ham false qaytaramiz.
    // Videolar baribir render bo‘ladi.

    return false;
  }
}


// ==================================================
// DARSlarni RENDER QILISH
// ==================================================

// ==================================================
// QURILMADAGI QIYMATNI BOSHQA HISOB UCHUN ALMASHTIRISH
// Ochilish qoidasi o'zgarmaydi. Faqat shu brauzerda boshqa foydalanuvchi
// kirganda, oldingi hisobning ochilgan darsi unga "meros" bo'lib qolmasligi uchun
// (progress-service.js chaqiradi; qiymat Firestore natijalaridan tiklanadi).
// ==================================================

export function replaceMechanicsUnlockedLesson(lessonNumber) {
  const value = Math.max(1, Number(lessonNumber) || 1);
  localStorage.setItem(STORAGE_KEY, String(value));
  if (value >= 2) localStorage.setItem(LEGACY_LESSON_2_KEY, "true");
  else localStorage.removeItem(LEGACY_LESSON_2_KEY);
}

// ==================================================
// MAVZU KARTASI ID (bosh sahifadagi "Davom etish" havolalari uchun)
// "15-mavzu" -> mavzu-15, "15.1-mavzu" -> mavzu-15-1
// ==================================================

export function lessonAnchorId(lesson) {
  const label = String(lesson.numberLabel || lesson.number)
    .replace(/-?mavzu$/i, "")
    .trim()
    .replace(/[^0-9a-z]+/gi, "-");
  return `mavzu-${label}`;
}

function focusHashLesson(container) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id.startsWith("mavzu-")) return;
  const card = container.querySelector(`#${CSS.escape(id)}`);
  if (!card) return;
  card.setAttribute("tabindex", "-1");
  card.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  card.focus({ preventScroll: true });
  card.style.outline = "3px solid #10b574";
  card.style.outlineOffset = "4px";
  setTimeout(() => { card.style.outline = ""; card.style.outlineOffset = ""; }, 2600);
}

export function renderMechanicsLessons(
  lessons,
  container
) {

  if (!container) {

    console.error(
      "❌ #videos elementi topilmadi."
    );

    return;
  }


  // ==================================================
  // ODDIY FOYDALANUVCHI UCHUN PROGRESS
  // ==================================================

  const unlockedLesson =
    getMechanicsUnlockedLesson();


  // ==================================================
  // VIDEO CARDLAR
  // ==================================================

  const fragment =
    document.createDocumentFragment();


  lessons.forEach((lesson) => {

    const card =
      document.createElement(
        "article"
      );


    card.className =
      "video-card";


    card.dataset.lesson =
      String(lesson.number);

    card.id =
      lessonAnchorId(lesson);


    // ==================================================
    // LOCK
    // ==================================================

    const isLocked =
      lesson.number >
      unlockedLesson;


    if (isLocked) {

      card.classList.add(
        "is-locked"
      );
    }


    // ==================================================
    // VIDEO
    // ==================================================

    const iframe =
      document.createElement(
        "iframe"
      );


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


    // ==================================================
    // INFO
    // ==================================================

    const info =
      document.createElement(
        "div"
      );


    info.className =
      "video-info";


    const heading =
      document.createElement(
        "h3"
      );


    heading.textContent =
      `${
        lesson.numberLabel ||
        `${lesson.number}-mavzu`
      } | ${lesson.title}`;


    info.appendChild(
      heading
    );


    // ==================================================
    // TEST
    // ==================================================

    if (lesson.testUrl) {

      const testLink =
        document.createElement(
          "a"
        );


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
        document.createElement(
          "span"
        );


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


    // ==================================================
    // LOCK OVERLAY
    // ==================================================

    if (isLocked) {

      const overlay =
        document.createElement(
          "div"
        );


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


  // ==================================================
  // VIDEOLARNI SAHIFAGA JOYLASHTIRISH
  // ==================================================

  container.replaceChildren(
    fragment
  );

  focusHashLesson(container);


  // ==================================================
  // FULL ACCESS TEKSHIRISH
  // ==================================================

  checkFullAccess()
    .then((fullAccess) => {

      console.log(
        "Full Access:",
        fullAccess
      );


      // Agar maxsus ruxsat bo‘lmasa,
      // hech narsani o‘zgartirmaymiz.

      if (!fullAccess) {
        return;
      }


      // ==================================================
      // BARCHA LOCKLARNI OLIB TASHLASH
      // ==================================================

      const lockedCards =
        container.querySelectorAll(
          ".video-card.is-locked"
        );


      lockedCards.forEach(
        (card) => {

          card.classList.remove(
            "is-locked"
          );


          const overlay =
            card.querySelector(
              ".lock-overlay"
            );


          if (overlay) {
            overlay.remove();
          }

        }
      );


      console.log(
        "✅ Full Access: barcha Mexanika darslari ochildi."
      );

    })
    .catch((error) => {

      // Hech qanday holatda
      // videolarni buzmaymiz.

      console.warn(
        "Full Access jarayonida xatolik:",
        error
      );

    });
}