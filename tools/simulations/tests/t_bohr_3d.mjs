import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/bohr-physics.js';
import * as L from '../../../assets/js/simulations/bohr-lab.js';
import {createBohrLab,telescopePoint,SPEC,FH,filamentPoint,opticalTubeFaces} from '../../../assets/js/simulations/bohr-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);

// The transformed apparatus must retain the measured quantities used by both lab tasks.
for(const gas of ['Hg','Ne'])for(const T of gas==='Hg'?[140,170,200]:[20])for(const Ur of [.5,1.5,3]){
 const cond={gas,T,Ur},g=P.GASES[gas],maxima=P.fhMaxima(cond);
 if(maxima.length){
  assert.ok(maxima.length>=3);const result=L.analyzeFH(maxima.map((U,i)=>({k:i+1,U})),cond);
  assert.equal(result.ok,true);near(result.E1,g.E1,.007);
 }else assert.ok(gas==='Hg'&&Ur===.5); // Too little retardation washes out the current minima.

 for(let i=0;i<maxima.length;i++)assert.equal(L.matchFH({k:i+1,U:maxima[i]},cond),true);
 for(const U of [0,g.Uc,g.Umax/2,g.Umax]){
  assert.ok(P.fhCurrent(U,cond)>=0);for(const x of P.glowLayers(U,gas,T))assert.ok(x>0&&x<1);
 }
 near(P.fhCurrent(g.Uc,cond),0);
}
for(const gr of [300,600]){
 const d=P.GRATINGS[gr].d,rows=[];
 for(const line of P.LINES){
  const lam=P.balmerNm(line.n),a=P.diffAngle(lam,1,d);assert.ok(a>0);
  near(P.HC_EV_NM/lam,P.levelEv(line.n)-P.levelEv(2));
  const phi=a+P.ZERO_OFFSET,v=P.linesInView(phi,gr).find(v=>v.line?.id===line.id&&v.k===1);
  near(v.off,0);rows.push({line:line.id,k:1,pL:-a+P.ZERO_OFFSET,pR:a+P.ZERO_OFFSET});
  near(d*Math.sin(a*Math.PI/180)*1e9,lam);
 }
 const result=L.analyzeBalmer(rows,{gr});assert.equal(result.ok,true);near(result.R0,P.R_H);near(result.Eion,P.RY_EV);near(result.zero.m,P.ZERO_OFFSET);
}
assert.ok(FH.cathode<FH.grid&&FH.grid<FH.anode);
near(filamentPoint(0)[1],FH.y-.23);near(filamentPoint(48)[1],FH.y+.23);
for(const p of [filamentPoint(0),filamentPoint(48)])near(p[2],FH.z-.045);
// Opaque endcaps must not block the optical axis. Test actual shell triangles.
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rayTriangle(o,d,a,b,c){
 const e1=sub(b,a),e2=sub(c,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-10)return false;
 const s=sub(o,a),u=dot(s,h)/det;if(u<0||u>1)return false;const q=cross(s,e1),v=dot(d,q)/det;
 return v>=0&&u+v<=1&&dot(e2,q)/det>1e-8;
}
for(const phi of [-70,0,23.5,70]){
 const a=telescopePoint(phi,.45),b=telescopePoint(phi,1.9),dir=sub(b,a),len=Math.hypot(...dir),u=dir.map(v=>v/len),o=a.map((v,i)=>v-.1*u[i]),faces=opticalTubeFaces(a,b,.13);
 assert.ok(faces.length>0);for(const f of faces)for(let i=1;i<f.length-1;i++)assert.equal(rayTriangle(o,u,f[0],f[i],f[i+1]),false);
 // A transverse ray must hit a wall, so the empty-axis test is not vacuous.
 const mid=a.map((v,i)=>(v+b[i])/2),side=[mid[0],mid[1]+1,mid[2]];assert.ok(faces.some(f=>f.slice(1,-1).some((_,i)=>rayTriangle(side,[0,-1,0],f[0],f[i+1],f[i+2]))));
}

globalThis.document={createElement:()=>({getContext:()=>null})};let checks=0;
const check=(...args)=>args.forEach(v=>{if(typeof v==='number'){assert.ok(Number.isFinite(v));checks++;}});
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map((k,i)=>[k,['#64748b','#334155','#94a3b8'][i%3]]));
const scene=createBohrLab(),fh={gas:'Hg',U:18,T:170,Ur:1.5},sp={gr:600,phi:20},electrons=Array.from({length:70},(_,i)=>({x:i/70,y:Math.sin(i)}));
for(const w of [358,900])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.08,.5,1.3]){
 Object.assign(scene.lab.camera,{yaw,pitch});const st={w,h:320,colors};
 for(const dark of [false,true]){
  colors.dark=dark;
  for(const gas of ['Hg','Ne'])for(const U of [0,P.GASES[gas].Umax])for(const Ur of [.5,3]){
   const state={...fh,gas,U,Ur,T:gas==='Hg'?(U?200:140):20};scene.draw(ctx,st,{mode:'fh',t:.2},state,sp,electrons,P.fhCurrent(U,state));
  }
  for(const gr of [300,600])for(const phi of [-70,-23.2,0,23.55,70]){
   scene.draw(ctx,st,{mode:'spec',t:0},fh,{gr,phi},electrons,0);
   const world=telescopePoint(phi),p=scene.lab.project(world),inverse=scene.angle(p);assert.notEqual(inverse,null);near(inverse,phi,1e-8);
   near(Math.hypot(world[0]-SPEC.center[0],world[2]-SPEC.center[2]),SPEC.radius);
   near(world[1],SPEC.center[1]);
  }
 }
}
assert.ok(checks>10000);
console.log('Bohr 3D: Frank–Hertz energy spacing/current/layers, Balmer/Rydberg/zero correction, all apparatus/extremes and 30-view telescope inverse passed.');
