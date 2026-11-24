import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/density-physics.js';
import { createDensityLab, cylinderY, weightTrayPoint } from '../../../assets/js/simulations/density-lab-3d.js';

const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
// The small 4 cm³ specimen is two divisions, while the 9 cm³ specimen exposes rounding error.
near(P.readCylinder(100+4)-P.readCylinder(100),4);
near(P.readCylinder(100+9)-P.readCylinder(100),10);
for(const V1 of [40,100,140])for(const V of [4,9,10,20,30,48])near(cylinderY(V1+V)-cylinderY(V1),V*3/250);
for(const [rhoL,rhoBody]of [[1,.5],[1,.9],[1.2,1.05],[13.6,7.8]]){
  const cfg={m:rhoBody*80,A:16,H:5,rhoL},d=P.floatDepth(cfg);
  near(d/5,rhoBody/rhoL);near(P.buoyancy({...cfg,d}).FA,P.weight(cfg.m));near(P.springReading({...cfg,d}),0);
}
const alu={m:2.7*80,A:16,H:5,rhoL:1};
near(P.springReading({...alu,d:0}),2.11896);
near(P.springReading({...alu,d:5}),1.33416);

globalThis.document={createElement:()=>({getContext:()=>null})};let numeric=0,curves=[],texts=[];
const check=(...args)=>{for(const x of args)if(typeof x==='number'){assert.ok(Number.isFinite(x),`finite coordinate ${x}`);numeric++;}};
const ctx=new Proxy({
  measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}}),
  quadraticCurveTo:(...args)=>{check(...args);curves.push(args);},fillText:(text,...args)=>{texts.push(text);check(...args);},
},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const bodies={
 cu:{shape:'cyl',mat:'copper',m:89,V:10,name:'Mis silindr'},al:{shape:'box',mat:'alu',m:54,V:20,name:'Alyuminiy'},
 st:{shape:'ball',mat:'steel',m:31.2,V:4,name:'Po‘lat sharcha'},gr:{shape:'rock',mat:'granite',m:78,V:30,name:'Granit'},
 zn:{shape:'rock',mat:'zinc',m:63.9,V:9,name:'Rux'},unk:{shape:'cyl',mat:'lead',m:113,V:10,name:'Noma’lum'},wd:{shape:'box',mat:'wood',m:24,V:48,name:'Yog‘och'},
};
const scene=createDensityLab(),mass={body:'cu',pan:[],th:0},dens={body:'cu',V1:100,inCyl:false,drop:0},fl={mat:'alu',liq:'water',d:3,free:false,y:0};
const cfg=(state=fl)=>({m:P.MATERIALS[state.mat].rho*80,A:16,H:5,rhoL:P.LIQUIDS[state.liq].rho,d:state.free?state.y:Math.min(state.d,P.floatDepth({m:P.MATERIALS[state.mat].rho*80,A:16,H:5,rhoL:P.LIQUIDS[state.liq].rho})??state.d)});
for(const width of [375,850])for(const yaw of [-Math.PI,-.25,0,Math.PI/2,Math.PI])for(const pitch of [.12,.5,1.3]){
  const st={w:width,h:320,colors};scene.lab.camera.yaw=yaw;scene.lab.camera.pitch=pitch;
  for(const body of ['cu','st','gr'])for(const pan of [[],[1,2,5,6,8]]){
    const state={...mass,body,pan,th:P.balanceAngle(P.sumWeights(pan.map(i=>P.WEIGHTS[i]))-bodies[body].m)};
    scene.draw(ctx,st,{mode:'mass'},state,dens,fl,bodies,cfg());
    const p=scene.lab.project([-1.35+1.14*Math.cos(state.th),2.6+1.14*Math.sin(state.th)-1.18,0]);
    assert.ok(scene.inPan(p),'right pan remains a drop target after orbit');
  }
  for(const body of Object.keys(bodies))for(const inCyl of [false,true]){
    const state={...dens,body,inCyl,V1:body==='wd'?140:100};curves=[];texts=[];
    scene.draw(ctx,st,{mode:'dens'},mass,state,fl,bodies,cfg());
    assert.ok(scene.inCylinder(scene.lab.project([.15,1.8,0])),'cylinder drop hull includes its center');
    assert.ok(!scene.inCylinder({x:-1000,y:-1000}),'drag outside removes the specimen');
    for(const V1 of [40,100,140]){const p=scene.lab.project([.73,cylinderY(V1+(inCyl?bodies[body].V:0)),-.08]);near(scene.water(p),V1,.004);}
    assert.ok(texts.includes('Lupa · 2 mL'));
    const lh=width<560?134:158,cy=40+lh/2+6,last=curves.at(-1);
    near((cy-5+2*last[1]+last[3])/4,cy); // actual quadratic midpoint = calibrated meniscus bottom
  }
  for(const [mat,liq,d,free]of [['alu','water',0,false],['alu','kerosene',8,false],['wood','water',5,false],['ice','water',0,true],['egg','salt',5,true],['steel','mercury',10,true]]){
    const state={...fl,mat,liq,d,free,y:d};
    scene.draw(ctx,st,{mode:'float'},mass,dens,state,bodies,cfg(state));
    for(const depth of [0,.7,3,8]){const p=scene.lab.project(scene.floatPoint(depth));near(scene.depth(p),depth,.04);}
  }
}
// Every case weight has its own selectable solid at the initial laboratory view.
scene.lab.reset();scene.draw(ctx,{w:850,h:320,colors},{mode:'mass'},mass,dens,fl,bodies,cfg());
for(let i=0;i<P.WEIGHTS.length;i++){
  const p=weightTrayPoint(i),wg=P.WEIGHTS[i],height=wg>=1?.08+.035*Math.cbrt(wg):.018;p[1]+=height*.5;
  const q=scene.lab.project(p);assert.equal(scene.lab.hit(q.x,q.y),'weight-'+i);
}
assert.ok(numeric>100000);
console.log('Density 3D: volume calibration, 2 mL meniscus, buoyancy, all specimen/liquid modes, weight selection and pan/cylinder/depth drags after orbit passed.');
