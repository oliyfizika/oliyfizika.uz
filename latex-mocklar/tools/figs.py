# Bank rasmlarining TikZ qayta chizilgan nusxalari. Kalit: rasm fayl nomi (rasmlar/ dan keyin).
# Har bir qiymat — \begin{tikzpicture}...\end{tikzpicture} matni. Makrolar make_mocks.PRE da.
H = r"\begin{tikzpicture}[x=1cm,y=1cm,line width=0.5pt,>=Stealth,font=\small]"
E = r"\end{tikzpicture}"
def T(body): return H + "\n" + body.strip() + "\n" + E
def axes(w, h, xl, yl, ox=0, oy=0):
    return rf"\draw[->] ({ox},{oy})--({w},{oy}) node[right]{{{xl}}}; \draw[->] ({ox},{oy})--({ox},{h}) node[above]{{{yl}}};"
FIG = {}

FIG["8000009-29"] = T(axes(4,3,"$V$","$p$") + r"""
\node[below left] at (0,0) {$0$};
\node[above] at (1,2.1) {1}; \node[above] at (2.8,2.1) {2}; \node[below] at (2.8,0.9) {3};
\draw[->] (1,2.1)--(2,2.1); \draw (2,2.1)--(2.8,2.1); \draw[->] (2.8,2.1)--(2.8,1.4); \draw (2.8,1.4)--(2.8,0.9);""")

FIG["8000273-02"] = T(axes(3.6,3.2,"$V$","$p$") + r"""
\node[below left] at (0,0) {$0$};
\draw[dashed] (0,2.2)--(1.6,2.2); \draw[dashed] (0,1.0)--(1.6,1.0);
\node[left] at (0,2.2) {$p_1$}; \node[left] at (0,1.0) {$p_2$};
\fill (1.6,2.2) circle(1.2pt) node[right]{1}; \fill (1.6,1.0) circle(1.2pt) node[right]{2};
\draw (1.6,2.2)--(1.6,1.0);""")

FIG["8000297-19"] = T(axes(4.2,3.4,"$T$","$p$") + r"""
\node[below left] at (0,0) {$0$};
\draw[dashed] (0,0)--(0.5,0.7); \draw[thick] (0.5,0.7)--(3.3,3.1); \node[right] at (3.3,3.1) {II};
\draw[dashed] (0,0)--(0.5,0.3); \draw[thick] (0.5,0.3)--(3.7,1.5); \node[right] at (3.7,1.5) {I};
\draw[dashed] (2,0)--(2,1.92) (0,1.92)--(2,1.92) (0,0.8)--(2,0.8);
\fill (2,1.92) circle(1.2pt) node[right=2pt]{$B$}; \fill (2,0.8) circle(1.2pt) node[below right]{$A$};
\node[left] at (0,1.92) {$p_B$}; \node[left] at (0,0.8) {$p_A$}; \node[below] at (2,0) {$T_1$};""")

FIG["8000177-01"] = T(r"""
\fill[pattern=north east lines,draw=none] (0,3.0) rectangle (1.3,3.15); \draw (0,3.0)--(1.3,3.0);
\draw (0.65,3.0)--++(-70:1.6) coordinate(b1); \draw[dashed] (0.65,3.0)--++(0,-1.9);
\draw[fill=gray!30] (b1) circle(0.12);
\draw[dashed] (0.65,3.0)+(-125:1.9) arc(-125:-60:1.9);
\fill[pattern=north east lines,draw=none] (2.6,3.5) rectangle (3.9,3.65); \draw (2.6,3.5)--(3.9,3.5);
\draw (3.25,3.5)--++(-105:2.6) coordinate(b2); \draw[dashed] (3.25,3.5)--++(0,-3.1);
\draw[fill=gray!30] (b2) circle(0.25);
\draw[dashed] (3.25,3.5)+(-120:2.9) arc(-120:-65:2.9);""")

FIG["8000273-04"] = T(r"""
\draw[pattern=north east lines] (0,0) rectangle (2.2,0.5); \draw[pattern=north west lines] (2.2,0) rectangle (5,0.5);
\node[above] at (1.1,0.55) {$l_1\rho_1$}; \node[above] at (3.6,0.55) {$l_2\rho_2$};""")

FIG["8000273-08"] = T(r"""
\draw (-0.6,1)--(0.3,1) (0.3,0)--(0.3,2) (4.3,0)--(4.3,2) (4.3,1)--(4.8,1);
\draw (0.3,2)--(1.0,2); \draw[fill=white] (1.0,1.85) rectangle (1.8,2.15); \node[above] at (1.4,2.15) {$R$};
\draw (1.8,2)--(2.2,2); \draw[fill=white] (2.2,1.85) rectangle (3.0,2.15); \node[above] at (2.6,2.15) {$R$}; \draw (3.0,2)--(4.3,2);
\draw (0.3,1)--(1.5,1) -- (1.5,1); \draw[fill=white] (1.5,0.85) rectangle (2.5,1.15); \node[above] at (2.0,1.15) {$2R$}; \draw (2.5,1)--(4.3,1);
\draw (0.3,0)--(1.9,0); \draw[fill=white] (1.9,-0.15) rectangle (2.7,0.15); \node[above] at (2.3,0.15) {$3R$}; \draw (2.7,0)--(4.3,0);
\draw (4.8,1)--(5.2,1); \draw[fill=white] (5.2,0.85) rectangle (6.0,1.15); \node[above] at (5.6,1.15) {$R$};
\draw (6.0,1)--(6.4,1); \draw[fill=white] (6.8,1) circle(0.25) node{$A$}; \draw (7.05,1)--(7.5,1);""")

FIG["8000537-22"] = T(r"""
\foreach \x/\n/\d in {0/1/1, 1.6/2/-1}{
 \draw (\x,0) circle(0.5); \fill (\x,0) circle(1.2pt); \node[above] at (\x,0.05) {$I$}; \node[below] at (\x,-0.6) {\n};}
\draw[->] (0.5,-0.05) arc(0:-30:0.5); \draw[->] (1.1,-0.05) arc(180:210:0.5);""")

FIG["8000585-29"] = T(r"""
\fill[pattern=north east lines,draw=none] (0.4,4.0) rectangle (1.6,4.15); \draw (0.4,4.0)--(1.6,4.0);
\draw (1,4.0)--(1,3.45); \draw[fill=white] (1,3.0) circle(0.45); \fill (1,3.0) circle(1.2pt);
\draw (0.55,3.0)--(0.55,2.7); \draw[decorate,decoration={zigzag,segment length=3.5,amplitude=2.5}] (0.55,2.7)--(0.55,1.7);
\draw (0.55,1.7)--(0.55,1.6); \draw[fill=white] (0.3,1.1) rectangle (0.8,1.6); \node at (0.55,1.35) {$m_1$};
\draw (0.55,1.1)--(0.55,0.9); \draw[decorate,decoration={zigzag,segment length=3.5,amplitude=2.5}] (0.55,0.9)--(0.55,0.1);
\draw (0.55,0.1)--(0.55,0); \node[left] at (0.35,2.2) {$k_1$}; \node[left] at (0.35,0.5) {$k_2$};
\draw (1.45,3.0)--(1.45,2.2); \draw[fill=white] (1.2,1.7) rectangle (1.7,2.2); \node at (1.45,1.95) {$m_2$};
\draw (-0.5,0)--(2.4,0); \fill[pattern=north east lines,draw=none] (-0.5,-0.15) rectangle (2.4,0);""")

FIG["8000897-11"] = T(r"""
\fill[pattern=north east lines,draw=none] (0,3.4) rectangle (1.6,3.55); \draw (0,3.4)--(1.6,3.4);
\draw (0.8,3.4)--(0.8,2.65); \node[right] at (0.85,3.05) {$T$}; \draw[->] (0.8,3.0)--(0.8,3.1);
\draw[fill=white] (0.8,2.25) circle(0.4); \fill (0.8,2.25) circle(1.2pt);
\draw (0.4,2.25)--(0.4,0.0); \draw (1.2,2.25)--(1.2,1.2);
\draw[pattern=north east lines] (1.05,0.8) rectangle (1.35,1.2);
\draw (-0.3,0)--(1.8,0); \fill[pattern=north east lines,draw=none] (-0.3,-0.15) rectangle (1.8,0);""")

FIG["8000897-13"] = T(r"""
\draw[dashed] (-0.2,0)--(6.2,0);
\foreach \x/\n in {0.3/A,1.1/B,3.2/C,4.9/D,6.0/F}{\fill (\x,0) circle(1.2pt); \node[below] at (\x,-0.1) {$\n$};}
\foreach \x/\n in {2.1/M,4.0/N}{\draw[fill=white] (\x,0) circle(0.2); \draw (\x-0.14,0)--(\x+0.14,0) (\x,-0.14)--(\x,0.14); \node[below] at (\x,-0.25) {$\n$};}""")

FIG["8000921-12"] = T(r"""
\foreach \x in {0.9,1.9,2.9,3.9}{\draw[->] (\x,2.2)--(\x,0.4);}
\draw[->] (3.6,2.2)--(3.6,0.7); \node[right] at (4.0,2.1) {$\vec B$};
\draw (0,0)--(2.8,0)--(3.5,0.9)--(0.7,0.9)--cycle;
\draw[dashed] (-0.5,0.45)--(3.9,0.45); \node at (0.35,0.62) {$A$}; \node at (3.9,0.62) {$A'$};
\draw[->] (-0.45,0.65) arc(160:-100:0.22 and 0.15);
\node[below] at (1.4,0) {$a$}; \node at (3.35,0.2) {$b$};""")

FIG["8001185-27"] = T(r"""
\draw (0,0.3)--(0,1.3) (0,1.7)--(0,3.2)--(3,3.2)--(3,2.4) (3,0.6)--(3,0);
\draw (-0.25,1.3)--(0.25,1.3) (-0.12,1.7)--(0.12,1.7); \node[left] at (-0.3,1.5) {$\varepsilon$};
\draw (1.5,3.2)--(1.5,2.8);
\foreach \y/\n in {2.5/1,1.9/2,1.3/3}{\draw (1.25,\y)--(1.75,\y) (1.25,\y-0.15)--(1.75,\y-0.15); \node[right] at (1.8,\y-0.07) {$C_\n$};}
\draw (1.5,2.5)--(1.5,2.8) (1.5,2.35)--(1.5,2.05) (1.5,1.75)--(1.5,1.45) (1.5,1.15)--(1.5,0.8);
\draw[fill=white] (3,2.0) rectangle ++(0,0); \draw[fill=white] (2.85,1.0) rectangle (3.15,2.4); \node[right] at (3.2,1.7) {$R$};
\draw (0,0.3)--(0,0)--(0.8,0) (2.2,0)--(3,0);
\fill (0.8,0) circle(1.2pt) node[below]{1}; \fill (2.2,0) circle(1.2pt) node[below]{2}; \fill (1.5,0.8) circle(1.2pt) node[left=3pt,above right=2pt]{$K$};
\draw (1.5,0.8)--(0.85,0.08);""")

FIG["MS15_2q2-25"] = T(r"""
\draw[->] (-0.9,0)--(-0.3,0) node[midway,above]{$I$}; \draw (-0.3,0)--(0,0); \fill (0,0) circle(1.2pt); \node[below] at (0,-0.05) {$A$};
\draw[fill=white] (0,-0.2) rectangle (2,0.2); \node[above] at (1,0.2) {$R$}; \draw (2,0)--(2.6,0); \fill (2,0) circle(1.2pt); \node[below] at (2,-0.05) {$B$};""")

FIG["MS15_2q2-29"] = T(r"""
\draw (0,0)--(5,0)--(0,2.9)--cycle;
\node[draw,fill=gray!30,rotate=-30,anchor=south,minimum width=1.2cm,minimum height=0.6cm] at (1.9,1.8) {$4\ \mathrm{kg}$};
\draw (4.2,0) arc(180:150:0.8); \node at (3.9,0.2) {$30^\circ$};""")

FIG["MS19_2-28"] = T(r"""
\draw (-0.5,0)--(5.3,0);
\draw[dashed] (0.1,1.9)--(2.5,0) (2.5,0)--(4.4,1.9);
\fill (0,2.0) circle(2pt); \node[right] at (0.1,2.2) {$m=2\ \mathrm{kg}$};
\draw[->] (0,2.0)--(1.2,1.05); \node[above right] at (1.0,1.3) {$v_1=8\ \mathrm{m/s}$};
\fill (3.6,1.5) circle(2pt); \draw[->] (3.6,1.5)--(4.5,2.2); \node[right] at (4.3,2.3) {$v_2=6\ \mathrm{m/s}$};
\draw (1.5,0) arc(180:143:1.0); \node at (1.15,0.25) {$37^\circ$}; \draw (3.4,0) arc(0:53:0.9); \node at (3.8,0.35) {$53^\circ$};""")

FIG["MS21_2-08"] = T(r"""
\draw[fill=gray!15] (0,1.0) rectangle (6,1.15);
\draw (5,1.0)--(4.8,0.7)--(5.2,0.7)--cycle;
\draw (6,1.0)--(6,0.65); \draw[fill=gray!30] (5.6,0.1) rectangle (6.4,0.65); \node at (6.0,0.38) {\scriptsize $60\ \mathrm{kg}$};
\node[above] at (2.5,1.15) {$10\ \mathrm{m}$}; \node[above] at (5.5,1.15) {$2\ \mathrm{m}$};""")

FIG["T04-24"] = T(r"""
\draw[line width=1.2pt,gray] (0,3.0)--(2.6,3.0);
\draw[decorate,decoration={coil,aspect=0.5,segment length=3.2,amplitude=2.5}] (0.3,3.0)--(0.3,1.5);
\draw[decorate,decoration={coil,aspect=0.5,segment length=3.2,amplitude=2.5}] (2.3,3.0)--(2.3,1.5);
\draw[line width=1.6pt,gray!70!black] (0.15,1.4)--(2.45,1.4);
\foreach \x in {0.3,0.8,1.3,1.8,2.3}{\foreach \y in {0.55,0.95,1.2}{\node[font=\scriptsize] at (\x,\y) {$\times$};}}
\draw (-0.5,1.35)--(0.15,1.4); \draw (2.45,1.4)--(3.1,1.45); \node at (-0.45,1.7) {$-$}; \node at (3.0,1.75) {$+$};
\node[below right] at (0.6,0.5) {$m=10\ \mathrm{g}$}; \node[below right] at (1.7,0.3) {$\vec B=0{,}1\ \mathrm{T}$};
\draw[->] (-0.7,2.7)--(-0.7,2.0) node[midway,left]{$g$}; \node[right] at (2.6,2.2) {$k=10\ \mathrm{N/m}$};""")

FIG["T04-26"] = T(r"""
\fill (0,0) circle(1.2pt); \node[below] at (0,-0.1) {$A$}; \draw (0,0)--(0.4,0);
\draw[fill=white] (0.4,-0.3) rectangle (1.6,0.3); \node at (1.0,0) {$R$}; \draw[->] (0.6,0.55)--(1.3,0.55) node[midway,above=-1pt]{$I$};
\draw (1.6,0)--(2.0,0); \draw[decorate,decoration={coil,aspect=0.6,segment length=5,amplitude=4}] (2.0,0)--(3.8,0); \node[above] at (2.9,0.35) {$L$};
\draw (3.8,0)--(4.3,0); \fill (4.3,0) circle(1.2pt); \node[below] at (4.3,-0.1) {$B$};""")

FIG["T05-03"] = T(r"""
\draw (0,0)--(4.3,0)--(0,2.5)--cycle; \fill[pattern=north east lines,draw=none] (0,-0.12) rectangle (4.3,0);
\draw (3.5,0) arc(180:150:0.8); \node at (3.1,0.15) {$30^\circ$};
\draw[dotted,thick] (3.0,4.0)  parabola[bend at start] ++(-0,0);
\draw[dotted,thick,domain=0:1.75,samples=30] plot ({3.0-\x},{4.0-0.63*\x*\x});
\draw[->] (3.0,4.0)--(2.5,4.0) node[above left=-2pt]{$\vartheta$};
\draw[->] (3.7,2.5)--(3.7,1.8) node[midway,right]{$g$};""".replace(r"\draw[dotted,thick] (3.0,4.0)  parabola[bend at start] ++(-0,0);", ""))

FIG["T05-04"] = T(r"""
\draw[dashed] (0,0.1) ellipse(2.46 and 0.55);
\draw[line width=1.4pt] (0,-0.9)--(0,1.7); \draw[line width=1.4pt] (0,0)--(2,0)--(2,0.8);
\draw (2,0.8)--(2.46,0) ; \fill (2.46,0) circle(2pt);
\draw[->] (-0.3,1.3) arc(200:-20:0.3 and 0.15); \node[above] at (0,1.7) {$\omega$}; \node[below right] at (0,-0.9) {$O$};
\node[below] at (1,-0.05) {$10\ \mathrm{cm}$}; \node[right] at (2.05,0.5) {$4\ \mathrm{cm}$}; \draw (2,0.45) arc(-90:-60:0.35); \node[right] at (2.1,0.2) {};
\node at (2.45,0.5) {$30^\circ$};""")

FIG["T05-20"] = T(r"""
\def\rh#1#2#3#4{\draw[fill=white] (#1-.35,#2-.13) rectangle (#1+.35,#2+.13); \node[#4] at (#1,#2) {$#3$};}
\fill (0,1.2) circle(1.2pt) node[left]{$A$}; \fill (0,0) circle(1.2pt) node[left]{$B$};
\draw (0,1.2)--(0.6,1.2); \draw (0,0)--(0.6,0);
\draw (0.6,1.2)--(1.0,1.2) (1.0,0)--(0.6,0);
\draw[fill=white] (0.6,1.07) rectangle (1.3,1.33); \node[above] at (0.95,1.33) {$R$};
\draw[fill=white] (0.6,-0.13) rectangle (1.3,0.13); \node[below] at (0.95,-0.13) {$R$};
\draw (1.3,1.2)--(1.9,1.2) (1.3,0)--(1.9,0); \draw (1.9,1.2)--(1.9,0.9) (1.9,0.3)--(1.9,0);
\draw[fill=white] (1.75,0.3) rectangle (2.05,0.9); \node[left] at (1.75,0.6) {$4R$};
\draw (1.9,1.2)--(2.3,1.2) (1.9,0)--(2.3,0);
\draw[fill=white] (2.3,1.07) rectangle (3.0,1.33); \node[above] at (2.65,1.33) {$R$};
\draw[fill=white] (2.3,-0.13) rectangle (3.0,0.13); \node[below] at (2.65,-0.13) {$R$};
\draw (3.0,1.2)--(3.3,1.2) (3.0,0)--(3.3,0);
\draw[fill=white] (3.3,1.07) rectangle (4.0,1.33); \node[above] at (3.65,1.33) {$R$};
\draw[fill=white] (3.3,-0.13) rectangle (4.0,0.13); \node[below] at (3.65,-0.13) {$R$};
\draw (4.0,1.2)--(4.45,1.2) (4.0,0)--(4.45,0); \draw (4.45,1.2)--(4.45,0);
\draw (4.45,1.2)--(4.8,1.2) (4.45,0)--(4.8,0);
\draw[fill=white] (4.8,1.07) rectangle (5.5,1.33); \node[above] at (5.15,1.33) {$R$};
\draw[fill=white] (4.8,-0.13) rectangle (5.5,0.13); \node[below] at (5.15,-0.13) {$R$};
\draw (5.5,1.2)--(5.9,1.2)--(5.9,0.9) (5.5,0)--(5.9,0)--(5.9,0.3); \draw[fill=white] (5.75,0.3) rectangle (6.05,0.9); \node[right] at (6.05,0.6) {$R$};""")

FIG["T05-22"] = T(r"""
\fill (0,2.2) circle(1.2pt) node[above]{$A$}; \fill (8.0,2.2) circle(1.2pt) node[above]{$B$};
\draw (0,2.2)--(0,0) (0,2.2)--(8.0,2.2);
\foreach \y in {2.2,1.5,0.8,0.1}{\draw (0,\y)--(0.5,\y); \draw[fill=white] (0.5,\y-0.17) rectangle (1.7,\y+0.17); \node at (1.1,\y) {$2R$}; \draw (1.7,\y)--(2.1,\y);}
\draw[fill=white] (2.1,2.03) rectangle (3.0,2.37) node[midway]{$R$}; \draw (3.0,2.2)--(5.0,2.2);
\draw[fill=white] (5.0,2.03) rectangle (5.9,2.37) node[midway]{$R$}; \draw (5.9,2.2)--(8.0,2.2);
\draw (2.1,1.5)--(4.0,1.5) (2.1,0.8)--(4.0,0.8) (4.0,0.8)--(4.0,2.2);
\draw (2.1,0.1)--(8.0,0.1)--(8.0,2.2);
\fill (4.0,2.2) circle(1.2pt) (4.0,1.5) circle(1.2pt);""")

FIG["1925918-28"] = T(r"""
\draw[fill=white] (0.3,2.2) rectangle (4.3,2.5); \draw[->] (4.3,2.35)--(5.3,2.35) node[right]{$v_1$};
\draw (2.3,1.1) circle(1.1); \fill (2.3,1.1) circle(1.2pt); \node[below left] at (2.3,1.1) {$O$}; \draw[->] (2.3,1.1)--(3.6,1.1) node[right]{$v_2$};
\draw (-0.3,0)--(5.0,0); \fill[pattern=north east lines,draw=none] (-0.3,-0.15) rectangle (5.0,0);""")

FIG["1929944-20"] = T(r"""
\draw[->] (-0.3,0)--(7.3,0) node[right]{$t,\mathrm{s}$}; \draw[->] (0,-1.8)--(0,1.1) node[above]{$v,\mathrm{m/s}$};
\draw[very thick] (0,0.9)--(1,0.9)--(2,-1.5)--(3,-1.5)--(3.5,0)--(5,0)--(6,0.9);
\draw[dashed] (0,0.9)--(6,0.9) (0,-1.5)--(2,-1.5) (1,0.9)--(1,0) (2,-1.5)--(2,0) (3,-1.5)--(3,0) (6,0.9)--(6,0);
\node[left] at (0,0.9) {$5$}; \node[left] at (0,0) {$0$}; \node[left] at (0,-1.5) {$-10$};
\foreach \x/\n in {1/4,1.5/6,2/8,3/12,3.5/14,5/20,6/24}{\node[above right=-1pt] at (\x,0) {\n};}""")

FIG["T12-15"] = T(r"""
\fill[left color=black!75,right color=black!5] (0.3,1.1) .. controls (0.9,0.25) and (2.1,0.25) .. (3.1,1.0) -- (3.1,1.3) .. controls (2.1,0.6) and (0.9,0.6) .. (0.3,1.45) -- cycle;
\draw[fill=gray!20] (0,0) rectangle (3.5,0.15);""")

FIG["T17-19"] = T(r"""
\draw (0,0)--(4.2,0); \foreach \x/\n in {0/{+q},4.2/{+2q}}{\draw[fill=white] (\x,0) circle(0.14); \fill (\x,0) circle(1pt); \node[above=4pt] at (\x,0) {$\n$};}
\fill (2.1,0) circle(1.2pt) node[above]{$A$};
\draw[dotted,thick] (2.1,0)--(4.0,-2.1); \draw[fill=white] (4.15,-2.25) circle(0.14); \fill (4.15,-2.25) circle(1pt); \node[above right] at (4.2,-2.4) {$Q$};""")

FIG["T18-01"] = T(r"""
\draw[->] (0,0)--(3.8,0) node[below]{$t,\mathrm{s}$}; \draw[->] (0,0)--(0,3.0) node[above]{$X,\mathrm{m}$};
\draw[very thick] (0,2.2)--(2.4,-0.0+0.0+0.2*0+ -0.2+0.2) ; 
\draw[dashed] (0,2.2)--(2.5,2.2); \draw (1.0,2.2) arc(0:-45:1.0); \node at (1.35,1.9) {$45^\circ$};""".replace(r"\draw[very thick] (0,2.2)--(2.4,-0.0+0.0+0.2*0+ -0.2+0.2) ; ", r"\draw[very thick] (0,2.2)--(2.1,0.1);"))

FIG["T18-02"] = T(r"""
\fill (2.4,3.2) circle(1.5pt); \node[right] at (2.5,3.2) {$A$}; \draw[dashed] (2.4,3.2)--(2.4,0.8);
\draw (-0.2,0.8)--(4.2,0.8); \fill[pattern=north east lines,draw=none] (-0.2,0.65) rectangle (4.2,0.8);
\foreach \r in {0.15,0.3,0.45}{\draw (0.5,0.8) arc(0+90:90-0:0) (0.5+\r,0.8) arc(0:180:\r);}
\fill (0.5,0.8) circle(1.5pt); \node[below left] at (0.4,0.6) {$B$};
\draw[<->] (0.5,0.45)--(2.4,0.45); \node[below] at (1.45,0.45) {$180\ \mathrm{m}$};
\draw[->] (3.2,2.4)--(3.2,1.6); \node[right] at (3.25,2.0) {$g$};""")

FIG["T23-07"] = T(r"""
\foreach \i in {0,...,11}{\draw[fill=\ifodd\i gray!10\else gray!60\fi] (\i*0.45,0) rectangle (\i*0.45+0.45,0.25);}
\draw[fill=gray!60] (2.25,0) -- (2.05,-0.4) -- (2.45,-0.4) -- cycle;
\draw[->] (0,0.25)--(0,0.95) node[above]{$1\ \mathrm{N}$};
\draw[->] (1.35,0)--(1.35,-0.7) node[below]{$2\ \mathrm{N}$};
\draw[->] (3.15,0.25)--(3.15,0.95) node[above]{$2\ \mathrm{N}$};
\draw[->] (5.4,0.25)--(5.4,-0.45) node[below right=-2pt]{?};""".replace(r"\draw[fill=\ifodd\i gray!10\else gray!60\fi] (\i*0.45,0) rectangle (\i*0.45+0.45,0.25);", r"\draw[fill=gray!35] (\i*0.45,0) rectangle (\i*0.45+0.45,0.25);"))

FIG["Y05-12"] = T(axes(3.8,3.3,"$V$","$p$") + r"""
\node[below left] at (0,0) {$0$};
\fill (1.0,2.4) circle(1.2pt); \fill (2.8,0.9) circle(1.2pt) (1.0,0.9) circle(1.2pt);
\draw[thick] (1.0,2.4) .. controls (1.4,1.3) and (2.0,1.0) .. (2.8,0.9); \draw[->] (1.9,1.15)--(1.95,1.13);
\draw[->] (2.8,0.9)--(1.9,0.9); \draw (1.9,0.9)--(1.0,0.9);
\draw[dashed] (0,2.4)--(1.0,2.4) (0,0.9)--(1.0,0.9) (1.0,2.4)--(1.0,0) (2.8,0.9)--(2.8,0);
\node[left] at (0,2.4) {$p_1$}; \node[left] at (0,0.9) {$p_3$}; \node[above right] at (1.0,2.4) {1}; \node[above right] at (2.8,0.9) {2}; \node[below left] at (1.0,0.9) {3};
\node[below] at (1.0,0) {$V_1$}; \node[below] at (2.8,0) {$V_2$}; \node[right] at (1.9,1.7) {$T=\mathrm{const}$};""")

FIG["Y07-03"] = T(r"""
\draw[->] (-0.3,0)--(5.6,0) node[right]{$t,\mathrm{s}$}; \draw[->] (0,0)--(0,2.3) node[above]{$\vartheta,\mathrm{m/s}$};
\draw[very thick] (0,0)--(1.8,1.8)--(5.2,1.8); \draw[very thick] (1.8,0)--(3.6,1.8);
\draw[dashed] (0,1.8)--(1.8,1.8) (1.8,1.8)--(1.8,0) (3.6,1.8)--(3.6,0);
\node[left] at (0,1.8) {$10$}; \node[below] at (1.8,0) {$10$}; \node[below] at (3.6,0) {$20$};
\node at (1.4,0.55) {I}; \node at (2.9,0.55) {II};""")

FIG["Y10-02"] = T(r"""
\draw[->] (0,0)--(4.6,0) node[right]{$S,\mathrm{m}$}; \draw[->] (0,0)--(0,3.0) node[above]{$\vartheta,\mathrm{m/s}$};
\draw[very thick] (0.8,1.5) .. controls (1.2,2.4) and (2.0,2.6) .. (3.6,2.6) ;
\draw[dashed] (0,1.5)--(0.8,1.5)--(0.8,0) (0,2.6)--(3.6,2.6)--(3.6,0);
\node[left] at (0,1.5) {$4$}; \node[left] at (0,2.6) {$6$}; \node[below] at (0.8,0) {$2$}; \node[below] at (3.6,0) {$4{,}5$};""")

FIG["8000513-27"] = T(r"""
\fill (0,0.8) circle(1.2pt) node[left]{$A$}; \draw (0,0.8)--(0.4,0.8); \draw[fill=white] (0.4,0.65) rectangle (1.2,0.95); \draw (1.2,0.8)--(1.8,0.8);
\draw (1.8,0)--(1.8,1.6); \draw (1.8,1.6)--(2.2,1.6); \draw[fill=white] (2.2,1.45) rectangle (3.0,1.75); \draw (3.0,1.6)--(3.6,1.6);
\draw[fill=white] (3.6,1.45) rectangle (4.4,1.75); \draw (4.4,1.6)--(5.2,1.6); \draw (5.2,1.6)--(5.2,0);
\draw (1.8,0)--(2.6,0); \draw[fill=white] (2.6,-0.15) rectangle (3.4,0.15); \draw (3.4,0)--(5.2,0);
\fill (3.3,1.6) circle(1.2pt) (4.7,1.6) circle(1.2pt); \draw (3.3,1.6)--(3.3,2.4)--(3.7,2.4) (4.7,1.6)--(4.7,2.4)--(4.3,2.4);
\draw[fill=white] (4.0,2.4) circle(0.28) node{$V$};
\draw (5.2,0.8)--(5.7,0.8); \fill (5.7,0.8) circle(1.2pt) node[right]{$B$};""")

FIG["T09-26"] = T(r"""
\fill[ball color=gray!60] (0,0) circle(0.1); \node[above left] at (0,0.1) {$q_1=2\ \mathrm{nC}$};
\fill[ball color=gray!60] (4.4,0) circle(0.1); \node[above right] at (4.4,0.1) {$q_2=2\ \mathrm{nC}$};
\draw[fill=gray!30] (1.9,-0.5) rectangle (2.5,0.6); \node at (2.2,0.05) {$\varepsilon$};
\draw[dashed] (0,-0.1)--(0,-0.9) (4.4,-0.1)--(4.4,-0.9); \draw[<->] (0,-0.8)--(4.4,-0.8); \node[below] at (2.2,-0.8) {$R=3\ \mathrm{m}$};""")
