import assert from 'node:assert/strict';
import * as V from '../../../assets/js/simulations/vectors-physics.js';
import * as O from '../../../assets/js/simulations/optics-physics.js';
import * as P from '../../../assets/js/simulations/lc-physics.js';
import { createVectorLab } from '../../../assets/js/simulations/vector-lab-3d.js';
import { createOpticalLab } from '../../../assets/js/simulations/optical-lab-3d.js';
import { createCircuitLab, circuitEnergy } from '../../../assets/js/simulations/circuit-lab-3d.js';
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
for(const [F,d]of [[10,30],[10,15],[12,7],[-12,25],[10,10]]) {
  const im=O.thinLens(F,d);
  if(im.inf){assert.equal(d,F);near(O.traceRay([{x:0,F}],-d,3,0,60).slope, -3/F);continue;}
  near(1/F,1/d+1/im.f);near(im.m,-im.f/d);
  for(const y of [-4,0,4]) {
    const tr=O.traceRay([{x:0,F}],-d,3,(y-3)/d,60);
    near(y+tr.slope*im.f,im.m*3);
  }
  if(im.real)near(O.blurDiameter(F,d,5.4,im.f),0);
}
for(const defect of ['normal','myopia','hyperopia'])for(const d of [.1,.25,1,Infinity]) {
  const v=O.eyeView(d,defect,O.prescription(defect));assert.ok(v.blur>=0&&Number.isFinite(v.blur));
  near(v.blur,O.EYE.pupil*Math.abs(v.Lr-v.img)/v.img);
}
near(P.thomson(.5,800e-6),2*P.thomson(.5,200e-6));
for(const R of [0,10,100,160]) {
  const p={L:.5,C:200e-6,R};let state={q:.0012,i:0};const initial=P.energies(state,p.L,p.C);
  let heat=0;const dt=P.thomson(p.L,p.C)/1000;
  for(let i=0;i<5000;i++) {const next=P.rlcStep(state,dt,p);heat+=R*(state.i**2+next.i**2)/2*dt;state=next;}
  const expected=P.rlcAnalytic(.0012,p.L,p.C,R,5000*dt);near(state.q,expected.q);near(state.i,expected.i,1e-7);
  const en=P.energies(state,p.L,p.C);near(en.WE+en.WM+heat,initial.WE,2e-7);
}
const charging={L:.5,C:200e-6,q:.0005,i:.1,sw:1};assert.equal(circuitEnergy(charging).WM,0);assert.ok(circuitEnergy({...charging,sw:2}).WM>0);
const f0=P.resonanceF(.1,10e-6),ac=P.acSeries({R:20,L:.1,C:10e-6},10,f0);near(ac.phi,0);near(ac.I0,.5);near(ac.UL,ac.UC);

// All renderer paths, including infinity, virtual images, nonzero current, zero vectors and each instrument.
globalThis.document={createElement:()=>({getContext:()=>null})};let numeric=0;
const check=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));numeric++;}};
const ctx=new Proxy({measureText:text=>({width:String(text).length*6}),createRadialGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#888888']));
const stage={w:720,h:340,colors};
const vl=createVectorLab(),vec={a:V.vec(4,3),k:-2,proj:true},sum={a:V.vec(4,1),b:V.vec(1,3),meth:'tri',diff:true},forces={f:[V.vec(3,0),V.vec(0,4),V.vec(-3,-4)],on3:true,bal:true,poly:true};
for(const mode of ['vec','add','forces'])vl.draw(ctx,stage,{mode},vec,sum,forces);
const optics=createOpticalLab(),ui={mode:'bench',rays:true,fan:true};
const eye={k:100,defect:'normal',glasses:false,G:0},instrument={kind:'micro',F1:4,F2:8,L:30,d:4.8};
for(const [type,F,d]of [['conv',10,30],['conv',10,10],['conv',10,10.01],['conv',12,7],['div',12,25]])optics.draw(ctx,stage,ui,{type,F,d,h:4,screen:true,xs:15},instrument,eye);
for(const kind of ['loupe','micro','tele','camera','projector'])optics.draw(ctx,stage,{...ui,mode:'instr'},null,{...instrument,kind},eye);
for(const defect of ['normal','myopia','hyperopia'])optics.draw(ctx,stage,{mode:'eye'},null,null,{...eye,k:40,defect,glasses:true,G:O.prescription(defect)});
const circuit=createCircuitLab(),lc={L:.5,C:200e-6,R:10,E:6,sw:2,q:.001,i:.01,t:1,heat:.001,dots:3},AC={el:'RLC',L:.2,C:20e-6,R:60,U:10,f:50,dots:3},rs={L:.1,C:10e-6,R:20,U:10,f:120,dots:3};
for(const sw of [1,2])circuit.draw(ctx,stage,{mode:'lc',speed:.02,show:{mech:true}}, {...lc,sw},AC,rs);
for(const el of ['R','L','C','RLC'])circuit.draw(ctx,stage,{mode:'ac',vis:1},lc,{...AC,el},rs);
circuit.draw(ctx,stage,{mode:'res',vis:2},lc,AC,rs);
assert.ok(numeric>10000);
console.log('Detailed 3D labs: optics, virtual/infinite images, eye correction, RLC analytic solution, energy balance, charging topology and all scene modes passed.');
