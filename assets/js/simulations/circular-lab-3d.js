// Seven tabletop apparatus variants; all dynamics stay in circular-physics.js.
import { createLab3D } from './lab-3d.js?v=20261123-batch7a';
import { alpha, arrowSolid, dashed, path, ring, stand } from './apparatus-3d.js?v=20261123-batch7a';
import { clamp, fmt } from './sim-kit.js';
import * as P from './circular-physics.js';

const TAU=Math.PI*2, DEG=Math.PI/180;
export const kinPoint=(x,y)=>[-.75+1.55*x,1.65+1.55*y,-.08];
export const stringPoint=(x,y)=>[-.65+1.4*x,.38,-1.4*y];
export const loopPoint=(x,y)=>[.35+.6*x,.18+.6*y,0];
export const bankPoint=a=>[2.6,.5+.8*Math.tan(a),-.95];
export const needlePoint=v=>{const a=(225-270*v/160)*DEG;return[1.9+.5*Math.cos(a),1.65+.5*Math.sin(a),-.16];};

export function createCircularLab() {
  const lab=createLab3D();let state;
  const circle=(center,r,color,plane='xy',width=.018,n=64)=>{
    const at=a=>plane==='xz'?[center[0]+r*Math.cos(a),center[1],center[2]+r*Math.sin(a)]:[center[0]+r*Math.cos(a),center[1]+r*Math.sin(a),center[2]];
    for(let i=0;i<n;i++)lab.rod(at(i*TAU/n),at((i+1)*TAU/n),width,color,6);
  };
  function disc(center,r,th,color,gear=false,zCount=24) {
    const c=lab.colors,z=center[2];
    lab.rod([center[0],center[1],z],[center[0],center[1],z+.15],r*(gear?.9:1),color,32);
    if(gear) {
      const pts=[];
      for(let i=0;i<zCount*4;i++){const a=th+i*TAU/(zCount*4),rr=r+([0,3].includes(i%4)?-.035:.035);pts.push([center[0]+rr*Math.cos(a),center[1]+rr*Math.sin(a),z-.005]);}
      for(let i=0;i<pts.length;i++){
        const a=pts[i],b=pts[(i+1)%pts.length],aa=[a[0],a[1],z+.15],bb=[b[0],b[1],z+.15];
        lab.face([[center[0],center[1],z-.005],a,b],color);lab.face([a,aa,bb,b],color);
      }
    }else for(const zz of [z-.005,z+.155])circle([center[0],center[1],zz],r,c.text2,'xy',.016,48);
    lab.rod([center[0],center[1],z-.05],[center[0],center[1],z+.21],.065,c.text2,16);
    for(let i=0;i<4;i++){const a=th+i*Math.PI/2;lab.rod([center[0],center[1],z-.025],[center[0]+r*.83*Math.cos(a),center[1]+r*.83*Math.sin(a),z-.025],.018,c.bg2,6);}
  }
  function inverse(p,origin,axisX,axisY) {
    const q=lab.project(origin),u=lab.project(origin.map((v,i)=>v+axisX[i])),v=lab.project(origin.map((v,i)=>v+axisY[i]));
    const ax=u.d*(u.x-p.x)-q.d*(q.x-p.x),ay=v.d*(v.x-p.x)-q.d*(q.x-p.x);
    const bx=u.d*(u.y-p.y)-q.d*(q.y-p.y),by=v.d*(v.y-p.y)-q.d*(q.y-p.y),det=ax*by-ay*bx;
    if(Math.abs(det)<1e-6)return null;
    const rx=q.d*(p.x-q.x),ry=q.d*(p.y-q.y);
    return {x:(rx*by-ay*ry)/det,y:(ax*ry-rx*bx)/det};
  }
  const kinTip=v=>{const k=state.kin,b=kinPoint(k.R*Math.cos(k.th),k.R*Math.sin(k.th));return[b[0]-.22*v*Math.sin(k.th),b[1]+.22*v*Math.cos(k.th),-.2];};
  const stringTip=v=>{const s=state.str,b=stringPoint(s.R*Math.cos(s.th),s.R*Math.sin(s.th));return[b[0]-.13*v*Math.sin(s.th),b[1],b[2]-.13*v*Math.cos(s.th)];};
  function drawKin(k,ui) {
    const c=lab.colors,center=kinPoint(0,0),b=kinPoint(k.R*Math.cos(k.th),k.R*Math.sin(k.th));
    for(const x of [-2.15,.7]){stand(lab,x,.3,3.28,c.text3);lab.rod([x,3.28,.3],[x,3.28,.13],.028,c.text3);}
    lab.box(-2.4,.1,.18,3.4,3.18,.055,alpha(c.bg2,.55));
    for(let n=-1;n<=1;n+=.2){const x=kinPoint(n,0)[0],y=kinPoint(0,n)[1];lab.line([x,.11,.15],[x,3.19,.15],c.border,.65);lab.line([-2.3,y,.15],[.8,y,.15],c.border,.65);}
    dashed(lab,kinPoint(-1,0),kinPoint(1,0),c.text3);dashed(lab,kinPoint(0,-1),kinPoint(0,1),c.text3);
    circle(center,k.R*1.55,c.primary,'xy',.015);
    lab.rod([center[0],center[1],-.13],[center[0],center[1],.35],.09,c.text2,24);
    lab.rod(center,b,.022,c.text3,8);lab.sphere(b,.085,c.warning);lab.handle('kbody',b,.18);
    const px=[b[0],.04,-.08],py=[.99,b[1],-.08];
    dashed(lab,b,px,c.primary);dashed(lab,b,py,c.danger);lab.sphere(px,.035,c.primary);lab.sphere(py,.035,c.danger);
    lab.label('x',[.74,.04,-.08]);lab.label('y',[.99,3.22,-.08]);
    lab.label(`R ${fmt(k.R,2)} m`,[center[0]-.15,center[1]-.22,-.18],c.text2);
    const vp=kinTip(k.v),vo=[...b];vo[2]=-.2;
    if(ui.show.vec){
      arrowSolid(lab,vo,vp,c.primary,.018);lab.label('v',[vp[0],vp[1]+.15,vp[2]],c.primary);
      const an=k.v*k.v/k.R,at=state.effAt(),scale=.65/Math.max(an,Math.abs(at),1.5);
      const dn=[-Math.cos(k.th)*an*scale,-Math.sin(k.th)*an*scale,0],dt=[-Math.sin(k.th)*at*scale,Math.cos(k.th)*at*scale,0];
      const end=d=>vo.map((v,i)=>v+d[i]);arrowSolid(lab,vo,end(dn),c.danger,.016);lab.label('aₙ',end(dn),c.danger);
      if(Math.abs(at)>.01){arrowSolid(lab,vo,end(dt),c.warning,.014);arrowSolid(lab,vo,end(dn.map((v,i)=>v+dt[i])),c.special,.012);}
    }
    ring(lab,vp,.05,c.primary,'z',.01);lab.handle('ktip',vp,.14);
    // A separate board keeps the velocity hodograph readable at every viewport.
    lab.box(1.12,.7,.2,1.53,1.73,.06,c.bg2);const hc=[1.88,1.55,.12],hr=.52;
    circle(hc,hr,c.borderStrong,'xy',.01,48);
    const at=state.effAt(),past=clamp(k.v-at*(.5*k.R/Math.max(k.v,.05)),0,4),ref=Math.max(k.v,past,.02),r0=hr*past/ref,r2=hr*k.v/ref;
    const a=[hc[0]-Math.sin(k.th-.5)*r0,hc[1]+Math.cos(k.th-.5)*r0,hc[2]],d=[hc[0]-Math.sin(k.th)*r2,hc[1]+Math.cos(k.th)*r2,hc[2]];
    if(k.v>.02){arrowSolid(lab,hc,a,c.text3,.012);arrowSolid(lab,hc,d,c.primary,.014);arrowSolid(lab,a,d,c.danger,.013);lab.label('Δv',[(a[0]+d[0])/2,(a[1]+d[1])/2+.15,.08],c.danger);}
    lab.label('Tezlik godografi',[1.88,2.62,.12]);lab.label(`v ${fmt(k.v,2)} m/s`,[1.88,.48,.08],c.primary);
  }
  function drawString(s,ui) {
    const c=lab.colors,center=stringPoint(0,0),b=s.fly?stringPoint(s.fly.x,s.fly.y):stringPoint(s.R*Math.cos(s.th),s.R*Math.sin(s.th));
    lab.box(-2.75,.04,-1.48,3.95,.16,2.96,c.bg2);
    circle(center,s.R*1.4,c.borderStrong,'xz',.012);lab.rod([center[0],.2,0],[center[0],.55,0],.045,c.text2,16);
    if(s.on){lab.rod(center,b,.012,c.text2,8);lab.handle('scut',center.map((v,i)=>(v+b[i])/2),.12);lab.handle('sball',b,.18);}
    else if(s.fly){const f=s.fly,sp=Math.hypot(f.vx,f.vy)||1,u=[f.vx/sp,f.vy/sp];dashed(lab,stringPoint(f.x0-u[0]*.4,f.y0-u[1]*.4),stringPoint(f.x0+u[0]*2.2,f.y0+u[1]*2.2),c.danger);}
    lab.sphere(b,.085,c.warning);
    if(ui.show.vec&&s.on){arrowSolid(lab,b,stringTip(s.v),c.primary,.019);const F=P.tension(s.m,s.v,s.R),r=Math.min(.65,F/s.Fmax*.65);arrowSolid(lab,b,[b[0]-(b[0]-center[0])/Math.max(s.R*1.4,.01)*r,b[1],b[2]-(b[2]-center[2])/Math.max(s.R*1.4,.01)*r],c.danger,.018);}
    if(s.on){const tip=stringTip(s.v);lab.sphere(tip,.035,c.primary);lab.handle('stip',tip,.14);}
    const F=s.on?P.tension(s.m,s.v,s.R):0,q=Math.min(1,F/s.Fmax);
    lab.box(1.58,.13,-.13,.74,2.35,.22,c.bg2);lab.box(1.72,.35,-.15,.16,1.8,.03,c.sunken);lab.box(1.72,.35,-.175,.16,1.8*q,.025,q>.9?c.danger:c.success);
    for(let i=0;i<=5;i++){const y=.35+i*.36;lab.line([1.92,y,-.18],[2.03,y,-.18],c.text3);lab.label(fmt(s.Fmax*i/5,1),[2.25,y,-.18]);}
    lab.label('T, N',[1.95,2.75,-.15]);lab.label(`${fmt(F,2)} N`,[1.95,2.47,-.15],c.danger);
    lab.box(1.35,.03,-1.25,1.3,.1,.55,c.bg2);lab.rod([2,.15,-.97],[2,.2,-.97],.13,s.on?c.danger:c.success,24);lab.handle('scut',[2,.2,-.97],.18);lab.label(s.on?'Ipni kesish':'Ip uzilgan',[2,.5,-.97],c.danger);
    lab.label(`R ${fmt(s.R,2)} m · m ${fmt(s.m*1000,0)} g`,[-.65,.1,-1.67]);
  }
  function miniCar(center,theta,bank,c) {
    const t=[-Math.sin(theta),0,-Math.cos(theta)],r=[Math.cos(theta)*Math.cos(bank),Math.sin(bank),-Math.sin(theta)*Math.cos(bank)],u=[-Math.cos(theta)*Math.sin(bank),Math.cos(bank),Math.sin(theta)*Math.sin(bank)];
    const at=(x,y,z)=>center.map((v,i)=>v+x*t[i]+y*u[i]+z*r[i]);
    const box=(x,y,z,dx,dy,dz,col)=>lab.solid([[x,y,z],[x+dx,y,z],[x+dx,y+dy,z],[x,y+dy,z],[x,y,z+dz],[x+dx,y,z+dz],[x+dx,y+dy,z+dz],[x,y+dy,z+dz]].map(p=>at(...p)),col);
    box(-.22,.04,-.12,.44,.13,.24,c.primary);box(-.1,.17,-.1,.23,.12,.2,c.primary);box(-.08,.2,-.105,.19,.07,.008,c.bg2);
    for(const x of [-.14,.14])for(const z of [-.13,.13])lab.rod(at(x,.05,z-.02),at(x,.05,z+.02),.055,c.text3,12);
  }
  function drawCar(car,ui) {
    const c=lab.colors,rr=1.35,half=.22,center=-.65,at=(r,a)=>[center+r*Math.cos(a),.29+(r-rr)*Math.tan(car.alpha),-r*Math.sin(a)];
    lab.box(-2.5,.05,-1.62,3.65,.12,3.24,c.text3);
    const road=car.mu<.1?alpha(c.primary,.35):car.mu<.3?c.bg2:c.sunken;
    for(let i=0;i<96;i++){
      const a=i*TAU/96,b=(i+1)*TAU/96;lab.face([at(rr-half,a),at(rr-half,b),at(rr+half,b),at(rr+half,a)],road);
      for(const r of [rr-half,rr+half])lab.line(at(r,a),at(r,b),c.text3,1.2);
      if(i%6<3)lab.line(at(rr,a),at(rr,b),c.bg2,1.4);
    }
    const xy=car.skid?[car.skid.x,car.skid.y]:[car.R*Math.cos(car.th),car.R*Math.sin(car.th)],theta=Math.atan2(xy[1],xy[0]),radius=Math.hypot(...xy)/car.R*rr,p=at(radius,theta);
    miniCar(p,theta,car.alpha,c);
    for(let i=1;i<car.trail.length;i++){const a=car.trail[i-1],b=car.trail[i];lab.line(at(Math.hypot(...a)/car.R*rr,Math.atan2(a[1],a[0])),at(Math.hypot(...b)/car.R*rr,Math.atan2(b[1],b[0])),c.danger,2);}
    if(ui.show.vec&&!car.off)arrowSolid(lab,[p[0],p[1]+.4,p[2]],[center,p[1]+.4,0],c.danger,.015);
    lab.label(`R ${fmt(car.R,0)} m`,[-.65,.2,-1.7]);
    lab.box(1.15,.55,.05,1.55,1.93,.15,c.bg2);circle([1.9,1.65,-.13],.6,c.text3,'xy',.018,48);
    for(let v=0;v<=160;v+=20){const q=needlePoint(v);lab.line(q,[1.9+(q[0]-1.9)*1.13,1.65+(q[1]-1.65)*1.13,q[2]],c.text3);if(v%40===0)lab.label(String(v),[1.9+(q[0]-1.9)*1.4,1.65+(q[1]-1.65)*1.4,-.18]);}
    const needle=needlePoint(car.v*3.6);arrowSolid(lab,[1.9,1.65,-.16],needle,c.danger,.017);lab.handle('needle',needle,.16);lab.label(`${fmt(car.v*3.6,0)} km/soat`,[1.9,.73,-.17],c.primary);
    const base=[1.8,.5,-.95],end=bankPoint(car.alpha);lab.rod(base,end,.055,c.text2,12);lab.sphere(end,.055,c.warning);lab.handle('bank',end,.18);
    lab.label(`α ${fmt(car.alpha/DEG,0)}°`,[2.2,.24,-1.13],c.warning);lab.label(car.off?'Yo‘ldan chiqdi':car.skid?'Sirpanmoqda':'Burilish modeli',[-.65,2.65,0],car.skid?c.danger:c.text2);
  }
  function loopBall(k) {const tr=state.track,p=tr.at(tr.sOfH(k)),q=loopPoint(p.x,p.y);return[q[0]-p.ty*.07,q[1]+p.tx*.07,q[2]];}
  function drawLoop(lp,ui) {
    const c=lab.colors,tr=state.track,pts=[];
    for(let i=0;i<=70;i++){const x=-tr.Lr*(1-i/70);pts.push(loopPoint(x,tr.rampY(x)));}
    for(let i=1;i<pts.length;i++)for(const z of [-.14,.14])lab.rod([...pts[i-1].slice(0,2),z],[...pts[i].slice(0,2),z],.018,c.text2,6);
    circle(loopPoint(0,1),.6,c.primary,'xy',.018,72);circle([.35,.78,.14],.6,c.text3,'xy',.012,72);
    lab.rod(loopPoint(0,0),loopPoint(tr.exit,0),.025,c.text2,8);
    for(let i=0;i<pts.length;i+=10){const p=pts[i];lab.rod([p[0],.03,0],p,.017,c.text3,6);lab.box(p[0]-.08,.02,-.25,.16,.03,.5,c.text3);}
    for(const x of [-.6,.6]){lab.rod([.35+x,.03,.14],[.35+x,.78,.14],.018,c.text3,6);}
    const launch=loopBall(lp.k),hm=loopPoint(0,2.5)[1];dashed(lab,[launch[0],launch[1],-.18],[2.5,launch[1],-.18],c.warning);dashed(lab,[-2.5,hm,-.18],[2.5,hm,-.18],c.danger);
    lab.label(`h ${fmt(lp.k,2)}R`,[1.85,launch[1]+.16,-.18],c.warning);lab.label('hₘᵢₙ 2,5R',[1.85,hm-.17,-.18],c.danger);
    let p,b,nx,ny;
    if(lp.fly){b=loopPoint(lp.fly.x,lp.fly.y);nx=lp.fly.nx;ny=lp.fly.ny;for(let i=1;i<lp.fly.path.length;i++)lab.line(loopPoint(...lp.fly.path[i-1]),loopPoint(...lp.fly.path[i]),c.danger,1.8);}
    else{p=tr.at(lp.s);b=loopPoint(p.x,p.y);nx=-p.ty;ny=p.tx;}
    b=[b[0]+nx*.07,b[1]+ny*.07,b[2]];lab.sphere(b,.07,c.warning);lab.handle('lball',b,.19);
    if(lp.det){const q=loopPoint(lp.det.x,lp.det.y);ring(lab,q,.1,c.danger,'z',.013);}
    if(ui.show.vec){
      arrowSolid(lab,b,[b[0],b[1]-.32,b[2]],c.text2,.012);
      if(p){const n=Math.max(0,tr.normal(lp.s,lp.w,lp.R)),v=Math.min(.8,Math.abs(lp.w)*lp.R*.13),sign=Math.sign(lp.w)||1;arrowSolid(lab,b,[b[0]+p.tx*sign*v,b[1]+p.ty*sign*v,0],c.primary,.014);if(n>.01)arrowSolid(lab,b,[b[0]+nx*Math.min(.7,n*.09),b[1]+ny*Math.min(.7,n*.09),0],c.success,.014);}
    }
    lab.label(`R ${fmt(lp.R,2)} m`,[.35,.79,-.12]);lab.label(lp.phase==='fly'?'Erkin uchish · N = 0':lp.phase==='hit'?'Halqaga urildi':'Ishqalanishsiz rels',[.35,2.7,0],lp.fly?c.danger:c.text2);
  }
  function centers(blt,R1=blt.R1,R2=blt.R2) {
    const bike=blt.type==='bike',s=bike?.043:.065;
    return bike?{s,a:[42*s-.7,1.7,-.17],b:[-.7,1.7,-.17]}:{s,a:[-1.3,1.58,-.17],b:[blt.type==='gear'?-1.3+(R1+R2)*s:1.3,1.58,-.17]};
  }
  function radiusPoint(id,r) {const b=state.blt,q=centers(b,id==='r1'?r:b.R1,id==='r2'?r:b.R2),p=id==='r1'?q.a:q.b;return[p[0],p[1]+r*q.s,p[2]-.035];}
  function beltCurve(a,r1,b,r2) {
    let left=a,right=b,rl=r1,rr=r2;if(left[0]>right[0]){[left,right]=[right,left];[rl,rr]=[rr,rl];}
    const D=right[0]-left[0],ang=Math.acos(clamp((rl-rr)/D,-.99,.99)),point=(c,r,t)=>[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t),c[2]-.07],pts=[point(left,rl,ang),point(right,rr,ang)];
    for(let i=1;i<=32;i++)pts.push(point(right,rr,ang-2*ang*i/32));pts.push(point(left,rl,-ang));
    for(let i=1;i<=32;i++)pts.push(point(left,rl,-ang-(TAU-2*ang)*i/32));return pts;
  }
  function drawBelt(b) {
    const c=lab.colors,q=centers(b),r1=b.R1*q.s,r2=b.R2*q.s,gear=b.type==='gear',bike=b.type==='bike',th2=gear?Math.PI+Math.PI/Math.max(6,Math.round(b.R2*2))-b.R1/b.R2*b.th1:b.th2;
    if(!bike){for(const p of [q.a,q.b]){stand(lab,p[0],.35,1.6,c.text3);lab.rod([p[0],1.58,.35],[p[0],1.58,-.2],.05,c.text2,12);}}
    else {
      const rear=[-.7,1.7,.03],rw=35*q.s;
      circle(rear,rw,c.text3,'xy',.035,72);circle([rear[0],rear[1],-.03],rw-.06,c.text2,'xy',.012,64);
      for(let i=0;i<16;i++){const a=b.th2+i*TAU/16;lab.line(rear,[rear[0]+rw*Math.cos(a),rear[1]+rw*Math.sin(a),rear[2]],c.text3,1);}
      const seat=[30*q.s-.7,1.7+32*q.s,.14],crank=[q.a[0],q.a[1],.14],rh=[q.b[0],q.b[1],.14],fork=[70*q.s-.7,1.7+28*q.s,.14];
      for(const [a,z]of [[rh,crank],[crank,seat],[seat,rh],[seat,fork],[crank,fork]])lab.rod(a,z,.035,c.primary,10);
      lab.rod([seat[0]-.23,seat[1]+.13,.14],[seat[0]+.18,seat[1]+.13,.14],.055,c.text2,12);
      for(const side of [-1,1]){const a=b.th1+(side<0?Math.PI:0),p=[q.a[0]+.55*Math.cos(a),q.a[1]+.55*Math.sin(a),-.35];lab.rod([q.a[0],q.a[1],-.35],p,.025,c.text2,8);lab.box(p[0]-.12,p[1]-.03,-.42,.24,.06,.14,c.text2);}
      stand(lab,-.7,.32,.35,c.text3);lab.label('Orqa uzatma modeli',[.5,3.55,0]);
    }
    disc(q.a,r1,b.th1,c.primary,gear||bike,Math.max(6,Math.round(b.R1*2/(bike?.6:1))));disc(q.b,r2,th2,c.warning,gear||bike,Math.max(6,Math.round(b.R2*2/(bike?.6:1))));
    if(!gear){const pts=beltCurve(q.a,r1,q.b,r2);for(let i=1;i<pts.length;i++)lab.rod(pts[i-1],pts[i],bike?.018:.028,c.text2,6);
      // Small moving links illustrate transport without expensive particle meshes.
      const lengths=pts.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-pts[i][j]))),total=lengths.reduce((a,b)=>a+b,0);
      for(let i=0;i<12;i++){
        let distance=((b.s*q.s+i*total/12)%total+total)%total;
        for(let j=0;j<lengths.length;j++)if(distance<=lengths[j]){const t=distance/(lengths[j]||1),p=pts[j].map((v,k)=>v+(pts[j+1][k]-v)*t);lab.box(p[0]-.025,p[1]-.025,p[2]-.025,.05,.05,.05,c.bg2);break;}else distance-=lengths[j];
      }
    }
    for(const [id,r,col]of [['r1',b.R1,c.primary],['r2',b.R2,c.warning]]){const p=radiusPoint(id,r);lab.sphere(p,.04,col);lab.handle(id,p,.15);}
    lab.label(`R₁ ${fmt(b.R1,1)} cm`,[q.a[0],q.a[1]-r1-.21,-.23],c.primary);lab.label(`R₂ ${fmt(b.R2,1)} cm`,[q.b[0],q.b[1]-r2-.21,-.23],c.warning);
    lab.label(`n₁ ${fmt(b.n1,2)} · n₂ ${fmt(b.n1*b.R1/b.R2,2)} ayl/s`,[0,bike?.1:3.05,-.15]);
  }
  return {lab,kinTip,stringTip,loopBall,radiusPoint,
    draw(ctx,stage,ui,kin,str,car,lp,blt,track,effAt) {
      state={ui,kin,str,car,lp,blt,track,effAt};
      lab.begin(ctx,stage,{target:ui.mode==='dyn'&&ui.sub==='string'?[0,1,0]:[0,1.45,0],focal:1.7});
      if(ui.mode==='kin')drawKin(kin,ui);else if(ui.mode==='belt')drawBelt(blt);else if(ui.sub==='string')drawString(str,ui);else if(ui.sub==='car')drawCar(car,ui);else drawLoop(lp,ui);
      const note=ui.mode==='kin'?'x/y bir xil masshtabda · v/a alohida':ui.mode==='belt'?'Radiuslar bir xil masshtabda · tasma sirpanmaydi':ui.sub==='loop'?'R ga nisbatan model · vaqt ×0,5':ui.sub==='car'?'Yo‘l modeli · avtomobil kattalashtirilgan':'Silliq stol · kesilganda urinma bo‘ylab';
      lab.finish(ui.mode==='kin'?kin.t:ui.mode==='belt'?blt.t:ui.sub==='string'?str.t:ui.sub==='loop'?lp.t:0,note);
    },body(id,p){return id==='kbody'?inverse(p,kinPoint(0,0),[1.55,0,0],[0,1.55,0]):inverse(p,stringPoint(0,0),[1.4,0,0],[0,0,-1.4]);},
    parameter(id,p){if(id==='ktip')return lab.nearest(kinTip,.2,4,p.x,p.y);if(id==='stip')return lab.nearest(stringTip,.5,8,p.x,p.y);if(id==='needle')return lab.nearest(needlePoint,10,160,p.x,p.y);if(id==='bank')return lab.nearest(bankPoint,0,30*DEG,p.x,p.y);if(id==='lball')return lab.nearest(loopBall,.5,3.5,p.x,p.y);if(id==='r1'||id==='r2')return lab.nearest(r=>radiusPoint(id,r),3,18,p.x,p.y);return null;}
  };
}
