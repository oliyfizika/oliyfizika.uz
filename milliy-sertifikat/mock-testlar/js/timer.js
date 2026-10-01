// Qat'iy tugash vaqtiga (endTs) asoslangan taymer: sahifa yangilansa ham vaqt to'xtamaydi.
import { fmtDuration } from "./dom.js";

export function createTimer({ element, getEndTs, onWarn, onExpire, warnSeconds = 600 }) {
  let handle = null;
  let warned = false;

  function tick() {
    const left = Math.max(0, Math.floor((getEndTs() - Date.now()) / 1000));
    element.textContent = fmtDuration(left);
    element.classList.toggle("danger", left <= warnSeconds);
    element.setAttribute("aria-label", `Qolgan vaqt: ${fmtDuration(left)}`);
    if (!warned && left <= warnSeconds && left > 0) {
      warned = true;
      onWarn?.(left);
    }
    if (left <= 0) {
      stop();
      onExpire?.();
    }
  }

  function start() {
    stop();
    warned = Math.floor((getEndTs() - Date.now()) / 1000) <= warnSeconds;
    tick();
    handle = setInterval(tick, 500);
  }

  function stop() {
    if (handle) clearInterval(handle);
    handle = null;
  }

  return { start, stop };
}
