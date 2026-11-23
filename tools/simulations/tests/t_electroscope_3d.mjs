import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/electroscope-physics.js';
import {createElectroscopeLab,scopePoint} from '../../../assets/js/simulations/electroscope-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
near(P.electrons(1.602),1e10);
for(const pr of Object.values(P.PAIRS)){
 let rod=0,cloth=0;for(let n=0;n<30;n++){const dq=P.rubStep(cloth,.06,pr);rod+=dq;cloth-=dq;near(rod+cloth,0);}assert.ok(Math.abs(rod-pr.sign*pr.qmax)<.1);
}
for(const q of [-36,0,36])for(const Q of [-20,0,20]){const r=P.touch(q,Q);near(r.q+r.Q,q+Q);}
for(const [a,b,e1,e2]of [[16,0,0,0],[12,-12,0,0],[20,-6,3,-2]]){const [x,y]=P.share(a,b,e1,e2);near(x+y,a+b);near(x+e1,y+e2);}
for(const q of [.1,1,3,10]){const th=P.leafAngle(q);near(P.leafAngle(-q),th);near(P.leafForce(q,th),P.SCOPE.m*P.G*Math.tan(th));assert.ok(P.leafAngle(q*2)>=th);}
near(P.distribute(P.groundedQ(9),9).leaf,0);
globalThis.document={createElement:()=>({getContext:()=>null})};let checks=0;
const check=(...args)=>args.forEach(v=>{if(typeof v==='number'){assert.ok(Number.isFinite(v));checks++;}});
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createElectroscopeLab();
for(const w of [375,850])for(const yaw of [-Math.PI,-.7,0,.7,Math.PI])for(const pitch of [.1,.5,1.3]){
 Object.assign(scene.lab.camera,{yaw,pitch});const stage={w,h:320,colors};
 for(const mode of ['rub','ind','two'])for(const open of [false,true]){
  const scopes=(mode==='two'?[{bx:200,gx:null},{bx:460,gx:570}]:[{bx:440,gx:550}]).map(s=>({...s,by:80,Q:14,g:open,th:open?0:P.leafAngle(7),leaf:open?0:7,ball:7}));
  const rod={on:mode!=='two',x:300,y:80,q:-36},cloth={on:mode==='rub',x:150,y:200,q:36};
  scene.draw(ctx,stage,{mode,show:{charges:true,names:true}},scopes,rod,cloth,{y:open?58:30,mat:open?'metal':'glass'},P.PAIRS.ebonite,'ebonite',[],()=>null);
  for(const [id,x,y,z]of [['rod',250,80,0],['cloth',150,200,-.08]]){const p=scene.lab.project(scopePoint(x,y,z)),q=scene.modelPoint(p,id);if(q){near(q.x,x);near(q.y,y);}}
 }
}
assert.ok(checks>10000);console.log('Electroscope 3D: charge conservation, contact/sharing, induction/grounding, leaf equilibrium, all apparatus modes and projected drags passed.');
