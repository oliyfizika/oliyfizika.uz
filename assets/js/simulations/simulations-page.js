// ==========================================================================
// Simulyatsiyalar — katalog sahifasi (simulations/simulations.html)
// Ma'lumot: simulations/data/manifest.json va data/curriculum.json (darsliklar mundarijasi).
// Simulyatsiya kodlari (canvas dvigatellari) bu sahifada YUKLANMAYDI — faqat havolalar.
// Ko'rinish: «Barchasi» — mavzu chiplari + kartochkalar to'ri; «7-sinf»…«11-sinf» — darslik mundarijasi
// bob-bob, har mavzuda kerakli preset bilan «Ochish» (?sinf=8 URL da saqlanadi).
// Qidiruv: nom, tavsif, mavzu, parametrlar va kalit so'zlar; sinf ichida — raqam, mavzu va simulyatsiya nomi.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/\s+/g, " ").trim();

const state = { data: null, curriculum: null, grade: "", topic: "", query: "" };
const GRADES = ["7", "8", "9", "10", "11"];

// Sxematik chizmalar (bezak; ekran o'quvchilardan yashirilgan). viewBox 160×90.
// .a — asosiy (ko'k), .b — ikkinchi (yashil), .m — yordamchi chiziq.
const ART = {
  motion: '<path class="m" d="M16 76h134M20 80V10"/><path class="a" d="M20 70 70 46 140 12"/><path class="b" d="M20 74c40 0 80-10 120-52"/><circle class="a f" cx="70" cy="46" r="3.5"/><circle class="b f" cx="104" cy="56" r="3.5"/>',
  projectile: '<path class="m" d="M14 76h134M14 76V12"/><path class="a" d="M16 76C44 8 96 8 124 76" stroke-dasharray="4 5"/><circle class="b f" cx="98" cy="30" r="5"/>',
  pendulum: '<path class="m" d="M52 12h56"/><path class="a" d="M80 12 104 66"/><circle class="b f" cx="104" cy="66" r="8"/><path class="m" d="M80 12v58" stroke-dasharray="3 4"/><path class="m" d="M56 64a30 30 0 0 0 48 2"/>',
  "physical-pendulum": '<path class="m" d="M60 10h40"/><path class="a" d="M80 12 100 80" stroke-width="7"/><circle class="m f" cx="80" cy="12" r="3"/><circle class="b f" cx="90" cy="46" r="5"/><circle class="m" cx="96" cy="66" r="4.5"/><path class="m" d="M80 12v68" stroke-dasharray="3 4"/>',
  spring: '<path class="m" d="M18 22v50M18 72h130"/><path class="a" d="M18 47h10l5-10 8 20 8-20 8 20 8-20 8 20 5-10h8"/><rect class="b f" x="96" y="33" width="30" height="28" rx="5"/>',
  "circular-motion": '<circle class="m" cx="80" cy="45" r="30" stroke-dasharray="4 5"/><circle class="m f" cx="80" cy="45" r="2.5"/><path class="a" d="M80 45 101 24"/><circle class="b f" cx="101" cy="24" r="6"/><path class="a" d="M101 24l20 20"/>',
  "gravity-law": '<circle class="a f" cx="48" cy="45" r="16"/><circle class="b f" cx="118" cy="45" r="9"/><path class="m" d="M68 45h38"/><path class="m" d="m74 40-6 5 6 5M100 40l6 5-6 5"/>',
  "newton-second-law": '<path class="m" d="M14 70h132"/><rect class="b f" x="60" y="42" width="34" height="28" rx="4"/><path class="a" d="M94 56h36"/><path class="a" d="m124 50 8 6-8 6"/>',
  energy: '<path class="m" d="M12 18c10 40 30 56 68 56s58-16 68-56"/><circle class="b f" cx="32" cy="52" r="6"/><path class="a" d="M36 58l10 8"/><rect class="m f o" x="112" y="14" width="8" height="22"/><rect class="b f" x="124" y="24" width="8" height="12"/>',
  fluid: '<path class="m" d="M12 30h44c14 0 18 12 30 12h18c12 0 16-12 30-12h12M12 70h44c14 0 18-12 30-12h18c12 0 16 12 30 12h12"/><path class="a" d="M20 50h26M94 50h34"/><path class="a" d="m40 45 7 5-7 5M122 45l7 5-7 5"/><path class="b" d="M62 50h28" stroke-dasharray="3 3"/><path class="m" d="M34 30V10M98 42V22"/><path class="b" d="M34 30V14M98 42V28" stroke-width="4"/>',
  nuclear: '<circle class="b f" cx="40" cy="45" r="6"/><circle class="a f" cx="49" cy="41" r="6"/><circle class="b f" cx="47" cy="51" r="6"/><circle class="a f" cx="36" cy="54" r="6"/><path class="a" d="M60 38l20-14M62 50l22 10" stroke-dasharray="3 3"/><circle class="a f" cx="86" cy="22" r="4"/><path class="m" d="M100 76h52M104 80V14"/><path class="b" d="M104 18c10 30 22 48 46 54"/>',
  rutherford: '<path class="a" d="M12 26h50c12 0 20-6 28-20M12 64h50c12 0 20 6 28 20M12 41h52c7 0 9-2 9-5 0-5-12-10-36-14"/><circle class="b f" cx="84" cy="45" r="6"/><path class="m" d="M118 16a44 44 0 0 1 0 58" stroke-dasharray="3 4"/><rect class="m f" x="124" y="21" width="12" height="9" rx="2" transform="rotate(-30 130 25)"/>',
  bohr: '<circle class="m" cx="58" cy="45" r="14"/><circle class="m" cx="58" cy="45" r="26"/><circle class="m" cx="58" cy="45" r="38" stroke-dasharray="3 4"/><circle class="b f" cx="58" cy="45" r="5"/><circle class="a f" cx="84" cy="45" r="3.5"/><path class="a" d="M84 45 70 45"/><path class="a" d="M100 30h10M100 42h10M100 54h10M100 66h10" stroke-width="3"/><path class="m" d="M118 30h22M118 42h22M118 54h22M118 66h22"/>',
  "davisson-germer": '<path class="a" d="M50 8v52"/><path class="m" d="M24 66h52"/><circle class="m f" cx="34" cy="66" r="2"/><circle class="m f" cx="44" cy="66" r="2"/><circle class="m f" cx="56" cy="66" r="2"/><circle class="m f" cx="66" cy="66" r="2"/><path class="b" d="M50 62c8-10 30-14 36-30M50 62c14-2 40-6 50-4"/><circle class="b" cx="122" cy="45" r="12"/><circle class="b" cx="122" cy="45" r="22"/><circle class="a f" cx="122" cy="45" r="3"/>',
  "photoeffect": '<circle class="a f" cx="22" cy="40" r="8"/><path class="a" d="M31 40h40" stroke-dasharray="4 3"/><path class="m" d="M86 16a30 30 0 0 1 0 50"/><path class="m" d="M74 22v38"/><circle class="b f" cx="80" cy="34" r="2.4"/><circle class="b f" cx="78" cy="48" r="2.4"/><path class="m" d="M104 74h46M108 78V18"/><path class="b" d="M108 74c6 0 8-2 10-20s6-26 32-28"/>',
  "led-planck": '<path class="m" d="M16 74h70M20 78V16"/><path class="a" d="M38 74c8 0 10-6 14-50"/><path class="b" d="M52 74c8 0 10-6 14-50"/><path class="m" d="M66 74c8 0 10-6 14-50"/><path class="m" d="M104 30v30"/><path class="a f" d="M112 30l20 15-20 15z"/><path class="m" d="M132 30v30M104 45h8M132 45h14"/><path class="b" d="M124 26l8-10M132 28l8-10"/>',
  "thomson-em": '<circle class="m" cx="80" cy="45" r="38"/><circle class="m" cx="80" cy="45" r="27" opacity=".5"/><circle class="b" cx="80" cy="34" r="16"/><path class="a" d="M80 18v34"/><circle class="a f" cx="80" cy="50" r="2.5"/><path class="m" d="M76 22h8M76 30h8M76 38h8"/>',
  "millikan": '<path class="m" d="M30 16h100M30 74h100" stroke-width="4"/><circle class="a f" cx="56" cy="34" r="3"/><circle class="b f" cx="84" cy="50" r="3"/><circle class="a f" cx="108" cy="30" r="3"/><path class="a" d="M56 40v10M108 36v10"/><path class="b" d="M84 44v-10"/><path class="m" d="M44 22v46M122 22v46" stroke-dasharray="3 4"/>',
  "blackbody": '<path class="m" d="M16 76h134M20 80V12"/><path class="a" d="M20 76c8 0 12-58 26-58s26 50 100 56"/><path class="b" d="M20 76c14 0 20-36 36-36s30 32 90 34"/><path class="m" d="M20 76c20 0 28-16 46-16s30 14 80 15"/><path class="a" d="M46 14v62M56 36v40" stroke-dasharray="2 3"/>',
  "compton": '<rect class="m f" x="14" y="34" width="22" height="22" opacity=".5"/><path class="a" d="M36 45h44" stroke-dasharray="4 3"/><circle class="m" cx="84" cy="45" r="5"/><path class="b" d="M88 42l40-26"/><rect class="b f" x="124" y="8" width="14" height="22" rx="2" transform="rotate(-33 131 19)"/><path class="m" d="M84 45m-30 0a30 30 0 0 1 56 -14" stroke-dasharray="2 3"/>',
  "wilson": '<circle class="m" cx="80" cy="45" r="38"/><path class="a" d="M46 45l36-14M46 45l38 4M46 45l32 18" stroke-width="3"/><path class="b" d="M60 45c0-16 30-22 36-6s-10 26-22 18"/><path class="m" d="M100 10l-8 70" stroke-dasharray="1 3"/>',
  "inclined-plane": '<path class="m" d="M18 76h128L18 22Z"/><rect class="b f" x="54" y="30" width="22" height="18" rx="3" transform="rotate(22.9 65 39)"/><path class="a" d="M110 70a22 22 0 0 0-4-10"/>',
  statics: '<path class="m" d="M12 82h136"/><path class="m f o" d="M70 82h20L80 46Z"/><path class="a" d="M22 42h116"/><circle class="b f" cx="80" cy="42" r="3"/><path class="m" d="M44 42v8M104 42v8"/><rect class="b f" x="37" y="50" width="14" height="8" rx="2"/><rect class="b f" x="37" y="59" width="14" height="8" rx="2"/><rect class="b f" x="97" y="50" width="14" height="8" rx="2"/><rect class="b f" x="97" y="59" width="14" height="8" rx="2"/><rect class="b f" x="97" y="68" width="14" height="8" rx="2"/><path class="m" d="M44 30h36M80 26v8M44 26v8M104 26v8M80 30h24"/>',
  potential: '<circle class="a f" cx="56" cy="45" r="6"/><circle class="b f" cx="104" cy="45" r="6"/><path class="a" d="M56 45m-16 0a16 16 0 1 0 32 0a16 16 0 1 0-32 0M56 45m-30 0a30 30 0 1 0 60 0"/><path class="b" d="M104 45m-16 0a16 16 0 1 0 32 0a16 16 0 1 0-32 0"/>',
  electroscope: '<path class="m" d="M70 30h44v48H70z"/><circle class="m f" cx="92" cy="14" r="7"/><path class="m" d="M92 21v26"/><path class="b" d="M92 47 82 66M92 47l10 19" stroke-width="3"/><rect class="a" x="16" y="10" width="46" height="8" rx="4"/><path class="a" d="M64 14h10"/><path class="m" d="M60 78h64"/>',
  "coulomb-law": '<path class="m" d="M14 8h64M20 8v74"/><path class="m" d="M60 8l-10 44"/><circle class="a f" cx="49" cy="56" r="7"/><circle class="a f" cx="86" cy="58" r="7"/><path class="m" d="M86 65v14M76 80h20"/><path class="w" d="M45 56h8M49 52v8M82 58h8M86 54v8"/><path class="m" d="M110 44c14-16 34-16 44 0M110 72c14 16 34 16 44 0M106 58h52" stroke-dasharray="3 3"/><circle class="b f" cx="132" cy="58" r="5"/>',
  gas: '<path class="m" d="M30 20v52h64V20"/><path class="m" d="M30 30h64" stroke-width="4"/><path class="m" d="M62 30V10"/><circle class="a f" cx="44" cy="44" r="2.6"/><circle class="b f" cx="70" cy="40" r="2.6"/><circle class="a f" cx="58" cy="58" r="2.6"/><circle class="b f" cx="82" cy="62" r="2.6"/><circle class="a f" cx="40" cy="64" r="2.6"/><circle class="b f" cx="84" cy="46" r="2.6"/><path class="a" d="M58 58l9 4M44 44l-6-6"/><circle class="m" cx="122" cy="40" r="15"/><path class="b" d="M122 40l8-8"/>',
  heat: '<path class="m" d="M40 22v50h50V22"/><path class="a f" d="M42 50h46v20H42Z" opacity=".35"/><path class="b" d="M104 14v52"/><circle class="b f" cx="104" cy="70" r="5"/><path class="a" d="M118 70l10-14 10 6 10-28"/><path class="m" d="M118 34h30" stroke-dasharray="3 4"/><rect class="m f" x="58" y="40" width="16" height="12" rx="2"/>',
  thermo: '<path class="m" d="M22 18v54h44V18"/><rect class="m f" x="24" y="34" width="40" height="7"/><path class="m" d="M44 34V16"/><circle class="a f" cx="44" cy="14" r="3"/><path class="b" d="M36 82c2-5 4-5 4-9 2 4 4 4 4 9M46 82c2-5 4-5 4-9 2 4 4 4 4 9"/><path class="m" d="M86 78h66M90 82V12"/><path class="a" d="M100 22c12 2 24 10 34 20M134 42l10 22M144 64c-14-2-26-8-34-16M110 48 100 22"/><path class="m f o" d="M100 22c12 2 24 10 34 20l10 22c-14-2-26-8-34-16Z"/>',
  electrolysis: '<path class="m" d="M30 30v48h76V30"/><rect class="m f o" x="31" y="40" width="74" height="37"/><rect class="a f" x="44" y="22" width="7" height="46"/><rect class="b f" x="86" y="22" width="7" height="46"/><path class="m" d="M47 22V12h83v20M89 22v-6h18"/><circle class="b f" cx="64" cy="54" r="4"/><circle class="a f" cx="74" cy="64" r="4"/><circle class="b f" cx="72" cy="47" r="4"/><path class="m" d="M124 32h12v10h-12z"/>',
  emwaves: '<path class="m" d="M14 45h134"/><path class="a" d="M24 45c8-26 14-26 22 0s14 26 22 0 14-26 22 0 14 26 22 0 14-26 22 0"/><path class="b" d="M24 45c-6 10-10 12-12 12M46 45c-4-8-6-12-6-12M68 45c-4 8-6 12-6 12M90 45c-4-8-6-12-6-12M112 45c-4 8-6 12-6 12"/><path class="m" d="M14 18v54"/><circle class="a f" cx="14" cy="18" r="3"/><circle class="b f" cx="14" cy="72" r="3"/>',
  density: '<path class="m" d="M30 14v62M14 76h32"/><path class="a" d="M8 24l44-6"/><path class="m" d="M8 24l-6 26h20zM52 18l-6 26h20z"/><rect class="b f" x="4" y="42" width="12" height="8" rx="2"/><path class="m" d="M96 16v60h36V16"/><rect class="m f o" x="97" y="40" width="34" height="35"/><rect class="a f" x="106" y="56" width="14" height="16" rx="2"/><path class="m" d="M96 30h8M96 40h12M96 50h8M96 60h12"/>',
  pressure: '<path class="m" d="M14 78h132"/><path class="m" d="M28 20v58M48 20v58M28 66h20"/><rect class="m f o" x="29" y="40" width="18" height="38"/><rect class="a f" x="29" y="34" width="18" height="6"/><path class="a" d="M38 34V14"/><path class="m" d="M48 72h56M104 20v58M140 20v58"/><rect class="m f o" x="105" y="52" width="34" height="26"/><rect class="b f" x="105" y="46" width="34" height="6"/><rect class="b f" x="112" y="28" width="20" height="18" rx="2"/>',
  surface: '<path class="m" d="M12 20h50v50H12"/><rect class="m f o" x="13" y="21" width="34" height="48"/><path class="a" d="M47 18v54"/><path class="b" d="M49 45h14M58 40l5 5-5 5"/><path class="m" d="M84 76h66"/><rect class="m f o" x="84" y="62" width="66" height="14"/><path class="m" d="M96 76V14M102 76V14M116 76V14M120 76V14M134 76V14M136 76V14"/><path class="a" d="M97 30h4M117 46h2M135 22h0.5"/><rect class="a f" x="96.5" y="30" width="5" height="32"/><rect class="a f" x="116.5" y="46" width="3" height="16"/><rect class="a f" x="134.3" y="22" width="1.6" height="40"/>',
  humidity: '<path class="m" d="M10 76h140"/><rect class="m" x="22" y="12" width="10" height="56" rx="5"/><rect class="m" x="44" y="12" width="10" height="56" rx="5"/><path class="a" d="M27 60V30" stroke-width="4"/><path class="b" d="M49 60V42" stroke-width="4"/><circle class="a f" cx="27" cy="64" r="5"/><circle class="b f" cx="49" cy="64" r="5"/><path class="m" d="M49 70v6"/><path class="a f" d="M104 34c10 0 16-7 16-13a10 10 0 0 0-19-4 8 8 0 0 0-12 7c0 6 5 10 15 10z" opacity=".55"/><path class="b f" d="M92 58c0 4 3 6 6 6s6-2 6-6c0-4-6-11-6-11s-6 7-6 11z"/><path class="b f" d="M118 64c0 3 2 5 5 5s5-2 5-5c0-3-5-9-5-9s-5 6-5 9z"/>',
  metals: '<rect class="m f o" x="10" y="24" width="140" height="42"/><path class="m" d="M10 24h140M10 66h140"/><circle class="b f" cx="26" cy="36" r="4"/><circle class="b f" cx="54" cy="36" r="4"/><circle class="b f" cx="82" cy="36" r="4"/><circle class="b f" cx="110" cy="36" r="4"/><circle class="b f" cx="138" cy="36" r="4"/><circle class="b f" cx="40" cy="54" r="4"/><circle class="b f" cx="68" cy="54" r="4"/><circle class="b f" cx="96" cy="54" r="4"/><circle class="b f" cx="124" cy="54" r="4"/><circle class="a f" cx="34" cy="46" r="2.2"/><circle class="a f" cx="64" cy="30" r="2.2"/><circle class="a f" cx="90" cy="60" r="2.2"/><circle class="a f" cx="118" cy="45" r="2.2"/><circle class="a f" cx="146" cy="58" r="2.2"/><path class="a" d="M110 12H60M68 7l-8 5 8 5"/><path class="m" d="M20 80h120"/>',
  vectors: '<path class="m" d="M14 76h132M24 84V8"/><path class="m" d="M24 76 72 30" stroke-dasharray="4 4"/><path class="a" d="M24 76h62M86 76l-8-4M86 76l-8 4"/><path class="b" d="M86 76 120 36M120 36l-2 9M120 36l-8 4"/><path class="a" d="M24 76 116 39" stroke-width="3"/><path class="a f" d="m120 36-10 0 4 7z"/><path class="m" d="M58 30 120 36" stroke-dasharray="4 4"/>',
  magnetism: '<rect class="b f" x="20" y="38" width="22" height="14"/><rect class="a f" x="42" y="38" width="22" height="14"/><path class="a" d="M64 45c20-26 50-26 70 0M64 45c20 26 50 26 70 0M20 45c-8-12-8-20 0-26"/><circle class="m" cx="120" cy="45" r="9"/><circle class="m f" cx="120" cy="45" r="2.5"/>',
  lc: '<path class="m" d="M30 22h100v50H30z"/><path class="b" d="M22 40h16M22 50h16"/><path class="a" d="M122 34c10 0 10 6 0 6s10 0 0 6 10 0 0 6 10 0 0 6"/><path class="a" d="M50 47c6-14 12-14 18 0s12 14 18 0 12-14 18 0"/>',
  induction: '<path class="b" d="M60 30c-6 0-6 30 0 30M70 30c-6 0-6 30 0 30M80 30c-6 0-6 30 0 30M90 30c-6 0-6 30 0 30"/><rect class="a f" x="104" y="39" width="18" height="12"/><rect class="m f" x="122" y="39" width="18" height="12"/><path class="m" d="M60 60v14h30V60"/><path class="a" d="M24 45l8-10 8 20 8-10"/>',
  joule: '<path class="m" d="M18 30v48h46V30"/><path class="m f o" d="M20 52h42v24H20Z"/><path class="m" d="M14 26h54" stroke-width="4"/><path class="m" d="M30 26v42M52 26v42"/><path class="a" d="M30 68c2-6 4 6 6 0s4 6 6 0 4 6 6 0 4 6 4 0"/><path class="b" d="M41 10v52"/><circle class="b f" cx="41" cy="64" r="3.5"/><circle class="m f o" cx="118" cy="38" r="28"/><path class="m" d="M106 58c-2-8-12-12-12-22a24 24 0 0 1 48 0c0 10-10 14-12 22Z"/><path class="a" d="M110 40l4-8 4 8 4-8 4 8"/><path class="m" d="M112 58v-14M124 58v-14"/><path class="m f" d="M108 60h20v12h-20Z"/><path class="m" d="M108 64h20M108 68h20"/>',
  discharge: '<path class="m" d="M22 12h116a14 14 0 0 1 0 28H22a14 14 0 0 1 0-28Z"/><path class="m f o" d="M40 16h94a10 10 0 0 1 0 20H40Z"/><path class="a" d="M50 26h82" stroke-dasharray="6 4" stroke-width="6" opacity=".7"/><path class="m" d="M24 18v16M136 18v16M8 26h16M136 26h16"/><circle class="m f" cx="22" cy="68" r="7"/><circle class="m f" cx="68" cy="68" r="7"/><path class="b" d="M30 68l8-7 6 12 8-10 8 5"/><path class="m" d="M94 68h56"/><path class="a" d="M94 62h56M94 74h56" stroke-dasharray="2 5"/>',
  semiconductor: '<path class="m" d="M14 72h66M40 84V10"/><path class="a" d="M14 72.5H44C52 72 56 67 60 52C63 38 64 26 66 12"/><path class="m f o" d="M92 18h60v34H92Z"/><path class="m" d="M122 18v34"/><circle class="b" cx="102" cy="28" r="3"/><circle class="b" cx="112" cy="42" r="3"/><circle class="b" cx="100" cy="44" r="3"/><circle class="a f" cx="132" cy="28" r="2.5"/><circle class="a f" cx="144" cy="40" r="2.5"/><circle class="a f" cx="134" cy="46" r="2.5"/><path class="m" d="M90 72h22M128 72h24"/><path class="a f" d="M112 64v16l15-8Z"/><path class="a" d="M128 63v18"/>',
  circuit: '<path class="m" d="M24 18h112v54H24Z"/><path class="b" d="M24 38v14M18 42v6"/><path class="a" d="M58 18v-6l5 12 7-12 7 12 5-12v6"/><circle class="b f" cx="124" cy="45" r="9"/><path class="w" d="M118 39l12 12M130 39l-12 12"/><circle class="a f" cx="40" cy="72" r="3"/><circle class="a f" cx="86" cy="72" r="3"/>',
  lorentz: '<g class="m f"><circle cx="30" cy="22" r="1.8"/><circle cx="60" cy="22" r="1.8"/><circle cx="90" cy="22" r="1.8"/><circle cx="120" cy="22" r="1.8"/><circle cx="30" cy="68" r="1.8"/><circle cx="60" cy="68" r="1.8"/><circle cx="90" cy="68" r="1.8"/><circle cx="120" cy="68" r="1.8"/></g><path class="a" d="M14 45h40a24 24 0 1 0 24-24"/><circle class="b f" cx="54" cy="45" r="5"/>',
  waves: '<path class="m" d="M10 45h140" stroke-dasharray="3 4"/><path class="b" d="M14 45c8-26 16-26 24 0s16 26 24 0 16-26 24 0 16 26 24 0 16-26 24 0"/><circle class="a f" cx="62" cy="45" r="4"/>',
  light: '<circle class="a f" cx="24" cy="45" r="7"/><circle class="m f" cx="66" cy="45" r="11"/><path class="a" d="M24 38 140 14M24 52l116 24"/><path class="m f o" d="M66 34 140 20v50L66 56z"/><path class="m" d="M140 10v70"/>',
  dispersion: '<path class="m f o" d="M62 14 88 70H36z"/><path class="a" d="M10 52 52 36"/><path class="b" d="M74 40 146 58M74 40l72 26"/><path class="a" d="M74 40l72 10"/>',
  diffraction: '<path class="m" d="M40 10v28M40 44v2M40 52v28" stroke-width="3"/><path class="a" d="M14 45h24"/><path class="b" d="M44 45 140 16M44 45h96M44 45l96 29"/><path class="m" d="M140 10v70"/>',
  lens: '<path class="m" d="M10 45h140" stroke-dasharray="3 4"/><path class="m f o" d="M80 12c10 10 10 56 0 66c-10-10-10-56 0-66z"/><path class="a" d="M30 45V25"/><path class="a" d="M30 25h50l45 36"/><path class="b" d="M30 25l95 36"/><path class="a" d="M125 45v16"/>',
  "refraction-law": '<path class="m" d="M14 45h132"/><rect class="m f o" x="14" y="45" width="132" height="36"/><path class="m" d="M80 8v74" stroke-dasharray="3 4"/><path class="a" d="M44 10 80 45"/><path class="b" d="M80 45l22 36"/>',
};

function hydrateIcons(r = document) {
  $$("[data-icon]", r).forEach((el) => { if (!el.dataset.iconDone) { el.innerHTML = icon(el.dataset.icon); el.dataset.iconDone = "1"; } });
}

function card(sim, topics) {
  const topic = topics.get(sim.topic);
  const text = [sim.title, sim.description, topic?.title, (sim.params || []).join(" "), sim.keywords].join(" ");
  return `
    <li data-topic="${esc(sim.topic)}" data-search-text="${esc(text)}">
      <article class="of-card of-sim-card" data-topic="${esc(sim.topic)}">
        <svg class="of-sim-card__art" viewBox="0 0 160 90" aria-hidden="true" focusable="false">${ART[sim.id] || ""}</svg>
        <div class="of-sim-card__body">
          <span class="of-badge${sim.topic === "mexanika" ? " of-badge--blue" : sim.topic === "elektr" ? " of-badge--green" : sim.topic === "issiqlik" ? " of-badge--orange" : sim.topic === "atom" || sim.topic === "kvant" ? " of-badge--purple" : ""}">${esc(topic?.title || "")}</span>
          <h3 class="of-sim-card__title">${esc(sim.title)}</h3>
          <p class="of-sim-card__desc">${esc(sim.description)}</p>
          ${sim.params?.length ? `<p class="of-sim-card__params"><span class="of-sr-only">Parametrlar: </span>${sim.params.map((p) => `<span>${esc(p)}</span>`).join("")}</p>` : ""}
          <div class="of-sim-card__foot">
            <a class="of-btn of-btn--soft" href="${esc(sim.href)}" aria-label="Boshlash: ${esc(sim.title)}">Boshlash ${icon("arrowRight")}</a>
          </div>
        </div>
      </article>
    </li>`;
}

function renderChips() {
  const counts = new Map();
  state.data.simulations.forEach((s) => counts.set(s.topic, (counts.get(s.topic) || 0) + 1));
  // Faqat simulyatsiyasi bor mavzular ko'rsatiladi
  const chips = [{ id: "", title: "Barcha bo‘limlar", n: state.data.simulations.length }, ...state.data.topics.map((t) => ({ ...t, n: counts.get(t.id) || 0 }))]
    .filter((c) => c.n > 0);
  const box = $("[data-chips]");
  box.innerHTML = chips
    .map((c) => `<li><button type="button" class="of-chip" data-topic="${esc(c.id)}" aria-pressed="${c.id === state.topic}">${esc(c.title)} <small>${c.n}</small></button></li>`)
    .join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".of-chip");
    if (!b) return;
    state.topic = b.dataset.topic;
    $$(".of-chip", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const n = applyFilters();
    announce(n);
  });
}

function renderList() {
  const topics = new Map(state.data.topics.map((t) => [t.id, t]));
  const list = $("[data-sims]");
  list.innerHTML = state.data.simulations.map((s) => card(s, topics)).join("");
  list.removeAttribute("aria-busy");
  applyFilters();
  revealOnScroll(list.children, { maxIndex: 6 });
}

function announce(n) {
  const status = document.querySelector("[data-search-status]");
  if (status) status.textContent = state.grade ? `${n} ta mavzu ko‘rsatilmoqda` : `${n} ta simulyatsiya ko‘rsatilmoqda`;
}

/* ------------------------------------------------------------------ Sinflar (darslik mundarijasi) */

function renderGrades() {
  const box = $("[data-grades]");
  box.innerHTML = [["", "Barchasi"], ...GRADES.map((g) => [g, `${g}-sinf`])]
    .map(([g, t]) => `<button type="button" data-grade="${g}" aria-pressed="${g === state.grade}">${t}</button>`)
    .join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-grade]");
    if (b) setGrade(b.dataset.grade);
  });
  // Klaviatura: ← → bilan qo'shni sinfga o'tish (Tab bilan ham har tugmaga boriladi)
  box.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    const btns = $$("[data-grade]", box);
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const j = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
    btns[j].focus();
    setGrade(btns[j].dataset.grade);
  });
}

function setGrade(g, { updateUrl = true } = {}) {
  state.grade = GRADES.includes(g) ? g : "";
  $$("[data-grade]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.grade === state.grade)));
  $("[data-chips]").hidden = !!state.grade;
  $("[data-sims]").hidden = !!state.grade;
  $("[data-sims] + .of-search-empty")?.remove();
  const toc = $("[data-toc]");
  toc.hidden = !state.grade;
  if (state.grade) renderToc(); else toc.innerHTML = "";
  if (updateUrl) {
    const url = new URL(location.href);
    if (state.grade) url.searchParams.set("sinf", state.grade); else url.searchParams.delete("sinf");
    try { history.replaceState(null, "", url); } catch { /* file:// */ }
  }
  setupSearch();
  announce(applyFilters());
}

const simHref = (sim, preset) => sim.href + (preset ? `?preset=${encodeURIComponent(preset)}` : "");

/** Mavzu qatori: qaysi havola ochiladi va qanday ko'rinadi. null — qator ko'rsatilmaydi. */
function rowOf(m, sims) {
  if (m.tur === "matn") return null;
  const sim = m.sim ? sims.get(m.sim) : null;
  if (m.tur === "masala" && !sim) return null;
  if (m.tur === "lab") {
    const lab = m.lab ? sims.get(m.lab) : null;
    if (lab) return { kind: "lab", href: lab.href, target: lab };
    if (sim) return { kind: "lab", href: simHref(sim, m.preset), target: sim, note: "Laboratoriya varianti tayyorlanmoqda — hozircha oddiy simulyatsiya ochiladi" };
    return { kind: "lab", href: null, note: "Laboratoriya ishi tayyorlanmoqda" };
  }
  if (sim) return { kind: "sim", href: simHref(sim, m.preset), target: sim };
  return { kind: "sim", href: null, note: "Simulyatsiya tayyorlanmoqda" };
}

function renderToc() {
  const toc = $("[data-toc]");
  if (!state.curriculum) {
    toc.innerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Darsliklar mundarijasini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
    return;
  }
  const g = state.curriculum.sinflar.find((x) => String(x.sinf) === state.grade);
  const sims = new Map(state.data.simulations.map((s) => [s.id, s]));
  let shown = 0, linked = 0;
  const bobs = g.boblar.map((bob) => {
    const rows = bob.mavzular.map((m) => {
      const r = rowOf(m, sims);
      if (!r) return "";
      shown++;
      if (r.href) linked++;
      const label = `${m.raqam}. ${m.nom}`;
      const text = [m.raqam, `${m.raqam}-mavzu`, m.nom, r.target?.title, r.kind === "lab" ? "laboratoriya ishi" : "simulyatsiya"].join(" ");
      const badge = r.kind === "lab" ? `<span class="of-badge of-badge--green">Laboratoriya ishi</span>` : `<span class="of-badge of-badge--blue">Simulyatsiya</span>`;
      const action = r.href
        ? `<a class="of-btn of-btn--soft of-btn--sm" href="${esc(r.href)}" aria-label="Ochish: ${esc(label)} — ${esc(r.target.title)}">Ochish ${icon("arrowRight")}</a>`
        : `<span class="of-btn of-btn--sm of-toc__wait" aria-disabled="true">Tayyorlanmoqda</span>`;
      return `
        <li class="of-toc__row${r.href ? "" : " is-wait"}" data-search-text="${esc(text)}">
          <span class="of-toc__num" aria-hidden="true">${m.raqam}</span>
          <div class="of-toc__main">
            <span class="of-toc__name"><span class="of-sr-only">${m.raqam}-mavzu. </span>${esc(m.nom)}${m.taxminiy ? ` <small class="of-toc__guess" title="Nomi darslik PDF idan tekshirilmoqda">taxminiy nom</small>` : ""}</span>
            ${r.target ? `<span class="of-toc__sim">${esc(r.target.title)}</span>` : ""}
            ${r.note ? `<span class="of-toc__note">${esc(r.note)}</span>` : ""}
          </div>
          <span class="of-toc__badge">${badge}</span>
          <span class="of-toc__act">${action}</span>
        </li>`;
    }).join("");
    if (!rows) return "";
    return `
      <section class="of-toc__bob">
        <h3 class="of-toc__bob-title">${esc(bob.nom)}</h3>
        <ol class="of-toc__list" role="list">${rows}</ol>
      </section>`;
  }).join("");
  toc.innerHTML = `
    <div class="of-toc__head">
      <h2 class="of-toc__title">${g.sinf}-sinf fizika darsligi</h2>
      <p class="of-toc__meta">${g.nashr}-yil nashri · ${esc(g.fan)} · ${shown} ta mavzudan ${linked} tasi ochiladi</p>
      <p class="of-toc__hint of-subtle">Mavzu raqami va nomi darslikdagidek; boblar mavzular bo‘yicha guruhlangan. «Ochish» simulyatsiyani shu mavzuga mos tayyor tajriba bilan ochadi.</p>
    </div>
    ${bobs}`;
  hydrateIcons(toc);
}

function applyTocFilter() {
  let visible = 0;
  $$("[data-toc] .of-toc__bob").forEach((bob) => {
    let n = 0;
    $$(".of-toc__row", bob).forEach((li) => {
      const match = !state.query || norm(li.dataset.searchText).includes(state.query);
      li.hidden = !match;
      if (match) n++;
    });
    bob.hidden = !n;
    visible += n;
  });
  const total = $$("[data-toc] .of-toc__row").length;
  $("[data-sim-count]").textContent = state.query && visible !== total ? `${visible} / ${total} ta mavzu` : `${total} ta mavzu`;
  let note = $("[data-toc] .of-search-empty");
  if (!visible && total) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      note.setAttribute("role", "status");
      $("[data-toc]").append(note);
    }
    note.textContent = "Bu sinf darsligida bunday mavzu topilmadi. Boshqa so‘z bilan urinib ko‘ring yoki «Barchasi» ni tanlang.";
  } else note?.remove();
  return visible;
}

function applyFilters() {
  if (state.grade) return applyTocFilter();
  let visible = 0;
  $$("[data-sims] > li").forEach((li) => {
    const match = (!state.topic || li.dataset.topic === state.topic) && (!state.query || norm(li.dataset.searchText).includes(state.query));
    li.hidden = !match;
    if (match) visible++;
  });
  const total = state.data.simulations.length;
  $("[data-sim-count]").textContent = visible === total ? `${total} ta simulyatsiya` : `${visible} / ${total} ta simulyatsiya`;
  let note = $("[data-sims] + .of-search-empty");
  if (!visible) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      note.setAttribute("role", "status");
      $("[data-sims]").after(note);
    }
    note.textContent = "Bu so‘rov bo‘yicha simulyatsiya topilmadi. Boshqa so‘z bilan urinib ko‘ring.";
  } else note?.remove();
  return visible;
}

function setupSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: state.grade ? `${state.grade}-sinf mavzularidan qidirish…` : "Simulyatsiyani qidirish…",
    label: state.grade ? `${state.grade}-sinf darsligi mavzulari bo‘yicha qidirish` : "Simulyatsiyalar bo‘yicha qidirish",
    onQuery: (q) => { state.query = q; return state.data ? applyFilters() : 0; },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

async function init() {
  hydrateIcons();
  setupSearch();
  const load = async (name) => {
    const res = await fetch(new URL(`data/${name}`, location.href), { cache: "no-cache" });
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return res.json();
  };
  const curriculum = load("curriculum.json").catch((error) => { console.error("[simulyatsiyalar] mundarija yuklanmadi:", error); return null; });
  try {
    state.data = await load("manifest.json");
  } catch (error) {
    console.error("[simulyatsiyalar] ro'yxat yuklanmadi:", error);
    $("[data-sims]").outerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Simulyatsiyalar ro‘yxatini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
    return;
  }
  state.curriculum = await curriculum;
  renderGrades();
  renderChips();
  renderList();
  const g = new URLSearchParams(location.search).get("sinf");
  if (GRADES.includes(g)) setGrade(g, { updateUrl: false });
}

init();
