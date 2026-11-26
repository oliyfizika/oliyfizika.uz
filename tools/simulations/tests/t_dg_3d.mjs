import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/dg-physics.js';
import * as L from '../../../assets/js/simulations/dg-lab.js';
import {createDGLab,DG_TARGET,DG_RADIUS,DG_CHAMBER,collectorPoint,collectorGrip,jawPoint,MONITOR} from '../../../assets/js/simulations/dg-lab-3d.js';
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
for(const U of [20,40,54,68,100]){
 const lambda=P.lambdaNm(U),nr=P.H/Math.sqrt(2*P.ME*P.QE*U)*1e9;
 near(lambda,nr/Math.sqrt(1+P.QE*U/(2*P.ME*P.C**2)));
 const peak=P.dgPeak(U);if(peak!==null)near(P.NI_D*Math.sin(peak*Math.PI/180),lambda);
 for(const phi of [10,30,50,90])assert.ok(P.dgCurrent(U,phi)>0);
}
assert.ok(P.dgPeak(54)>50&&P.dgPeak(54)<52);assert.ok(P.dgPeak(68)<P.dgPeak(54));
const dgFit=L.analyzeDG([40,54,68].map(U=>({U,phi:L.dgTrueMax(U),n:1})));
assert.ok(dgFit.ok);assert.ok(Math.abs(dgFit.h/P.H-1)<.02);
const graphiteRows=[];
for(const U of [2.5,4,5]){
 const D=P.GRAPHITE.d.map(d=>P.ringD(U,d));assert.ok(D[0]<D[1]);
 for(let j=0;j<2;j++){const th=Math.asin(P.lambdaNm(U*1000)/(2*P.GRAPHITE.d[j]));near(D[j],2*P.GRAPHITE.L*Math.tan(2*th));}
 graphiteRows.push({U,D1:D[0],D2:D[1]});
}
assert.ok(P.ringD(5,P.GRAPHITE.d[0])<P.ringD(2.5,P.GRAPHITE.d[0]));
const graphiteFit=L.analyzeGr(graphiteRows);assert.ok(graphiteFit.ok);assert.ok(Math.abs(graphiteFit.h/P.H-1)<.015);
for(const phi of [10,40,90]){const p=collectorPoint(phi);near(Math.hypot(...p.map((v,i)=>v-DG_TARGET[i])),DG_RADIUS);near(Math.atan2(p[0]-DG_TARGET[0],p[1]-DG_TARGET[1])*180/Math.PI,phi);}
// Every cup surface stays inside the clear chamber bore over its full travel.
assert.ok(DG_CHAMBER.center[1]-DG_CHAMBER.r>=0);
for(let phi=10;phi<=90;phi+=.5){
 const a=phi*Math.PI/180,u=[Math.sin(a),Math.cos(a)],v=[Math.cos(a),-Math.sin(a)],D=collectorPoint(phi);
 for(const longitudinal of [0,.27])for(let j=0;j<24;j++){
  const c=Math.cos(j*Math.PI/12),x=D[0]+longitudinal*u[0]+.13*c*v[0],y=D[1]+longitudinal*u[1]+.13*c*v[1];
  assert.ok(Math.hypot(x-DG_CHAMBER.center[0],y-DG_CHAMBER.center[1])<DG_CHAMBER.r-.06,'collector must clear the inner wall');
 }
 const g=collectorGrip(phi);assert.ok(Math.hypot(g[0]-DG_CHAMBER.center[0],g[1]-DG_CHAMBER.center[1])+.066<DG_CHAMBER.r-.06);
}

globalThis.document={createElement:()=>({getContext:()=>null})};let nums=0;
const finite=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));nums++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:finite});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createDGLab();let inverses=0;
// Electrical reference and cathode continuity are verified from actual rods.
const rods=[],spheres=[],rod=scene.lab.rod,sphere=scene.lab.sphere;
scene.lab.rod=(a,b,...rest)=>{rods.push([a,b]);return rod(a,b,...rest);};
scene.lab.sphere=(p,r,...rest)=>{spheres.push([p,r]);return sphere(p,r,...rest);};
scene.draw(ctx,{w:850,h:320,colors},{mode:'dg',t:0},{U:54,phi:90},{U:4,jL:-10,jR:10,active:'R'},{current:1});
const key=p=>p.map(v=>v.toFixed(6)).join(','),connected=(segments,start,end)=>{
 const graph=new Map();for(const [a,b]of segments){const x=key(a),y=key(b);if(!graph.has(x))graph.set(x,[]);if(!graph.has(y))graph.set(y,[]);graph.get(x).push(y);graph.get(y).push(x);}
 const queue=[key(start)],seen=new Set(queue);for(let i=0;i<queue.length;i++)for(const next of graph.get(queue[i])||[])if(!seen.has(next)){seen.add(next);queue.push(next);}return seen.has(key(end));
};
assert.ok(connected(rods,[-2.32,.54,-1],[DG_TARGET[0],DG_TARGET[1]-.07,.15]),'source positive and Ni reference must connect');
assert.ok(connected(rods,[-2.32,.54,-1],[1.65,.54,-1]),'current-meter return must share source positive');
assert.ok(spheres.some(([p,r])=>key(p)===key(collectorGrip(90))&&r>=.04),'collector handle needs a visible grip');
rods.length=0;scene.draw(ctx,{w:850,h:320,colors},{mode:'gr',t:0},{U:54,phi:50},{U:4,jL:-10,jR:10,active:'R'},{current:1});
assert.ok(connected(rods,[-1.34,.54,-1],[-2.53,1.62,.45]),'graphite cathode must connect to negative HV');
scene.lab.rod=rod;scene.lab.sphere=sphere;
// Check the rendered cone opening against the physical tube's Bragg angle.
const lines=[],line=scene.lab.line;
scene.lab.line=(a,b,...rest)=>{lines.push([a,b]);return line(a,b,...rest);};
scene.draw(ctx,{w:850,h:320,colors},{mode:'gr',t:0},{U:54,phi:50},{U:4,jL:-10,jR:10,active:'R'},{current:1});
scene.lab.line=line;
const cone=lines.filter(([a,b])=>a[0]<-1&&Math.abs(a[1]-1.62)<1e-10&&Math.abs(a[2]-.45)<1e-10&&Math.abs(b[0]-.78)<1e-10);
assert.equal(cone.length,8);
for(let i=0;i<cone.length;i++){
 const [a,b]=cone[i],slope=Math.hypot(b[1]-a[1],b[2]-a[2])/(b[0]-a[0]);
 near(slope,Math.tan(2*Math.asin(P.lambdaNm(4000)/(2*P.GRAPHITE.d[Math.floor(i/4)]))));
}
const monitorRadii=lines.filter(([a,b])=>Math.abs(a[2]-MONITOR.z)<1e-10&&Math.abs(b[2]-MONITOR.z)<1e-10).map(([a])=>Math.hypot(a[0]-MONITOR.x,a[1]-MONITOR.y)*MONITOR.mm/MONITOR.r);
for(const d of P.GRAPHITE.d)assert.ok(monitorRadii.some(r=>Math.abs(r-P.ringD(4,d)/2)<1e-8),'caliper monitor rings must use true mm');
for(const w of [375,850])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.15,.6,1.3]){
 Object.assign(scene.lab.camera,{yaw,pitch});const stage={w,h:320,colors};
 for(const [mode,U,phi]of [['dg',20,10],['dg',54,50.1],['dg',100,90],['gr',2.5,0],['gr',5,0]]){
  const dg={U,phi},gr={U,jL:-27.3,jR:27.3,active:'R'};
  scene.draw(ctx,stage,{mode,t:.5},dg,gr,{current:1.234});
  if(mode==='dg'){
   const p=scene.lab.project(collectorGrip(phi)),v=scene.parameter('collector',p);if(v!==null){near(v,phi,1e-6);inverses++;}
  }else for(const [id,value]of [['jL',gr.jL],['jR',gr.jR]]){
   const p=scene.lab.project(jawPoint(value)),v=scene.parameter(id,p);if(v!==null){near(v,value,1e-6);inverses++;}
  }
 }
}
// Both jaw pointers and the optical scale use one linear map, including asymmetric placement.
near((jawPoint(31.1)[0]-jawPoint(-12.4)[0])*MONITOR.mm/MONITOR.r,43.5);
assert.ok(nums>100000);assert.ok(inverses>100);
console.log('DG 3D: de Broglie/Bragg/Planck fits, calibrated graphite rings, collector angle, all apparatus/extremes/30 orbital views and optical caliper inverses passed.');
