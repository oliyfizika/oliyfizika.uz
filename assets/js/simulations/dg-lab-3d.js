// Volumetric apparatus; the original DG / graphite models remain authoritative.
import {createLab3D} from './lab-3d.js?v=20261126-r';
import {alpha,path,dial,ring,stand,arrowSolid} from './apparatus-3d.js?v=20261126-r';
import {fmt} from './sim-kit.js';
import * as P from './dg-physics.js';

const TAU=Math.PI*2,DEG=Math.PI/180;
export const DG_TARGET=[-.9,.88,0],DG_RADIUS=1.62;
export const DG_CHAMBER={center:[-.3,1.85,.15],r:1.8};
export const MONITOR={x:1.75,y:1.72,z:-1.28,r:.88,mm:52};
export const collectorPoint=phi=>[DG_TARGET[0]+DG_RADIUS*Math.sin(phi*DEG),DG_TARGET[1]+DG_RADIUS*Math.cos(phi*DEG),0];
export const collectorGrip=phi=>[DG_TARGET[0]+(DG_RADIUS+.3)*Math.sin(phi*DEG),DG_TARGET[1]+(DG_RADIUS+.3)*Math.cos(phi*DEG),0];
export const jawPoint=value=>[MONITOR.x+value*MONITOR.r/MONITOR.mm,MONITOR.y+MONITOR.r+.13,MONITOR.z-.06];
export function createDGLab(){
 const lab=createLab3D();let state,narrow=false;
 const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(p,k)=>p.map(v=>v*k);
 function disk(center,r,color,axis='z',inner=0,n=64){
  const p=(a,R)=>axis==='x'?[center[0],center[1]+R*Math.cos(a),center[2]+R*Math.sin(a)]:axis==='y'?[center[0]+R*Math.cos(a),center[1],center[2]+R*Math.sin(a)]:[center[0]+R*Math.cos(a),center[1]+R*Math.sin(a),center[2]];
  for(let j=0;j<n;j++){const a=TAU*j/n,b=TAU*(j+1)/n;lab.face(inner?[p(a,inner),p(a,r),p(b,r),p(b,inner)]:[center,p(a,r),p(b,r)],color);}
 }
 function shellX(x0,x1,y,z,r0,r1,color){
  for(let j=0;j<48;j++){const a=TAU*j/48,b=TAU*(j+1)/48,p=(x,r,t)=>[x,y+r*Math.cos(t),z+r*Math.sin(t)];lab.face([p(x0,r0,a),p(x1,r1,a),p(x1,r1,b),p(x0,r0,b)],color);}
  for(const t of [0,Math.PI/2,Math.PI,Math.PI*1.5])lab.line([x0,y+r0*Math.cos(t),z+r0*Math.sin(t)],[x1,y+r1*Math.cos(t),z+r1*Math.sin(t)],alpha(lab.colors.dark?lab.colors.text:lab.colors.primary,lab.colors.dark?.86:.68),1.3);
 }
 function hollowCup(front,axis){
  const c=lab.colors,L=Math.hypot(...axis),u=axis.map(v=>v/L),v=[u[1],-u[0],0],w=[0,0,1],back=add(front,mul(u,.27));
  const p=(at,r,t)=>add(at,add(mul(v,r*Math.cos(t)),mul(w,r*Math.sin(t))));
  for(let j=0;j<24;j++){const a=TAU*j/24,b=TAU*(j+1)/24;lab.face([p(front,.13,a),p(back,.13,a),p(back,.13,b),p(front,.13,b)],c.text3);lab.face([p(front,.09,a),p(front,.13,a),p(front,.13,b),p(front,.09,b)],c.warning);lab.face([back,p(back,.13,a),p(back,.13,b)],c.text2);lab.face([p(front,.09,a),p(back,.09,a),p(back,.09,b),p(front,.09,b)],c.sunken);}
 }
 function instrument(x,z,w,title,value,col){
  const c=lab.colors;lab.box(x-w/2,.04,z,w,.52,.5,c.bg2);lab.box(x-w*.4,.26,z-.008,w*.8,.22,.025,c.sunken);
  if(!narrow||title!=='Katod isitgichi')lab.label(title,[x,.83,z],c.text2);if(!narrow||value!=='doimiy')lab.label(value,[x,.38,z-.045],col);
  for(const xx of [x-w*.32,x+w*.32])lab.rod([xx,.06,z+.1],[xx,-.01,z+.1],.035,c.text3,8);
 }
 function pump(){
  const c=lab.colors;lab.box(1.72,.05,.45,.88,.32,.68,c.text3);lab.rod([1.91,.42,.75],[2.38,.42,.75],.19,c.bg2,18);lab.rod([2.38,.42,.75],[2.48,.42,.75],.14,c.text2,18);
  const [cx,cy]=DG_CHAMBER.center,port=[cx+DG_CHAMBER.r*Math.cos(-.7),cy+DG_CHAMBER.r*Math.sin(-.7),.4];
  path(lab,[[1.92,.58,.8],[1.58,.64,.8],port],c.text3,.055);
  lab.rod([port[0],port[1],.35],[port[0],port[1],.48],.09,c.text2,12);
  if(!narrow)lab.label('Nasos · vakuum',[2.15,.98,.75]);
 }
 function drawDG(ui,dg,h){
  const c=lab.colors,O=DG_TARGET,C=DG_CHAMBER.center,R=DG_CHAMBER.r;
  // The viewport and the metal drum have depth; front glass exposes the apparatus.
  disk([C[0],C[1],.45],R,c.bg2);
  for(let j=0;j<64;j++){const a=j*TAU/64,b=(j+1)*TAU/64,p=(t,z,r=R)=>[C[0]+r*Math.cos(t),C[1]+r*Math.sin(t),z];lab.face([p(a,-.24),p(a,.45),p(b,.45),p(b,-.24)],c.text3);lab.face([p(a,-.25,R-.05),p(a,-.25,R+.025),p(b,-.25,R+.025),p(b,-.25,R-.05)],c.text2);}
  disk([C[0],C[1],-.265],R-.06,alpha(c.primary,c.dark?.055:.045));
  for(const x of [C[0]-1.25,C[0]+1.25]){const top=C[1]-Math.sqrt(R*R-1.25**2);stand(lab,x,.3,top+.025,c.text3);lab.rod([x-.12,top+.025,.3],[x+.12,top+.025,.3],.04,c.text3,10);}
  lab.label(narrow?'Vakuum kamerasi':'Vakuum kamerasi · shaffof old oyna',[-1.75,3.25,-.1]);
  // Hot cathode, anode rings and insulating feedthroughs of the electron gun.
  lab.rod([O[0],2.42,0],[O[0],3.1,0],.145,alpha(c.primary,.12),24);
  lab.rod([O[0],2.96,-.06],[O[0],3.04,.06],.022,c.warning,10);
  for(const y of [2.5,2.66,2.8])disk([O[0],y,0],.105,c.text2,'y',.045,24);
  lab.rod([O[0]-.065,3.1,0],[O[0]-.065,3.23,0],.02,c.primary,8);lab.rod([O[0]+.065,3.1,0],[O[0]+.065,3.23,0],.02,c.danger,8);
  if(!narrow)lab.label('Elektron to‘pi',[-1.78,2.85,-.1]);
  arrowSolid(lab,[O[0],2.41,0],add(O,[0,.1,0]),c.primary,.014);
  // Ni surface is perpendicular to the incident normal.
  lab.box(O[0]-.23,O[1]-.07,-.15,.46,.09,.3,c.text3);
  for(let i=0;i<6;i++)for(let j=0;j<3;j++)lab.sphere([O[0]-.19+i*.075,O[1]+.027,-.1+j*.1],.018,c.success);
  lab.rod(add(O,[0,-.04,.2]),[O[0],.21,.2],.04,c.text2,12);lab.label('Ni (111)',[O[0],.52,-.15],c.success);
  const D=collectorPoint(dg.phi),u=D.map((v,i)=>v-O[i]),Lu=Math.hypot(...u),unit=u.map(v=>v/Lu);
  // A pivot and rear arm hold the cup; its open mouth faces the crystal.
  lab.rod(add(O,[0,0,.18]),add(D,[0,0,.18]),.025,c.text3,10);lab.rod(add(O,[0,0,.14]),add(O,[0,0,.5]),.08,c.text2,12);
  hollowCup(D,unit);arrowSolid(lab,add(O,mul(unit,.13)),D,c.warning,.012);
  const grip=collectorGrip(dg.phi);lab.rod(add(D,mul(unit,.27)),grip,.028,c.text3,10);lab.sphere(grip,.045,c.primary);ring(lab,grip,.066,c.primary,'z',.009);
  lab.handle('collector',grip,.18);lab.label('φ '+fmt(dg.phi,1)+'°',add(add(O,mul(unit,DG_RADIUS*.55)),[.38,0,-.12]),c.primary);
  // Graduations on the same true angular plane as the collector.
  for(let a=10;a<=90;a+=5){const u=[Math.sin(a*DEG),Math.cos(a*DEG),0],r=DG_RADIUS+.15;lab.line(add(O,mul(u,r)),add(O,mul(u,r+(a%10===0?.09:.04))),c.text2,.9);if(a%20===10&&(!narrow||a===10||a===90))lab.label(a+'°',add(O,mul(u,r+.22)),c.text3);}
  lab.line(add(O,[0,.1,-.03]),add(O,[0,.72,-.03]),c.text3,.8);
  path(lab,[add(D,mul(unit,.27)),add(D,[.12,.12,.27]),[.95,1.12,.5],[1.48,.17,-.5],[1.97,.52,-.98]],c.success,.018);
  instrument(-2,-1.12,1.05,'Tezlatgich',fmt(dg.U,0)+' V',c.primary);dial(lab,[-2,.2,-1.145],(dg.U-20)/80,c.primary,'voltage','U');
  instrument(2,-1.12,1.15,'Galvanometr',fmt(h.current,3)+' nA',c.success);
  path(lab,[[-2.32,.54,-1],[-2.3,.1,-.56],[-2.22,3.24,.3],[O[0]+.065,3.23,0],[O[0]+.16,3.1,0],[O[0]+.16,2.5,0],[O[0]+.105,2.5,0]],c.danger,.015);
  path(lab,[[-1.68,.54,-1],[-1.73,.1,-.55],[-1.63,3.25,.35],[O[0]-.065,3.23,0],[O[0],2.99,0]],c.primary,.015);
  instrument(-2.3,.7,.65,'Katod isitgichi','doimiy',c.warning);
  for(const z0 of [-.06,.06])path(lab,[[-2.3+z0,.55,.7],[-2.15+z0,.2,.9],[O[0]+z0,3.1,.12],[O[0],3+z0*2/3,z0]],c.warning,.009);
  path(lab,[[1.65,.54,-1],[1.4,.12,-.6],[O[0],.2,.45],add(O,[0,-.07,.15])],c.text3,.015);
  // Anode, crystal and current-meter return share the supply's positive reference.
  path(lab,[[-2.3,.1,-.56],[-1.85,.15,.45],[O[0],.2,.45]],c.danger,.015);
  pump();
 }
 function pattern(center,r,axis,U){
  const c=lab.colors,p=(rr,t)=>axis==='x'?[center[0],center[1]+rr*Math.cos(t),center[2]+rr*Math.sin(t)]:[center[0]+rr*Math.cos(t),center[1]+rr*Math.sin(t),center[2]];
  disk(center,r,c.sunken,axis);
  for(const [i,d]of P.GRAPHITE.d.entries()){
   const rr=P.ringD(U,d)/2*r/MONITOR.mm;
   for(let k=-2;k<=2;k++){const R=rr+k*.45*r/MONITOR.mm;for(let j=0;j<80;j++)lab.line(p(R,TAU*j/80),p(R,TAU*(j+1)/80),alpha(c.success,(i?.65:.95)*Math.exp(-k*k/3)),Math.max(.7,r*.018));}
  }
  disk(axis==='x'?[center[0]+.002,center[1],center[2]]:[center[0],center[1],center[2]-.002],r*.035,c.success,axis);
 }
 function drawGR(ui,gr){
  const c=lab.colors,y=1.62,z=.45,xScreen=.78,rScreen=.76,xFilm=xScreen-P.GRAPHITE.L*rScreen/MONITOR.mm;
  // Sealed glass tube with real ring cones from the thin graphite film.
  const glass=alpha(c.primary,c.dark?.19:.13);
  shellX(-2.58,xFilm,y,z,.18,.18,glass);shellX(xFilm,xScreen,y,z,.18,rScreen,glass);
  for(const x of [-2.58,xFilm,xScreen]){const r=x<0?.18:rScreen;ring(lab,[x,y,z],r,c.text3,'x',.018);}
  for(const x of [-2.2,.55]){stand(lab,x,z,.65,c.text3);lab.rod([x,.6,z],[x,y-(x<0?.18:.66),z],.035,c.text3,10);}
  lab.rod([-2.53,y,z-.04],[-2.53,y,z+.04],.02,c.warning,10);
  for(const x of [-2.36,-2.18,-1.99])disk([x,y,z],.13,c.text2,'x',.045,24);
  arrowSolid(lab,[-2.12,y,z],[xFilm,y,z],c.primary,.014);disk([xFilm,y,z],.13,alpha(c.text2,.6),'x');
  if(!narrow){lab.label('Elektron to‘pi',[-2.35,1.95,z]);lab.label('Grafit plyonka',[xFilm,2.3,z],c.text2);}
  for(const d of P.GRAPHITE.d){const r=P.ringD(gr.U,d)/2*rScreen/MONITOR.mm;for(const t of [0,Math.PI/2,Math.PI,Math.PI*1.5])lab.line([xFilm,y,z],[xScreen,y+r*Math.cos(t),z+r*Math.sin(t)],alpha(c.success,.65),.9);}
  pattern([xScreen+.005,y,z],rScreen,'x',gr.U);lab.label('L = 135 mm',[.05,2.7,z]);
  instrument(-1.72,-1.15,1.25,'Yuqori kuchlanish',fmt(gr.U,2)+' kV',c.primary);dial(lab,[-1.72,.2,-1.18],(gr.U-2.5)/2.5,c.primary,'voltage','U');
  path(lab,[[-2.1,.54,-1],[-2.6,.12,-.9],[-1.99,.7,.7],[-1.99,y+.13,z]],c.danger,.018);
  path(lab,[[-1.34,.54,-1],[-1.2,.1,-.85],[-2.69,y,.45],[-2.58,y,z],[-2.53,y,z]],c.primary,.018);
  instrument(-2.15,.95,.7,'Katod isitgichi','doimiy',c.warning);
  for(const z0 of [-.04,.04])path(lab,[[-2.15+z0,.55,.95],[-2.7+z0,.6,.85],[-2.53,y,z+z0]],c.warning,.01);
  // A front inspection screen copies the same calibrated circular pattern.
  const M=MONITOR;pattern([M.x,M.y,M.z],M.r,'z',gr.U);ring(lab,[M.x,M.y,M.z+.015],M.r,c.text2,'z',.03);
  stand(lab,M.x,M.z+.1,M.y-M.r,c.text3);lab.label('O‘lchov ekrani',[M.x,M.y+M.r+.85,M.z]);
  // Virtual caliper is an optical overlay: the jaws and scale share one mm map.
  const yy=M.y+M.r+.03;lab.box(M.x-M.r-.06,yy,M.z-.05,M.r*2+.12,.07,.09,c.text3);
  for(let mm=-50;mm<=50;mm+=5){const xx=M.x+mm*M.r/M.mm;lab.line([xx,yy+.08,M.z-.065],[xx,yy+.08+(mm%10===0?.05:.025),M.z-.065],c.text,.8);if([-40,0,40].includes(mm))lab.label((mm>0?'+':'')+mm,[xx,yy+.2,M.z],c.text3);}
  for(const [key,value]of [['jL',gr.jL],['jR',gr.jR]]){
   const x=M.x+value*M.r/M.mm,col=key.endsWith(gr.active)?c.warning:c.primary;
   lab.box(x-.025,yy-.04,M.z-.07,.05,.18,.1,col);lab.line([x,M.y-M.r+.02,M.z-.06],[x,yy,M.z-.06],col,1.2);lab.handle(key,jawPoint(value),.15);
  }
  lab.label('D '+fmt(Math.round((gr.jR-gr.jL)*10)/10,1)+' mm',[M.x,.51,M.z],c.warning);
 }
 return {lab,draw(ctx,stage,ui,dg,gr,h){state={ui,dg,gr};narrow=stage.w<560;lab.begin(ctx,stage,{target:[0,1.5,0],focal:stage.w<560?Math.min(stage.w*1.35/stage.h,1.65)*.9:1.65});if(ui.mode==='dg')drawDG(ui,dg,h);else drawGR(ui,gr);lab.finish(ui.t,ui.mode==='dg'?'Qurilma ochiq kesimda · elektronlar sekinlashtirilgan':'Diametr: ikkala ekranda bir xil mm · optik shtangensirkul');},
  parameter(id,p){if(id==='collector'){const q=lab.planePoint(p.x,p.y,0);return q?Math.atan2(q[0]-DG_TARGET[0],q[1]-DG_TARGET[1])/DEG:null;}if(id==='jL'||id==='jR'){
   const q=lab.planePoint(p.x,p.y,MONITOR.z-.06);return q?(q[0]-MONITOR.x)*MONITOR.mm/MONITOR.r:null;
  }return null;}
 };
}
