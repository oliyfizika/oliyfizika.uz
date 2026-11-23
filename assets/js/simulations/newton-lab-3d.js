// Three bench-mounted Newton experiments. Model positions remain in SI units.
import { createLab3D } from './lab-3d.js?v=20261123-batch5c';
import { arrowSolid, helix, ring, path, dashed, alpha } from './apparatus-3d.js?v=20261123-batch5c';
import { fmt } from './sim-kit.js';
import * as P from './newton-physics.js';

export function createNewtonLab() {
  const lab=createLab3D();
  let current,limits,grab;
  const L2=x=>-2.25+3.2*x, Y2=y=>1.65+2.5*y;
  const forcePoint=(F)=>[L2(current.crt.x+.2)+F*.28,2.65,-.48];
  const gatePoint=s=>[L2(.2+s),2.3,0];
  const recoilPoint=(dx,cart)=>[(cart==='c1'?-1:1)*(2.3*(.06-dx)/2+.23),.54,-.24];
  function button(id,text,p,color,active=true) {
    lab.rod(p,[p[0],p[1],p[2]+.055],.095,active?color:lab.colors.border,20);
    lab.label(text,[p[0],p[1],p[2]-.025],active?lab.colors.text:lab.colors.text3);
    if(active)lab.handle(id,p,.12);
  }
  function cart(x,y,z,len,m,color,rotation=0,unit=.1) {
    const c=lab.colors;
    lab.box(x,y+.075,z-.24,len,.15,.48,color);
    lab.box(x+.04,y+.226,z-.18,len-.08,.022,.36,c.bg2);
    for(const wx of [x+.12,x+len-.12]) {
      lab.rod([wx,y+.075,z-.29],[wx,y+.075,z+.29],.025,c.text2);
      for(const zz of [z-.285,z+.285]) {
        lab.rod([wx,y+.075,zz-.025],[wx,y+.075,zz+.025],.075,c.text,20);
        for(let i=0;i<3;i++){
          const a=rotation+i*Math.PI*2/3;
          lab.line([wx,y+.075,zz-.028],[wx+Math.cos(a)*.06,y+.075+Math.sin(a)*.06,zz-.028],c.bg2,1.2);
        }
      }
    }
    const n=Math.max(0,Math.round((m-.5)/unit));
    for(let i=0;i<n;i++)lab.box(x+len*.25,y+.25+i*.065,z-.14,len*.5,.058,.28,c.text3);
    return y+.25+n*.065;
  }
  function ruler(x0,x1,y,z,step,scale) {
    const c=lab.colors;
    lab.box(x0,y-.025,z-.025,x1-x0,.05,.05,c.bg2);
    for(let i=0;i<=Math.round((x1-x0)/step);i++){
      const x=x0+i*step;lab.line([x,y,z-.028],[x,y+(i%5===0?.07:.035),z-.028],c.text3,1);
      if(i%5===0)lab.label(fmt(i*step/scale,1),[x,y-.12,z-.035],c.text3);
    }
  }
  function drawLaw2(crt,ui) {
    const c=lab.colors,hang=crt.drive==='hang',x=L2(crt.x),front=L2(crt.x+.2),ry=Y2(0),z=0;
    const cs=P.cartForces({M:crt.M,m:crt.m,F:crt.F,mu:crt.mu,mode:crt.drive,v:crt.v,attached:!(hang&&crt.landed)});
    // Elevated aluminium rail leaves a visible drop to the bench for the hanging mass.
    for(const xx of [-2.38,1.75])for(const zz of [-.42,.42]){
      lab.box(xx-.11,.02,zz-.13,.22,.08,.26,c.text3);
      lab.rod([xx,.1,zz],[xx,ry,zz],.035,c.text3);
    }
    for(const zz of [-.22,.22])lab.box(-2.45,ry-.045,zz-.03,4.25,.055,.06,c.text3);
    lab.box(-2.48,ry-.055,-.36,4.38,.025,.72,c.bg2);
    for(const xx of [-2.45,1.6])lab.box(xx,ry,-.32,.07,.17,.64,c.text2);
    ruler(L2(0),L2(1.2),ry-.12,-.4,.16,3.2);
    const top=cart(x,ry,0,.64,crt.M,c.primary,crt.x/.02);
    lab.label(`M = ${fmt(crt.M,1)} kg`,[x+.32,top+.18,.02],c.primary);
    button('cm','−',[x+.09,top+.4,-.02],c.primary,crt.phase==='ready'&&crt.M>.51);
    button('cp','+',[x+.55,top+.4,-.02],c.primary,crt.phase==='ready'&&crt.M<.99);
    const gx=L2(.2+crt.s),gc=crt.tGate===null?c.danger:c.success;
    for(const zz of [-.35,.35])lab.rod([gx,ry,zz],[gx,2.3,zz],.035,c.text2);
    lab.rod([gx,2.3,-.35],[gx,2.3,.35],.045,c.text2);
    dashed(lab,[gx,ry+.25,-.3],[gx,ry+.25,.3],gc,1.4);
    lab.sphere([gx,2.3,-.35],.055,gc);lab.handle('gate',gatePoint(crt.s),.2);
    lab.label(`s = ${fmt(crt.s,2)} m`,[gx,2.52,.1],gc);
    lab.label(`Fotodarvoza · ${fmt(crt.tGate??crt.t,3)} s`,[.15,.3,-.7],gc);
    lab.box(-.8,.07,-1.1,1.6,.22,.55,c.text2);
    lab.face([[-.67,.12,-1.103],[.67,.12,-1.103],[.67,.25,-1.103],[-.67,.25,-1.103]],c.sunken);
    path(lab,[[gx,ry,.35],[gx,.04,.55],[.7,.04,.55],[.7,.15,-.8]],c.text3,.012);
    if(hang) {
      const pc=[L2(1.29),Y2(.035),0],pr=.095,hx=pc[0]+pr,hy=Y2(crt.landed?-.51:-.1-crt.x);
      lab.rod([pc[0],ry-.12,-.23],[pc[0],pc[1],-.23],.04,c.text2);
      lab.rod([pc[0],pc[1],-.23],[pc[0],pc[1],.23],.035,c.text2);
      lab.rod([pc[0],pc[1],-.08],[pc[0],pc[1],.08],pr,c.bg2,32);
      for(const zz of [-.095,.095])ring(lab,[pc[0],pc[1],zz],pr,c.text2,'z',.012);
      const rope=[[front,ry+.16,0],[pc[0],pc[1]+pr,0]];
      for(let i=1;i<=12;i++){const a=Math.PI/2-i*Math.PI/24;rope.push([pc[0]+pr*Math.cos(a),pc[1]+pr*Math.sin(a),0]);}
      if(crt.landed)rope.push([hx+.055,(hy+pc[1])/2,-.02]);
      rope.push([hx,hy,0]);path(lab,rope,c.text,.012);
      lab.rod([hx,hy,0],[hx,hy-.205,0],.018,c.text2);
      lab.rod([hx,hy-.225,0],[hx,hy-.19,0],.1,c.text2,24);
      const nd=Math.round((crt.m-.05)/.05);
      for(let i=0;i<nd;i++)lab.rod([hx,hy-.19+i*.027,0],[hx,hy-.165+i*.027,0],.085,c.warning,24);
      lab.label(`m = ${fmt(crt.m*1000,0)} g`,[hx+.32,hy-.05,0],c.warning);
      button('hm','−',[hx+.15,hy+.18,-.05],c.warning,crt.phase==='ready'&&crt.m>.051);
      button('hp','+',[hx+.6,hy+.18,-.05],c.warning,crt.phase==='ready'&&crt.m<.299);
      dashed(lab,[L2(.2+.41),ry,0],[L2(.2+.41),2.25,0],c.text3);
      if(ui.show.vec&&!crt.landed) {
        arrowSolid(lab,[front,ry+.16,-.35],[front+cs.T*.28,ry+.16,-.35],c.warning);
        lab.label('T',[front+cs.T*.28,ry+.32,-.35],c.warning);
        arrowSolid(lab,[hx+.25,hy-.12,-.2],[hx+.25,hy-.12+cs.T*.28,-.2],c.warning);
        arrowSolid(lab,[hx+.5,hy-.12,-.2],[hx+.5,hy-.12-crt.m*P.G*.28,-.2],c.text2);
        lab.label('T / mg',[hx+.45,hy+.25,-.2]);
      }
    } else {
      const start=[front,ry+.16,0],end=[front+.2+crt.F*.04,ry+.16,0];
      helix(lab,start,end,.045,6,c.text2,.009);
      lab.box(end[0],ry+.08,-.11,.39,.16,.22,c.bg2);
      for(let i=0;i<=8;i++)lab.line([end[0]+.035+i*.04,ry+.085,-.115],[end[0]+.035+i*.04,ry+.085+(i%2?.035:.065),-.115],c.text3,1);
      lab.rod([end[0]+.39,ry+.16,0],[end[0]+.55,ry+.16,0],.016,c.text2);
      ring(lab,[end[0]+.6,ry+.16,0],.05,c.text2,'z',.012);
      arrowSolid(lab,[front,2.65,-.48],forcePoint(crt.F),c.primary);
      lab.label(`F = ${fmt(crt.F,1)} N`,[forcePoint(crt.F)[0],2.84,-.48],c.primary);
      if(crt.phase==='ready')lab.handle('ftip',forcePoint(crt.F),.16);
    }
    if(ui.show.vec&&cs.f>.001){arrowSolid(lab,[x+.32,ry+.04,-.5],[x+.32-cs.f*.28,ry+.04,-.5],c.danger);lab.label('f',[x+.32-cs.f*.28,ry+.2,-.5],c.danger);}
    if(ui.show.vec&&crt.phase==='run'&&Math.abs(cs.a)>.001){arrowSolid(lab,[x+.32,2.4,.4],[x+.32+cs.a*.15,2.4,.4],c.special);lab.label('a',[x+.32+cs.a*.15,2.55,.4],c.special);}
    if(crt.aMeas!==null)lab.label(`a = 2s/t² = ${fmt(crt.aMeas,2)} m/s²`,[-.4,.56,-.7],c.success);
    if(crt.phase==='stuck')lab.label('F ≤ μMg · aravacha tinch',[-.4,2.95,0],c.danger);
  }
  function drawLaw3(rc,ui) {
    const c=lab.colors,k=2.3,y=.23;
    limits=1.015;
    for(const z of [-.23,.23])lab.box(-2.4,.16,z-.03,4.8,.07,.06,c.text3);
    for(const x of [-2.45,2.4])lab.box(x,.16,-.35,.07,.27,.7,c.text2);
    ruler(-2.3,2.3,.11,-.45,.23,2.3);
    rc.strobe.forEach(p=>{lab.line([p.a*k,.02,-.45],[p.a*k,.02,-.65],c.primary,2);lab.line([p.b*k,.02,-.7],[p.b*k,.02,-.9],c.warning,2);});
    const x1=k*rc.x1,x2=k*rc.x2;
    const t1=cart(x1-.46,y,0,.46,rc.m1,c.primary,rc.x1/.02,.5),t2=cart(x2,y,0,.46,rc.m2,c.warning,rc.x2/.02,.5);
    const end=rc.x2-rc.x1<.06?x2:x1+.06*k;
    helix(lab,[x1,y+.14,0],[end,y+.14,0],.055,6,c.text2,.01);
    lab.box(end-.012,y+.05,-.09,.024,.18,.18,c.text2);
    const bound=rc.phase==='bound';
    for(const [xc,top,m,n,col]of [[x1-.23,t1,rc.m1,'1',c.primary],[x2+.23,t2,rc.m2,'2',c.warning]]){
      // Separate mass consoles keep the two nearby trolley handles and thread clear.
      const controlX=n==='1'?-1.3:1.3;
      lab.box(controlX-.43,.06,-1.07,.86,.57,.15,c.bg2);
      lab.box(controlX-.43,.06,-1.08,.86,.04,.17,col);
      lab.label(`m${n==='1'?'₁':'₂'} = ${fmt(m,1)} kg`,[controlX,.84,-1.1],col);
      button('m'+n,'−',[controlX-.24,.4,-1.1],col,bound&&m>.51);
      button('p'+n,'+',[controlX+.24,.4,-1.1],col,bound&&m<2.49);
      dashed(lab,[controlX,.64,-.91],[xc,top+.04,-.27],alpha(col,.45),.8);
      if(bound)lab.handle(n==='1'?'c1':'c2',[xc,.54,-.24],.18);
    }
    if(bound){
      path(lab,[[x1-.08,y+.27,-.12],[0,y+.35,-.2],[x2+.08,y+.27,-.12]],c.danger,.013);
      lab.label('Ipni kesish',[0,y+.54,-.35],c.danger);lab.handle('thread',[0,y+.35,-.2],.15);
    }
    if(ui.show.vec){
      const F=bound?600*rc.dx:rc.F;
      if(F>.01){arrowSolid(lab,[x1,1.65,-.2],[x1-F*.04,1.65,-.2],c.danger);arrowSolid(lab,[x2,1.65,-.2],[x2+F*.04,1.65,-.2],c.danger);lab.label(`F₂₁ = −F₁₂ · ${fmt(F,1)} N`,[0,1.92,0],c.danger);}
      for(const [x,v,txt,col]of [[x1-.23,rc.v1,'v₁',c.primary],[x2+.23,rc.v2,'v₂',c.warning]])if(Math.abs(v)>.005&&rc.phase!=='done'){arrowSolid(lab,[x,1.18,-.4],[x+v*.8,1.18,-.4],col);lab.label(txt,[x+v*.8,1.36,-.4],col);}
    }
    if(rc.contact&&rc.phase==='push')lab.label('Ta’sir 25 marta sekinlashtirilgan',[0,2.2,0]);
    if(rc.strobe.length)lab.label('Stroboskop: har 0,1 s',[0,.03,-1.0]);
  }
  function drawLift(lift,ui) {
    const c=lab.colors,P_=P.weight(lift.m,lift.a),ratio=P_/(lift.m*P.G),floor=Math.max(1,Math.min(9,Math.round(lift.y/3)+1));
    // Miniature open shaft and moving cabin; enlarged cutaway to the right shows the instruments.
    lab.box(-2.65,.03,.22,1.0,3.65,.08,c.bg2);
    for(const x of [-2.65,-1.65])lab.rod([x,.04,.22],[x,3.72,.22],.035,c.text3);
    for(let n=1;n<=9;n++){
      const y=.15+(n-1)*.39;lab.rod([-2.65,y,-.02],[-1.65,y,-.02],.018,c.text3);
      lab.label(String(n),[-2.8,y+.13,-.04],n===floor?c.primary:c.text3);
      if(lift.cable&&lift.mode==='idle')lab.handle('f'+n,[-2.12,y+.12,-.02],.12);
    }
    const cy=.16+lift.y/3*.39;
    lab.box(-2.43,cy,-.16,.58,.32,.35,c.primary);
    lab.face([[-2.39,cy+.04,-.162],[-1.89,cy+.04,-.162],[-1.89,cy+.28,-.162],[-2.39,cy+.28,-.162]],c.bg2);
    if(lift.cable)lab.rod([-2.14,cy+.32,.02],[-2.14,3.73,.02],.012,c.text2);
    else{lab.rod([-2.14,cy+.32,.02],[-2.19,cy+.46,.02],.012,c.text2);lab.rod([-2.14,3.73,.02],[-2.09,3.52,.02],.012,c.text2);}
    lab.label('Qavatlar',[-2.15,3.92,.05]);
    const x0=-1.15,x1=2.5,b=.16,roof=3.2;
    lab.box(x0,.04,-.65,x1-x0,.12,1.4,c.text3);
    lab.box(x0,roof,.22,x1-x0,.1,.12,c.text3);
    for(const x of [x0,x1])lab.rod([x,b,.55],[x,roof,.55],.04,c.text3);
    lab.face([[x0,b,.63],[x1,b,.63],[x1,roof,.63],[x0,roof,.63]],alpha(c.bg2,.38));
    const px=.25,feet=b+.13+(ratio<.02?.07:0),bodyScale=Math.max(.78,Math.min(1.16,Math.sqrt(lift.m/65))),head=feet+1.64;
    lab.box(px-.32,b,-.45,.64,.13,.7,c.bg2);
    lab.box(px-.25,b+.025,-.47,.5,.065,.015,c.sunken);
    lab.label(`${fmt(P_/P.G,1)} kg`,[px,b+.17,-.65],c.success);
    lab.label('Tarozi',[px,b-.02,-.95]);
    for(const sign of [-1,1]){
      lab.rod([px+sign*.08*bodyScale,feet+.74,0],[px+sign*.11*bodyScale,feet+.04,0],.065*bodyScale,c.text3);
      lab.box(px+sign*.11*bodyScale-.065,feet,-.14,.13,.065,.25,c.text);
      lab.rod([px+sign*.23*bodyScale,feet+1.36,0],[px+sign*.28*bodyScale,feet+.79,-.03],.045*bodyScale,c.warning);
    }
    lab.box(px-.22*bodyScale,feet+.73,-.12,.44*bodyScale,.66,.24,c.primary);
    lab.rod([px,feet+1.39,0],[px,feet+1.49,0],.05,c.warning);
    lab.sphere([px,head,0],.13,c.warning);
    lab.rod([px-.025,head+.12,-.015],[px+.025,head+.12,.015],.1,c.text3,16);
    const dx=-.78,py=roof-.22,ext=.3+P.weight(1,lift.a)/100;
    lab.rod([dx,roof,.05],[dx,py,.05],.018,c.text2);
    helix(lab,[dx,py,.05],[dx,py-ext,.05],.065,7,c.text2,.012);
    lab.box(dx-.105,py-ext-.19,-.055,.21,.18,.21,c.warning);
    lab.label(`1 kg · ${fmt(P.weight(1,lift.a),1)} N`,[dx,py-ext-.36,-.05],c.warning);
    // Physical cabin panel has separate floor buttons, emergency release and travel indicator.
    lab.box(1.15,.63,-.02,1.12,1.95,.12,c.text3);
    lab.box(1.25,2.22,-.04,.92,.25,.025,c.sunken);
    lab.label(`${floor} ${lift.v>.05?'▲':lift.v<-.05?'▼':'·'}`,[1.71,2.36,-.07],c.warning);
    for(let n=1;n<=9;n++){
      const row=Math.floor((9-n)/3),col=(n-1)%3;
      button('f'+n,String(n),[1.34+col*.37,1.95-row*.38,-.08],lift.target===n&&lift.mode==='ride'?c.warning:c.primary,lift.cable&&lift.mode==='idle');
    }
    const can=lift.cable?lift.mode==='idle'&&lift.y>=8.5-1e-6:lift.mode==='idle';
    button('fall',lift.cable?'!':'↻',[1.7,.86,-.08],lift.cable?c.danger:c.success,can);
    lab.label(lift.cable?'Arqon uzildi':'Tiklash',[1.7,.64,-.1],c.danger);
    if(ui.show.vec){
      arrowSolid(lab,[.66,feet+.9,-.15],[.66,feet+.15,-.15],c.text2);lab.label('mg',[.78,feet+.25,-.15],c.text2);
      if(ratio>.01){arrowSolid(lab,[.9,feet,-.15],[.9,feet+.75*ratio,-.15],c.success);lab.label('N',[.98,feet+.75*ratio+.15,-.15],c.success);}
      else lab.label('N = 0',[.9,feet+.25,-.15],c.success);
      if(Math.abs(lift.a)>.01){arrowSolid(lab,[-1.38,1.5,-.1],[-1.38,1.5+lift.a*.085,-.1],c.special);lab.label('a',[-1.4,1.5+lift.a*.085+.16,-.1],c.special);}
      if(Math.abs(lift.v)>.01){arrowSolid(lab,[-1.12,1.5,-.1],[-1.12,1.5+lift.v*.2,-.1],c.primary);lab.label('v',[-1.1,1.5+lift.v*.2+.16,-.1],c.primary);}
    }
    lab.label(lift.mode==='fall'?'Erkin tushish · P = 0':lift.mode==='brake'?'Tormoz · P = 2mg':`P = ${fmt(P_,0)} N`,[.35,3.52,0],ratio<.02||ratio>1.01?c.danger:c.success);
    lab.label('Kabina ichi kattalashtirilgan',[.55,.04,-1.2]);
  }
  function draw(ctx,stage,ui,crt,rc,lift) {
    current={ui,crt,rc,lift};
    lab.begin(ctx,stage,{target:ui.mode==='law3'?[0,.9,0]:[0,ui.mode==='lift'?1.65:1.55,0],focal:ui.mode==='lift'?1.6:1.85});
    if(ui.mode==='law2')drawLaw2(crt,ui);else if(ui.mode==='law3')drawLaw3(rc,ui);else drawLift(lift,ui);
    const time=ui.mode==='law2'?crt.t:ui.mode==='law3'?rc.t:lift.t;
    lab.finish(time,ui.mode==='law2'?'Vertikal masshtab ixcham · qiymatlar SI da':ui.mode==='law3'?'Kuchlar turli jismlarga qo‘yilgan':'Bino va kabina turli masshtabda');
  }
  function parameter(id,p) {
    if(id==='ftip')return lab.nearest(forcePoint,0,4,p.x,p.y);
    if(id==='gate')return lab.nearest(gatePoint,.1,current.crt.drive==='hang'?.4:.9,p.x,p.y);
    if((id==='c1'||id==='c2')&&grab) {
      const base=recoilPoint(grab.dx,id),sign=id==='c1'?1:-1;
      const origin=lab.project(base),unit=lab.project([base[0]+1,base[1],base[2]]);
      const vx=unit.x-origin.x,vy=unit.y-origin.y;
      const displacement=((p.x-grab.p.x)*vx+(p.y-grab.p.y)*vy)/(vx*vx+vy*vy||1);
      return grab.dx+sign*displacement/25;
    }
    return null;
  }
  return {lab,draw,parameter,startDrag(id,p){grab={id,p,dx:current.rc.dx};},get recoilLimit(){return limits??1.015;}};
}
