// ==========================================================================
// Simulyatsiya sahifalari uchun kichik yordamchi (simulyatsiya kodi O'ZGARTIRILMAYDI).
// Qobiq sahifa kontentini sidebar/header ichiga ko'chirgandan keyin canvas kengligi o'zgaradi.
// O'lchamni o'zi hisoblaydigan simulyatsiyalar (masalan, Lorentz kuchi) buni o'zining mavjud
// window "resize" ishlovchisi orqali qayta hisoblaydi. Qolganlarida resize ishlovchisi yo'q — ta'sirsiz.
// ==========================================================================

const refit = () => window.dispatchEvent(new Event("resize"));

if (document.body.classList.contains("of-has-shell")) refit();
else document.addEventListener("of:shell-ready", refit, { once: true });
