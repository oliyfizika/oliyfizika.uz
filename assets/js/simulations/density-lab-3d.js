// Bench apparatus; model quantities stay in g, cm³, cm and N.
import { createLab3D } from './lab-3d.js?v=20261123-batch6d';
import { alpha, arrowSolid, helix, ring, path } from './apparatus-3d.js?v=20261123-batch6d';
import { clamp, fmt } from './sim-kit.js';
import * as P from './density-physics.js';

const TAU=Math.PI*2;
export const cylinderY=volume=>.23+volume*3/250;
export const weightTrayPoint=i=>[.85+(i%3)*.77,.26,-1.24+Math.floor(i/3)*.62];
export const cylinderBounds=[[-.34,.2,-.47],[.64,3.33,.47]];

function hull(points) {
  const sorted=points.map(p=>({x:p.x,y:p.y})).sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),lower=[],upper=[];
  for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(const p of sorted.toReversed()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}
export function projectedContains(lab,bounds,p,padding=8) {
  const [lo,hi]=bounds,points=[];
  for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]])points.push(lab.project([x,y,z]));
  const polygon=hull(points);let inside=false,min=Infinity;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[j],b=polygon[i];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
    min=Math.min(min,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));
  }
  return inside||min<=padding;
}

export function createDensityLab() {
  const lab=createLab3D(),originalReset=lab.reset;
  lab.reset=()=>{originalReset();lab.camera.yaw=-.25;lab.camera.pitch=.5;};lab.reset();
  let panBounds,current,stageRef;
  const disk=(x,y,z,r,h,color,n=24)=>lab.rod([x,y,z],[x,y+h,z],r,color,n);
  function horizontalRing(x,y,z,r,color,width=.015,n=32) {
    for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n;lab.rod([x+r*Math.cos(a),y,z+r*Math.sin(a)],[x+r*Math.cos(b),y,z+r*Math.sin(b)],width,color,6);}
  }
  function materialColor(key) {
    const c=lab.colors;
    return ['wood','cork','copper','gold','brass','egg','paraffin'].includes(key)?c.warning:['ice','glass','plastic'].includes(key)?c.primary:c.text3;
  }
  function specimen(key,center,volume,bodies) {
    const b=bodies[key]||{shape:key==='egg'?'egg':'box',mat:key},color=materialColor(b.mat),v=.008*volume;
    let height;
    if(b.shape==='ball') {const r=Math.cbrt(v*3/(4*Math.PI));lab.sphere(center,r,color);height=r*2;}
    else if(b.shape==='cyl') {const r=Math.cbrt(v/(Math.PI*2.2)),h=2.2*r;disk(center[0],center[1]-h/2,center[2],r,h,color);horizontalRing(center[0],center[1]+h/2+.003,center[2],r*.82,lab.colors.bg2,.008);height=h;}
    else if(b.shape==='egg') {
      const r=Math.cbrt(v*3/(4*Math.PI*1.25));height=2.5*r;
      for(let i=0;i<12;i++)for(let j=0;j<18;j++){
        const at=(u,a)=>{const rr=r*Math.sin(u)*(1-.12*Math.cos(u));return[center[0]+rr*Math.cos(a),center[1]+1.25*r*Math.cos(u),center[2]+rr*Math.sin(a)];};
        lab.face([at(i*Math.PI/12,j*TAU/18),at((i+1)*Math.PI/12,j*TAU/18),at((i+1)*Math.PI/12,(j+1)*TAU/18),at(i*Math.PI/12,(j+1)*TAU/18)],color);
      }
    } else {
      const side=Math.cbrt(v);height=side;
      if(b.shape==='rock'){
        const p=[[-.5,-.5,-.5],[.5,-.5,-.5],[.42,.5,-.43],[-.4,.5,-.43],[-.5,-.5,.5],[.5,-.5,.5],[.38,.5,.42],[-.3,.5,.42]];
        lab.solid(p.map(q=>q.map((x,i)=>center[i]+x*side*1.075)),color);
      }else lab.box(center[0]-side/2,center[1]-side/2,center[2]-side/2,side,side,side,color);
      if(b.mat==='wood')for(let i=0;i<4;i++)lab.line([center[0]-side*.44,center[1]-side*.35+i*side*.22,center[2]-side/2-.002],[center[0]+side*.44,center[1]-side*.27+i*side*.22,center[2]-side/2-.002],lab.colors.text3,.7);
    }
    return height;
  }
  function weight(i,p,on=false) {
    const wg=P.WEIGHTS[i],c=lab.colors,r=wg>=1?.065+.019*Math.cbrt(wg):.11,h=wg>=1?.08+.035*Math.cbrt(wg):.018;
    if(wg>=1){disk(p[0],p[1],p[2],r,h,c.warning,16);disk(p[0],p[1]+h,p[2],r*.35,.04,c.warning,12);ring(lab,[p[0],p[1]+h+.06,p[2]],r*.33,c.warning,'z',.012);}
    else{lab.box(p[0]-r,p[1],p[2]-r*.65,r*2,h,r*1.3,c.text3);lab.line([p[0]-r,p[1]+h+.002,p[2]],[p[0]+r,p[1]+h+.002,p[2]],c.bg2,.7);}
    if(!on)lab.handle('weight-'+i,[p[0],p[1]+h*.5,p[2]],.14);
    return h;
  }
  function drawMass(mass,bodies) {
    const c=lab.colors,cx=-1.35,L=1.14,pivotY=2.6,th=mass.th;
    lab.box(cx-.55,.025,-.48,1.1,.13,.96,c.text3);
    lab.rod([cx,.15,.14],[cx,pivotY-.04,.14],.045,c.text2);
    lab.face([[cx-.22,.16,.2],[cx+.22,.16,.2],[cx,pivotY,.2]],c.bg2);
    const left=[cx-L*Math.cos(th),pivotY-L*Math.sin(th),0],right=[cx+L*Math.cos(th),pivotY+L*Math.sin(th),0];
    lab.rod(left,right,.055,c.text2);lab.rod([cx,pivotY,-.16],[cx,pivotY,.22],.085,c.warning,20);
    for(const [end,kind]of [[left,'left'],[right,'right']]){
      const y=end[1]-1.18;
      for(const z of [-.36,.36])for(const sign of [-1,1])lab.rod(end,[end[0]+sign*.36,y,z],.012,c.text3,6);
      disk(end[0],y-.05,0,.49,.04,c.text3);horizontalRing(end[0],y,0,.49,c.text2,.018);
      if(kind==='left'){
        const h=Math.cbrt(.008*bodies[mass.body].V);specimen(mass.body,[end[0],y+h*.55,0],bodies[mass.body].V,bodies);
        lab.label(bodies[mass.body].name,[end[0],y-.22,0],c.text2);
      }else{
        mass.pan.forEach((i,k)=>{const p=[end[0]+((k%3)-1)*.26,y+.015+Math.floor(k/3)*.15,((Math.floor(k/3)%2)-.5)*.2];const h=weight(i,p,true);lab.handle('pan-'+i,[p[0],p[1]+h*.5,p[2]],.12);});
        lab.label(`${fmt(P.sumWeights(mass.pan.map(i=>P.WEIGHTS[i])),1)} g`,[end[0],y-.22,0],c.warning);
        panBounds=[[end[0]-.61,y-.12,-.59],[end[0]+.61,y+.85,.59]];
      }
    }
    // Zero and sensitivity scale is fixed to the support, pointer follows beam.
    const pc=[cx,pivotY-.3,-.14];
    for(let k=-3;k<=3;k++){const a=k*.1;lab.line([pc[0]+Math.sin(a)*.48,pc[1]-Math.cos(a)*.48,pc[2]],[pc[0]+Math.sin(a)*(k?.54:.59),pc[1]-Math.cos(a)*(k?.54:.59),pc[2]],c.text3,1);}
    lab.rod([cx,pivotY,-.14],[cx+Math.sin(th)*.82,pivotY-Math.cos(th)*.82,-.14],.013,c.danger,8);
    lab.label('0',[pc[0],pc[1]-.66,-.15]);
    lab.box(.42,.025,-1.55,2.45,.1,3.1,c.text3);lab.box(.46,.125,-1.51,2.37,.025,3.02,c.bg2);
    P.WEIGHTS.forEach((wg,i)=>{
      const p=weightTrayPoint(i);disk(p[0],.155,p[2],.17,.012,c.sunken,16);
      if(!mass.pan.includes(i))weight(i,p);
      lab.label(wg>=1?`${fmt(wg,0)} g`:`${fmt(wg*1000,0)} mg`,[p[0],.7,p[2]],mass.pan.includes(i)?c.text3:c.text2);
    });
    lab.label('Gira toshlari',[1.65,.3,-1.65]);
    const bal=P.balanceAngle(P.sumWeights(mass.pan.map(i=>P.WEIGHTS[i]))-bodies[mass.body].m)===0;
    lab.label(bal?'Muvozanat':'Teng yelkali tarozi',[-1.35,3.03,0],bal?c.success:c.text2);
  }
  function drawCylinder(dens,bodies,drag) {
    const c=lab.colors,B=bodies[dens.body],V=dens.V1+(dens.inCyl?B.V:0),cx=.15,r=.46,bottom=.23,top=cylinderY(250),waterY=cylinderY(V);
    // Electronic scale and platform.
    lab.box(-2.75,.04,-.72,1.45,.25,1.1,c.bg2);lab.box(-2.61,.305,-.58,1.17,.045,.83,c.text3);
    lab.box(-2.58,.11,-.736,1.1,.12,.02,c.sunken);lab.label(`${fmt(dens.inCyl?0:B.m,1)} g`,[-2.02,.28,-.77],c.success);lab.label('Elektron tarozi',[-2.02,-.15,-1.0]);
    disk(cx,.05,0,.7,.09,c.text3,32);disk(cx,.14,0,.12,.09,c.text3,16);
    // Transparent cylindrical walls and water, actual volume-to-height calibration.
    disk(cx,bottom,0,r-.018,waterY-bottom,alpha(c.primary,.2),36);
    for(let i=0;i<36;i++){
      const a=i*TAU/36,b=(i+1)*TAU/36;
      lab.face([[cx+r*Math.cos(a),bottom,r*Math.sin(a)],[cx+r*Math.cos(b),bottom,r*Math.sin(b)],[cx+r*Math.cos(b),top,r*Math.sin(b)],[cx+r*Math.cos(a),top,r*Math.sin(a)]],alpha(c.primary,.075));
    }
    horizontalRing(cx,bottom,0,r,c.text3,.014);horizontalRing(cx,top,0,r,c.text3,.016);
    for(let i=0;i<36;i++){
      const a=i*TAU/36,b=(i+1)*TAU/36;
      lab.face([[cx,waterY,0],[cx+(r-.025)*Math.cos(a),waterY+.025,(r-.025)*Math.sin(a)],[cx+(r-.025)*Math.cos(b),waterY+.025,(r-.025)*Math.sin(b)]],alpha(c.primary,.32));
    }
    // Graduations are printed on the front of the glass. Fine divisions remain readable in the loupe.
    for(let v=10;v<=250;v+=10){const y=cylinderY(v),major=v%50===0;lab.line([cx-r+.03,y,-.455],[cx-r+(major?.25:.13),y,-.455],c.text3,1);if(major)lab.label(String(v),[cx-r-.22,y,-.46]);}
    lab.label('mL',[cx-.43,top+.19,-.46]);
    const sz=Math.cbrt(.008*B.V),by=dens.inCyl?bottom+sz*.6+dens.drop*Math.max(0,waterY-bottom-sz*1.3):.36+sz*.6;
    const at=dens.inCyl?[cx,by,0]:[-2.02,by,-.13];
    if(!drag||drag.id!=='body')specimen(dens.body,at,B.V,bodies);
    lab.handle('body',at,.23);
    if(dens.inCyl&&B.mat==='wood'){lab.rod([cx,by+sz*.5,0],[cx+.12,top+.17,0],.015,c.text2,8);lab.label('Igna bilan botirilgan',[cx,top+.43,0]);}
    const hp=[cx+r+.12,waterY,-.08];lab.sphere(hp,.04,c.primary);lab.handle('water',hp,.13);
    lab.label(dens.inCyl?'V₂':'V₁',[hp[0]+.13,hp[1]+.15,hp[2]],c.primary);
  }
  const floatPoint=(d)=>[0,2.8-.13*d+.34,-.25];
  function drawFloat(fl,cfg) {
    const c=lab.colors,liq=P.LIQUIDS[fl.liq],fluidColor=fl.liq==='mercury'?c.text3:['oil','kerosene'].includes(fl.liq)?c.warning:fl.liq==='alcohol'?c.special:c.primary,bottom=.15,surface=1.45,k=.13,bodyTop=surface+(5-cfg.d)*k,bodyBottom=bodyTop-5*k;
    const fd=P.floatDepth(cfg),heldDepth=fd!==null?Math.min(fl.d,fd):fl.d,dynBottom=2.8-.13*heldDepth,read=fl.free?0:P.springReading(cfg);
    // Rigid glass vessel; the bath is intentionally broad so its level is unchanged.
    lab.box(-1.1,.04,-.8,2.2,.11,1.6,c.text3);
    lab.box(-1.04,bottom,-.74,2.08,surface-bottom,1.48,alpha(fluidColor,fl.liq==='mercury'?.42:.18));
    lab.face([[-1.04,surface,-.74],[1.04,surface,-.74],[1.04,surface,.74],[-1.04,surface,.74]],alpha(fluidColor,.3));
    lab.line([-1.04,surface,-.74],[1.04,surface,-.74],fluidColor,1.4);
    for(const x of [-1.07,1.04])lab.box(x,.15,-.77,.03,1.64,1.54,alpha(fluidColor,.09));
    for(const z of [-.77,.74])lab.box(-1.07,.15,z,2.14,1.64,.03,alpha(fluidColor,.09));
    for(const z of [-.77,.77])lab.rod([-1.08,1.8,z],[1.08,1.8,z],.018,c.text3,8);
    for(const x of [-1.08,1.08])lab.rod([x,1.8,-.77],[x,1.8,.77],.018,c.text3,8);
    lab.label(`${liq.name} · ${fmt(liq.rho*1000,0)} kg/m³`,[0,.05,-1.0],fluidColor);
    // Retort stand and sliding dynamometer carriage.
    lab.box(-1.8,.03,.3,.5,.1,.6,c.text3);lab.rod([-1.55,.13,.6],[-1.55,3.65,.6],.035,c.text3);
    lab.rod([-1.55,3.65,.6],[0,3.65,.6],.035,c.text3);lab.rod([0,3.65,.6],[0,dynBottom+.68,0],.014,c.text2,8);
    lab.box(-.2,dynBottom,-.2,.4,.68,.4,c.bg2);
    helix(lab,[-.08,dynBottom+.6,-.01],[-.08,dynBottom+.24-read/10*.15,-.01],.055,7,c.text3,.009);
    for(let n=0;n<=10;n++){const y=dynBottom+.57-n*.043;lab.line([.04,y,-.207],[n%2?.11:.16,y,-.207],c.text3,.7);}
    const ny=dynBottom+.57-clamp(read/10,0,1)*.43;lab.rod([.04,ny,-.22],[.17,ny,-.22],.013,c.danger,8);
    lab.label(`${fmt(read,3)} N`,[.49,dynBottom+.43,-.25],c.success);lab.handle('dyn',[0,dynBottom+.34,-.25],.22);
    lab.rod([0,dynBottom,0],[0,dynBottom-.08,0],.016,c.text2,8);
    if(!fl.free){
      if(read>1e-6)lab.rod([0,dynBottom-.08,0],[0,bodyTop,0],.012,c.text2,8);
      else path(lab,[[0,dynBottom-.08,0],[.2,(dynBottom+bodyTop)/2,-.04],[0,bodyTop,0]],c.text3,.01);
    }else{lab.rod([0,dynBottom-.08,0],[.03,dynBottom-.22,0],.012,c.text3,8);lab.rod([0,bodyTop,0],[-.03,bodyTop+.12,0],.01,c.text3,8);}
    if(fl.mat==='egg')specimen('egg',[0,(bodyTop+bodyBottom)/2,0],80,{});
    else{const col=materialColor(fl.mat);lab.box(-.26,bodyBottom,-.26,.52,.65,.52,col);if(fl.mat==='wood')for(let i=0;i<4;i++)lab.line([-.23,bodyBottom+.08+i*.14,-.263],[.23,bodyBottom+.12+i*.14,-.263],c.text3,.7);}
    const b=P.buoyancy(cfg),mg=P.weight(cfg.m),s=.62/Math.max(mg,b.FA,.05),mid=(bodyTop+bodyBottom)/2;
    arrowSolid(lab,[-.55,mid,-.42],[-.55,mid-mg*s,-.42],c.danger,.015);lab.label('mg',[-.66,mid-mg*s-.12,-.42],c.danger);
    if(b.FA>1e-5){arrowSolid(lab,[.55,mid,-.42],[.55,mid+b.FA*s,-.42],c.primary,.015);lab.label('Fₐ',[.69,mid+b.FA*s+.12,-.42],c.primary);}
    if(read>1e-5){arrowSolid(lab,[0,bodyTop,-.35],[0,bodyTop+read*s,-.35],c.success,.012);lab.label('T',[.15,bodyTop+read*s,-.35],c.success);}
    lab.box(1.45,.04,-.86,.85,.15,.58,c.bg2);lab.rod([1.87,.2,-.55],[1.87,.25,-.55],.15,fl.free?c.success:c.danger,24);
    lab.handle('cut',[1.87,.25,-.55],.18);lab.label(fl.free?'Qayta osish':'Ipni kesish',[1.87,.6,-.55],fl.free?c.success:c.danger);
    lab.label(P.MATERIALS[fl.mat].name,[0,bodyTop+.16,0],c.text2);
  }
  function loupe(ctx,stage,dens,bodies) {
    const c=stage.colors,narrow=stage.w<560,lw=narrow?106:138,lh=narrow?134:158,lx=stage.w-lw-10,ly=40,V=dens.V1+(dens.inCyl?bodies[dens.body].V:0),cy=ly+lh/2+6,k=(lh-34)/24;
    ctx.save();ctx.fillStyle=c.bg2;ctx.strokeStyle=c.borderStrong;ctx.lineWidth=1.3;ctx.beginPath();ctx.roundRect(lx,ly,lw,lh,8);ctx.fill();ctx.stroke();
    ctx.fillStyle=c.text2;ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText('Lupa · 2 mL',lx+lw/2,ly+7);
    ctx.beginPath();ctx.rect(lx+2,ly+25,lw-4,lh-28);ctx.clip();
    ctx.fillStyle=alpha(c.primary,.22);ctx.beginPath();ctx.moveTo(lx+2,cy-5);ctx.quadraticCurveTo(lx+lw/2,cy+5,lx+lw-2,cy-5);ctx.lineTo(lx+lw-2,ly+lh);ctx.lineTo(lx+2,ly+lh);ctx.closePath();ctx.fill();
    ctx.strokeStyle=c.primary;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(lx+2,cy-5);ctx.quadraticCurveTo(lx+lw/2,cy+5,lx+lw-2,cy-5);ctx.stroke();
    ctx.font='600 11px system-ui';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=c.text;ctx.strokeStyle=c.text3;ctx.lineWidth=1;
    for(let v=Math.floor((V-14)/2)*2;v<=V+14;v+=2){if(v<0||v>250)continue;const y=cy-(v-V)*k,big=v%10===0;ctx.beginPath();ctx.moveTo(lx+2,y);ctx.lineTo(lx+(big?24:13),y);ctx.stroke();if(big)ctx.fillText(String(v),lx+29,y);}
    ctx.restore();ctx.save();ctx.font='10px system-ui';ctx.fillStyle=c.text3;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText('Menisk pastidan',lx+lw/2,ly+lh+4);ctx.restore();
  }
  function dragOverlay(ctx,stage,drag,bodies) {
    if(!drag?.point)return;
    const p=drag.point,c=stage.colors;ctx.save();ctx.fillStyle=c.bg2;ctx.strokeStyle=c.primary;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,13,0,TAU);ctx.fill();ctx.stroke();ctx.font='600 10px system-ui';ctx.fillStyle=c.text;ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText(drag.id==='body'?bodies[current.dens.body].name:`${fmt(P.WEIGHTS[drag.i],1)} g`,p.x,p.y-18);ctx.restore();
  }
  return {lab,floatPoint,draw(ctx,stage,ui,mass,dens,fl,bodies,cfg,drag=null){
    stageRef=stage;current={ui,mass,dens,fl,bodies,cfg};
    lab.begin(ctx,stage,{target:ui.mode==='dens'?[.15,1.6,0]:ui.mode==='mass'?[0,1.5,0]:[0,1.8,0],focal:ui.mode==='float'?1.5:1.65});
    if(ui.mode==='mass')drawMass(mass,bodies);else if(ui.mode==='dens')drawCylinder(dens,bodies,drag);else drawFloat(fl,cfg);
    lab.finish(0,ui.mode==='mass'?'Teng yelkalar · toshlar: g va mg':ui.mode==='dens'?'Menzurka: 250 mL · bo‘lim 2 mL':'Idish kesimi · jism: 4 × 4 × 5 cm');
    if(ui.mode==='dens')loupe(ctx,stage,dens,bodies);
    dragOverlay(ctx,stage,drag,bodies);
  },inPan(p){return panBounds&&projectedContains(lab,panBounds,p,12);},inCylinder(p){return projectedContains(lab,cylinderBounds,p,5);},
  depth(p){return lab.nearest(floatPoint,0,8,p.x,p.y);},
  water(p){const d=current.dens,B=current.bodies[d.body];return lab.nearest(v=>[.15+.46+.12,cylinderY(v+(d.inCyl?B.V:0)),-.08],40,140,p.x,p.y);},
  get stage(){return stageRef;}};
}
