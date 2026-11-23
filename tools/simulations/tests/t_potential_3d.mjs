import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/potential-physics.js';
import {createPotentialLab,fieldPoint,platePoint} from '../../../assets/js/simulations/potential-lab-3d.js';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
const charges=[{x:0,y:0,q:3e-9}];near(P.potential(charges,.1,0),P.K*3e-8);near(P.field(charges,.1,0).ex,P.K*3e-7);
const path=Array.from({length:1001},(_,i)=>({x:.06+i*.00012,y:.08+Math.sin(i*Math.PI/1000)*.03}));near(P.workAlongPath(charges,1e-9,path),P.workBetween(1e-9,P.potential(charges,.06,.08),P.potential(charges,.18,.08)),1e-10);
for(const eps of [1,2.1,6,7])for(const S of [.005,.02,.04]){
 const a=P.capState({S,d:.002,eps,connected:true,U0:100}),b=P.capState({S,d:.004,eps,connected:true,U0:100}),iso=P.capState({S,d:.004,eps,connected:false,U0:100,q0:a.q});near(a.C/b.C,2);near(a.W/b.W,2);near(iso.q,a.q);near(iso.U/a.U,2);near(iso.E,a.E);near(iso.W/a.W,2);
}
for(const kind of ['par','ser','mix']){const n=P.network(kind,[10e-6,20e-6,30e-6],12);near(n.items.reduce((s,p)=>s+.5*p.C*p.U*p.U,0),.5*n.Ceq*144);if(kind==='ser')near(n.items[0].q,n.items[2].q);if(kind==='mix')near(n.items[0].q,n.items[1].q+n.items[2].q);}
const rc=P.rcCharge(40e-6,50e3,12,2);near(rc.q/(40e-6*12),1-Math.exp(-1));near(P.rcDischarge(40e-6,50e3,rc.q,2).q,rc.q/Math.E);
globalThis.document={createElement:()=>({getContext:()=>null})};let checks=0;const check=(...args)=>args.forEach(v=>{if(typeof v==='number'){assert.ok(Number.isFinite(v));checks++;}});
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createPotentialLab(),fld={charges:[{x:-6,y:0,q:2},{x:6,y:0,q:-2}],sel:0,test:{x:0,y:7},A:{x:-12,y:7},path:[]},cap={S:200,d:3,eps:7,U0:100,conn:true,q0:0},net={kind:'par',C:[10,20,30],R:50,E:12,sw:1,Q:.0001,t:1};
const si=()=>fld.charges.map(q=>({x:q.x/100,y:q.y/100,q:q.q*1e-9}));const helpers={phiAt:(x,y)=>P.potential(si(),x/100,y/100),EAt:(x,y)=>P.field(si(),x/100,y/100),capNow:()=>P.capState({S:cap.S*1e-4,d:cap.d*1e-3,eps:cap.eps,connected:cap.conn,U0:cap.U0,q0:cap.q0}),netCharges:()=>{const cs=net.C.map(v=>v*1e-6),ceq=P.network(net.kind,cs,1).Ceq;return P.network(net.kind,cs,net.Q/ceq).items;}};
for(const w of [375,850])for(const yaw of [-Math.PI,-.7,0,.7,Math.PI])for(const pitch of [.1,.5,1.3]){
 Object.assign(scene.lab.camera,{yaw,pitch});const stage={w,h:320,colors};
 for(const mode of ['field','cap','net']){
  scene.draw(ctx,stage,{mode,show:{map:true,eq:true,lines:true}},fld,cap,net,helpers);
  for(const [id,x,y,z]of [['q0',-6,0,0],['test',0,7,-.08]]){const p=scene.lab.project(fieldPoint(x,y,z)),q=scene.modelPoint(p,id);if(q){near(q.x,x);near(q.y,y);}}
 }
 for(const d of [1,10]){cap.d=d;scene.draw(ctx,stage,{mode:'cap'},fld,cap,net,helpers);const p=scene.lab.project(platePoint(d));near(scene.parameter('plate',p),d);}
 for(const kind of ['par','ser','mix']){net.kind=kind;for(const sw of [1,2]){net.sw=sw;scene.draw(ctx,stage,{mode:'net'},fld,cap,net,helpers);}}
}
assert.ok(checks>10000);console.log('Potential 3D: Coulomb/work, connected/isolated capacitor invariants, all network topologies, RC, field slice and projected drags passed.');
