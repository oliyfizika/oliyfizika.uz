import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/induction-physics.js';
import {createInductionLab,magnetPoint} from '../../../assets/js/simulations/induction-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
const coil={N:200,m:1,a:.02,len:.06},x=.04,dx=1e-7,v=.7;
const derivative=(P.coilLinkage(coil,x+dx).psi-P.coilLinkage(coil,x-dx).psi)/(2*dx);
near(P.faraday(coil,x,v,10).emf,-derivative*v,1e-6);
near(P.faraday(coil,x,0,10).emf,0);near(P.faraday(coil,x,-v,10).emf,-P.faraday(coil,x,v,10).emf);
const gp={N:100,B:.2,S:.005,omega:4*Math.PI};
near(P.generatorEmf(gp,0),0);near(P.generatorEmf(gp,.125),P.emfMax(gp));
assert.ok(P.generatorEmf({...gp,commutator:true},.375)>=0);
const st={i2:0},rp={E:6,R1:30,R2:12,L:3,closed:true};
near(P.rlStep(st,rp,.2).i2,P.rlRise(6,12,3,.2));
const i0=st.i2,o=P.rlStep(st,{...rp,closed:false},.1);
near(o.i2,P.rlFall(i0,42,3,.1));near(o.i1,-o.i2);assert.ok(P.magEnergy(3,o.i2)<P.magEnergy(3,i0));

globalThis.document={createElement:()=>({getContext:()=>null})};let nums=0;
const finite=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));nums++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:finite});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createInductionLab(),fd={x:-.13,N:200,a:.02,len:.06,v:1,vel:1,flip:false,t:.3},gen={n:2,N:100,B:.2,S:50,R:20,comm:false,t:.3},self={E:6,L:3,R:20,closed:false,core:true,out:{i1:-.1,i2:.1},t:.3,spark:1};
const helpers={fdState:P.faraday(coil,.04,1,10),peakI:1,genP:gp,Rlamp:10};
for(const w of [375,850])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.15,.6,1.3]){
 Object.assign(scene.lab.camera,{yaw,pitch});const stage={w,h:320,colors};
 for(const flip of [false,true]){scene.draw(ctx,stage,{mode:'faraday'},{...fd,flip},gen,self,helpers);for(const x of [-.145,-.03,0,.145]){const p=scene.lab.project(magnetPoint(x));assert.ok(Math.abs(scene.parameter('magnet',p)-x)<.001);}}
 for(const comm of [false,true])for(const S of [10,50,200])scene.draw(ctx,stage,{mode:'gen'},fd,{...gen,S,comm},self,helpers);
 for(const core of [false,true])for(const closed of [false,true])scene.draw(ctx,stage,{mode:'self'},fd,gen,{...self,core,closed},helpers);
}
assert.ok(nums>100000);console.log('Induction 3D: Faraday derivative/polarity, generator phase/rectification, RL rise/fall energy, all apparatus branches/extremes and magnet inverse passed.');
