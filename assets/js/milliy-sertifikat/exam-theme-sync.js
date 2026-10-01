// Mock test sahifasi: engine (mock-testlar/js/theme.js) o'z mavzu sozlamasini "oliyfizika:mock:pref:theme"
// kalitidan o'qiydi (standart: qorong'i). Sahifa endi sayt qobig'ida, shuning uchun engine yuklanishidan OLDIN
// shu mavjud kalitga saytning joriy mavzusi yoziladi (yangi kalit yaratilmaydi, format o'sha: JSON satr).
(function () {
  try {
    var theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    localStorage.setItem("oliyfizika:mock:pref:theme", JSON.stringify(theme));
  } catch (e) { /* storage mavjud emas — engine standart mavzusini ishlatadi */ }
})();
