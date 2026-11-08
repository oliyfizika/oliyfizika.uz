// «Bu bo‘lim qanday ishlaydi?» oynalarining matnlari (uz | ru | en).
// Har bir kalit sahifadagi data-section-help="<kalit>" ga mos keladi.
// Tuzilma: { title, lead, steps?: [], stepsTitle?, groups?: [{ title, icon?, tone?: "green"|"blue", items: [] }], note?, cta?: { label, href, external? } }
// Faqat oddiy matn (HTML emas). Raqamlar va qoidalar kodga mos bo'lishi shart — o'zgarsa, shu yerda ham yangilang.

const TG_COURSE = "https://t.me/oliy_fizik";
const TG_CHANNEL = "https://t.me/oliyfizika_uz";

export const SECTION_HELP = {
  // ------------------------------------------------------------------ ATTESTATSIYA (umumiy)
  attestatsiya: {
    uz: {
      title: "Attestatsiya bo‘limi qanday ishlaydi?",
      lead: "O‘qituvchilar attestatsiyasiga ikki yo‘nalishda tayyorlanasiz: Fizika va Pedagogika.",
      steps: [
        "Saytga kiring (email orqali ro‘yxatdan o‘tish).",
        "Yo‘nalishni tanlang: Fizika yoki Pedagogika.",
        "Testni ishlang — natija topshirgan zahoti chiqadi.",
      ],
      groups: [
        { title: "Fizika — 32 kunlik kurs", icon: "atom", tone: "blue", items: [
          "Har kuni administrator yangi test e’lon qiladi (jami 1027 ta savol bazasidan).",
          "Har bir test bir marta ishlanadi, boshlagandan keyin 2 soat vaqt beriladi.",
          "Topshirgach: natija, to‘g‘ri javoblar va har bir masalaning bosqichma-bosqich yechimi ochiladi.",
          "Mock testlar: imtihon formatida 50 ta savol, 100 ball.",
        ] },
        { title: "Pedagogika", icon: "lecture", tone: "green", items: [
          "13 ta mavzu testi, har birida 20 ta tasodifiy savol.",
          "Yakunda natija foizda ko‘rsatiladi.",
        ] },
        { title: "Bepul va pullik", icon: "key", items: [
          "Fizika: Day 1–3 va Mock test 1 — hamma uchun bepul.",
          "Day 4 dan boshlab va Mock test 2–5 — kurs ishtirokchilari uchun.",
          "Pedagogika testlari — bepul.",
        ] },
      ],
      cta: { label: "Fizika kursiga yozilish", href: TG_COURSE, external: true },
    },
    ru: {
      title: "Как работает раздел «Аттестация»?",
      lead: "Вы готовитесь к аттестации учителей по двум направлениям: Физика и Педагогика.",
      steps: [
        "Войдите на сайт (регистрация по email).",
        "Выберите направление: Физика или Педагогика.",
        "Решите тест — результат появится сразу после сдачи.",
      ],
      groups: [
        { title: "Физика — 32-дневный курс", icon: "atom", tone: "blue", items: [
          "Каждый день администратор публикует новый тест (из базы в 1027 вопросов).",
          "Каждый тест решается один раз, после начала даётся 2 часа.",
          "После сдачи открываются результат, правильные ответы и пошаговое решение каждой задачи.",
          "Пробные тесты: 50 вопросов в формате экзамена, 100 баллов.",
        ] },
        { title: "Педагогика", icon: "lecture", tone: "green", items: [
          "13 тематических тестов, в каждом 20 случайных вопросов.",
          "В конце результат показывается в процентах.",
        ] },
        { title: "Бесплатно и платно", icon: "key", items: [
          "Физика: Day 1–3 и Пробный тест 1 — бесплатно для всех.",
          "С Day 4 и Пробные тесты 2–5 — для участников курса.",
          "Тесты по педагогике — бесплатно.",
        ] },
      ],
      cta: { label: "Записаться на курс физики", href: TG_COURSE, external: true },
    },
    en: {
      title: "How does the Certification section work?",
      lead: "You prepare for teacher certification in two tracks: Physics and Pedagogy.",
      steps: [
        "Sign in to the site (email registration).",
        "Choose a track: Physics or Pedagogy.",
        "Take a test — your result appears as soon as you submit.",
      ],
      groups: [
        { title: "Physics — 32-day course", icon: "atom", tone: "blue", items: [
          "Every day the administrator publishes a new test (from a bank of 1027 questions).",
          "Each test can be taken once; you get 2 hours from the moment you start.",
          "After submitting, the result, correct answers and a step-by-step solution to every problem open.",
          "Mock tests: 50 questions in exam format, 100 points.",
        ] },
        { title: "Pedagogy", icon: "lecture", tone: "green", items: [
          "13 topic tests, each with 20 random questions.",
          "At the end your result is shown as a percentage.",
        ] },
        { title: "Free and paid", icon: "key", items: [
          "Physics: Day 1–3 and Mock test 1 are free for everyone.",
          "From Day 4 and Mock tests 2–5 — for course participants.",
          "Pedagogy tests are free.",
        ] },
      ],
      cta: { label: "Join the Physics course", href: TG_COURSE, external: true },
    },
  },

  // ------------------------------------------------------------------ ATTESTATSIYA → FIZIKA
  "att-fizika": {
    uz: {
      title: "Fizika kursi qanday ishlaydi?",
      lead: "32 kunlik kurs: har kuni yangi test, darhol natija va to‘liq yechimlar.",
      steps: [
        "«Bugungi test» kartasidan e’lon qilingan testni oching.",
        "Testni boshlang — 2 soat vaqt beriladi, javoblar avtomatik saqlanadi.",
        "Topshiring (yoki vaqt tugaydi) — natija va to‘g‘ri javoblar darhol chiqadi.",
        "«Yechimlar» bo‘limida har bir masalaning bosqichma-bosqich yechimini ko‘ring.",
      ],
      groups: [
        { title: "Kunlik testlar", icon: "list", tone: "blue", items: [
          "Testni administrator e’lon qiladi; e’lon qilingan testni xohlagan kuningizda ishlaysiz.",
          "Har bir test faqat bir marta ishlanadi.",
          "Hali e’lon qilinmagan kunlarning mazmuni ko‘rinmaydi.",
          "Test vaqtida ilmiy kalkulyatordan foydalanish mumkin.",
        ] },
        { title: "Mock testlar", icon: "clipboard", items: [
          "Har biri 50 ta savol, har bir savol 2 ball — jami 100 ball, vaqt 2 soat.",
          "Mock test 1: 40 ta fizika + 10 ta pedagogika.",
          "Mock test 2: 35 ta fizika + 5 ta kasbiy standart + 10 ta pedagogik mahorat.",
          "Mock test 3–5: 35 ta fizika + 15 ta pedagogika, savollar takrorlanmaydi.",
          "Sahifani yangilasangiz ham vaqt va javoblar saqlanib qoladi.",
        ] },
        { title: "Natijalar va yechimlar", icon: "chart", tone: "green", items: [
          "«Natijalar va statistika»da barcha urinishlar, o‘rtacha va eng yuqori natija, mavzular bo‘yicha tahlil.",
          "Yechimlar test yakunlangan zahoti ochiladi va keyin ham saqlanib qoladi.",
        ] },
        { title: "Bepul va pullik", icon: "key", items: [
          "Day 1–3 va Mock test 1 — saytga kirgan hamma uchun bepul.",
          "Day 4 dan boshlab va Mock test 2–5 — kurs ishtirokchilari uchun (ruxsat administrator tomonidan beriladi).",
        ] },
      ],
      cta: { label: "Kursga yozilish (Telegram)", href: TG_COURSE, external: true },
    },
    ru: {
      title: "Как работает курс физики?",
      lead: "32-дневный курс: каждый день новый тест, мгновенный результат и полные решения.",
      steps: [
        "Откройте опубликованный тест в карточке «Тест на сегодня».",
        "Начните тест — даётся 2 часа, ответы сохраняются автоматически.",
        "Сдайте тест (или время закончится) — результат и правильные ответы появятся сразу.",
        "В разделе «Решения» смотрите пошаговое решение каждой задачи.",
      ],
      groups: [
        { title: "Ежедневные тесты", icon: "list", tone: "blue", items: [
          "Тест публикует администратор; опубликованный тест можно решить в любой удобный день.",
          "Каждый тест решается только один раз.",
          "Содержание ещё не опубликованных дней не показывается.",
          "Во время теста можно пользоваться научным калькулятором.",
        ] },
        { title: "Пробные тесты", icon: "clipboard", items: [
          "В каждом 50 вопросов по 2 балла — всего 100 баллов, время 2 часа.",
          "Пробный тест 1: 40 по физике + 10 по педагогике.",
          "Пробный тест 2: 35 по физике + 5 по профстандарту + 10 по педагогическому мастерству.",
          "Пробные тесты 3–5: 35 по физике + 15 по педагогике, вопросы не повторяются.",
          "Даже если обновить страницу, время и ответы сохранятся.",
        ] },
        { title: "Результаты и решения", icon: "chart", tone: "green", items: [
          "В «Результатах и статистике» — все попытки, средний и лучший результат, анализ по темам.",
          "Решения открываются сразу после завершения теста и остаются доступными.",
        ] },
        { title: "Бесплатно и платно", icon: "key", items: [
          "Day 1–3 и Пробный тест 1 — бесплатно для всех вошедших.",
          "С Day 4 и Пробные тесты 2–5 — для участников курса (доступ выдаёт администратор).",
        ] },
      ],
      cta: { label: "Записаться на курс (Telegram)", href: TG_COURSE, external: true },
    },
    en: {
      title: "How does the Physics course work?",
      lead: "A 32-day course: a new test every day, instant results and full solutions.",
      steps: [
        "Open the published test from the “Today’s test” card.",
        "Start the test — you get 2 hours, answers are saved automatically.",
        "Submit (or let the time run out) — the result and correct answers appear immediately.",
        "In “Solutions”, see a step-by-step solution to every problem.",
      ],
      groups: [
        { title: "Daily tests", icon: "list", tone: "blue", items: [
          "The administrator publishes each test; you can take a published test on any day you like.",
          "Each test can be taken only once.",
          "The content of days not yet published is hidden.",
          "A scientific calculator is available during the test.",
        ] },
        { title: "Mock tests", icon: "clipboard", items: [
          "Each has 50 questions worth 2 points — 100 points in total, 2 hours.",
          "Mock test 1: 40 physics + 10 pedagogy.",
          "Mock test 2: 35 physics + 5 professional standard + 10 pedagogical skill.",
          "Mock tests 3–5: 35 physics + 15 pedagogy, no repeated questions.",
          "Your time and answers are kept even if you reload the page.",
        ] },
        { title: "Results and solutions", icon: "chart", tone: "green", items: [
          "“Results and statistics” shows all attempts, average and best score, and analysis by topic.",
          "Solutions open as soon as the test is finished and stay available.",
        ] },
        { title: "Free and paid", icon: "key", items: [
          "Day 1–3 and Mock test 1 are free for every signed-in user.",
          "From Day 4 and Mock tests 2–5 — for course participants (access is granted by the administrator).",
        ] },
      ],
      cta: { label: "Join the course (Telegram)", href: TG_COURSE, external: true },
    },
  },

  // ------------------------------------------------------------------ ATTESTATSIYA → PEDAGOGIKA (faqat matn)
  "att-pedagogika": {
    uz: {
      title: "Pedagogika testlari qanday ishlaydi?",
      lead: "Pedagogika fanidan attestatsiyaga tayyorgarlik uchun 13 ta mavzu testi.",
      steps: [
        "Ro‘yxatdan kerakli testni tanlang (Test №1–13).",
        "20 ta tasodifiy savolga javob bering.",
        "Yakunda natijangiz foizda ko‘rsatiladi.",
      ],
      note: "Testni istalgancha qayta ishlash mumkin — har safar savollar tasodifiy tanlanadi.",
    },
    ru: {
      title: "Как работают тесты по педагогике?",
      lead: "13 тематических тестов для подготовки к аттестации по педагогике.",
      steps: [
        "Выберите нужный тест в списке (Тест №1–13).",
        "Ответьте на 20 случайных вопросов.",
        "В конце результат показывается в процентах.",
      ],
      note: "Тест можно проходить сколько угодно раз — вопросы каждый раз выбираются случайно.",
    },
    en: {
      title: "How do the Pedagogy tests work?",
      lead: "13 topic tests to prepare for the pedagogy part of certification.",
      steps: [
        "Pick a test from the list (Test No. 1–13).",
        "Answer 20 random questions.",
        "At the end your result is shown as a percentage.",
      ],
      note: "You can retake a test as many times as you like — questions are picked at random each time.",
    },
  },

  // ------------------------------------------------------------------ MILLIY SERTIFIKAT
  "milliy-sertifikat": {
    uz: {
      title: "Milliy sertifikat bo‘limi qanday ishlaydi?",
      lead: "Ikki qism: interaktiv mock testlar va test variantlarining video/PDF yechimlari.",
      steps: [
        "Saytga kiring.",
        "«Mock test yechish» orqali testni tanlang va boshlang.",
        "Topshirgach natijangizni darhol ko‘ring.",
        "Tushunmagan savollaringizni video va PDF yechimlarda ko‘rib chiqing.",
      ],
      groups: [
        { title: "Interaktiv mock testlar", icon: "clipboard", tone: "blue", items: [
          "Imtihon formati: har bir testda 45 ta savol, 180 daqiqalik taymer.",
          "Test vaqtida ilmiy kalkulyator va formula jadvali ochiq.",
          "Javoblar shu qurilmada saqlanadi — sahifani yopsangiz ham vaqt tugaguncha davom ettirasiz.",
          "Saytga kirgan hamma uchun bepul.",
        ] },
        { title: "Video va PDF yechimlar", icon: "video", tone: "green", items: [
          "10 ta test varianti: har birida 45 ta savol, PDF variant va 9 ta video yechim.",
          "Yechimlar pullik: ruxsat Telegram orqali olinadi va administrator tomonidan ochiladi.",
        ] },
      ],
      cta: { label: "Ruxsat olish (Telegram)", href: TG_CHANNEL, external: true },
    },
    ru: {
      title: "Как работает раздел «Национальный сертификат»?",
      lead: "Две части: интерактивные пробные тесты и видео/PDF-решения вариантов.",
      steps: [
        "Войдите на сайт.",
        "В «Решить пробный тест» выберите тест и начните.",
        "После сдачи сразу увидите свой результат.",
        "Непонятные вопросы разберите в видео- и PDF-решениях.",
      ],
      groups: [
        { title: "Интерактивные пробные тесты", icon: "clipboard", tone: "blue", items: [
          "Формат экзамена: 45 вопросов в каждом тесте, таймер на 180 минут.",
          "Во время теста доступны научный калькулятор и таблица формул.",
          "Ответы сохраняются на этом устройстве — можно продолжить, пока не истечёт время.",
          "Бесплатно для всех вошедших.",
        ] },
        { title: "Видео- и PDF-решения", icon: "video", tone: "green", items: [
          "10 вариантов: в каждом 45 вопросов, PDF-вариант и 9 видеорешений.",
          "Решения платные: доступ запрашивается через Telegram и открывается администратором.",
        ] },
      ],
      cta: { label: "Получить доступ (Telegram)", href: TG_CHANNEL, external: true },
    },
    en: {
      title: "How does the National Certificate section work?",
      lead: "Two parts: interactive mock tests and video/PDF solutions to test variants.",
      steps: [
        "Sign in to the site.",
        "Choose a test in “Take a mock test” and start it.",
        "See your result right after submitting.",
        "Review the questions you missed in the video and PDF solutions.",
      ],
      groups: [
        { title: "Interactive mock tests", icon: "clipboard", tone: "blue", items: [
          "Exam format: 45 questions per test, 180-minute timer.",
          "A scientific calculator and formula sheet are available during the test.",
          "Answers are saved on this device — you can continue until the time runs out.",
          "Free for every signed-in user.",
        ] },
        { title: "Video and PDF solutions", icon: "video", tone: "green", items: [
          "10 test variants: each with 45 questions, a PDF variant and 9 video solutions.",
          "Solutions are paid: request access via Telegram; the administrator opens it.",
        ] },
      ],
      cta: { label: "Get access (Telegram)", href: TG_CHANNEL, external: true },
    },
  },

  // ------------------------------------------------------------------ UMUMIY FIZIKA
  "umumiy-fizika": {
    uz: {
      title: "Umumiy fizika kursi qanday ishlaydi?",
      lead: "5 ta kurs: Mexanika, Molekulyar fizika, Elektr va magnetizm, Optika, Atom va yadro.",
      steps: [
        "Kursni tanlang va birinchi mavzuni oching.",
        "Video darsni ko‘ring va formulalarni o‘qing.",
        "Mavzu testini ishlang.",
        "Kamida 80% natija oling — keyingi mavzu ochiladi.",
      ],
      groups: [
        { title: "Mavzular ketma-ket ochiladi", icon: "lock", tone: "blue", items: [
          "Har bir mavzu testidan kamida 80% natija keyingi mavzuni ochadi.",
          "Kurslar ham ketma-ket: oldingi kursni yakunlagach, keyingisi ochiladi.",
          "Yakunlangan mavzularni istalgan vaqtda takrorlash mumkin.",
        ] },
        { title: "Natija, XP va yechimlar", icon: "medal", tone: "green", items: [
          "Har bir test natijasi saqlanadi va «Mening natijalarim»da ko‘rinadi.",
          "Testdan o‘tganingiz uchun XP ball beriladi (har mavzu uchun bir marta).",
          "80% dan o‘tgan testning bosqichma-bosqich yechimlari ochiladi.",
        ] },
      ],
      note: "Progressingiz saqlanishi uchun ro‘yxatdan o‘ting — keyin istalgan qurilmadan davom ettirasiz.",
    },
    ru: {
      title: "Как работает курс общей физики?",
      lead: "5 курсов: Механика, Молекулярная физика, Электричество и магнетизм, Оптика, Атом и ядро.",
      steps: [
        "Выберите курс и откройте первую тему.",
        "Посмотрите видеоурок и прочитайте формулы.",
        "Решите тест по теме.",
        "Наберите не менее 80% — откроется следующая тема.",
      ],
      groups: [
        { title: "Темы открываются по порядку", icon: "lock", tone: "blue", items: [
          "Результат не ниже 80% в тесте по теме открывает следующую тему.",
          "Курсы тоже по порядку: после завершения предыдущего открывается следующий.",
          "Завершённые темы можно повторять в любое время.",
        ] },
        { title: "Результаты, XP и решения", icon: "medal", tone: "green", items: [
          "Каждый результат сохраняется и виден в «Моих результатах».",
          "За сданный тест начисляются очки XP (один раз за тему).",
          "Для теста, сданного на 80% и выше, открываются пошаговые решения.",
        ] },
      ],
      note: "Зарегистрируйтесь, чтобы прогресс сохранялся — продолжайте с любого устройства.",
    },
    en: {
      title: "How does the General Physics course work?",
      lead: "5 courses: Mechanics, Molecular physics, Electricity and magnetism, Optics, Atomic and nuclear physics.",
      steps: [
        "Choose a course and open the first topic.",
        "Watch the video lesson and read the formulas.",
        "Take the topic test.",
        "Score at least 80% — the next topic unlocks.",
      ],
      groups: [
        { title: "Topics unlock in order", icon: "lock", tone: "blue", items: [
          "At least 80% on a topic test unlocks the next topic.",
          "Courses also go in order: finish one to unlock the next.",
          "Completed topics can be repeated at any time.",
        ] },
        { title: "Results, XP and solutions", icon: "medal", tone: "green", items: [
          "Every test result is saved and shown in “My results”.",
          "Passing a test earns XP (once per topic).",
          "Step-by-step solutions open for tests passed with 80% or more.",
        ] },
      ],
      note: "Register so your progress is saved — then continue from any device.",
    },
  },

  // ------------------------------------------------------------------ SIMULYATSIYALAR
  simulyatsiyalar: {
    uz: {
      title: "Simulyatsiyalar bo‘limi qanday ishlaydi?",
      lead: "Fizik jarayonlarni interaktiv modellarda kuzatasiz va o‘zingiz boshqarasiz.",
      steps: [
        "Sinfni (7–11) tanlang yoki bo‘lim bo‘yicha saralang.",
        "Darslik mundarijasidan kerakli mavzuni bosing — simulyatsiya ochiladi.",
        "Parametrlarni o‘zgartiring yoki obyektlarni sahnada sudrang.",
        "Natijani grafik va qiymatlar orqali real vaqtda kuzating.",
      ],
      groups: [
        { title: "Imkoniyatlar", icon: "flask", tone: "blue", items: [
          "Sinf tanlansa, darslikdagi mavzular tartibida kerakli simulyatsiya bir bosishda ochiladi.",
          "Bitta simulyatsiya bir necha sinf mavzusiga mos kelishi mumkin.",
          "Grafiklar faqat jarayonni tushunishga yordam beradigan joyda ko‘rsatiladi.",
        ] },
      ],
      note: "Laboratoriya ishlari uchun «Virtual laboratoriyalar» bo‘limiga o‘ting.",
    },
    ru: {
      title: "Как работает раздел «Симуляции»?",
      lead: "Вы наблюдаете физические процессы в интерактивных моделях и управляете ими.",
      steps: [
        "Выберите класс (7–11) или отфильтруйте по разделу.",
        "Нажмите нужную тему в оглавлении учебника — откроется симуляция.",
        "Меняйте параметры или перетаскивайте объекты на сцене.",
        "Следите за результатом на графиках и в значениях в реальном времени.",
      ],
      groups: [
        { title: "Возможности", icon: "flask", tone: "blue", items: [
          "При выборе класса нужная симуляция открывается в один клик в порядке тем учебника.",
          "Одна симуляция может подходить к темам нескольких классов.",
          "Графики показываются только там, где они помогают понять процесс.",
        ] },
      ],
      note: "Для лабораторных работ перейдите в раздел «Виртуальные лаборатории».",
    },
    en: {
      title: "How does the Simulations section work?",
      lead: "You observe physical processes in interactive models and control them yourself.",
      steps: [
        "Choose a grade (7–11) or filter by section.",
        "Click a topic in the textbook contents — the simulation opens.",
        "Change parameters or drag objects on the stage.",
        "Watch the result in graphs and values in real time.",
      ],
      groups: [
        { title: "Features", icon: "flask", tone: "blue", items: [
          "Once a grade is chosen, the right simulation opens in one click, following the textbook order.",
          "One simulation may fit topics from several grades.",
          "Graphs appear only where they help understand the process.",
        ] },
      ],
      note: "For lab work, go to the “Virtual labs” section.",
    },
  },

  // ------------------------------------------------------------------ VIRTUAL LABORATORIYALAR
  laboratoriyalar: {
    uz: {
      title: "Virtual laboratoriyalar qanday ishlaydi?",
      lead: "Darslikdagi laboratoriya ishlarini virtual asboblar bilan bajarasiz.",
      steps: [
        "Sinf yoki bo‘lim bo‘yicha laboratoriya ishini tanlang.",
        "Asboblar bilan o‘lchash o‘tkazing.",
        "Har bir o‘lchovni «Qaydlar»ga belgilang.",
        "Qaydlardan jadvalni to‘ldiring — hisoblashlar avtomatik bajariladi.",
        "Natijalar bilan PDF hisobotni yuklab oling.",
      ],
      note: "PDF hisobotda o‘lchovlar jadvali, formulalar va hisoblash natijalari bo‘ladi — uni o‘qituvchiga topshirish mumkin.",
    },
    ru: {
      title: "Как работают виртуальные лаборатории?",
      lead: "Вы выполняете лабораторные работы из учебника с виртуальными приборами.",
      steps: [
        "Выберите лабораторную работу по классу или разделу.",
        "Проведите измерения приборами.",
        "Отмечайте каждое измерение в «Заметках».",
        "Заполните таблицу из записей — расчёты выполняются автоматически.",
        "Скачайте PDF-отчёт с результатами.",
      ],
      note: "В PDF-отчёте — таблица измерений, формулы и результаты расчётов; его можно сдать учителю.",
    },
    en: {
      title: "How do the virtual labs work?",
      lead: "You carry out textbook lab experiments with virtual instruments.",
      steps: [
        "Choose a lab by grade or section.",
        "Take measurements with the instruments.",
        "Record each measurement in “Notes”.",
        "Fill in the table from your notes — calculations are done automatically.",
        "Download the PDF report with your results.",
      ],
      note: "The PDF report contains the measurement table, formulas and calculated results — you can hand it in to your teacher.",
    },
  },

  // ------------------------------------------------------------------ OLIMPIADA
  olimpiada: {
    uz: {
      title: "Olimpiada bo‘limi qanday ishlaydi?",
      lead: "Fizika olimpiadalarining asl topshiriqlari, yechimlari va baholash mezonlari.",
      steps: [
        "Olimpiada turini tanlang (masalan, Asosiy olimpiada yoki Al-Xorazmiy).",
        "Yilni tanlang.",
        "Kerakli materialni (topshiriqlar, yechimlar, baholash) PDF ko‘rinishida oching.",
      ],
      groups: [
        { title: "Materiallar", icon: "book", tone: "blue", items: [
          "Bosqichlar bo‘yicha: tuman, viloyat, respublika va xalqaro saralash.",
          "Ko‘p materiallar o‘zbek va rus tillarida.",
          "Har bir materialning asl manbasi «Manba» havolasida ko‘rsatilgan.",
        ] },
      ],
    },
    ru: {
      title: "Как работает раздел «Олимпиада»?",
      lead: "Оригинальные задания олимпиад по физике, решения и критерии оценивания.",
      steps: [
        "Выберите вид олимпиады (например, Основная олимпиада или Аль-Хорезми).",
        "Выберите год.",
        "Откройте нужный материал (задания, решения, критерии) в PDF.",
      ],
      groups: [
        { title: "Материалы", icon: "book", tone: "blue", items: [
          "По этапам: районный, областной, республиканский и отбор на международные.",
          "Многие материалы на узбекском и русском языках.",
          "Первоисточник каждого материала указан в ссылке «Источник».",
        ] },
      ],
    },
    en: {
      title: "How does the Olympiad section work?",
      lead: "Original physics olympiad problems, solutions and marking schemes.",
      steps: [
        "Choose an olympiad type (e.g. the Main olympiad or Al-Khwarizmi).",
        "Choose a year.",
        "Open the material you need (problems, solutions, marking) as a PDF.",
      ],
      groups: [
        { title: "Materials", icon: "book", tone: "blue", items: [
          "By stage: district, regional, national and international selection.",
          "Many materials are in Uzbek and Russian.",
          "The original source of each material is given in its “Source” link.",
        ] },
      ],
    },
  },

  // ------------------------------------------------------------------ GRE PHYSICS
  gre: {
    uz: {
      title: "GRE Physics bo‘limi qanday ishlaydi?",
      lead: "GRE Physics Subject Test’ga boblar bo‘yicha mashq qilasiz.",
      steps: [
        "Bobni tanlang yoki «Aralash GRE mashqi»ni boshlang.",
        "5 variantli savollarga javob bering.",
        "Har bir savoldan keyin qisqa yechim izohini o‘qing.",
      ],
      groups: [
        { title: "Imtihon sharoiti", icon: "target", tone: "blue", items: [
          "Haqiqiy imtihonda kalkulyator yo‘q — hisoblarni qo‘lda bajarishga odatlaning.",
          "Bir savolga o‘rtacha 1,7 daqiqa beriladi.",
          "«Imtihon mavzulari ulushi» qaysi bo‘limga ko‘proq e’tibor berishni ko‘rsatadi.",
        ] },
      ],
    },
    ru: {
      title: "Как работает раздел GRE Physics?",
      lead: "Вы тренируетесь к GRE Physics Subject Test по главам.",
      steps: [
        "Выберите главу или начните «Смешанную тренировку GRE».",
        "Отвечайте на вопросы с 5 вариантами.",
        "После каждого вопроса читайте краткое пояснение решения.",
      ],
      groups: [
        { title: "Условия экзамена", icon: "target", tone: "blue", items: [
          "На настоящем экзамене нет калькулятора — привыкайте считать вручную.",
          "На один вопрос в среднем 1,7 минуты.",
          "«Доля тем на экзамене» показывает, каким разделам уделять больше внимания.",
        ] },
      ],
    },
    en: {
      title: "How does the GRE Physics section work?",
      lead: "You practise for the GRE Physics Subject Test chapter by chapter.",
      steps: [
        "Choose a chapter or start the “Mixed GRE practice”.",
        "Answer 5-option questions.",
        "Read the short solution note after each question.",
      ],
      groups: [
        { title: "Exam conditions", icon: "target", tone: "blue", items: [
          "The real exam has no calculator — get used to calculating by hand.",
          "About 1.7 minutes per question on average.",
          "“Share of exam topics” shows which areas deserve more attention.",
        ] },
      ],
    },
  },

  // ------------------------------------------------------------------ QUIZLAR
  quizlar: {
    uz: {
      title: "Quizlar qanday ishlaydi?",
      lead: "Mavzu bo‘yicha tezkor savollar bilan bilimingizni tekshirasiz.",
      steps: [
        "Mavzuni tanlang yoki aralash quizni boshlang.",
        "Har bir savolga 20 soniya ichida javob bering.",
        "Yakunda natijangizni ko‘ring va xohlasangiz qayta urinib ko‘ring.",
      ],
      note: "Quizlar qisqa takrorlash uchun — mavzuni chuqur o‘rganish uchun «Umumiy fizika» kursidan foydalaning.",
    },
    ru: {
      title: "Как работают квизы?",
      lead: "Вы проверяете знания быстрыми вопросами по теме.",
      steps: [
        "Выберите тему или начните смешанный квиз.",
        "На каждый вопрос отвечайте за 20 секунд.",
        "В конце посмотрите результат и при желании попробуйте снова.",
      ],
      note: "Квизы — для быстрого повторения; для глубокого изучения темы используйте курс «Общая физика».",
    },
    en: {
      title: "How do the quizzes work?",
      lead: "You check your knowledge with quick questions on a topic.",
      steps: [
        "Choose a topic or start the mixed quiz.",
        "Answer each question within 20 seconds.",
        "See your result at the end and try again if you like.",
      ],
      note: "Quizzes are for quick revision; use the General Physics course to study a topic in depth.",
    },
  },

  // ------------------------------------------------------------------ INTERAKTIV O'YINLAR
  oyinlar: {
    uz: {
      title: "Interaktiv o‘yinlar qanday ishlaydi?",
      lead: "9 ta o‘yin: yakka mashq uchun ham, sinfda jamoaviy bellashuv uchun ham.",
      groups: [
        { title: "Yakka o‘yinlar", icon: "gamepad", tone: "blue", items: [
          "So‘z qidirish — 12×12 jadvaldan fizik terminlarni topish.",
          "Formulani top, Formula qur, Birlikni top — formulalar va SI birliklari.",
          "Xotira juftlari — kattalik va birlik, olim va kashfiyot juftlari.",
          "Nishonga ur va Muvozanat — fizik topshiriqli bosqichli o‘yinlar.",
        ] },
        { title: "Jamoaviy o‘yinlar (sinf uchun)", icon: "users", tone: "green", items: [
          "Arqon tortish — ikki jamoa bir xil savolga tezlikda javob beradi.",
          "Baraban — bir necha jamoa o‘rtasida bilimlar bellashuvi.",
        ] },
        { title: "O‘z savollaringiz", icon: "sparkles", items: [
          "Formulani top, Formula qur, Xotira juftlari, Arqon tortish va Baraban umumiy savollar to‘plamidan foydalanadi.",
          "Tayyor namunalarni tanlang yoki o‘z mavzu va savollaringizni yarating.",
        ] },
      ],
    },
    ru: {
      title: "Как работают интерактивные игры?",
      lead: "9 игр: и для самостоятельной тренировки, и для командных соревнований в классе.",
      groups: [
        { title: "Одиночные игры", icon: "gamepad", tone: "blue", items: [
          "Поиск слов — найти физические термины в таблице 12×12.",
          "Найди формулу, Собери формулу, Найди единицу — формулы и единицы СИ.",
          "Пары на память — пары величина–единица, учёный–открытие.",
          "Попади в цель и Равновесие — уровневые игры с физическими задачами.",
        ] },
        { title: "Командные игры (для класса)", icon: "users", tone: "green", items: [
          "Перетягивание каната — две команды на скорость отвечают на один вопрос.",
          "Барабан — соревнование знаний между несколькими командами.",
        ] },
        { title: "Свои вопросы", icon: "sparkles", items: [
          "Найди формулу, Собери формулу, Пары на память, Перетягивание каната и Барабан используют общие наборы вопросов.",
          "Выберите готовые наборы или создайте свои темы и вопросы.",
        ] },
      ],
    },
    en: {
      title: "How do the interactive games work?",
      lead: "9 games: for solo practice and for team contests in class.",
      groups: [
        { title: "Solo games", icon: "gamepad", tone: "blue", items: [
          "Word search — find physics terms in a 12×12 grid.",
          "Find the formula, Build the formula, Find the unit — formulas and SI units.",
          "Memory pairs — quantity–unit and scientist–discovery pairs.",
          "Hit the target and Balance — level-based games with physics tasks.",
        ] },
        { title: "Team games (for class)", icon: "users", tone: "green", items: [
          "Tug of war — two teams race to answer the same question.",
          "Drum — a knowledge contest between several teams.",
        ] },
        { title: "Your own questions", icon: "sparkles", items: [
          "Find the formula, Build the formula, Memory pairs, Tug of war and Drum share question sets.",
          "Pick ready-made sets or create your own topics and questions.",
        ] },
      ],
    },
  },

  // ------------------------------------------------------------------ KUTUBXONA
  kutubxona: {
    uz: {
      title: "Kutubxona qanday ishlaydi?",
      lead: "Fizika bo‘yicha o‘quv materiallari bir joyda.",
      steps: [
        "Bo‘limni tanlang: darsliklar, ma’ruzalar, masalalar, laboratoriya ishlari yoki prezentatsiyalar.",
        "Ro‘yxatni saralang yoki qidiruvdan foydalaning.",
        "Materialni oching yoki yuklab oling.",
      ],
    },
    ru: {
      title: "Как работает библиотека?",
      lead: "Учебные материалы по физике в одном месте.",
      steps: [
        "Выберите раздел: учебники, лекции, задачники, лабораторные работы или презентации.",
        "Отфильтруйте список или воспользуйтесь поиском.",
        "Откройте или скачайте материал.",
      ],
    },
    en: {
      title: "How does the Library work?",
      lead: "Physics study materials in one place.",
      steps: [
        "Choose a section: textbooks, lectures, problem books, lab work or presentations.",
        "Filter the list or use search.",
        "Open or download the material.",
      ],
    },
  },
};
