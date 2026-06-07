const questions = [
{
    question: "O'qituvchining nizoli (konfiktlar) pedagogik ziddiyatlardan janjalsiz chiqishni fikran izlanish asosida bartaraf qilishini nima ta'minlaydi?",
    answers: [
        "Muloqotning perseptiv tomoni",
        "Muloqotning kommunikativ tomoni",
        "Muloqotning interaktiv tomoni",
        "Muloqotning tashkiliy tomoni"
    ],
    correct: 1
},
{
    question: "O'zaro fikr almashish omillari bilan bevosita bog'liq bo'lgan kommunikativ qobiliyatning qanday yo'nalishlari mavjud?",
    answers: [
        "O'quvchilarni ishontirish; o'quvchilar ongiga ta'sir etish; o'zgalarga taqlid qilish",
        "O'quvchilarni moslashish; jismoniy ta'sir etish; o'zgalarga taqlid qilish",
        "O'quvchilarni ishontirish va moslashish; jismoniy ta'sir etish",
        "O'quvchilar ongi va jismiga ta'sir etish; o'zgalarga taqlid qilish"
    ],
    correct: 0
},
{
    question: "Ta'lim va tarbiya jarayonida o'qituvchi tomonidan pedagogik ta'sir ko'rsatishning asosiy usullari qaysilar?",
    answers: [
        "Taklif, istiqbol, rag'batlantirish va jazolash",
        "Talab, istiqbol, rag'batlantirish va jazolash, jamoatchilik fikri",
        "Talab, taklif, istiqbol, rag'batlantirish va jazolash, jamoatchilik fikri",
        "Talab, istiqbol, rag'batlantirish va jamoatchilik fikri"
    ],
    correct: 1
},
{
    question: "So'z bilan og'zaki ta'sir qilishda o'qituvchi nutqi qanday bo'lishi maqsadga muvofiq?",
    answers: [
        "Nihoyatda muxtasar, ravon, va muloyim bo'lishi, intonatsiyalar o'z o'rnida ishlatilishi kerak",
        "Nihoyatda qisqa, ravon, va muloyim bo'lishi kerak",
        "Tushunarli va intonatsiyalar o'z o'rnida ishlatilishi kerak",
        "Nihoyatda muxtasar va faqat jazolash uchun intonatsiyadan foydalanish"
    ],
    correct: 0
},
{
    question: "Rejalashtirilayotgan darsning shakl va usullari nimalarga mos kelishi lozim?",
    answers: [
        "Darsning maqsadlari, o'quvchilarning yosh xususiyatlari va o'zlashtirishiga mos kelishi lozim",
        "O'quvchilarning jamoaviy va loyiha ishlarini tashkil etish va nazorat qilishga mos kelishi lozim",
        "Turli xil ta'limiy ehtiyojlar, shuningdek iqtidorli o'quvchilar bilan ishlash tamoyillariga mos kelishi lozim",
        "Bolalar bilan muloqot qilish, ularning qadr-qimmatini tan olish tamoyillariga mos kelishi lozim"
    ],
    correct: 0
},
{
    question: "Qaysi holatlarda namunaviy o'quv rejalariga o'zgartirish kiritish mumkin?",
    answers: [
        "O'quvchilarning ehtiyojlari va qiziqishlaridan kelib chiqqan holda",
        "Yuqori tashkilot va maktab ma'muriyati buyrug'iga asosan",
        "Maktab ma'muriyati va metodik birlashma takliflariga ko'ra",
        "Ota-onalar va o'quvchilarning ehtiyoji va talablariga binoan"
    ],
    correct: 0
},
{
    question: "O'qituvchi dars davomida aksariyat o'quvchilarni tingladi. Noto'g'ri fikrlarni rad etmasdan, yo'naltiruvchi savollar bilan yangi mavzuni tushuntirishga harakat qildi. Usuldan maqsad nima?",
    answers: [
        "Jamoaviy va loyihaviy ishlarni samarali tashkil etish",
        "Yoshga doir pedagogika va psixologiya metodlarini to'g'ri qo'llash",
        "Dars davomida har bir o'quvchiga o'z g'oyalari va qarashlarini ifoda etish imkoniyatini berish",
        "O'quvchilar bilimini baholashning differensial yondashuvini ta'minlash"
    ],
    correct: 2
},
{
    question: "O'quvchi loyiha ustida ishladi. O'qituvchi tomonidan loyiha taqdimotiga to'g'ri bildirilgan fikr variantlarini toping.",
    answers: [
        "1 va 4",
        "2 va 3",
        "1 va 3",
        "2 va 4"
    ],
    correct: 2
},
{
    question: "Mezonlarga asoslangan baholash tizimi qaysi muammolarni hal qiladi? (1. obyektiv va shaffof tizim orqali sifatni oshirish; 2. xalqaro standartlarga javob beradigan mexanizm; 4. natijalarni tahlil qilishga yordam beradi)",
    answers: [
        "1, 2, 4",
        "2, 3, 4",
        "1, 2, 3",
        "1, 3, 4"
    ],
    correct: 0
},
{
    question: "O'qitish usullari va xususiyatlarini moslashtiring: 1. Izohli-ko'rgazmali; 2. Reproduktiv; 3. Muammoli; 4. Tadqiqot.",
    answers: [
        "1-V, 2-B, 3-D, 4-G",
        "1-B, 2-A, 3-G, 4-V",
        "1-D, 2-G, 3-A, 4-B",
        "1-G, 2-A, 3-G, 4-V"
    ],
    correct: 1
},
{
    question: "Quyidagilardan ekologik loyiha turiga kiradigan variantlarni belgilang: (1. Chiqindilarni saralab yig'ish; 2. Shamol generatorini yaratish)",
    answers: [
        "2, 4",
        "2, 3",
        "1, 4",
        "1, 2"
    ],
    correct: 3
},
{
    question: "Maktabda ta'lim sifatini monitoring qilish vazifalarini belgilang: (1. Ma'lumotlarni to'plash; 2. Nazorat qilish; 3. Rag'batlantirish; 5. Tavsiyalar ishlab chiqish)",
    answers: [
        "2, 3, 4, 5",
        "1, 2, 5",
        "2, 4, 5",
        "1, 2, 3, 5"
    ],
    correct: 3
},
{
    question: "O'qituvchi o'quvchining mustaqil faoliyatlari darajasini oshirish uchun o'qitish usullari ketma-ketligini qanday tanlashi lozim?",
    answers: [
        "2, 1, 4, 3",
        "3, 1, 2, 4",
        "2, 1, 3, 4",
        "1, 4, 2, 3"
    ],
    correct: 2
},
{
    question: "O'qituvchi o'quvchining ijodkorligini rivojlantirish uchun qanday ta'lim turidan foydalandi (shaxsiy fikr bilan boyitishni so'radi)?",
    answers: [
        "Darsdan tashqari ta'lim turi",
        "Ijtimoiy ta'lim turi",
        "Muammoli ta'lim turi",
        "Shaxsga yo'naltirilgan ta'lim"
    ],
    correct: 3
},
{
    question: "O'qituvchi yangi mavzuga oid faktlar va mulohazalarni keltirib savollar berdi. Bunda qanday ko'nikma shakllantiriladi?",
    answers: [
        "Qo'llash",
        "Bilish",
        "Mulohaza",
        "Tahlil"
    ],
    correct: 1
},
{
    question: "O'quvchi o'z faoliyatini rejalashtirdi. Bu qobiliyat qaysi faoliyat turiga kiradi?",
    answers: [
        "Konstruktiv",
        "Kognitiv",
        "Kommunikativ",
        "Regulyativ"
    ],
    correct: 3
},
{
    question: "“Bularning bizga nima keragi bor?” savolida o'qituvchi qaysi tarkibiy qismlarni amalga oshirmagan? (1. Maqsad; 2. Mazmun)",
    answers: [
        "2, 4",
        "1, 4",
        "1, 2",
        "2, 3"
    ],
    correct: 2
},
{
    question: "O'qituvchi mualliflik dasturi ustida ishladi. Bu qaysi faoliyat turiga kiradi?",
    answers: [
        "Ijtimoiy faoliyat",
        "Qo'shimcha faoliyat",
        "Innovatsion faoliyat",
        "Ishdan tashqari faoliyat"
    ],
    correct: 2
},
{
    question: "Tayyor bilimlarni taqdim etib, so'ng mustahkamlovchi jarayon qaysi ta'lim turiga taalluqli?",
    answers: [
        "Tabaqalashtirilgan ta'lim",
        "Shaxsga yo'naltirilgan ta'lim",
        "Reproduktiv ta'lim",
        "Muammoli ta'lim turi"
    ],
    correct: 2
},
{
    question: "Tanaffusdagi tortishuvni yumshatish uchun o'qituvchi qanday yo'l tutgani ma'qul?",
    answers: [
        "Har bir o'quvchiga alohida “muhim” rol berish",
        "Xulqi yomonligi sababli chetlatish",
        "She'riy musobaqa o'tkazish",
        "Birinchi o'quvchining qobiliyatini asoslab berish"
    ],
    correct: 0
}
];