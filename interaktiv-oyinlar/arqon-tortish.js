const questions = [
{
    question:"Kuch formulasi qaysi?",
    options:["v=s/t","p=mv","F=ma","A=Fs"],
    answer:2
},
{
    question:"Tezlik formulasi qaysi?",
    options:["ρ=m/V","v=s/t","A=Fs","p=mv"],
    answer:1
},
{
    question:"Bosim formulasi qaysi?",
    options:["p=F/S","F=ma","v=s/t","N=A/t"],
    answer:0
},
{
    question:"Ohm qonuni qaysi?",
    options:["I=U/R","F=ma","p=mv","A=Fs"],
    answer:0
},
{
    question:"Impuls formulasi qaysi?",
    options:["F=ma","p=mv","I=U/R","ρ=m/V"],
    answer:1
}
];

let currentQuestion = 0;
let position = 0;

let score1 = 0;
let score2 = 0;

const questionEl = document.getElementById("question");
const p1 = document.getElementById("player1-options");
const p2 = document.getElementById("player2-options");

const flag = document.getElementById("flag");

function loadQuestion(){

    const q = questions[currentQuestion % questions.length];

    questionEl.textContent = q.question;

    p1.innerHTML = "";
    p2.innerHTML = "";

    q.options.forEach((option,index)=>{

        const btn1 = document.createElement("button");
        btn1.textContent = option;
        btn1.onclick = () => answer(1,index);

        const btn2 = document.createElement("button");
        btn2.textContent = option;
        btn2.onclick = () => answer(2,index);

        p1.appendChild(btn1);
        p2.appendChild(btn2);
    });

}

function answer(player,index){

    const q = questions[currentQuestion % questions.length];

    if(index !== q.answer){
        return;
    }

    if(player === 1){
        score1++;
        position--;
    }else{
        score2++;
        position++;
    }

    document.getElementById("score1").textContent = score1;
    document.getElementById("score2").textContent = score2;

    updateFlag();

    if(position <= -7){
        finish("🏆 O'quvchi 1 g'olib!");
        return;
    }

    if(position >= 7){
        finish("🏆 O'quvchi 2 g'olib!");
        return;
    }

    currentQuestion++;

    loadQuestion();
}

function updateFlag(){

    flag.style.left = `${50 + position*6}%`;
}

function finish(text){

    document.getElementById("winner").textContent = text;

    p1.innerHTML = "";
    p2.innerHTML = "";
}

loadQuestion();