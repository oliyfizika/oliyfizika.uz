import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/fluid-physics.js';
import {createFluidLab,flowPoint,bernPoint,torPoint,wingPoint,sprayPoint} from '../../../assets/js/simulations/fluid-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
for(const Q of [.0002,.001,.004])for(const d1 of [.03,.1,.14])for(const d2 of [.035,.05,.09]){
 const v1=P.speed(Q,d1),v2=P.speed(Q,d2);near(P.area(d1)*v1,Q);near(v2/v1,(d1/d2)**2);
 const p1=1000*P.G*.45,p2=P.bernoulliP(p1,v1,0,v2,.2);near(p1+500*v1*v1,p2+500*v2*v2+1000*P.G*.2);
 if(d2<d1)near(P.venturiV1(P.bernoulliP(p1,v2,0,v1,0)-p1,P.area(d1),P.area(d2)),v1);
}
const low=P.bernoulliP(1000*P.G*.35,P.speed(.004,.1),0,P.speed(.004,.04),0);assert.ok(low<0);
for(const H of [.7,1.3,1.5]){
 near(P.jetRange(H,H/2),H);near(P.jetRange(H,H/4),P.jetRange(H,3*H/4));
 for(const y of [.05,H/2,H-.05])near(P.torricelliV(H-y)*Math.sqrt(2*y/P.G),P.jetRange(H,y));
}
for(const hs of [1,3,10]){const v=Math.sqrt(2*P.RHO_W*P.G*hs/100/P.RHO_AIR);near(P.sprayRise(v)*100,hs);}
const f=P.airfoil({alpha:5*Math.PI/180,V:1});
near(P.liftPerSpan(P.RHO_AIR,80,1.5,f.CL)/P.liftPerSpan(P.RHO_AIR,40,1.5,f.CL),4);
near(P.airfoil({alpha:-f.beta,V:1}).CL,0);

globalThis.document={createElement:()=>({getContext:()=>null})};let count=0;
const check=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));count++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
function makePipe(length,diameter=5,rise=0){return{x0:0,x1:length,dmax:14,at:x=>({d:x>36&&x<66?diameter:10,y:x>105?rise:0})};}
const flow={Q:1,d:[10,5,8],pipe:makePipe(92),slab:{a:0,b:10,V:785}},bern={Q:2.5,dt:5,p1:45,dy:0,pipe:makePipe(136)},tor={H:1.3,holes:1,yh:.45},spray={v:25,hs:3};
const part={n:30,x:Float64Array.from({length:30},(_,i)=>i*3),e:Float64Array.from({length:30},(_,i)=>Math.sin(i))};
const wingParts={X:Float64Array.from({length:30},(_,i)=>-4+i*.3),Y:Float64Array.from({length:30},(_,i)=>Math.sin(i))};
const scene=createFluidLab();let wing;
const helpers={bernAt(x){const a=bern.pipe.at(x),v=P.speed(bern.Q/1000,a.d/100),v1=P.speed(bern.Q/1000,.1),p=P.bernoulliP(1000*P.G*bern.p1/100,v1,0,v,a.y/100),hp=p/(1000*P.G)*100;return{...a,v,p,hp,lvl:a.y+hp,E:bern.p1+v1*v1/(2*P.G)*100};},rot(x,y){const a=wing.alpha;return[x*Math.cos(a)+y*Math.sin(a),-x*Math.sin(a)+y*Math.cos(a)];},vel(x,y){const a=wing.alpha,v=wing.foil.vel(x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a));return v?[v[0]*Math.cos(a)+v[1]*Math.sin(a),-v[0]*Math.sin(a)+v[1]*Math.cos(a)]:null;},lines(){return [[[-4,-1],[-2,-1],[0,-1],[2,-1],[4,-1]],[[-4,1],[-2,1],[0,1],[2,1],[4,1]]];}};
for(const width of [375,800])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI]){
 Object.assign(scene.lab.camera,{yaw,pitch:.5});const stage={w:width,h:320,colors},parts={flow:part,bern:part,wing:wingParts};
 wing={V:40,alpha:5*Math.PI/180,key:'5',foil:f,top:{x:0,y:.3,q:1.4},bot:{x:0,y:-.3,q:.8}};
 for(const d of [3,14]){flow.d=[d,5,8];scene.draw(ctx,stage,{mode:'flow',show:{vec:true},t:3},flow,bern,tor,wing,spray,parts,helpers);const p=scene.lab.project(flowPoint(12,d/2,-.03));assert.ok(Math.abs(scene.parameter('d0',p)-d)<.05);}
 for(const [Q,dt,dy]of [[.5,9,0],[4,3.5,20]]){Object.assign(bern,{Q,dt,dy,pipe:makePipe(136,dt,dy)});scene.draw(ctx,stage,{mode:'bern',show:{vec:true},t:3},flow,bern,tor,wing,spray,parts,helpers);
   for(const [id,p,value,tol]of [['th',bernPoint(50,-dt/2,-.12),dt,.025],['ry',bernPoint(129,dy-5,-.12),dy,.05],['lv',bernPoint(12,bern.p1),bern.p1,.1]]){const q=scene.lab.project(p);assert.ok(Math.abs(scene.parameter(id,q)-value)<tol);}
 }
 for(const holes of [1,3]){tor.holes=holes;scene.draw(ctx,stage,{mode:'app',sub:'tor',show:{vec:true},t:3},flow,bern,tor,wing,spray,parts,helpers);for(const [id,p,v]of [['lvl',torPoint(.25,tor.H,-.36),tor.H],['hole',torPoint(.5,tor.yh),tor.yh]]){const q=scene.lab.project(p);near(scene.parameter(id,q),v,.01);}}
 for(const alpha of [-4,5,12]){wing={...wing,alpha:alpha*Math.PI/180,key:String(alpha),foil:P.airfoil({alpha:alpha*Math.PI/180,V:1})};scene.draw(ctx,stage,{mode:'app',sub:'wing',show:{vec:true},t:3},flow,bern,tor,wing,spray,parts,helpers);const q=scene.lab.project(wingPoint(2*Math.cos(wing.alpha),-2*Math.sin(wing.alpha),-.58));near(scene.parameter('te',q),wing.alpha,.001);}
 for(const v of [0,25,50])for(const hs of [1,10]){Object.assign(spray,{v,hs});scene.draw(ctx,stage,{mode:'app',sub:'spray',show:{vec:true},t:3},flow,bern,tor,wing,spray,parts,helpers);const p=sprayPoint(40,hs,-.1),q=scene.lab.project(p);near(scene.parameter('tip',q),hs,.01);}
}
assert.ok(count>100000);
console.log('Fluid 3D: continuity, Bernoulli energy and suction, Venturi inversion, Torricelli range, spray threshold, airfoil lift, every apparatus mode and orbital drag inverse passed.');
