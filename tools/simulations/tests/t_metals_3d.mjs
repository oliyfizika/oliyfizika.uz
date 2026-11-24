import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/metals-physics.js';
import {createMetalsLab,gatePoint,rheostatPoint,temperaturePoint} from '../../../assets/js/simulations/metals-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
for(const m of Object.values(P.METALS)){
 if(m.n)for(const I of [.2,2,10])for(const S of [.25e-6,1e-6,4e-6]){const v=P.driftSpeed(I,m.n,S);near(P.currentFrom(m.n,S,v),I);near(P.currentDensity(I,S),P.E*m.n*v);}
 near(P.rhoAt(m,20),m.rho20);near(P.alphaFrom(P.rhoAt(m,0),0,P.rhoAt(m,300),300),m.alpha);assert.ok(P.rhoAt(m,300)>P.rhoAt(m,20));
}
near(P.mercuryR(10,4.1),0);assert.ok(P.mercuryR(10,4.2)>0);near(P.thermalSpeed(4*293),2*P.thermalSpeed(293));
globalThis.document={createElement:()=>({getContext:()=>null})};let checks=0;const check=(...args)=>args.forEach(v=>{if(typeof v==='number'){assert.ok(Number.isFinite(v));checks++;}});
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createMetalsLab(),drift={I:2,S:1e-6,on:true},dens={I:3,S1:2e-6,S2:.5e-6,gate:15},rt={t:20,T:4.6};let sc=false,metal=P.METALS.copper;
const electrons=Array.from({length:80},(_,i)=>({x:i/80,y:(Math.sin(i)+1)/2,u:Math.sin(i)}));const helpers={parts:()=>[{x0:0,x1:10,S:dens.S1},{x0:10,x1:20,S:dens.S2},{x0:20,x1:30,S:dens.S1}],SAt:x=>x>=10&&x<=20?dens.S2:dens.S1,measuredI:()=>3,isSC:()=>sc,RofT:t=>10*P.rhoAt(metal,t)/metal.rho20,tMax:()=>metal.tMax,glow:()=>null,mercuryR:()=>P.mercuryR(10,rt.T)};
for(const w of [375,850])for(const yaw of [-Math.PI,-.7,0,.7,Math.PI])for(const pitch of [.1,.5,1.3]){
 Object.assign(scene.lab.camera,{yaw,pitch});const stage={w,h:320,colors};
 for(const mode of ['drift','dens','rt']){
  scene.draw(ctx,stage,{mode},drift,dens,rt,electrons,metal,helpers,1);
  for(const [id,point,value,tol]of [['rheo',rheostatPoint(2),2,.025],['gate',gatePoint(15),15,.07],['temp',temperaturePoint(.5),.5,.003]]){const p=scene.lab.project(point);near(scene.parameter(id,p),value,tol);}
 }
 for(const S of [.25e-6,4e-6]){dens.S1=S;dens.S2=S===4e-6?.25e-6:4e-6;scene.draw(ctx,stage,{mode:'dens'},drift,dens,rt,electrons,metal,helpers);}
 for(const temp of [-100,2500]){metal=P.METALS.tungsten;rt.t=temp;scene.draw(ctx,stage,{mode:'rt'},drift,dens,rt,electrons,metal,helpers);}
 sc=true;for(const T of [3,4.15,6]){rt.T=T;scene.draw(ctx,stage,{mode:'rt'},drift,dens,rt,electrons,metal,helpers);}sc=false;
}
assert.ok(checks>10000);console.log('Metals 3D: current continuity/drift, temperature coefficient, superconducting transition, all apparatus/extremes and projected handles passed.');
