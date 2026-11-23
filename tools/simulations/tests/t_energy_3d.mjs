import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as P from '../../../assets/js/simulations/energy-physics.js';
import {createEnergyLab,PULL_RAIL_END} from '../../../assets/js/simulations/energy-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
const f=P.pullForces({M:20,F:60,alpha:Math.PI/6,mu:.2,v:1});
near(f.N,20*P.G-30);near(f.f,.2*f.N);near(f.a,(60*Math.cos(Math.PI/6)-f.f)/20);
assert.equal(P.pullForces({M:20,F:0,alpha:0,mu:.5}).a,0);
assert.equal(P.pullForces({M:5,F:150,alpha:Math.PI/3,mu:.5}).N,0);
// Even the heaviest crate clears a 6 m finish before its leading face reaches the rail end.
// A former mobile-only 6.4 m boundary stopped it before the finish.
for(const mass of [5,20,40])assert.ok(6+.6*Math.cbrt(mass/20)<PULL_RAIL_END);
near(P.liftSpeed(1000,50),2*P.liftSpeed(500,50));
near((10/P.liftSpeed(500,50))/(10/P.liftSpeed(1000,50)),1000/500);
near(P.launchHeight(200,.08,.2),.3261977574);
near(P.launchHeight(200,.1,.2)/P.launchHeight(200,.05,.2),4);
// Energy conservation and conversion to heat along the actual spline track.
const points=[[0,6],[2.5,1.4],[6,.3],[9.5,1.4],[12,6]],tr=P.makeTrack(points);
for(const mu of [0,.08]){
  let s={s:.35,v:0,Q:0},initial=P.G*tr.at(s.s).y;
  for(let i=0;i<5000;i++)s=P.skateStep(tr,s,.002,mu);
  // Existing spline time integrator drifts 1.06% over these 10 seconds.
  near(.5*s.v*s.v+P.G*tr.at(s.s).y+s.Q,initial,.012);
  if(mu)assert.ok(s.Q>1);else assert.equal(s.Q,0);
}
// For an energetic launch, the integrated apex matches the analytic height.
for(const [k,m,x]of [[200,.2,.08],[450,.1,.1],[500,.5,.15]]){
  let s={y:-x,v:0},max=s.y;
  for(let i=0;i<30000;i++){s=P.springBallStep(s,.0001,k,m);max=Math.max(max,s.y);if(s.v<0&&max>0)break;}
  near(max+x,P.launchHeight(k,x,m),.001);
}
// No invalid geometry at parameter extremes, in flight or from any camera angle.
globalThis.document={createElement:()=>({getContext:()=>null})};let numeric=0;
const check=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));numeric++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#888888']));
const scene=createEnergyLab(),pull={F:60,alpha:Math.PI/6,M:20,mu:.2,s:4,x:0,v:0,t:0,phase:'ready',AF:0,Af:0};
const lift={P1:500,P2:1000,m:50,h:10,y1:0,y2:0,t:0,t1:null,t2:null,phase:'ready'};
const park={tr,pts:points,m:50,g:P.G,mu:0,yref:0,s:.35,v:0,Q:0,Emax:3000,trail:[]};
const spr={k:200,m:.2,x:.08,y:-.08,v:0,t:0,ymax:-1,phase:'ready'};
for(const width of [375,800])for(const yaw of [-.5,0,Math.PI/2,Math.PI,Math.PI*1.5]){
  scene.lab.camera.yaw=yaw;
  const stage={w:width,h:340,colors};
  for(const phase of ['ready','run','coast','done','stuck'])scene.draw(ctx,stage,{mode:'work',sub:'pull',show:{vec:true}},{...pull,phase,F:phase==='ready'?0:150,M:40,v:2,AF:120,Af:-50},lift,park,spr);
  for(const phase of ['ready','run','done'])scene.draw(ctx,stage,{mode:'work',sub:'lift',show:{vec:true}},pull,{...lift,phase,y1:2,y2:10,t:4,t2:4},park,spr);
  for(const yref of [-.5,6.5])scene.draw(ctx,stage,{mode:'park',show:{vec:true}},pull,lift,{...park,yref,v:-8,Q:20,trail:[[0,6],[1,3]]},spr);
  for(const state of [spr,{...spr,k:50,m:.5,x:.01,y:-.01},{...spr,k:500,m:.1,x:.15,y:4,v:-5,phase:'run',ymax:5}])scene.draw(ctx,stage,{mode:'spring',show:{vec:true}},pull,lift,park,state);
}
assert.ok(numeric>100000);
// All track buttons correspond to defined tracks, including the formerly broken ramp.
const html=await readFile(new URL('../../../simulations/energy.html',import.meta.url),'utf8'),controller=await readFile(new URL('../../../assets/js/simulations/energy.js',import.meta.url),'utf8');
for(const [,track]of html.matchAll(/data-track-value="([^"]+)"/g))assert.match(controller,new RegExp(`\\b${track}: \\[`));
console.log('Energy 3D: forces, lift ratio, spring apex, spline energy + heat, track controls and every 3D mode/angle/size passed.');
