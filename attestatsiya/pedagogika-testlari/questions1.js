const questions = [
{
    question: "Nima uchun o'quvchilarning yutuqlarini baholash va bahoni asoslab berish juda muhim?",
    answers: [
        "Sinf kesimida nisbiy baholash va o'quvchilarga individual ta'lim ehtiyojlaridan kelib chiqib, o'z vaqtida yordam berish",
        "Maqsadga qay darajada erishganligini ko'rsatish, o'qishni davom ettirishga qiziqtirish, motivatsiya berish",
        "O'quvchilarga o'zlarining asoslangan va mas'uliyatli qarorlarini qabul qilishga yordam berish",
        "O'quvchilar erkin rivojlanishlari va o'zlarini namoyon eta olishlari uchun o'zaro hurmat muhitini yaratish"
    ],
    correct: 2
},
{
    question: "Darsni boshlashdan avval o'qituvchi har bir o'quvchining darsdan tashqari vaqtda nima bilan shug'ullanishi haqida so'radi. O'qituvchi ta'lim samaradorligini ta'minlash maqsadida qanday usuldan foydalandi?",
    answers: [
        "O'quvchilarni darsga qiziqtirish va ularni faollashtirishda turli usul va texnologiyalardan foydalandi",
        "O'quvchilar darsda faol qatnashishlarini motivatsiyalashda ularning shaxsiy qiziqishlaridan foydalandi",
        "Motivatsion vaziyatlarni yaratish, ularning samaradorligini tahlil qilish texnologiyasidan foydalandi",
        "Dars vaqtini oqilona boshqarish va o'quvchilar ishini ongli ravishda tashkil etish texnologiyasidan foydalandi"
    ],
    correct: 1
},
{
    question: "“Dars vaqtini oqilona tashkillashtirish, darsning maqsad, shakl va usullarini aniqlash” o'qituvchilar kasbiy kompetensiyasining qaysi mehnat vazifasidagi ko'nikmalariga kiradi?",
    answers: [
        "Ta'lim samaradorligini ta'minlash",
        "O'z-o'zini rivojlantirish va kasbiy o'sish",
        "O'quv va tarbiyaviy faoliyatni tashkil etish",
        "O'quv jarayonini rejalashtirish"
    ],
    correct: 3
},
{
    question: "Darslarda mavzuga mos keladigan ko'rgazmali va tarqatma materiallardan qanday maqsadda foydalaniladi?",
    answers: [
        "Ta'lim samaradorligini ta'minlash uchun",
        "O'z-o'zini rivojlantirish va kasbiy o'sish uchun",
        "To'g'ri baholash va qayta aloqani o'rnatish uchun",
        "Differensial yondashuvni ta'minlash uchun"
    ],
    correct: 0
},
{
    question: "Ta'lim - bu....",
    answers: [
        "Ta'lim jarayonining yakuniy natijalariga erishish yo'llari",
        "Belgilangan maqsadga erishish yo'lida o'qituvchi va o'quvchining o'zaro hamkorligi",
        "Ta'lim jarayonida o'zlashtirilgan bilim, ko'nikma, malaka va fikrlash usullari tizimi",
        "Ta'lim maqsadi va vazifalariga erishish yo'lidagi faoliyat turlari"
    ],
    correct: 2
},
{
    question: "Oliy toifali o'qituvchi - kamida 8 yillik ish tajribasi talab qilishi qanday talab hisoblanadi?",
    answers: [
        "Ta'lim va o'qitishga qo'yiladigan talab",
        "Faoliyatni amalga oshirishga ruxsat berish uchun maxsus talab",
        "Pedagogik faoliyatga qo'yiladigan talab",
        "Amaliy ish tajribasiga qo'yiladigan talab"
    ],
    correct: 3
},
{
    question: "“Inson kapitalini rivojlantirish, o'qitish va tarbiyalashning klassik va zamonaviy nazariyalari hamda shaxslar-aro va ijtimoiy aloqa jarayonlarini” quyidagilarning qay biriga mansub?",
    answers: [
        "O'zlashtirishni baholash va qayta aloqani taqdim etish",
        "Tarbiyaviy faoliyatni tashkil etish",
        "Xavfsiz rivojlantiruvchi ta'lim muhitini yaratish va ta'minlash",
        "O'z-o'zini rivojlantirish va kasbiy o'sish"
    ],
    correct: 3
},
{
    question: "Quyidagilarning qaysi biri “O'quv jarayonini rejalashtirish”dagi zaruriy bilim?",
    answers: [
        "Zamonaviy axborot texnologiyalarini fanga singdirish",
        "Fanni o'qitishning turli usullari",
        "DTS va o'quv dasturlarining maqsadlariga muvofiq o'quv rejalarini ishlab chiqish",
        "Dars vaqtini oqilona rejalashtirish, darsning maqsad, shakl va usullarni aniqlash"
    ],
    correct: 2
},
{
    question: "Quyidagilarning qaysi biri “O'quv jarayonini rejalashtirish”dagi mehnat harakati?",
    answers: [
        "Ta'limning aniq va o'lchanadigan natijalarini, shuningdek vazifalarni aniqlash va ularni rejalarda shakllantirish",
        "Tegishli o'quv, namoyish va tarqatma materiallardan foydalanishni rejalashtirish",
        "O'quvchilarning bilimini baholash natijasida olingan ma'lumotlarni inobatga olgan holda rejalarni muvofiqlashtirish",
        "Ta'lim maqsadlariga erishish uchun har xil turdagi rejalarni tayyorlashning tuzilishi va tamoyillari"
    ],
    correct: 0
},
{
    question: "Pedagogik mahorat tushunchasiga berilgan eng to'g'ri ta'rifni aniqlang.",
    answers: [
        "O'qituvchilarning shaxsiy fazilatlarini belgilovchi xususiyat...",
        "O'qituvchilarning shaxsiy va kasbiy fazilatlarini belgilovchi xususiyat bo'lib, ta'lim-tarbiyaviy faoliyatda yuqori darajaga erishishni ta'minlovchi faoliyatdir",
        "O'qituvchilarning kasbiy fazilatlarini belgilovchi xususiyat...",
        "Umumiy fazilatlarini belgilovchi, kasbiy mahoratini takomillashtirib borish imkoniyatini ta'minlovchi faoliyatdir"
    ],
    correct: 1
},
{
    question: "Pedagogik mahoratning asosini tashkil etuvchi komponentlarni aniqlang.",
    answers: [
        "Pedagogik texnikani o'z o'rnida qo'llay bilishi; pedagogik qobiliyatlarini namoyish eta olishi",
        "Pedagogik texnikani o'z o'rnida qo'llay bilishi; o'z fanining o'qitish metodikasini mukammal bilishi",
        "O'z fanining o'qitish metodikasini mukammal bilishi; pedagogik texnikani o'z o'rnida qo'llay bilishi; pedagogik qobiliyatlarini namoyish eta olishi",
        "O'qituvchilik kasbiga sadoqat; o'z fanining o'qitish metodikasini mukammal bilishi; pedagogik qobiliyatlarini namoyish eta olishi; pedagogik texnikani qo'llash"
    ],
    correct: 3
},
{
    question: "O'qituvchilarning kasbiy pedagogik tayyorgarligi shartli ravishda qanday yo'nalishlarda olib boriladi?",
    answers: [
        "Shaxsiy fazilatlar bo'yicha va maxsus uslubiy bilimlar",
        "Shaxsiy, ruhiy psixologik, ijtimoiy va nazariy jihatdan tayyorgarlik",
        "Shaxsiy fazilatlar, ruhiy psixologik, ijtimoiy-pedagogik va ilmiy-nazariy, maxsus uslubiy bilimlarni egallash",
        "Faqat ruhiy-psixologik va ilmiy-nazariy jihatdan tayyorgarlik"
    ],
    correct: 2
},
{
    question: "Qobiliyat - bu...",
    answers: [
        "Shaxsning individual-psixologik xususiyati bo'lib, muayyan faoliyat yuzasidan layoqati va ishni muvaffaqiyatli amalga oshirish subyektiv shart-sharoitini ifodalovchi individual psixik sifatlar yig'indisidir",
        "Shaxsning individual-psixologik xususiyati bo'lib, obyektiv shart-sharoitini ifodalovchi sifatlar yig'indisidir",
        "Muayyan faoliyat yuzasidan layoqati va umumiy pedagogik sifatlar yig'indisidir",
        "Obyektiv shart-sharoitini ifodalovchi individual pedagogik sifatlar yig'indisidir"
    ],
    correct: 0
},
{
    question: "Intrapersonal (shaxs ichi) intellekt sohiblariga xos xususiyatni aniqlang.",
    answers: [
        "Falsafiy mulohazalar yuritishni, raqamlarni, matematikani, murakkab masalalarni hal qilishni sevadi",
        "O'z-o'zini mukammal bilishi, tushunishi va his qilishi, irodasi mustahkam, har qanday vaziyatda o'z fikrini erkin bayon eta olishi",
        "O'qituvchining o'z xatti harakatlarini muvofiqlashtirish qobiliyati, harakat ohangini his qilgan holda yo'naltiradi",
        "Musiqani sevishadi, ohangni yaxshi his qilishadi, eshitgan narsasini xotirada saqlaydi"
    ],
    correct: 1
},
{
    question: "Pedagogik mahoratning elementlari nimalardan iborat?",
    answers: [
        "Ilm olish; fikrlash tezligi; malakani shakllantirish",
        "Bilim, ko'nikma, malaka",
        "Ijod; fikrlash tezligi; mahorat",
        "Ijod; fikrlash tezligi; ko'nikmaga ega bo'lish"
    ],
    correct: 2
},
{
    question: "O'quvchilar bilan muloqot qilish madaniyatining individual shaxsiy xususiyatlari berilgan qatorni aniqlang.",
    answers: [
        "O'quvchilar shaxsiy xususiyatlarini mustaqil tahlil qilish; ichki imkoniyatlariga tavsif berish; muloqot madaniyatini to'g'ri tashkil etishi",
        "Kamchiliklarga barham berish choralarini izlab topish; qo'pollik qilmaslik; salbiy holatlarni bartaraf etish",
        "Pedagogik faoliyatiga monand muloqot madaniyati modelini ishlab chiqishi; o'z-o'zini kuzatish; muloqotda milliy ma'naviyatimizdan foydalanish",
        "Individual xususiyatlariga mos muloqot tizimini ishlab chiqishi; muloqotning tarbiyaviy ta'sirini e'tirof etish"
    ],
    correct: 0
},
{
    question: "“Til shirinligi – ko'ngilga yoqimlidir, muloyimligi esa foydali. Shirin so'z sof ko'ngillar uchun asal kabi totlidir” hikmati muallifi kim?",
    answers: [
        "Rolf Emerson",
        "Alisher Navoiy",
        "A.P.Chexov",
        "Amir Temur"
    ],
    correct: 1
},
{
    question: "Pedagogik muloqot - bu...",
    answers: [
        "O'qituvchining o'quvchilar bilan darsda va darsdan tashqari faoliyatda eng qulay psixologik muhitni vujudga keltiruvchi kasbiy munosabatidir",
        "O'qituvchilarning shaxsiy va kasbiy fazilatlarini belgilovchi xususiyatdir",
        "Muayyan faoliyat yuzasidan layoqatni ifodalovchi individual psixik sifatlar yig'indisidir",
        "Shaxsning obyektiv shart-sharoitini ifodalovchi individual psixik sifatlar yig'indisidir"
    ],
    correct: 0
},
{
    question: "«Refleksiya» so'zining ma'nosi va kelib chiqishi qaysi javobda to'g'ri ko'rsatilgan?",
    answers: [
        "Lotin tildan olingan bo'lib «reflexio» — orqaga qaytish ma'nosini ifodalaydi",
        "Lotin tildan olingan bo'lib «reflexio» — qayta tiklashish ma'nosini ifodalaydi",
        "Yunon tildan olingan bo'lib «reflexio» — qayta takrorlash ma'nosini ifodalaydi",
        "Yunon tildan olingan bo'lib «reflexio» — orqaga qaytish ma'nosini ifodalaydi"
    ],
    correct: 0
},
{
    question: "Insonning uzluksiz hayot jarayonini go'yo bir daqiqaga to'xtatib, uzib qo'yadigan va falsafiy fikr-mulohazalari muayyan bir xarakter kasb etadigan holat nima?",
    answers: [
        "Kasbiy munosabat",
        "Refleksiya",
        "Layoqat",
        "Pedagogik mahorat"
    ],
    correct: 1
}
];
