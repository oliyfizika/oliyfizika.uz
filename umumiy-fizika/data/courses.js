// ==========================================================================
// Umumiy fizika — kurslar va mavzular (YAGONA MANBA)
// Kurs sahifalari (mexanika.html va h.k.) ham, bosh sahifadagi progress ham shu ro'yxatdan foydalanadi.
// Yangi mavzu qo'shish: tegishli kursning `lessons` ro'yxatiga qator qo'shing.
//
// `number` — global tartib raqami (1..N). Mavzular ketma-ket ochiladi:
// N-mavzu testidan >= 80% olinsa, N+1 ochiladi (js/mechanics-progress.js).
// Bir xil `number`ga ega mavzular (masalan, 15 va 15.1) bitta test bilan birga ochiladi.
// `description`lar — avvalgi umumiy-fizika.html sahifasidagi matnlar (o'zgartirilmagan).
//
// Boblar (ixtiyoriy): kursga `chapters: [{ title: "Kinematika", from: 1, to: 15 }]` qo'shilsa,
// kurs sahifasi mavzularni boblarga ajratib ko'rsatadi. Hozircha tasdiqlangan bob ma'lumoti yo'q.
// ==========================================================================

export const COURSES = [
  {
    id: "mexanika",
    title: "Mexanika",
    icon: "trajectory",
    description: "Harakat, kuch, energiya, impuls va Nyuton qonunlarini o‘rganing.",
    page: "umumiy-fizika/mexanika.html",
    lessons: [

  {
    number:1,
    numberLabel:"1-mavzu",
    title:"Mexanik harakat",
    youtubeId:"08NF0MZhokQ",
    testUrl:"test/test.html?id=1"
  },

  {
    number:2,
    numberLabel:"2-mavzu",
    title:"To‘g‘ri chiziqli tekis harakat",
    youtubeId:"9hnd43lUYpY",
    testUrl:"test/test.html?id=2"
  },

  {
    number:3,
    numberLabel:"3-mavzu",
    title:"To‘g‘ri chiziqli harakatni grafik ravishda tasvirlash",
    youtubeId:"YNNsp1MDDZs",
    testUrl:"test/test.html?id=3"
  },

  {
    number:4,
    numberLabel:"4-mavzu",
    title:"Tekis o‘zgaruvchan harakat. Tezlanish",
    youtubeId:"wqHM2sDHCnE",
    testUrl:"test/test.html?id=4"
  },

  {
    number:5,
    numberLabel:"5-mavzu",
    title:"Tekis o‘zgaruvchan harakatda ko‘chish",
    youtubeId:"y6BpNuLgMJo",
    testUrl:"test/test.html?id=5"
  },

  {
    number:6,
    numberLabel:"6-mavzu",
    title:"Tekis o‘zgaruvchan harakatni grafik ravishda tasvirlash",
    youtubeId:"OTbP8Te3A2s",
    testUrl:"test/test.html?id=6"
  },

  {
    number:7,
    numberLabel:"7-mavzu",
    title:"Nisbiy harakat",
    youtubeId:"qZyEkJVXL8o",
    testUrl:"test/test.html?id=7"
  },

  {
    number:8,
    numberLabel:"8-mavzu",
    title:"Egri chiziqli harakat",
    youtubeId:"7Tvz6IJGvd0",
    testUrl:"test/test.html?id=8"
  },

  {
    number:9,
    numberLabel:"9-mavzu",
    title:"Aylanma harakatni uzatish",
    youtubeId:"ueSnoH0wjV8",
    testUrl:"test/test.html?id=9"
  },

  {
    number:10,
    numberLabel:"10-mavzu",
    title:"Aylana bo‘ylab notekis harakat",
    youtubeId:"XPKT36VymyE",
    testUrl:"test/test.html?id=10"
  },

  {
    number:11,
    numberLabel:"11-mavzu",
    title:"Kuch. Nyutonning birinchi qonuni",
    youtubeId:"ijNFthEfTNI",
    testUrl:"test/test.html?id=11"
  },

  {
    number:12,
    numberLabel:"12-mavzu",
    title:"Nyutonning ikkinchi qonuni",
    youtubeId:"sguR_54X3xY",
    testUrl:"test/test.html?id=12"
  },

  {
    number:13,
    numberLabel:"13-mavzu",
    title:"Butun olam tortishish qonuni",
    youtubeId:"x6oBZB4sqAQ",
    testUrl:"test/test.html?id=13"
  },

  {
    number:14,
    numberLabel:"14-mavzu",
    title:"Elastiklik kuchi. Guk qonuni",
    youtubeId:"VONCCEX-FwI",
    testUrl:"test/test.html?id=14"
  },


  // ==================================================
  // 15-MAVZU
  // 15.1 — 15-MAVZUNING DAVOMI
  // IKKALASI HAM BIR VAQTDA OCHILADI
  // IKKALASI HAM 15-TESTDAN FOYDALANADI
  // ==================================================

  {
    number:15,
    numberLabel:"15-mavzu",
    title:"Vertikal harakat",
    youtubeId:"niSTvbnML14",
    testUrl:"test/test.html?id=15"
  },

  {
    number:15,
    numberLabel:"15.1-mavzu",
    title:"Masala yechishdagi qonuniyatlar",
    youtubeId:"-Tdxh9z63r0",
    testUrl:"test/test.html?id=15"
  },


  // ==================================================
  // 16-MAVZU
  // ENDI MUSTAQIL MAVZU VA MUSTAQIL TEST
  // ==================================================

  {
    number:16,
    numberLabel:"16-mavzu",
    title:"Burchak ostida otilgan jism",
    youtubeId:"GYI-g55nYIg",
    testUrl:"test/test.html?id=16"
  },


  {
    number:17,
    numberLabel:"17-mavzu",
    title:"Ishqalanish kuchlari",
    youtubeId:"lcvwoYL7wTE",
    testUrl:"test/test.html?id=17"
  },

  {
    number:18,
    numberLabel:"18-mavzu",
    title:"Bir nechta kuch ta’siri",
    youtubeId:"cc_KNfaNP2Q",
    testUrl:"test/test.html?id=18"
  },

  {
    number:19,
    numberLabel:"19-mavzu",
    title:"Muvozanat shartlari",
    youtubeId:"hIYNWyl6uNw",
    testUrl:"test/test.html?id=19"
  },

  {
    number:20,
    numberLabel:"20-mavzu",
    title:"Impulsning saqlanish qonuni",
    youtubeId:"GHO7Blk_YeA",
    testUrl:"test/test.html?id=20"
  },

  {
    number:21,
    numberLabel:"21-mavzu",
    title:"Mexanik ish va energiya",
    youtubeId:"NoC-7I8521g",
    testUrl:"test/test.html?id=21"
  },

  {
    number:22,
    numberLabel:"22-mavzu",
    title:"Prujina potensial energiyasi",
    youtubeId:"x8MfBrBGULg",
    testUrl:"test/test.html?id=22"
  },

  {
    number:23,
    numberLabel:"23-mavzu",
    title:"Quvvat va FIK",
    youtubeId:"VFxrUrrWqDM",
    testUrl:"test/test.html?id=23"
  },

  {
    number:24,
    numberLabel:"24-mavzu",
    title:"Bosim. Paskal qonuni",
    youtubeId:"zZC8Xlc68xY",
    testUrl:"test/test.html?id=24"
  },

  {
    number:25,
    numberLabel:"25-mavzu",
    title:"Gidrostatik bosim",
    youtubeId:"UmYG_rFTOQk",
    testUrl:"test/test.html?id=25"
  },

  {
    number:26,
    numberLabel:"26-mavzu",
    title:"Atmosfera bosimi",
    youtubeId:"Et5tKMzZQ0k",
    testUrl:"test/test.html?id=26"
  },

  {
    number:27,
    numberLabel:"27-mavzu",
    title:"Tutash idishlar",
    youtubeId:"JlR-tSyZ5ww",
    testUrl:"test/test.html?id=27"
  },

  {
    number:28,
    numberLabel:"28-mavzu",
    title:"Gidravlik press",
    youtubeId:"trMV-Jc_ESM",
    testUrl:"test/test.html?id=28"
  },

  {
    number:29,
    numberLabel:"29-mavzu",
    title:"Arximed kuchi",
    youtubeId:"CHyw0RFhS34",
    testUrl:"test/test.html?id=29"
  },

  {
    number:30,
    numberLabel:"30-mavzu",
    title:"Bernulli qonuni",
    youtubeId:"qlBn-e5HnOc",
    testUrl:"test/test.html?id=30"
  },

  {
    number:31,
    numberLabel:"31-mavzu",
    title:"Garmonik tebranishlar",
    youtubeId:"rFH_f9mS8n0",
    testUrl:"test/test.html?id=31"
  },

  {
    number:32,
    numberLabel:"32-mavzu",
    title:"Matematik mayatnik",
    youtubeId:"hAzxj4vg980",
    testUrl:"test/test.html?id=32"
  },

  {
    number:33,
    numberLabel:"33-mavzu",
    title:"Prujinali mayatnik",
    youtubeId:"AKNDZD2WH80",
    testUrl:"test/test.html?id=33"
  },

  {
    number:34,
    numberLabel:"34-mavzu",
    title:"To‘lqin uzunligi",
    youtubeId:"zSufU3WnQC0",
    testUrl:"test/test.html?id=34"
  }

],
  },
  {
    id: "molekulyar",
    title: "Molekulyar fizika",
    icon: "thermometer",
    description: "Gazlar, issiqlik hodisalari va termodinamika qonunlarini o‘rganing.",
    page: "umumiy-fizika/molekulyar.html",
    lessons: [
  { number:35, numberLabel:"35-mavzu", title:"Molekulyar kinetik nazariya (MKN) asosiy tushunchalari", youtubeId:"Uzxy_vxjoxQ", testUrl:"test/test.html?id=35" },
  { number:36, numberLabel:"36-mavzu", title:"Molekulalar massasi. Modda miqdori", youtubeId:"Uu1MXQ6-vqk", testUrl:"test/test.html?id=36" },
  { number:37, numberLabel:"37-mavzu", title:"Ideal gaz. Gaz MKN asosiy tenglamasi. Dalton qonuni", youtubeId:"fg77rgVSruQ", testUrl:"test/test.html?id=37" },
  { number:38, numberLabel:"38-mavzu", title:"Gaz molekulalarining o‘rtacha tezliklari", youtubeId:"KsmguXaGC2A", testUrl:"test/test.html?id=38" },
  { number:39, numberLabel:"39-mavzu", title:"Ideal gaz holat tenglamasi", youtubeId:"aPzwzNXabc4", testUrl:"test/test.html?id=39" },
  { number:40, numberLabel:"40-mavzu", title:"Izotermik jarayon", youtubeId:"E8Aw3i-2oTw", testUrl:"test/test.html?id=40" },
  { number:41, numberLabel:"41-mavzu", title:"Izobarik jarayon", youtubeId:"nwKyXqg-82g", testUrl:"test/test.html?id=41" },
  { number:42, numberLabel:"42-mavzu", title:"Izoxorik jarayon", youtubeId:"jHCMld8PHdo", testUrl:"test/test.html?id=42" },
  { number:43, numberLabel:"43-mavzu", title:"To‘yingan bug‘. Havoning namligi. Nisbiy namlik", youtubeId:"dYcEa0w7Jyw", testUrl:"test/test.html?id=43" },
  { number:44, numberLabel:"44-mavzu", title:"Kapillarlik hodisasi. Kapillar nay", youtubeId:"jqdVaY1zOZw", testUrl:"test/test.html?id=44" },
  { number:45, numberLabel:"45-mavzu", title:"Sirt taranglik koeffitsienti", youtubeId:"BktDruu23xI", testUrl:"test/test.html?id=45" },
  { number:46, numberLabel:"46-mavzu", title:"Ichki energiya", youtubeId:"Q0MpyhoXijU", testUrl:"test/test.html?id=46" },
  { number:47, numberLabel:"47-mavzu", title:"Termodinamikaning birinchi qonuni", youtubeId:"RPP6bz5DMW0", testUrl:"test/test.html?id=47" },
  { number:48, numberLabel:"48-mavzu", title:"Erkinlik darajalari", youtubeId:"2fsfCeA9RzU", testUrl:"test/test.html?id=48" },
  { number:49, numberLabel:"49-mavzu", title:"Adiabatik jarayon", youtubeId:"hMbGCJe1ie8", testUrl:"test/test.html?id=49" },
  { number:50, numberLabel:"50-mavzu", title:"Termodinamikaning ikkinchi qonuni. Issiqlik mashinalari", youtubeId:"SHLPKDcTxJY", testUrl:"test/test.html?id=50" }
],
  },
  {
    id: "elektr",
    title: "Elektr va magnetizm",
    icon: "magnet",
    description: "Elektr maydoni, tok, magnit maydon va elektromagnit hodisalar.",
    page: "umumiy-fizika/elektr.html",
    lessons: [
  { number:51, numberLabel:"51-mavzu", title:"Elektr zaryadlari. Kulon qonuni", youtubeId:"vHVFGkpv7wk", testUrl:"test/test.html?id=51" },
  { number:52, numberLabel:"52-mavzu", title:"Elektr maydon. Elektr maydon kuchlanganligi", youtubeId:"W2I2-5o3NxE", testUrl:"test/test.html?id=52" },
  { number:53, numberLabel:"53-mavzu", title:"Elektr maydon potensiali", youtubeId:"YzCggcCRFqE", testUrl:"test/test.html?id=53" },
  { number:54, numberLabel:"54-mavzu", title:"Ekvipotensial sirtlar", youtubeId:"DmOVezdv7Y8", testUrl:"test/test.html?id=54" },
  { number:55, numberLabel:"55-mavzu", title:"Elektr sig‘imi. Kondensatorlar", youtubeId:"F4yGFoiZ6qM", testUrl:"test/test.html?id=55" },
  { number:56, numberLabel:"56-mavzu", title:"Kondensatorlarni parallel va ketma-ket ulash", youtubeId:"b0fKT6wYRmM", testUrl:"test/test.html?id=56" },
  { number:57, numberLabel:"57-mavzu", title:"O‘zgarmas tok", youtubeId:"WA4HF1cF9QE", testUrl:"test/test.html?id=57" },
  { number:58, numberLabel:"58-mavzu", title:"Zanjirning bir qismi uchun Om qonuni", youtubeId:"_p11I4zN5L8", testUrl:"test/test.html?id=58" },
  { number:59, numberLabel:"59-mavzu", title:"O‘zgarmas tok manbalari. Elektr yurituvchi kuch", youtubeId:"UiuFDcP_PDo", testUrl:"test/test.html?id=59" },
  { number:60, numberLabel:"60-mavzu", title:"Elektr qarshiliklar", youtubeId:"660RtObdXSg", testUrl:"test/test.html?id=60" },
  { number:61, numberLabel:"61-mavzu", title:"O‘tkazgichlarni ketma-ket va parallel ulash", youtubeId:"x5vMpgdhb_8", testUrl:"test/test.html?id=61" },
  { number:62, numberLabel:"62-mavzu", title:"Shunt ulash", youtubeId:"SKJpto7Rsuw", testUrl:"test/test.html?id=62" },
  { number:63, numberLabel:"63-mavzu", title:"Tok manbaining ishi va quvvati", youtubeId:"bsF5HWgax54", testUrl:"test/test.html?id=63" },
  { number:64, numberLabel:"64-mavzu", title:"Magnit maydon. Tokning magnit maydoni", youtubeId:"1ttmSBLuZWY", testUrl:"test/test.html?id=64" },
  { number:65, numberLabel:"65-mavzu", title:"Magnit maydonining tokli o‘tkazgichga ta'siri. Amper qonuni", youtubeId:"tmMfbIjg0-Q", testUrl:"test/test.html?id=65" },
  { number:66, numberLabel:"66-mavzu", title:"Lorens kuchi", youtubeId:"ucnOWVezc2M", testUrl:"test/test.html?id=66" },
  { number:67, numberLabel:"67-mavzu", title:"Muhitda magnit maydon. Magnitiklar", youtubeId:"mD90_ZyvnBU", testUrl:"test/test.html?id=67" },
  { number:68, numberLabel:"68-mavzu", title:"Elektromagnit induksiya qonuni. Lens qoidasi", youtubeId:"dgTxQgGKDyU", testUrl:"test/test.html?id=68" },
  { number:69, numberLabel:"69-mavzu", title:"O‘zinduksiya hodisasi. Induktivlik", youtubeId:"tp-06SNnl1A", testUrl:"test/test.html?id=69" },
  { number:70, numberLabel:"70-mavzu", title:"Elektromagnit tebranishlar", youtubeId:"JbypCg3Cbek", testUrl:"test/test.html?id=70" },
  { number:71, numberLabel:"71-mavzu", title:"O‘zgaruvchan tok zanjirida tok kuchi, kuchlanish va qarshilik", youtubeId:"8yZ-OxU1xp0", testUrl:"test/test.html?id=71" },
  { number:72, numberLabel:"72-mavzu", title:"Transformator", youtubeId:"wpy0bfScXqU", testUrl:"test/test.html?id=72" }
],
  },
  {
    id: "optika",
    title: "Optika",
    icon: "prism",
    description: "Yorug‘lik, linzalar, interferensiya va optik hodisalarni o‘rganing.",
    page: "umumiy-fizika/optika.html",
    lessons: [
  { number:73, numberLabel:"73-mavzu", title:"Optika. Geometrik optika. Yorug‘likning qaytishi va sinishi", youtubeId:"1M1ufnU7YIw", testUrl:"test/test.html?id=73" },
  { number:74, numberLabel:"74-mavzu", title:"To‘la ichki qaytish", youtubeId:"lrSz_qg4unk", testUrl:"test/test.html?id=74" },
  { number:75, numberLabel:"75-mavzu", title:"Yassi va sferik ko‘zgularda tasvir yasash", youtubeId:"TQkvjQzkU5U", testUrl:"test/test.html?id=75" },
  { number:76, numberLabel:"76-mavzu", title:"Linzalar", youtubeId:"n8y-plWReO4", testUrl:"test/test.html?id=76" },
  { number:77, numberLabel:"77-mavzu", title:"Linzalarda tasvir yasash", youtubeId:"uYwxILQnJLc", testUrl:"test/test.html?id=77" },
  { number:78, numberLabel:"78-mavzu", title:"Yorug‘lik interferensiyasi", youtubeId:"kvwTPsbYS_c", testUrl:"test/test.html?id=78" },
  { number:79, numberLabel:"79-mavzu", title:"Yorug‘lik difraksiyasi", youtubeId:"Bw8hz5rmofI", testUrl:"test/test.html?id=79" },
  { number:80, numberLabel:"80-mavzu", title:"Yorug‘lik dispersiyasi", youtubeId:"sEulp53C7pM", testUrl:"test/test.html?id=80" },
  { number:81, numberLabel:"81-mavzu", title:"Fotometriya elementlari", youtubeId:"YuqI7FJ37Ow", testUrl:"test/test.html?id=81" },
  
],
  },
  {
    id: "atom",
    title: "Atom va yadro fizikasi",
    icon: "atom",
    description: "Atom tuzilishi, radioaktivlik va yadro reaksiyalarini o‘rganing.",
    page: "umumiy-fizika/atom.html",
    lessons: [
  { number:82, numberLabel:"82-mavzu", title:"Atom va yadro fizikasi", youtubeId:"oNJ6VLNHZMc", testUrl:"test/test.html?id=82" }
],
  }
];

export function getCourse(id) {
  return COURSES.find((course) => course.id === id);
}
