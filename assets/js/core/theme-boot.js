/* OliyFizika.uz — tema va sidebar holatini sahifa chizilishidan OLDIN qo'llaydi (miltillashsiz).
   <head> ichida oddiy (module emas) skript sifatida ulanadi. */
(function () {
  var root = document.documentElement;
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem("oliyfizika:" + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  var pref = read("theme", "light");
  var dark = pref === "dark" || (pref === "system" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "dark" : "light");
  if (read("sidebarCollapsed", false) === true) root.setAttribute("data-sidebar", "collapsed");
  root.classList.add("of-shell");
})();
