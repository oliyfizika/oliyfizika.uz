import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/circular-physics.js';
import {createCircularLab,kinPoint,stringPoint,bankPoint,needlePoint} from '../../../assets/js/simulations/circular-lab-3d.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
for(const R of [.2,.6,1])for(const v of [.2,1.5,4]){
  const k=P.kin(v,R);near(k.omega*R,v);near(k.T*k.nu,1);near(k.ac,v*v/R);
  near(P.tension(.2,P.breakSpeed(.2,R,5),R),5);
}
for(const R of [20,60,200])for(const mu of [.08,.2,.4,.7])for(const alpha of [0,20*Math.PI/180,30*Math.PI/180]){
  const v=P.carMax(mu,R,alpha),F=P.carForces(1200,v,R,alpha);near(F.f,mu*F.N);
  assert.ok(P.carMin(mu,R,alpha)<=v);
  if(alpha>0)near(P.carForces(1200,P.carIdeal(R,alpha),R,alpha).f,0);
}
for(const R of [.2,.5,1]){
  near(P.loopAt(2.5*R,R,Math.PI).n,0);near(P.loopAt(3*R,R,Math.PI).n,1);
  near(P.detachAngle(2*R,R),Math.acos(-2/3));assert.equal(P.detachAngle(3*R,R),null);
}
for(const [R1,R2]of [[3,18],[12,6],[18,3]])near(P.beltOmega2(2*Math.PI,R1,R2)*R2,2*Math.PI*R1);

globalThis.document={createElement:()=>({getContext:()=>null})};let numeric=0;
const check=(...args)=>{for(const v of args)if(typeof v==='number'){assert.ok(Number.isFinite(v));numeric++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createCircularLab(),track=P.makeTrack();
const kin={v0:1.5,v:1.5,R:.6,at:0,th:.8,th0:0,t:0},str={v0:3,v:3,m:.2,R:.6,Fmax:5,th:.8,t:0,on:true,fly:null};
const car={v:60/3.6,R:60,mu:.7,alpha:0,th:-Math.PI/2,skid:null,trail:[],off:''};
const lp={k:3,R:.5,s:track.sOfH(3),w:0,phase:'run',fly:null,det:null,t:0};
const blt={type:'belt',n1:.5,R1:12,R2:6,th1:.7,th2:1.4,s:20,t:0};
for(const width of [375,850])for(const yaw of [-Math.PI,-.5,0,Math.PI/2,Math.PI])for(const pitch of [.12,.5,1.3]){
  const stage={w:width,h:320,colors};Object.assign(scene.lab.camera,{yaw,pitch,zoom:1});
  for(const [v,R,at]of [[0,.2,-1],[.2,1,-1],[1.5,.6,0],[4,1,1]]){
    const k={...kin,v,R,at};scene.draw(ctx,stage,{mode:'kin',show:{vec:true}},k,str,car,lp,blt,track,()=>at);
    const b=kinPoint(R*Math.cos(k.th),R*Math.sin(k.th)),q=scene.lab.project(b),rest=scene.body('kbody',q);
    if(rest){near(rest.x,R*Math.cos(k.th));near(rest.y,R*Math.sin(k.th));}
    const tip=scene.lab.project(scene.kinTip(2));near(scene.parameter('ktip',tip),2,.01);
  }
  for(const fly of [null,{x:1.3,y:.6,x0:.5,y0:0,vx:0,vy:3}]){
    scene.draw(ctx,stage,{mode:'dyn',sub:'string',show:{vec:true}},kin,{...str,fly,on:!fly},car,lp,blt,track,()=>0);
    const q=scene.lab.project(stringPoint(.3,.5)),rest=scene.body('sball',q);if(rest){near(rest.x,.3);near(rest.y,.5);}
  }
  for(const alpha of [0,30*Math.PI/180])for(const skid of [null,{x:72,y:0,dir:'out'}]){
    scene.draw(ctx,stage,{mode:'dyn',sub:'car',show:{vec:true}},kin,str,{...car,alpha,skid,trail:[[60,0],[64,1],[70,4]]},lp,blt,track,()=>0);
    near(scene.parameter('needle',scene.lab.project(needlePoint(80))),80,.004);
    near(scene.parameter('bank',scene.lab.project(bankPoint(20*Math.PI/180))),20*Math.PI/180,.003);
  }
  for(const k of [.5,2,2.5,3.5]){
    scene.draw(ctx,stage,{mode:'dyn',sub:'loop',show:{vec:true}},kin,str,car,{...lp,k,s:track.sOfH(k)},blt,track,()=>0);
    near(scene.parameter('lball',scene.lab.project(scene.loopBall(2.5))),2.5,.003);
  }
  scene.draw(ctx,stage,{mode:'dyn',sub:'loop',show:{vec:true}},kin,str,car,{...lp,phase:'fly',det:{x:.6,y:1.8},fly:{x:.8,y:1.4,nx:-.5,ny:-.5,path:[[.6,1.8],[.8,1.4]]}},blt,track,()=>0);
  for(const type of ['belt','gear','bike'])for(const [R1,R2]of [[3,18],[12,6],[18,3],[18,18]]){
    const b={...blt,type,R1,R2};scene.draw(ctx,stage,{mode:'belt',show:{vec:true}},kin,str,car,lp,b,track,()=>0);
    for(const id of ['r1','r2'])near(scene.parameter(id,scene.lab.project(scene.radiusPoint(id,12))),12,.006);
  }
}
assert.ok(numeric>100000);
console.log('Circular 3D: kinematics/tension, banked-road limits, vertical-loop threshold, belt ratios, seven apparatus variants/extremes and orbital drag inverses passed.');
