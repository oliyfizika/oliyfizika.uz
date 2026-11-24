import { createLab3D } from './lab-3d.js?v=20261124-lens';
import { fmt, clamp } from './sim-kit.js';
import * as O from './optics-physics.js';
import { alpha, arrowSolid, dashed, ring, stand } from './apparatus-3d.js?v=20261124-lens';

export function createOpticalLab() {
  const lab=createLab3D();const resetCamera=lab.reset;lab.reset=()=>{resetCamera();lab.camera.yaw=.5;};lab.reset();let scale=.04,xCenter=0,axis=1.05;
  const world=(x,y=0,z=0)=>[(x-xCenter)*scale,axis+y*scale,z];
  const onAxis=x=>world(x,0,0);
  function setup(ctx,stage,x0,x1,calibrated=true) {
    scale=5.1/(x1-x0);xCenter=(x0+x1)/2;axis=1.08;
    lab.begin(ctx,stage,{target:[0,1.0,0],focal:2.3});const c=lab.colors;
    lab.box(-2.8,.03,-.8,5.6,.12,1.6,c.bg2);
    for(const z of [-.55,.55])lab.rod([-2.7,.19,z],[2.7,.19,z],.025,c.text3);
    for(let k=0;k<=24;k++){
      const x=x0+(x1-x0)*k/24,p=world(x);lab.line([p[0],.19,.6],[p[0],.19,k%4===0?.77:.67],c.text2,1);
      if(calibrated&&k%8===0)lab.label(`${fmt(x,0)} cm`,[p[0],.2,.92]);
    }
    dashed(lab,world(x0),world(x1),c.borderStrong,.9);
  }
  function lens(x,F,H,name,accommodation=0) {
    const c=lab.colors,center=world(x),r=H*scale,t=.04+accommodation*.008;
    stand(lab,center[0],0,axis-r,c.text3);
    ring(lab,center,r+.025,c.text3,'x',.023);
    // Biconvex / biconcave surfaces share the exact thin-lens plane used by the ray model.
    const sample=(u,a,side)=>{
      const radius=r*u,bulge=F>0?.085*Math.sqrt(Math.max(0,1-u*u)):.07*u*u;
      return [center[0]+side*(t+bulge),axis+radius*Math.cos(a),radius*Math.sin(a)];
    };
    const glass=alpha(c.primary,.16);
    for(const side of [-1,1])for(let j=0;j<7;j++)for(let k=0;k<40;k++)
      lab.face([sample(j/7,k*Math.PI/20,side),sample((j+1)/7,k*Math.PI/20,side),sample((j+1)/7,(k+1)*Math.PI/20,side),sample(j/7,(k+1)*Math.PI/20,side)],glass);
    lab.label(name,[center[0],axis+r+.5,0],c.primary);
  }
  function object(x,h,name,color,virtual=false,handle=null) {
    const base=world(x),tip=world(x,h),c=lab.colors;
    if(virtual)dashed(lab,base,tip,color,2.3);else arrowSolid(lab,base,tip,color,.023);
    if(handle) {
      stand(lab,base[0],0,axis,c.text3);
      lab.sphere(tip,.055,color);lab.handle(handle,tip,.13);lab.handle(handle,base,.16);
    }
    // Mavhum tasvir yozuvi uchida: buyum fokus ichida bo'lsa, ikki asos yaqin va yozuvlar ustma-ust tushardi.
    lab.label(name,virtual?[tip[0],tip[1]+(h>=0?.22:-.22),.1]:[base[0],base[1]-(h>=0?.25:-.25),.1],color);
  }
  function screen(x,F,d,h,name='Ekran',id=null) {
    const c=lab.colors,p=world(x),hh=Math.max(.5,10*scale),ww=.72;
    stand(lab,p[0],0,axis-hh,c.text3);
    lab.box(p[0]-.025,axis-hh,-ww,.05,hh*2,ww*2,c.bg2);
    for(const z of [-ww,ww])lab.rod([p[0]-.035,axis-hh,z],[p[0]-.035,axis+hh,z],.015,c.text3);
    const image=O.thinLens(F,d),blur=O.blurDiameter(F,d,5.4,x),real=image.real&&!image.inf;
    const yy=-h*x/d*scale,r=Math.max(.012,Math.abs(blur)*scale*.5),cx=p[0]-.04;
    let disk=Array.from({length:40},(_,i)=>[axis+yy+r*Math.cos(i*Math.PI/20),r*Math.sin(i*Math.PI/20)]);
    const clip=(poly,coordinate,bound,less)=>{
      const out=[];
      for(let i=0;i<poly.length;i++) {
        const a=poly[i],b=poly[(i+1)%poly.length],insideA=less?a[coordinate]<=bound:a[coordinate]>=bound,insideB=less?b[coordinate]<=bound:b[coordinate]>=bound;
        if(insideA)out.push(a);
        if(insideA!==insideB){const t=(bound-a[coordinate])/(b[coordinate]-a[coordinate]);out.push(a.map((v,j)=>v+(b[j]-v)*t));}
      }
      return out;
    };
    for(const [coordinate,bound,less]of [[0,axis-hh,false],[0,axis+hh,true],[1,-ww,false],[1,ww,true]])disk=clip(disk,coordinate,bound,less);
    if(disk.length>=3)lab.face(disk.map(([y,z])=>[cx,y,z]),alpha(c.warning,.6));
    if(real&&Math.abs(x-image.f)<.6&&Math.abs(yy)<hh)arrowSolid(lab,[cx-.005,axis,0],[cx-.005,axis+yy,0],c.warning,.015);
    lab.label(name,[p[0],axis+hh+.24,0]);
    lab.label(real&&Math.abs(x-image.f)<.6?'Aniq tasvir':'Xira dog‘',[p[0],axis-hh-.2,0],real&&Math.abs(x-image.f)<.6?c.success:c.text2);
    if(id){lab.handle(id,[p[0],axis,0],.18);lab.handle(id,[p[0],axis+hh,0],.18);}
  }
  function raySet(lenses,starts,end,image,x0,x1) {
    const c=lab.colors;
    const segment=(a,b,color,dash=false)=>{
      // Clip actual model-space rays, never clamp their slopes or move the image point.
      let lo=0,hi=1;
      const bounds=[[x0,x1],[-18,18]];
      for(let j=0;j<2;j++){
        const delta=b[j]-a[j];
        if(Math.abs(delta)<1e-12){if(a[j]<bounds[j][0]||a[j]>bounds[j][1])return;continue;}
        const t0=(bounds[j][0]-a[j])/delta,t1=(bounds[j][1]-a[j])/delta;
        lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
      }
      if(lo>hi)return;
      const aa=world(a[0]+(b[0]-a[0])*lo,a[1]+(b[1]-a[1])*lo),bb=world(a[0]+(b[0]-a[0])*hi,a[1]+(b[1]-a[1])*hi);
      if(dash)dashed(lab,aa,bb,color,1.3);else lab.line(aa,bb,color,1.7);
    };
    for(const start of starts) {
      const tr=O.traceRay(lenses,start.x,start.y,start.u,end);
      for(let i=1;i<tr.pts.length;i++)segment(tr.pts[i-1],tr.pts[i],start.color);
      if(image&&!image.real&&Number.isFinite(image.x)){
        const a=tr.pts[tr.pts.length-2];segment(a,[image.x,a[1]+tr.slope*(image.x-a[0])],start.color,true);
      }
    }
  }
  function marks(x,F,x0,x1,screenX=null) {
    const c=lab.colors;
    for(const multiple of [-2,-1,1,2]) {
      const f=x+Math.abs(F)*multiple;if(f<x0||f>x1)continue;
      const p=world(f);lab.sphere(p,.028,c.success);if((screenX===null||Math.abs(f-screenX)>9)&&(Math.abs(multiple)===1||scale>.05))lab.label(Math.abs(multiple)===1?'F':'2F',[p[0],axis-.2,.03],c.success);
    }
  }
  function drawBench(ctx,stage,ui,b) {
    const c=stage.colors,F=b.type==='conv'?b.F:-b.F,image=O.thinLens(F,b.d);
    const x0=-60,x1=60;setup(ctx,stage,x0,x1);marks(0,F,x0,x1,b.screen?b.xs:null);
    lens(0,F,9,F>0?'Yig‘uvchi linza':'Sochuvchi linza');lab.sphere(world(F),.05,c.success);lab.handle('focus',world(F),.11);object(-b.d,b.h,'Buyum',c.warning,false,'object');
    const starts=[];
    if(ui.rays) {
      starts.push({x:-b.d,y:b.h,u:0,color:c.danger},{x:-b.d,y:b.h,u:-b.h/b.d,color:c.success});
      if(Math.abs(b.d-Math.abs(F))>.3)starts.push({x:-b.d,y:b.h,u:-b.h/(b.d-F),color:c.primary});
    }
    if(ui.fan)for(let k=0;k<=8;k++)starts.push({x:-b.d,y:b.h,u:(-9+18*k/8-b.h)/b.d,color:c.warning});
    raySet([{x:0,F}],starts,b.screen?b.xs:x1,image.inf?null:{x:image.f,real:image.real},x0,x1);
    if(!b.screen&&!image.inf&&image.f>x0&&image.f<x1&&Math.abs(image.m*b.h)<18)object(image.f,image.m*b.h,image.real?'Haqiqiy tasvir':'Mavhum tasvir',c.special,!image.real);
    if(image.inf)lab.label('Buyum fokusda: parallel dasta',[1.4,2.25,0],c.special);
    else if(image.f<=x0||image.f>=x1)lab.label(`Tasvir: ${fmt(image.f,1)} cm (sahnadan tashqarida)`,[1.15,2.25,0],c.special);
    if(b.screen)screen(b.xs,F,b.d,b.h,'Ekran','screen');
    lab.finish(0,'Yupqa linza modeli · x va y bir xil masshtabda · shisha shakli shartli');
  }
  function drawInstrument(ctx,stage,ui,ins) {
    const c=stage.colors,two=ins.kind==='micro'||ins.kind==='tele',lenses=[{x:0,F:ins.F1},...(two?[{x:ins.L,F:ins.F2}]:[])];
    const title={loupe:'Lupa',micro:'Mikroskop',tele:'Teleskop',camera:'Fotoapparat',projector:'Proyektor'}[ins.kind];
    let x0=-Math.max(ins.d+6,10),x1=two?ins.L+22:40;
    if(ins.kind==='tele')x0=-12;
    if(ins.kind==='loupe'){x0=-Math.max(ins.d*2.6,22);x1=22;}
    const h=ins.kind==='camera'?3:ins.kind==='projector'?1.5:2;
    const sys=O.systemImage(lenses,-ins.d,h),last=sys.steps.at(-1);
    if(ins.kind==='camera'||ins.kind==='projector'){x0=-ins.d-6;x1=Math.max(12,Math.min(90,last&&!last.inf?last.x+8:40));}
    setup(ctx,stage,x0,x1);
    lenses.forEach((l,i)=>{lens(l.x,l.F,8,two?(i===0?'Obyektiv':'Okulyar'):title);marks(l.x,l.F,x0,x1);});
    if(two) {
      const a=onAxis(0),b=onAxis(ins.L);
      for(const z of [-.35,.35])lab.rod([a[0],.28,z],[b[0],.28,z],.018,c.text3);
      // Rear half-shell exposes the optical path while preserving the real tube volume.
      const radius=8.8*scale;
      for(let i=0;i<24;i++) {
        const u=i*Math.PI/24,v=(i+1)*Math.PI/24;
        lab.face([[a[0],axis+radius*Math.cos(u),radius*Math.sin(u)],[b[0],axis+radius*Math.cos(u),radius*Math.sin(u)],[b[0],axis+radius*Math.cos(v),radius*Math.sin(v)],[a[0],axis+radius*Math.cos(v),radius*Math.sin(v)]],alpha(c.text3,.3));
      }
      lab.label(title+' (ochiq kesim)',[(a[0]+b[0])*.5,.47,.55]);
    }
    const starts=[];
    if(ins.kind==='tele') {
      for(let k=-3;k<=3;k++)starts.push({x:x0,y:k*2+.06*(-x0),u:-.06,color:k===0?c.success:c.warning});
      object(ins.F1,-.06*ins.F1,'Oraliq tasvir',c.special);
    } else {
      object(-ins.d,h,'Buyum',c.warning);
      if(ui.rays)starts.push({x:-ins.d,y:h,u:0,color:c.danger},{x:-ins.d,y:h,u:-h/ins.d,color:c.success});
      if(ui.fan||!ui.rays)for(let k=0;k<=6;k++)starts.push({x:-ins.d,y:h,u:(-6.4+12.8*k/6-h)/ins.d,color:c.warning});
      for(const [i,image]of sys.steps.entries())if(!image.inf&&image.x>x0&&image.x<x1&&Math.abs(image.y)<18)object(image.x,image.y,i===sys.steps.length-1?'Tasvir':'Oraliq tasvir',c.special,!image.real);
    }
    const detector=ins.kind==='camera'||ins.kind==='projector';
    const end=detector&&last?.real?Math.min(x1,last.x):x1;
    raySet(lenses,starts,end,last&&!last.inf?last:null,x0,x1);
    if(detector) {
      const xs=last?.real&&!last.inf?last.x:x1-4;
      if(xs>=x0&&xs<=x1)screen(xs,ins.F1,ins.d,h,ins.kind==='camera'?'Matritsa':'Ekran');
    } else {const e=world(x1-6);lab.sphere([e[0],axis,0],.12,alpha(c.text3,.3));lab.label('Ko‘z',[e[0],axis-.3,0]);}
    if(last&&(last.inf||last.x<x0||last.x>x1||Math.abs(last.y)>18))lab.label(last.inf?'Yakuniy dasta parallel':`Yakuniy tasvir: ${fmt(last.x,1)} cm`,[.8,2.45,0],c.special);
    lab.finish(0,`${title} · nurlar mavjud paraksial modeldan · o‘lchamlar cm`);
  }
  function drawEye(ctx,stage,eye) {
    const c=stage.colors,d=eye.k>=100?Infinity:.1*Math.pow(10,eye.k/100*2.3),glassPower=eye.glasses?eye.G:0;
    const v=O.eyeView(d,eye.defect,glassPower);
    setup(ctx,stage,-45,50,false);
    const lensX=-.15,retina=lensX+2.0,cy=1.35,R=1.2,center=.85;
    const physicalToWorld=2/v.Lr,gx=lensX-O.EYE.glassesGap*physicalToWorld;
    // Anatomical cutaway: rear hemisphere, retina, crystalline lens and corrective glasses.
    const point=(t,p)=>[center+R*Math.cos(t),cy+R*Math.sin(t)*Math.cos(p),R*Math.sin(t)*Math.sin(p)];
    for(let j=0;j<18;j++)for(let k=0;k<24;k++){
      const a=j*Math.PI/18,b=(j+1)*Math.PI/18,u=k*Math.PI/12,w=(k+1)*Math.PI/12;
      if(Math.cos((u+w)*.5)>0.2)continue;
      lab.face([point(a,u),point(b,u),point(b,w),point(a,w)],alpha(c.text3,.13));
    }
    ring(lab,[center,cy,0],R,c.text3,'z',.015);
    const retinal=[retina,cy,0];
    lab.face([[retina,cy-.55,-.4],[retina,cy+.55,-.4],[retina,cy+.55,.4],[retina,cy-.55,.4]],alpha(c.danger,.22));
    // Use the exact eye model for focal plane and rays, independent of decorative anatomy.
    const focal=Number.isFinite(v.img)?lensX+2*v.img/v.Lr:retina+3;
    const lensRadius=.43;
    const crystalline=(u,t,side)=>[lensX+side*(.04+(1-u*u)*(.045+v.accommodation*.01)),cy+lensRadius*u*Math.cos(t),lensRadius*u*Math.sin(t)];
    for(const side of [-1,1])for(let j=0;j<5;j++)for(let k=0;k<32;k++)lab.face([crystalline(j/5,k*Math.PI/16,side),crystalline((j+1)/5,k*Math.PI/16,side),crystalline((j+1)/5,(k+1)*Math.PI/16,side),crystalline(j/5,(k+1)*Math.PI/16,side)],alpha(c.primary,.2));
    lab.label('Gavhar',[lensX,cy+.65,0],c.primary);lab.label('To‘r parda',[retina,cy+.8,0],c.danger);
    if(eye.glasses&&glassPower!==0){ring(lab,[gx,cy,0],.6,c.primary,'x',.025);lab.label(`${glassPower>0?'+':''}${fmt(glassPower,2)} D`,[gx,cy+.9,0],c.primary);}
    if(eye.glasses&&glassPower!==0) {
      const surface=(r,t,side)=>[gx+side*(.018+(glassPower>0?1-r*r:r*r)*.055),cy+r*.57*Math.cos(t),r*.57*Math.sin(t)];
      for(const side of [-1,1])for(let j=0;j<4;j++)for(let k=0;k<24;k++)lab.face([surface(j/4,k*Math.PI/12,side),surface((j+1)/4,k*Math.PI/12,side),surface((j+1)/4,(k+1)*Math.PI/12,side),surface(j/4,(k+1)*Math.PI/12,side)],alpha(c.primary,.16));
    }
    for(const y of [-.35,-.175,0,.175,.35]) {
      const at=[lensX,cy+y,0],end=Math.min(focal,retina+.25);
      if(eye.glasses&&glassPower!==0) {
        const yg=y*(1+O.EYE.glassesGap*v.V),slope=Number.isFinite(d)?yg/(physicalToWorld*(d-O.EYE.glassesGap)):0;
        lab.line([-2.6,cy+yg+slope*(-2.6-gx),0],[gx,cy+yg,0],c.warning,1.5);
        lab.line([gx,cy+yg,0],at,c.warning,1.5);
      } else {
        const slope=-v.V*y/physicalToWorld;
        lab.line([-2.6,cy+y+slope*(-2.6-lensX),0],at,c.warning,1.5);
      }
      const yy=cy+y*(1-(end-lensX)/Math.max(.01,focal-lensX));lab.line(at,[end,yy,0],c.warning,1.5);
    }
    const blur=clamp(v.blur*physicalToWorld*.5,.008,.3);lab.rod([retina-.02,cy,0],[retina+.02,cy,0],blur,c.warning,24);
    if(Number.isFinite(v.img)&&focal<retina+.3)lab.sphere([focal,cy,0],.035,c.warning);
    lab.label(v.sharp?'Ko‘z aniq ko‘radi':'Xira tasvir',[0,cy+1.4,0],v.sharp?c.success:c.danger);
    lab.label(`Buyum: ${Number.isFinite(d)?fmt(d,2)+' m':'∞'}`,[-1.8,.43,.8]);
    lab.label(`Akkomodatsiya: ${fmt(v.accommodation,2)} D`,[1.1,.43,.8]);
    // A three-dimensional optotype monitor retains the old clarity-preview function.
    lab.box(-2.5,.12,-.95,.9,1.0,.08,c.bg2);
    const monitorZ=-1.0,blurOffset=clamp(v.blur/6e-6*.018,0,.12);
    const glyph=(dx,dy,opacity)=>{
      const x=-2.35+dx,y=.35+dy,col=alpha(c.text2,opacity);
      const rect=(xx,yy,ww,hh)=>lab.face([[xx,yy,monitorZ],[xx+ww,yy,monitorZ],[xx+ww,yy+hh,monitorZ],[xx,yy+hh,monitorZ]],col);
      rect(x,y,.065,.55);for(const yy of [y,y+.245,y+.49])rect(x,yy,.38,.06);
    };
    if(v.sharp)glyph(0,0,1);else for(let i=0;i<12;i++)glyph(blurOffset*Math.cos(i*Math.PI/6),blurOffset*Math.sin(i*Math.PI/6),.12);
    lab.label('Ko‘rilayotgan tasvir',[-2.05,.18,-1.0]);
    lab.finish(0,'Ko‘zning ochiq kesimi · fokus va dog‘ o‘lchami hisobdan · anatomiya shartli');
  }
  return {lab,draw(ctx,stage,ui,bench,ins,eye){if(ui.mode==='bench')drawBench(ctx,stage,ui,bench);else if(ui.mode==='instr')drawInstrument(ctx,stage,ui,ins);else drawEye(ctx,stage,eye);},position(x,y){const p=lab.planePoint(x,y);return p?p[0]/scale+xCenter:null;}};
}
