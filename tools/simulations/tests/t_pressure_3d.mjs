import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/pressure-physics.js';
import {createPressureLab,sensorPoint,levelPoint,oilPoint,pressPoint,ballPoint} from '../../../assets/js/simulations/pressure-lab-3d.js';

const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
for(const face of Object.values(P.FACES))for(const extra of [0,6,12]){
  const F=P.weightN(P.BRICK.m+extra);near(P.pressure(F,face.S)*face.S,F);
}
near(P.pressure(1,P.OBJECTS.needle.S),1e8);
assert.ok(P.pressure(P.weightN(60),P.OBJECTS.skis.S)<P.pressure(P.weightN(60),P.OBJECTS.boots.S));
for(const S1 of [1,2,20])for(const S2 of [20,100,500])for(const M of [10,200,2000])for(const s1 of [0,6,20]){
  const F1=P.forceToLift(M,S1*1e-4,S2*1e-4),F2=P.weightN(M),s2=P.pressLift(s1,S1,S2);
  near(F1/(S1*1e-4),F2/(S2*1e-4));near(F1*s1,F2*s2);
}
for(const liq of Object.values(P.LIQUIDS))for(const h of [0,.3,.8]){
  near(P.hydro(liq.rho,h,true)-P.hydro(liq.rho,h),P.P0);
  // An open water manometer measures the gauge pressure; atmosphere cancels.
  const dh=P.hydro(liq.rho,h)/(1000*P.G);near(dh,liq.rho/1000*h);
}
for(const oil of [0,.1,.2]){
  const u=P.uTube(1000,930,oil),wl=.2-u.x,wr=.2+u.x;
  near(wl+wr,.4);near(930*oil,1000*(wr-wl));assert.ok(wl>=0&&wl+oil<.4);
}
near(P.jetSpeed(P.pistonPressure(50,.001)),10);

globalThis.document={createElement:()=>({getContext:()=>null})};
let numeric=0;
const finite=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));numeric++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:finite});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createPressureLab(),ui={mode:'solid'},solid={obj:'brick',face:'flat',extra:0},pas={view:'press',S1:2,S2:100,M:200,s1:6,F:50},flu={view:'depth',liq:'water',h:.3,x:.5,atm:false,rot:0,level:.18,oil:.1};
for(const width of [375,800])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI]){
  const stage={w:width,h:320,colors};Object.assign(scene.lab.camera,{yaw,pitch:.35,zoom:1});
  for(const obj of ['brick',...Object.keys(P.OBJECTS)])for(const extra of obj==='brick'?[0,12]:[0])for(const face of obj==='brick'?Object.keys(P.FACES):['flat'])
    scene.draw(ctx,stage,ui,{obj,extra,face},pas,flu);
  for(const [S1,S2,M,s1]of [[1,20,10,0],[2,100,200,6],[20,20,2000,20],[1,500,1200,20]])
    scene.draw(ctx,stage,{mode:'pascal'},solid,{...pas,S1,S2,M,s1},flu);
  for(const F of [0,50,100])scene.draw(ctx,stage,{mode:'pascal'},solid,{...pas,view:'ball',F},flu);
  for(const liq of Object.keys(P.LIQUIDS))for(const h of [0,.8])for(const atm of [false,true])for(const rot of [0,Math.PI/2])
    scene.draw(ctx,stage,{mode:'fluid'},solid,pas,{...flu,liq,h,atm,rot});
  for(const level of [.05,.3])for(const oil of [0,.2])scene.draw(ctx,stage,{mode:'fluid'},solid,pas,{...flu,view:'vessels',level,oil});
  // A horizontal sensor position does not change measured hydrostatic pressure.
  scene.draw(ctx,stage,{mode:'fluid'},solid,pas,flu);
  for(const [h,x]of [[0,0],[.3,.5],[.8,1]]){
    const p=scene.lab.project(sensorPoint(h,x)),v=scene.probe(p.x,p.y);
    if(v){near(v.h,h);near(v.x,x);}
  }
  for(const [id,pointAt,value]of [['knob',pressPoint,6],['ball',ballPoint,50],['oil',oilPoint,.1]]){
    const p=scene.lab.project(pointAt(value));near(scene.parameter(id,p),value,.001);
  }
  const p=scene.lab.project(levelPoint(.18));const restored=scene.parameter('level',p);if(restored!==null)near(restored,.18);
}
assert.ok(numeric>100000);
console.log('Pressure 3D: contact pressure, hydraulic work/area ratios, gauge vs absolute pressure, communicating liquids, all apparatus modes/extremes and orbital drag inverses passed.');
