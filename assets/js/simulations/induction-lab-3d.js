import { createLab3D } from './lab-3d.js?v=20261123-batch8b';
import { alpha, arrowSolid, helix, path, dial } from './apparatus-3d.js?v=20261123-batch8b';
import { clamp, fmt } from './sim-kit.js';
import * as P from './induction-physics.js';

export const magnetPoint=x=>[18*x,1.65,.2];
export function createInductionLab() {
  const lab=createLab3D();
  const cable=(pts,col)=>path(lab,pts,col,.019);
  function knob(x,z,id,frac,value,title,color) {
    const c=lab.colors;lab.box(x-.31,.04,z-.17,.62,.43,.34,c.bg2);
    dial(lab,[x,.28,z-.19],frac,color,id,title);lab.label(value,[x,.82,z-.2],color);
  }
  function lamp(x,z,brightness,label) {
    const c=lab.colors,b=clamp(brightness,0,1);
    lab.box(x-.27,.05,z-.23,.54,.12,.46,c.text3);
    lab.rod([x,.17,z],[x,.32,z],.08,c.text2,12);
    lab.sphere([x,.48,z],.2,alpha(b>.03?c.warning:c.bg2,.42));
    lab.rod([x-.07,.4,z],[x+.07,.54,z],.012,b>.03?c.warning:c.text3,6);
    lab.label(label,[x,.88,z]);return {a:[x-.23,.17,z],b:[x+.23,.17,z]};
  }
  function meter(x,y,z,I,max,label,unit) {
    const c=lab.colors;lab.box(x-.47,y-.38,z,.94,.79,.35,c.bg2);
    const center=[x,y-.08,z-.015],r=.33;
    for(let i=0;i<=10;i++){const a=(-145+i*11)*Math.PI/180;
      lab.line([x+r*Math.cos(a),y-.08-r*Math.sin(a),z-.025],[x+(r-.035)*Math.cos(a),y-.08-(r-.035)*Math.sin(a),z-.025],c.text3);}
    const a=(-90+clamp(I/Math.max(max,1e-12),-1,1)*55)*Math.PI/180;
    lab.rod(center,[x+.28*Math.cos(a),y-.08-.28*Math.sin(a),z-.025],.009,c.danger,6);
    lab.label(label,[x,y+.24,z-.03]);lab.label(fmt(I,2)+' '+unit,[x,y-.33,z-.04],c.success);
    lab.label('−',[x-.34,y-.02,z-.04]);lab.label('+',[x+.34,y-.02,z-.04]);
    return {a:[x-.37,y-.4,z-.02],b:[x+.37,y-.4,z-.02]};
  }
  function faraday(fd,helpers) {
    const c=lab.colors,center=magnetPoint(fd.x),s=helpers.fdState;
    const turns=clamp(Math.round(fd.N/50),5,16);
    const a=[-fd.len*9,1.65,.2],b=[fd.len*9,1.65,.2];
    lab.rod([-2.75,1.65,.2],[2.75,1.65,.2],.225,alpha(c.text3,.08),20);
    for(const x of [-2.65,2.65])lab.rod([x,.9,.2],[x,1.43,.2],.04,c.text3,8);
    const coil=helix(lab,a,b,fd.a*18,turns,c.warning,.018);
    for(const x of [a[0],b[0]]){lab.rod([x,.05,.2],[x,1.26,.2],.03,c.text3,8);lab.box(x-.18,.03,-.05,.36,.05,.5,c.text3);}
    // Magnet pole axis and coil axis share the same x line.
    lab.box(center[0]-.54,center[1]-.13,center[2]-.13,.54,.26,.26,fd.flip?c.danger:c.primary);
    lab.box(center[0],center[1]-.13,center[2]-.13,.54,.26,.26,fd.flip?c.primary:c.danger);
    lab.label(fd.flip?'N':'S',[center[0]-.27,center[1],center[2]-.15],c.text);
    lab.label(fd.flip?'S':'N',[center[0]+.27,center[1],center[2]-.15],c.text);
    lab.handle('magnet',center,.22);
    lab.rod([-2.75,.87,.2],[2.75,.87,.2],.018,c.text3,8);
    for(let i=-12;i<=12;i+=4){lab.line([i*.18,.87,.18],[i*.18,.97,.18],c.text3);lab.label(String(i),[i*.18,.65,.15]);}
    lab.label('x, cm',[2.6,.63,.15]);
    const m=meter(1.95,.56,-1.25,s.I*1000,helpers.peakI*1000,'G','mA');
    cable([coil[0],[a[0],1.2,.62],[a[0],.2,.62],[1.4,.2,.62],[1.4,.16,-1.27],m.a],c.text2);
    cable([coil[coil.length-1],[b[0],1.2,.69],[b[0],.24,.69],[2.55,.24,.69],[2.55,.16,-1.27],m.b],c.text2);
    if(Math.abs(s.I)>2e-5){const sign=Math.sign(s.I);arrowSolid(lab,[0,1.65,.2-.36],[0,1.65+sign*.22,.2-.36],c.success,.012);lab.label(sign>0?'S':'N',[a[0]-.12,2.35,.2],c.text2);lab.label(sign>0?'N':'S',[b[0]+.12,2.35,.2],c.text2);}
    if(Math.abs(fd.vel)>.005)arrowSolid(lab,[center[0],2.19,.2],[center[0]+Math.sign(fd.vel)*.4,2.19,.2],c.primary,.016);
    lab.label('v '+fmt(fd.vel,2)+' m/s',[center[0],2.5,.2],c.primary);
    knob(-2.3,-1.1,'speed',(fd.v-.1)/2.9,fmt(fd.v,1)+' m/s','v',c.primary);
    knob(-1.35,-1.1,'turns',(fd.N-20)/980,String(fd.N),'N',c.warning);
  }
  function generator(g,helpers) {
    const c=lab.colors,phi=2*Math.PI*g.n*g.t,k=Math.sqrt(g.S/50),r=.6*k,y0=1.55,half=.65*k,gap=Math.max(1.1,r+.18);
    for(const [x,col,label]of [[-gap-.25,c.danger,'N'],[gap,c.primary,'S']]){
      lab.box(x,.7,-.85,.25,1.7,1.7,col);lab.label(label,[x+.13,2.65,0],c.text);
    }
    lab.box(-1.6,.05,.68,3.2,.63,.17,c.text3);
    for(const z of [-.55,0,.55])arrowSolid(lab,[-gap+.05,2.16,z],[gap-.05,2.16,z],alpha(c.primary,.4),.009);
    const u=[-Math.sin(phi),0,-Math.cos(phi)],at=(d,y)=>[u[0]*d,y,u[2]*d];
    const frame=[at(-r,y0-half),at(r,y0-half),at(r,y0+half),at(-r,y0+half),at(-r,y0-half)];
    for(let j=0;j<3;j++)path(lab,frame.map(p=>[p[0]*(1+j*.025),p[1]+j*.024,p[2]*(1+j*.025)]),c.warning,.014);
    lab.rod([0,.16,0],[0,2.75,0],.035,c.text3,12);
    lab.box(-.18,2.65,-.2,.36,.16,.4,c.text3);
    arrowSolid(lab,[0,y0,0],[.65*Math.cos(phi),y0,-.65*Math.sin(phi)],c.success,.016);lab.label('n',[.8*Math.cos(phi),y0,-.8*Math.sin(phi)],c.success);
    // Slip rings are isolated and axial; a commutator uses two insulated half rings.
    const ring=(y,start,end,col)=>{for(let j=0;j<24;j++){const a=start+(end-start)*j/24,b=start+(end-start)*(j+1)/24;lab.rod([.17*Math.cos(a),y,.17*Math.sin(a)],[.17*Math.cos(b),y,.17*Math.sin(b)],.035,col,6);}};
    let brushes;
    if(g.comm){ring(.48,phi+.08,phi+Math.PI-.08,c.warning);ring(.48,phi+Math.PI+.08,phi+2*Math.PI-.08,c.danger);brushes=[[-.24,.48,0],[.24,.48,0]];}
    else{ring(.42,0,2*Math.PI,c.warning);ring(.6,0,2*Math.PI,c.danger);brushes=[[.24,.42,0],[.24,.6,0]];}
    for(const b of brushes)lab.box(b[0]-.07,b[1]-.05,b[2]-.07,.14,.1,.14,c.text3);
    cable([frame[0],[-.04,.83,0],[-.04,.48,0]],c.warning);cable([frame[1],[.04,.86,0],[.04,g.comm?.48:.6,0]],c.danger);
    const e=P.generatorEmf(helpers.genP,g.t),em=P.emfMax(helpers.genP),l=lamp(2.25,-.7,e*e/Math.max(em*em,1e-12),'Yuklama R');
    cable([brushes[0],[brushes[0][0],.22,-.35],[1.75,.22,-.35],l.a],c.text2);cable([brushes[1],[.5,.26,-1.1],[2.75,.26,-1.1],l.b],c.text2);
    lab.label(g.comm?'Ikki yarim kollektor':'Ikki kontakt halqa',[0,.05,-.5]);
    lab.label('ε '+fmt(e,2)+' V',[2.25,1.3,-.7],c.success);
    knob(-2.5,-.8,'rotation',(g.n-.2)/9.8,fmt(g.n,1)+' ayl/s','n',c.primary);
    knob(-1.65,-1.13,'field',(g.B-.05)/.95,fmt(g.B,2)+' T','B',c.primary);
  }
  function selfInduction(s,helpers) {
    const c=lab.colors;lab.box(-2.9,.05,-.6,.8,.87,.78,c.bg2);lab.label(fmt(s.E,1)+' V',[-2.5,.76,-.63],c.success);
    dial(lab,[-2.5,.37,-.63],(s.E-1)/11,c.primary,'voltage','E');
    const positive=[-2.13,.2,-.42],negative=[-2.13,.2,.05],join=[-1.3,.18,.8],returnJoin=[-1.3,.18,-1.1];
    cable([positive,[-1.9,.18,-.42],[-1.9,.18,.8],[-1.7,.18,.8]],c.danger);
    lab.box(-1.83,.04,.62,.72,.1,.4,c.bg2);
    const sw=[-1.7,.2,.8],end=s.closed?[-1.28,.2,.8]:[-1.28,.49,.8];
    lab.rod(sw,end,.028,c.warning,8);lab.handle('switch',end,.2);lab.label(s.closed?'Ulangan':'Uzilgan',[-1.45,.76,.8]);
    cable([join,[2.25,.18,.8]],c.danger);cable([returnJoin,[2.25,.18,-1.1]],c.primary);
    cable([returnJoin,[-1.9,.18,-1.1],[-1.9,.18,.05],negative],c.primary);
    const l1=lamp(-.5,-.55,(helpers.Rlamp*s.out.i1**2)/(.1+s.E*s.E/(s.R+10)),'L₁ + R'),l2=lamp(1.6,-.55,(helpers.Rlamp*s.out.i2**2)/(.1+s.E*s.E/12),'L₂ + L');
    cable([[-.5,.18,.8],[-.5,.18,.58]],c.text2);lab.box(-.64,.1,.1,.28,.22,.48,c.text3);lab.label(fmt(s.R,0)+' Ω',[-.5,.58,.34]);
    cable([[-.5,.18,.1],[-.5,.18,-.22],l1.a],c.text2);cable([l1.b,[-.27,.18,-1.1]],c.text2);
    const coil=helix(lab,[1.6,.45,.12],[1.6,.45,.78],.18,9,c.warning,.018);
    cable([[1.6,.18,.8],coil[coil.length-1]],c.text2);cable([coil[0],[1.25,.18,-.1],l2.a],c.text2);cable([l2.b,[1.83,.18,-1.1]],c.text2);
    if(s.core)lab.rod([1.6,.45,-.04],[1.6,.45,.95],.1,c.text3,12);else lab.rod([2.5,.2,.22],[2.5,.2,1.16],.1,c.text3,12);
    lab.handle('core',s.core?[1.6,.45,.95]:[2.5,.2,1.16],.18);lab.label('Temir o‘zak',[2.5,.65,.65]);
    lab.label('I₁ '+fmt(s.out.i1*1000,0)+' mA',[-.5,1.25,-.4],c.primary);lab.label('I₂ '+fmt(s.out.i2*1000,0)+' mA',[1.6,1.25,-.4],c.primary);
    if(s.spark>.05)for(let j=0;j<5;j++)lab.line(end,[end[0]+Math.cos(j*2)*.15,end[1]+Math.sin(j*2)*.15,end[2]],c.warning,2);
  }
  return {lab,draw(ctx,st,ui,fd,gen,self,helpers){
    lab.begin(ctx,st,{target:[0,1.25,0],focal:1.7});
    if(ui.mode==='faraday')faraday(fd,helpers);else if(ui.mode==='gen')generator(gen,helpers);else selfInduction(self,helpers);
    lab.finish(ui.mode==='faraday'?fd.t:ui.mode==='gen'?gen.t:self.t,ui.mode==='faraday'?'Bir xil x/r masshtab · o‘ramlar sxematik':ui.mode==='gen'?'Ramka aylanish o‘qi vertikal · B: N → S':'Ikki parallel shoxcha · uzilganda g‘altak toki lampalar orqali so‘nadi');
  },parameter(id,p){return id==='magnet'?lab.nearest(magnetPoint,-.145,.145,p.x,p.y):null;}};
}
