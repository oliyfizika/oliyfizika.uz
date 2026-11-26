"""33-45-savollar: ochiq topshiriqlar (parametrli shablonlar, javoblar kod bilan hisoblanadi). g = 10 m/s²."""
from fractions import Fraction as Fr
import itertools, random

def num(x, nd=None):
    """Son -> o'nlik vergulli matn (ortiqcha nollarsiz)."""
    if isinstance(x, Fr): x = float(x)
    s = f"{x:.{nd}f}" if nd is not None else f"{x:.6g}"
    if nd is None and 'e' in s: s = f"{x:.10f}".rstrip('0').rstrip('.')
    if '.' in s: s = s.rstrip('0').rstrip('.')
    return s.replace('.', ',')

# ---------------------------------------------------------------- 33-35 (ampermetrli ko'prik)
def bridge_sets(n=10, seed=7):
    cand = []
    Rs = [1, 2, 3, 4, 6, 12]
    for R1, R2, R3, R4 in itertools.product(Rs, repeat=4):
        if R1 * R4 == R2 * R3: continue
        for U in (6, 12, 18, 24, 30, 36, 48):
            rt = Fr(R1 * R2, R1 + R2) + Fr(R3 * R4, R3 + R4)
            I = Fr(U) / rt
            I1 = I * R2 / (R1 + R2); I3 = I * R4 / (R3 + R4)
            I2 = abs(I1 - I3)
            vals = [I, I1, I2]
            ok = all((v * 2).denominator == 1 and v > 0 for v in vals + [I3])
            if not ok or len({I, I1, I2, I3}) < 4 or max(I, I1, I3) > 24 or (R1, R2) == (R3, R4): continue
            cand.append((U, R1, R2, R3, R4, I1, I2, I, I3))
    random.Random(seed).shuffle(cand)
    out, seen = [], set()
    for c in cand:
        key = (c[1:5])
        if key in seen: continue
        seen.add(key); out.append(c)
        if len(out) == n: break
    return out

def bridge_task(k, rng):
    U, R1, R2, R3, R4, I1, I2, I, I3 = bridge_sets()[k]
    opts = {I, I1, I2, I3}
    extra = [I1 + I3, abs(I - I1), I / 2, I1 / 2, I2 + 1, I + 1, I3 / 2, I3 + I1 / 2]
    for e in extra:
        if len(opts) >= 6: break
        if e > 0 and (e * 2).denominator == 1: opts.add(e)
    opts = sorted(opts)[:6] if len(opts) > 6 else sorted(opts)
    rng.shuffle(opts)
    letters = "ABCDEF"
    key = tuple(letters[opts.index(v)] for v in (I1, I2, I))
    return dict(U=U, R=(R1, R2, R3, R4), opts=[num(float(o)) for o in opts], key=key,
                ans=(num(float(I1)), num(float(I2)), num(float(I))))

# ---------------------------------------------------------------- 36-45 (a, b ochiq)
# Har bir funksiya: (shart, [(a_matn, a_javob), (b_matn, b_javob)], figura_kodi|None)
def t36(k):
    P = [(2,2,50,60),(3,2,100,150),(2,3,40,80),(4,1,80,160),(5,1,150,225),(3,3,90,180),(2,4,60,120),(4,2,200,300),(3,1,60,110),(5,2,100,300)]
    a, n, S, M = P[k]   # a cm, n ta muz, S cm², M g (umumiy suv massasi)
    ice = 0.9 * a ** 3 * n; w = M - ice
    p = M * 1e-3 * 10 / (S * 1e-4); F = M * 1e-3 * 10
    st = (f"Qirrasining uzunligi {a} cm bo‘lgan kub shaklidagi {n} ta muz bo‘lagi asosining yuzasi {S} cm$^2$ bo‘lgan, "
          f"{num(w)} g suv quyilgan silindrik idishda tashlandi. $\\rho_{{muz}}=900$ kg/m$^3$.")
    return st, [("Muzlar erib ketgandan so‘ng suyuqlikning idish tubiga beradigan bosimini (Pa) toping.", num(p)),
                ("Muzlar erib ketgandan so‘ng suyuqlikning idish tubiga beradigan bosim kuchini (N) hisoblang.", num(F, 3))], None

def t37(k):
    P = [(27,8),(18,4),(36,6),(45,10),(27,5),(36,12),(18,10),(45,20),(54,18),(63,14)]
    H, y = P[k]
    hw = Fr(4 * H, 9); hk = H - hw
    # y: tubidan balandlik; suv pastda
    if y <= hw: p = 800 * 10 * float(hk) / 100 + 1000 * 10 * float(hw - y) / 100
    else: p = 800 * 10 * float(H - y) / 100
    st = f"Silindrik idishga teng massali suv va kerosin quyildi. Suyuqliklar ustunining umumiy balandligi {H} cm ga teng. $\\rho_{{kerosin}}=800$ kg/m$^3$."
    return st, [("Suv ustunining balandligini (cm) aniqlang.", num(hw)),
                (f"Idish tubidan {y} cm balandlikdagi nuqtada suyuqliklarning hosil qilgan umumiy bosimini (Pa) toping.", num(p))], None

def t38(k):
    P = [(37,12,20),(53,4,10),(37,3,15),(53,9,5),(37,27,8),(53,16,2),(37,48,12),(53,25,4),(37,75,6),(53,1,25)]
    ang, L, m = P[k]
    s = 0.6 if ang == 37 else 0.8; c = 0.8 if ang == 37 else 0.6
    v = (2 * 10 * s * L) ** 0.5; A = m * 10 * L * s
    st = (f"Uzunligi {L} m, qiyalik burchagi ${ang}^\\circ$ bo‘lgan silliq qiya tekislik tepasidan {m} kg massali jism sirpanib tushdi. "
          f"$\\sin{ang}^\\circ={num(s)}$, $\\cos{ang}^\\circ={num(c)}$.")
    return st, [("Jismning qiya tekislik etagidagi tezligini (m/s) toping.", num(v)),
                ("Bu jarayonda og‘irlik kuchining bajargan ishini (J) toping.", num(A))], None

def t39(k):
    P = [(60,3),(100,2),(150,4),(250,5),(200,3),(75,2),(125,6),(50,3),(300,4),(175,8)]
    Q, r = P[k]
    A = Q * 2 / 5
    st = f"Bir atomli ideal gazga {Q} J issiqlik berib, hajmi izobarik ravishda {r} marta oshirildi."
    return st, [("Bunda gazning absolyut temperaturasi necha marta ortadi?", str(r)),
                ("Gazning bajargan ishini (J) aniqlang.", num(A))], None

def t40(k):
    P = [(500,10,5,1,-5),(400,20,4,1.5,-10),(300,8,3,2,-20),(600,15,4,1.5,-8),(250,12,2,1,-6),(500,25,6,2,-15),(350,6,5,0.8,-4),(450,30,3,1.5,-12),(200,10,4,3,-10),(800,18,5,2,-20)]
    C, t0, Vw, mi, ti = P[k]
    cw, ci, lam = 4200, 2100, 330000
    Qw = (C + cw * Vw) * t0               # 0 °C gacha sovishdan ajraladi
    Qi = ci * mi * (-ti)                  # muz 0 °C gacha
    if Qw - Qi < lam * mi and Qw > Qi:   # qisman eriydi, T = 0
        T = 0.0; Qt = Qw
    else:                                 # muz to‘la eriydi
        T = (Qw - Qi - lam * mi) / (C + cw * (Vw + mi)); Qt = Qi + lam * mi + cw * mi * T
    st = (f"Issiqlik sig‘imi {C} J/K bo‘lgan idishda {t0} $^\\circ$C temperaturali {Vw} $\\ell$ suv bor. "
          f"Idishga ${ti}\\,^\\circ$C temperaturali {num(mi)} kg muz tashlandi. $c_{{suv}}=4200$ J/(kg$\\cdot$K), $c_{{muz}}=2100$ J/(kg$\\cdot$K), $\\lambda_{{muz}}=330$ kJ/kg.")
    return st, [("Natijaviy temperaturani ($^\\circ$C) toping.", num(round(T, 2))),
                ("Muzning olgan issiqlik miqdorini (kJ) aniqlang.", num(Qt / 1000))], None

def t41(k):
    V = [
     ("Proton", "e", "m", "Uning aylanish chastotasini aniqlang.", r"$\nu=\dfrac{eB}{2\pi m}$", "Protonning tezligini aniqlang.", r"$v=\dfrac{eBr}{m}$"),
     ("Elektron", "e", "m_e", "Uning aylanish davrini aniqlang.", r"$T=\dfrac{2\pi m_e}{eB}$", "Elektronning kinetik energiyasini aniqlang.", r"$E_k=\dfrac{e^2B^2r^2}{2m_e}$"),
     ("Proton", "e", "m", "Uning impulsini aniqlang.", r"$p=eBr$", "Aylanish davrini aniqlang.", r"$T=\dfrac{2\pi m}{eB}$"),
     ("$\\alpha$-zarra", "2e", "m_\\alpha", "Uning aylanish chastotasini aniqlang.", r"$\nu=\dfrac{eB}{\pi m_\alpha}$", "Uning tezligini aniqlang.", r"$v=\dfrac{2eBr}{m_\alpha}$"),
     ("Proton", "e", "m", "Uning kinetik energiyasini aniqlang.", r"$E_k=\dfrac{e^2B^2r^2}{2m}$", "Unga ta’sir etayotgan Lorens kuchini aniqlang.", r"$F=\dfrac{e^2B^2r}{m}$"),
     ("Elektron", "e", "m_e", "Uning burchak tezligini aniqlang.", r"$\omega=\dfrac{eB}{m_e}$", "Tezligini aniqlang.", r"$v=\dfrac{eBr}{m_e}$"),
     ("Proton", "e", "m", "Uning markazga intilma tezlanishini aniqlang.", r"$a=\dfrac{e^2B^2r}{m^2}$", "Aylanish chastotasini aniqlang.", r"$\nu=\dfrac{eB}{2\pi m}$"),
     ("$\\alpha$-zarra", "2e", "m_\\alpha", "Uning impulsini aniqlang.", r"$p=2eBr$", "Kinetik energiyasini aniqlang.", r"$E_k=\dfrac{2e^2B^2r^2}{m_\alpha}$"),
     ("Elektron", "e", "m_e", "Uning impuls momentini aniqlang.", r"$L=eBr^2$", "Aylanish davrini aniqlang.", r"$T=\dfrac{2\pi m_e}{eB}$"),
     ("Proton", "e", "m", "Uning tezligini aniqlang.", r"$v=\dfrac{eBr}{m}$", "Aylanish davrini aniqlang.", r"$T=\dfrac{2\pi m}{eB}$"),
    ][k]
    name, q, m, qa, aa, qb, ab = V
    st = f"{name} induksiyasi $B$ bo‘lgan magnit maydonga tik uchib kirdi va $r$ radiusli aylana bo‘ylab harakatlana boshladi. ${m}$ — zarraning massasi, $e$ — elementar zaryad."
    return st, [(qa, aa), (qb, ab)], None

def t42(k):
    V = [
     (30, "proton", "e", r"$\dfrac{eEl}{2}$", r"$0$"),
     (60, "proton", "e", r"$\dfrac{\sqrt{3}}{2}eEl$", r"$0$"),
     (30, "elektron", "e", r"$-\dfrac{eEl}{2}$", r"$0$"),
     (60, "alfa-zarra ($q=2e$)", "2e", r"$\sqrt{3}\,eEl$", r"$0$"),
     (30, "proton", "e", r"$\dfrac{eEl}{2}$", r"$0$"),
     (60, "elektron", "e", r"$-\dfrac{\sqrt{3}}{2}eEl$", r"$0$"),
     (30, "alfa-zarra ($q=2e$)", "2e", r"$eEl$", r"$0$"),
     (60, "proton", "e", r"$\dfrac{\sqrt{3}}{2}eEl$", r"$0$"),
     (30, "elektron", "e", r"$-\dfrac{eEl}{2}$", r"$0$"),
     (60, "proton", "e", r"$\dfrac{\sqrt{3}}{2}eEl$", r"$0$"),
    ][k]
    ang, name, q, ans_a, ans_b = V
    # AB va AD orasidagi burchak = ang (AD kuch chiziqlariga tik). Maydon bilan burchak = 90-ang
    fld = 90 - ang
    st = (f"Maydon kuchlanganligi $E$ bo‘lgan bir jinsli elektr maydonda harakatlanayotgan {name} $l$ masofaga ko‘chib, "
          f"$A$ nuqtadan $B$ nuqtaga yetib bordi (rasmda $AD\\perp \\vec E$).")
    fig = (r"\begin{tikzpicture}[scale=0.9]"
           r"\foreach \y in {0,0.8,1.6,2.4,3.2}{\draw[-latex] (0,\y)--(3.2,\y);}"
           f"\\draw (0.25,0)--(0.25,0.25)--(0,0.25);"
           f"\\draw[dashed] (0,0)--(0,3.2);\\draw[thick] (0,0)--({3.2*__import__('math').tan(__import__('math').radians(ang)):.2f},3.2);"
           f"\\node[below left] at (0,0) {{$A$}};\\node[above left] at (0,3.2) {{$D$}};"
           f"\\node[above] at ({3.2*__import__('math').tan(__import__('math').radians(ang)):.2f},3.2) {{$B$}};"
           f"\\node at (2.6,1.2) {{$\\vec E$}};\\node at (0.55,0.75) {{\\small ${ang}^\\circ$}};"
           r"\end{tikzpicture}")
    return st, [("Zarraning kinetik energiyasi qanchaga o‘zgarganini aniqlang.", ans_a),
                (f"Zarra $ABDA$ yopiq yo‘l bo‘ylab ko‘chirilganda elektr kuchlar bajaradigan ishni aniqlang.", ans_b)], fig

def t43(k):
    P = [(27,'suv',Fr(4,3),'ko‘zgu'),(45,'suv',Fr(4,3),'ko‘zgu'),(30,'shisha',Fr(3,2),'ko‘zgu'),(36,'suv',Fr(4,3),'absolyut qora sirt'),(60,'shisha',Fr(3,2),'ko‘zgu'),
         (18,'shisha',Fr(3,2),'absolyut qora sirt'),(90,'suv',Fr(4,3),'ko‘zgu'),(24,'suv',Fr(4,3),'absolyut qora sirt'),(54,'shisha',Fr(3,2),'ko‘zgu'),(72,'suv',Fr(4,3),'ko‘zgu')]
    I, med, n, surf = P[k]
    c = 3e8
    w = float(I * n) / c; p = (2 if surf == 'ko‘zgu' else 1) * w
    st = f"{med.capitalize()}dagi nurning intensivligi {I} W/m$^2$ ga teng. $c=3\\cdot10^8$ m/s."
    pp = "Nur suvdagi ko‘zgudan tik akslansa" if False else None
    qb = (f"Nur {med}dagi ko‘zgudan tik akslansa, ko‘zguga beradigan bosimini (Pa) aniqlang." if surf == 'ko‘zgu'
          else f"Nur {med}dagi absolyut qora sirtga tik tushib to‘la yutilsa, sirtga beradigan bosimini (Pa) aniqlang.")
    fmt = lambda x: num(x * 1e7, 4) + r"$\cdot10^{-7}$"
    return st, [("Nurdagi elektromagnit maydon energiyasining zichligini (J/m$^3$) aniqlang.", fmt(w)), (qb, fmt(p))], None

def t44(k):
    P = [("Quyoshning", "13,8\\cdot10^{8}", 1.38e9, "1,5\\cdot10^{11}", 1.5e11, 0.5),
         ("Quyoshning", "13,8\\cdot10^{8}", 1.38e9, "1,5\\cdot10^{11}", 1.5e11, 0.25),
         ("Oyning", "3,5\\cdot10^{6}", 3.5e6, "3,8\\cdot10^{8}", 3.8e8, 0.5),
         ("Quyoshning", "13,8\\cdot10^{8}", 1.38e9, "1,5\\cdot10^{11}", 1.5e11, 0.75),
         ("Oyning", "3,5\\cdot10^{6}", 3.5e6, "3,8\\cdot10^{8}", 3.8e8, 1.0),
         ("Quyoshning", "13,8\\cdot10^{8}", 1.38e9, "1,5\\cdot10^{11}", 1.5e11, 0.4),
         ("Oyning", "3,5\\cdot10^{6}", 3.5e6, "3,8\\cdot10^{8}", 3.8e8, 0.3),
         ("Quyoshning", "13,8\\cdot10^{8}", 1.38e9, "1,5\\cdot10^{11}", 1.5e11, 1.0),
         ("Oyning", "3,5\\cdot10^{6}", 3.5e6, "3,8\\cdot10^{8}", 3.8e8, 0.2),
         ("Quyoshning", "13,8\\cdot10^{8}", 1.38e9, "1,5\\cdot10^{11}", 1.5e11, 0.6)][k]
    obj, Dt, D, dt, d, f = P
    di = D * f / d * 1000
    st = (f"{obj} diametri ${Dt}$ m ga, Yer bilan {obj[:-4]} orasidagi masofa ${dt}$ m ga teng. "
          f"Fokus masofasi {num(f)} m bo‘lgan Yerdagi linza ekranda {obj[:-4]}ning haqiqiy tasvirini hosil qilmoqda.")
    return st, [("Tasvir bilan linza orasidagi masofani (mm) toping.", num(f * 1000)),
                (f"{obj[:-4]} tasvirining diametrini (mm) toping.", num(round(di, 2)))], None

def t45(k):
    P = [(2,2),(1,2),(2,1),(3,1),(3,2),(1,3),(2,3),(4,1),(4,2),(1,1)][k]
    n0, d = P
    n = n0 + d
    E0 = {1: "13,6", 2: "3,4", 3: "1,51", 4: "0,85"}[n0]
    E1 = 13.6 / n ** 2
    r = Fr(n0, n)
    r = 1 / r
    rs = f"{r.numerator}/{r.denominator}" if r.denominator != 1 else str(r.numerator)
    st = f"G‘alayonlanmagan vodorod atomining ionlanish energiyasi {E0} eV ga teng." if False else f"G‘alayonlangan vodorod atomining ionlashish energiyasi {E0} eV ga teng."
    return st, [(f"Atom fotonni yutib impuls momentini ${d}\\hbar$ ga oshirsa, uning ionlanish energiyasi (eV) nimaga teng bo‘lishini aniqlang.", num(round(E1, 3), 3)),
                (f"Atom fotonni yutib impuls momentini ${d}\\hbar$ ga oshirsa, undagi elektronning orbitadagi tezligi necha marta kamayishini aniqlang.", num(round(float(r), 3)))], None

OPEN = [t36, t37, t38, t39, t40, t41, t42, t43, t44, t45]
