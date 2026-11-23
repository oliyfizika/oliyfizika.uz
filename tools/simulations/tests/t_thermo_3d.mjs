import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/thermo-physics.js';
import {createThermoLab,pistonPoint,thermoPoint,crankPoint,engineScale} from '../../../assets/js/simulations/thermo-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t*Math.max(1,Math.abs(b)),`${a}≈${b}`),gas={nu:.08,i:5};
for(const kind of ['V','p','T','Q']){
 const a=P.stateVT(gas,.002,300),b=P.move(gas,a,kind,kind==='V'?{T:450}:{V:.003}),L=P.leg(gas,a,b,kind);near(L.Q,L.dU+L.A);
 if(kind==='V')near(L.A,0);if(kind==='T')near(L.dU,0);if(kind==='Q')near(L.Q,0);
}
for(const name of ['karno','rect','otto','rev']){
 const d=P.cycle(gas,name,{T1:name==='otto'?1800:600,T2:300,r:name==='otto'?8:2,V1:.0005});near(d.A,d.Qin-d.Qout);
 if(name==='karno')near(d.eta,.5);if(name==='rev')near(d.cop,1);
}
globalThis.document={createElement:()=>({getContext:()=>null})};let count=0;
const check=(...args)=>{for(const x of args)if(typeof x==='number'){assert.ok(Number.isFinite(x));count++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const mol=Array.from({length:36},(_,i)=>({x:i/36,y:((i*17)%36)/36})),scene=createThermoLab();
for(const width of [375,900])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.12,.6,1.3]){
 Object.assign(scene.lab.camera,{yaw,pitch});const stage={w:width,h:320,colors};
 for(const kind of ['V','p','T','Q'])for(const V of [.0006,.0042]){
  const proc={kind,cur:P.stateVT(gas,V,500),flow:1,flowT:1};scene.draw(ctx,stage,{mode:'proc'},proc,{}, {},mol,{totals:()=>({Q:100,A:50})});
  const p=scene.lab.project(pistonPoint(V));near(scene.parameter('piston',p),V,1e-6);
  const t=scene.lab.project(thermoPoint(500));near(scene.parameter('thermo',t),500,.005);
 }
 for(const name of ['karno','rect','otto','rev'])for(const u of [0,1.25,2.5,3.75]){
  const data=P.cycle(gas,name,{T1:name==='otto'?1800:600,T2:300,r:name==='otto'?8:2,V1:.0005}),cyc={data,u,T1:600,T2:300,laps:1,cylX:null};
  scene.draw(ctx,stage,{mode:'cycle'},{},cyc,{},mol,{cycleState:()=>P.onCycle(gas,data,u),station:L=>L.kind==='Q'?1:L.Q>0?0:2});
 }
 for(const eps of [5,12])for(let i=0;i<16;i++){
  const g=P.engineGeom({eps}),th=i*Math.PI/4,eng={g,th,Tmax:2400,eps,rpm:3000};
  scene.draw(ctx,stage,{mode:'engine'},{},{},eng,mol,{engineState:()=>P.engineState(g,5,2400,th)});
  const pin=crankPoint(g,th),wrist=[-.85,.65+(g.r*Math.cos(th)+Math.sqrt(g.l*g.l-(g.r*Math.sin(th))**2))*engineScale(g),-.32];
  near(Math.hypot(...pin.map((v,j)=>v-wrist[j])),g.l*engineScale(g));
  const p=scene.lab.project(pin),a=scene.parameter('crank',p);if(a!==null)near(Math.sin(a),Math.sin(th));
 }
}
assert.ok(count>100000);console.log('Thermo 3D: first-law/gas paths/cycles, exact slider-crank joints, every stroke and orbital drag inverse passed.');
