/* =========================================================
   LORENTZ FORCE SIMULATION
   OliyFizika.uz
   ========================================================= */

(() => {

    "use strict";

    /* =====================================================
       DOM
       ===================================================== */

    const canvas = document.getElementById("lorentzCanvas");

    if (!canvas) {
        console.error("lorentzCanvas topilmadi.");
        return;
    }

    const ctx = canvas.getContext("2d");

    const magneticField =
        document.getElementById("magneticField");

    const velocity =
        document.getElementById("velocity");

    const particleCharge =
        document.getElementById("particleCharge");

    const magneticFieldValue =
        document.getElementById("magneticFieldValue");

    const velocityValue =
        document.getElementById("velocityValue");

    const forceValue =
        document.getElementById("forceValue");

    const radiusValue =
        document.getElementById("radiusValue");

    const angularVelocityValue =
        document.getElementById("angularVelocityValue");

    const simulationMessage =
        document.getElementById("simulationMessage");

    const startButton =
        document.getElementById("startButton");

    const pauseButton =
        document.getElementById("pauseButton");

    const resetButton =
        document.getElementById("resetButton");


    /* =====================================================
       PHYSICAL CONSTANTS
       ===================================================== */

    const ELEMENTARY_CHARGE =
        1.602176634e-19;

    const ELECTRON_MASS =
        9.1093837e-31;


    /* =====================================================
       STATE
       ===================================================== */

    let running = false;

    let animationFrame = null;

    let simulationTime = 0;

    let lastTime = 0;

    let trail = [];


    /* =====================================================
       GET PARAMETERS
       ===================================================== */

    function getValues() {

        /*
         * IMPORTANT:
         * B manfiy ham bo‘lishi mumkin.
         *
         * B = +1 T
         *     magnit maydoni ekrandan tashqariga
         *
         * B = -1 T
         *     magnit maydoni ekranga ichkariga
         */

        const B =
            Number(magneticField.value) || 0;


        const velocityMillions =
            Math.max(
                0,
                Number(velocity.value) || 0
            );


        const v =
            velocityMillions * 1e6;


        const qSign =
            Number(particleCharge.value) || -1;


        const q =
            qSign * ELEMENTARY_CHARGE;


        return {
            B,
            v,
            q,
            qSign
        };
    }


    /* =====================================================
       SCIENTIFIC FORMAT
       ===================================================== */

    function formatScientific(value) {

        if (!Number.isFinite(value)) {
            return "—";
        }

        if (value === 0) {
            return "0";
        }

        return value.toExponential(2);
    }


    /* =====================================================
       UPDATE PHYSICS
       ===================================================== */

    function updatePhysics() {

        const {
            B,
            v,
            q,
            qSign
        } = getValues();


        /* -----------------------------------------------
           MAGNETIC FIELD DISPLAY
           ----------------------------------------------- */

        magneticFieldValue.textContent =
            `${B.toFixed(1)} T`;


        /* -----------------------------------------------
           VELOCITY DISPLAY
           ----------------------------------------------- */

        velocityValue.textContent =
            `${(v / 1e6).toFixed(1)} × 10⁶ m/s`;


        /* -----------------------------------------------
           LORENTZ FORCE MAGNITUDE

           F = |q| v |B|

           B ning ishorasi kuchning yo‘nalishini
           o‘zgartiradi, lekin modulini emas.
           ----------------------------------------------- */

        const force =
            Math.abs(q) *
            v *
            Math.abs(B);


        forceValue.textContent =
            force === 0
                ? "0 N"
                : `${formatScientific(force)} N`;


        /* -----------------------------------------------
           RADIUS

           r = mv / (|q| |B|)
           ----------------------------------------------- */

        if (
            Math.abs(B) > 0 &&
            v > 0
        ) {

            const radius =
                ELECTRON_MASS * v /
                (
                    Math.abs(q) *
                    Math.abs(B)
                );


            radiusValue.textContent =
                `${formatScientific(radius)} m`;


            /* -------------------------------------------
               ANGULAR VELOCITY

               ω = |q| |B| / m
               ------------------------------------------- */

            const omega =
                Math.abs(q) *
                Math.abs(B) /
                ELECTRON_MASS;


            angularVelocityValue.textContent =
                `${formatScientific(omega)} rad/s`;

        } else {

            radiusValue.textContent = "∞";

            angularVelocityValue.textContent =
                "0 rad/s";
        }


        /* -----------------------------------------------
           EXPLANATION
           ----------------------------------------------- */

        if (B === 0) {

            simulationMessage.textContent =
                "B = 0 T. Magnit kuchi mavjud emas, " +
                "shuning uchun zarra to‘g‘ri chiziq bo‘ylab harakat qiladi.";

        } else if (B > 0 && qSign < 0) {

            simulationMessage.textContent =
                "B > 0: magnit maydoni ekrandan tashqariga. " +
                "Elektron manfiy zaryad bo‘lgani uchun aylanish yo‘nalishi " +
                "musbat zaryadnikiga qarama-qarshi.";

        } else if (B > 0 && qSign > 0) {

            simulationMessage.textContent =
                "B > 0: magnit maydoni ekrandan tashqariga. " +
                "Musbat zaryad uchun Lorentz kuchi v⃗ × B⃗ yo‘nalishida.";

        } else if (B < 0 && qSign < 0) {

            simulationMessage.textContent =
                "B < 0: magnit maydoni ekranga ichkariga. " +
                "Manfiy zaryad uchun aylanish yo‘nalishi B > 0 holatiga nisbatan teskarilanadi.";

        } else {

            simulationMessage.textContent =
                "B < 0: magnit maydoni ekranga ichkariga. " +
                "Musbat zaryad uchun aylanish yo‘nalishi B > 0 holatiga nisbatan teskarilanadi.";
        }
    }


    /* =====================================================
       RESIZE CANVAS
       ===================================================== */

    function resizeCanvas() {

        const rect =
            canvas.getBoundingClientRect();


        const dpr =
            Math.min(
                window.devicePixelRatio || 1,
                2
            );


        const width =
            Math.max(
                320,
                rect.width
            );


        const height =
            Math.max(
                300,
                width * 0.58
            );


        canvas.width =
            Math.floor(width * dpr);


        canvas.height =
            Math.floor(height * dpr);


        canvas.style.height =
            `${height}px`;


        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );


        trail = [];

        draw();
    }


    /* =====================================================
       CANVAS SIZE
       ===================================================== */

    function getCanvasSize() {

        const dpr =
            Math.min(
                window.devicePixelRatio || 1,
                2
            );


        return {
            width:
                canvas.width / dpr,

            height:
                canvas.height / dpr
        };
    }


    /* =====================================================
       BACKGROUND
       ===================================================== */

    function drawBackground(
        width,
        height
    ) {

        ctx.fillStyle =
            "#050912";


        ctx.fillRect(
            0,
            0,
            width,
            height
        );


        /* subtle grid */

        ctx.save();

        ctx.strokeStyle =
            "rgba(255,255,255,0.025)";

        ctx.lineWidth = 1;


        const grid = 40;


        for (
            let x = 0;
            x < width;
            x += grid
        ) {

            ctx.beginPath();

            ctx.moveTo(x, 0);

            ctx.lineTo(
                x,
                height
            );

            ctx.stroke();
        }


        for (
            let y = 0;
            y < height;
            y += grid
        ) {

            ctx.beginPath();

            ctx.moveTo(
                0,
                y
            );

            ctx.lineTo(
                width,
                y
            );

            ctx.stroke();
        }


        ctx.restore();
    }


    /* =====================================================
       MAGNETIC FIELD SYMBOLS
       ===================================================== */

    function drawMagneticField(
        width,
        height,
        centerY
    ) {

        const {
            B
        } = getValues();


        /*
         * B = 0
         */

        if (B === 0) {
            return;
        }


        const spacingX = 62;

        const spacingY = 52;


        ctx.save();


        /*
         * Positive B:
         *
         * ⊙
         *
         * Negative B:
         *
         * ⊗
         */

        const positive =
            B > 0;


        ctx.lineWidth = 1;


        for (
            let y = 30;
            y < height - 20;
            y += spacingY
        ) {

            for (
                let x = 30;
                x < width;
                x += spacingX
            ) {

                /*
                 * Keep central trajectory area
                 * relatively clean.
                 */

                if (
                    Math.abs(y - centerY) < 18
                ) {
                    continue;
                }


                /* circle */

                ctx.strokeStyle =
                    positive
                        ? "rgba(70,175,235,0.55)"
                        : "rgba(255,120,120,0.55)";


                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    7,
                    0,
                    Math.PI * 2
                );

                ctx.stroke();


                if (positive) {

                    /* dot = out of screen */

                    ctx.fillStyle =
                        "rgba(70,175,235,0.90)";


                    ctx.beginPath();

                    ctx.arc(
                        x,
                        y,
                        2.3,
                        0,
                        Math.PI * 2
                    );

                    ctx.fill();

                } else {

                    /*
                     * X = into screen
                     */

                    ctx.strokeStyle =
                        "rgba(255,120,120,0.90)";

                    ctx.lineWidth = 2;


                    ctx.beginPath();

                    ctx.moveTo(
                        x - 4,
                        y - 4
                    );

                    ctx.lineTo(
                        x + 4,
                        y + 4
                    );

                    ctx.moveTo(
                        x + 4,
                        y - 4
                    );

                    ctx.lineTo(
                        x - 4,
                        y + 4
                    );

                    ctx.stroke();
                }
            }
        }


        ctx.restore();
    }


    /* =====================================================
       ENTRY LINE
       ===================================================== */

    function drawEntryLine(
        width,
        centerY
    ) {

        ctx.save();


        ctx.setLineDash([
            6,
            7
        ]);


        ctx.strokeStyle =
            "rgba(49,130,246,0.70)";


        ctx.lineWidth = 2;


        ctx.beginPath();

        ctx.moveTo(
            0,
            centerY
        );

        ctx.lineTo(
            width,
            centerY
        );

        ctx.stroke();


        ctx.restore();
    }


    /* =====================================================
       LABELS
       ===================================================== */

    function drawLabels(
        centerY
    ) {

        const {
            B
        } = getValues();


        ctx.save();


        /* -----------------------------------------------
           TITLE
           ----------------------------------------------- */

        ctx.fillStyle =
            "#ff8052";


        ctx.font =
            "bold 23px Georgia";


        ctx.fillText(
            "Lorentz kuchi",
            18,
            32
        );


        /* -----------------------------------------------
           FORMULA
           ----------------------------------------------- */

        ctx.fillStyle =
            "#dce5f1";


        ctx.font =
            "18px Georgia";


        ctx.fillText(
            "F⃗ = q(v⃗ × B⃗)",
            18,
            58
        );


        /* -----------------------------------------------
           FIELD DIRECTION
           ----------------------------------------------- */

        ctx.font =
            "14px Arial";


        if (B > 0) {

            ctx.fillStyle =
                "#7eb7f7";


            ctx.fillText(
                "B > 0   ⊙   Magnit maydoni ekrandan tashqariga",
                18,
                centerY - 22
            );

        } else if (B < 0) {

            ctx.fillStyle =
                "#ff9292";


            ctx.fillText(
                "B < 0   ⊗   Magnit maydoni ekranga ichkariga",
                18,
                centerY - 22
            );

        } else {

            ctx.fillStyle =
                "#9ba8b8";


            ctx.fillText(
                "B = 0   Magnit maydoni yo‘q",
                18,
                centerY - 22
            );
        }


        ctx.restore();
    }


    /* =====================================================
       TRAJECTORY DATA
       ===================================================== */

    function getTrajectoryData(
        width,
        centerY
    ) {

        const {
            B,
            v,
            qSign
        } = getValues();


        const startX =
            width * 0.50;


        /* -----------------------------------------------
           B = 0
           ----------------------------------------------- */

        if (B === 0) {

            return {
                type: "straight",

                x0: startX,

                y0: centerY
            };
        }


        /* -----------------------------------------------
           ABSOLUTE B FOR RADIUS
           ----------------------------------------------- */

        const absB =
            Math.abs(B);


        /*
         * Real:
         *
         * r = mv / |q| |B|
         *
         * Here visualRadius is scaled for screen.
         */

        const visualRadius =
            Math.min(
                210,
                Math.max(
                    38,
                    125 *
                    (v / 3e6) /
                    absB
                )
            );


        /*
         * DIRECTION
         *
         * The direction of circular motion depends
         * on q × B.
         *
         * We use:
         *
         * direction = sign(q) × sign(B)
         *
         * Negative => one direction
         * Positive => opposite direction
         */

        const direction =
            qSign *
            Math.sign(B);


        return {

            type: "circle",

            x0: startX,

            y0: centerY,

            radius: visualRadius,

            direction
        };
    }


    /* =====================================================
       PARTICLE STATE
       ===================================================== */

    function getParticleState(
        width,
        centerY
    ) {

        const data =
            getTrajectoryData(
                width,
                centerY
            );


        /* -----------------------------------------------
           STRAIGHT MOTION
           ----------------------------------------------- */

        if (
            data.type === "straight"
        ) {

            const distance =
                simulationTime * 90;


            const y =
                centerY -
                Math.min(
                    centerY - 30,
                    distance
                );


            return {

                x: data.x0,

                y,

                /*
                 * Upward velocity.
                 */

                vx: 0,

                vy: -1,

                angle: -Math.PI / 2
            };
        }


        /* -----------------------------------------------
           CIRCULAR MOTION
           ----------------------------------------------- */

        const {
            x0,
            y0,
            radius,
            direction
        } = data;


        /*
         * Visual angular speed.
         *
         * This is animation speed, while
         * physical angular velocity is shown
         * separately.
         */

        const angularSpeed =
            1.7;


        /*
         * Angular position.
         */

        const angle =
            direction *
            simulationTime *
            angularSpeed;


        /*
         * Position:
         *
         * x = x0 + r(1 - cosθ)
         *
         * y = y0 - r sinθ
         */

        const x =
            x0 +
            radius *
            (1 - Math.cos(angle));


        const y =
            y0 -
            radius *
            Math.sin(angle);


        /*
         * Velocity is derivative of position.
         *
         * dx/dt = r sinθ θ'
         *
         * dy/dt = -r cosθ θ'
         *
         * Therefore:
         *
         * v⃗ is ALWAYS tangent to trajectory.
         */

        let vx =
            direction *
            Math.sin(angle);


        let vy =
            -direction *
            Math.cos(angle);


        /*
         * Normalize velocity direction.
         */

        const magnitude =
            Math.sqrt(
                vx * vx +
                vy * vy
            );


        if (magnitude > 0) {

            vx /= magnitude;

            vy /= magnitude;
        }


        return {

            x,

            y,

            vx,

            vy,

            angle
        };
    }


    /* =====================================================
       TRAIL
       ===================================================== */

    function drawTrail() {

        if (
            trail.length < 2
        ) {
            return;
        }


        ctx.save();


        ctx.strokeStyle =
            "#20d5ef";


        ctx.lineWidth = 3;


        ctx.lineCap =
            "round";


        ctx.lineJoin =
            "round";


        ctx.beginPath();


        for (
            let i = 0;
            i < trail.length;
            i++
        ) {

            const point =
                trail[i];


            if (i === 0) {

                ctx.moveTo(
                    point.x,
                    point.y
                );

            } else {

                ctx.lineTo(
                    point.x,
                    point.y
                );
            }
        }


        ctx.stroke();


        ctx.restore();
    }


    /* =====================================================
       GENERIC VECTOR ARROW
       ===================================================== */

    function drawArrow(
        x,
        y,
        dx,
        dy,
        length,
        color,
        label
    ) {

        const magnitude =
            Math.sqrt(
                dx * dx +
                dy * dy
            );


        if (
            magnitude <= 0
        ) {
            return;
        }


        dx /= magnitude;

        dy /= magnitude;


        const endX =
            x +
            dx * length;


        const endY =
            y +
            dy * length;


        const angle =
            Math.atan2(
                dy,
                dx
            );


        const headLength = 11;

        const headAngle =
            Math.PI / 6;


        ctx.save();


        /* -----------------------------------------------
           VECTOR LINE
           ----------------------------------------------- */

        ctx.strokeStyle =
            color;


        ctx.fillStyle =
            color;


        ctx.lineWidth = 3;


        ctx.lineCap =
            "round";


        ctx.beginPath();

        ctx.moveTo(
            x,
            y
        );

        ctx.lineTo(
            endX,
            endY
        );

        ctx.stroke();


        /* -----------------------------------------------
           ARROW HEAD
           ----------------------------------------------- */

        ctx.beginPath();


        ctx.moveTo(
            endX,
            endY
        );


        ctx.lineTo(
            endX -
            headLength *
            Math.cos(
                angle - headAngle
            ),

            endY -
            headLength *
            Math.sin(
                angle - headAngle
            )
        );


        ctx.lineTo(
            endX -
            headLength *
            Math.cos(
                angle + headAngle
            ),

            endY -
            headLength *
            Math.sin(
                angle + headAngle
            )
        );


        ctx.closePath();

        ctx.fill();


        /* -----------------------------------------------
           LABEL
           ----------------------------------------------- */

        if (label) {

            ctx.font =
                "italic 20px Georgia";


            ctx.fillStyle =
                color;


            ctx.fillText(
                label,
                endX + 8,
                endY - 5
            );
        }


        ctx.restore();
    }


    /* =====================================================
       VELOCITY VECTOR
       ===================================================== */

    function drawVelocityVector(
        x,
        y,
        vx,
        vy
    ) {

        /*
         * v⃗ is tangent to trajectory.
         */

        drawArrow(
            x,
            y,
            vx,
            vy,
            62,
            "#39e879",
            "v⃗"
        );
    }


    

/* =====================================================
   LORENTZ FORCE VECTOR
   HAR DOIM AYLANISH MARKAZIGA YO‘NALADI
   ===================================================== */

function drawForceVector(
    x,
    y,
    vx,
    vy,
    angle
) {

    const {
        B
    } = getValues();


    /* B = 0 bo‘lsa Lorentz kuchi yo‘q */

    if (B === 0) {
        return;
    }


    /*
     * Aylana markazi:
     *
     * x_center = x0 + R
     * y_center = y0
     *
     * Bizning trayektoriya tenglamamiz:
     *
     * x = x0 + R(1 - cos θ)
     * y = y0 - R sin θ
     *
     * Demak markazga yo‘nalgan vektor:
     *
     * F ∝ (cos θ, sin θ)
     */


    const fx =
        Math.cos(angle);


    const fy =
        Math.sin(angle);


    /*
     * Kuch vektori uzunligi.
     */

    const forceLength = 52;


    drawArrow(
        x,
        y,
        fx,
        fy,
        forceLength,
        "#ff8052",
        "F⃗"
    );
}



    /* =====================================================
       PARTICLE
       ===================================================== */

    function drawParticle(
        x,
        y
    ) {

        const {
            qSign
        } = getValues();


        ctx.save();


        /* glow */

        const gradient =
            ctx.createRadialGradient(
                x,
                y,
                0,
                x,
                y,
                30
            );


        gradient.addColorStop(
            0,
            "rgba(40,215,245,0.35)"
        );


        gradient.addColorStop(
            1,
            "rgba(40,215,245,0)"
        );


        ctx.fillStyle =
            gradient;


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            30,
            0,
            Math.PI * 2
        );

        ctx.fill();


        /* outer */

        ctx.fillStyle =
            "#dffcff";


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            10,
            0,
            Math.PI * 2
        );

        ctx.fill();


        /* inner */

        ctx.fillStyle =
            "#27ddf7";


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            6,
            0,
            Math.PI * 2
        );

        ctx.fill();


        /* charge */

        ctx.fillStyle =
            "#ffffff";


        ctx.font =
            "bold 12px Arial";


        ctx.textAlign =
            "center";


        ctx.textBaseline =
            "middle";


        ctx.fillText(
            qSign < 0
                ? "e⁻"
                : "q⁺",
            x,
            y
        );


        ctx.restore();
    }


    /* =====================================================
       DRAW ALL
       ===================================================== */

    function draw() {

        const {
            width,
            height
        } = getCanvasSize();


        const centerY =
            height * 0.60;


        /* background */

        drawBackground(
            width,
            height
        );


        /* B field */

        drawMagneticField(
            width,
            height,
            centerY
        );


        /* entry line */

        drawEntryLine(
            width,
            centerY
        );


        /* labels */

        drawLabels(
            centerY
        );


        /* trajectory */

        drawTrail();


        /* particle state */

        const state =
            getParticleState(
                width,
                centerY
            );


        /* velocity vector */

        drawVelocityVector(
            state.x,
            state.y,
            state.vx,
            state.vy
        );


        /* Lorentz force */

        drawForceVector(
            state.x,
            state.y,
            state.vx,
            state.vy,
            state.angle
        );


        /* particle */

        drawParticle(
            state.x,
            state.y
        );
    }


    /* =====================================================
       ANIMATION
       ===================================================== */

    function animationLoop(
        timestamp
    ) {

        if (!running) {
            return;
        }


        if (!lastTime) {
            lastTime =
                timestamp;
        }


        const delta =
            Math.min(
                0.04,
                (timestamp - lastTime) / 1000
            );


        lastTime =
            timestamp;


        simulationTime +=
            delta;


        const {
            width,
            height
        } = getCanvasSize();


        const centerY =
            height * 0.60;


        const state =
            getParticleState(
                width,
                centerY
            );


        /*
         * Save trajectory point.
         */

        trail.push({
            x: state.x,
            y: state.y
        });


        /*
         * Limit trail length.
         */

        if (
            trail.length > 700
        ) {

            trail.shift();
        }


        draw();


        animationFrame =
            requestAnimationFrame(
                animationLoop
            );
    }


    /* =====================================================
       START
       ===================================================== */

    function startSimulation() {

        if (running) {
            return;
        }


        running = true;

        lastTime = 0;


        animationFrame =
            requestAnimationFrame(
                animationLoop
            );
    }


    /* =====================================================
       PAUSE
       ===================================================== */

    function pauseSimulation() {

        running = false;

        lastTime = 0;


        if (
            animationFrame !== null
        ) {

            cancelAnimationFrame(
                animationFrame
            );


            animationFrame = null;
        }
    }


    /* =====================================================
       RESET
       ===================================================== */

    function resetSimulation() {

        pauseSimulation();


        simulationTime = 0;


        trail = [];


        draw();
    }


    /* =====================================================
       EVENTS
       ===================================================== */

    if (startButton) {

        startButton.addEventListener(
            "click",
            startSimulation
        );
    }


    if (pauseButton) {

        pauseButton.addEventListener(
            "click",
            pauseSimulation
        );
    }


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetSimulation
        );
    }


    if (magneticField) {

        magneticField.addEventListener(
            "input",
            () => {

                updatePhysics();


                /*
                 * Parameter o‘zgarganda
                 * eski trailni tozalaymiz.
                 */

                trail = [];


                if (!running) {
                    draw();
                }
            }
        );
    }


    if (velocity) {

        velocity.addEventListener(
            "input",
            () => {

                updatePhysics();

                trail = [];


                if (!running) {
                    draw();
                }
            }
        );
    }


    if (particleCharge) {

        particleCharge.addEventListener(
            "change",
            () => {

                updatePhysics();

                trail = [];


                if (!running) {
                    draw();
                }
            }
        );
    }


    /* =====================================================
       WINDOW RESIZE
       ===================================================== */

    window.addEventListener(
        "resize",
        resizeCanvas
    );


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    updatePhysics();

    resizeCanvas();

})();