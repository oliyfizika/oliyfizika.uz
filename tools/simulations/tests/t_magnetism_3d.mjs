import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/magnet-physics.js';
import {createMagnetismLab,fieldPoint} from '../../../assets/js/simulations/magnetism-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
const w1={type:'wire',x:.16,y:.12,I:15},w2={type:'wire',x:.24,y:.12,I:15};
const cmp=P.compile([w1,w2]),force=P.forceOnWire(cmp,w1,0);
assert.ok(force[0]>0);near(force[1],0);near(force[0],P.parallelForce(15,15,.08),1e-5);
assert.ok(P.forceOnWire(P.compile([w1,{...w2,I:-15}]),w1,0)[0]<0);
const bw=P.field(P.compile([{type:'wire',x:0,y:0,I:10}]),.1,0);near(bw[0],0);assert.ok(bw[1]>0);
near(P.ampereForce(.2,5,.1,Math.PI/2),.1);near(P.ampereForce(.2,5,.1,0),0);
near(Math.tan(P.swingAngle(.1,.02)),.1/(.02*9.81));
const rail={x:0,v:0,work:0};for(let i=0;i<100;i++)P.railStep(rail,{B:.3,I:5,l:.1,m:.02,mu:0},.001);
near(rail.work,.3*5*.1*rail.x);near(rail.work,.5*.02*rail.v**2);
const frame={phi:Math.PI/2,omega:0};P.frameStep(frame,{N:50,B:.2,I:2,S:.004,J:.002,k:0,commutator:false},.001);assert.ok(frame.omega<0);

globalThis.document={createElement:()=>({getContext:()=>null})};let nums=0;
const finite=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));nums++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:finite});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createMagnetismLab(),objs=[{type:'magnet',x:.15,y:.12,angle:0,len:.08,width:.02,q:20},w1,{type:'coil',x:.3,y:.12,angle:.5,len:.12,diam:.045,N:200,I:2,core:true,mu:50},{type:'compass',x:.2,y:.2,ang:1.3}],amp={setup:'swing',I:5,B:.2,l:.1,alpha:90,m:20,th:.3,rail:{x:.2,v:1},t:.2},frm={I:2,B:.2,N:50,S:40,commutator:true,st:{phi:1.2,omega:-3,Ieff:2},t:.3};
const comp=P.compile(objs),data={lines:[{pts:Array.from({length:60},(_,i)=>[.02+i*.005,.2]),mid:25}],filings:[[.1,.1,.5,.8]],heat:{nx:4,ny:4,g:new Float32Array(16).fill(.001)},Bat:(x,y)=>P.field(comp,x,y),inside:()=>false,ampF:.1,force:o=>P.forceOnWire(comp,o,objs.indexOf(o))};
for(const w of [375,850])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.15,.6,1.3]){
 Object.assign(scene.lab.camera,{yaw,pitch});const stage={w,h:320,colors};
 for(const view of ['lines','filings','grid'])scene.draw(ctx,stage,{mode:'field',view,heat:true,earth:true,forces:true},objs,0,amp,frm,data);
 const at={x:.13,y:.09},p=scene.lab.project(fieldPoint(at.x,at.y)),q=scene.modelPoint(p);if(q){near(q.x,at.x);near(q.y,at.y);}
 for(const setup of ['swing','rail'])for(const alpha of [0,90])scene.draw(ctx,stage,{mode:'ampere'},objs,0,{...amp,setup,alpha},frm,data);
 for(const commutator of [false,true])for(const S of [10,40,100])scene.draw(ctx,stage,{mode:'frame'},objs,0,amp,{...frm,S,commutator},data);
}
assert.ok(nums>100000);console.log('Magnetism 3D: field/current/force signs, pendulum equilibrium, rail work/energy, motor torque, all scenes/views/extremes and horizontal-plane inverse passed.');
