// Sidebar navigatsiyasi — yagona manba.
// `match` — joriy URL shu yo'l bilan boshlansa, element faol ko'rsatiladi.
// `protected: true` — mehmon foydalanuvchidan kirish talab qilinadi.
// `publicLanding: true` — bo'limning bosh sahifasi mehmonlarga ochiq (tuzilmani ko'rish uchun),
//   ichki sahifalari esa himoyalangan qoladi (sahifada data-shell-public="true").

export const NAV_GROUPS = [
  {
    id: "main",
    label: "Asosiy",
    items: [
      { id: "home", label: "Bosh sahifa", icon: "home", href: "index.html", match: ["index.html", ""], protected: false },
      { id: "umumiy-fizika", label: "Umumiy fizika", icon: "atom", href: "umumiy-fizika/umumiy-fizika.html", match: ["umumiy-fizika/"], protected: true, publicLanding: true },
      { id: "milliy-sertifikat", label: "Milliy sertifikat", icon: "certificate", href: "milliy-sertifikat/milliy-sertifikat.html", match: ["milliy-sertifikat/"], protected: true },
      { id: "attestatsiya", label: "Attestatsiya", icon: "clipboard", href: "attestatsiya/index.html", match: ["attestatsiya/"], protected: true },
      { id: "olimpiada", label: "Olimpiada", icon: "trophy", href: "olimpiada/olimpiada.html", match: ["olimpiada/"], protected: true },
      { id: "quizzes", label: "Quizlar", icon: "quiz", href: "quizs/quizs.html", match: ["quizs/"], protected: true, publicLanding: true },
      { id: "oyinlar", label: "Interaktiv o‘yinlar", icon: "gamepad", href: "interaktiv-oyinlar/interaktiv-oyinlar.html", match: ["interaktiv-oyinlar/"], protected: false }, // o‘yinlar avvaldan ochiq
      { id: "simulyatsiyalar", label: "Simulyatsiyalar", icon: "flask", href: "simulations/simulations.html", match: ["simulations/"], protected: true },
      { id: "kutubxona", label: "Kutubxona", icon: "book", href: "kutubxona/kutubxona.html", match: ["kutubxona/"], protected: true },
    ],
  },
  {
    id: "user",
    label: "Foydalanuvchi",
    items: [
      { id: "natijalar", label: "Mening natijalarim", icon: "chart", href: "dashboard/natijalar.html", match: ["dashboard/natijalar.html"], protected: true },
    ],
  },
  {
    id: "system",
    label: "Tizim",
    items: [
      { id: "settings", label: "Sozlamalar", icon: "settings", href: "dashboard/settings.html", match: ["dashboard/settings.html", "dashboard/profile.html"], protected: true },
      { id: "help", label: "Yordam", icon: "help", href: "dashboard/help.html", match: ["dashboard/help.html"], protected: false },
    ],
  },
];

// Mobil pastki navigatsiya — eng ko'p ishlatiladigan bo'limlar.
export const BOTTOM_NAV = ["home", "umumiy-fizika", "milliy-sertifikat", "natijalar"];

export const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

// ---------------------------------------------------------------------------
// Admin System 1.0 (admin/*.html, <body data-shell-mode="admin">).
// Faqat mavjud, ishlaydigan bo'limlar. Frontend menyusi XAVFSIZLIK EMAS — himoya firestore.rules'da.
// ---------------------------------------------------------------------------
export const ADMIN_NAV_GROUPS = [
  {
    id: "admin",
    label: "Administrator",
    items: [
      { id: "admin-dashboard", label: "Dashboard", icon: "chart", href: "admin/index.html", match: ["admin/index.html", "admin/"], protected: true },
      { id: "admin-users", label: "Foydalanuvchilar", icon: "users", href: "admin/users.html", match: ["admin/users.html", "admin/user.html"], protected: true },
      { id: "admin-results", label: "Natijalar", icon: "clipboard", href: "admin/results.html", match: ["admin/results.html"], protected: true },
      { id: "admin-access", label: "Access boshqaruvi", icon: "key", href: "admin/access.html", match: ["admin/access.html"], protected: true },
      { id: "admin-attestatsiya-fizika", label: "Attestatsiya — Fizika", icon: "clipboard", href: "admin/attestatsiya-fizika.html", match: ["admin/attestatsiya-fizika.html"], protected: true },
      { id: "admin-settings", label: "Sozlamalar", icon: "settings", href: "admin/settings.html", match: ["admin/settings.html"], protected: true },
    ],
  },
  {
    id: "admin-site",
    label: "Sayt",
    items: [
      { id: "admin-back", label: "Saytga qaytish", icon: "home", href: "index.html", match: [], protected: false },
    ],
  },
];

export const ADMIN_BOTTOM_NAV = ["admin-dashboard", "admin-users", "admin-results", "admin-access"];

// Asosiy saytda faqat role == "admin" bo'lgan foydalanuvchiga ko'rsatiladigan havola (UI qulayligi).
export const ADMIN_ENTRY = { id: "admin-panel", label: "Admin panel", icon: "shield", href: "admin/index.html" };
