import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/newton-physics.js';
import { createNewtonLab } from '../../../assets/js/simulations/newton-lab-3d.js';
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
for(const M of [.5,1])for(const F of [0,.8,2,4])for(const mu of [0,.2]) {
  const q=P.cartForces({M,F,mu});near(q.a,Math.max(0,(F-mu*M*P.G)/M));
  near(q.Fnet,q.mass*q.a);near(q.Fd-q.f,q.Fnet);
  if(q.a>0)near(P.accelFrom(.6,P.timeOver(.6,q.a)),q.a);
}
for(const M of [.5,1])for(const m of [.05,.1,.3]) {
  const q=P.cartForces({M,m,mode:'hang'});near(q.a,m*P.G/(M+m));near(q.T,M*q.a);near(m*P.G-q.T,m*q.a);
  const loose=P.cartForces({M,m,mu:.1,mode:'hang',v:1,attached:false});near(loose.T,0);near(loose.a,-.1*P.G);
}
for(const [m1,m2] of [[1,1],[.5,1],[.5,2.5]])for(const dx of [.005,.03,.04]) {
  const f=P.recoilFinal(m1,m2,600,dx);near(m1*f.v1+m2*f.v2,0);near(.5*m1*f.v1**2+.5*m2*f.v2**2,.5*600*dx**2);
  let st={x1:-(.06-dx)/2,x2:(.06-dx)/2,v1:0,v2:0};
  for(let i=0;i<400;i++)st=P.recoilStep(st,.001,{m1,m2,k:600,L0:.06});
  near(m1*st.v1+m2*st.v2,0);near(st.v1,f.v1,5e-4);near(st.v2,f.v2,5e-4);
}
near(P.weight(60,-P.G),0);near(P.weight(60,P.G),2*60*P.G);
for(const D of [-24,-3,3,24]) {
  const r=P.rideProfile(D,2,3);let y=0,v=0;const dt=r.T/20000;
  for(let i=0;i<20000;i++){const a=r.acc((i+.5)*dt);y+=v*dt+a*dt*dt/2;v+=a*dt;}
  near(v,0,1e-3);near(y,D,4e-4);
}

// Execute every scene path and parameter projection using the real fallback renderer.
globalThis.document={createElement:()=>({getContext:()=>null})};
let numeric=0;
const finite=(...args)=>{for(const x of args)if(typeof x==='number'){assert.ok(Number.isFinite(x));numeric++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})}, {get:(t,k)=>k in t?t[k]:finite});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#888888']));
const scene=createNewtonLab();
const crt={drive:'force',M:.5,m:.1,F:1,mu:0,s:.6,x:0,v:0,t:0,phase:'ready',tGate:null,aMeas:null,landed:false};
const rc={m1:.5,m2:1,dx:.03,x1:-.015,x2:.015,v1:0,v2:0,F:18,t:0,phase:'bound',strobe:[],contact:true};
const lift={m:60,y:0,v:0,a:0,mode:'idle',t:0,target:9,cable:true};
const ui={mode:'law2',show:{vec:true}};
for(const w of [390,760])for(const yaw of [0,-.5,Math.PI/2,Math.PI]){
  Object.assign(scene.lab.camera,{yaw,pitch:.35,zoom:1});const stage={w,h:340,colors};
  for(const drive of ['force','hang'])for(const landed of [false,true])for(const x of [0,.5,1]){
    scene.draw(ctx,stage,ui,{...crt,drive,landed,x,phase:x?'run':'ready',aMeas:x?2:null},rc,lift);
    for(const id of ['ftip','gate'])assert.ok(Number.isFinite(scene.parameter(id,{x:w/2,y:150})));
  }
  for(const phase of ['bound','push','fly','done'])scene.draw(ctx,stage,{...ui,mode:'law3'},crt,{...rc,phase,strobe:[{a:-.5,b:.25}],contact:phase==='push',v1:-1,v2:.5},lift);
  scene.draw(ctx,stage,{...ui,mode:'law3'},crt,rc,lift);
  scene.startDrag('c1',{x:120,y:180});near(scene.parameter('c1',{x:120,y:180}),rc.dx);
  const projected=scene.lab.project([-.2645,.54,-.24]);assert.ok(Number.isFinite(projected.x));
  for(const [mode,a,cable]of [['idle',0,true],['ride',2,true],['fall',-P.G,false],['brake',P.G,false],['idle',0,false]])
    scene.draw(ctx,stage,{...ui,mode:'lift'},crt,rc,{...lift,mode,a,cable,y:24,v:mode==='ride'?2:0});
}
assert.ok(numeric>100000);
console.log('Newton 3D: F=ma, friction, hanging tension, photogate, recoil energy/momentum, lift profiles/weight and all scene modes/orbits passed.');
