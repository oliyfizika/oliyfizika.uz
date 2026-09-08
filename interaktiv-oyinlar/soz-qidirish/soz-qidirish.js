/* =========================================================
   SO‘Z QIDIRISH
   UNIVERSAL WORD SEARCH GAME
   ========================================================= */

(() => {

    "use strict";


    /* =====================================================
       1. ASOSIY SOZLAMALAR
       ===================================================== */

    const BOARD_SIZE = 12;

    const MIN_WORDS = 3;

    const MAX_WORDS = 15;


    /* =====================================================
       2. ALIFBOLAR
       ===================================================== */

    const ALPHABETS = {

        latin: [
            ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        ],

        cyrillic: [
            ..."АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
        ]

    };


    /* =====================================================
       3. SO‘Z JOYLASHTIRISH YO‘NALISHLARI
       ===================================================== */

    /*
     * GORIZONTAL:
     * faqat chapdan → o‘ngga
     *
     * VERTIKAL:
     * yuqoridan → pastga
     * pastdan → yuqoriga
     *
     * DIAGONAL:
     * barcha diagonal yo‘nalishlar
     *
     * MUHIM:
     * [0, -1] YO‘Q.
     *
     * Demak gorizontal so‘z
     * o‘ngdan → chapga joylashmaydi.
     */

    const DIRECTIONS = {

        all: [

            // Gorizontal
            [0, 1],

            // Vertikal
            [1, 0],
            [-1, 0],

            // Diagonal
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1]

        ],


        straight: [

            // Gorizontal
            [0, 1],

            // Vertikal
            [1, 0],
            [-1, 0]

        ],


        diagonal: [

            // Gorizontal
            [0, 1],

            // Vertikal
            [1, 0],
            [-1, 0],

            // Diagonal
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1]

        ]

    };


    /* =====================================================
       4. O‘YIN HOLATI
       ===================================================== */

    const state = {

        topic: "",

        alphabetMode: "latin",

        words: [],

        board: [],

        placements: [],

        directionMode: "all",

        timerMode: "none",

        selectedStart: null,

        selectedEnd: null,

        found: new Set(),

        timeLeft: null,

        timerId: null,

        startedAt: null,

        elapsed: 0

    };


    /* =====================================================
       5. DOM HELPER
       ===================================================== */

    const $ = (id) => {
        return document.getElementById(id);
    };


    /* =====================================================
       6. SCREENLAR
       ===================================================== */

    const screens = {

        setup: $("setup-screen"),

        preview: $("preview-screen"),

        game: $("game-screen"),

        result: $("result-screen")

    };


    /* =====================================================
       7. SCREEN ALMASHTIRISH
       ===================================================== */

    function showScreen(screenName) {

        Object.values(screens).forEach((screen) => {

            screen.classList.remove("active");

        });


        if (screens[screenName]) {

            screens[screenName].classList.add("active");

        }


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }


    /* =====================================================
       8. SO‘ZNI NORMALIZATSIYA QILISH
       ===================================================== */

    function normalizeWord(value) {

        return value

            .trim()

            .toUpperCase()

            .replace(/\s+/g, "")

            .replace(/[-–—]/g, "");

    }


    /* =====================================================
       9. TANLANGAN ALIFBONI OLISH
       ===================================================== */

    function getSelectedAlphabet() {

        return (

            ALPHABETS[state.alphabetMode] ||

            ALPHABETS.latin

        );

    }


    /* =====================================================
       10. TASODIFIY HARF
       ===================================================== */

    function getRandomLetter() {

        const alphabet =
            getSelectedAlphabet();


        const index =
            Math.floor(

                Math.random() *
                alphabet.length

            );


        return alphabet[index];

    }


    /* =====================================================
       11. BO‘SH DOSKA YARATISH
       ===================================================== */

    function createEmptyBoard() {

        return Array.from(

            {
                length: BOARD_SIZE
            },

            () =>
                Array(
                    BOARD_SIZE
                ).fill("")

        );

    }


    /* =====================================================
       12. SO‘Z DOSKAGA SIG‘ISHINI TEKSHIRISH
       ===================================================== */

    function canPlaceWord(

        board,

        word,

        row,

        column,

        rowDirection,

        columnDirection

    ) {

        const endRow =

            row +

            rowDirection *
            (word.length - 1);


        const endColumn =

            column +

            columnDirection *
            (word.length - 1);


        /*
         * Doska chegarasidan chiqmasin
         */

        if (

            endRow < 0 ||

            endRow >= BOARD_SIZE ||

            endColumn < 0 ||

            endColumn >= BOARD_SIZE

        ) {

            return false;

        }


        /*
         * Mavjud harflar bilan
         * to‘qnashuvni tekshirish
         */

        for (

            let i = 0;

            i < word.length;

            i++

        ) {

            const currentLetter =

                board[

                    row +
                    rowDirection * i

                ][

                    column +
                    columnDirection * i

                ];


            /*
             * Agar katak bo‘sh bo‘lmasa
             * va boshqa harf bo‘lsa,
             * joylashtirib bo‘lmaydi.
             */

            if (

                currentLetter !== "" &&

                currentLetter !== word[i]

            ) {

                return false;

            }

        }


        return true;

    }


    /* =====================================================
       13. SO‘ZNI DOSKAGA JOYLASHTIRISH
       ===================================================== */

    function placeWord(

        board,

        word,

        row,

        column,

        rowDirection,

        columnDirection

    ) {

        const cells = [];


        for (

            let i = 0;

            i < word.length;

            i++

        ) {

            const currentRow =

                row +
                rowDirection * i;


            const currentColumn =

                column +
                columnDirection * i;


            board[

                currentRow

            ][

                currentColumn

            ] = word[i];


            cells.push({

                r: currentRow,

                c: currentColumn

            });

        }


        return cells;

    }


    /* =====================================================
       14. DOSKA GENERATORI
       ===================================================== */

    function generateBoard(

        words,

        directionMode

    ) {

        const board =
            createEmptyBoard();


        const placements = [];


        const directions =

            DIRECTIONS[directionMode] ||

            DIRECTIONS.all;


        /*
         * Uzun so‘zlarni birinchi
         * joylashtiramiz.
         */

        const sortedWords =

            [...words].sort(

                (a, b) =>

                    b.length -
                    a.length

            );


        /*
         * Har bir so‘zni joylashtirish
         */

        for (
            const word of sortedWords
        ) {

            let placed = false;


            /*
             * Bir so‘z uchun ko‘p urinish
             */

            for (

                let attempt = 0;

                attempt < 1800 &&
                !placed;

                attempt++

            ) {

                const direction =

                    directions[

                        Math.floor(

                            Math.random() *
                            directions.length

                        )

                    ];


                const row =

                    Math.floor(

                        Math.random() *
                        BOARD_SIZE

                    );


                const column =

                    Math.floor(

                        Math.random() *
                        BOARD_SIZE

                    );


                if (

                    canPlaceWord(

                        board,

                        word,

                        row,

                        column,

                        direction[0],

                        direction[1]

                    )

                ) {

                    const cells =

                        placeWord(

                            board,

                            word,

                            row,

                            column,

                            direction[0],

                            direction[1]

                        );


                    placements.push({

                        word,

                        cells

                    });


                    placed = true;

                }

            }


            /*
             * So‘z joylashmasa,
             * butun generator qayta ishlaydi.
             */

            if (!placed) {

                return null;

            }

        }


        /* =================================================
           BO‘SH KATAKLARNI TO‘LDIRISH
           ================================================= */

        for (

            let row = 0;

            row < BOARD_SIZE;

            row++

        ) {

            for (

                let column = 0;

                column < BOARD_SIZE;

                column++

            ) {

                if (

                    !board[row][column]

                ) {

                    board[row][column] =

                        getRandomLetter();

                }

            }

        }


        return {

            board,

            placements

        };

    }


    /* =====================================================
       15. ISHONCHLI DOSKA YARATISH
       ===================================================== */

    function generateValidBoard() {

        for (

            let attempt = 0;

            attempt < 60;

            attempt++

        ) {

            const result =

                generateBoard(

                    state.words,

                    state.directionMode

                );


            if (result) {

                state.board =
                    result.board;


                state.placements =
                    result.placements;


                return true;

            }

        }


        return false;

    }


    /* =====================================================
       16. DOSKANI CHIZISH
       ===================================================== */

    function buildBoard(

        container,

        interactive = false

    ) {

        container.innerHTML = "";


        state.board.forEach(

            (row, rowIndex) => {

                row.forEach(

                    (letter, columnIndex) => {

                        const cell =

                            document.createElement(
                                "button"
                            );


                        cell.type = "button";


                        cell.className =
                            "cell";


                        cell.textContent =
                            letter;


                        cell.dataset.row =
                            rowIndex;


                        cell.dataset.col =
                            columnIndex;


                        /*
                         * Preview:
                         *
                         * Hech qanday
                         * yashirin so‘z belgilanmaydi.
                         */

                        if (interactive) {

                            cell.addEventListener(

                                "click",

                                () => {

                                    selectCell(

                                        rowIndex,

                                        columnIndex

                                    );

                                }

                            );

                        } else {

                            cell.disabled = true;

                        }


                        container.appendChild(
                            cell
                        );

                    }

                );

            }

        );

    }


    /* =====================================================
       17. O‘YIN KATAK ELEMENTINI OLISH
       ===================================================== */

    function getGameCell(

        row,

        column

    ) {

        return $("game-board").querySelector(

            `.cell[data-row="${row}"][data-col="${column}"]`

        );

    }


    /* =====================================================
       18. SO‘ZLAR RO‘YXATINI CHIZISH
       ===================================================== */

    function renderWordList(

        container

    ) {

        container.innerHTML = "";


        state.words.forEach(

            (word) => {

                const item =

                    document.createElement(
                        "div"
                    );


                item.className =
                    "word-item";


                if (

                    state.found.has(word)

                ) {

                    item.classList.add(
                        "found"
                    );

                }


                const check =

                    document.createElement(
                        "span"
                    );


                check.className =
                    "check";


                check.textContent =
                    "✓";


                const text =

                    document.createElement(
                        "span"
                    );


                text.textContent =
                    word;


                item.append(
                    check,
                    text
                );


                container.appendChild(
                    item
                );

            }

        );


        /*
         * Statistika
         */

        $("found-count").textContent =

            `${state.found.size} / ${state.words.length}`;


        $("remaining-count").textContent =

            state.words.length -
            state.found.size;

    }


    /* =====================================================
       19. PREVIEWNI CHIZISH
       ===================================================== */

    function renderPreview() {

        $("preview-topic").textContent =

            state.topic;


        const alphabetName =

            state.alphabetMode ===
            "cyrillic"

                ? "Kirill"

                : "Lotin";


        $("preview-info").textContent =

            `${state.words.length} ta so‘z • 12×12 katak • ${alphabetName} alifbosi`;


        /*
         * MUHIM:
         *
         * Preview'da so‘zlar
         * QAYERDA JOYLASHGANI
         * ko‘rsatilmaydi.
         */

        buildBoard(

            $("preview-board"),

            false

        );


        /*
         * Yashiriladigan so‘zlar ro‘yxati
         */

        const list =
            $("preview-word-list");


        list.innerHTML = "";


        state.words.forEach(

            (word) => {

                list.innerHTML += `

                    <div class="word-item">

                        <span class="check">
                            •
                        </span>

                        <span>
                            ${escapeHtml(word)}
                        </span>

                    </div>

                `;

            }

        );

    }


    /* =====================================================
       20. XAVFSIZ HTML MATN
       ===================================================== */

    function escapeHtml(value) {

        return value

            .replace(/&/g, "&amp;")

            .replace(/</g, "&lt;")

            .replace(/>/g, "&gt;")

            .replace(/"/g, "&quot;")

            .replace(/'/g, "&#039;");

    }


    /* =====================================================
       21. TANLANGAN KATAKLARNI ANIQLASH
       ===================================================== */

    function getSelectedCells(

        start,

        end

    ) {

        const rowDirection =

            Math.sign(
                end.r - start.r
            );


        const columnDirection =

            Math.sign(
                end.c - start.c
            );


        const rowDifference =

            Math.abs(
                end.r - start.r
            );


        const columnDifference =

            Math.abs(
                end.c - start.c
            );


        /*
         * Gorizontal yoki vertikal
         */

        const isStraight =

            rowDirection === 0 ||

            columnDirection === 0;


        /*
         * Diagonal
         */

        const isDiagonal =

            rowDifference ===
            columnDifference;


        if (

            !isStraight &&

            !isDiagonal

        ) {

            return null;

        }


        const length =

            Math.max(

                rowDifference,

                columnDifference

            ) + 1;


        const cells = [];


        for (

            let i = 0;

            i < length;

            i++

        ) {

            cells.push({

                r:

                    start.r +
                    rowDirection * i,

                c:

                    start.c +
                    columnDirection * i

            });

        }


        return cells;

    }


    /* =====================================================
       22. VAQTINCHA TANLOVNI TOZALASH
       ===================================================== */

    function clearTemporarySelection() {

        $("game-board")

            .querySelectorAll(

                ".selected, .wrong"

            )

            .forEach(

                (cell) => {

                    cell.classList.remove(

                        "selected",

                        "wrong"

                    );

                }

            );

    }


    /* =====================================================
       23. KATAK TANLASH
       ===================================================== */

    function selectCell(

        row,

        column

    ) {

        /*
         * O‘yin tugagan bo‘lsa
         */

        if (

            state.found.size ===
            state.words.length

        ) {

            return;

        }


        /* =================================================
           BIRINCHI KATAK
           ================================================= */

        if (!state.selectedStart) {

            state.selectedStart = {

                r: row,

                c: column

            };


            state.selectedEnd = null;


            getGameCell(

                row,

                column

            ).classList.add(
                "selected"
            );


            $("selection-hint").textContent =

                "Endi so‘zning oxirgi harfini tanlang.";


            return;

        }


        /* =================================================
           O‘SHA KATAKNI QAYTA BOSISH
           ================================================= */

        if (

            state.selectedStart.r === row &&

            state.selectedStart.c === column

        ) {

            state.selectedStart = null;

            state.selectedEnd = null;


            clearTemporarySelection();


            $("selection-hint").textContent =

                "So‘zni topish uchun birinchi va oxirgi harfni tanlang.";


            return;

        }


        /* =================================================
           IKKINCHI KATAK
           ================================================= */

        state.selectedEnd = {

            r: row,

            c: column

        };


        const selectedCells =

            getSelectedCells(

                state.selectedStart,

                state.selectedEnd

            );


        /*
         * Noto‘g‘ri geometrik yo‘nalish
         */

        if (!selectedCells) {

            showWrongSelection(

                "Faqat to‘g‘ri chiziq yoki diagonal bo‘ylab tanlang."

            );


            return;

        }


        /*
         * Harflarni olish
         */

        const selectedText =

            selectedCells

                .map(

                    (cell) =>

                        state.board[
                            cell.r
                        ][
                            cell.c
                        ]

                )

                .join("");


        /*
         * Teskari o‘qish
         *
         * Bu o‘yinchi tanlashida kerak.
         *
         * Masalan vertikal yoki diagonal
         * so‘zni pastdan yuqoriga belgilashi
         * ham mumkin.
         *
         * Lekin generatorning o‘zi
         * gorizontal so‘zni o‘ngdan chapga
         * joylashtirmaydi.
         */

        const reversedText =

            [...selectedText]

                .reverse()

                .join("");


        /*
         * Mos so‘zni qidirish
         */

        const matchedWord =

            state.words.find(

                (word) =>

                    !state.found.has(word) &&

                    (

                        word === selectedText ||

                        word === reversedText

                    )

            );


        if (matchedWord) {

            markWordFound(

                matchedWord,

                selectedCells

            );

        } else {

            showWrongSelection(

                "Bu kataklarda yashirilgan so‘z topilmadi."

            );

        }

    }


    /* =====================================================
       24. NOTO‘G‘RI TANLOV
       ===================================================== */

    function showWrongSelection(

        message

    ) {

        clearTemporarySelection();


        const cells =

            state.selectedEnd

                ? getSelectedCells(

                    state.selectedStart,

                    state.selectedEnd

                )

                : null;


        const cellsToMark =

            cells ||

            [state.selectedStart];


        cellsToMark.forEach(

            (position) => {

                if (!position) {
                    return;
                }


                const element =

                    getGameCell(

                        position.r,

                        position.c

                    );


                if (element) {

                    element.classList.add(
                        "wrong"
                    );

                }

            }

        );


        $("selection-hint").textContent =
            message;


        setTimeout(

            () => {

                clearTemporarySelection();


                state.selectedStart =
                    null;


                state.selectedEnd =
                    null;


                if (

                    state.found.size <
                    state.words.length

                ) {

                    $("selection-hint").textContent =

                        "So‘zni topish uchun birinchi va oxirgi harfni tanlang.";

                }

            },

            500

        );

    }


    /* =====================================================
       25. SO‘Z TOPILDI
       ===================================================== */

    function markWordFound(

        word,

        cells

    ) {

        state.found.add(word);


        clearTemporarySelection();


        /*
         * Topilgan so‘z kataklari yashil bo‘ladi
         */

        cells.forEach(

            ({ r, c }) => {

                const element =

                    getGameCell(
                        r,
                        c
                    );


                if (element) {

                    element.classList.add(
                        "found"
                    );

                }

            }

        );


        state.selectedStart = null;

        state.selectedEnd = null;


        renderWordList(

            $("game-word-list")

        );


        /*
         * Barcha so‘zlar topildimi?
         */

        if (

            state.found.size ===
            state.words.length

        ) {

            stopTimer();


            finishGame(true);


            return;

        }


        $("selection-hint").textContent =

            `To‘g‘ri! “${word}” topildi. Keyingi so‘zni qidiring.`;

    }


    /* =====================================================
       26. TIMERNI BOSHLASH
       ===================================================== */

    function startTimer() {

        stopTimer();


        state.startedAt =
            Date.now();


        state.elapsed = 0;


        /*
         * Cheklanmagan
         */

        if (

            state.timerMode ===
            "none"

        ) {

            state.timeLeft = null;


            $("timer").textContent =
                "∞";


            return;

        }


        /*
         * Belgilangan vaqt
         */

        state.timeLeft =

            Number(
                state.timerMode
            );


        updateTimerDisplay();


        state.timerId =

            setInterval(

                () => {

                    state.timeLeft--;


                    state.elapsed =

                        Math.floor(

                            (

                                Date.now() -
                                state.startedAt

                            ) / 1000

                        );


                    updateTimerDisplay();


                    /*
                     * Vaqt tugadi
                     */

                    if (

                        state.timeLeft <= 0

                    ) {

                        stopTimer();


                        finishGame(false);

                    }

                },

                1000

            );

    }


    /* =====================================================
       27. TIMERNI KO‘RSATISH
       ===================================================== */

    function updateTimerDisplay() {

        if (

            state.timeLeft ===
            null

        ) {

            $("timer").textContent =
                "∞";


            return;

        }


        const minutes =

            Math.floor(
                state.timeLeft / 60
            );


        const seconds =

            state.timeLeft % 60;


        $("timer").textContent =

            `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    }


    /* =====================================================
       28. TIMERNI TO‘XTATISH
       ===================================================== */

    function stopTimer() {

        if (state.timerId) {

            clearInterval(
                state.timerId
            );


            state.timerId = null;

        }

    }


    /* =====================================================
       29. O‘YINNI BOSHLASH
       ===================================================== */

    function startGame() {

        state.found.clear();


        state.selectedStart = null;

        state.selectedEnd = null;


        buildBoard(

            $("game-board"),

            true

        );


        renderWordList(

            $("game-word-list")

        );


        $("game-topic-label").textContent =

            (

                state.topic ||

                "SO‘Z QIDIRISH"

            ).toUpperCase();


        $("selection-hint").textContent =

            "So‘zni topish uchun birinchi va oxirgi harfni tanlang.";


        showScreen("game");


        startTimer();

    }


    /* =====================================================
       30. O‘YINNI YAKUNLASH
       ===================================================== */

    function finishGame(

        allWordsFound

    ) {

        stopTimer();


        if (state.startedAt) {

            state.elapsed =

                Math.floor(

                    (

                        Date.now() -
                        state.startedAt

                    ) / 1000

                );

        }


        const score =
            state.found.size;


        const total =
            state.words.length;


        /*
         * Natija
         */

        $("result-score").textContent =

            `${score} / ${total}`;


        $("result-time").textContent =

            `${Math.floor(
                state.elapsed / 60
            )}:${String(
                state.elapsed % 60
            ).padStart(2, "0")}`;


        /*
         * Sarlavha
         */

        if (allWordsFound) {

            $("result-title").textContent =
                "Ajoyib!";


            $("result-message").textContent =

                `Barcha ${total} ta so‘zni muvaffaqiyatli topdingiz.`;

        } else {

            $("result-title").textContent =
                "Vaqt tugadi";


            $("result-message").textContent =

                `${total} ta so‘zdan ${score} tasini topdingiz.`;

        }


        /*
         * Natijadagi so‘zlar
         */

        const resultWords =
            $("result-words");


        resultWords.innerHTML = "";


        state.words.forEach(

            (word) => {

                const item =

                    document.createElement(
                        "span"
                    );


                item.className =
                    "result-word";


                item.textContent =

                    `${

                        state.found.has(word)

                            ? "✓"

                            : "○"

                    } ${word}`;


                resultWords.appendChild(
                    item
                );

            }

        );


        showScreen("result");

    }


    /* =====================================================
       31. YANGI SO‘Z INPUT QO‘SHISH
       ===================================================== */

    function addWordInput(

        value = ""

    ) {

        const container =
            $("word-inputs");


        /*
         * Maksimal 15 ta
         */

        if (

            container.children.length >=
            MAX_WORDS

        ) {

            return;

        }


        const row =

            document.createElement(
                "div"
            );


        row.className =
            "word-row";


        const input =

            document.createElement(
                "input"
            );


        input.type =
            "text";


        input.maxLength =
            BOARD_SIZE;


        input.placeholder =

            `So‘z ${
                container.children.length + 1
            }`;


        input.value =
            value;


        input.addEventListener(

            "input",

            updateWordCount

        );


        const removeButton =

            document.createElement(
                "button"
            );


        removeButton.type =
            "button";


        removeButton.className =
            "remove-word";


        removeButton.textContent =
            "×";


        removeButton.title =
            "O‘chirish";


        removeButton.addEventListener(

            "click",

            () => {

                row.remove();


                renumberInputs();


                updateWordCount();

            }

        );


        row.append(

            input,

            removeButton

        );


        container.appendChild(
            row
        );


        updateWordCount();

    }


    /* =====================================================
       32. MAVJUD INPUTLAR UCHUN REMOVE TUGMASI
       ===================================================== */

    function setupExistingWordInputs() {

        const container =
            $("word-inputs");


        /*
         * HTML ichidagi dastlabki 5 ta
         * inputga event beramiz.
         */

        container
            .querySelectorAll(
                ".word-row"
            )
            .forEach(

                (row) => {

                    const input =
                        row.querySelector(
                            "input"
                        );


                    const removeButton =
                        row.querySelector(
                            ".remove-word"
                        );


                    if (input) {

                        input.addEventListener(

                            "input",

                            updateWordCount

                        );

                    }


                    if (removeButton) {

                        removeButton.addEventListener(

                            "click",

                            () => {

                                row.remove();


                                renumberInputs();


                                updateWordCount();

                            }

                        );

                    }

                }

            );


        renumberInputs();

    }


    /* =====================================================
       33. INPUT RAQAMLARINI YANGILASH
       ===================================================== */

    function renumberInputs() {

        [

            ...$("word-inputs").children

        ].forEach(

            (row, index) => {

                const input =
                    row.querySelector(
                        "input"
                    );


                if (input) {

                    input.placeholder =

                        `So‘z ${
                            index + 1
                        }`;

                }

            }

        );

    }


    /* =====================================================
       34. KIRITILGAN SO‘ZLARNI OLISH
       ===================================================== */

    function collectWords() {

        return [

            ...$("word-inputs")
                .querySelectorAll(
                    "input"
                )

        ]

            .map(

                (input) =>

                    normalizeWord(
                        input.value
                    )

            )

            .filter(Boolean);

    }


    /* =====================================================
       35. SO‘ZLAR SONINI YANGILASH
       ===================================================== */

    function updateWordCount() {

        const count =
            collectWords().length;


        $("word-count").textContent =

            `${count} / ${MAX_WORDS}`;

    }


    /* =====================================================
       36. ALIFBO MOSLIGINI TEKSHIRISH
       ===================================================== */

    function isWordCompatibleWithAlphabet(

        word

    ) {

        /*
         * LOTIN
         */

        if (

            state.alphabetMode ===
            "latin"

        ) {

            return /^[A-Z]+$/.test(
                word
            );

        }


        /*
         * KIRILL
         */

        if (

            state.alphabetMode ===
            "cyrillic"

        ) {

            return /^[А-ЯЁ]+$/.test(
                word
            );

        }


        return false;

    }


    /* =====================================================
       37. SOZLAMALARNI TEKSHIRISH
       ===================================================== */

    function validateSetup() {

        const topic =

            $("topic")
                .value
                .trim();


        const words =
            collectWords();


        /*
         * Mavzu
         */

        if (!topic) {

            return "Mavzuni kiriting.";

        }


        /*
         * Minimal so‘z
         */

        if (

            words.length <
            MIN_WORDS

        ) {

            return `Kamida ${MIN_WORDS} ta so‘z kiriting.`;

        }


        /*
         * Maksimal so‘z
         */

        if (

            words.length >
            MAX_WORDS

        ) {

            return `Ko‘pi bilan ${MAX_WORDS} ta so‘z kiritish mumkin.`;

        }


        /*
         * Takroriy so‘z
         */

        if (

            new Set(words).size !==
            words.length

        ) {

            return "Bir xil so‘zni ikki marta kiritmang.";

        }


        /*
         * Har bir so‘zni tekshirish
         */

        for (

            const word of words

        ) {

            /*
             * Juda qisqa
             */

            if (

                word.length < 2

            ) {

                return `“${word}” juda qisqa.`;

            }


            /*
             * 12 katakka sig‘ishi kerak
             */

            if (

                word.length >
                BOARD_SIZE

            ) {

                return `“${word}” 12 ta harfdan uzun.`;

            }


            /*
             * Alifbo
             */

            if (

                !isWordCompatibleWithAlphabet(
                    word
                )

            ) {

                const alphabetName =

                    state.alphabetMode ===
                    "latin"

                        ? "Lotin"

                        : "Kirill";


                return `“${word}” tanlangan ${alphabetName} alifbosiga mos emas.`;

            }

        }


        return null;

    }


    /* =====================================================
       38. DOSKANI YARATISH
       ===================================================== */

    function createGameBoard() {

        $("setup-error").textContent =
            "";


        /*
         * Avval alifboni state'ga yozamiz.
         */

        state.alphabetMode =

            $("alphabet-mode").value;


        /*
         * So‘ng tekshiramiz.
         */

        const error =
            validateSetup();


        if (error) {

            $("setup-error").textContent =
                error;


            return;

        }


        /*
         * Asosiy ma’lumotlar
         */

        state.topic =

            $("topic")
                .value
                .trim();


        state.words =
            collectWords();


        state.directionMode =

            $("direction-mode")
                .value;


        state.timerMode =

            $("timer-mode")
                .value;


        /*
         * Doska yaratish
         */

        const generated =
            generateValidBoard();


        if (!generated) {

            $("setup-error").textContent =

                "Doskani yaratib bo‘lmadi. Boshqa yo‘nalishni tanlab yoki so‘zlar sonini kamaytirib qayta urinib ko‘ring.";


            return;

        }


        /*
         * Preview
         */

        renderPreview();


        showScreen("preview");

    }


    /* =====================================================
       39. DOSKANI QAYTA YARATISH
       ===================================================== */

    function regenerateBoard() {

        const generated =
            generateValidBoard();


        if (!generated) {

            window.alert(

                "Yangi doska yaratilmadi. Qayta urinib ko‘ring."

            );


            return;

        }


        /*
         * Preview qayta chiziladi.
         *
         * So‘zlarning joylashuvi
         * ko‘rsatilmaydi.
         */

        renderPreview();

    }


    /* =====================================================
       40. SOZLAMALARGA QAYTISH
       ===================================================== */

    function backToSetup() {

        stopTimer();


        state.found.clear();


        state.selectedStart = null;

        state.selectedEnd = null;


        showScreen("setup");

    }


    /* =====================================================
       41. QAYTA O‘YNASH
       ===================================================== */

    function replayGame() {

        startGame();

    }


    /* =====================================================
       42. EVENTLAR
       ===================================================== */

    function bindEvents() {

        /*
         * So‘z qo‘shish
         */

        $("add-word-btn")

            .addEventListener(

                "click",

                () => {

                    addWordInput();

                }

            );


        /*
         * Doska yaratish
         */

        $("generate-btn")

            .addEventListener(

                "click",

                createGameBoard

            );


        /*
         * Qayta yaratish
         */

        $("regenerate-btn")

            .addEventListener(

                "click",

                regenerateBoard

            );


        /*
         * O‘yinni boshlash
         */

        $("start-game-btn")

            .addEventListener(

                "click",

                startGame

            );


        /*
         * Sozlamalarni o‘zgartirish
         */

        $("back-setup-btn")

            .addEventListener(

                "click",

                backToSetup

            );


        /*
         * Yangi o‘yin
         */

        $("new-game-btn")

            .addEventListener(

                "click",

                backToSetup

            );


        /*
         * Qayta o‘ynash
         */

        $("play-again-btn")

            .addEventListener(

                "click",

                replayGame

            );


        /*
         * Yangi doska
         */

        $("setup-again-btn")

            .addEventListener(

                "click",

                backToSetup

            );

    }


    /* =====================================================
       43. INITIALIZATION
       ===================================================== */

    function init() {

        /*
         * MUHIM:
         *
         * Bu yerda 5 ta yangi input
         * YARATILMAYDI.
         *
         * Chunki ular HTML ichida
         * allaqachon mavjud.
         */

        setupExistingWordInputs();


        bindEvents();


        updateWordCount();

    }


    /* =====================================================
       44. ISHGA TUSHIRISH
       ===================================================== */

    init();

})();