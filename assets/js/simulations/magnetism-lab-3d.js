import { createLab3D } from './lab-3d.js?v=20261123-batch8d';
import { alpha, arrowSolid, helix, path, dial } from './apparatus-3d.js?v=20261123-batch8d';
import { clamp, fmt } from './sim-kit.js';

const SCALE=13,TAU=2*Math.PI;
export const fieldPoint=(x,y,h=.35)=>[(x-.2)*SCALE,h,(.12-y)*SCALE];
export function createMagnetismLab() {
  const lab=createLab3D();let current;
  function inverse(p,origin,u,v) {
    const a=lab.project(origin),b=lab.project(origin.map((x,i)=>x+u[i])),c=lab.project(origin.map((x,i)=>x+v[i]));
    const ax=b.d*(b.x-p.x)-a.d*(a.x-p.x),ay=c.d*(c.x-p.x)-a.d*(a.x-p.x),bx=b.d*(b.y-p.y)-a.d*(a.y-p.y),by=c.d*(c.y-p.y)-a.d*(a.y-p.y),det=ax*by-ay*bx;
    if(Math.abs(det)<1e-6)return null;
    const rx=a.d*(p.x-a.x),ry=a.d*(p.y-a.y);return {x:(rx*by-ay*ry)/det,y:(ax*ry-rx*bx)/det};
  }
  function orientedBox(center,angle,l,w,height,col) {
    const at=(x,y,z)=>[center[0]+Math.cos(angle)*x+Math.sin(angle)*z,center[1]+y,center[2]-Math.sin(angle)*x+Math.cos(angle)*z];
    lab.solid([[-l/2,-height/2,-w/2],[l/2,-height/2,-w/2],[l/2,height/2,-w/2],[-l/2,height/2,-w/2],[-l/2,-height/2,w/2],[l/2,-height/2,w/2],[l/2,height/2,w/2],[-l/2,height/2,w/2]].map(p=>at(...p)),col);
  }
  function compass(x,y,a,r=.12,base=true) {
    const c=lab.colors,p=fieldPoint(x,y,.35),u=[Math.cos(a),0,-Math.sin(a)],v=[Math.sin(a),0,Math.cos(a)];
    if(base){lab.rod([p[0],.03,p[2]],[p[0],.3,p[2]],r,c.bg2,20);lab.rod([p[0],.3,p[2]],[p[0],.32,p[2]],r,c.text3,24);}
    const tip=s=>p.map((q,i)=>q+s*r*.83*u[i]);
    const side=s=>p.map((q,i)=>q+s*r*.19*v[i]);
    lab.face([tip(1),side(1),side(-1)],c.danger);lab.face([tip(-1),side(-1),side(1)],c.text2);
    if(base){lab.rod([p[0],.33,p[2]],[p[0],.37,p[2]],.012,c.warning,6);lab.label('Sh',[p[0],.45,p[2]-r]);}
  }
  function power(x,z,I,id='current') {
    const c=lab.colors;lab.box(x-.32,.03,z-.17,.64,.57,.34,c.bg2);
    lab.label(fmt(I,1)+' A',[x,.75,z-.19],c.success);dial(lab,[x,.32,z-.19],(id==='motorCurrent'?I/5:id.startsWith('property')?(I+20)/40:(I+10)/20),c.primary,id,'I');
    return {plus:[x+.23,.14,z-.2],minus:[x-.23,.14,z-.2]};
  }
  const cable=(pts,col)=>path(lab,pts,col,.016);
  function field(ui,objs,sel,data) {
    const c=lab.colors;
    lab.box(-2.68,.02,-1.62,5.36,.018,3.24,c.bg2);
    for(let x=0;x<=.4001;x+=.02)lab.line(fieldPoint(x,0,.045),fieldPoint(x,.24,.045),c.border,.65);
    for(let y=0;y<=.2401;y+=.02)lab.line(fieldPoint(0,y,.045),fieldPoint(.4,y,.045),c.border,.65);
    if(ui.heat&&data.heat){const {nx,ny,g}=data.heat;
      for(let j=0;j<ny;j+=2)for(let i=0;i<nx;i+=2){const t=clamp((Math.log10(g[j*nx+i]+1e-12)+5.3)/3.3,0,1);if(t<.02)continue;
        lab.face([fieldPoint(i/nx*.4,j/ny*.24,.047),fieldPoint((i+2)/nx*.4,j/ny*.24,.047),fieldPoint((i+2)/nx*.4,(j+2)/ny*.24,.047),fieldPoint(i/nx*.4,(j+2)/ny*.24,.047)],alpha(t>.55?c.danger:c.primary,.08+.3*t));}
    }
    if(ui.view==='lines')for(const L of data.lines){
      for(let i=4;i<L.pts.length;i+=4)lab.line(fieldPoint(...L.pts[i-4]),fieldPoint(...L.pts[i]),alpha(c.primary,.65),1);
      const k=clamp(L.mid,2,L.pts.length-3),a=L.pts[k],b=L.pts[k+1],d=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
      const p=fieldPoint(...a),end=fieldPoint(a[0]+(b[0]-a[0])/d*.004,a[1]+(b[1]-a[1])/d*.004);
      arrowSolid(lab,p,end,c.primary,.004);
    }else if(ui.view==='filings')for(const [x,y,a,str]of data.filings){
      const len=.002+.002*str,dx=len*Math.cos(a),dy=len*Math.sin(a);
      lab.line(fieldPoint(x-dx,y-dy,.051),fieldPoint(x+dx,y+dy,.051),alpha(c.text2,str),1.3);
    }else for(let y=.01;y<.24;y+=.024)for(let x=.01;x<.4;x+=.024){if(data.inside(x,y))continue;const [bx,by]=data.Bat(x,y);compass(x,y,Math.atan2(by,bx),.075,false);}
    objs.forEach((o,i)=>{
      const p=fieldPoint(o.x,o.y),a=o.angle||0;
      if(o.type==='magnet'){
        const at=t=>fieldPoint(o.x+t*Math.cos(a),o.y+t*Math.sin(a));
        orientedBox(at(-o.len/4),a,o.len*SCALE/2,o.width*SCALE,.18,c.primary);
        orientedBox(at(o.len/4),a,o.len*SCALE/2,o.width*SCALE,.18,c.danger);
        orientedBox([p[0],.15,p[2]],a,o.len*SCALE,.2,.22,c.bg2);
        lab.label('S',at(-o.len/4).map((q,j)=>q+(j===1?.16:0)),c.text);lab.label('N',at(o.len/4).map((q,j)=>q+(j===1?.16:0)),c.text);
      }else if(o.type==='coil'){
        const a0=fieldPoint(o.x-o.len/2*Math.cos(a),o.y-o.len/2*Math.sin(a)),b0=fieldPoint(o.x+o.len/2*Math.cos(a),o.y+o.len/2*Math.sin(a));
        const points=helix(lab,a0,b0,o.diam*SCALE/2,clamp(Math.round(o.N/25),5,14),c.warning,.018);
        if(o.core)lab.rod(a0.map((q,j)=>q-(b0[j]-q)*.1),b0.map((q,j)=>q+(q-a0[j])*.1),.12,c.text3,10);
        const supply=power(p[0],-1.4,o.I,'property:'+i);
        cable([points[0],[points[0][0],.08,points[0][2]],supply.plus],c.danger);cable([points[points.length-1],[points[points.length-1][0],.08,points[points.length-1][2]],supply.minus],c.primary);
        lab.label(o.I>=0?'N':'S',[b0[0],.85,b0[2]],c.text2);
      }else if(o.type==='wire'){
        lab.rod([p[0],.04,p[2]],[p[0],2.1,p[2]],.035,c.warning,12);
        for(const y of [.12,1.95])lab.rod([p[0],y,p[2]],[p[0],y+.04,p[2]],.075,c.text3,12);
        if(o.I)arrowSolid(lab,[p[0]+.12,o.I>0?1.1:1.65,p[2]],[p[0]+.12,o.I>0?1.65:1.1,p[2]],c.primary,.012);
        const supply=power(p[0],-1.4,o.I,'property:'+i);
        cable([[p[0],.04,p[2]],[p[0],.08,-1.65],supply.minus],c.primary);
        cable([[p[0],2.1,p[2]],[2.98,2.1,p[2]],[2.98,.14,-1.65],supply.plus],c.danger);
        if(ui.forces){const F=data.force(o),f=Math.hypot(...F);if(f>1e-10)arrowSolid(lab,[p[0],.75,p[2]],[p[0]+F[0]/f*.5,.75,p[2]-F[1]/f*.5],c.danger,.016);}
      }else compass(o.x,o.y,o.ang,.15);
      lab.handle('object:'+i,p,o.type==='compass'?.16:.21);
      if(i===sel){
        lab.label('Tanlangan',[p[0],o.type==='wire'?2.38:.99,p[2]],c.warning);
        if(o.type==='magnet'||o.type==='coil'){
          const q=rotationPoint(o,a);lab.rod(p,q,.009,c.warning,6);lab.sphere(q,.04,c.warning);lab.handle('rotate:'+i,q,.16);
        }
      }
    });
    if(ui.earth){arrowSolid(lab,[2.38,.4,1.25],[2.38,.4,.8],c.text2,.013);lab.label('Sh',[2.38,.6,.7]);}
    lab.label('2 cm',[fieldPoint(.025,.23)[0],.11,fieldPoint(.025,.23)[2]]);
    lab.line(fieldPoint(.015,.23,.08),fieldPoint(.035,.23,.08),c.text2,2);
    if(!objs.length)lab.label('Magnit, tok yoki g‘altak qo‘shing',[0,1,0]);
  }
  const rotationPoint=(o,a)=>fieldPoint(o.x+(o.len/2+.018)*Math.cos(a),o.y+(o.len/2+.018)*Math.sin(a));
  function ampere(a,ui,data) {
    const c=lab.colors,F=data.ampF;
    const src=power(-2.55,-1.12,a.I);
    if(a.setup==='swing'){
      // Wide ideal pole gap keeps the suspended conductor inside at every allowed deflection.
      lab.box(-2.25,.25,-.65,.2,3.2,1.3,c.text3);
      lab.box(-2.25,3.25,-.65,3.4,.2,1.3,c.danger);lab.box(-2.25,.25,-.65,3.4,.2,1.3,c.primary);
      lab.label('N',[-1.8,3.57,-.68],c.text);lab.label('S',[-1.8,.63,-.68],c.text);
      const x=-.5+1.6*Math.sin(a.th),y=3-1.6*Math.cos(a.th),half=a.l*3,ang=a.alpha*Math.PI/180,u=[0,-Math.cos(ang),Math.sin(ang)];
      const p=[x,y,0],ends=[-1,1].map(s=>p.map((v,i)=>v+s*half*u[i]));
      for(const z of [-.85,.85]){lab.rod([-.5,.05,z],[-.5,3.06,z],.023,c.text3,8);lab.rod([-.5,3,z],[x,y,z],.008,c.text2,6);}
      lab.rod([-.5,3.06,-.85],[-.5,3.06,.85],.024,c.text3,8);
      lab.rod(ends[0],ends[1],.04,c.warning,12);
      cable([[x,y,-.85],ends[0]],c.danger);cable([ends[1],[x,y,.85]],c.primary);
      cable([src.plus,[-1.95,.17,-1.3],[-.5,3,-.85]],c.danger);cable([[-.5,3,.85],[-1.9,.17,1.2],src.minus],c.primary);
      for(const xx of [-1.4,.6])arrowSolid(lab,[xx,2.8,.45],[xx,.8,.45],alpha(c.primary,.4),.009);
      lab.label('B ↓ · α '+fmt(a.alpha,0)+'°',[1.3,2.3,.2],c.primary);
      if(Math.abs(F)>1e-9)arrowSolid(lab,p,[x+Math.sign(F)*.55,y,0],c.danger,.02);
      lab.label('θ '+fmt(a.th*180/Math.PI,1)+'°',[-.5,2.78,-.86],c.text2);
      lab.handle('angle',ends[1],.19);
    }else{
      const gap=a.l*6,rx=-1.85+clamp(a.rail.x,0,.6)*8;
      lab.box(-1.9,.05,-.9,4.85,.13,1.8,c.primary);
      lab.box(-1.9,1.7,-.9,4.85,.13,1.8,alpha(c.danger,.12));
      for(const z of [-gap/2,gap/2])lab.rod([-1.85,.34,z],[2.95,.34,z],.035,c.text3,10);
      lab.rod([rx,.37,-gap/2-.06],[rx,.37,gap/2+.06],.046,c.warning,12);
      cable([src.plus,[-1.85,.34,-gap/2]],c.danger);cable([[-1.85,.34,gap/2],src.minus],c.primary);
      for(const xx of [-1,0,1,2])arrowSolid(lab,[xx,1.5,.5],[xx,.6,.5],alpha(c.primary,.4),.009);
      if(Math.abs(F)>1e-9)arrowSolid(lab,[rx,.58,0],[rx+Math.sign(F)*.5,.58,0],c.danger,.017);
      lab.label('s '+fmt(a.rail.x*100,1)+' cm',[rx,.8,-gap/2-.2],c.text2);
      lab.label('Yuqori qutb: shaffof kesim',[.5,2.16,0]);
    }
    lab.label('F '+fmt(F*1000,1)+' mN',[1.8,2.75,0],c.danger);
    knob(1.95,-1.12,'field',a.B/.5,fmt(a.B,2)+' T','B');
  }
  function knob(x,z,id,frac,value,label){const c=lab.colors;lab.box(x-.31,.03,z-.16,.62,.45,.32,c.bg2);dial(lab,[x,.3,z-.18],frac,c.primary,id,label);lab.label(value,[x,.85,z-.2],c.primary);}
  function frame(f) {
    const c=lab.colors,phi=f.st.phi,k=Math.sqrt(f.S/40),r=.6*k,h=.65*k,gap=1.25;
    for(const [x,col,label]of [[-gap-.24,c.danger,'N'],[gap,c.primary,'S']]){lab.box(x,.5,-.65,.24,2.2,1.3,col);lab.label(label,[x+.12,2.94,0],c.text);}
    lab.box(-1.49,.07,.5,2.98,.4,.14,c.text3);
    const u=[-Math.sin(phi),0,-Math.cos(phi)],at=(d,y)=>[u[0]*d,y,u[2]*d];
    const wire=[at(-r,1.55-h),at(r,1.55-h),at(r,1.55+h),at(-r,1.55+h),at(-r,1.55-h)];
    for(let j=0;j<3;j++)path(lab,wire.map(p=>[p[0]*(1+j*.02),p[1]+j*.02,p[2]*(1+j*.02)]),c.warning,.015);
    lab.rod([0,.15,0],[0,3.1,0],.03,c.text3,12);
    for(const z of [-.5,0,.5])arrowSolid(lab,[-1.1,2.57,z],[1.1,2.57,z],alpha(c.primary,.4),.009);
    arrowSolid(lab,[0,1.55,0],[.6*Math.cos(phi),1.55,-.6*Math.sin(phi)],c.success,.014);
    const ring=(y,start,end,col)=>{for(let j=0;j<20;j++){const a=start+(end-start)*j/20,b=start+(end-start)*(j+1)/20;lab.rod([.17*Math.cos(a),y,.17*Math.sin(a)],[.17*Math.cos(b),y,.17*Math.sin(b)],.025,col,6);}};
    let contacts;
    if(f.commutator){ring(.45,phi+.09,phi+Math.PI-.09,c.warning);ring(.45,phi+Math.PI+.09,phi+TAU-.09,c.danger);contacts=[[-.23,.45,0],[.23,.45,0]];}
    else{ring(.4,0,TAU,c.warning);ring(.57,0,TAU,c.danger);contacts=[[.23,.4,0],[.23,.57,0]];}
    for(const p of contacts)lab.box(p[0]-.06,p[1]-.04,-.06,.12,.08,.12,c.text3);
    cable([wire[0],[-.04,1.55-h,0],[-.04,.45,0]],c.warning);cable([wire[1],[.04,1.55-h,0],[.04,f.commutator?.45:.57,0]],c.danger);
    const src=power(-2.5,-1,f.I,'motorCurrent');
    cable([src.plus,[-1.6,.15,-1],contacts[0]],c.danger);cable([contacts[1],[.65,.15,-1.3],[-2.85,.15,-1.3],src.minus],c.primary);
    const ie=f.st.Ieff??f.I;
    for(const [s,col]of [[-1,c.danger],[1,c.danger]]){const p=at(s*r,1.55),force=-s*Math.sign(ie);if(ie)arrowSolid(lab,p,[p[0],1.55,p[2]+force*.4],col,.016);}
    lab.label(f.commutator?'Kollektor':'Kontakt halqalar',[0,.08,-.6]);
    lab.label('ω '+fmt(f.st.omega,1)+' rad/s',[0,3.28,0]);
    knob(2.4,-1,'motorField',f.B/.5,fmt(f.B,2)+' T','B');
  }
  return {lab,rotationPoint,draw(ctx,st,ui,objs,sel,amp,frm,data){
    current={ui,objs,amp};lab.begin(ctx,st,{target:ui.mode==='field'?[0,objs.some(o=>o.type==='wire')?1:.25,0]:[0,1.65,0],focal:st.w<560?Math.min(st.w*1.35/st.h,1.7)*.88:1.7});
    if(ui.mode==='field')field(ui,objs,sel,data);else if(ui.mode==='ampere')ampere(amp,ui,data);else frame(frm);
    lab.finish(ui.mode==='ampere'?amp.t:ui.mode==='frame'?frm.t:0,ui.mode==='field'?'Maydon: 2D kesim · uzoq qaytish simlari modelga kirmaydi':ui.mode==='ampere'?'Bir jinsli maydon modeli · o‘lchamlar ko‘rgazmali':'Ramka normali va B orasidagi burchak φ · o‘ramlar sxematik');
  },modelPoint(p){return inverse(p,fieldPoint(0,0),[SCALE,0,0],[0,0,-SCALE]);},parameter(id,p){
    if(id.startsWith('rotate:')){const o=current.objs[+id.split(':')[1]];return lab.nearest(a=>rotationPoint(o,a),0,TAU,p.x,p.y);}
    if(id==='angle'){const a=current.amp,x=-.5+1.6*Math.sin(a.th),y=3-1.6*Math.cos(a.th),half=a.l*3;return lab.nearest(angle=>[x,y-Math.cos(angle)*half,Math.sin(angle)*half],0,Math.PI/2,p.x,p.y)*180/Math.PI;}
    return null;
  }};
}
