// Elementlar ekranga kirganda qisqa, bosqichma-bosqich paydo bo'lishi (components.css → .of-animate-in).
// prefers-reduced-motion: CSS darhol ko'rsatadi. IntersectionObserver bo'lmasa — darhol.

export function revealOnScroll(items, { step = 1, maxIndex = 8 } = {}) {
  const list = [...items];
  list.forEach((el, i) => el.style.setProperty("--i", Math.min(i * step, maxIndex)));
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    list.forEach((el) => el.classList.remove("is-pending"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    let batch = 0;
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.style.setProperty("--i", batch++);
      e.target.classList.remove("is-pending");
      e.target.classList.add("of-animate-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -6% 0px" });
  list.forEach((el) => { el.classList.add("is-pending"); io.observe(el); });
}
