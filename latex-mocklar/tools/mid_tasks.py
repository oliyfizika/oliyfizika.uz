"""33–35-savollar: har bir mock uchun turli masala (bitta masala — 3 ta qiymat — 6 ta variant A–F).
Mock 1 — ampermetrli ko‘prik (make_mocks da), 2–10 — shu fayldagi masalalar. Javoblar kodda hisoblanadi."""
import random, math
from fractions import Fraction as Fr
from open_tasks import num

H = r"\begin{tikzpicture}[x=1cm,y=1cm,line width=0.5pt,>=Stealth,font=\small]"
E = r"\end{tikzpicture}"
def T(b): return H + "\n" + b.strip() + "\n" + E
G = r"\fill[pattern=north east lines,draw=none]"
def R_h(x, y, lab, w=0.8):  # gorizontal qarshilik
    return rf"\draw[fill=white] ({x-w/2},{y-0.15}) rectangle ({x+w/2},{y+0.15}); \node[above] at ({x},{y+0.15}) {{{lab}}};"
def R_v(x, y, lab, h=0.8):
    return rf"\draw[fill=white] ({x-0.15},{y-h/2}) rectangle ({x+0.15},{y+h/2}); \node[right] at ({x+0.17},{y}) {{{lab}}};"
def batt(x, y, lab):  # vertikal batareya
    return rf"\draw ({x-0.3},{y})--({x+0.3},{y}); \draw ({x-0.15},{y-0.22})--({x+0.15},{y-0.22}); \node[left] at ({x-0.35},{y-0.1}) {{{lab}}};"

def pack(fig, intro, qs, ans_vals, distract, fmt, rng, units=None):
    """ans_vals: 3 ta son; distract: 3 ta noto‘g‘ri son. Variantlar aralashtiriladi."""
    vals = list(ans_vals) + list(distract)
    assert len({round(v, 9) for v in vals}) == 6, vals
    order = sorted(range(6), key=lambda i: vals[i])
    opts = [fmt(vals[i]) for i in order]
    key = tuple("ABCDEF"[order.index(i)] for i in range(3))
    return dict(fig=fig, intro=intro, qs=qs, opts=opts, key=key, ans=[fmt(v) for v in ans_vals])

def nf(x, nd=None): return num(x, nd)

# 2: batareya + aralash ulanish
def p2(rng):
    e, r, R1, R2, R3 = 40, 1, 8, 8, 5
    Rp = R1 * R2 / (R1 + R2); I = e / (r + Rp + R3); U = e - I * r; I1 = I / 2
    fig = T(r"""
\draw (0,0.7)--(0,0)--(5.2,0)--(5.2,2.0)--(4.6,2.0); \draw (0,1.0)--(0,2.0)--(1.2,2.0);
\draw (-0.3,1.0)--(0.3,1.0); \draw (-0.15,0.7)--(0.15,0.7); \node[left] at (-0.35,0.85) {$\varepsilon,\ r$};
\draw (1.2,2.9)--(1.2,1.1) (3.2,2.9)--(3.2,1.1);
\draw (1.2,2.9)--(1.8,2.9); \draw[fill=white] (1.8,2.75) rectangle (2.6,3.05); \node[above] at (2.2,3.05) {$R_1$}; \draw (2.6,2.9)--(3.2,2.9);
\draw (1.2,1.1)--(1.8,1.1); \draw[fill=white] (1.8,0.95) rectangle (2.6,1.25); \node[above] at (2.2,1.25) {$R_2$}; \draw (2.6,1.1)--(3.2,1.1);
\draw (3.2,2.0)--(3.8,2.0); \draw[fill=white] (3.8,1.85) rectangle (4.6,2.15); \node[above] at (4.2,2.15) {$R_3$};
\fill (1.2,2.0) circle(1.2pt) (3.2,2.0) circle(1.2pt);
""")
    intro = rf"Rasmda elektr zanjir tasvirlangan: $\varepsilon={e}$ V, $r={r}\ \Omega$, $R_1={R1}\ \Omega$, $R_2={R2}\ \Omega$, $R_3={R3}\ \Omega$."
    qs = ["Batareyadan o‘tayotgan tok kuchini (A) aniqlang.", "Batareya qisqichlaridagi kuchlanishni (V) toping.", "$R_1$ qarshilikdan o‘tayotgan tok kuchini (A) aniqlang."]
    return pack(fig, intro, qs, [I, U, I1], [5.0, 32.0, 8.0], lambda v: nf(v), rng)

# 3: kondensatorlar
def p3(rng):
    e, C1, C2, C3 = 12, 6, 3, 3
    C23 = C2 + C3; C = C1 * C23 / (C1 + C23); q = C * e; U1 = q / C1; W = C * e * e / 2
    fig = T(r"""
\draw (0,0)--(0,1.0) (0,1.3)--(0,2.4)--(1.5,2.4); \draw (-0.3,1.3)--(0.3,1.3); \draw (-0.15,1.0)--(0.15,1.0); \node[left] at (-0.35,1.15) {$\varepsilon$};
\draw (1.5,2.1)--(1.5,2.7) (1.8,2.1)--(1.8,2.7); \draw (1.8,2.4)--(5.0,2.4); \node[above] at (1.65,2.75) {$C_1$};
\draw (0,0)--(5.0,0);
\foreach \x/\n in {3.3/C_2,5.0/C_3}{\draw (\x,2.4)--(\x,1.35) (\x,1.05)--(\x,0); \draw (\x-0.3,1.35)--(\x+0.3,1.35) (\x-0.3,1.05)--(\x+0.3,1.05); \node[right] at (\x+0.3,1.2) {$\n$};}
\fill (3.3,2.4) circle(1.2pt) (3.3,0) circle(1.2pt);
""")
    intro = rf"Rasmda EYuK manbai va kondensatorlardan iborat zanjir tasvirlangan: $\varepsilon={e}$ V, $C_1={C1}\ \mu$F, $C_2={C2}\ \mu$F, $C_3={C3}\ \mu$F."
    qs = ["Manbadan zanjirga o‘tgan zaryad miqdorini ($\\mu$C) toping.", "$C_1$ kondensatordagi kuchlanishni (V) toping.", "Zanjirning to‘liq energiyasini ($\\mu$J) toping."]
    return pack(fig, intro, qs, [q, U1, W], [e * C1, q / 2, W / 2], lambda v: nf(v), rng)

# 4: ikki isitgich (ketma-ket va parallel)
def p4(rng):
    U, P1, P2 = 120, 360, 180
    R1, R2 = U * U / P1, U * U / P2; I = U / (R1 + R2); P1s = I * I * R1; Ppar = P1 + P2
    fig = T(r"""
\draw (0,0.3)--(0,0)--(4.6,0)--(4.6,1.6)--(4.0,1.6); \draw (0,0.6)--(0,1.6)--(0.9,1.6);
\draw (-0.3,0.6)--(0.3,0.6); \draw (-0.15,0.3)--(0.15,0.3); \node[left] at (-0.35,0.45) {$U$};
\draw[fill=white] (0.9,1.45) rectangle (1.9,1.75); \node[above] at (1.4,1.75) {$R_1$}; \draw (1.9,1.6)--(3.0,1.6);
\draw[fill=white] (3.0,1.45) rectangle (4.0,1.75); \node[above] at (3.5,1.75) {$R_2$};""")
    intro = rf"Nominal kuchlanishi {U} V bo‘lgan ikkita isitgichning nominal quvvatlari $P_1={P1}$ W va $P_2={P2}$ W. Isitgichlar ketma-ket ulanib, {U} V kuchlanishli tarmoqqa ulandi (rasm). Qarshiliklar o‘zgarmas deb hisoblansin."
    qs = ["Zanjirdagi tok kuchini (A) toping.", "Birinchi isitgichda ajralayotgan quvvatni (W) toping.", "Isitgichlar shu tarmoqqa parallel ulanganda umumiy quvvatni (W) toping."]
    return pack(fig, intro, qs, [I, P1s, Ppar], [3.0, 80.0 + 40, 120.0 * 0 + 270], lambda x: nf(x), rng)

# 5: ikki manba ketma-ket
def p5(rng):
    e1, r1, e2, r2, R = 6, 0.5, 3, 0.5, 8
    I = (e1 + e2) / (r1 + r2 + R); U = I * R; U2 = e2 - I * r2
    fig = T(r"""
\draw (0,0)--(0,0.55) (0,0.85)--(0,1.55) (0,1.85)--(0,2.4)--(4.0,2.4)--(4.0,1.6) (4.0,0.8)--(4.0,0)--(0,0);
\draw (-0.3,1.85)--(0.3,1.85) (-0.15,1.55)--(0.15,1.55); \node[left] at (-0.35,1.7) {$\varepsilon_1, r_1$};
\draw (-0.3,0.85)--(0.3,0.85) (-0.15,0.55)--(0.15,0.55); \node[left] at (-0.35,0.7) {$\varepsilon_2, r_2$};
\draw[fill=white] (3.85,0.8) rectangle (4.15,1.6); \node[right] at (4.2,1.2) {$R$};""")
    intro = rf"Rasmdagi zanjirda $\varepsilon_1={e1}$ V, $r_1={nf(r1)}\ \Omega$, $\varepsilon_2={e2}$ V, $r_2={nf(r2)}\ \Omega$, $R={R}\ \Omega$."
    qs = ["Zanjirdagi tok kuchini (A) toping.", "$R$ qarshilikdagi kuchlanishni (V) toping.", "Ikkinchi manba qisqichlaridagi kuchlanishni (V) toping."]
    return pack(fig, intro, qs, [I, U, U2], [9.0, 3.0, 6.0 - 0.5], lambda x: nf(x), rng)

# 6: galvanometrni ampermetr va voltmetrga aylantirish
def p6(rng):
    Rg, Ig, Imax, Umax = 99, 0.01, 1, 10
    Rsh = Ig * Rg / (Imax - Ig); Rad = Umax / Ig - Rg; Rv = Umax / Ig
    fig = T(r"""
\draw (0,0)--(0.8,0); \draw[fill=white] (1.2,0) circle(0.35) node{$G$}; \draw (1.55,0)--(2.6,0); \draw (0.8,0)--(0.8,-0.9)--(1.0,-0.9);
\draw[fill=white] (1.0,-1.05) rectangle (1.8,-0.75); \node[below] at (1.4,-1.05) {$R_{sh}$}; \draw (1.8,-0.9)--(2.2,-0.9)--(2.2,0);
\fill (0.8,0) circle(1.2pt) (2.2,0) circle(1.2pt);""")
    intro = rf"Galvanometrning ichki qarshiligi $R_g={Rg}\ \Omega$, unga ulanishi mumkin bo‘lgan eng katta tok $I_g={int(Ig*1000)}$ mA. Rasmda galvanometrga shunt ulangan sxema keltirilgan."
    qs = ["Galvanometrni 1 A gacha tokni o‘lchaydigan ampermetrga aylantirish uchun shunt qarshiligini ($\\Omega$) toping.",
          "Galvanometrni 10 V gacha kuchlanishni o‘lchaydigan voltmetrga aylantirish uchun ketma-ket ulanadigan qo‘shimcha qarshilikni ($\\Omega$) toping.",
          "Hosil bo‘lgan voltmetrning ichki qarshiligini ($\\Omega$) toping."]
    return pack(fig, intro, qs, [Rsh, Rad, Rv], [0.99, 990.0, 99.0 + 1], lambda x: nf(x), rng)

# 7: o‘zgarmas tok zanjiridagi kondensator
def p7(rng):
    e, r, R1, R2, C = 12, 1, 3, 2, 5
    I = e / (r + R1 + R2); Uc = I * R2; q = C * Uc
    fig = T(r"""
\draw (0,0)--(0,0.6) (0,0.9)--(0,1.8)--(1.2,1.8); \draw (-0.3,0.9)--(0.3,0.9) (-0.15,0.6)--(0.15,0.6); \node[left] at (-0.35,0.75) {$\varepsilon, r$};
\draw[fill=white] (1.2,1.65) rectangle (2.0,1.95); \node[above] at (1.6,1.95) {$R_1$}; \draw (2.0,1.8)--(3.0,1.8)--(3.0,1.3) (3.0,0.5)--(3.0,0)--(0,0);
\draw[fill=white] (2.85,0.5) rectangle (3.15,1.3); \node[left] at (2.8,0.9) {$R_2$};
\draw (3.0,1.8)--(4.2,1.8)--(4.2,1.05) (4.2,0.75)--(4.2,0)--(3.0,0); \draw (3.9,1.05)--(4.5,1.05) (3.9,0.75)--(4.5,0.75); \node[right] at (4.5,0.9) {$C$};
\fill (3.0,1.8) circle(1.2pt) (3.0,0) circle(1.2pt);""")
    intro = rf"Rasmdagi zanjirda $\varepsilon={e}$ V, $r={r}\ \Omega$, $R_1={R1}\ \Omega$, $R_2={R2}\ \Omega$, $C={C}\ \mu$F. Zanjirda tok qaror topgan."
    qs = ["Manbadan o‘tayotgan tok kuchini (A) toping.", "Kondensatordagi kuchlanishni (V) toping.", "Kondensatordagi zaryadni ($\\mu$C) toping."]
    return pack(fig, intro, qs, [I, Uc, q], [2.4, 6.0, 30.0], lambda x: nf(x), rng)

# 8: ketma-ket RLC zanjir (o‘zgaruvchan tok)
def p8(rng):
    R, XL, XC, U = 30, 70, 30, 100
    Z = math.hypot(R, XL - XC); I = U / Z; UR = I * R; P = I * I * R
    fig = T(r"""
\draw (0,0)--(0.5,0); \draw[fill=white] (0.5,-0.15) rectangle (1.3,0.15); \node[above] at (0.9,0.15) {$R$};
\draw (1.3,0)--(1.7,0); \draw[decorate,decoration={coil,aspect=0.6,segment length=4.5,amplitude=3.5}] (1.7,0)--(2.9,0); \node[above] at (2.3,0.2) {$L$};
\draw (2.9,0)--(3.5,0); \draw (3.5,-0.3)--(3.5,0.3) (3.75,-0.3)--(3.75,0.3); \node[above] at (3.62,0.3) {$C$}; \draw (3.75,0)--(4.4,0);
\draw (0,0)--(0,-0.8)--(1.9,-0.8); \draw (2.5,-0.8)--(4.4,-0.8)--(4.4,0); \draw (2.2,-0.8) circle(0.3); \draw (2.05,-0.8) sin (2.13,-0.7) cos (2.2,-0.8) sin (2.28,-0.9) cos (2.35,-0.8);""")
    intro = rf"Effektiv kuchlanishi $U={U}$ V bo‘lgan o‘zgaruvchan tok manbaiga ketma-ket ulangan rezistor ($R={R}\ \Omega$), g‘altak ($X_L={XL}\ \Omega$) va kondensator ($X_C={XC}\ \Omega$) ulangan (rasm)."
    qs = ["Zanjirdagi tok kuchining effektiv qiymatini (A) toping.", "Rezistordagi kuchlanishning effektiv qiymatini (V) toping.", "Zanjirda ajralayotgan aktiv quvvatni (W) toping."]
    return pack(fig, intro, qs, [I, UR, P], [1.0, 200.0, 100.0 + 0.0 * 0 + 0], lambda x: nf(x), rng)

# 9: ikki nuqtaviy zaryad (dipol)
def p9(rng):
    k = 9e9; q = 4e-9; r = 0.03; q0 = 2e-9
    Eo = 2 * k * q / r ** 2; phi = 0.0; F = q0 * Eo
    fig = T(r"""
\draw (0,0)--(5.0,0); \foreach \x/\n in {0/{+q},5.0/{-q}}{\draw[fill=white] (\x,0) circle(0.2); \node[above=5pt] at (\x,0) {$\n$};}
\draw (-0.14,0)--(0.14,0) (0,-0.14)--(0,0.14); \draw (4.86,0)--(5.14,0);
\fill (2.5,0) circle(1.6pt) node[below=3pt]{$A$}; \draw[<->] (0.2,-0.9)--(4.8,-0.9); \node[below] at (2.5,-0.9) {$6\ \mathrm{cm}$};""")
    intro = "Vakuumda bir-biridan 6 cm masofada turgan $q=+4$ nC va $-q$ zaryadlar orasidagi kesmaning o‘rtasida $A$ nuqta joylashgan (rasm). $k=9\\cdot10^9\\ \\mathrm{N\\cdot m^2/C^2}$."
    qs = ["$A$ nuqtadagi elektr maydon kuchlanganligini (kV/m) toping.", "$A$ nuqtadagi maydon potensialini (V) toping.", "$A$ nuqtaga qo‘yilgan $2$ nC zaryadga ta’sir qiluvchi kuchni ($\\mu$N) toping."]
    return pack(fig, intro, qs, [Eo / 1e3, phi, F * 1e6], [40.0, 320.0, 20.0], lambda x: nf(x), rng)

# 10: relsda sirpanayotgan sterjen
def p10(rng):
    B, l, v, R = 0.5, 0.4, 5, 0.5
    e = B * l * v; I = e / R; F = B * I * l
    fig = T(r"""
\draw[line width=1pt] (0,0)--(5.0,0) (0,2)--(5.0,2); \draw (0,0)--(0,0.7) (0,1.3)--(0,2); \draw[fill=white] (-0.15,0.7) rectangle (0.15,1.3); \node[left] at (-0.2,1) {$R$};
\foreach \x in {0.9,1.6,2.3,3.0,3.7,4.4}{\foreach \y in {0.35,1.0,1.65}{\node[font=\scriptsize,gray] at (\x,\y) {$\times$};}}
\draw[line width=1.8pt] (2.6,-0.15)--(2.6,2.15); \draw[->,thick] (2.6,1.0)--(3.9,1.0) node[above]{$\vec v$}; \node[above right] at (4.4,2.0) {$\vec B$};""")
    intro = rf"Bir jinsli magnit maydonda ($B={nf(B)}$ T, maydon chiziqlari rasm tekisligiga tik) uzunligi $l={nf(l)}$ m bo‘lgan o‘tkazgich sterjen tezlikka tik yo‘nalishda $v={v}$ m/s tezlik bilan siljiydi. Relslarning qarshiligi nolga teng, zanjirning qarshiligi $R={nf(R)}\ \Omega$."
    qs = ["Sterjenda induksiyalangan EYuKni (V) toping.", "Zanjirdagi tok kuchini (A) toping.", "Sterjenga ta’sir qiluvchi Amper kuchini (N) toping."]
    return pack(fig, intro, qs, [e, I, F], [0.5, 4.0, 0.8], lambda x: nf(x), rng)

TASKS = [None, p2, p3, p4, p5, p6, p7, p8, p9, p10]
def mid_task(m):
    return TASKS[m](random.Random(500 + m))
if __name__ == "__main__":
    for m in range(1, 10):
        d = mid_task(m); print(m + 1, d["ans"], d["key"], d["opts"])
