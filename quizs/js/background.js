const bgContainer =
document.getElementById("background-texts");

if(bgContainer){

const texts = [];

for(let i = 0; i < 8; i++){

const el =
document.createElement("div");

el.className =
"floating-text";

el.innerText =
"OliyFizika.uz";

bgContainer.appendChild(el);

texts.push({

el,

x: Math.random() *
(window.innerWidth - 200),

y: Math.random() *
(window.innerHeight - 50),

dx:
(Math.random() * 2 + 1) *
(Math.random() > 0.5 ? 1 : -1),

dy:
(Math.random() * 2 + 1) *
(Math.random() > 0.5 ? 1 : -1)

});

}

function animateTexts(){

texts.forEach(t=>{

t.x += t.dx;
t.y += t.dy;

const w =
t.el.offsetWidth;

const h =
t.el.offsetHeight;

if(
t.x <= 0 ||
t.x + w >= window.innerWidth
){
t.dx *= -1;
}

if(
t.y <= 0 ||
t.y + h >= window.innerHeight
){
t.dy *= -1;
}

t.el.style.transform =
`translate(${t.x}px, ${t.y}px)`;

});

requestAnimationFrame(
animateTexts
);

}

animateTexts();

}