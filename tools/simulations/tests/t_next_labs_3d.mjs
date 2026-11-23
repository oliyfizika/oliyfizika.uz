import assert from 'node:assert/strict';
import { SHAPES, gyr2, periodSmall, reducedLength, conjugateDistance, omega2 } from '../../../assets/js/simulations/physical-pendulum-physics.js';
import { advance, specificEnergy, createPeriodMeter, motionInfo } from '../../../assets/js/simulations/pendulum-physics.js';
import { K, G, coulomb, gravity } from '../../../assets/js/simulations/inverse-square.js';
import { createPhysicalPendulumLab, createInverseSquareLab } from '../../../assets/js/simulations/next-labs-3d.js';
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
for(const shape of Object.keys(SHAPES)) {
  const S=.8,d=SHAPES[shape].dDefault(S),k2=gyr2(shape,S),w2=omega2(k2,d,9.81);
  near(periodSmall(k2,d,9.81),2*Math.PI*Math.sqrt(reducedLength(k2,d)/9.81));
  near(periodSmall(k2,d,9.81),periodSmall(k2,conjugateDistance(k2,d),9.81));
  let s={th:.3,w:0,t:0};const E=specificEnergy(s,w2),meter=createPeriodMeter(),T=motionInfo(s,w2).period;
  for(let i=0;i<1200;i++)s=advance(s,{w2,gamma:0,f:0,Om:0,linear:false},1/60,(a,b)=>meter.feed(a,b));
  near(specificEnergy(s,w2),E,1e-6);near(meter.mean,T,1e-4);
}
near(coulomb(4e-6,-4e-6,.4).Fabs,K*16e-12/.16);
for(const sign of [-1,1]) {
  assert.equal(coulomb(4e-6,sign*4e-6,.4).kind,sign<0?'attract':'repel');
  near(coulomb(4e-6,sign*4e-6,.2).Fabs,4*coulomb(4e-6,sign*4e-6,.4).Fabs);
}
near(coulomb(4e-6,-4e-6,.4,81).Fabs,coulomb(4e-6,-4e-6,.4).Fabs/81);
assert.equal(coulomb(0,4e-6,.4).kind,'none');
near(gravity(500,100,1).F,G*500*100);near(gravity(500,100,.5).F,4*gravity(500,100,1).F);
near(gravity(500,100,1).a2/gravity(500,100,1).a1,5);

// Exercise the real scene geometry without WebGL: no non-finite camera, body or field vertices.
globalThis.document={createElement:()=>({getContext:()=>null})};
let coordinates=0;
const check=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));coordinates++;}};
const ctx=new Proxy({measureText:text=>({width:String(text).length*6}),createRadialGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#888']));
const stage={w:720,h:340,colors};
const physical=createPhysicalPendulumLab();
for(const shape of Object.keys(SHAPES))for(const th of [0,1.5,3]) {
  const P={shape,S:.8,d:SHAPES[shape].dDefault(.8),m:1,g:9.81,gamma:0};
  physical.draw(ctx,stage,P,{th,w:1,t:0},{th:.2,w:1,t:0},{forces:true,velocity:true,center:true,ghost:true});
}
const electric=createInverseSquareLab('electric');
for(const [q1,q2,r]of [[4,-4,.4],[4,4,.1],[0,0,1],[-3,-6,.5]]) {
  electric.draw(ctx,stage,{r,rMin:.1,rMax:1,a:{q:q1,name:'q1'},b:{q:q2,name:'q2'},force:coulomb(q1*1e-6,q2*1e-6,r).Fabs,rLabel:'r'},{forces:true,field:true});
}
const grav=createInverseSquareLab('gravity');
grav.draw(ctx,stage,{r:1,rMin:.4,rMax:5,a:{mass:500,radius:.25,name:'m1'},b:{mass:100,radius:.15,name:'m2'},force:G*50000,rLabel:'r'},{forces:true,field:true});
assert.ok(coordinates>1000);
console.log('Next 3D labs: five body shapes, energy and period, conjugate pivots, inverse-square laws, dielectric and finite scene geometry passed.');
