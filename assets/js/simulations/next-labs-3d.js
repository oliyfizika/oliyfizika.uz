// Physical apparatus for the next laboratory scenes. Models and graphs stay unchanged.
import { createLab3D } from './lab-3d.js?v=20261122';
import { DEG, clamp, fmt } from './sim-kit.js';
import { fieldLines } from './inverse-square.js';
import { SHAPES, reducedLength, gyr2, pivotReaction, omega2 } from './physical-pendulum-physics.js';

export function createPhysicalPendulumLab() {
  const lab=createLab3D();
  let scale=1,grips=new Map();
  const pivot=[0,2.15,0];
  const localPoint=(u,x,th,z=0)=>[
    scale*(u*Math.sin(th)+x*Math.cos(th)),
    pivot[1]+scale*(-u*Math.cos(th)+x*Math.sin(th)),z,
  ];
  function draw(ctx,stage,P,s,ghost,show) {
    const half=SHAPES[P.shape].half(P.S);
    const reach=Math.hypot(P.d+half,P.shape==='plate'?P.S/4:half);
    scale=1.65/reach;grips=new Map();
    lab.begin(ctx,stage,{target:[0,1.55,0],focal:1.5});
    const c=lab.colors;
    lab.box(-.65,.02,-1.0,1.3,.12,.85,c.text3);
    lab.rod([0,.14,-.7],[0,2.35,-.7],.05,c.text3);
    lab.rod([0,2.15,-.7],[0,2.15,.2],.045,c.text2);
    lab.rod([0,2.15,.13],[0,2.15,.23],.075,c.primary);
    lab.line(pivot,[0,pivot[1]-1.7,0],c.borderStrong,1);
    const cm=localPoint(P.d,0,s.th);
    const bodyColor=c.primary,thickness=.08;
    if(P.shape==='rod') {
      lab.rod(localPoint(P.d-half,0,s.th),localPoint(P.d+half,0,s.th),Math.max(.025,.022*P.S*scale),bodyColor);
      for(let i=0;i<=20;i++) {
        const u=P.d-half+P.S*i/20;
        lab.line(localPoint(u,-.025*P.S,s.th,.04),localPoint(u,i%5===0?.07*P.S:.04*P.S,s.th,.04),c.bg,1);
      }
    } else if(P.shape==='plate') {
      const point=(x,u,z)=>localPoint(u,x,s.th,z),lo=P.d-half,hi=P.d+half,hw=P.S/4;
      lab.solid([point(-hw,lo,-thickness),point(hw,lo,-thickness),point(hw,hi,-thickness),point(-hw,hi,-thickness),point(-hw,lo,thickness),point(hw,lo,thickness),point(hw,hi,thickness),point(-hw,hi,thickness)],bodyColor);
    } else if(P.shape==='disk') {
      lab.rod([cm[0],cm[1],-thickness],[cm[0],cm[1],thickness],half*scale,bodyColor,48);
      lab.line(localPoint(P.d,0,s.th,.09),localPoint(P.d+half,0,s.th,.09),c.bg,1.5);
    } else if(P.shape==='ring') {
      for(let i=0;i<48;i++) {
        const a=i*Math.PI/24,b=(i+1)*Math.PI/24;
        lab.rod(localPoint(P.d+half*Math.cos(a),half*Math.sin(a),s.th),localPoint(P.d+half*Math.cos(b),half*Math.sin(b),s.th),.035*P.S*scale,bodyColor,8);
      }
      for(let i=0;i<4;i++) {
        const a=i*Math.PI/2;
        lab.rod(cm,localPoint(P.d+half*Math.cos(a),half*Math.sin(a),s.th),.012,c.text3,8);
      }
    } else {
      lab.rod(pivot,cm,.012,c.text2);
      lab.sphere(cm,half*scale,bodyColor);
    }
    // Sample the actual body, rather than the screen rectangle, for orbit-safe dragging.
    const addGrip=(u,x=0)=>{
      if(Math.hypot(u,x)*scale<.18)return;
      const id=`body-${grips.size}`;grips.set(id,{u,x});lab.handle(id,localPoint(u,x,s.th),.14);
    };
    for(let i=0;i<=12;i++) {
      const u=P.d-half+P.S*i/12;
      if(P.shape==='rod')addGrip(u);
      else if(P.shape==='plate')for(const x of [-P.S/4,0,P.S/4])addGrip(u,x);
      else if(P.shape==='ball')addGrip(P.d);
      else {const a=i*Math.PI/6;addGrip(P.d+half*Math.cos(a),half*Math.sin(a));}
    }
    if(show.center) {
      lab.sphere([cm[0],cm[1],.12],.045,c.warning);
      lab.label('C',[cm[0]-.22,cm[1],.15],c.warning);
      const L=reducedLength(gyr2(P.shape,P.S),P.d);
      const end=localPoint(L,0,s.th,.12);
      // Conjugate point may be far outside the body: keep the scene scale stable.
      if(L*scale<2.25){lab.sphere(end,.04,c.success);lab.label('O′',[end[0]+.25,end[1],.15],c.success);}
      else lab.label(`O′: L = ${fmt(L,2)} m`,[1.2,2.6,.1],c.success);
    }
    lab.label('O',[.2,2.2,.25]);
    lab.label(`d = ${fmt(P.d,3)} m`,[-.9,2.6,.1]);
    if(show.ghost) {
      const b=localPoint(P.d,0,ghost.th,-.18);
      lab.rod([0,2.15,-.18],b,.01,c.text3);
      lab.sphere(b,.065,c.text3);
      lab.label('Matematik model',[b[0],b[1]-.2,-.18]);
    }
    if(show.forces) {
      lab.vector([cm[0],cm[1],.2],[0,-.6,0],c.special,'mg');
      const w2=omega2(gyr2(P.shape,P.S),P.d,P.g);
      const reaction=pivotReaction(P,s.th,s.w,-w2*Math.sin(s.th)-P.gamma*s.w);
      const f=.6/(P.m*P.g),mag=Math.hypot(reaction.x,reaction.y)*f,cap=mag>1.1?1.1/mag:1;
      lab.vector([0,2.15,.25],[reaction.x*f*cap,reaction.y*f*cap,0],c.success,'R');
    }
    if(show.velocity) {
      const v=clamp(P.d*s.w/Math.sqrt(P.g*P.d)*.65,-1,1);
      lab.vector([cm[0],cm[1],.2],[v*Math.cos(s.th),v*Math.sin(s.th),0],c.warning,'vC');
    }
    lab.finish(s.t,'Qattiq jism · o‘lchamlar bir xil masshtabda · vektorlar shartli');
  }
  return {lab,draw,angle(id,x,y){const g=grips.get(id);return g?lab.nearest(th=>localPoint(g.u,g.x,th),-175*DEG,175*DEG,x,y):null;}};
}

export function createInverseSquareLab(kind) {
  const lab=createLab3D();
  let scale=1,range={min:.1,max:1},cache={key:'',lines:[]};
  const height=1.12;
  const position=r=>[-r*scale/2,height,0];
  function draw(ctx,stage,config,show) {
    const {r,rMin,rMax,a,b,force,space=false,eps=1}=config;
    scale=4.2/rMax;range={min:rMin,max:rMax};
    lab.begin(ctx,stage,{target:[0,1.05,0],focal:1.7});
    const c=lab.colors,sep=r*scale;
    const col=q=>q>0?c.danger:q<0?c.primary:c.text3;
    const electric=kind==='electric';
    const bodies=[{...a,x:-sep/2},{...b,x:sep/2}];
    const limit=Math.max(.035,sep*.44);
    const rad=b=>electric?Math.min(.12+.1*Math.sqrt(Math.abs(b.q)/10),limit):space?b.radius:Math.max(.025,b.radius*scale);
    // Two insulated supports on a calibrated rail. Space mode is a scale model, not an orbit animation.
    lab.box(-2.55,.02,-.3,5.1,.12,.6,c.bg2);
    for(const z of [-.25,.25])lab.rod([-2.5,.16,z],[2.5,.16,z],.018,c.text3);
    for(let i=0;i<=20;i++)lab.line([-2.1+i*.21,.16,.31],[-2.1+i*.21,.16,i%5===0?.48:.39],c.text2,1);
    for(const [i,body]of bodies.entries()) {
      const radius=rad(body),color=electric?col(body.q):space?body.color:c.text3;
      lab.box(body.x-.18,.16,-.26,.36,.08,.52,c.text3);
      lab.rod([body.x,.24,0],[body.x,height-radius,0],.025,c.borderStrong);
      if(body.station) {
        lab.box(body.x-.09,height-.06,-.12,.18,.12,.24,c.text3);
        for(const side of [-1,1])lab.box(body.x+side*.25-.1,height-.015,-.3,.2,.03,.6,c.primary);
      } else lab.sphere([body.x,height,0],radius,color);
      lab.handle(i===0?'left':'right',[body.x,height,0],Math.max(radius,.15));
      lab.label(body.name,[body.x+(i===0?-.28:.28),height+radius+.24,0],electric?color:c.text2);
      if(electric)lab.label(body.q>0?'+':body.q<0?'−':'0',[body.x,height,radius+.03],color);
    }
    const dimY=.63;
    lab.line([-sep/2,dimY,.48],[sep/2,dimY,.48],c.text2,1.5);
    for(const x of [-sep/2,sep/2])lab.line([x,dimY-.07,.48],[x,dimY+.07,.48],c.text2,1.5);
    lab.label(config.rLabel,[0,dimY-.24,.48]);
    if(show.forces&&force>0) {
      const sign=electric&&a.q*b.q>0?-1:1;
      const forceLength=clamp(.22+.11*(Math.log10(force)+6),.2,.85);
      const len=sign>0?Math.min(forceLength,sep*.35):forceLength;
      lab.vector([-sep/2,height+.05,.28],[sign*len,0,0],c.warning,'F₂₁');
      lab.vector([sep/2,height-.05,.28],[-sign*len,0,0],c.warning,'F₁₂');
    }
    if(show.field) {
      if(electric) {
        const radii=bodies.map(rad),key=[a.q,b.q,r,...radii].join('|');
        if(cache.key!==key)cache={key,lines:fieldLines(bodies.map((body,i)=>({x:(body.x+3)*100,y:300,q:body.q,r:radii[i]*100})),{x0:0,x1:600,y0:100,y1:450},{minLines:5,perUnit:.2,step:3,maxSteps:450})};
        // Revolve meridional field lines around the charge axis to show their 3D symmetry.
        for(const angle of [0,Math.PI/3,2*Math.PI/3])for(const line of cache.lines) {
          const p=([x,y])=>[x/100-3,height+(300-y)/100*Math.cos(angle),(300-y)/100*Math.sin(angle)];
          for(let i=4;i<line.pts.length;i+=4)lab.line(p(line.pts[i-4]),p(line.pts[i]),c.text3,.8);
          const i=Math.min(24,line.pts.length-2);
          if(angle===0&&i>2){const aa=p(line.pts[i]),bb=p(line.pts[i+1]),d=bb.map((v,j)=>(v-aa[j])*line.dir*3);lab.vector(aa,d,c.text3,'');}
        }
      } else {
        const maxM=Math.max(a.mass,b.mass);
        for(let x=-2.2;x<=2.2;x+=.55)for(let y=.7;y<=2.3;y+=.55)for(const z of [-.45,.45]) {
          let v=[0,0,0],skip=false;
          for(const body of bodies) {
            const d=[body.x-x,height-y,-z],rr=Math.hypot(...d);
            if(rr<rad(body)+.18){skip=true;break;}
            const strength=(body.mass/maxM)/(rr**3);
            v=v.map((n,j)=>n+d[j]*strength);
          }
          const length=Math.hypot(...v);if(skip||length<1e-8)continue;
          const len=clamp(.14+.035*Math.log10(length),.08,.22);
          lab.vector([x,y,z],v.map(n=>n/length*len),c.text3,'');
        }
      }
    }
    lab.label(electric?`Muhit: ε = ${fmt(eps,eps%1?1:0)}`:space?'Osmon jismlarining stol ustidagi modeli':'Po‘lat sharlar — laboratoriya modeli',[-1.35,2.45,0]);
    lab.finish(0,space?'Jism o‘lchamlari shartli · r — haqiqiy markazlar oralig‘i':electric?'Zaryadlar nuqtaviy · sharlar va vektorlar shartli':'r — markazlar oralig‘i · maydon va kuch vektorlari shartli');
  }
  return {lab,draw,distance(id,x,y){
    return lab.nearest(r=>{const p=position(r);return id==='right'?[-p[0],p[1],p[2]]:p;},range.min,range.max,x,y);
  }};
}
