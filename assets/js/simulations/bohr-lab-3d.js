// Apparatus geometry only: the original Frank–Hertz and Balmer models supply values.
import {createLab3D} from './lab-3d.js?v=20261126-r';
import {alpha,path,dial,ring,stand} from './apparatus-3d.js?v=20261126-r';
import {fmt} from './sim-kit.js';
import * as P from './bohr-physics.js';

const TAU=2*Math.PI,DEG=Math.PI/180;
export const SPEC={center:[.05,1.35,.35],radius:1.95};
export function telescopePoint(phi,r=SPEC.radius){const a=(phi-P.ZERO_OFFSET)*DEG;return[SPEC.center[0]+r*Math.cos(a),SPEC.center[1],SPEC.center[2]-r*Math.sin(a)];}
export const FH={cathode:-2.05,grid:.05,anode:.55,y:1.65,z:.24,r:.4};
export const filamentPoint=i=>[FH.cathode-.1+.035*Math.sin(i*TAU/8),FH.y-.23+i*.46/48,FH.z-.045];
export function opticalTubeFaces(a,b,r,wall=.025,n=24){
 const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);if(len<1e-8)return[];
 const u=d.map(v=>v/len),q=Math.abs(u[1])<.9?[0,1,0]:[1,0,0];
 let v=[u[1]*q[2]-u[2]*q[1],u[2]*q[0]-u[0]*q[2],u[0]*q[1]-u[1]*q[0]];const m=Math.hypot(...v);v=v.map(x=>x/m);
 const w=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],at=(p,rr,i)=>p.map((x,j)=>x+rr*(v[j]*Math.cos(i*TAU/n)+w[j]*Math.sin(i*TAU/n))),faces=[];
 for(let i=0;i<n;i++){
  const j=i+1,A=at(a,r,i),B=at(a,r,j),C=at(b,r,j),D=at(b,r,i),ai=at(a,r-wall,i),bi=at(a,r-wall,j),ci=at(b,r-wall,j),di=at(b,r-wall,i);
  faces.push([A,B,C,D],[bi,ai,di,ci],[ai,bi,B,A],[D,C,ci,di]);
 }
 return faces;
}

export function createBohrLab(){
 const lab=createLab3D();let narrow=false;
 const barrel=(a,b,r,color,wall=.025)=>{for(const face of opticalTubeFaces(a,b,r,wall))lab.face(face,color);};
 function diskX(x,y,z,r,color){lab.rod([x-.012,y,z],[x+.012,y,z],r,color,32);}
 function glassX(x0,x1,y,z,r){
  const c=lab.colors;
  for(let i=0;i<32;i++){const a=i*TAU/32,b=(i+1)*TAU/32,p=(x,t)=>[x,y+r*Math.cos(t),z+r*Math.sin(t)];lab.face([p(x0,a),p(x1,a),p(x1,b),p(x0,b)],alpha(c.primary,c.dark?.17:.1));}
  for(const x of [x0,x1])ring(lab,[x,y,z],r,alpha(c.text,c.dark?.72:.5),'x',.009);
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])lab.line([x0,y+r*Math.cos(a),z+r*Math.sin(a)],[x1,y+r*Math.cos(a),z+r*Math.sin(a)],alpha(c.text2,.58),1);
 }
 function boxMeter(x,y,z,w,h,title,value,col){
  const c=lab.colors;lab.box(x-w/2,y-h/2,z,w,h,.3,c.bg2);
  lab.box(x-w*.43,y-h*.25,z-.006,w*.86,h*.55,.012,c.sunken);
  if(title)lab.label(title,[x,y+h*.65,z-.025],c.text2);if(value)lab.label(value,[x,y,z-.025],col);
 }
 function knobUnit(x,id,frac,title,value,col=lab.colors.primary){
  const c=lab.colors;lab.box(x-.33,.06,-1.48,.66,.48,.4,c.bg2);dial(lab,[x,.34,-1.5],frac,col,id,title);lab.label(value,[x,.89,-1.5],col);
 }
 function terminal(p,col){lab.rod(p,[p[0],p[1]+.08,p[2]],.035,col,8);}
 function fhScene(fh,electrons,current){
  const c=lab.colors,g=P.GASES[fh.gas],{cathode:K,grid:G,anode:A,y,z,r}=FH;
  // The oven is an open cutaway, so the electrode system remains inspectable.
  if(fh.gas==='Hg'){
   lab.box(-2.55,.75,z-.58,3.45,.18,1.16,c.text3);
   for(let i=0;i<20;i++){const a=i*Math.PI/20,b=(i+1)*Math.PI/20,p=(x,t)=>[x,y+.58*Math.cos(t),z+.58*Math.sin(t)];lab.face([p(-2.5,a),p(.82,a),p(.82,b),p(-2.5,b)],alpha(c.warning,c.dark?.17:.14));}
   if(!narrow)lab.label('Pech · ochiq kesim',[-.85,2.62,z],c.text2);
  }
  for(const x of [-2.35,.76]){stand(lab,x,z,y-r,c.text3);lab.rod([x,y-r,z-.26],[x,y-r,z+.26],.03,c.text3,8);}
  glassX(-2.45,.84,y,z,r);
  // Separate heater and cathode; the accelerating grid and collector are wired separately.
  let prev;for(let i=0;i<=48;i++){const p=filamentPoint(i);if(prev)lab.rod(prev,p,.009,c.warning,6);prev=p;}
  lab.rod([K,y-.27,z],[K,y+.27,z],.022,c.text2,10);
  for(let i=-3;i<=3;i++){const a=i*r/4,lim=Math.sqrt(r*r*.82-a*a);lab.rod([G,y+a,z-lim],[G,y+a,z+lim],.004,c.text2,6);lab.rod([G,y-lim,z+a],[G,y+lim,z+a],.004,c.text2,6);}
  diskX(A,y,z,r*.82,c.text3);
  for(const [x,label]of [[K,'K'],[G,'G'],[A,'A']])lab.label(label,[x,y+.62,z],c.text2);
  const layers=P.glowLayers(fh.U,fh.gas,fh.T);
  if(g.visible)for(const f of layers){const x=K+(G-K)*f;diskX(x,y,z,r*.78,alpha(c.warning,.48));}
  // Hg excitation is ultraviolet: no invented visible luminescent bands.
  lab.label(g.visible?(narrow?'Ne · yorug‘ qatlamlar':'Ne · yorug‘ uyg‘otish qatlamlari'):(narrow?'Hg · UB ko‘rinmaydi':'Hg · UB 254 nm ko‘rinmaydi'),[-.1,1.0,z],g.visible?c.warning:c.text2);
  if(fh.U>g.Uc)for(const [i,e]of electrons.entries()){
   const a=i*2.39996,q=[K+(A-K)*e.x,y+e.y*.24,z+Math.sin(a)*.18];lab.rod([q[0]-.015,q[1],q[2]],[q[0]+.015,q[1],q[2]],.012,c.primary,6);
  }
  knobUnit(-.55,'voltage',fh.U/g.Umax,'U',fmt(fh.U,2)+' V');
  knobUnit(.55,'retard',(fh.Ur-.5)/2.5,'Uᵣ',fmt(fh.Ur,1)+' V',c.special);
  if(fh.gas==='Hg'){
   knobUnit(-2,'temp',(fh.T-140)/60,'T',fmt(fh.T,0)+' °C',c.warning);
   const heat=[];for(let i=0;i<=36;i++)heat.push([-2.4+i*3.1/36,.97,z+.46+(i%2)*.07]);path(lab,heat,c.warning,.008);
   path(lab,[[-2.15,.55,-1.1],[-2.7,.18,-.6],heat[0]],c.warning,.012);path(lab,[[-1.85,.55,-1.1],[-1.6,.14,-.7],[.7,.14,.9],heat.at(-1)],c.warning,.012);
  }
  lab.box(-2.78,.06,.92,.74,.4,.48,c.bg2);if(!narrow)lab.label('Filament 6,3 V',[-2.41,.73,1.05],c.warning);
  boxMeter(2.05,1.3,.45,1.1,.7,'Nanoampermetr',fmt(current,2)+' nA',c.success);stand(lab,2.05,.58,.95,c.text3);
  const ports={heater1:[K-.12,1.18,z-.12],heater2:[K-.08,1.18,z+.12],K:[K,1.12,z],G:[G,1.12,z],A:[A,1.12,z]};
  for(const [key,p]of Object.entries(ports)){
   if(!key.startsWith('heater'))lab.rod(p,[p[0],y-.27,p[2]],.012,c.text3,6);
   terminal(p,key==='G'?c.danger:key==='A'?c.special:c.primary);
  }
  path(lab,[ports.heater1,[K-.16,y-.28,z-.12],filamentPoint(0)],c.text3,.012);
  path(lab,[ports.heater2,[K-.26,y-.28,z+.12],[K-.26,y+.31,z+.12],filamentPoint(48)],c.text3,.012);
  const wire=(pts,col)=>path(lab,pts,col,.012);
  wire([[-2.65,.46,.92],[-2.8,.25,.7],ports.heater1],c.warning);wire([[-2.2,.46,.92],[-1.7,.18,.7],ports.heater2],c.warning);
  wire([[-.75,.55,-1.1],[-1.2,.15,-.9],ports.K],c.primary);wire([[-.35,.55,-1.1],[-.15,.2,-.65],ports.G],c.danger);
  wire([[.35,.55,-1.1],[.15,.2,-.45],ports.G],c.special);
  wire([[.75,.55,-1.1],[1.2,.23,-.8],[1.7,.96,.45]],c.special);wire([[2.3,.96,.45],[2.6,.2,.8],[.8,.2,.8],ports.A],c.success);
 }
 function eyepiece(sp){
  const c=lab.colors,x=1.95,y=1.15,z=-1.32,w=1.17,h=1.05,fov=1.2;
  boxMeter(x,y,z,w+.1,h+.1,'','',c.primary);if(!narrow)lab.label('Okulyar',[x,y+h/2+.3,z-.08],c.text2);
  lab.face([[x-w/2,y-h/2,z-.02],[x+w/2,y-h/2,z-.02],[x+w/2,y+h/2,z-.02],[x-w/2,y+h/2,z-.02]],c.sunken);
  for(const l of P.linesInView(sp.phi,sp.gr,fov)){const xx=x+l.off/fov*w/2,col=l.line?l.line.color:c.text,ww=.012;
   for(const [k,a]of [[3,.08],[2,.15],[1,.8]])lab.face([[xx-ww*k,y-h/2,z-.025],[xx+ww*k,y-h/2,z-.025],[xx+ww*k,y+h/2,z-.025],[xx-ww*k,y+h/2,z-.025]],alpha(col,a));
  }
  lab.line([x,y-h/2,z-.03],[x,y+h/2,z-.03],alpha(c.text,.85),.8);lab.line([x-w/2,y,z-.03],[x+w/2,y,z-.03],alpha(c.text,.65),.7);
  stand(lab,x,z+.1,.56,c.text3);lab.handle('eyepiece',[x,y,z-.03],.25);lab.label('φ '+fmt(sp.phi,2)+'°',[x,.48,z-.1],c.primary);
 }
 function specScene(sp){
  const c=lab.colors,C=SPEC.center,y=C[1],d=P.GRATINGS[sp.gr].d;
  lab.rod([C[0],.3,C[2]],[C[0],.78,C[2]],.2,c.text3,32);
  lab.rod([C[0],.74,C[2]],[C[0],.84,C[2]],1.5,c.bg2,80);
  for(let a=-80;a<=80;a++){const r=a%10===0?1.28:a%5===0?1.34:1.4,t=a*DEG,p=(rr)=>[C[0]+rr*Math.cos(t),.85,C[2]-rr*Math.sin(t)];lab.line(p(r),p(1.48),c.text3,a%10===0?1:.6);if(a%40===0&&Math.abs(a)<80&&(!narrow||a===0))lab.label(String(a)+'°',p(1.15),c.text2);}
  stand(lab,-2.65,.35,1.05,c.text3);lab.rod([-2.65,1.05,.35],[-2.65,1.85,.35],.065,c.special,20);
  for(const yy of [1.05,1.85])lab.rod([-2.65,yy,.35],[-2.65,yy,.55],.025,c.text3,8);
  path(lab,[[-2.65,1.05,.55],[-2.85,.12,.8],[-2.5,.35,-.4]],c.primary,.012);path(lab,[[-2.65,1.85,.55],[-2.9,.12,.95],[-2.25,.35,-.4]],c.danger,.012);
  lab.box(-2.75,.05,-.65,.75,.45,.5,c.bg2);lab.label('H₂ lampa',[-2.65,2.1,.35],c.special);
  barrel([-2.35,y,.35],[-.5,y,.35],.14,c.text3);diskX(-.49,y,.35,.112,alpha(c.primary,.4));
  // A narrow slit lies at the lamp end; light reaches the grating along +x.
  // Two jaws leave a real vertical opening rather than painting a slit on a solid cap.
  for(const z0 of [.20,.36])lab.box(-2.39,y-.15,z0,.04,.3,.14,c.text3);
  for(const yy of [y-.17,y+.15])lab.box(-2.39,yy,.20,.04,.02,.3,c.text3);
  lab.line([-2.6,y,.35],C,alpha(c.special,.5),1.4);
  if(!narrow)lab.label('Kollimator',[-1.5,1.75,.35],c.text2);stand(lab,-1.45,.35,1.18,c.text3);
  lab.rod([C[0],.84,C[2]],[C[0],y-.33,C[2]],.035,c.text3,10);
  lab.face([[C[0],y-.3,C[2]-.32],[C[0],y+.3,C[2]-.32],[C[0],y+.3,C[2]+.32],[C[0],y-.3,C[2]+.32]],alpha(c.primary,.18));
  for(const zz of [-.34,.34])lab.rod([C[0],y-.33,C[2]+zz],[C[0],y+.33,C[2]+zz],.02,c.text3,8);
  for(const yy of [-.33,.33])lab.rod([C[0],y+yy,C[2]-.34],[C[0],y+yy,C[2]+.34],.02,c.text3,8);
  for(let i=-8;i<=8;i++)lab.line([C[0]-.005,y-.28,C[2]+i*.035],[C[0]-.005,y+.28,C[2]+i*.035],alpha(c.text2,.55),.5);
  lab.label(sp.gr+' chiziq/mm',[C[0],1.92,C[2]],c.primary);
  for(const line of P.LINES)for(const k of [-3,-2,-1,1,2,3]){const a=P.diffAngle(P.balmerNm(line.n),k,d);if(a===null||Math.abs(a)>80)continue;lab.line(C,telescopePoint(a+P.ZERO_OFFSET,1.65),alpha(line.color,.3+.3*line.I),.6+line.I);}
  lab.line(C,telescopePoint(P.ZERO_OFFSET,1.65),alpha(c.text,.6),1);
  const near=telescopePoint(sp.phi,.45),end=telescopePoint(sp.phi,1.9),lens=telescopePoint(sp.phi,.43),eye=telescopePoint(sp.phi,2.01);
  barrel(near,end,.13,c.text3);lab.rod(lens,telescopePoint(sp.phi,.47),.105,alpha(c.primary,.5),24);barrel(end,eye,.1,c.primary,.025);
  path(lab,[[C[0],.88,C[2]],[end[0],.88,end[2]],[end[0],y-.13,end[2]]],c.text3,.035);
  lab.handle('telescope',eye,.25);if(!narrow)lab.label('Teleskop',[eye[0],y+.42,eye[2]],c.primary);
  eyepiece(sp);
 }
 function angle(p){
  // Invert the projected horizontal instrument plane, independently of camera orbit.
  const o=SPEC.center,u=[o[0]+1,o[1],o[2]],v=[o[0],o[1],o[2]+1],q=lab.project(o),a=lab.project(u),b=lab.project(v);
  const ax=a.d*(a.x-p.x)-q.d*(q.x-p.x),ay=b.d*(b.x-p.x)-q.d*(q.x-p.x),bx=a.d*(a.y-p.y)-q.d*(q.y-p.y),by=b.d*(b.y-p.y)-q.d*(q.y-p.y),det=ax*by-ay*bx;
  if(Math.abs(det)<1e-6)return null;
  const rx=q.d*(p.x-q.x),ry=q.d*(p.y-q.y),x=(rx*by-ay*ry)/det,z=(ax*ry-rx*bx)/det;
  if(Math.hypot(x,z)<.1)return null;return Math.atan2(-z,x)/DEG+P.ZERO_OFFSET;
 }
 return{lab,angle,draw(ctx,stage,ui,fh,sp,electrons,current){
  narrow=stage.w<560;const focal=narrow?Math.min(stage.w*1.35/stage.h,1.7)*.88:1.7;
  lab.begin(ctx,stage,{target:[0,1.35,0],focal});if(ui.mode==='fh')fhScene(fh,electrons,current);else specScene(sp);
  lab.finish(ui.t,ui.mode==='fh'?'Nay kesimi · elektronlar kattalashtirilgan':'Panjara chiziqlari kattalashtirilgan · burchak haqiqiy');
 }};
}
