import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/rutherford-physics.js';
import {createRutherfordLab,CM,FM,ORIGIN,MICRO_Y,chamberPoint,detectorPoint,detectorGrip,microPoint,impactPoint,clipMicro,MICRO_BOUNDS} from '../../../assets/js/simulations/rutherford-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
const rate=(th,p=1)=>P.countRate({mat:'Au',tUm:2,E:P.SOURCES.am.E,thDeg:th,p});
const k=[15,30,60,90,150].map(th=>(rate(th).rate-P.APP.bg)*Math.sin(th*Math.PI/360)**4);
k.forEach(v=>near(v,k[0]));assert.ok(rate(30,P.P_ATM).blocked);near(rate(30,P.P_ATM).rate,P.APP.bg);
near(P.energyAfterAir(5.486,8.5,0),5.486);near(P.energyAfterAir(5.486,P.airRange(5.486),P.P_ATM),0);
near(P.dOmega(),P.APP.Ad/P.APP.L**2);
const cache=new Map();
function trajectory(mat,src,b){const d=P.collisionD(P.MATERIALS[mat].Z,P.SOURCES[src].E),key=[mat,src,b].join('|');if(!cache.has(key)){const tr=P.trajectory(Math.abs(b),d,{X:200});cache.set(key,b<0?{...tr,theta:-tr.theta,pts:tr.pts.map(([x,y,t])=>[x,-y,t])}:tr);}return cache.get(key);}
for(const mat of Object.keys(P.MATERIALS))for(const src of Object.keys(P.SOURCES))for(const b of [0,25,150]){
 const d=P.collisionD(P.MATERIALS[mat].Z,P.SOURCES[src].E),tr=trajectory(mat,src,b),theta=P.thetaFromB(b,d);
 // The original adaptive RK integrator uses step=.01; allow its numerical error.
 near(tr.theta,theta,2e-4);near(tr.rmin,P.rMin(d,theta),1.5e-4);
 near(P.bFromTheta(theta,d),b,1e-7);
}
// A deterministic ensemble verifies the untouched count generator at both branches.
let seed=12345;const rnd=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return(seed+.5)/4294967296;};
for(const lambda of [.2,2,70]){let sum=0,sum2=0;const n=30000;for(let i=0;i<n;i++){const q=P.poisson(lambda,rnd);assert.ok(Number.isInteger(q)&&q>=0);sum+=q;sum2+=q*q;}const mean=sum/n,variance=sum2/n-mean*mean;assert.ok(Math.abs(mean/lambda-1)<.04);assert.ok(Math.abs(variance/lambda-1)<.06);}
for(const th of [-160,-30,0,30,150,160])near(Math.hypot(...detectorPoint(th).map((v,i)=>v-ORIGIN[i]))/CM,P.APP.L);
near((ORIGIN[0]-chamberPoint(-P.APP.Ls)[0])/CM,8.5);
near(Math.hypot(...microPoint(50,0).map((v,i)=>v-microPoint(0)[i])),Math.hypot(...microPoint(0,50).map((v,i)=>v-microPoint(0)[i])));
const clipped=clipMicro([-300,0],[300,150]);assert.ok(clipped);near((clipped[1][1]-clipped[0][1])/(clipped[1][0]-clipped[0][0]),.25);assert.equal(clipMicro([-300,200],[300,200]),null);

globalThis.document={createElement:()=>({getContext:()=>null})};let nums=0;
const finite=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));nums++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:finite});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createRutherfordLab(),base={mat:'Au',src:'am',th:30,tUm:2,p:1,T:60,speed:10,vacuum:true,run:null,last:null,tracks:[],flashes:[],led:0},micro={b:25,fan:true,anim:.5};
function helpers(s){return{rate:P.countRate({mat:s.mat,tUm:s.tUm,E:P.SOURCES[s.src].E,thDeg:s.th,p:s.p}),d:P.collisionD(P.MATERIALS[s.mat].Z,P.SOURCES[s.src].E),pressure:'1 Pa',traj:b=>trajectory(s.mat,s.src,b)};}
// Inspect rendered beam geometry, including the actual source-to-foil reference.
const lines=[],line=scene.lab.line;scene.lab.line=(a,b,...rest)=>{lines.push([a,b]);return line(a,b,...rest);};
scene.draw(ctx,{w:850,h:320,colors},{mode:'lab',t:0},base,micro,helpers(base));scene.lab.line=line;
assert.ok(lines.some(([a,b])=>Math.hypot(...a.map((v,i)=>v-chamberPoint(-8.5)[i]))<1e-9&&Math.hypot(...b.map((v,i)=>v-chamberPoint(10.4)[i]))<1e-9),'rendered beam must start at the physical source');
const selected=[];scene.lab.line=(a,b,color,width,...rest)=>{if(width===2.2)selected.push([a,b]);return line(a,b,color,width,...rest);};
scene.draw(ctx,{w:850,h:320,colors},{mode:'micro',t:0},base,micro,helpers(base));scene.lab.line=line;
assert.ok(selected.length>100);
for(const segment of selected)for(const p of segment){near(p[2],0);assert.ok(p[0]>=MICRO_BOUNDS[0]*FM-1e-8&&p[0]<=MICRO_BOUNDS[1]*FM+1e-8);assert.ok(p[1]>=MICRO_Y+MICRO_BOUNDS[2]*FM-1e-8&&p[1]<=MICRO_Y+MICRO_BOUNDS[3]*FM+1e-8);}
let inverses=0;
for(const w of [375,850])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.15,.6,1.3]){
 Object.assign(scene.lab.camera,{yaw,pitch});const stage={w,h:320,colors};
 for(const [mode,extra,extraM]of [['lab',{},{}],['lab',{th:150,T:1200,speed:100},{}],['lab',{mat:'Ag'},{}],['lab',{src:'rac'},{}],['lab',{p:P.P_ATM,vacuum:false},{}],['micro',{},{}],['micro',{mat:'Al',src:'po'},{b:150}],['micro',{}, {b:0}]]){
  const s={...base,...extra},m={...micro,...extraM};scene.draw(ctx,stage,{mode,t:.5},s,m,helpers(s));
  const id=mode==='lab'?'detector':'impact',point=mode==='lab'?detectorGrip(s.th):impactPoint(m.b),p=scene.lab.project(point),value=scene.parameter(id,p);
  if(value!==null){near(value,mode==='lab'?s.th:m.b,1e-6);inverses++;}
 }
}
assert.ok(nums>100000);assert.ok(inverses>100);
console.log('Rutherford 3D: sin⁻⁴/count/air model, deterministic Poisson statistics, Coulomb angles/r_min, exact cm/fm scales, clipped paths, all presets/extremes/30 views and inverse controls passed.');
