import assert from 'node:assert/strict';
import { advance, dynParams, exactFree, omega0, period0, kinetic, elastic, effectiveK, createPeriodMeter } from '../../../assets/js/simulations/spring-physics.js';

for (const b of [0, 1, 10, 15]) {
  const p = dynParams({m:1,k:25,b,f:0,Om:0});
  const result=advance({x:.12,v:.1,t:0},p,5);
  const expected=exactFree(.12,.1,omega0(25,1),b,5);
  assert.ok(Math.abs(result.x-expected.x)<1e-8,`RK4 displacement, b=${b}`);
  assert.ok(Math.abs(result.v-expected.v)<1e-8,`RK4 velocity, b=${b}`);
}
const meter=createPeriodMeter();
let s={x:.12,v:0,t:0};
const E=elastic(s.x,25);
for(let i=0;i<1800;i++)s=advance(s,dynParams({m:1,k:25,b:0,f:0,Om:0}),1/60,(a,b)=>meter.feed(a,b));
assert.ok(Math.abs(kinetic(s.v,1)+elastic(s.x,25)-E)<1e-8,'Energy conserved over 30 seconds');
assert.ok(Math.abs(meter.mean-period0(25,1))<1e-5,'Measured period agrees with theory');
assert.equal(effectiveK('parallel',40,60),100);
assert.equal(effectiveK('series',40,60),24);
console.log('Spring: analytical solutions, energy, measured period and spring connections passed.');
