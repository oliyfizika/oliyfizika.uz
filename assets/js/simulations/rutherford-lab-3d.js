// Apparatus dimensions are in cm; the separate nucleus model uses isotropic fm.
import {createLab3D} from './lab-3d.js?v=20261126-r';
import {alpha,path,dial,ring,stand,arrowSolid,dashed} from './apparatus-3d.js?v=20261126-r';
import {fmt} from './sim-kit.js';
import * as P from './rutherford-physics.js';
const TAU=Math.PI*2,DEG=Math.PI/180;
export const CM=.165,ORIGIN=[-.65,.92,.25],FM=.0118,MICRO_Y=1.55;
export const chamberPoint=(x,y=0,height=0)=>[ORIGIN[0]+x*CM,ORIGIN[1]+height,ORIGIN[2]-y*CM];
export const detectorPoint=th=>chamberPoint(P.APP.L*Math.cos(th*DEG),P.APP.L*Math.sin(th*DEG));
export const detectorGrip=th=>chamberPoint((P.APP.L+1)*Math.cos(th*DEG),(P.APP.L+1)*Math.sin(th*DEG),.18);
export const microPoint=(x,y=0,z=0)=>[x*FM,MICRO_Y+y*FM,z];
export const impactPoint=b=>microPoint(-175,b);
export const MICRO_BOUNDS=[-210,210,-110,160];
export function clipMicro(a,b,bounds=MICRO_BOUNDS){
 let lo=0,hi=1;for(const [j,min,max]of [[0,bounds[0],bounds[1]],[1,bounds[2],bounds[3]]]){
  const d=b[j]-a[j];if(Math.abs(d)<1e-12){if(a[j]<min||a[j]>max)return null;continue;}
  const t0=(min-a[j])/d,t1=(max-a[j])/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
 }return lo<=hi?[a.map((v,j)=>v+(b[j]-v)*lo),a.map((v,j)=>v+(b[j]-v)*hi)]:null;
}
export function createRutherfordLab(){
 const lab=createLab3D();let state;
 const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,k)=>a.map(v=>v*k);
 function disk(center,r,color,axis='y',inner=0,n=64){
  const p=(t,R)=>axis==='x'?[center[0],center[1]+R*Math.cos(t),center[2]+R*Math.sin(t)]:axis==='z'?[center[0]+R*Math.cos(t),center[1]+R*Math.sin(t),center[2]]:[center[0]+R*Math.cos(t),center[1],center[2]+R*Math.sin(t)];
  for(let j=0;j<n;j++){const a=j*TAU/n,b=(j+1)*TAU/n;lab.face(inner?[p(a,inner),p(a,r),p(b,r),p(b,inner)]:[center,p(a,r),p(b,r)],color);}
 }
 function hollowX(center,depth,R,r,color){
  for(let i=0;i<32;i++){const a=TAU*i/32,b=TAU*(i+1)/32,p=(x,rad,t)=>[center[0]+x,center[1]+rad*Math.cos(t),center[2]+rad*Math.sin(t)];
   for(const x of [-depth/2,depth/2])lab.face([p(x,r,a),p(x,R,a),p(x,R,b),p(x,r,b)],color);
   for(const rad of [R,r])lab.face([p(-depth/2,rad,a),p(depth/2,rad,a),p(depth/2,rad,b),p(-depth/2,rad,b)],color);
  }
 }
 function collector(th,lit){
  const c=lab.colors,D=detectorPoint(th),u=[Math.cos(th*DEG),0,-Math.sin(th*DEG)],v=[0,1,0],w=[Math.sin(th*DEG),0,Math.cos(th*DEG)],back=add(D,mul(u,1.7*CM)),ap=Math.sqrt(P.APP.Ad/Math.PI)*CM;
  const p=(at,r,t)=>add(at,add(mul(v,r*Math.cos(t)),mul(w,r*Math.sin(t))));
  for(let i=0;i<24;i++){const a=TAU*i/24,b=(i+1)*TAU/24;lab.face([p(D,.11,a),p(back,.11,a),p(back,.11,b),p(D,.11,b)],c.text3);lab.face([p(D,ap,a),p(D,.11,a),p(D,.11,b),p(D,ap,b)],c.text2);lab.face([p(D,ap,a),p(back,ap,a),p(back,ap,b),p(D,ap,b)],c.sunken);lab.face([back,p(back,.11,a),p(back,.11,b)],c.text2);const at=add(D,mul(u,.025));lab.face([at,p(at,ap,a),p(at,ap,b)],lit?c.warning:c.success);}
  // The small entrance is genuinely open; the scintillator sits inside the cup.
  const pivot=[ORIGIN[0],.4,ORIGIN[2]],armEnd=[back[0],.4,back[2]];
  lab.rod(pivot,armEnd,.027,c.text2,10);lab.rod(armEnd,[back[0],ORIGIN[1]-.09,back[2]],.025,c.text3,10);lab.rod([pivot[0],.13,pivot[2]],pivot,.075,c.text2,16);
  const grip=detectorGrip(th);lab.rod([grip[0],ORIGIN[1],grip[2]],grip,.02,c.text3,8);lab.sphere(grip,.045,c.primary);
  lab.handle('detector',grip,.17);lab.label('θ '+fmt(th,0)+'°',add(grip,[0,.42,0]),c.primary);
  const feed=chamberPoint(7.5,-8.2,-.42);lab.rod(feed,add(feed,[.1,0,.1]),.075,c.text2,12);
  path(lab,[back,add(back,[.1,.15,.12]),feed,[1.25,.1,1.8],[2.1,.1,.25],[2.1,.82,-.82]],c.success,.016);
  return D;
 }
 function counter(s,narrow){
  const c=lab.colors,x=2.05,z=-1.24,r=s.run||s.last,N=r?r.N:0,t=r?r.t:0,T=s.run?s.run.T:s.last?s.last.t:s.T;
  lab.box(1.18,.04,z,1.74,1.63,.56,c.bg2);lab.box(1.3,.91,z-.015,1.5,.61,.025,c.sunken);
  lab.label(narrow?'Sanoq':'SANAGICH',[x,1.9,z]);lab.label(String(N).padStart(6,'0')+(narrow?'':' N'),[x,narrow?1.43:1.37,z-.06],c.success);
  lab.label(fmt(t,1)+' / '+fmt(T,0)+' s',[x,.98,z-.06],c.text2);
  dial(lab,[1.55,.34,z-.045],Math.max(0,[10,30,60,100,300,600,1200].indexOf(s.T))/6,c.primary,'time','t');
  dial(lab,[2.55,.34,z-.045],Math.max(0,[1,10,100,1000].indexOf(s.speed))/3,c.warning,'speed','×');
  if(!narrow)lab.label(fmt(s.T,0)+' s',[1.55,.57,z],c.primary);lab.label('×'+s.speed,[2.55,.57,z],c.warning);
  lab.rod([x,.35,z-.07],[x,.35,z-.12],.09,s.run?c.danger:c.success,20);lab.handle('action',[x,.35,z-.13],.13);lab.label(s.run?'To‘xta':'Sanash',[x,.16,z-.1]);
 }
 function pump(s,h,narrow){
  const c=lab.colors;lab.box(1.7,.03,.78,.98,.28,.65,c.text3);lab.rod([1.9,.43,1.1],[2.5,.43,1.1],.2,c.bg2,20);
  const port=chamberPoint(5,-10,.05);path(lab,[[2.02,.61,1.08],[1.62,.7,1.3],[port[0],port[1],port[2]]],c.text3,.05);lab.rod(port,add(port,[.1,0,.07]),.09,c.text2,12);
  lab.rod([2.45,.16,.74],[2.45,.2,.68],.07,s.vacuum?c.success:c.danger,16);lab.handle('pump',[2.45,.2,.66],.13);
  lab.label(narrow?'Nasos':'Nasos '+(s.vacuum?'yoqilgan':'o‘chiq'),[2.12,.91,1.05],s.vacuum?c.success:c.text2);
  // Pressure gauge connects to the chamber through a metal stem.
  const G=chamberPoint(-1,-11.1,.55);lab.rod(chamberPoint(-1,-11.1,.05),G,.028,c.text3,10);disk([G[0],G[1],G[2]-.02],.16,c.bg2,'z');ring(lab,G,.16,c.text3,'z',.018);
  const f=Math.max(0,Math.min(1,Math.log10(Math.max(1,s.p))/Math.log10(P.P_ATM))),a=(-.75+f*1.5)*Math.PI;
  lab.line([G[0],G[1],G[2]-.04],[G[0]+Math.sin(a)*.12,G[1]+Math.cos(a)*.12,G[2]-.04],c.danger,1.4);
  lab.label('p '+h.pressure,[G[0],G[1]+.31,G[2]],s.p>1000?c.danger:c.text2);
 }
 function apparatus(ui,s,h,narrow){
  const c=lab.colors,R=11.15*CM,O=ORIGIN;
  disk([O[0],.15,O[2]],R,c.bg2);
  for(let i=0;i<80;i++){const a=i*TAU/80,b=(i+1)*TAU/80,p=(t,y,r=R)=>[O[0]+r*Math.cos(t),y,O[2]+r*Math.sin(t)];
   const y=Math.sin((a+b)/2)>=0?1.24:.38;lab.face([p(a,.15),p(a,y),p(b,y),p(b,.15)],c.text3);lab.face([p(a,1.25,R-.035),p(a,1.25,R+.035),p(b,1.25,R+.035),p(b,1.25,R-.035)],c.text2);
  }
  disk([O[0],1.255,O[2]],R-.04,alpha(c.primary,c.dark?.08:.055));
  lab.label(narrow?'Vakuum kamera':'Vakuum kamera · old devor kesilgan',[O[0],2.7,O[2]+R]);
  // All path coordinates use the same cm scale as the apparatus passport.
  const source=chamberPoint(-P.APP.Ls),sx=source[0],sz=source[2],outer=.235,hole=.035;
  // Four walls of the shield leave a channel through which alpha particles escape.
  lab.box(sx-.18,O[1]-outer,sz-outer,.43,outer-hole,outer*2,c.text3);lab.box(sx-.18,O[1]+hole,sz-outer,.43,outer-hole,outer*2,c.text3);
  for(const z of [sz-outer,sz+hole])lab.box(sx-.18,O[1]-hole,z,.43,hole*2,outer-hole,c.text3);
  lab.sphere(source,.025,c.warning);if(!narrow)lab.label(P.SOURCES[s.src].name,[sx,1.9,sz],c.warning);
  for(const x of [-5.6,-3.6]){hollowX(chamberPoint(x),.07,.16,.03,c.text2);const p=chamberPoint(x);lab.rod([p[0],.2,p[2]],[p[0],O[1]-.16,p[2]],.025,c.text3,10);}
  if(!narrow)lab.label('Kollimatorlar',chamberPoint(-4.5,0,.36));
  const foilCol=s.mat==='Au'?c.warning:s.mat==='Cu'?c.danger:c.text2;
  lab.box(O[0]-.006,.55,O[2]-.22,.012,.7,.44,foilCol);
  for(const z of [O[2]-.26,O[2]+.26])lab.rod([O[0],.48,z],[O[0],1.31,z],.025,c.text3,10);
  for(const y of [.48,1.31])lab.rod([O[0],y,O[2]-.26],[O[0],y,O[2]+.26],.025,c.text3,10);
  lab.rod([O[0],.16,O[2]],[O[0],.48,O[2]],.03,c.text3,10);lab.label(s.mat+' · '+fmt(s.tUm,1)+' µm',[O[0],1.8,O[2]],foilCol);
  // Goniometer circle lies in the same plane as the scattering process.
  for(let a=-180;a<180;a+=5){const x=Math.cos(a*DEG),y=Math.sin(a*DEG);lab.line(chamberPoint(10.7*x,10.7*y,.35),chamberPoint((a%30===0?10.1:10.45)*x,(a%30===0?10.1:10.45)*y,.35),c.text2,.85);if(!narrow&&(a===0||(a===90&&s.th<110)))lab.label(a+'°',chamberPoint(11.7*x,11.7*y,.36),c.text3);}
  const blocked=h.rate.blocked,stop=blocked?Math.min(0,P.airRange(P.SOURCES[s.src].E)*P.P_ATM/Math.max(s.p,1)-P.APP.Ls):10.4;
  lab.line(chamberPoint(-P.APP.Ls),chamberPoint(stop),alpha(c.warning,.7),1.8);
  const end=chamberPoint(10.45);hollowX(end,.1,.15,.03,c.text3);
  // Visual tracks never change the original Poisson count process.
  for(const t of s.tracks){const d=t.age*16-P.APP.Ls;let x,y;if(d<0){x=d;y=t.y0;}else{x=d*Math.cos(t.th);y=t.y0+d*Math.sin(t.th);}if(d+P.APP.Ls>t.stop||Math.hypot(x,y)>10.8)continue;lab.sphere(chamberPoint(x,y),.018,c.warning);}
  const D=collector(s.th,s.led>0);if(s.flashes.length)lab.line(O,D,c.warning,1.6);
  if(!narrow)lab.label('8,0 cm',[O[0]+(D[0]-O[0])*.62,.62,O[2]+(D[2]-O[2])*.62],c.primary);
  const A=chamberPoint(-8.5,-1.6,.06),B=chamberPoint(0,-1.6,.06);lab.line(A,B,c.text3,.9);if(!narrow)lab.label('8,5 cm',[.5*(A[0]+B[0]),.64,A[2]],c.text3);
  lab.box(-2.56,.03,-1.27,.52,.36,.34,c.bg2);dial(lab,[-2.3,.23,-1.29],(s.tUm-.5)/3.5,c.warning,'thickness','t');
  counter(s,narrow);pump(s,h,narrow);
 }
 function microScene(ui,s,m,h){
  const c=lab.colors,d=h.d,R=P.nucRadius(P.MATERIALS[s.mat].A),tr=h.traj(m.b),theta=Math.abs(tr.theta);
  // A mounted teaching model keeps the nucleus and paths in a clearly marked plane.
  for(const x of [-2.55,2.55]){stand(lab,x,.4,3.56,c.text3);lab.rod([x,.15,.4],[x,3.56,.4],.018,c.text3,8);}
  for(const y of [.15,3.56])lab.rod([-2.55,y,.4],[2.55,y,.4],.018,c.text3,8);
  lab.face([[-2.54,.16,.43],[2.54,.16,.43],[2.54,3.55,.43],[-2.54,3.55,.43]],alpha(c.primary,.035));
  const segment=(a,b,col,width=1)=>{const cl=clipMicro(a,b);if(cl)lab.line(microPoint(cl[0][0],cl[0][1]),microPoint(cl[1][0],cl[1][1]),col,width);};
  for(let x=-200;x<=200;x+=50)segment([x,-110],[x,160],alpha(c.text3,.2),.5);
  for(let y=-100;y<=150;y+=50)segment([-210,y],[210,y],alpha(c.text3,.2),.5);
  if(m.fan)for(let b=-150;b<=150;b+=15){if(b===0)continue;const t=h.traj(b);for(let i=1;i<t.pts.length;i++)segment(t.pts[i-1],t.pts[i],alpha(c.text2,c.dark?.27:.2),.8);}
  for(let i=1;i<tr.pts.length;i++)segment(tr.pts[i-1],tr.pts[i],c.primary,2.2);
  lab.sphere(microPoint(0),R*FM,c.warning);lab.label('+'+P.MATERIALS[s.mat].Z+'e',[0,MICRO_Y-.26,-.01],c.warning);
  const rm=P.rMin(d,theta||Math.PI);let prev;
  for(let j=0;j<=100;j++){const p=[rm*Math.cos(j*TAU/100),rm*Math.sin(j*TAU/100)];if(prev&&j%4<2)segment(prev,p,c.danger,1);prev=p;}
  let closest=tr.pts[0];for(const p of tr.pts)if(Math.hypot(p[0],p[1])<Math.hypot(closest[0],closest[1]))closest=p;
  segment([0,0],closest,c.danger,1.5);lab.label('r_min '+fmt(rm,1)+' fm',[.75,.4,0],c.danger);
  segment([-210,0],[210,0],alpha(c.text2,.7),1);segment([-175,0],[-175,m.b],c.success,1.5);
  const impact=impactPoint(m.b);lab.sphere(impact,.055,c.success);lab.handle('impact',impact,.16);lab.label('b '+fmt(m.b,0)+' fm',[impact[0]+.36,impact[1]+.16,0],c.success);
  segment([0,0],[200*Math.cos(tr.theta),200*Math.sin(tr.theta)],alpha(c.warning,.65),1);
  lab.label('θ '+fmt(theta/DEG,1)+'°',[1.48,3.25,0],c.warning);
  const duration=tr.pts.at(-1)[2]-tr.pts[0][2],time=tr.pts[0][2]+((m.anim*110)%(duration+60));let index=tr.pts.findIndex(p=>p[2]>=time);if(index<0)index=tr.pts.length-1;
  const a=tr.pts[index];if(a[0]>=-210&&a[0]<=210&&a[1]>=-110&&a[1]<=160){lab.sphere(microPoint(a[0],a[1]),.045,c.danger);}
  segment([125,-90],[175,-90],c.text2,1.6);lab.label('50 fm',[150*FM,MICRO_Y-105*FM,0],c.text2);
  lab.label('Kulon modeli · x/y bir xil fm masshtabda',[0,3.83,.1]);
 }
 function planeY(p,y){
  const O=lab.project([0,y,0]),U=lab.project([1,y,0]),V=lab.project([0,y,1]);
  const ax=U.d*(U.x-p.x)-O.d*(O.x-p.x),ay=V.d*(V.x-p.x)-O.d*(O.x-p.x),bx=U.d*(U.y-p.y)-O.d*(O.y-p.y),by=V.d*(V.y-p.y)-O.d*(O.y-p.y),det=ax*by-ay*bx;
  if(Math.abs(det)<1e-6)return null;const rx=O.d*(p.x-O.x),ry=O.d*(p.y-O.y);return[(rx*by-ay*ry)/det,y,(ax*ry-rx*bx)/det];
 }
 return {lab,draw(ctx,stage,ui,s,m,h){state={ui,s,m};lab.begin(ctx,stage,{target:ui.mode==='lab'?[0,1,0]:[0,1.8,0],focal:stage.w<560?Math.min(stage.w*1.35/stage.h,1.65)*.88:1.65});if(ui.mode==='lab')apparatus(ui,s,h,stage.w<560);else microScene(ui,s,m,h);lab.finish(ui.t,ui.mode==='lab'?'Dasta tekisligi: cm · folga qalinligi kattalashtirilgan':'fm · α belgisi kattalashtirilgan · ko‘rinish kesilgan');},
  parameter(id,p){if(id==='detector'){const q=planeY(p,ORIGIN[1]+.18);return q?Math.atan2(ORIGIN[2]-q[2],q[0]-ORIGIN[0])/DEG:null;}if(id==='impact'){const q=lab.planePoint(p.x,p.y,0);return q?(q[1]-MICRO_Y)/FM:null;}return null;}
 };
}
