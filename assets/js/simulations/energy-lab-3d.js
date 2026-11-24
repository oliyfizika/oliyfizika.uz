// Detailed tabletop apparatus; all physical quantities come from energy-physics.js.
import { createLab3D } from './lab-3d.js?v=20261123-batch5d';
import { fmt, clamp } from './sim-kit.js';
import { alpha, arrowSolid, dashed, helix, ring, dial } from './apparatus-3d.js?v=20261123-batch5d';
import * as P from './energy-physics.js';

// Physical rail boundary is shared by animation and apparatus, independent of viewport.
export const PULL_RAIL_END = 8.4;

export function createEnergyLab() {
  const lab=createLab3D();
  const pullScale=.59,parkScale=.43,parkHeight=.32,liftScale=.18;
  const pullPoint=(x,y=0,z=0)=>[-2.65+x*pullScale,.19+y*pullScale,z];
  const parkPoint=(x,y,z=0)=>[(x-6)*parkScale,.16+y*parkHeight,z];
  const springPoint=x=>[-1.5,1.28-4*x+.09,0];
  const liftPoint=h=>[2.05,.25+h*liftScale,-.35];
  function meter(items,reference,c) {
    const max=Math.max(reference||0,...items.map(i=>Math.abs(i[1])),1e-8),left=-1.35;
    // Keep the energy bank on the unobstructed front tabletop strip.
    // Exact readings remain in the result cards; short labels stay legible on mobile.
    lab.box(left-.2,.04,-1.55,2.9,.08,.65,c.bg2);
    items.forEach(([name,val,col],i)=>{
      const x=left+i*.83,h=Math.abs(val)/max*.52;
      lab.box(x-.1,.14,-1.45,.2,Math.max(.002,h),.2,col);
      lab.label(name,[x,.84,-1.48],col);
      if(val<0)lab.label('−',[x,.2,-1.51],col);
    });
  }
  function rulerX(x0,x1,y,z,step=1,point=pullPoint) {
    lab.rod(point(x0,y,z),point(x1,y,z),.012,lab.colors.text3,8);
    for(let x=x0;x<=x1+1e-6;x+=step){const p=point(x,y,z);lab.line(p,[p[0],p[1]+.07,p[2]],lab.colors.text3,1);if(x%2===0)lab.label(`${fmt(x,0)} m`,[p[0],p[1]-.13,p[2]]);}
  }
  function drawPull(ctx,stage,ui,pull) {
    const c=stage.colors,b=.6*Math.cbrt(pull.M/20),fs=P.pullForces({M:pull.M,F:pull.phase==='coast'?0:pull.F,alpha:pull.alpha,mu:pull.mu,v:pull.v});
    lab.begin(ctx,stage,{target:[0,1.0,0],focal:1.7});
    lab.box(-2.8,.04,-.4,5.6,.13,.8,c.bg2);
    for(let x=0;x<=PULL_RAIL_END;x+=.25){const q=pullPoint(x);lab.line([q[0],.18,-.35],[q[0],.18,.35],alpha(c.text3,pull.mu>.05?.4:.12),1);}
    rulerX(0,8,0,-.58);
    const q=pullPoint(pull.x),bs=b*pullScale;
    lab.box(q[0],q[1],-.25,bs,bs,.5,c.warning);
    for(const z of [-.255,.255]){
      lab.rod([q[0]+.02,q[1]+.02,z],[q[0]+bs-.02,q[1]+bs-.02,z],.012,c.text2,8);
      lab.rod([q[0]+bs-.02,q[1]+.02,z],[q[0]+.02,q[1]+bs-.02,z],.012,c.text2,8);
    }
    lab.label(`${fmt(pull.M,0)} kg`,[q[0]+bs/2,q[1]+bs+.22,-.25],c.warning);
    const anchor=pullPoint(pull.x+b,b/2,-.28),ropeEnd=[anchor[0]+.7*Math.cos(pull.alpha),anchor[1]+.7*Math.sin(pull.alpha),anchor[2]];
    const active=pull.phase!=='coast'&&pull.phase!=='done';
    if(active){lab.rod(anchor,ropeEnd,.013,c.text2,8);ring(lab,ropeEnd,.055,c.text2,'z',.012);}
    const forceEnd=[anchor[0]+pull.F/150*1.65*Math.cos(pull.alpha),anchor[1]+pull.F/150*1.65*Math.sin(pull.alpha),anchor[2]-.03];
    if(ui.show.vec&&active){arrowSolid(lab,[...anchor.slice(0,2),anchor[2]-.03],forceEnd,c.primary);lab.label(`F = ${fmt(pull.F,0)} N`,[forceEnd[0],forceEnd[1]+.18,forceEnd[2]],c.primary);}
    if(pull.phase==='ready'){
      // A visible ring keeps F draggable even if force vectors are hidden or F = 0.
      ring(lab,forceEnd,.055,c.primary,'z',.012);lab.handle('tip',forceEnd,.13);
      for(const [id,x,text]of [['mm',-2.5,'−'],['mp',-1.85,'+']]){lab.box(x-.13,.3,-1.02,.26,.25,.08,c.bg2);lab.label(text,[x,.43,-1.08],c.primary);lab.handle(id,[x,.43,-1.08],.14);}
      lab.label('m',[ -2.18,.78,-1.03],c.warning);
    }
    if(ui.show.vec){
      const origin=[q[0]+bs/2,q[1]+bs/2,-.31],scale=Math.min(.006,.95/(pull.M*P.G));
      arrowSolid(lab,origin,[origin[0],origin[1]+fs.N*scale,origin[2]],c.success,.013);
      arrowSolid(lab,origin,[origin[0],origin[1]-pull.M*P.G*scale,origin[2]],c.danger,.013);
      arrowSolid(lab,origin,[origin[0]-fs.f*.012,origin[1],origin[2]],c.warning,.013);
      lab.label('N',[origin[0]-.12,origin[1]+fs.N*scale,origin[2]],c.success);
      lab.label('mg',[origin[0]+.15,Math.max(.05,origin[1]-pull.M*P.G*scale),origin[2]],c.danger);
      if(fs.f>.01)lab.label('f',[origin[0]-fs.f*.012,origin[1]+.15,origin[2]],c.warning);
    }
    const flag=pullPoint(pull.s+b,1.4,-.15);
    lab.rod([flag[0],.18,flag[2]],flag,.018,c.text2,8);
    for(let i=0;i<4;i++)for(let j=0;j<3;j++){const x=flag[0]+j*.085,y=flag[1]-i*.07;lab.face([[x,y,flag[2]],[x+.085,y,flag[2]],[x+.085,y-.07,flag[2]],[x,y-.07,flag[2]]],(i+j)%2?c.text:c.bg);}
    lab.handle('flag',[flag[0]+.12,flag[1]-.12,flag[2]],.17);
    lab.label(`s = ${fmt(pull.s,1)} m`,[flag[0],flag[1]+.22,flag[2]],c.text2);
    dashed(lab,pullPoint(0,1.4,.25),pullPoint(0,0,.25),c.text3);
    meter([['A_F',pull.AF,c.primary],['A_f',pull.Af,c.warning],['ΣA',pull.AF+pull.Af,c.special],['Eₖ',.5*pull.M*pull.v**2,c.success]],Math.abs(pull.AF)+Math.abs(pull.Af),c);
    lab.finish(pull.t,'Yo‘l: m · kuchlar alohida masshtabda');
  }
  function drawLift(ctx,stage,ui,lift) {
    const c=stage.colors;lab.begin(ctx,stage,{target:[0,1.4,0],focal:1.7});
    const height=liftPoint(lift.h)[1];
    dashed(lab,[-2.1,height,-.35],[2.1,height,-.35],c.danger);
    lab.sphere(liftPoint(lift.h),.065,c.danger);lab.handle('hline',liftPoint(lift.h),.14);
    lab.label(`h = ${fmt(lift.h,1)} m`,[2.15,height+.2,-.35],c.danger);
    for(let h=0;h<=12;h++){
      const y=liftPoint(h)[1];lab.line([2.25,y,.1],[2.35+(h%2?0:.07),y,.1],c.text3,1);
      if(h%2===0)lab.label(`${h} m`,[2.62,y,.1]);
    }
    lab.rod([2.3,.15,.1],[2.3,2.65,.1],.012,c.text3,8);
    for(const [i,x]of [-1.2,1.1].entries()){
      const power=i?lift.P2:lift.P1,y=i?lift.y2:lift.y1,finished=i?lift.t2:lift.t1,loadY=.25+y*liftScale;
      const col=i?c.special:c.primary;
      lab.box(x-.8,.04,-.45,1.35,.12,1.0,c.bg2);
      for(const z of [-.18,.35]){
        lab.rod([x-.55,.15,z],[x-.55,2.85,z],.035,c.text3);
        lab.rod([x-.55,2.85,z],[x+.25,2.85,z],.035,c.text3);
        lab.rod([x-.55,2.4,z],[x-.1,2.85,z],.018,c.text3,8);
      }
      for(let yy=.3;yy<2.8;yy+=.25)lab.rod([x-.58,yy,-.18],[x-.58,yy,.35],.014,c.text3,8);
      lab.box(x-.55,2.75,-.08,.42,.25,.4,col);
      lab.rod([x,2.78,-.13],[x,2.78,.13],.14,c.text2,24);
      ring(lab,[x,2.78,-.15],.145,c.text2);
      const angle=-y/.15;lab.rod([x,2.78,-.17],[x+.12*Math.cos(angle),2.78+.12*Math.sin(angle),-.17],.015,col,8);
      lab.rod([x+.14,2.78,0],[x+.14,loadY+.28,0],.012,c.text,8);
      lab.box(x-.08,loadY,-.2,.44,.28,.4,c.warning);
      lab.rod([x-.06,loadY+.02,-.21],[x+.34,loadY+.26,-.21],.012,c.text2,8);
      lab.label(`${fmt(lift.m,0)} kg`,[x+.14,loadY+.45,-.2],c.warning);
      lab.box(x-.72,.17,-.85,.65,.65,.12,c.bg2);
      dial(lab,[x-.4,.52,-.88],(power-100)/2900,col,`k${i+1}`,`P${i?'₂':'₁'} = ${fmt(power,0)} W`);
      const tv=finished??(lift.phase==='ready'?0:lift.t);
      lab.label(`${fmt(tv,2)} s`,[x+.18,3.17,-.1],finished===null?c.text2:c.success);
      lab.label(`M${i+1}`,[x-.4,3.15,-.1],col);
      if(ui.show.vec&&lift.phase==='run'&&finished===null){const origin=[x+.48,loadY+.14,0];arrowSolid(lab,origin,[origin[0],origin[1]+Math.min(.8,P.liftSpeed(power,lift.m)*.15),0],col,.014);lab.label('v',[origin[0]+.13,origin[1]+.4,0],col);}
    }
    lab.label(`A₁ = A₂ = ${fmt(lift.m*P.G*lift.h,0)} J`,[0,.2,-1.18],c.success);
    lab.finish(lift.t,'Yuklar bir xil masshtabda · dastak ↕');
  }
  function drawPark(ctx,stage,ui,park) {
    const c=stage.colors,tr=park.tr,p=tr.at(park.s);lab.begin(ctx,stage,{target:[0,1.4,0],focal:1.7});
    const n=90;
    for(let i=0;i<n;i++){
      const a=tr.at(tr.L*i/n),b=tr.at(tr.L*(i+1)/n),a0=parkPoint(a.x,a.y,-.29),a1=parkPoint(a.x,a.y,.29),b0=parkPoint(b.x,b.y,-.29),b1=parkPoint(b.x,b.y,.29);
      lab.face([a0,b0,b1,a1],alpha(c.primary,.55));
      for(const z of [-.3,.3]){
        const A=parkPoint(a.x,a.y,z),B=parkPoint(b.x,b.y,z);
        lab.rod(A,B,.018,c.primary,8);
        lab.face([A,B,[B[0],B[1]-.09,z],[A[0],A[1]-.09,z]],c.text3);
      }
      if(i%9===0)for(const z of [-.3,.3]){const A=parkPoint(a.x,a.y,z);lab.rod([A[0],.04,z],A,.018,c.text3,8);lab.box(A[0]-.1,.02,z-.1,.2,.03,.2,c.text3);}
    }
    for(let i=1;i<(park.trail?.length||0);i++)lab.line(parkPoint(...park.trail[i-1],-.32),parkPoint(...park.trail[i],-.32),alpha(c.special,.4),1.4);
    const base=parkPoint(p.x,p.y),tx=p.tx*parkScale,ty=p.ty*parkHeight,norm=Math.hypot(tx,ty),t=[tx/norm,ty/norm,0],normal=[-ty/norm,tx/norm,0];
    const local=(x,y,z=0)=>[base[0]+t[0]*x+normal[0]*y,base[1]+t[1]*x+normal[1]*y,z];
    const solid=(x0,y0,z0,dx,dy,dz,col)=>lab.solid([[x0,y0,z0],[x0+dx,y0,z0],[x0+dx,y0+dy,z0],[x0,y0+dy,z0],[x0,y0,z0+dz],[x0+dx,y0,z0+dz],[x0+dx,y0+dy,z0+dz],[x0,y0+dy,z0+dz]].map(p=>local(...p)),col);
    solid(-.24,.075,-.16,.48,.045,.32,c.warning);
    for(const x of [-.16,.16])for(const z of [-.14,.14])lab.sphere(local(x,.05,z),.045,c.text2);
    for(const z of [-.07,.07]){lab.rod(local(0,.44,z),local(-.08,.27,z),.027,c.text2,8);lab.rod(local(-.08,.27,z),local(.06,.15,z),.027,c.text2,8);}
    lab.rod(local(0,.4),local(.02,.69),.075,c.primary,12);lab.sphere(local(.02,.84),.095,c.warning);
    for(const sign of [-1,1]){lab.rod(local(.02,.65,sign*.05),local(-.13,.53,sign*.16),.023,c.primary,8);lab.rod(local(-.13,.53,sign*.16),local(.1,.46,sign*.18),.022,c.warning,8);}
    lab.handle('sk',local(0,.5,-.2),.2);
    if(ui.show.vec&&Math.abs(park.v)>.05){const a=local(0,.4,-.3),len=clamp(park.v*.06,-.8,.8);arrowSolid(lab,a,[a[0]+t[0]*len,a[1]+t[1]*len,a[2]],c.success,.014);lab.label('v',[a[0]+t[0]*len,a[1]+t[1]*len+.15,a[2]],c.success);}
    park.pts.forEach(([x,y],i)=>{const pt=parkPoint(x,y,-.35);lab.sphere(pt,.055,c.special);lab.handle(`pt${i}`,pt,.12);lab.label(`${i+1}`,[pt[0],pt[1]+.18,pt[2]],c.special);});
    const refY=parkPoint(0,park.yref)[1];
    lab.face([[-2.8,refY,-.48],[2.8,refY,-.48],[2.8,refY,.5],[-2.8,refY,.5]],alpha(c.warning,.08));
    dashed(lab,[-2.8,refY,-.48],[2.8,refY,-.48],c.warning);
    lab.sphere([2.8,refY,-.48],.055,c.warning);lab.handle('ref',[2.8,refY,-.48],.14);lab.label('Eₚ = 0',[2.8,refY+.18,-.48],c.warning);
    const Ek=.5*park.m*park.v**2,Ep=park.m*park.g*(p.y-park.yref),Q=park.m*park.Q;
    meter([['Eₖ',Ek,c.success],['Eₚ',Ep,c.primary],['Q',Q,c.warning],['E',Ek+Ep+Q,c.text2]],park.Emax,c);
    lab.finish(0,`x/y masshtabi turlicha · g = ${fmt(park.g,2)} m/s²`);
  }
  function launcher(x,scale,freeY,ballY,c,enlarged=false) {
    const bottom=freeY-.25*scale,top=freeY+Math.min(.5,.08*scale),radius=enlarged?.13:.1;
    lab.box(x-.28,bottom-.1,-.28,.56,.1,.56,c.text3);
    for(const z of [-.2,.2])lab.rod([x-.25,bottom,z],[x-.25,top,z],.018,c.text3,8);
    // Rear cylindrical half-shell gives volume and leaves the spring visible.
    for(let i=0;i<18;i++){
      const a=i*Math.PI/18,b=(i+1)*Math.PI/18;
      lab.face([[x+radius*Math.cos(a),bottom,radius*Math.sin(a)],[x+radius*Math.cos(b),bottom,radius*Math.sin(b)],[x+radius*Math.cos(b),top,radius*Math.sin(b)],[x+radius*Math.cos(a),top,radius*Math.sin(a)]],alpha(c.primary,.15));
    }
    const cap=Math.min(freeY,ballY);
    helix(lab,[x,bottom,0],[x,cap,0],radius*.67,9,c.special,enlarged?.012:.008);
    lab.rod([x,cap-.015,0],[x,cap+.015,0],radius*.9,c.text2,24);
    lab.sphere([x,ballY+(enlarged?.09:.065),0],enlarged?.09:.065,c.warning);
    dashed(lab,[x-.4,freeY,-.03],[x+.4,freeY,-.03],c.text3);
    return bottom;
  }
  function drawSpring(ctx,stage,ui,spr) {
    const c=stage.colors,H=P.launchHeight(spr.k,spr.x,spr.m),range=Math.max(.6,H+spr.x+.3),scale=2.35/range,free=.32+.25*scale;
    lab.begin(ctx,stage,{target:[0,1.45,0],focal:1.7});
    launcher(-1.5,4,1.28,1.28+(spr.phase==='ready'?-spr.x:Math.max(-spr.x,Math.min(0,spr.y)))*4,c,true);
    lab.label(`Kesim ×4 · x = ${fmt(spr.x*100,1)} cm`,[-1.5,2.08,0],c.special);
    for(let cm=0;cm<=15;cm++){
      const y=1.28-cm*.04;lab.line([-2.05,y,0],[-1.95+(cm%5?0:.06),y,0],c.text3,1);if(cm%5===0)lab.label(`${cm} cm`,[-2.3,y,0]);
    }
    if(spr.phase!=='run'){const pt=springPoint(spr.x);ring(lab,pt,.105,c.warning,'z',.012);lab.handle('ball',pt,.16);}
    launcher(.85,scale,free,free+spr.y*scale,c);
    lab.label(`${fmt(spr.m*1000,0)} g`,[.85,free+spr.y*scale+.25,-.12],c.warning);
    const y0=free-spr.x*scale,ymax=free+(H-spr.x)*scale;
    dashed(lab,[.45,y0,-.2],[2.3,y0,-.2],c.text3);lab.label('H = 0',[2.4,y0,-.2]);
    dashed(lab,[.45,ymax,-.2],[2.3,ymax,-.2],c.success);
    lab.rod([2.05,y0,0],[2.05,ymax,0],.01,c.success,8);
    for(const y of [y0,ymax])lab.line([1.96,y,0],[2.14,y,0],c.success,1.5);
    lab.label(`H = ${fmt(H,2)} m`,[2.1,(y0+ymax)/2+.2,0],c.success);
    for(let i=0;i<=4;i++){const h=range*i/4,y=.32+h*scale;lab.line([1.5,y,.15],[1.6,y,.15],c.text3,1);lab.label(`${fmt(h,range<1?2:1)} m`,[1.8,y,.15]);}
    if(spr.ymax>=0){const y=free+spr.ymax*scale;lab.sphere([.85,y+.065,0],.035,alpha(c.warning,.35));lab.label('O‘lchangan cho‘qqi',[.65,y+.4,0],c.warning);}
    if(ui.show.vec&&spr.phase==='run'&&Math.abs(spr.v)>.01){const y=free+spr.y*scale+.065;arrowSolid(lab,[1.12,y,0],[1.12,y+clamp(spr.v*.12,-.6,.6),0],c.success,.014);lab.label('v',[1.3,y,0],c.success);}
    const springEnergy=.5*spr.k*Math.max(0,-spr.y)**2,Ek=.5*spr.m*spr.v**2,Ep=spr.m*P.G*(spr.y+spr.x);
    meter([['Eₚᵣ',springEnergy,c.special],['Eₖ',Ek,c.success],['Eₚ',Ep,c.primary]],.5*spr.k*spr.x**2,c);
    lab.finish(spr.t,'Chapda siqilish ×4 · H siqilgan nuqtadan');
  }
  return {
    lab,pullPoint,parkPoint,springPoint,liftPoint,
    forceAnchor(pull){const b=.6*Math.cbrt(pull.M/20);return pullPoint(pull.x+b,b/2,-.31);},
    parkHandle(park,s){const p=park.tr.at(s),tx=p.tx*parkScale,ty=p.ty*parkHeight,len=Math.hypot(tx,ty),q=parkPoint(p.x,p.y,-.2);return[q[0]-ty/len*.5,q[1]+tx/len*.5,q[2]];},
    parkPosition(x,y,z=-.35){const p=lab.planePoint(x,y,z);return p?{x:p[0]/parkScale+6,y:(p[1]-.16)/parkHeight}:null;},
    draw(ctx,stage,ui,pull,lift,park,spr){if(ui.mode==='work')(ui.sub==='lift'?drawLift(ctx,stage,ui,lift):drawPull(ctx,stage,ui,pull));else if(ui.mode==='park')drawPark(ctx,stage,ui,park);else drawSpring(ctx,stage,ui,spr);}
  };
}
