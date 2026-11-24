// Calorimetry and heating apparatus; enthalpy calculations remain in heat-physics.js.
import { createLab3D } from './lab-3d.js?v=20261123-batch8d';
import { alpha, path, ring, dial, helix, stand } from './apparatus-3d.js?v=20261123-batch8d';
import { clamp, fmt } from './sim-kit.js';
import { TOf, phaseOf, PHASE_NAMES, FUELS } from './heat-physics.js';

const TAU=2*Math.PI;
export function createHeatLab(){
  const lab=createLab3D();
  function shell(x,y,z,r,h,color,cut=false){
    const n=40;
    for(let i=0;i<n;i++){
      const a=i*TAU/n,b=(i+1)*TAU/n;
      // Open near quarter exposes the inside of the insulating jacket / crucible.
      if(cut&&Math.sin((a+b)/2)<-.45)continue;
      const p=t=>[x+r*Math.cos(t),y,z+r*Math.sin(t)],q=t=>[x+r*Math.cos(t),y+h,z+r*Math.sin(t)];
      lab.face([p(a),p(b),q(b),q(a)],color);
    }
    for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n;lab.line([x+r*Math.cos(a),y+h,z+r*Math.sin(a)],[x+r*Math.cos(b),y+h,z+r*Math.sin(b)],lab.colors.text3,1);}
  }
  const cylinder=(x,y,z,r,h,color)=>lab.rod([x,y,z],[x,y+h,z],r,color,28);
  function beaker(x,y,z,r,h,level,color,cut=false){
    const c=lab.colors;
    cylinder(x,y,z,r,.035,c.text3);
    if(level>.001)cylinder(x,y+.036,z,r*.94,Math.min(level,h-.07),alpha(color,.32));
    shell(x,y,z,r,h,cut?c.bg2:alpha(c.text3,.13),cut);
    for(let i=1;i<=4;i++){
      const yy=y+h*i/5;lab.line([x+r*.55,yy,z-r*.86],[x+r*.83,yy,z-r*.6],c.text3,.8);
    }
  }
  function thermometer(x,y,z,T,lo,hi,id){
    const c=lab.colors,top=y+1.55,fill=clamp((T-lo)/(hi-lo),0,1);
    lab.rod([x,y,z],[x,top,z],.035,alpha(c.text3,.25),12);
    cylinder(x,y,z,.014,1.5*fill,c.danger);lab.sphere([x,y,z],.04,c.danger);
    for(let i=0;i<=4;i++){const yy=y+i*.375;lab.line([x+.04,yy,z],[x+.12,yy,z],c.text3);}
    lab.label(fmt(T,Math.abs(T)<100?1:0)+' °C',[x,top+.22,z],c.danger);
    if(id){const p=[x,y+1.5*fill,z];ring(lab,p,.055,c.warning,'z',.008);lab.handle(id,p,.17);}
  }
  function dot(p,r,col){
    const a=[[r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]].map(q=>q.map((v,i)=>v+p[i]));
    for(const f of [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]])lab.face(f.map(i=>a[i]),col);
  }
  function knobs(mix){
    const c=lab.colors,bs=mix.bodies.filter(b=>!b.cup);
    for(const b of bs){
      const i=b.i,cfg=mix.cfg[i],x=-2+i*1.75;
      lab.box(x-.43,.04,-1.48,.86,.35,.35,c.bg2);
      dial(lab,[x-.2,.24,-1.5],cfg.m,c.primary,'mass'+i,'m'+(i+1));
      const lo=b.kind.tMin,hi=b.kind.tMax;
      dial(lab,[x+.2,.24,-1.5],(cfg.t-lo)/(hi-lo),c.danger,'temp'+i,'t'+(i+1));
      lab.label(fmt(cfg.m,2)+' kg · '+fmt(cfg.t,0)+' °C',[x,.72,-1.43],c.text2);
    }
  }
  function mixScene(mix,time){
    const c=lab.colors,bs=mix.bodies,inside=mix.started&&mix.drop>=1,u=mix.started?mix.drop:0,e=u*u*(3-2*u),cx=-.9,base=.2,r=.72,H=1.65;
    const first=bs.find(b=>!b.cup),active=bs.filter(b=>!b.cup);
    let vol=0,energy=0,capacity=0;
    for(const [k,b]of active.entries()){
      const ph=phaseOf(b.s,b.h),fraction=k===0?1:e;
      const lm=b.m*ph.liquid*(b.kind.metal?0:1)*fraction;
      vol+=lm/b.s.rho;energy+=lm*b.s.cl*TOf(b.s,b.h);capacity+=lm*b.s.cl;
    }
    const T=capacity?energy/capacity:TOf(first.s,first.h),level=.08+Math.min(1.2,vol*1300);
    const surface=base+.036+level,probeY=base+.036+Math.min(.16,level*.5),steamTipY=base+.04+Math.min(.18,level*.4);
    lab.box(cx-.9,.02,-.9,1.8,.12,1.8,c.text3);
    beaker(cx,base,0,r,H,level,c.primary);
    shell(cx,base-.02,0,r+.12,H+.02,c.bg2,true);
    lab.label('Kalorimetr · ochiq kesim',[cx,2.7,.1]);
    const ph=phaseOf(first.s,first.h);
    if(ph.vapor>.01)for(let i=0;i<12;i++){const t=(time*.35+i/12)%1;dot([cx+Math.sin(i*2.4)*.3,base+level+t*.6,Math.cos(i*2.4)*.2],.025,alpha(c.text3,1-t));}
    thermometer(cx+.42,probeY,-.25,T,-40,150);
    const sx=cx-.36,ang=mix.started&&!mix.done?time*2:0;
    lab.rod([sx,base+.12,0],[sx,2.3,0],.018,c.text3,8);
    lab.rod([sx-Math.cos(ang)*.23,base+.13,-Math.sin(ang)*.23],[sx+Math.cos(ang)*.23,base+.13,Math.sin(ang)*.23],.025,c.text3,8);
    for(const [j,b]of active.slice(1).entries()){
      const home=[1.1+j*1.25,.15,.1],target=[cx-.22+j*.4,base+.08,0];
      const pos=home.map((v,i)=>v+(target[i]-v)*e);pos[1]+=Math.sin(Math.PI*e)*1.7;
      const T0=TOf(b.s,b.h),p=phaseOf(b.s,b.h),solid=Math.max(0,1-p.liquid-p.vapor);
      if(b.kind.metal){
        const size=Math.cbrt(b.m/b.s.rho)*6;
        if(!mix.started&&b.cfg.t>=80&&b.cfg.t<=100){beaker(home[0],.15,home[2],.43,.8,.57,c.primary);}
        else if(!mix.started&&b.cfg.t>100){lab.box(home[0]-.42,.04,home[2]-.4,.84,.11,.8,c.bg2);lab.rod([home[0]-.35,.16,home[2]],[home[0]+.35,.16,home[2]],.035,c.danger,10);}
        lab.box(pos[0]-size/2,pos[1],pos[2]-size/2,size,size,size,b.cfg.kind==='unknown'&&!mix.reveal?c.text3:b.s.color);
        if(!inside){const top=pos[1]+size;lab.rod([pos[0],top,pos[2]],[pos[0],top+.38,pos[2]],.01,c.text2,6);}
      }else if(b.kind.branch==='solid'){
        const n=4,size=.24*Math.cbrt(Math.max(solid,0)*b.m/.05);
        if(size>.015)for(let i=0;i<n;i++){
          const x=inside?cx-.25+(i%2)*.34:pos[0]-.2+(i%2)*.25,y=inside?base+level-size*.85:pos[1]+Math.floor(i/2)*size*.7;
          lab.box(x,y,Math.floor(i/2)*.22-.12,size,size,size,alpha(c.primary,.42));
        }
      }else if(b.kind.branch==='gas'){
        // Generator remains on its tripod; steam enters below the calorimeter surface.
        beaker(home[0],.65,home[2],.42,.65,.35,c.primary);
        for(const dx of [-.3,.3])lab.rod([home[0]+dx,.08,home[2]],[home[0]+dx,.65,home[2]],.025,c.text3,8);
        cylinder(home[0],.06,home[2],.24,.2,c.text3);
        path(lab,[[home[0],1.3,home[2]],[home[0],2.15,home[2]],[cx+.2,2.15,home[2]],[cx+.2,steamTipY,home[2]]],alpha(c.text3,.55),.035);
        if(mix.started&&p.vapor>.001)for(let i=0;i<8;i++){const f=(time*.7+i/8)%1;dot([cx+.2+.08*Math.sin(i),steamTipY+f*Math.max(.01,surface-steamTipY-.04),.1],.025,c.bg2);}
      }else if(!inside){
        beaker(pos[0],pos[1],pos[2],.4,.9,.65*(1-e),c.primary);
        if(e>.05&&e<.95)path(lab,[[pos[0]-.35,pos[1]+.8,0],[cx+.4,base+level,0]],alpha(c.primary,.55),.035);
      }
      if(!inside)lab.label(b.label+' · '+fmt(b.m,2)+' kg',[home[0],2.48,home[2]],c.text2);
      else lab.label(b.label+': '+fmt(T0,1)+' °C',[cx-.4+j*.8,base+H+.3,-.2],b.color);
    }
    knobs(mix);
  }
  function heatScene(heat,time){
    const c=lab.colors,b=heat.body,s=b.s,T=TOf(s,b.h),ph=phaseOf(s,b.h),cx=-1,base=.8,r=.65,H=1.45,solid=Math.max(0,1-ph.liquid-ph.vapor),on=heat.started&&heat.on&&!heat.done;
    const vessel=s.metal||s.tm>150;
    beaker(cx,base,0,r,H,.8*ph.liquid,c.primary,vessel);
    if(vessel)lab.label('Tigel · ochiq kesim',[cx,2.85,0]);
    if(solid>.001||s.amorphous&&ph.phase==='soft'){
      const size=.65*Math.cbrt(s.amorphous?Math.max(.1,1-ph.liquid):solid);
      const y=base+.04+(s===b.s&&s.short==='Suv'&&ph.liquid>.1?.8*ph.liquid-size*.8:0);
      lab.box(cx-size/2,y,-size/2,size,size*(s.amorphous?.7:1),size,s.short==='Suv'?alpha(c.primary,.4):s.color);
    }
    thermometer(cx+.35,base+.12,-.2,T,-40,Math.max(120,Number.isFinite(s.tb)?Math.min(s.tb,Math.max(s.tm+120,160)):160));
    stand(lab,cx-.85,.4,2.9,c.text3);
    lab.rod([cx-.85,2.7,.4],[cx+.35,2.7,-.2],.025,c.text3,8);
    lab.rod([cx+.35,2.7,-.2],[cx+.35,2.45,-.2],.018,c.text3,8);
    if(heat.cfg.src==='electric'){
      lab.box(cx-.72,.08,-.65,1.44,.45,1.3,c.bg2);
      cylinder(cx,.53,0,.68,.12,c.text3);
      const pts=[];for(let i=0;i<100;i++){const a=i*.2,rr=.05+.005*i;pts.push([cx+rr*Math.cos(a),.66,rr*Math.sin(a)]);}path(lab,pts,on?c.danger:c.text3,.016);
      path(lab,[[cx+.7,.25,.35],[.6,.25,.6],[1.4,.3,.6]],c.text3,.025);
    }else{
      for(const z of [-.4,.4])for(const dx of [-.4,.4])lab.rod([cx+dx,.05,z],[cx+dx,.78,z],.024,c.text3,8);
      if(['wood','coal'].includes(heat.cfg.fuel)){
        lab.box(cx-.5,.05,-.4,1,.15,.8,c.text3);
        for(let i=0;i<3;i++)lab.rod([cx-.35,.25,-.24+i*.2],[cx+.35,.25,-.24+i*.2],.07,heat.cfg.fuel==='coal'?c.text3:c.warning,8);
      }else{cylinder(cx,.04,0,.28,.28,alpha(c.primary,.3));cylinder(cx,.32,0,.065,.1,c.text3);}
      if(on)for(let i=0;i<7;i++){const a=i*TAU/7,p=[cx+.15*Math.cos(a),.42,.15*Math.sin(a)],tip=[cx+.05*Math.cos(a),.72+.045*Math.sin(time*8+i),.05*Math.sin(a)];lab.rod(p,tip,.03,c.warning,6);}
      lab.label(FUELS[heat.cfg.fuel].name,[cx,.2,-.8]);
    }
    if(ph.phase==='boiling')for(let i=0;i<12;i++){const f=(time*.6+i/12)%1;ring(lab,[cx+.32*Math.sin(i*2.4),base+.08+f*.7,.25*Math.cos(i*2.4)],.025,c.bg2,'z',.006);}
    if(ph.vapor>.001||ph.phase==='boiling')for(let i=0;i<12;i++){const f=(time*.2+i/12)%1;dot([cx+.4*Math.sin(i*2.4),base+H+f*.6,.3*Math.cos(i*2.4)],.025,alpha(c.text3,(1-f)*.5));}
    lab.box(.75,.05,-.9,1.55,.52,.8,c.bg2);
    const power=heat.cfg.src==='electric'?heat.cfg.P:heat.cfg.rate,min=heat.cfg.src==='electric'?50:.5,max=heat.cfg.src==='electric'?3000:20;
    dial(lab,[1.12,.34,-.93],(power-min)/(max-min),c.primary,'power',heat.cfg.src==='electric'?'P':'q̇');
    dial(lab,[1.86,.34,-.93],heat.cfg.m/2,c.warning,'massH','m');
    lab.label(heat.cfg.src==='electric'?fmt(power,0)+' W':fmt(power,1)+' g/min',[1.1,.92,-.88],c.primary);
    lab.label(fmt(heat.cfg.m,2)+' kg',[1.88,.92,-.88],c.warning);
    cylinder(2.55,.12,-.7,.13,.13,heat.on?c.success:c.danger);lab.handle('heater',[2.55,.3,-.7],.2);
    lab.label(heat.on?'Yoqilgan':'O‘chiq',[2.6,.83,-.75],heat.on?c.success:c.danger);
    // Molecular enlargement is separate from the real vessel and explicitly marked.
    lab.box(.75,1.35,.1,1.85,1.3,.65,alpha(c.text3,.06));
    const n=36,ns=Math.round(n*solid),nl=Math.round(n*ph.liquid),amp=Math.sqrt(Math.max(1,T+273)/273)*.025;
    for(let i=0;i<n;i++){
      const solidMode=i<ns,liquid=i<ns+nl;
      const x=solidMode?(i%6)/6:((i*.618+time*(liquid?.04:.15))%1),y=solidMode?Math.floor(i/6)/6:((i*.381+time*(liquid?.03:.18))%1),z=((i*.271+time*.05)%1);
      dot([.86+x*1.6+(solidMode?Math.sin(time*8+i)*amp:0),1.43+y*(liquid?.5:1.1),.15+z*.45],.035,liquid||solidMode?c.primary:c.text3);
    }
    lab.label('Molekulyar model: '+PHASE_NAMES[ph.phase],[1.65,2.95,.4]);
    lab.label(s.short+' · '+PHASE_NAMES[ph.phase],[cx,3.2,0]);
  }
  return {lab,
    draw(ctx,stage,ui,mix,heat,time){lab.begin(ctx,stage,{target:[0,1.45,0],focal:1.65});if(ui.mode==='mix')mixScene(mix,time);else heatScene(heat,time);lab.finish(ui.mode==='mix'?mix.t:heat.t,'Moslama kesimi · molekulalar kattalashtirilgan');},
  };
}
