let quizData;

let current = 0;
let score = 0;
let wrong = 0;
let timeout = 0;

let timer;
let timeLeft = 15;

const question =
document.getElementById("question");

const answers =
document.getElementById("answers");

const nextBtn =
document.getElementById("nextBtn");

const quizTitle =
document.getElementById("quizTitle");

async function initQuiz(){

try{

const response =
await fetch(window.quizDataFile);

quizData =
await response.json();

quizTitle.innerHTML =
"🚀 " + quizData.title;

shuffleArray(
quizData.questions
);

loadQuestion();

}catch(error){

document.body.innerHTML = `
<div style="
text-align:center;
padding:50px;
color:white;
font-size:24px;
">
❌ Quiz ma'lumotlarini yuklab bo'lmadi
</div>
`;

console.error(error);

}

}

function shuffleArray(array){

for(
let i=array.length-1;
i>0;
i--
){

const j =
Math.floor(
Math.random()*(i+1)
);

[array[i],array[j]] =
[array[j],array[i]];

}

return array;

}

function loadQuestion(){

clearInterval(timer);

timeLeft = 15;

document.getElementById("timer")
.innerHTML =
"⏱ " + timeLeft;

const q =
quizData.questions[current];

question.innerHTML =
(current+1)+". "+q.q;

answers.innerHTML = "";

let shuffledAnswers =
q.a.map(
(answer,index)=>({

text:answer,

correct:index===q.c

})
);

shuffleArray(
shuffledAnswers
);

shuffledAnswers.forEach(item=>{

const div =
document.createElement("div");

div.className =
"answer";

div.innerHTML =
item.text;

div.onclick = ()=>{

selectAnswer(
item.correct,
div
);

};

answers.appendChild(div);

});

document.getElementById(
"progressBar"
).style.width =

(current/
quizData.questions.length)
*100 + "%";

startTimer();

}

function startTimer(){

timer =
setInterval(()=>{

timeLeft--;

document.getElementById(
"timer"
).innerHTML =
"⏱ " + timeLeft;

if(timeLeft<=0){

clearInterval(timer);

timeout++;

nextQuestion();

}

},1000);

}

function selectAnswer(

isCorrect,

selectedBtn

){

clearInterval(timer);

const all =
document.querySelectorAll(
".answer"
);

all.forEach(btn=>{

btn.style.pointerEvents =
"none";

});

if(isCorrect){

selectedBtn.classList.add(
"correct"
);

score++;

}else{

selectedBtn.classList.add(
"wrong"
);

wrong++;

const q =
quizData.questions[current];

all.forEach(btn=>{

if(
btn.innerText ===
q.a[q.c]
){

btn.classList.add(
"correct"
);

}

});

}

nextBtn.style.display =
"block";

}

nextBtn.onclick = ()=>{

nextQuestion();

};

function nextQuestion(){

current++;

if(
current <
quizData.questions.length
){

nextBtn.style.display =
"none";

loadQuestion();

}else{

showResult();

}

}

function showResult(){

clearInterval(timer);

document.getElementById(
"quizArea"
).style.display =
"none";

document.getElementById(
"timer"
).style.display =
"none";

document.getElementById(
"result"
).style.display =
"block";

const percent =

(score /
quizData.questions.length)
*100;

document.getElementById(
"resultText"
).innerHTML =

`
✅ To'g'ri: ${score}<br>
❌ Noto'g'ri: ${wrong}<br>
⏱ Vaqti tugagan: ${timeout}<br>
📊 Natija: ${percent.toFixed(0)}%
`;

document.getElementById(
"progressBar"
).style.width =
"100%";

}

initQuiz();