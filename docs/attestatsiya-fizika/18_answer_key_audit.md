# 18 — Answer key auditi (1027 savol)

Manba: canonical LaTeX (`chapters/*.tex` + `.sol`) → `prepare_attestation_data.py`. Har savol bitta kategoriyada.
**Javoblar bu faylda yo‘q** (docs/ GitHub'ga chiqadi). To‘liq tafsilot: `_private/attestatsiya-fizika/reports/answer_key_audit_full.md`.

| Kategoriya | Ma’nosi | Soni |
|---|---|---|
| A | kalit valid | 865 |
| B✓ | kalit yo'q + yechim bor → tiklandi | 62 |
| C | kalit yo'q + yechim/shart yetarli emas | 14 |
| D | noaniq (bir nechta talqin) | 24 |
| E | kalit/variant yechim bilan ziddiyatli | 43 |
| F | savol/variant noto'g'ri (bosma/birlik/takror) | 12 |
| G | rasmga bog'liq, hal qilinmagan | 7 |
| | **Jami** | **1027** |

Ballga kiradigan (`auto`): **927** (865 + 62 tiklangan). `TEKSHIRISH_KERAK` (kalitsiz, ballga kirmaydi, ID bilan belgilangan): **100**.

## TEKSHIRISH_KERAK — savollar ro‘yxati

| ID | Kun | Manba | Turi | Kategoriya | Muammo (qisqa) | Harakat |
|---|---|---|---|---|---|---|
| AF-1-018 | 1 | F30-020 | unreliable | D | shart/talqin noaniq | muallif talqinini tanlash (siz) |
| AF-1-043 | 2 | F30-034 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-050 | 2 | F06-004 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-058 | 2 | F25-028 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-065 | 2 | F24-004 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-077 | 3 | F27-007 | open | C | shartda kerakli ma’lumot berilmagan | manbadan to‘liq shart/variantlarni topish |
| AF-1-100 | 3 | F29-029 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-142 | 5 | F02-013 | unreliable | F | variantlar boshqa masaladan ko‘chirilgan | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-158 | 5 | F17-026 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-167 | 6 | F22-004 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-177 | 6 | F30-019 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-184 | 6 | F27-069 | open | D | shart/talqin noaniq | muallif talqinini tanlash (siz) |
| AF-1-201 | 7 | F19-005 | unreliable | E | shartda son/ma’lumot tushib qolgan | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-202 | 7 | F25-014 | unreliable | D | shartda son/ma’lumot tushib qolgan | muallif talqinini tanlash (siz) |
| AF-1-203 | 7 | F27-064 | open | C | shartda kerakli ma’lumot berilmagan | manbadan to‘liq shart/variantlarni topish |
| AF-1-204 | 7 | F27-065 | open | C | ikki variant/ikki talqin to‘g‘ri chiqadi | manbadan to‘liq shart/variantlarni topish |
| AF-1-213 | 7 | F10-008 | unreliable | E | shart fizik jihatdan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-217 | 7 | F09-002 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-241 | 8 | F24-021 | unreliable | F | variantda birlik xatosi | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-1-252 | 8 | F05-011 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-2-029 | 9 | F02-030 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-2-045 | 10 | F27-009 | open | C | chizma/rasm manbada yo‘q | manbadan to‘liq shart/variantlarni topish |
| AF-2-052 | 10 | F23-008 | unreliable | G | grafik talqiniga bog‘liq | rasmni manba bilan solishtirish |
| AF-2-057 | 10 | F28-011 | unreliable | G | grafik talqiniga bog‘liq | rasmni manba bilan solishtirish |
| AF-2-059 | 10 | F30-003 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-2-061 | 10 | F17-008 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-2-093 | 11 | F25-034 | unreliable | F | variantda birlik xatosi | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-2-109 | 11 | F10-003 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-006 | 12 | F25-029 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-021 | 12 | F10-023 | unreliable | F | variantlar takrorlangan | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-026 | 12 | F27-006 | open | C | chizma/rasm manbada yo‘q | manbadan to‘liq shart/variantlarni topish |
| AF-3-033 | 13 | F27-020 | open | F | shart fizik jihatdan ziddiyatli | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-036 | 13 | F10-025 | unreliable | G | rasm talqiniga bog‘liq | rasmni manba bilan solishtirish |
| AF-3-097 | 15 | F27-051 | open | D | ikki variant/ikki talqin to‘g‘ri chiqadi | muallif talqinini tanlash (siz) |
| AF-3-114 | 15 | F27-015 | open | C | shartda kerakli ma’lumot berilmagan | manbadan to‘liq shart/variantlarni topish |
| AF-3-118 | 15 | F28-014 | unreliable | D | shartda kerakli ma’lumot berilmagan | muallif talqinini tanlash (siz) |
| AF-3-142 | 16 | F11-018 | unreliable | F | variantda birlik xatosi | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-145 | 16 | F27-046 | open | C | chizma/rasm manbada yo‘q | manbadan to‘liq shart/variantlarni topish |
| AF-3-163 | 17 | F12-015 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-172 | 17 | F27-047 | open | C | shartda son/ma’lumot tushib qolgan | manbadan to‘liq shart/variantlarni topish |
| AF-3-173 | 17 | F12-033 | unreliable | E | shart fizik jihatdan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-177 | 17 | F30-004 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-205 | 18 | F12-029 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-215 | 18 | F11-028 | unreliable | G | variantlar takrorlangan | rasmni manba bilan solishtirish |
| AF-3-240 | 19 | F13-019 | unreliable | G | variantlar takrorlangan | rasmni manba bilan solishtirish |
| AF-3-246 | 19 | F27-034 | open | F | savol/variant xatosi | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-261 | 20 | F12-002 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-3-269 | 20 | F27-026 | open | C | shartda kerakli ma’lumot berilmagan | manbadan to‘liq shart/variantlarni topish |
| AF-3-282 | 20 | F25-009 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-4-003 | 21 | F25-023 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-4-009 | 21 | F09-028 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-4-010 | 21 | F09-021 | unreliable | G | rasm talqiniga bog‘liq | rasmni manba bilan solishtirish |
| AF-4-020 | 21 | F26-013 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-4-030 | 21 | F27-063 | open | C | shartda kerakli ma’lumot berilmagan | manbadan to‘liq shart/variantlarni topish |
| AF-4-033 | 21 | F05-035 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-4-036 | 21 | F05-034 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-4-089 | 23 | F02-003 | unreliable | F | variantlar boshqa masaladan ko‘chirilgan | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-4-091 | 23 | F29-030 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-4-098 | 23 | F27-025 | open | C | shart/variantlar to‘liq emas | manbadan to‘liq shart/variantlarni topish |
| AF-4-100 | 23 | F09-025 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-002 | 24 | F24-033 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-5-006 | 24 | F21-026 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-014 | 24 | F09-019 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-038 | 25 | F30-024 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-047 | 25 | F07-003 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-074 | 26 | F08-031 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-090 | 27 | F08-033 | unreliable | D | ikki variant/ikki talqin to‘g‘ri chiqadi | muallif talqinini tanlash (siz) |
| AF-5-091 | 27 | F08-023 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-093 | 27 | F08-025 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-096 | 27 | F06-032 | unreliable | E | shart fizik jihatdan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-107 | 27 | F28-024 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-110 | 27 | F03-009 | unreliable | F | variantlar takrorlangan | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-5-111 | 27 | F23-030 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-6-015 | 28 | F21-027 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-6-017 | 28 | F02-010 | unreliable | D | shartda kerakli ma’lumot berilmagan | muallif talqinini tanlash (siz) |
| AF-6-037 | 29 | F08-013 | unreliable | F | variantlar takrorlangan | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-6-041 | 29 | F22-035 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-051 | 29 | F27-028 | open | F | savol/variant xatosi | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-6-052 | 29 | F27-048 | open | C | shartda kerakli ma’lumot berilmagan | manbadan to‘liq shart/variantlarni topish |
| AF-6-054 | 29 | F27-070 | open | C | shartda kerakli ma’lumot berilmagan | manbadan to‘liq shart/variantlarni topish |
| AF-6-055 | 29 | F27-078 | open | C | to‘g‘ri qiymat variantlarda yo‘q | manbadan to‘liq shart/variantlarni topish |
| AF-6-056 | 29 | F30-022 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-071 | 30 | F28-018 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-073 | 30 | F03-021 | unreliable | D | variantlar takrorlangan | muallif talqinini tanlash (siz) |
| AF-6-107 | 31 | F28-045 | unreliable | E | kalit yechim bilan ziddiyatli | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
| AF-6-122 | 31 | F30-046 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-124 | 31 | F30-050 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-128 | 32 | F17-042 | unreliable | G | rasm talqiniga bog‘liq | rasmni manba bilan solishtirish |
| AF-6-129 | 32 | F17-043 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-130 | 32 | F17-044 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-131 | 32 | F20-042 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-133 | 32 | F20-047 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-135 | 32 | F20-050 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-138 | 32 | F17-036 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-146 | 32 | F03-048 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-148 | 32 | F17-049 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-149 | 32 | F17-050 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-150 | 32 | F20-039 | unreliable | D | talqin noaniq | muallif talqinini tanlash (siz) |
| AF-6-151 | 32 | F20-048 | unreliable | F | savol/variant xatosi | bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang) |
| AF-6-152 | 32 | F30-042 | unreliable | E | to‘g‘ri qiymat variantlarda yo‘q | variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang) |
