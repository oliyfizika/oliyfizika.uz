const questions = [
{
q:"To'g'ri chiziqli tekis harakatda jismning tezligi qanday bo'ladi?",
a:["O'zgaradi","Doimiy","Nol","Ortadi"],
c:1
},

{
q:"Tekis harakatda tezlanish nechiga teng?",
a:["10","5","0","1"],
c:2
},

{
q:"Tekis harakatda ko'chish formulasi?",
a:["S=vt","S=at²","S=v²/2a","S=gt²"],
c:0
},

{
q:"Tekis harakatda ko'chish s(t) grafigi qanday bo'ladi?",
a:["Parabola","To'g'ri chiziq","Aylana","Giperbola"],
c:1
},

{
q:"Tezlik birligi qanday?",
a:["kg","N","m","m/s"],
c:3
},

{
q:"5 m/s tezlik bilan 10 s harakat qilgan jism qancha yo'l bosadi?",
a:["50 m","10 m","15 m","100 m"],
c:0
},

{
q:"Tekis harakat traektoriyasi?",
a:["Aylana","Parabola","To'g'ri chiziq","Egri"],
c:2
},

{
q:"v-t grafikida tekis harakat?",
a:["Gorizontal chiziq","Parabola","Vertikal","Sinus"],
c:0
},

{
q:"Tekis harakatning asosiy belgisi?",
a:["Tezlik doimiy","Tezlik ortadi","Tezlanish katta","Kuch ortadi"],
c:0
},

{
q:"Agar tezlik o'zgarmasdan jismning harakat vaqti 2 marta ortsa, ko'chish qanday o'zgaradi?",
a:["4 marta","2 marta","O'zgarmaydi","Kamayadi"],
c:1
}
];

let timeLeft = 10;
let timer;

let currentQuestion = 0;
let position = 0;

let score1 = 0;
let score2 = 0;

let answered = false;

const questionEl = document.getElementById("question");
const questionEl2 = document.getElementById("question2");
const p1 = document.getElementById("player1-options");
const p2 = document.getElementById("player2-options");

function shuffleArray(array){


for(let i=array.length-1;i>0;i--){

    const j =
    Math.floor(Math.random()*(i+1));

    [array[i],array[j]] =
    [array[j],array[i]];
}


}

shuffleArray(questions);

function loadQuestion(){


answered = false;

startTimer();

const q =
questions[currentQuestion % questions.length];

questionEl.textContent = q.q;
questionEl2.textContent = q.q;
p1.innerHTML = "";
p2.innerHTML = "";

const options = [...q.a];

const correctAnswer = options[q.c];

shuffleArray(options);

const newCorrectIndex =
options.indexOf(correctAnswer);

q.currentAnswer = newCorrectIndex;

options.forEach((option,index)=>{

    const btn1 =
    document.createElement("button");

    btn1.className = "answer-btn";

    btn1.textContent = option;

    btn1.onclick =
    () => answer(1,index);

    const btn2 =
    document.createElement("button");

    btn2.className = "answer-btn";

    btn2.textContent = option;

    btn2.onclick =
    () => answer(2,index);

    p1.appendChild(btn1);
    p2.appendChild(btn2);

});


}

function answer(player,index){


if(answered) return;

const q =
questions[currentQuestion % questions.length];

if(index !== q.currentAnswer){

    return;
}

answered = true;

clearInterval(timer);

if(player === 1){

    score1++;

    position--;

}else{

    score2++;

    position++;

}

document.getElementById("score1")
    .textContent = score1;

document.getElementById("score2")
    .textContent = score2;

moveTeams();

if(position <= -5){

    finish("🏆 Birinchi jamoa g'olib!");

    return;
}

if(position >= 5){

    finish("🏆 Ikkinchi jamoa g'olib!");

    return;
}

setTimeout(()=>{

    currentQuestion++;

    loadQuestion();

},700);


}

function moveTeams(){


const tug =
document.getElementById("tugContainer");

if(!tug) return;

tug.style.transform =
`translateX(${position * 30}px)`;


}

function finish(text){


document.getElementById("winner")
    .textContent = text;

p1.innerHTML = "";
p2.innerHTML = "";


}

function startTimer(){

    clearInterval(timer);

    timeLeft = 10;

    document.getElementById("timer")
        .textContent = `⏱ ${timeLeft}`;

    timer = setInterval(()=>{

        timeLeft--;

        document.getElementById("timer")
            .textContent = `⏱ ${timeLeft}`;

        if(timeLeft <= 0){

            clearInterval(timer);

            answered = true;

            currentQuestion++;

            loadQuestion();
        }

    },1000);
}

loadQuestion();
