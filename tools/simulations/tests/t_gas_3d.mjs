import assert from 'node:assert/strict';
import * as G from '../../../assets/js/simulations/gas-engine.js';
import {createGasLab} from '../../../assets/js/simulations/gas-lab-3d.js';

const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
const momentum=w=>w.vx.reduce((s,v,i)=>s+v*w.m[i],0);
const energy=w=>G.kinetic(w,{skipBig:false}).E;
const pair=G.createWorld({W:100,H:100});
Object.assign(pair,{x:[49,51],y:[50,50],vx:[3,-1],vy:[0,0],r:[2,2],m:[1,2],sp:[0,1]});
const Ep=energy(pair),pp=momentum(pair);G.step(pair,.01);
near(energy(pair),Ep);near(momentum(pair),pp);assert.equal(pair.collisions,1);

const isolated=G.createWorld({W:400,H:300,rand:G.mulberry(17)});
G.addParticles(isolated,180,{r:2.2,m:1,kT:G.kTof(300)});
const E0=energy(isolated);
for(let i=0;i<1000;i++)G.step(isolated,G.safeDt(isolated));
near(energy(isolated),E0);assert.ok(isolated.collisions>20);assert.ok(isolated.impulse>0);

// Work transferred by a moving piston equals piston speed times wall impulse.
const piston=G.createWorld({W:100,H:100,top:20});
Object.assign(piston,{x:[50],y:[23],vx:[0],vy:[-10],r:[2],m:[1],sp:[0]});
const Ew=energy(piston),u=G.movePiston(piston,21,5,.1);G.step(piston,.1);
near(piston.vy[0],20);near(energy(piston)-Ew,u*piston.impulseTop);

const split=G.createWorld({W:520,H:220,rand:G.mulberry(91)});
G.addParticles(split,90,{r:2.2,m:1,kT:G.kTof(300),sp:0,xMax:260});
G.addParticles(split,90,{r:2.2,m:44/28,kT:G.kTof(300),sp:1,xMin:260});split.barrier=260;
for(let i=0;i<350;i++)G.step(split,G.safeDt(split));
assert.ok(split.x.every((x,i)=>split.sp[i]===0?x<260:x>260));
split.barrier=null;for(let i=0;i<1200;i++)G.step(split,G.safeDt(split));
assert.ok(split.x.some((x,i)=>split.sp[i]===0&&x>260));
assert.ok(split.x.some((x,i)=>split.sp[i]===1&&x<260));

near(G.idealP(.015,300,.002)*.002,G.idealP(.015,300,.0006)*.0006);
near(G.idealP(.015,600,.0012)/600,G.idealP(.015,300,.0012)/300);
near(G.vRms3D(300,4)/G.vRms3D(300,40),Math.sqrt(10));
near(G.Tof(G.kTof(800)),800);

globalThis.document={createElement:()=>({getContext:()=>null})};let numeric=0;
const finite=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));numeric++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:finite});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createGasLab(),cfg={gasA:'N2',gasB:'CO2',N:140,T:300,V:2,bigM:50,bigR:14,colorSpeed:true,trace:true,hideSmall:false};
const gas=G.createWorld({W:400,H:300,rand:G.mulberry(4)});G.addParticles(gas,250,{r:2.2,kT:G.kTof(300)});
const brown=G.createWorld({W:480,H:280,rand:G.mulberry(7)});G.addParticles(brown,320,{r:2.2,kT:G.kTof(800)});G.addBig(brown,{r:24,m:200,kT:G.kTof(800)});
const meas={trace:[[50,60],[100,80]],btrace:[[100,100,0],[150,140,.1]],b0:{x:240,y:140}};
for(const width of [375,850])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.12,.5,1.3]){
  Object.assign(scene.lab.camera,{yaw,pitch,zoom:1});
  const stage={w:width,h:320,colors};
  for(const proc of ['T','p','V']){
    scene.draw(ctx,stage,{mode:'gas',proc},cfg,gas,meas,{V:2,T:300,p:20000,pMax:200000});
    for(const V of [.6,1,2]){const p=scene.lab.project(scene.pistonPoint(V));assert.ok(Math.abs(scene.volume(p)-V)<.004);}
  }
  for(const barrier of [260,null]){split.barrier=barrier;scene.draw(ctx,stage,{mode:'diff'},cfg,split,meas,{T:300});}
  for(const hideSmall of [false,true]){
    scene.draw(ctx,stage,{mode:'brown'},{...cfg,N:320,bigM:200,bigR:24,hideSmall},brown,meas,{T:800});
    const world={x:120,y:210},p=scene.lab.project(scene.worldPoint(world.x,world.y)),q=scene.modelPoint(p);
    if(q){near(q.x,world.x);near(q.y,world.y);}
    assert.equal(scene.worldPoint(world.x,world.y)[2],0,'collision centres remain in the actual model layer');
  }
}
assert.ok(numeric>100000);
console.log('Gas 3D: elastic energy/momentum, moving-piston work, diffusion barrier/mixing, gas laws, every apparatus/angle/size, planar collision layer and orbital control inverses passed.');
