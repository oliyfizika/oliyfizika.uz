import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/heat-physics.js';
import {createHeatLab} from '../../../assets/js/simulations/heat-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t*Math.max(1,Math.abs(b)),`${a}≈${b}`);
const W=P.SUBSTANCES.water;
const eq=P.equilibrium([{s:W,m:.3,h0:P.hOf(W,20)},{s:W,m:.2,h0:P.hOf(W,80)}]);near(eq.T,44);
const ice=P.equilibrium([{s:W,m:.2,h0:P.hOf(W,20)},{s:W,m:.3,h0:P.hOf(W,-10)}]);near(ice.T,0);assert.ok(ice.plateau);
for(const s of Object.values(P.SUBSTANCES))for(const T of [-20,s.tm-1,s.tm+5])near(P.TOf(s,P.hOf(s,T)),T);
const bodies=[{s:W,m:.3,h:P.hOf(W,20),K:600},{s:P.SUBSTANCES.aluminium,m:.2,h:P.hOf(P.SUBSTANCES.aluminium,100),K:100}];
const energy=()=>bodies.reduce((v,b)=>v+b.m*b.h,0),E0=energy();for(let i=0;i<1000;i++)P.stepMix(bodies,.01);near(energy(),E0,1e-9);
const b={s:W,m:.5,h:P.hOf(W,0)};P.stepHeat(b,1000,10);near(b.h,20000);
globalThis.document={createElement:()=>({getContext:()=>null})};let count=0;
const check=(...args)=>{for(const x of args)if(typeof x==='number'){assert.ok(Number.isFinite(x));count++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createHeatLab();
for(const width of [375,900])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.12,.6,1.3]){
  Object.assign(scene.lab.camera,{yaw,pitch});const stage={w:width,h:320,colors};
  for(const kind of ['water','ice','steam','aluminium','unknown'])for(const drop of [0,.5,1]){
    const metal=kind==='aluminium'||kind==='unknown',s=metal?P.SUBSTANCES.aluminium:W,branch=metal||kind==='ice'?'solid':kind==='steam'?'gas':'liquid',T=branch==='gas'?100:branch==='solid'?kind==='ice'?-10:100:80;
    const cfg=[{m:.3,t:20},{m:metal?.2:.05,t:T,kind}],body0={i:0,s:W,m:.3,h:P.hOf(W,20),kind:{branch:'liquid',tMin:0,tMax:100},label:'Suv',cfg:{kind:'water'},color:'#64748b'};
    const hb=kind==='steam'?P.hOf(W,101)-W.cg: P.hOf(s,T);
    const mix={cfg,bodies:[body0,{i:1,s,sub:metal?'aluminium':'water',m:cfg[1].m,h:hb,kind:{branch,metal,tMin:branch==='solid'?-40:0,tMax:metal?400:150},label:kind,cfg:cfg[1],color:'#64748b'}],t:10,started:drop>0,drop,done:false,reveal:false};
    scene.draw(ctx,stage,{mode:'mix'},mix,{},3);
  }
  for(const sub of ['water','aluminium','wax'])for(const src of ['electric','fuel'])for(const fuel of ['alcohol','wood']){
    const s=P.SUBSTANCES[sub];for(const h of [P.hOf(s,-20),s.lambda*.5,s.lambda+s.cl*10])scene.draw(ctx,stage,{mode:'heat'},{},{body:{s,m:.5,h},cfg:{sub,m:.5,src,fuel,P:1000,rate:3},started:true,on:true,done:false,t:10},4);
  }
}
assert.ok(count>100000);console.log('Heat 3D: enthalpy/equilibrium/energy conservation, every source/body/phase, transfer stages and 30 orbital views passed.');
