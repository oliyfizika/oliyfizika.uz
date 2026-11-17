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

# 4: stol + blok + osilgan yuk
def p4(rng):
    m1, m2, mu, g = 4, 6, 0.25, 10
    a = (m2 * g - mu * m1 * g) / (m1 + m2); Tn = m1 * (a + mu * g); h = 3.6; v = math.sqrt(2 * a * h)
    fig = T(r"""
\draw[fill=gray!10] (0,0.6) rectangle (4,0.8); \draw (0.3,0.6)--(0.3,-0.5) (3.7,0.6)--(3.7,-0.5);
\draw[fill=gray!35] (0.7,0.8) rectangle (1.7,1.5); \node at (1.2,1.15) {$m_1$};
\draw (1.7,1.15)--(4.2,1.15); \draw[fill=white] (4.2,0.95) circle(0.2); \fill (4.2,0.95) circle(1pt);
\draw (4.4,0.95)--(4.4,0.0); \draw[fill=gray!35] (4.05,-0.7) rectangle (4.75,0.0); \node at (4.4,-0.35) {$m_2$};
""")
    intro = rf"Gorizontal stol ustidagi $m_1={m1}$ kg massali blok vaznsiz ip orqali vaznsiz blokdan oshirilib, $m_2={m2}$ kg massali yukka bog‘langan (rasm). Blok va stol orasidagi ishqalanish koeffitsiyenti $\mu=0{{,}}25$. $g=10$ m/s$^2$."
    qs = ["Yuklarning tezlanishini (m/s$^2$) toping.", "Ipning tarangligini (N) toping.", "$m_2$ yuk $3{,}6$ m pastga tushgandagi tezligini (m/s) toping."]
    return pack(fig, intro, qs, [a, Tn, v], [4.0, 36.0, 8.0], lambda x: nf(x), rng)

# 5: gorizontal otilgan jism
def p5(rng):
    v0, h = 15, 20
    t = math.sqrt(2 * h / 10); L = v0 * t; vy = 10 * t; v = math.hypot(v0, vy)
    fig = T(r"""
\fill[gray!25] (0,0) rectangle (1.6,2.6); \draw (0,2.6)--(1.6,2.6)--(1.6,0); \draw (-0.3,0)--(6.2,0); """ + G + r""" (-0.3,-0.15) rectangle (6.2,0);
\fill (1.6,2.6) circle(1.8pt); \draw[->] (1.6,2.6)--(2.5,2.6) node[above]{$v_0$};
\draw[dashed,domain=0:4.3,samples=40] plot ({1.6+\x},{2.6-0.1406*\x*\x});
\draw[<->] (0.9,0)--(0.9,2.6); \node[left] at (0.9,1.3) {$h$}; \draw[<->] (1.6,-0.35)--(5.9,-0.35); \node[below] at (3.75,-0.35) {$L$};""")
    intro = rf"Balandligi $h={h}$ m bo‘lgan minoradan jism gorizontal yo‘nalishda $v_0={v0}$ m/s tezlik bilan otildi (rasm). Havoning qarshiligini hisobga olmang, $g=10$ m/s$^2$."
    qs = ["Jismning uchish vaqtini (s) toping.", "Otilgan joydan tushgan joygacha gorizontal masofa $L$ ni (m) toping.", "Yerga urilish paytidagi tezlik modulini (m/s) toping."]
    return pack(fig, intro, qs, [t, L, v], [3.0, 40.0, 35.0], lambda x: nf(x), rng)

# 6: Atvud mashinasi
def p6(rng):
    m1, m2, g = 3, 5, 10
    a = (m2 - m1) * g / (m1 + m2); Tn = 2 * m1 * m2 * g / (m1 + m2); F = 2 * Tn
    fig = T(r"""
\draw (0,3.3)--(2.4,3.3); """ + G + r""" (0,3.3) rectangle (2.4,3.45); \draw (1.2,3.3)--(1.2,2.85); \draw[fill=white] (1.2,2.45) circle(0.4); \fill (1.2,2.45) circle(1.2pt);
\draw (0.8,2.45)--(0.8,1.2); \draw[fill=gray!35] (0.5,0.6) rectangle (1.1,1.2); \node at (0.8,0.9) {$m_1$};
\draw (1.6,2.45)--(1.6,0.6); \draw[fill=gray!35] (1.25,0.0) rectangle (1.95,0.6); \node at (1.6,0.3) {$m_2$};""")
    intro = rf"Vaznsiz blokdan oshirilgan vaznsiz ipning uchlariga $m_1={m1}$ kg va $m_2={m2}$ kg massali yuklar osilgan (rasm). Ishqalanish yo‘q, $g=10$ m/s$^2$."
    qs = ["Yuklarning tezlanishini (m/s$^2$) toping.", "Ipning tarangligini (N) toping.", "Blok o‘qiga ta’sir qiluvchi kuchni (N) toping."]
    return pack(fig, intro, qs, [a, Tn, F], [5.0, 40.0, 80.0], lambda x: nf(x), rng)

# 7: p-V sikl
def p7(rng):
    p1, p2, V1, V2 = 300, 100, 2, 6
    W12 = p1 * 1e3 * (V2 - V1) * 1e-3; A = (p1 - p2) * 1e3 * (V2 - V1) * 1e-3; Q12 = 2.5 * W12
    fig = T(r"""
\draw[->] (0,0)--(5.2,0) node[right]{$V,\ \mathrm{L}$}; \draw[->] (0,0)--(0,3.6) node[above]{$p,\ \mathrm{kPa}$};
\draw[very thick] (1.2,2.8)--(3.9,2.8)--(3.9,1.0)--(1.2,1.0)--cycle;
\draw[->,very thick] (1.2,2.8)--(2.7,2.8); \draw[->,very thick] (3.9,2.8)--(3.9,1.9); \draw[->,very thick] (3.9,1.0)--(2.5,1.0); \draw[->,very thick] (1.2,1.0)--(1.2,1.9);
\draw[dashed] (0,2.8)--(1.2,2.8) (0,1.0)--(1.2,1.0) (1.2,0)--(1.2,1.0) (3.9,0)--(3.9,1.0);
\node[left] at (0,2.8) {$300$}; \node[left] at (0,1.0) {$100$}; \node[below] at (1.2,0) {$2$}; \node[below] at (3.9,0) {$6$};
\node[above left] at (1.2,2.8) {1}; \node[above right] at (3.9,2.8) {2}; \node[below right] at (3.9,1.0) {3}; \node[below left] at (1.2,1.0) {4};""")
    intro = "Bir atomli ideal gaz rasmda ko‘rsatilgan 1–2–3–4–1 siklni bajaradi."
    qs = ["1–2 jarayonda gazning bajargan ishini (J) toping.", "Bir sikl davomida gaz bajargan sof ishni (J) toping.", "1–2 jarayonda gazga berilgan issiqlik miqdorini (J) toping."]
    return pack(fig, intro, qs, [W12, A, Q12], [600.0, 2400.0, 1800.0], lambda x: nf(x), rng)

# 8: linza
def p8(rng):
    F, d, h = 20, 30, 3
    f = d * F / (d - F); k = f / d; hh = h * k
    fig = T(r"""
\draw[->] (-4.0,0)--(4.6,0); \draw[<->] (0,-1.5)--(0,1.5);
\draw[->,very thick] (-3.0,0)--(-3.0,0.9) node[above]{$h$};
\fill (-2.0,0) circle(1.2pt) node[below]{$F$}; \fill (2.0,0) circle(1.2pt) node[below]{$F$};
\draw[<->] (-3.0,-0.8)--(0,-0.8); \node[below] at (-1.5,-0.8) {$d=30\ \mathrm{cm}$};
\draw (-3.0,0.9)--(0,0.9)--(2.0,0)--(4.0,-0.9); \draw (-3.0,0.9)--(4.0,-1.2);
""")
    intro = rf"Fokus masofasi $F={F}$ cm bo‘lgan yig‘uvchi linzadan $d={d}$ cm masofada balandligi $h={h}$ cm bo‘lgan buyum turibdi (rasm)."
    qs = ["Linzadan tasvirgacha bo‘lgan masofani (cm) toping.", "Linzaning chiziqli kattalashtirishini toping.", "Tasvirning balandligini (cm) toping."]
    return pack(fig, intro, qs, [f, k, hh], [50.0, 3.0, 4.5], lambda x: nf(x), rng)

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
