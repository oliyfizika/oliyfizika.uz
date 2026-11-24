import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/electrolysis-physics.js';
import {createElectrolysisLab,cathodePoint} from '../../../assets/js/simulations/electrolysis-lab-3d.js';
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
near(P.massOf('Cu',3600),P.kOf('Cu')*3600);
near(P.massOf('Ag',3600)/P.massOf('Cu',3600),(P.SUBST.Ag.M/P.SUBST.Ag.n)/(P.SUBST.Cu.M/P.SUBST.Cu.n));
near(P.gasVolume('H2',3600),2*P.gasVolume('O2',3600));
for(const sub of ['Cu','Ag','Ni','Zn'])near(P.faradayFrom(sub,3600,P.massOf(sub,3600)),P.F);
near(P.thickness('Cu',3600,.004)*P.SUBST.Cu.rho*.004,P.massOf('Cu',3600));
assert.equal(P.circuit({key:'nacl',c:.5,t:25,d:.05,S:.002,U:2,Rext:12}).I,0);
assert.ok(P.cellR('nacl',.5,80,.05,.002)<P.cellR('nacl',.5,25,.05,.002));
assert.ok(P.sigma('nacl',.5)>1e5*P.sigma('water',.5));

globalThis.document={createElement:()=>({getContext:()=>null})};let nums=0;
const finite=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));nums++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:finite});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createElectrolysisLab(),ion={key:'nacl',U:12,d:.05,c:.5,t:25},f1={key:'cuso4',I:1,time:3600},f2={I:2,time:1800},vis={clock:8};
const cells=[{sol:'agno3',s:'Ag'},{sol:'cuso4',s:'Cu'},{sol:'h2so4',s:'H2',gas:true}];
const helpers={circuit:{I:.45},I:1,mass:P.massOf('Cu',3600),initialMass:7.168,cells,ions:()=>({arr:Array.from({length:16},(_,i)=>({x:(i+.5)/16,y:(i*3%16+.5)/16,sg:i%2?1:-1,ph:i}))})};
for(const w of [375,850])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.15,.6,1.3]){
  Object.assign(scene.lab.camera,{yaw,pitch});const st={w,h:320,colors};
  for(const key of ['water','sugar','nacl','cuso4','h2so4'])scene.draw(ctx,st,{mode:'ion'},{...ion,key},f1,f2,vis,helpers);
  for(const d of [.02,.05,.1]){scene.draw(ctx,st,{mode:'ion'},{...ion,d},f1,f2,vis,helpers);const p=scene.lab.project(cathodePoint(d));assert.ok(Math.abs(scene.parameter('cathode',p)-d)<.0004);}
  for(const key of ['cuso4','agno3','niso4','znso4'])scene.draw(ctx,st,{mode:'f1'},ion,{...f1,key},f2,vis,helpers);
  scene.draw(ctx,st,{mode:'f2'},ion,f1,f2,vis,helpers);
}
assert.ok(nums>100000);console.log('Electrolysis 3D: Faraday ratios, 2:1 gas collection, threshold/conductivity, every bath/mode, finite orbital geometry and cathode inverse passed.');
