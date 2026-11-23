// Solid electrolysis baths. Ion trajectories are schematic; Faraday quantities use SI.
import { createLab3D } from './lab-3d.js?v=20261123-batch8d';
import { alpha, path, dial } from './apparatus-3d.js?v=20261123-batch8d';
import { fmt, clamp } from './sim-kit.js';
import * as P from './electrolysis-physics.js';

export const cathodePoint = d => [-.45+d*10,1.97,-.26];
export function createElectrolysisLab() {
  const lab=createLab3D(); let state;
  const dot=(p,r,color)=>{
    const v=[[r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]].map(q=>q.map((a,i)=>a+p[i]));
    for(const f of [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]])lab.face(f.map(i=>v[i]),color);
  };
  function bath(x,w,key,gap,dm=0,gas=false,ions=[],time=0,on=false) {
    const c=lab.colors,s=P.SOLUTIONS[key],an=x-gap/2,ca=x+gap/2;
    const water=key==='niso4'?c.success:c.primary;
    lab.box(x-w/2,.06,-.47,w,.1,.94,c.text3);
    lab.box(x-w/2+.035,.17,-.43,w-.07,1.12,.86,alpha(water,key==='cuso4'?.25:.12));
    lab.face([[x-w/2,.17,-.47],[x+w/2,.17,-.47],[x+w/2,1.55,-.47],[x-w/2,1.55,-.47]],alpha(c.text3,.07),c.text3);
    for(const z of [-.47,.47])for(const xx of [x-w/2,x+w/2])lab.rod([xx,.17,z],[xx,1.55,z],.015,c.text3,6);
    lab.face([[x-w/2,1.29,-.43],[x+w/2,1.29,-.43],[x+w/2,1.29,.43],[x-w/2,1.29,.43]],alpha(water,.22));
    const metal=s.cath==='Cu'?c.warning:c.text3;
    for(const [xx,sign,color]of [[an,'+',c.danger],[ca,'−',c.primary]]){
      const grow=sign==='−'?Math.min(.12,dm*100):0;
      if(gas){
        // Thin platinum electrode fits inside the inverted collection tube.
        lab.rod([xx,.32,0],[xx,1.04,0],.018,c.text3,10);
        path(lab,[[xx,1.98,-.28],[xx,.28,-.28],[xx,.28,0],[xx,.32,0]],color,.012);
      }else lab.box(xx-.035-grow/2,.32,-.28,.07+grow,1.6,.56,metal);
      lab.rod([xx,1.92,-.28],[xx,1.98,-.28],.038,color,8);
      lab.label(sign,[xx,2.14,-.28],color);
    }
    lab.rod([an-.1,1.79,.38],[ca+.1,1.79,.38],.027,c.text3,8);
    for(const xx of [an,ca])lab.box(xx-.08,1.72,.29,.16,.15,.18,c.bg2);
    for(const p of ions){
      const q=[x-w/2+.08+p.x*(w-.16),.3+(1-p.y)*.9,Math.sin(p.ph*1.7)*.24];
      dot(q,p.sg?.037:.024,p.sg>0?c.danger:p.sg<0?c.primary:c.text3);
    }
    if(on&&s.electrolyte)for(const [xx,sub]of [[an,s.anod],[ca,s.cath]])if(P.SUBST[sub]?.gas){
      const surface=gas?2.2-clamp(P.gasVolume(sub,state.q)*1e6/1500,0,1)*1.65:1.29;
      for(let i=0;i<9;i++){const t=(time*.7+i*.111)%1,y=.36+t*Math.max(.05,surface-.38),z=Math.sin(i*2.4)*(gas?.05:.22);dot([xx+(gas?.035:.065),y,z],.017+i%3*.003,c.text2);}
    }
    if(gas)for(const [xx,sub]of [[an,'O2'],[ca,'H2']]){
      const volume=P.gasVolume(sub,state.q)*1e6,h=clamp(volume/1500,0,1)*1.65;
      const r=.12,surface=2.2-h;
      lab.rod([xx,.35,0],[xx,surface,0],r*.9,alpha(c.primary,.3),16);
      if(h>0)lab.rod([xx,surface,0],[xx,2.2,0],r*.9,alpha(c.bg,.65),16);
      for(let i=0;i<16;i++){const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
        lab.face([[xx+r*Math.cos(a),.35,r*Math.sin(a)],[xx+r*Math.cos(b),.35,r*Math.sin(b)],[xx+r*Math.cos(b),2.2,r*Math.sin(b)],[xx+r*Math.cos(a),2.2,r*Math.sin(a)]],alpha(c.text3,.1));}
      lab.rod([xx,2.2,0],[xx,2.24,0],r,c.bg2,16);
      for(let j=1;j<=5;j++)lab.line([xx-.12,2.2-j*.33,-.025],[xx-.07,2.2-j*.33,-.105],c.text3,.8);
      lab.label(P.SUBST[sub].sym+' '+fmt(volume,1)+' mL',[xx,2.52,0],c.text2);
    }
    lab.label(key==='h2so4'?'H₂O + H₂SO₄':({cuso4:'CuSO₄',agno3:'AgNO₃',niso4:'NiSO₄',znso4:'ZnSO₄',nacl:'NaCl',water:'H₂O',sugar:'Shakar'})[key],[x,.02,-.66]);
    return {an:[an,1.98,-.28],ca:[ca,1.98,-.28]};
  }
  function supply(value,frac) {
    const c=lab.colors;
    lab.box(-3.03,.04,-1.05,.83,1.28,.68,c.bg2);
    lab.box(-2.94,.82,-1.066,.65,.27,.014,c.sunken);
    lab.label(value,[-2.6,.96,-1.1],c.success);
    dial(lab,[-2.61,.48,-1.08],frac,c.primary,'source','');
    lab.label('Manba',[-2.6,1.45,-.85]);
    const plus=[-2.35,.24,-1.09],minus=[-2.87,.24,-1.09];
    dot(plus,.05,c.danger);dot(minus,.05,c.primary);
    lab.label('+',[plus[0],plus[1]-.18,plus[2]],c.danger);lab.label('−',[minus[0],minus[1]-.18,minus[2]],c.primary);
    return {plus,minus};
  }
  function wire(pts,col){path(lab,pts,col,.018);}
  function meter(I,x=2.35) {
    const c=lab.colors;lab.box(x-.36,.06,-.95,.72,.75,.54,c.bg2);
    lab.label('A',[x,.66,-.98],c.text2);lab.label(fmt(I,3)+' A',[x,.37,-.99],c.success);
    return {plus:[x-.23,.15,-.98],minus:[x+.23,.15,-.98]};
  }
  function bulb(I) {
    const c=lab.colors,b=clamp(I*I*12/3,0,1);
    lab.box(-1.75,.03,-1.35,.5,.13,.5,c.text3);
    lab.rod([-1.5,.16,-1.1],[-1.5,.32,-1.1],.08,c.text3,12);
    lab.sphere([-1.5,.48,-1.1],.18,alpha(b>0.05?c.warning:c.bg2,.5));
    lab.rod([-1.57,.4,-1.1],[-1.43,.55,-1.1],.013,b>.05?c.warning:c.text3,6);
    return {a:[-1.68,.16,-1.1],b:[-1.32,.16,-1.1]};
  }
  function draw(ctx,st,ui,ion,f1,f2,vis,helpers) {
    const mode=ui.mode,I=mode==='ion'?helpers.circuit.I:mode==='f1'?helpers.I:f2.I,t=mode==='ion'?vis.clock:mode==='f1'?f1.time:f2.time;
    state={q:I*t};lab.begin(ctx,st,{target:[0,1.25,0],focal:st.w<560?Math.min(st.w*1.35/st.h,1.7)*.88:1.7});const c=lab.colors;
    const src=supply(mode==='ion'?fmt(ion.U,1)+' V':fmt(mode==='f1'?f1.I:f2.I,2)+' A',mode==='ion'?ion.U/24:((mode==='f1'?f1.I:f2.I)-.1)/2.9);
    const m=meter(I,mode==='f2'?2.75:2.35);
    if(mode!=='f2'){
      const key=mode==='ion'?ion.key:f1.key,gap=mode==='ion'?ion.d*20:1.3;
      const b=bath(-.45,2.35,key,gap,mode==='f1'?helpers.mass*1e3:0,false,helpers.ions('main',key,26).arr,t,I>1e-4);
      if(mode==='ion'){
        lab.handle('cathode',cathodePoint(ion.d),.18);lab.label('d '+fmt(ion.d*100,1)+' cm',[-.45,2.45,-.28]);
        const l=bulb(I);wire([src.plus,[-2.35,.24,-1.4],l.a],c.danger);wire([l.b,[-1.18,.16,-1.1],[-1.18,2.27,-.28],[b.an[0],2.27,-.28],b.an],c.danger);
      }else{
        wire([src.plus,[-2.12,.24,-.7],[-2.12,2.27,-.28],[b.an[0],2.27,-.28],b.an],c.danger);
        // A dry weighing station illustrates the end-of-run cathode measurement.
        lab.box(1.27,.04,.15,1.17,.32,.83,c.bg2);lab.box(1.4,.37,.25,.91,.06,.63,c.text3);
        lab.box(1.65,.44,.37,.42,.025,.38,c.warning);
        lab.label(fmt(helpers.initialMass+Math.round(helpers.mass*1e6)/1000,3)+' g',[1.85,.19,.1],c.success);
        lab.label('Quruq katod · tortish modeli',[1.83,.78,.5]);
      }
      wire([b.ca,[b.ca[0],2.03,-.55],[1.52,2.03,-.55],[1.52,.15,-.98],m.plus],c.primary);
    }else{
      let last=src.plus;
      for(const [i,cell]of helpers.cells.entries()){
        const x=-1.35+i*1.48,b=bath(x,1.25,cell.sol,.58,P.massOf(cell.s,state.q)*1e3,!!cell.gas,helpers.ions('cell'+i,cell.sol,12).arr,t,I>0);
        wire([last,[last[0],2.69,.65],[b.an[0],2.69,.65],[b.an[0],2.15,.65],b.an],i?c.text2:c.danger);last=b.ca;
        if(!cell.gas)lab.label('Δm '+fmt(P.massOf(cell.s,state.q)*1e6,0)+' mg',[x,2.45,0],c.success);
      }
      wire([last,[2.55,2.03,-.5],[2.55,.15,-.98],m.plus],c.primary);
    }
    wire([m.minus,[2.98,.15,-1.45],[-2.87,.15,-1.45],src.minus],c.primary);
    if(mode!=='ion')lab.label('t '+fmt(t,0)+' s · q '+fmt(state.q,0)+' C',[.1,3.02,0]);
    lab.finish(t,'Ionlar va qatlam kattalashtirilgan · elektrodlar: + anod / − katod');
  }
  return {lab,draw,parameter(id,p){if(id==='cathode')return lab.nearest(cathodePoint,.02,.1,p.x,p.y);return null;}};
}
