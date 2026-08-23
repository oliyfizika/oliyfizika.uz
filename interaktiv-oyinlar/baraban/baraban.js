/* =========================================================
   BARABAN O'YINI
   OliyFizika.uz
========================================================= */


"use strict";


/* =========================================================
   O'YIN HOLATI
========================================================= */

const gameData = {

    name: "",

    topic: "",

    teams: [],

    questions: []

};


let remainingQuestions = [];

let currentTeamIndex = 0;

let selectedQuestion = null;

let wheelRotation = 0;

let isSpinning = false;


/* =========================================================
   DOM
========================================================= */

const gameNameInput =
    document.getElementById("gameName");

const topicInput =
    document.getElementById("topic");

const teamCountSelect =
    document.getElementById("teamCount");

const teamsList =
    document.getElementById("teamsList");

const questionsList =
    document.getElementById("questionsList");

const questionCount =
    document.getElementById("questionCount");

const addQuestionBtn =
    document.getElementById("addQuestionBtn");

const startGameBtn =
    document.getElementById("startGameBtn");

const gameSection =
    document.getElementById("gameSection");

const gameTitle =
    document.getElementById("gameTitle");

const gameTopic =
    document.getElementById("gameTopic");

const scoreBoard =
    document.getElementById("scoreBoard");

const currentTeamEl =
    document.getElementById("currentTeam");

const drum =
    document.getElementById("drum");

const spinBtn =
    document.getElementById("spinBtn");

const questionArea =
    document.getElementById("questionArea");

const selectedQuestionNumber =
    document.getElementById(
        "selectedQuestionNumber"
    );

const selectedQuestionPoints =
    document.getElementById(
        "selectedQuestionPoints"
    );

const selectedQuestionText =
    document.getElementById(
        "selectedQuestionText"
    );

const correctBtn =
    document.getElementById("correctBtn");

const wrongBtn =
    document.getElementById("wrongBtn");

const winnerArea =
    document.getElementById("winnerArea");

const winnerText =
    document.getElementById("winnerText");

const finalScores =
    document.getElementById("finalScores");


/* =========================================================
   SAVOL RAQAMI
========================================================= */

let nextQuestionId = 1;


/* =========================================================
   JAMOALAR
========================================================= */

function updateTeamsPreview() {

    const count =
        Number(teamCountSelect.value);

    teamsList.innerHTML = "";

    for (
        let i = 0;
        i < count;
        i++
    ) {

        const team =
            document.createElement("div");

        team.className =
            "team-preview";

        team.textContent =
            `${getTeamName(i)}`;

        teamsList.appendChild(team);

    }

}


function getTeamName(index) {

    const names = [
        "Birinchi jamoa",
        "Ikkinchi jamoa",
        "Uchinchi jamoa",
        "To'rtinchi jamoa",
        "Beshinchi jamoa",
        "Oltinchi jamoa"
    ];

    return (
        names[index] ||
        `${index + 1}-jamoa`
    );

}


teamCountSelect.addEventListener(
    "change",
    updateTeamsPreview
);


/* =========================================================
   SAVOL QO'SHISH
========================================================= */

function addQuestion() {

    const id =
        nextQuestionId++;

    gameData.questions.push({

        id: id,

        text: "",

        points: 1

    });

    renderQuestions();

}


addQuestionBtn.addEventListener(
    "click",
    addQuestion
);


/* =========================================================
   SAVOLLARNI CHIZISH
========================================================= */

function renderQuestions() {

    questionsList.innerHTML = "";

    questionCount.textContent =
        `${gameData.questions.length} ta`;


    gameData.questions.forEach(
        question => {

            const card =
                document.createElement("div");

            card.className =
                "question-card";


            /* -------------------------
               SARLAVHA
            -------------------------- */

            const title =
                document.createElement("div");

            title.className =
                "question-title";

            title.textContent =
                `Savol ${question.id}`;


            /* -------------------------
               MATN
            -------------------------- */

            const textarea =
                document.createElement(
                    "textarea"
                );

            textarea.className =
                "question-text";

            textarea.placeholder =
                "Savol matnini kiriting...";

            textarea.value =
                question.text;


            textarea.addEventListener(
                "input",
                () => {

                    question.text =
                        textarea.value;

                }
            );


            /* -------------------------
               PASTKI QISM
            -------------------------- */

            const bottom =
                document.createElement("div");

            bottom.className =
                "question-bottom";


            const pointsLabel =
                document.createElement("label");

            pointsLabel.textContent =
                "Ball:";


            const pointsInput =
                document.createElement(
                    "input"
                );

            pointsInput.type =
                "number";

            pointsInput.min =
                "1";

            pointsInput.value =
                question.points;

            pointsInput.className =
                "question-points";


            pointsInput.addEventListener(
                "input",
                () => {

                    let value =
                        Number(
                            pointsInput.value
                        );

                    if (
                        !Number.isFinite(value) ||
                        value < 1
                    ) {

                        value = 1;

                    }

                    question.points =
                        value;

                    pointsInput.value =
                        value;

                }
            );


            /* -------------------------
               O'CHIRISH
            -------------------------- */

            const deleteBtn =
                document.createElement(
                    "button"
                );

            deleteBtn.type =
                "button";

            deleteBtn.className =
                "delete-question";

            deleteBtn.textContent =
                "🗑 O'chirish";


            deleteBtn.addEventListener(
                "click",
                () => {

                    const index =
                        gameData.questions
                            .findIndex(
                                q =>
                                    q.id ===
                                    question.id
                            );

                    if (index !== -1) {

                        gameData.questions
                            .splice(index, 1);

                    }

                    renderQuestions();

                }
            );


            bottom.appendChild(
                pointsLabel
            );

            bottom.appendChild(
                pointsInput
            );

            bottom.appendChild(
                deleteBtn
            );


            card.appendChild(title);

            card.appendChild(
                textarea
            );

            card.appendChild(
                bottom
            );


            questionsList.appendChild(
                card
            );

        }
    );

}


/* =========================================================
   BARABAN RANGLARI
========================================================= */

const wheelColors = [

    "#38bdf8",
    "#facc15",
    "#4ade80",
    "#fb7185",
    "#a78bfa",
    "#2dd4bf",
    "#f97316",
    "#60a5fa",
    "#f472b6",
    "#34d399",
    "#818cf8",
    "#fb923c"

];


/* =========================================================
   BARABANNI QURISH
========================================================= */

function renderDrum() {

    const total =
        remainingQuestions.length;


    drum.innerHTML = "";


    if (total === 0) {

        drum.style.background =
            "#e2e8f0";

        return;

    }


    /* =====================================================
       HAR BIR SEKTOR UCHUN BURCHAK
    ===================================================== */

    const sectorAngle =
        360 / total;


    /* =====================================================
       CONIC GRADIENT
    ===================================================== */

    const gradients = [];


    for (
        let i = 0;
        i < total;
        i++
    ) {

        const start =
            i * sectorAngle;

        const end =
            (i + 1) *
            sectorAngle;

        const color =
            wheelColors[
                i %
                wheelColors.length
            ];


        gradients.push(
            `${color} ${start}deg ${end}deg`
        );

    }


    drum.style.background =
        `conic-gradient(
            ${gradients.join(",")}
        )`;


    /* =====================================================
       SAVOL RAQAMLARI
    ===================================================== */

    remainingQuestions.forEach(
        (question, index) => {

            const label =
                document.createElement(
                    "div"
                );

            label.className =
                "drum-label";


            /* ---------------------------------------------
               SEKTOR MARKAZI
            ---------------------------------------------- */

            const centerAngle =
                index *
                sectorAngle +
                sectorAngle / 2;


            /* ---------------------------------------------
               RADIUS
            ---------------------------------------------- */

            let radius;


            if (total <= 6) {

                radius = 210;

            }
            else if (total <= 10) {

                radius = 215;

            }
            else if (total <= 20) {

                radius = 220;

            }
            else {

                radius = 225;

            }


            /* ---------------------------------------------
               MATNNI SEKTOR MARKAZIGA JOYLASHTIRISH
            ---------------------------------------------- */

            label.style.transform =
                `
                translate(-50%, -50%)
                rotate(${centerAngle}deg)
                translateY(-${radius}px)
                rotate(${-centerAngle}deg)
                `;


            label.textContent =
                `${question.id}-SAVOL`;


            drum.appendChild(label);

        }
    );


    /* =====================================================
       MARKAZ
    ===================================================== */

    const center =
        document.createElement(
            "div"
        );

    center.className =
        "drum-center";

    center.textContent =
        "🎡";

    drum.appendChild(center);

}


/* =========================================================
   SAVOLNI TEKSHIRISH
========================================================= */

function validateQuestions() {

    if (
        gameData.questions.length === 0
    ) {

        alert(
            "Kamida bitta savol kiriting."
        );

        return false;

    }


    for (
        const question
        of gameData.questions
    ) {

        if (
            !question.text.trim()
        ) {

            alert(
                `${question.id}-savol matni kiritilmagan.`
            );

            return false;

        }


        if (
            !Number.isFinite(
                Number(question.points)
            ) ||
            Number(question.points) < 1
        ) {

            alert(
                `${question.id}-savol uchun ball noto'g'ri.`
            );

            return false;

        }

    }


    return true;

}


/* =========================================================
   O'YINNI BOSHLASH
========================================================= */

function startGame() {

    if (
        !validateQuestions()
    ) {

        return;

    }


    const teamCount =
        Number(
            teamCountSelect.value
        );


    gameData.name =
        gameNameInput.value.trim() ||
        "Baraban o'yini";


    gameData.topic =
        topicInput.value.trim() ||
        "Fizika";


    gameData.teams = [];


    for (
        let i = 0;
        i < teamCount;
        i++
    ) {

        gameData.teams.push({

            name:
                getTeamName(i),

            score:
                0

        });

    }


    /* ---------------------------------------------
       BARCHA SAVOLLARDAN NUSXA
    ---------------------------------------------- */

    remainingQuestions =
        gameData.questions.map(
            question => ({
                ...question
            })
        );


    currentTeamIndex = 0;

    selectedQuestion = null;

    wheelRotation = 0;

    isSpinning = false;


    /* ---------------------------------------------
       UI
    ---------------------------------------------- */

    gameTitle.textContent =
        gameData.name;

    gameTopic.textContent =
        gameData.topic;


    gameSection.classList.remove(
        "hidden"
    );


    questionArea.classList.add(
        "hidden"
    );


    winnerArea.classList.add(
        "hidden"
    );


    updateScoreBoard();

    updateCurrentTeam();

    renderDrum();


    spinBtn.disabled =
        false;


    gameSection.scrollIntoView({
        behavior: "smooth"
    });

}


startGameBtn.addEventListener(
    "click",
    startGame
);


/* =========================================================
   BALLAR PANELI
========================================================= */

function updateScoreBoard() {

    scoreBoard.innerHTML = "";


    gameData.teams.forEach(
        (team, index) => {

            const box =
                document.createElement(
                    "div"
                );

            box.className =
                "team-score";


            if (
                index ===
                currentTeamIndex
            ) {

                box.classList.add(
                    "active"
                );

            }


            const name =
                document.createElement(
                    "span"
                );

            name.textContent =
                team.name;


            const score =
                document.createElement(
                    "strong"
                );

            score.textContent =
                team.score;


            box.appendChild(name);

            box.appendChild(score);


            scoreBoard.appendChild(
                box
            );

        }
    );

}


/* =========================================================
   NAVBAT
========================================================= */

function updateCurrentTeam() {

    const team =
        gameData.teams[
            currentTeamIndex
        ];


    if (!team) {
        return;
    }


    currentTeamEl.textContent =
        team.name;


    updateScoreBoard();

}


/* =========================================================
   BARABANNI AYLANtirish
========================================================= */

function spinDrum() {

    if (
        isSpinning
    ) {

        return;

    }


    if (
        remainingQuestions.length === 0
    ) {

        finishGame();

        return;

    }


    isSpinning = true;

    spinBtn.disabled = true;

    questionArea.classList.add(
        "hidden"
    );


    /* =====================================================
       TASODIFIY SAVOL
    ===================================================== */

    const selectedIndex =
        Math.floor(
            Math.random() *
            remainingQuestions.length
        );


    selectedQuestion =
        remainingQuestions[
            selectedIndex
        ];


    /* =====================================================
       SEKTOR BURCHAGI
    ===================================================== */

    const total =
        remainingQuestions.length;


    const sectorAngle =
        360 / total;


    /*
       Sektor markazi.

       CSS conic-gradient:
       0° — yuqori qismdan boshlanadi.

       Pointer:
       yuqorida turibdi.

       Shuning uchun tanlangan
       sektor markazini 0° ga
       olib kelamiz.
    */

    const sectorCenter =
        selectedIndex *
        sectorAngle +
        sectorAngle / 2;


    /* =====================================================
       HOZIRGI BURCHAK
    ===================================================== */

    const current =
        (
            wheelRotation % 360 +
            360
        ) % 360;


    /* =====================================================
       KORREKSIYA
    ===================================================== */

    let correction =
        -sectorCenter -
        current;


    while (
        correction > 180
    ) {

        correction -= 360;

    }


    while (
        correction < -180
    ) {

        correction += 360;

    }


    /* =====================================================
       KAMIDA 3 MARTA TO'LIQ AYLANISH
    ===================================================== */

    const fullTurns =
        3 * 360;


    wheelRotation +=
        fullTurns +
        correction;


    /* =====================================================
       OVOZ
    ===================================================== */

    playSpinSound();


    /* =====================================================
       ANIMATSIYA
    ===================================================== */

    drum.style.transform =
        `rotate(${wheelRotation}deg)`;


    /*
       CSS transition:
       4.8 sekund
    */

    setTimeout(
        () => {

            isSpinning = false;

            spinBtn.disabled =
                false;

            showSelectedQuestion();

        },
        5000
    );

}


spinBtn.addEventListener(
    "click",
    spinDrum
);


/* =========================================================
   TANLANGAN SAVOLNI KO'RSATISH
========================================================= */

function showSelectedQuestion() {

    if (
        !selectedQuestion
    ) {

        return;

    }


    selectedQuestionNumber.textContent =
        `${selectedQuestion.id}-SAVOL`;


    selectedQuestionPoints.textContent =
        `${selectedQuestion.points} BALL`;


    selectedQuestionText.textContent =
        selectedQuestion.text;


    questionArea.classList.remove(
        "hidden"
    );


    questionArea.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


/* =========================================================
   TO'G'RI JAVOB
========================================================= */

function handleCorrectAnswer() {

    if (
        !selectedQuestion
    ) {

        return;

    }


    const team =
        gameData.teams[
            currentTeamIndex
        ];


    if (!team) {
        return;
    }


    /* ---------------------------------------------
       BALL BERISH
    ---------------------------------------------- */

    team.score +=
        Number(
            selectedQuestion.points
        );


    removeSelectedQuestion();

}


/* =========================================================
   NOTO'G'RI JAVOB
========================================================= */

function handleWrongAnswer() {

    if (
        !selectedQuestion
    ) {

        return;

    }


    /*
       Ball berilmaydi.
       Lekin savol barabandan chiqadi.
    */

    removeSelectedQuestion();

}


/* =========================================================
   SAVOLNI BARABANDAN O'CHIRISH
========================================================= */

function removeSelectedQuestion() {

    if (
        !selectedQuestion
    ) {

        return;

    }


    const selectedId =
        selectedQuestion.id;


    /* ---------------------------------------------
       SAVOLNI QOLGANLARDAN O'CHIRISH
    ---------------------------------------------- */

    remainingQuestions =
        remainingQuestions.filter(
            question =>
                question.id !==
                selectedId
        );


    /* ---------------------------------------------
       TANLANGAN SAVOLNI TOZALASH
    ---------------------------------------------- */

    selectedQuestion =
        null;


    questionArea.classList.add(
        "hidden"
    );


    /* ---------------------------------------------
       BALLARNI YANGILASH
    ---------------------------------------------- */

    updateScoreBoard();


    /* ---------------------------------------------
       BARCHA SAVOLLAR TUGADIMI?
    ---------------------------------------------- */

    if (
        remainingQuestions.length === 0
    ) {

        finishGame();

        return;

    }


    /* ---------------------------------------------
       KEYINGI JAMOA
    ---------------------------------------------- */

    currentTeamIndex++;

    if (
        currentTeamIndex >=
        gameData.teams.length
    ) {

        currentTeamIndex = 0;

    }


    updateCurrentTeam();


    /* ---------------------------------------------
       ENG MUHIM:
       BARABANNI QAYTA QURISH
    ---------------------------------------------- */

    renderDrum();


    /*
       Endi masalan:

       6 savol
       ↓
       5 savol
       ↓
       4 savol
       ↓
       3 savol

       va har safar sektor
       360 / qolgan savollar soni
       bo'yicha qayta hisoblanadi.
    */

}


/* =========================================================
   G'OLIBNI ANIQLASH
========================================================= */

function finishGame() {

    spinBtn.disabled =
        true;


    questionArea.classList.add(
        "hidden"
    );


    winnerArea.classList.remove(
        "hidden"
    );


    /* ---------------------------------------------
       BALL BO'YICHA SARALASH
    ---------------------------------------------- */

    const ranking =
        [...gameData.teams].sort(
            (a, b) =>
                b.score -
                a.score
        );


    const winner =
        ranking[0];


    /* ---------------------------------------------
       DURANG
    ---------------------------------------------- */

    const winners =
        ranking.filter(
            team =>
                team.score ===
                winner.score
        );


    if (
        winners.length === 1
    ) {

        winnerText.textContent =
            `🏆 ${winner.name} g'olib!`;

    }
    else {

        winnerText.textContent =
            `🤝 O'yin durang bilan yakunlandi!`;

    }


    /* ---------------------------------------------
       YAKUNIY BALLAR
    ---------------------------------------------- */

    finalScores.innerHTML = "";


    ranking.forEach(
        (team, index) => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "final-score";


            row.innerHTML =
                `
                <span>
                    ${index + 1}.
                    ${team.name}
                </span>

                <strong>
                    ${team.score} ball
                </strong>
                `;


            finalScores.appendChild(
                row
            );

        }
    );


    winnerArea.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


/* =========================================================
   OVOZ
========================================================= */

let audioContext = null;


function playSpinSound() {

    try {

        if (!audioContext) {

            audioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();

        }


        if (
            audioContext.state ===
            "suspended"
        ) {

            audioContext.resume();

        }


        const startTime =
            audioContext.currentTime;


        const duration =
            4.7;


        /*
           Baraban aylanishiga
           o'xshash ketma-ket
           qisqa tovushlar.
        */

        for (
            let i = 0;
            i < 28;
            i++
        ) {

            const oscillator =
                audioContext.createOscillator();

            const gain =
                audioContext.createGain();


            oscillator.type =
                "triangle";


            oscillator.frequency.value =
                120 +
                Math.random() *
                80;


            const t =
                startTime +
                (i / 28) *
                duration;


            gain.gain.setValueAtTime(
                0,
                t
            );


            gain.gain.linearRampToValueAtTime(
                0.035,
                t + 0.005
            );


            gain.gain.exponentialRampToValueAtTime(
                0.001,
                t + 0.045
            );


            oscillator.connect(
                gain
            );

            gain.connect(
                audioContext.destination
            );


            oscillator.start(t);

            oscillator.stop(
                t + 0.05
            );

        }

    }
    catch (error) {

        console.warn(
            "Audio ishlamadi:",
            error
        );

    }

}


/* =========================================================
   TUGMALAR
========================================================= */

correctBtn.addEventListener(
    "click",
    handleCorrectAnswer
);


wrongBtn.addEventListener(
    "click",
    handleWrongAnswer
);


/* =========================================================
   BOSHLANG'ICH HOLAT
========================================================= */

updateTeamsPreview();

addQuestion();
