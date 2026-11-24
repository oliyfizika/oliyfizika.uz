import assert from 'node:assert/strict';
import * as pendulum from '../../../assets/js/simulations/pendulum-physics.js';
import * as incline from '../../../assets/js/simulations/incline-physics.js';
import { solve, stateAt, energiesAt } from '../../../assets/js/simulations/projectile-physics.js';
import { createLab3D } from '../../../assets/js/simulations/lab-3d.js';

const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} ≈ ${b}`);
// Verify the physical quantities used by the new scene, including full rotations.
for(const initial of [{th:.1,w:0,t:0},{th:2,w:0,t:0},{th:0,w:8,t:0}]) {
  const p={w2:9.81,gamma:0,f:0,Om:0,linear:false};
  let s={...initial};const E=pendulum.specificEnergy(s,p.w2),meter=pendulum.createPeriodMeter();
  for(let i=0;i<1800;i++)s=pendulum.advance(s,p,1/60,(a,b)=>meter.feed(a,b));
  near(pendulum.specificEnergy(s,p.w2),E,1e-6);
  near(meter.mean,pendulum.motionInfo(initial,p.w2).period,1e-4);
}
near(incline.dynamics(0,{theta:Math.PI/6,mu:0,m:2}).a,incline.G/2);
assert.equal(incline.dynamics(0,{theta:.1,mu:.5,m:2}).mode,'rest');
for(const m of [.5,2,20])near(incline.dynamics(1,{theta:Math.PI/6,mu:.3,m}).a,incline.G*(.5-.3*Math.cos(Math.PI/6)));
for(const p of [{v0:20,alpha:Math.PI/4,h0:0,g:9.8},{v0:0,alpha:-Math.PI/2,h0:45,g:9.8},{v0:20,alpha:Math.PI/2,h0:0,g:1.62}]) {
  const sol=solve(p);near(stateAt(p,sol.T).y,0);
  for(const fraction of [0,.25,.5,.75,1])near(energiesAt(p,sol.T*fraction).tot,energiesAt(p,0).tot);
}
// Camera inverse must preserve manipulation in the physical x–y plane at any usable angle.
globalThis.document={createElement:()=>({getContext:()=>null})};
const lab=createLab3D(),ctx={fillRect(){},createRadialGradient:()=>({addColorStop(){}})};
const colors={bg:'#fff',bg2:'#eee',sunken:'#ddd',text3:'#666',text2:'#444',border:'#ccc'};
for(const yaw of [-3,-1,0,.8,3])for(const pitch of [.1,.6,1.2]){
  Object.assign(lab.camera,{yaw,pitch});lab.begin(ctx,{w:720,h:340,colors});
  for(const point of [[1,2,0],[-2,.2,0],[0,1,0]]){
    const pixel=lab.project(point),world=lab.planePoint(pixel.x,pixel.y);
    assert.ok(world);point.forEach((v,i)=>near(world[i],v));
  }
}
console.log('3D mechanics: energy, periods, friction, flight and camera inverse passed.');
