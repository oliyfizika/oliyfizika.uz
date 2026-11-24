import { createLab3D } from './lab-3d.js?v=20261122-detail4';
import { clamp, fmt } from './sim-kit.js';
import * as P from './lc-physics.js';
import { alpha, arrowSolid, path, helix, dial, carriers, ring } from './apparatus-3d.js?v=20261122-detail4';

export const circuitEnergy = state => P.energies({q:state.q,i:state.sw===2?state.i:0},state.L,state.C);

export function createCircuitLab() {
  const lab=createLab3D();let dialCenter=null;
  function capacitor(x,z,C,q,label='C',variable=false) {
    const c=lab.colors,y=.73;
    lab.box(x-.4,.19,z-.34,.8,.08,.68,c.bg2);
    const colors=q>=0?[c.danger,c.primary]:[c.primary,c.danger];
    for(const [i,zz]of [z-.14,z+.14].entries()) {
      lab.box(x-.28,.35,zz-.012,.56,.78,.024,Math.abs(q)>.02?colors[i]:c.text3);
      lab.rod([x,.27,z+(i? .42:-.42)],[x,y,zz],.02,c.text2);
      if(Math.abs(q)>.02)lab.label(i===0?(q>0?'+':'−'):(q>0?'−':'+'),[x,y,zz+(i?.04:-.04)],colors[i]);
    }
    if(Math.abs(q)>.03)for(const xx of [-.18,0,.18])arrowSolid(lab,[x+xx,y,z+(q>=0?-.1:.1)],[x+xx,y,z+(q>=0?.1:-.1)],c.primary,.007);
    lab.label(`${label} = ${fmt(C*1e6,C*1e6%1?1:0)} mkF`,[x,1.4,z]);
    if(variable){dialCenter=[x,.43,z-.46];dial(lab,dialCenter,Math.log(C/2e-6)/Math.log(30),c.special,'capacitor','Sig‘im dastagi');}
    return [[x,y,z-.14],[x,y,z+.14]];
  }
  function coil(x,z,L,current) {
    const c=lab.colors;
    lab.box(x-.58,.19,z-.35,1.16,.08,.7,c.bg2);
    for(const xx of [x-.46,x+.46])lab.rod([xx,.28,z],[xx,.72,z],.035,c.text3);
    const a=[x-.45,.72,z],b=[x+.45,.72,z];
    const pts=helix(lab,a,b,.2,10,c.warning,.015);
    lab.label(`L = ${fmt(L,2)} Gn`,[x,1.42,z]);
    if(Math.abs(current)>.03) {
      arrowSolid(lab,[x-.25*Math.sign(current),.72,z],[x+.25*Math.sign(current),.72,z],c.success,.013);
      lab.label('B',[x,.96,z+.05],c.success);
    }
    return {a,b,pts};
  }
  function resistor(x,z,R) {
    const c=lab.colors;
    lab.box(x-.28,.28,z-.12,.56,.18,.24,c.text3);
    for(const xx of [-.15,0,.15])lab.box(x+xx-.025,.275,z-.125,.05,.19,.25,c.warning);
    lab.label(`R = ${fmt(R,0)} Om`,[x,.68,z]);
    lab.rod([x-.42,.35,z],[x-.28,.35,z],.018,c.text2);lab.rod([x+.28,.35,z],[x+.42,.35,z],.018,c.text2);
    return [[x-.42,.35,z],[x+.42,.35,z]];
  }
  function generator(x,z,f,U) {
    const c=lab.colors;
    lab.box(x-.42,.18,z-.3,.84,1.0,.6,c.bg2);
    lab.box(x-.32,.86,z-.32,.64,.18,.018,c.sunken);
    lab.label(`${fmt(f,0)} Hz`,[x,.95,z-.34],c.success);
    dialCenter=[x,.59,z-.34];dial(lab,dialCenter,Math.log(f/10)/Math.log(100),c.warning,'generator','Chastota dastagi');
    lab.label(`~ ${fmt(U,1)} V`,[x,1.42,z]);
    const a=[x-.23,.35,z-.38],b=[x+.23,.35,z-.38];lab.sphere(a,.045,c.danger);lab.sphere(b,.045,c.primary);
    return [a,b];
  }
  function energyMeter(x,z,values,reference) {
    const c=lab.colors,ref=Math.max(reference||0,...values.map(v=>v.value),.000001);
    lab.box(x-.35,.18,z-.22,.75,.09,.5,c.bg2);
    values.forEach((v,i)=>{
      const xx=x-.22+i*.24,h=.52*clamp(v.value/ref,0,1);
      lab.box(xx-.06,.28,z-.06,.12,.6,.12,alpha(c.text3,.16));
      if(h>0)lab.box(xx-.05,.28,z-.05,.1,h,.1,v.color);
      lab.label(v.name,[xx,1.05,z],v.color);
    });
  }
  function draw(ctx,stage,ui,lc,ac,rs) {
    lab.begin(ctx,stage,{target:[0,.8,0],focal:1.9});const c=lab.colors;
    lab.box(-2.8,.02,-1.42,5.6,.14,2.84,c.bg2);dialCenter=null;
    if(ui.mode==='lc') {
      const norm=lc.q/(lc.C*lc.E),im=lc.E*Math.sqrt(lc.C/lc.L),current=lc.sw===2?-lc.i/im:0;
      const cap=capacitor(-.5,0,lc.C,norm),co=coil(1.15,0,lc.L,current);
      lab.box(-2.45,.18,-.28,.7,.75,.56,c.text3);
      const plus=[-2.22,.95,-.12],minus=[-1.98,.95,.12];lab.sphere(plus,.05,c.danger);lab.sphere(minus,.05,c.primary);
      lab.label(`${fmt(lc.E,1)} V`,[-2.1,1.32,0]);
      const hinge=[-.5,.38,-.92],contacts=[[-1.05,.38,-.92],[.1,.38,-.92]];
      lab.box(-1.2,.18,-1.15,1.5,.08,.46,c.text3);
      for(const [i,p]of contacts.entries()){lab.sphere(p,.055,c.warning);lab.label(String(i+1),[p[0],p[1]+.22,p[2]]);}
      const target=contacts[lc.sw-1];lab.rod(hinge,target,.035,c.warning);lab.sphere(hinge,.085,c.warning);lab.handle('switch',hinge,.17);
      lab.label('Kalit',[-.5,.76,-.92]);
      path(lab,[cap[0],[-.5,.31,-.6],hinge],c.danger);
      path(lab,[plus,[-2.22,.31,-.92],contacts[0]],c.danger);
      path(lab,[contacts[1],[.7,.31,-.92],co.a],c.danger);
      const re=lc.R>0?resistor(.5,.86,lc.R):[[.08,.35,.86],[.92,.35,.86]];
      const ret=[co.b,[1.95,.31,.86],re[1]];path(lab,ret,c.primary);
      path(lab,[re[1],re[0],[-.5,.31,.86],cap[1]],c.primary);
      path(lab,[minus,[-1.98,.31,.86],[-.5,.31,.86]],c.primary);
      const route=lc.sw===2?[...cap.slice(0,1),[-.5,.31,-.6],hinge,target,[.7,.31,-.92],...co.pts,...ret.slice(1),re[0],[-.5,.31,.86],cap[1]]:[plus,[-2.22,.31,-.92],contacts[0],hinge,[-.5,.31,-.6],cap[0]];
      if(Math.abs(lc.i/im)>.003) {
        carriers(lab,route,-lc.dots*.025,c.warning,18);
        if(lc.sw===1)carriers(lab,[cap[1],[-.5,.31,.86],[-1.98,.31,.86],minus],-lc.dots*.025,c.warning,8);
      }
      const en=circuitEnergy(lc);
      energyMeter(2.15,.8,[{name:'Wₑ',value:en.WE,color:c.primary},{name:'Wₘ',value:en.WM,color:c.success},{name:'Q',value:lc.heat,color:c.warning}],lc.C*lc.E*lc.E/2);
      if(ui.show.mech) {
        const xx=1.8+.25*clamp(norm,-1,1);
        lab.box(.9,.18,-1.4,1.65,.08,.38,c.text3);
        lab.box(xx-.12,.27,-1.35,.24,.26,.28,c.primary);
        helix(lab,[1.0,.4,-1.21],[xx-.12,.4,-1.21],.055,7,c.text2,.012);
        lab.label('x ↔ q, v ↔ i',[1.7,.25,-1.35]);
      }
      lab.finish(lc.t,`Tok va maydon yo‘nalishlari ishoraga mos · vaqt ${fmt(1/ui.speed,0)} marta sekin`);
    } else {
      const resonant=ui.mode==='res',p=resonant?rs:ac,el=resonant?'RLC':ac.el;
      const elems=resonant?{R:rs.R,L:rs.L,C:rs.C}:{R:el.includes('R')?p.R:0,L:el.includes('L')?p.L:0,C:el.includes('C')?p.C:Infinity};
      const state=P.acSeries(elems,p.U,p.f),now=Math.sin(ui.vis-state.phi),source=generator(-2.1,0,p.f,p.U);
      const parts=[],capacitorRegions=[];
      if(el.includes('R'))parts.push({kind:'R'});if(el.includes('L'))parts.push({kind:'L'});if(el.includes('C'))parts.push({kind:'C'});
      const route=[source[0],[-2.55,.31,-.85]];let previous=route.at(-1);
      for(const [i,item]of parts.entries()) {
        const x=-.8+i*1.2;
        let terminals,componentPath=null;
        if(item.kind==='R')terminals=resistor(x,-.6,p.R);
        if(item.kind==='L'){const coilParts=coil(x,-.6,p.L,now);terminals=[coilParts.a,coilParts.b];componentPath=coilParts.pts;}
        if(item.kind==='C'){terminals=capacitor(x,-.6,p.C,Math.sin(ui.vis-state.phi-Math.PI/2),'C',resonant);capacitorRegions.push(x);}
        path(lab,[previous,terminals[0]],c.danger);route.push(...(componentPath||terminals));previous=terminals[1];
      }
      const tail=[[2.55,.31,-.85],[2.55,.31,.86],[-1.87,.31,.86],source[1]];
      path(lab,[previous,...tail],c.primary);route.push(...tail);
      if(Math.abs(now)>.02)carriers(lab,route,p.dots*.018,c.warning,20,pos=>!capacitorRegions.some(x=>Math.abs(pos[0]-x)<.31&&Math.abs(pos[1]-.73)<.4&&Math.abs(pos[2]+.6)<.13));
      // RMS ammeter and resonance lamp, independent of the instantaneous sign of current.
      lab.box(.2,.18,.55,.8,.5,.5,c.text3);lab.box(.28,.39,.53,.64,.22,.02,c.sunken);lab.label(`A: ${fmt(state.Ief*1000,1)} mA`,[.6,.53,.82],c.success);
      if(resonant) {
        const brightness=clamp((p.R/state.Z)**2,0,1);
        lab.rod([-.8,.22,.75],[-.8,.48,.75],.11,c.text3);
        lab.sphere([-.8,.6,.75],.15,brightness>.1?alpha(c.warning,.25+.75*brightness):alpha(c.text3,.35));
        lab.label(`f₀ = ${fmt(P.resonanceF(p.L,p.C),1)} Hz`,[.2,1.65,-.8],c.success);
      } else {
        const center=[1.6,1.85,.75],r=.35;
        ring(lab,center,r,c.borderStrong);
        const vref=Math.max(p.U,state.UR,state.UL,state.UC,1e-9);
        const phasor=(origin,angle,len,col,name)=>{
          const end=[origin[0]+len*Math.cos(angle),origin[1]+len*Math.sin(angle),origin[2]];
          arrowSolid(lab,origin,end,col,.012);lab.label(name,[end[0]+.08,end[1]+.08,end[2]],col);return end;
        };
        phasor(center,ui.vis,r*p.U/vref,c.warning,'U');
        phasor(center,ui.vis-state.phi,r*.8,c.primary,'I');
        if(el==='RLC') {
          const ur=phasor(center,ui.vis-state.phi,r*state.UR/vref,c.text2,'Uᵣ');
          const ul=phasor(ur,ui.vis-state.phi+Math.PI/2,r*state.UL/vref,c.success,'Uₗ');
          phasor(ul,ui.vis-state.phi-Math.PI/2,r*state.UC/vref,c.special,'U꜀');
        }
        lab.label(`φ = ${fmt(state.phi*180/Math.PI,1)}°`,[center[0],center[1]-.6,center[2]]);
      }
      lab.finish(ui.vis/(2*Math.PI*p.f),`Chastota ${fmt(p.f,0)} Hz · faza harakati sekinlashtirilgan · tok oniy qiymatga mos`);
    }
  }
  return {lab,draw,dialFraction(x,y){if(!dialCenter)return null;return lab.nearest(f=>[dialCenter[0]+Math.sin((-.8+1.6*f)*Math.PI)*.12,dialCenter[1]+Math.cos((-.8+1.6*f)*Math.PI)*.12,dialCenter[2]-.015],0,1,x,y);}};
}
