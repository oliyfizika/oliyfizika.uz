const TEST_SIZE = 20;


/* =========================
   URL DAN TEST RAQAMINI OLISH
========================= */

const urlParams =
    new URLSearchParams(window.location.search);

const testNumber =
    urlParams.get("test") || "1";


/* =========================
   HTML ELEMENTLARI
========================= */

const questionEl =
    document.getElementById("question");

const answersEl =
    document.getElementById("answers");

const progressEl =
    document.getElementById("progress");

const quizContainer =
    document.getElementById("quiz-container");

const resultCard =
    document.getElementById("resultCard");

const reviewContainer =
    document.getElementById("reviewContainer");

const reviewList =
    document.getElementById("reviewList");

const scoreEl =
    document.getElementById("score");

const statsEl =
    document.getElementById("stats");

const testTitle =
    document.getElementById("testTitle");

const testSubtitle =
    document.getElementById("testSubtitle");

const prevBtn =
    document.getElementById("prevBtn");

const nextBtn =
    document.getElementById("nextBtn");

const finishBtn =
    document.getElementById("finishBtn");

const restartBtn =
    document.getElementById("restartBtn");

const reviewBtn =
    document.getElementById("reviewBtn");

const backToResultBtn =
    document.getElementById("backToResultBtn");


/* =========================
   TEST HOLATI
========================= */

let selectedQuestions = [];

let currentQuestion = 0;

let userAnswers = [];


/* =========================
   MASSIVNI TASODIFIY ARALASHTIRISH
========================= */

function shuffle(array) {

    const newArray = [...array];

    for (
        let i = newArray.length - 1;
        i > 0;
        i--
    ) {

        const randomIndex =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            newArray[i],
            newArray[randomIndex]
        ] =
        [
            newArray[randomIndex],
            newArray[i]
        ];
    }

    return newArray;
}


/* =========================
   TEST SAVOLLARINI YUKLASH
========================= */

function loadTestQuestions() {

    const script =
        document.createElement("script");

    script.src =
        `data/test${testNumber}.js`;


    script.onload = function () {

        if (
            !window.testQuestions ||
            !Array.isArray(window.testQuestions)
        ) {

            showError(
                "Savollar topilmadi."
            );

            return;
        }


        startTest(
            window.testQuestions
        );
    };


    script.onerror = function () {

        showError(
            `Test №${testNumber} topilmadi.`
        );
    };


    document.body.appendChild(script);
}


/* =========================
   TESTNI BOSHLASH
========================= */

function startTest(questions) {

    if (questions.length < TEST_SIZE) {

        showError(
            `Bu testda kamida ${TEST_SIZE} ta savol bo'lishi kerak.`
        );

        return;
    }


    testTitle.textContent =
        `📚 Pedagogika Testi №${testNumber}`;

    testSubtitle.textContent =
        `${TEST_SIZE} ta tasodifiy savol`;


    /* 20 TA TASODIFIY SAVOL TANLANADI */

    selectedQuestions =
        shuffle(questions)
        .slice(0, TEST_SIZE)
        .map(question => {

            const correctAnswer =
                question.answers[
                    question.correct
                ];

            const shuffledAnswers =
                shuffle(question.answers);

            return {
                ...question,

                answers:
                    shuffledAnswers,

                correct:
                    shuffledAnswers.indexOf(
                        correctAnswer
                    )
            };
        });


    /* FOYDALANUVCHI JAVOBLARI */

    userAnswers =
        new Array(
            selectedQuestions.length
        ).fill(null);


    currentQuestion = 0;


    renderQuestion();
}


/* =========================
   SAVOLNI EKRANGA CHIQARISH
========================= */

function renderQuestion() {

    const question =
        selectedQuestions[currentQuestion];


    progressEl.textContent =
        `Savol ${currentQuestion + 1} / ${selectedQuestions.length}`;


    questionEl.textContent =
        question.question;


    answersEl.innerHTML = "";


    question.answers.forEach(
        (answer, index) => {

            const button =
                document.createElement("button");


            button.className =
                "answer-btn";


            button.textContent =
                answer;


            /* TANLANGAN JAVOBNI BELGILASH */

            if (
                userAnswers[currentQuestion]
                === index
            ) {

                button.classList.add(
                    "selected"
                );
            }


            button.addEventListener(
                "click",
                function () {

                    userAnswers[currentQuestion] =
                        index;

                    renderQuestion();
                }
            );


            answersEl.appendChild(
                button
            );
        }
    );


    /* OLDINGI TUGMASI */

    prevBtn.disabled =
        currentQuestion === 0;


    /* OXIRGI SAVOLDA KEYINGI TUGMASINI YASHIRISH */

    if (
        currentQuestion ===
        selectedQuestions.length - 1
    ) {

        nextBtn.style.visibility =
            "hidden";

    } else {

        nextBtn.style.visibility =
            "visible";
    }
}


/* =========================
   KEYINGI SAVOL
========================= */

nextBtn.addEventListener(
    "click",
    function () {

        if (
            currentQuestion <
            selectedQuestions.length - 1
        ) {

            currentQuestion++;

            renderQuestion();
        }
    }
);


/* =========================
   OLDINGI SAVOL
========================= */

prevBtn.addEventListener(
    "click",
    function () {

        if (currentQuestion > 0) {

            currentQuestion--;

            renderQuestion();
        }
    }
);


/* =========================
   TESTNI YAKUNLASH
========================= */

finishBtn.addEventListener(
    "click",
    function () {

        let correct = 0;


        selectedQuestions.forEach(
            (question, index) => {

                if (
                    userAnswers[index] ===
                    question.correct
                ) {

                    correct++;
                }
            }
        );


        const total =
            selectedQuestions.length;


        const unanswered =
            userAnswers.filter(
                answer =>
                    answer === null
            ).length;


        const wrong =
            total -
            correct -
            unanswered;


        const percent =
            Math.round(
                (correct / total) * 100
            );


        /* TESTNI YASHIRISH */

        quizContainer.style.display =
            "none";


        /* NATIJANI KO'RSATISH */

        resultCard.style.display =
            "block";


        scoreEl.textContent =
            `${percent}%`;


        statsEl.innerHTML = `
            <div>📊 Jami savollar: ${total}</div>
            <div>✅ To'g'ri javoblar: ${correct}</div>
            <div>❌ Noto'g'ri javoblar: ${wrong}</div>
            <div>⚪ Javobsiz: ${unanswered}</div>
        `;
    }
);


/* =========================
   JAVOBLARNI KO'RISH
========================= */

reviewBtn.addEventListener(
    "click",
    function () {

        showReview();
    }
);


/* =========================
   JAVOBLARNI TAHLIL QILISH
========================= */

function showReview() {

    resultCard.style.display =
        "none";

    reviewContainer.style.display =
        "block";

    reviewList.innerHTML = "";


    selectedQuestions.forEach(
        (question, questionIndex) => {

            const userAnswer =
                userAnswers[
                    questionIndex
                ];

            const correctAnswer =
                question.correct;


            const isCorrect =
                userAnswer === correctAnswer;


            /* SAVOL KARTASI */

            const card =
                document.createElement("div");


            if (isCorrect) {

                card.className =
                    "review-card correct";

            } else {

                card.className =
                    "review-card wrong";
            }


            /* SAVOL MATNI */

            const questionTitle =
                document.createElement("div");

            questionTitle.className =
                "review-question";

            questionTitle.textContent =
                `${questionIndex + 1}. ${question.question}`;

            card.appendChild(
                questionTitle
            );


            /* JAVOBLAR */

            question.answers.forEach(
                (answer, answerIndex) => {

                    const answerElement =
                        document.createElement("div");


                    answerElement.className =
                        "review-answer";


                    let label = "";


                    /*
                    FOYDALANUVCHI TO'G'RI
                    JAVOBNI TANLAGAN
                    */

                    if (
                        answerIndex === userAnswer &&
                        answerIndex === correctAnswer
                    ) {

                        answerElement.classList.add(
                            "user-correct"
                        );

                        label =
                            "✓ Sizning to'g'ri javobingiz: ";
                    }


                    /*
                    FOYDALANUVCHI NOTO'G'RI
                    JAVOBNI TANLAGAN
                    */

                    else if (
                        answerIndex === userAnswer &&
                        answerIndex !== correctAnswer
                    ) {

                        answerElement.classList.add(
                            "user-wrong"
                        );

                        label =
                            "✗ Sizning javobingiz: ";
                    }


                    /*
                    TO'G'RI JAVOBNI KO'RSATISH
                    */

                    else if (
                        answerIndex === correctAnswer
                    ) {

                        answerElement.classList.add(
                            "correct-answer"
                        );

                        label =
                            "✓ To'g'ri javob: ";
                    }


                    answerElement.textContent =
                        label + answer;


                    card.appendChild(
                        answerElement
                    );
                }
            );


            /* HOLAT */

            const status =
                document.createElement("div");

            status.className =
                "review-status";


            if (userAnswer === null) {

                status.classList.add(
                    "status-unanswered"
                );

                status.textContent =
                    "⚪ Javob berilmagan";

            }

            else if (isCorrect) {

                status.classList.add(
                    "status-correct"
                );

                status.textContent =
                    "✓ To'g'ri javob";
            }

            else {

                status.classList.add(
                    "status-wrong"
                );

                status.textContent =
                    "✗ Noto'g'ri javob";
            }


            card.appendChild(status);


            reviewList.appendChild(card);
        }
    );
}


/* =========================
   NATIJAGA QAYTISH
========================= */

backToResultBtn.addEventListener(
    "click",
    function () {

        reviewContainer.style.display =
            "none";

        resultCard.style.display =
            "block";
    }
);


/* =========================
   TESTNI QAYTA BOSHLASH
========================= */

restartBtn.addEventListener(
    "click",
    function () {

        window.location.reload();
    }
);


/* =========================
   XATOLIKNI KO'RSATISH
========================= */

function showError(message) {

    questionEl.textContent =
        message;

    answersEl.innerHTML = "";

    prevBtn.style.display =
        "none";

    nextBtn.style.display =
        "none";

    finishBtn.style.display =
        "none";
}


/* =========================
   TESTNI YUKLASH
========================= */

loadTestQuestions();