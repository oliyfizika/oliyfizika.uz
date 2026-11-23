import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/surface-physics.js';
import {createSurfaceLab,filmPoint,filmLengthPoint,dropStart,dropLanding} from '../../../assets/js/simulations/surface-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t*Math.max(1,Math.abs(b)),`${a}≈${b}`);
near(P.filmForce(.04,.05),.004);near(P.filmWork(.04,.05,.02),.00008);
for(const [key,L]of Object.entries(P.LIQUIDS)){
 for(const t of [0,90])for(const r of [.0001,.002]){
  const surface=.95+12*P.capillaryH(P.sigmaAt(key,t),L.rho,r,L.theta);
  assert.ok(surface-.03>.25&&surface+.03<2.85,'meniscus stays within the immersed tube');
 }
 for(const r of [.0001,.0005,.002]){const h=P.capillaryH(L.sigma,L.rho,r,L.theta);assert.equal(h<0,key==='mercury');near(P.capillaryH(L.sigma,L.rho,2*r,L.theta),h/2);}
 for(const d of [.001,.004]){const m=P.dropMass(L.sigma,d);near(P.sigmaFromDrops(m*60,60,d),L.sigma);}
}
// Queued drops reserve the final count: no overshoot at accelerated emission.
for(const speed of [1,4]){
 let N=0,grow=0,falling=[];
 for(let i=0;i<4000&&N<60;i++){
  const dt=1/60;if(N+falling.length<60){grow+=dt*1.6*speed;if(grow>=1){grow=0;falling.push({y:dropStart(.0728,.002,1000),v:0});}}
  for(const f of falling){f.v-=P.G*dt;f.y+=f.v*dt;}
  const hit=falling.filter(f=>f.y<=dropLanding(N));falling=falling.filter(f=>f.y>dropLanding(N));N+=hit.length;assert.ok(N+falling.length<=60);
 }
 assert.equal(N,60);
}
globalThis.document={createElement:()=>({getContext:()=>null})};let count=0;
const check=(...args)=>{for(const x of args)if(typeof x==='number'){assert.ok(Number.isFinite(x));count++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createSurfaceLab(),film={L:.05,x:.06,x0:.03},cap={r:.0005},drops={d:.002,N:20,M:P.dropMass(.0728,.002)*20,grow:.5,falling:[{y:1.4}],open:true};
for(const width of [375,900])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.12,.6,1.3]){
 Object.assign(scene.lab.camera,{yaw,pitch});const stage={w:width,h:320,colors};
 for(const L of [.02,.08])for(const x of [.01,.09]){
  Object.assign(film,{L,x});scene.draw(ctx,stage,{mode:'film'},{liq:'soap',t:20},film,cap,drops,.04);
  for(const [id,p,value]of [['bar',filmPoint(x),x],['length',filmLengthPoint(L),L]]){const q=scene.lab.project(p);near(scene.parameter(id,q),value,.0003);}
 }
 for(const liq of Object.keys(P.LIQUIDS))for(const r of [.0001,.002]){cap.r=r;scene.draw(ctx,stage,{mode:'cap'},{liq,t:20},film,cap,drops,P.sigmaAt(liq,20));}
 for(const d of [.001,.004]){drops.d=d;scene.draw(ctx,stage,{mode:'drops'},{liq:'water',t:20},film,cap,drops,.0728);}
}
assert.ok(count>100000);console.log('Surface 3D: two-surface force/work, signed capillary levels, drop-mass inversion, exact60-drop scheduling, all apparatus/extremes/orbit handles passed.');
