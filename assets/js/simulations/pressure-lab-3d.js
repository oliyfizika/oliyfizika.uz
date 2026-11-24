// Tabletop pressure apparatus. The UI's original SI models remain unchanged.
import { createLab3D } from './lab-3d.js?v=20261123-batch6b';
import { alpha, arrowSolid, dashed, dial, path, ring } from './apparatus-3d.js?v=20261123-batch6b';
import { clamp, fmt } from './sim-kit.js';
import * as P from './pressure-physics.js';

export const sensorPoint = (h, x) => [-2.2 + 1.8 * x, 2.65 - 3 * h, -.35];
export const levelPoint = (level, x = -1.45) => [x, .35 + level * 5.4, -.22];
export const oilPoint = oil => [1.1, .4 + (.2 - P.uTube(1000, P.LIQUIDS.oil.rho, oil).x + oil) * 5, -.08];
export const pressPoint = s1 => [-1.4, 2.15 - s1 * .04, 0];
export const ballPoint = F => [-2.25 + F * .006, 1.45, 0];

export function createPressureLab() {
  const lab = createLab3D(); let state;
  const indentation=p=>Math.min(.22,p/25000*.22);
  function horizontalRing(center, radius, color, width = 1.2) {
    for (let i = 0; i < 40; i++) {
      const p = t => [center[0] + Math.cos(t) * radius, center[1], center[2] + Math.sin(t) * radius];
      lab.line(p(i * Math.PI / 20), p((i + 1) * Math.PI / 20), color, width);
    }
  }
  function cylinder(x, y0, y1, z, radius, color) {
    if (Math.abs(y1 - y0) > 1e-5) lab.rod([x, y0, z], [x, y1, z], radius, color, 24);
  }
  function rotatedBox(center, dx, dy, dz, angle, color) {
    const cc = Math.cos(angle), ss = Math.sin(angle);
    const corners = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    lab.solid(corners.map(([x,y,z]) => [center[0] + x*dx/2*cc-y*dy/2*ss, center[1]+x*dx/2*ss+y*dy/2*cc, center[2]+z*dz/2]), color);
  }
  function human(x, feet, skis, c) {
    for (const z of [-.2,.2]) {
      if (skis) {
        lab.box(x-1.25,feet-.055,z-.06,2.5,.055,.12,c.primary);
        path(lab,[[x+1.25,feet-.025,z],[x+1.4,feet+.04,z],[x+1.45,feet+.12,z]],c.primary,.03);
      }
      lab.box(x-.17,feet,z-.085,.35,.1,.17,c.text2);
      lab.rod([x,feet+.1,z],[x,feet+.8,z*.5],.06,c.text3,10);
      lab.rod([x,feet+1.35,z],[x-.15,feet+.82,z*1.6],.045,c.warning,10);
    }
    lab.box(x-.18,feet+.76,-.19,.36,.65,.38,c.primary);
    lab.rod([x,feet+1.4,0],[x,feet+1.51,0],.055,c.warning,10);
    lab.sphere([x,feet+1.65,0],.145,c.warning);
  }
  function car(x, y, size, c) {
    lab.box(x-size*.5,y+.1,-size*.24,size,size*.22,size*.48,c.danger);
    lab.box(x-size*.26,y+size*.24,-size*.2,size*.52,size*.23,size*.4,c.danger);
    lab.box(x-size*.22,y+size*.28,-size*.205,size*.44,size*.15,.015,c.bg2);
    for (const xx of [x-size*.3,x+size*.3]) for (const z of [-size*.26,size*.26])
      lab.rod([xx,y+.1,z-.03],[xx,y+.1,z+.03],size*.1,c.text2,16);
  }
  function solidLoadPoint(extra) {
    const f=P.FACES[state.solid.face], top=.48-indentation(P.pressure(P.weightN(P.BRICK.m+extra),f.S))+f.h*5;
    return [-.6,top+extra*.045+.32,-.05];
  }
  function drawSolid(solid) {
    const c=lab.colors, s=solid.obj==='brick'?{F:P.weightN(3.5+solid.extra),S:P.FACES[solid.face].S}:P.OBJECTS[solid.obj];
    const F=s.F??P.weightN(s.m),p=P.pressure(F,s.S),snow=['boots','skis'].includes(solid.obj),ground=snow?c.bg2:c.warning;
    const dent=solid.obj==='needle'?.26:indentation(p),y=.48-dent;
    lab.box(-2.65,.03,-1.05,5.3,.3,2.1,c.text3);
    lab.box(-2.55,.33,-.95,5.1,.15,1.9,alpha(ground,.72));
    for (let i=0;i<48;i++) {
      const x=-2.4+(i*37%47)/47*4.8,z=-.8+(i*17%43)/43*1.6;
      lab.line([x,.484,z],[x+.035,.484,z+.01],alpha(c.text3,.3),.6);
    }
    if(solid.obj==='brick') {
      const f=P.FACES[solid.face],width=f.w*5,height=f.h*5,depth=f.S/f.w*5;
      lab.box(-.6-width/2,.48-dent,-depth/2,width,dent,depth,alpha(c.text,.3));
      lab.box(-.6-width/2,y,-depth/2,width,height,depth,c.danger);
      for(let i=1;i<=3;i++)lab.line([-.6-width/2,y+height*i/4,-depth/2-.003],[-.6+width/2,y+height*i/4,-depth/2-.003],alpha(c.warning,.7),1);
      for(let i=0;i<solid.extra;i++)lab.box(-.82,y+height+i*.045,-.19,.44,.04,.38,c.text2);
      const handle=solidLoadPoint(solid.extra);lab.rod([-.6,y+height,-.05],handle,.018,c.text3,8);
      ring(lab,handle,.07,c.primary,'z',.018);lab.handle('load',handle,.17);
      lab.handle('brick',[-.6,y+height*.5,-depth/2],.24);
      lab.label(`+${fmt(solid.extra,0)} kg`,[handle[0]+.42,handle[1],handle[2]],c.primary);
    } else if(solid.obj==='boots'||solid.obj==='skis') {
      for(const z of [-.2,.2])lab.box(solid.obj==='skis'?-1.7:-.65,.48-dent,z-.09,solid.obj==='skis'?2.5:.36,dent,.18,alpha(c.text,.3));
      human(-.45,y,solid.obj==='skis',c);
    } else if(solid.obj==='needle') {
      lab.rod([-.5,y,0],[-.5,2.2,0],.016,c.text2,12);
      ring(lab,[-.5,2.12,0],.033,c.text3,'z',.008);
      lab.box(-.72,2.2,-.16,.44,.24,.32,c.warning);
      arrowSolid(lab,[-1,2.7,0],[-1,2.05,0],c.danger);
      lab.label('F = 1 N',[-1,2.9,0],c.danger);
    } else {
      for(const z of [-.45,.45]) {
        lab.box(-1.65,y,z-.19,2.4,.26,.38,c.text2);
        for(let i=0;i<6;i++)lab.rod([-1.43+i*.38,y+.13,z-.2],[-1.43+i*.38,y+.13,z+.2],.1,c.bg2,12);
        for(let i=0;i<18;i++)lab.line([-1.6+i*.13,y+.263,z-.2],[-1.6+i*.13,y+.263,z+.2],c.text3,.7);
      }
      lab.box(-1.35,y+.26,-.38,1.3,.62,.76,c.success);
      lab.box(-.05,y+.26,-.4,.75,1.02,.8,c.success);
      lab.box(0,y+.75,-.405,.65,.43,.015,c.bg2);
      lab.box(-.15,y+1.3,-.48,.95,.06,.96,c.text2);
      lab.rod([-1.15,y+.88,.25],[-1.15,y+1.4,.25],.035,c.text2,8);
    }
    lab.label(snow?'Qor':solid.obj==='tractor'?'Tuproq':'Qum',[-2.2,.6,-.9]);
    lab.label(`S = ${s.S>=1e-4?fmt(s.S*1e4,0)+' cm²':fmt(s.S*1e6,2)+' mm²'}`,[-.5,.13,-1.18],c.text2);
    // The logarithmic indicator mirrors the comparison graph, not a linear indentation scale.
    const bar=clamp(Math.log10(Math.max(1,p))/8,0,1)*1.6;
    lab.box(1.65,.48,-.15,.45,1.7,.3,c.bg2);lab.box(1.78,.53,-.17,.16,bar,.025,c.primary);
    lab.label(p>=1e6?`${fmt(p/1e6,1)} MPa`:`${fmt(p/1000,1)} kPa`,[1.87,2.5,0],c.primary);
    lab.label('p · log',[1.87,.25,-.25]);
  }
  function drawPress(pas) {
    const c=lab.colors,r1=.055*Math.sqrt(pas.S1),r2=.055*Math.sqrt(pas.S2),y1=1.7-pas.s1*.04,y2=1.7+P.pressLift(pas.s1,pas.S1,pas.S2)*.04;
    const F1=P.forceToLift(pas.M,pas.S1*1e-4,pas.S2*1e-4),F2=P.weightN(pas.M);
    lab.box(-2.6,.03,-.75,5.2,.12,1.5,c.text3);
    for(const [x,r,y]of [[-1.4,r1,y1],[1.1,r2,y2]]) {
      cylinder(x,.22,2.55,0,r+.025,alpha(c.text3,.14));
      cylinder(x,.24,y-.02,0,r,alpha(c.warning,.45));
      for(const yy of [.24,2.55])horizontalRing([x,yy,0],r+.025,c.text2,1.4);
      cylinder(x,y-.035,y+.035,0,r+.015,c.text2);
      cylinder(x,y+.035,y+.3,0,.025,c.text2);
    }
    path(lab,[[-1.4,.3,0],[-1.4,.2,0],[1.1,.2,0],[1.1,.3,0]],alpha(c.warning,.6),.055);
    const handle=pressPoint(pas.s1);cylinder(-1.4,y1+.3,handle[1],0,.025,c.text2);
    lab.rod([-1.65,handle[1],0],[-1.15,handle[1],0],.035,c.primary,12);
    lab.handle('knob',handle,.2);
    lab.box(1.1-Math.max(.3,r2),y2+.27,-Math.max(.3,r2),Math.max(.6,r2*2),.07,Math.max(.6,r2*2),c.text2);
    if(pas.M>=800)car(1.1,y2+.34,1.5,c);else lab.box(.8,y2+.34,-.3,.6,.42,.6,c.warning);
    lab.label(`${fmt(pas.M,0)} kg`,[1.1,y2+.96,0],c.warning);
    arrowSolid(lab,[-2.05,handle[1]+.35,0],[-2.05,handle[1]-.12,0],c.danger);
    lab.label('F₁',[-2.1,handle[1]+.55,0],c.danger);
    arrowSolid(lab,[2.55,y2-.4,0],[2.55,y2+.2,0],c.success);lab.label('F₂',[2.55,y2+.4,0],c.success);
    dashed(lab,[-2.2,1.7,.15],[2.5,1.7,.15],c.text3);
    lab.label(`s₁ ${fmt(pas.s1,1)} cm`,[-1.65,.65,-.45],c.primary);
    lab.label(`s₂ ${fmt(P.pressLift(pas.s1,pas.S1,pas.S2),2)} cm`,[1.7,.65,-.45],c.success);
    lab.label(`F₁ ${fmt(F1,1)} N · F₂ ${fmt(F2,0)} N`,[0,2.9,0]);
    lab.box(-1.42,.04,-1.43,2.85,.39,.42,c.bg2);
    dial(lab,[-.92,.25,-1.45],(pas.S1-1)/19,c.primary,'area1','S₁');
    dial(lab,[0,.25,-1.45],(pas.S2-20)/480,c.success,'area2','S₂');
    dial(lab,[.92,.25,-1.45],(pas.M-10)/1990,c.warning,'pressMass','M');
  }
  function drawBall(pas) {
    const c=lab.colors,O=[.8,1.45,0],R=.58,p=P.pistonPressure(pas.F,10e-4),k=ballPoint(pas.F),piston=k[0]+.6;
    lab.box(-2.5,.04,-.65,4.7,.12,1.3,c.bg2);
    lab.rod([.8,.16,0],[.8,.85,0],.07,c.text3,16);
    lab.sphere(O,R,alpha(c.primary,.24));
    lab.rod([-1.9,1.45,0],[.28,1.45,0],.14,alpha(c.text3,.16),24);
    lab.rod([piston,1.45,0],[.28,1.45,0],.105,alpha(c.primary,.4),20);
    lab.rod([piston-.03,1.45,0],[piston+.03,1.45,0],.13,c.text2,20);
    lab.rod(k,[piston,1.45,0],.025,c.text2,12);ring(lab,k,.1,c.primary,'z',.025);lab.handle('ball',k,.18);
    arrowSolid(lab,[k[0]-.35,1.86,0],[k[0]+.15,1.86,0],c.danger);lab.label(`F ${fmt(pas.F,0)} N`,[k[0],2.08,0],c.danger);
    const length=.15+P.jetSpeed(p)*.075;
    for(let i=0;i<9;i++) {
      const yy=1-2*(i+.5)/9,rr=Math.sqrt(1-yy*yy),a=i*Math.PI*(3-Math.sqrt(5)),n=[rr*Math.cos(a),yy,rr*Math.sin(a)];
      const start=O.map((v,j)=>v+n[j]*R),end=O.map((v,j)=>v+n[j]*(R+length));
      lab.rod(start,start.map((v,j)=>v+n[j]*.035),.034,c.text2,8);
      if(pas.F>0)lab.rod(start,end,.014,c.primary,8);
    }
    lab.label(`Δp = ${fmt(p/1000,1)} kPa`,[.8,2.85,0],c.primary);
    lab.label('9 oqim · bir xil tezlik',[.8,.3,-.8]);
  }
  function uPath(xLeft,xRight,topLeft,topRight,base,radius,z=0) {
    const pts=[[xLeft,topLeft,z],[xLeft,base,z]],center=(xLeft+xRight)/2;
    for(let i=1;i<=20;i++){const a=Math.PI+i*Math.PI/20;pts.push([center+radius*Math.cos(a),base+radius*Math.sin(a),z]);}
    pts.push([xRight,topRight,z]);return pts;
  }
  function drawDepth(flu) {
    const c=lab.colors,L=P.LIQUIDS[flu.liq],liq=['oil','kerosene'].includes(flu.liq)?c.warning:flu.liq==='mercury'?c.text3:c.primary;
    lab.box(-2.45,.1,-.56,2.3,.15,1.12,c.text2);
    lab.box(-2.4,.25,-.5,2.2,2.4,1,alpha(liq,.28));
    // The open free surface is a separate, visibly horizontal meniscus plane.
    lab.face([[-2.4,2.653,-.5],[-.2,2.653,-.5],[-.2,2.653,.5],[-2.4,2.653,.5]],alpha(liq,.38));
    for(const z of [-.5,.5])lab.line([-2.4,2.657,z],[-.2,2.657,z],liq,1.8);
    for(const x of [-2.4,-.2])lab.line([x,2.657,-.5],[x,2.657,.5],liq,1.8);
    for(const z of [-.17,.18])lab.line([-1.9,2.658,z],[-.7,2.658,z],alpha(c.bg2,.55),.9);
    lab.label(L.name,[-1.3,2.33,.45],liq);
    for(const x of [-2.4,-.2])for(const z of [-.5,.5])lab.rod([x,.25,z],[x,2.82,z],.016,c.text3,8);
    for(const z of [-.5,.5])for(const y of [.25,2.65])lab.line([-2.4,y,z],[-.2,y,z],c.text3,1.3);
    horizontalRing([-1.3,2.65,0],.01,c.primary);
    for(let cm=0;cm<=80;cm+=10){const y=2.65-cm*.03;lab.line([-2.4,y,-.53],[-2.5,y,-.53],c.text3,1);if(cm%20===0)lab.label(`${cm}`,[-2.65,y,-.53]);}
    lab.label('h, cm',[-2.65,2.95,-.53]);
    const p=sensorPoint(flu.h,flu.x);
    rotatedBox(p,.28,.18,.18,flu.rot,c.bg2);
    const normal=[-Math.cos(flu.rot),-Math.sin(flu.rot),0],mem=p.map((v,j)=>v+normal[j]*.145);
    rotatedBox(mem,.025,.19,.19,flu.rot,c.warning);lab.handle('probe',p,.2);
    dashed(lab,[-2.4,p[1],-.52],[p[0],p[1],-.52],c.primary);
    path(lab,[p,[p[0],2.83,-.35],[.7,2.83,-.1],[.7,2.65,0]],c.text2,.015);
    const dh=L.rho/1000*flu.h,scale=Math.min(3,1.5/Math.max(dh,1e-6)),half=dh*scale/2,mid=1.55;
    const glass=uPath(.7,1.6,2.65,2.65,.7,.45);
    path(lab,glass,alpha(c.text3,.18),.085);
    path(lab,uPath(.7,1.6,mid-half,mid+half,.7,.45),c.primary,.043);
    for(const y of [mid-half,mid+half])dashed(lab,[.65,y,-.1],[2.2,y,-.1],c.text3);
    lab.line([2.15,mid-half,-.1],[2.15,mid+half,-.1],c.primary,1.6);
    lab.label(`Δh ${fmt(dh*100,1)} cm`,[2.2,1.55,0],c.primary);
    lab.label(`Δp ${fmt(P.hydro(L.rho,flu.h)/1000,2)} kPa`,[1.15,2.95,0],c.primary);
    lab.label(flu.atm?`p₀ + Δp = ${fmt(P.hydro(L.rho,flu.h,true)/1000,1)} kPa`:`h = ${fmt(flu.h*100,0)} cm`,[-1.3,2.99,0],c.warning);
    lab.label('U-manometr: Δp',[1.15,.13,-.3]);
    lab.label(flu.atm?'p₀ manometrga qo‘shilmaydi':'Membranani burish: p o‘zgarmaydi',[0,.08,-1.25]);
  }
  function prism(section,level,color,z0=-.22,z1=.22) {
    const c=lab.colors,[bl,br,tl,tr]=section,H=1.8,top=.35+H,y=levelPoint(level)[1],t=(y-.35)/H;
    const left=bl+(tl-bl)*t,right=br+(tr-br)*t;
    const poly=[[bl,.35,z0],[br,.35,z0],[right,y,z0],[left,y,z0],[bl,.35,z1],[br,.35,z1],[right,y,z1],[left,y,z1]];
    lab.solid(poly,alpha(color,.3));
    for(const z of [z0,z1]){
      lab.line([bl,.35,z],[tl,top,z],c.text3,1.4);lab.line([br,.35,z],[tr,top,z],c.text3,1.4);
      lab.line([tl,top,z],[tr,top,z],c.text3,.8);
    }
    for(const [b,tt]of [[bl,tl],[br,tr]]){lab.line([b,.35,z0],[b,.35,z1],c.text3);lab.line([tt,top,z0],[tt,top,z1],c.text3);}
    lab.face([[bl,.35,z0],[tl,top,z0],[tr,top,z0],[br,.35,z0]],alpha(c.text3,.06));
    lab.face([[bl,.35,z1],[tl,top,z1],[tr,top,z1],[br,.35,z1]],alpha(c.text3,.06));
    const center=(left+right)/2;lab.handle('level',[center,y,z0],.18);
    return center;
  }
  function drawVessels(flu) {
    const c=lab.colors;lab.box(-2.8,.05,-.6,5.5,.12,1.2,c.bg2);
    path(lab,[[-2.5,.31,0],[-.15,.31,0]],alpha(c.primary,.55),.075);
    for(const sec of [[-2.55,-2.05,-2.55,-2.05],[-1.6,-1.3,-1.85,-1.05],[-.65,-.4,-.4,-.15]])prism(sec,flu.level,c.primary);
    const ly=levelPoint(flu.level)[1];dashed(lab,[-2.7,ly,-.3],[-.02,ly,-.3],c.primary);
    for(let cm=0;cm<=30;cm+=10){const y=.35+cm*.054;lab.line([-2.75,y,-.27],[-2.65,y,-.27],c.text3);lab.label(`${cm}`,[-2.9,y,-.27]);}
    lab.label(`Suv sathi ${fmt(flu.level*100,0)} cm`,[-1.45,2.5,0],c.primary);
    const u=P.uTube(1000,P.LIQUIDS.oil.rho,flu.oil),wl=.2-u.x,wr=.2+u.x,oilTop=wl+flu.oil;
    path(lab,uPath(1.1,2.2,2.55,2.55,.8,.55),alpha(c.text3,.18),.095);
    path(lab,uPath(1.1,2.2,.4+wl*5,.4+wr*5,.8,.55),c.primary,.05);
    if(flu.oil>0)cylinder(1.1,.4+wl*5,.4+oilTop*5,0,.05,c.warning);
    const op=oilPoint(flu.oil);horizontalRing([op[0],op[1],0],.12,c.warning,2);lab.handle('oil',op,.19);
    for(const y of [.4+wl*5,.4+wr*5])dashed(lab,[.9,y,-.12],[2.55,y,-.12],c.text3);
    lab.label('Moy',[1.1,2.8,0],c.warning);lab.label('Suv',[2.2,2.8,0],c.primary);
    lab.label(`hₘ ${fmt(flu.oil*100,1)} cm`,[1.1,.13,-.3],c.warning);
    lab.label('ρₘhₘ = ρₛhₛ',[1.65,.05,-1.08]);
  }
  function draw(ctx,stage,ui,solid,pas,flu) {
    state={ui,solid,pas,flu};
    lab.begin(ctx,stage,{target:[0,1.35,0],focal:1.7});
    if(ui.mode==='solid')drawSolid(solid);
    else if(ui.mode==='pascal')(pas.view==='ball'?drawBall:drawPress)(pas);
    else(flu.view==='vessels'?drawVessels:drawDepth)(flu);
    const note=ui.mode==='solid'?'Jismlar masshtabi turlicha · iz sxematik':ui.mode==='pascal'?(pas.view==='ball'?'Oqimlarga og‘irlik ta’siri hisobga olinmagan':'S ∝ r² · porshen yo‘li kattalashtirilgan'):flu.view==='depth'?'Δh haqiqiy · manometr masshtabi avtomatik':'Sathlar bir xil vertikal masshtabda';
    lab.finish(0,note);
  }
  function parameter(id,p) {
    if(id==='load')return lab.nearest(solidLoadPoint,0,12,p.x,p.y);
    if(id==='knob')return lab.nearest(pressPoint,0,20,p.x,p.y);
    if(id==='ball')return lab.nearest(ballPoint,0,100,p.x,p.y);
    if(id==='oil')return lab.nearest(oilPoint,0,.2,p.x,p.y);
    if(id==='level') {
      // Any vessel's level moves vertically; keep the grabbed x coordinate so no orbit jump occurs.
      const at=lab.planePoint(p.x,p.y,-.22);return at?(at[1]-.35)/5.4:null;
    }
    return null;
  }
  function probe(x,y) {const p=lab.planePoint(x,y,-.35);return p?{h:clamp((2.65-p[1])/3,0,.8),x:clamp((p[0]+2.2)/1.8,0,1)}:null;}
  return {lab,draw,parameter,probe};
}
