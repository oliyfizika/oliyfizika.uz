const questions = [
{
    question: "Kuch formulasi qaysi?",
    options: ["F = ma", "v = s/t", "p = mv", "A = Fs"],
    answer: 0
},
{
    question: "Tezlik formulasi qaysi?",
    options: ["ρ = m/V", "v = s/t", "N = A/t", "F = ma"],
    answer: 1
},
{
    question: "Zichlik formulasi qaysi?",
    options: ["ρ = m/V", "F = ma", "p = mv", "I = U/R"],
    answer: 0
},
{
    question: "Bosim formulasi qaysi?",
    options: ["p = F/S", "v = s/t", "A = Fs", "ρ = m/V"],
    answer: 0
},
{
    question: "Impuls formulasi qaysi?",
    options: ["p = mv", "F = ma", "N = A/t", "I = U/R"],
    answer: 0
},
{
    question: "Ish formulasi qaysi?",
    options: ["A = Fs", "p = mv", "ρ = m/V", "v = s/t"],
    answer: 0
},
{
    question: "Quvvat formulasi qaysi?",
    options: ["N = A/t", "F = ma", "ρ = m/V", "p = F/S"],
    answer: 0
},
{
    question: "Ohm qonuni formulasi qaysi?",
    options: ["I = U/R", "F = ma", "A = Fs", "p = mv"],
    answer: 0
},
{
    question: "Kinetik energiya formulasi qaysi?",
    options: ["Ek = mv²/2", "Ep = mgh", "F = ma", "A = Fs"],
    answer: 0
},
{
    question: "Potensial energiya formulasi qaysi?",
    options: ["Ep = mgh", "Ek = mv²/2", "p = mv", "I = U/R"],
    answer: 0
}
];

let currentQuestion = 0;
let score = 0;

const questionEl = document.getElementById("question");
const optionsEl = document.getElementById("options");
const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");
const nextBtn = document.getElementById("nextBtn");

function loadQuestion(){

    const q = questions[currentQuestion];

    progressEl.textContent =
        `${currentQuestion + 1} / ${questions.length}`;

    questionEl.textContent = q.question;

    optionsEl.innerHTML = "";

    q.options.forEach((option,index)=>{

        const btn = document.createElement("button");

        btn.classList.add("option","default");

        btn.textContent = option;

        btn.onclick = () => checkAnswer(index);

        optionsEl.appendChild(btn);

    });

    nextBtn.style.display = "none";
}

function checkAnswer(selected){

    const q = questions[currentQuestion];

    const buttons =
        document.querySelectorAll(".option");

    buttons.forEach(btn=>{
        btn.disabled = true;
    });

    if(selected === q.answer){

        buttons[selected].classList.remove("default");
        buttons[selected].classList.add("correct");

        score += 10;

        scoreEl.textContent = `Ball: ${score}`;

    }else{

        buttons[selected].classList.remove("default");
        buttons[selected].classList.add("wrong");

        buttons[q.answer].classList.remove("default");
        buttons[q.answer].classList.add("correct");
    }

    nextBtn.style.display = "block";
}

nextBtn.addEventListener("click",()=>{

    currentQuestion++;

    if(currentQuestion < questions.length){

        loadQuestion();

    }else{

        finishGame();
    }

});

function finishGame(){

    document.getElementById("quizBox").style.display="none";

    document.getElementById("resultBox").style.display="block";

    document.getElementById("finalScore").textContent =
        `Natija: ${score} / ${questions.length * 10}`;

    let best =
        localStorage.getItem("formulaHuntRecord") || 0;

    if(score > best){

        best = score;

        localStorage.setItem(
            "formulaHuntRecord",
            score
        );
    }

    document.getElementById("bestScore").textContent =
        `🥇 Rekord: ${best}`;
}

loadQuestion();