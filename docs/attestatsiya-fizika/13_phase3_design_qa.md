# 13 — 3-bosqich: dizayn QA (OliyFizika.uz 2.0)

Usul: Playwright skrinshotlari — 5 sahifa × (desktop 1366 / tablet 820 / mobile 390) × (light / dark) = 30 ta + user/admin oqimining 13 ta kadri. Fayllar: `_private/attestatsiya-fizika/e2e/*.png` (git’ga kirmaydi).

## Design system bilan moslik

| Mezon | Holat |
|---|---|
| Header / navigation | Sahifalar `app-shell.js` ichida: sidebar, top bar, breadcrumb (`data-shell-title`), mobil pastki menyu. Sahifa ichidagi takroriy breadcrumb olib tashlandi. Admin sahifa `data-shell-mode="admin"`. |
| Ranglar | Faqat `--of-*` tokenlar; qattiq rang yo‘q. Holatlar: yashil (to‘g‘ri), qizil (noto‘g‘ri), to‘q sariq (javobsiz/yopiq), ko‘k (asosiy). |
| Tipografiya | `--of-font-display` sarlavhalar, `of-num` raqamlar, `--of-text-*` o‘lchamlari. |
| Kartalar / tugmalar | `of-card`, `of-btn` (--primary/--success/--soft/--ghost/--sm/--lg), `of-badge`, `of-progress`, `of-skeleton`, `openModal`, `toast` — mavjud komponentlar qayta ishlatildi. |
| Spacing | Token oralig‘lari; statistika plitalari va panellar orasidagi bo‘shliq tuzatildi. |
| Animatsiya | Faqat yengil o‘tishlar; `prefers-reduced-motion` da o‘chadi. |
| Dark mode | `:root[data-theme="dark"]` tokenlari; savol rasmlari qorong‘i fonda ham o‘qilishi uchun och «qog‘oz» fonida. |

## Topilgan va tuzatilgan muammolar

1. Yopiq kunlar kartalarida juda katta qulf ikonlari → ixcham `.att-locked` ro‘yxati (31 kun mazmunsiz, faqat raqam).
2. Ikonlar o‘lchami ba’zi joylarda cheklanmagan → `.att :where(.of-icon)` standart o‘lcham, natija/statistika ikonlariga aniq o‘lcham.
3. Navigator: birinchi tugma «Javob berilgan: 4» ko‘rsatardi (`[data-answered]` selektor to‘qnashuvi) → `data-sum-answered/left`.
4. Breadcrumb ikki marta (shell + sahifa) → sahifadagisi olib tashlandi.
5. Mobil statistikada «47 daqiqa 28 s» ikki qatorga bo‘linardi va plitalar grafikka yopishib turardi → «47 daq 28 s», 16px oraliq.

## Responsive va accessibility (avtomatik tekshiruv)

- Gorizontal overflow: 30/30 holatda yo‘q.
- Variantlar `button[role=radio]` + `aria-label`, `role=radiogroup`, strelkalar bilan tanlash; sekundomer `role=timer`; `aria-live` holat bloklari; jadvallarda `caption`/`scope`; progress bar `role=progressbar` + `aria-valuenow`; skip-link (shell).
- Konsol xatolari: admin, user, ertasi kun sahifalarida 0.

## Qolgan kichik kuzatuvlar

- Full-page skrinshotlarda fixed sidebar/header sahifa o‘rtasida ko‘rinadi — bu Playwright full-page artefakti, haqiqiy brauzerda emas.
- Natija sahifasida aniq foiz (73.91%), statistika yaxlitlangan (74%) — ataylab: statistikada Rules saqlagan `scorePercent` ishlatiladi.
- Haqiqiy qurilmalarda (iOS Safari, Android Chrome) qo‘lda ko‘rish tavsiya etiladi.
