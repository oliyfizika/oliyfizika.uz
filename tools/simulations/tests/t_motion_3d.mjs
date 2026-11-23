import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/motion-physics.js';
import {createMotionLab} from '../../../assets/js/simulations/motion-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
const A=P.body({x0:0,v0:10,a:0}),B=P.body({x0:120,v0:-5,a:0});
near(P.meetTime(A,B,10),8);near(A.state(8).x,B.state(8).x);
const brake=P.body({x0:0,v0:15,a:-3,stop:true});
near(brake.state(10).v,0);near(brake.state(10).s,37.5);
const round=P.piecewise({x0:40,nodes:[10,10,0,-10,-10],dt:2,shape:'step'});
near(round.state(10).x,40);near(round.state(10).s,80);
const expanded=P.piecewise({x0:100,nodes:[20,20,20,20,20,20],dt:2,shape:'lin'});
near(expanded.state(10).x,300);
globalThis.document={createElement:()=>({getContext:()=>null})};
let count=0;
const finite=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));count++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:finite});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createMotionLab();
for(const width of [375,850])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.12,.5,1.3]){
  Object.assign(scene.lab.camera,{yaw,pitch,zoom:1});
  for(const mode of ['uni','acc','pw'])for(const t of [0,4,10]){
    const models=mode==='pw'?{A:expanded,B:null}:mode==='acc'?{A:brake,B:P.body({x0:0,v0:0,a:2})}:{A,B};
    const ui={mode,show:{dots:true,ghost:true}},sim={t,T:10},win=mode==='pw'?[-10,310]:[-10,160];
    scene.draw(ctx,{w:width,h:320,colors},ui,models,sim,mode==='uni'?{t:8,x:80}:null,win,{A:1,B:-1},t>0);
    near(scene.roadX(win[1])-scene.roadX(win[0]),5.4);
    const car=scene.lab.project(scene.carPoint('A',50));near(scene.parameter('A:car',car),50,.006);
    for(const part of ['v','a'])for(const val of part==='v'?[-15,0,20]:[-4,0,4]){
      const pt=scene.lab.project(scene.vectorPoint('A',part,val));
      assert.ok(Math.abs(scene.parameter(`A:${part}`,pt)-val)<(part==='v'?.08:.018));
    }
    if(mode==='uni')near(scene.carPoint('A',models.A.state(8).x)[0],scene.carPoint('B',models.B.state(8).x)[0]);
  }
}
assert.ok(count>100000);
console.log('Motion 3D: meeting, braking, signed piecewise path, expanded road window, every mode/time/angle/size and scene drag inverses passed.');
