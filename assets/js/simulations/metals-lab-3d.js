import { createLab3D } from './lab-3d.js?v=20261123-batch8c';
import { alpha, arrowSolid, dashed, helix, path } from './apparatus-3d.js?v=20261123-batch8c';
import { clamp, fmt } from './sim-kit.js';
export const densPoint=x=>[-2.55+.17*x,1.5,0];
export const gatePoint=x=>[-2.55+.17*x,2.36,0];
export const rheostatPoint=I=>[.9+(10-I)/9.8*1.05,.65,-.8];
export const temperaturePoint=f=>[.25,.65+1.75*f,-.4];

export function createMetalsLab(){
  const lab=createLab3D();let state;
  function dot(p,r,color){const a=[[p[0]+r,p[1],p[2]],[p[0]-r,p[1],p[2]],[p[0],p[1]+r,p[2]],[p[0],p[1]-r,p[2]],[p[0],p[1],p[2]+r],[p[0],p[1],p[2]-r]],projected=a.map(lab.project);for(const ids of [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]])lab.face(ids.map(i=>a[i]),color,null,.7,ids.map(i=>projected[i]));}
  function meter(p,name,value){const c=lab.colors;lab.box(p[0]-.38,p[1]-.28,p[2],.76,.56,.32,c.bg2);lab.box(p[0]-.3,p[1]-.13,p[2]-.014,.6,.27,.014,c.sunken);lab.label(name,[p[0],p[1]+.48,p[2]-.03]);lab.label(value,[p[0],p[1],p[2]-.04],c.success);}
  function tubeX(a,b,r,col){const n=16;for(let i=0;i<n;i++){const t=i*Math.PI/8,u=(i+1)*Math.PI/8;lab.face([[a,1.5+r*Math.cos(t),r*Math.sin(t)],[b,1.5+r*Math.cos(t),r*Math.sin(t)],[b,1.5+r*Math.cos(u),r*Math.sin(u)],[a,1.5+r*Math.cos(u),r*Math.sin(u)]],alpha(col,.17));}for(const x of [a,b])for(let i=0;i<n;i++){const t=i*Math.PI/8,u=(i+1)*Math.PI/8;lab.line([x,1.5+r*Math.cos(t),r*Math.sin(t)],[x,1.5+r*Math.cos(u),r*Math.sin(u)],col,1);}}
  function driftScene(d,electrons,m,time){
    const c=lab.colors,sampleL=[-2.05,1.12,.45],sampleR=[2.32,1.12,.45];
    // A real series circuit: source → sample → rheostat → ammeter → key → source.
    lab.box(-2.95,.03,-1.1,.72,.59,.64,c.bg2);lab.label('DC',[-2.6,.88,-1.12]);
    const positive=[-2.55,.64,-.82],negative=[-2.85,.64,-.82];lab.label('+',positive,c.danger);lab.label('−',negative,c.primary);
    path(lab,[positive,[-2.55,1.12,.45],sampleL],c.danger,.018);path(lab,[sampleR,[2.45,.5,-.8],[2.05,.5,-.8]],c.text2,.018);
    lab.rod(sampleL,sampleR,.045,c.text3,12);
    for(const x of [-2.05,2.32]){lab.box(x-.14,.03,.2,.28,.08,.5,c.text3);lab.rod([x,.1,.45],[x,1.12,.45],.025,c.text3,8);}
    lab.box(.78,.15,-.98,1.34,.15,.42,c.text3);helix(lab,[.88,.5,-.8],[2.02,.5,-.8],.09,10,c.warning,.014);
    const slide=rheostatPoint(d.I);lab.rod([slide[0],.5,-.8],slide,.025,c.primary,8);lab.box(slide[0]-.07,.63,-.88,.14,.08,.16,c.primary);lab.handle('rheo',slide,.19);lab.label('Reostat',[1.45,.94,-.8]);
    meter([-.15,.4,-.95],'Ampermetr',fmt(d.on?d.I:0,2)+' A');path(lab,[[.88,.5,-.8],[.36,.5,-.8],[.36,.41,-.79]],c.text2,.018);path(lab,[[-.56,.41,-.79],[-.8,.4,-.8],[-1.12,.4,-.8]],c.text2,.018);
    const a=[-1.62,.4,-.8],b=[-1.12,.4,-.8];lab.box(-1.78,.17,-1,.82,.12,.4,c.bg2);lab.rod(a,d.on?b:[-1.21,.75,-.8],.035,d.on?c.success:c.warning,10);lab.handle('key',[-1.37,.48,-.8],.2);path(lab,[a,[-2.85,.4,-.8],negative],c.primary,.018);
    // Magnified lattice is a volumetric teaching model above the actual wire.
    const left=-2.25,right=2.25,bottom=1.64,top=2.92,z0=-.36,z1=.36;
    lab.box(left,bottom,z0,right-left,top-bottom,z1-z0,alpha(c.primary,.045));
    for(const x of [left,right])for(const z of [z0,z1])lab.rod([x,1.1,z],[x,top,z],.012,c.text3,6);
    dashed(lab,[-.3,1.12,.45],[left,bottom,z0],c.text3,.8);dashed(lab,[.3,1.12,.45],[right,bottom,z0],c.text3,.8);
    for(let i=0;i<10;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++){
      const p=[left+.22+i*.45+.012*Math.sin(time*7+i*2+j),bottom+.22+j*.42+.012*Math.cos(time*6+j*3+k),-.26+k*.26];dot(p,.055,alpha(c.danger,.63));if(k===0){lab.line([p[0]-.025,p[1],p[2]-.02],[p[0]+.025,p[1],p[2]-.02],c.bg2,1);lab.line([p[0],p[1]-.025,p[2]-.02],[p[0],p[1]+.025,p[2]-.02],c.bg2,1);}
    }
    electrons.forEach((e,i)=>dot([left+.05+e.x*(right-left-.1),bottom+.05+e.y*(top-bottom-.1),-.3+.6*((Math.sin(i*93)+1)/2)],.025,c.primary));
    if(d.on){arrowSolid(lab,[-1.85,3.16,0],[-.95,3.16,0],c.danger,.013);lab.label('E, I',[-1.4,3.38,0],c.danger);arrowSolid(lab,[1.8,3.16,0],[.9,3.16,0],c.primary,.013);lab.label('Elektronlar',[1.35,3.38,0],c.primary);}
    else lab.label('Tartibsiz harakat · I = 0',[0,3.22,0]);
    lab.label(m.name+' · kattalashtirilgan panjara',[0,1.4,-.5]);
  }
  function densityScene(d,electrons,m,helpers){
    const c=lab.colors,col=`rgb(${m.color.join(',')})`,radius=S=>.24*Math.sqrt(S*1e6);
    for(const [k,p]of helpers.parts().entries()){
      const a=densPoint(p.x0)[0],b=densPoint(p.x1)[0],r=radius(p.S);tubeX(a,b,r,col);lab.label('S'+(k+1)+' '+fmt(p.S*1e6,2)+' mm²',[(a+b)/2,.8,-.2]);
    }
    electrons.forEach((e,i)=>{const r=radius(helpers.SAt(e.x))*.88;dot([densPoint(e.x)[0],1.5+e.u*r,Math.sin(i*2.399963)*Math.sqrt(Math.max(0,1-e.u*e.u))*r*.88],.018,c.primary);});
    for(const x of [-2.6,2.6]){lab.box(x-.14,.02,-.3,.28,.08,.6,c.text3);lab.rod([x,.1,.15],[x,1.5,.15],.03,c.text3,8);}
    const gx=densPoint(d.gate)[0],r=radius(helpers.SAt(d.gate))+.1,grip=gatePoint(d.gate);
    lab.face([[gx,1.5-r,-r],[gx,1.5+r,-r],[gx,1.5+r,r],[gx,1.5-r,r]],alpha(c.warning,.12));
    path(lab,[[gx,1.5-r,-r],[gx,1.5+r,-r],[gx,1.5+r,r],[gx,1.5-r,r],[gx,1.5-r,-r]],c.warning,.014);lab.rod([gx,1.5+r,0],grip,.022,c.warning,8);dot(grip,.055,c.warning);lab.handle('gate',grip,.2);
    lab.label('x '+fmt(d.gate,1)+' cm',[gx,2.66,0],c.warning);const I=helpers.measuredI();lab.label(I===null?'Δq/Δt: sanalmoqda':fmt(I,2)+' A',[gx,2.95,0],c.text2);
    arrowSolid(lab,[-1.7,3.15,0],[-.8,3.15,0],c.danger,.013);lab.label('I '+fmt(d.I,1)+' A',[-1.25,3.4,0],c.danger);arrowSolid(lab,[1.7,3.15,0],[.8,3.15,0],c.primary,.013);lab.label('Elektronlar',[1.25,3.4,0],c.primary);
    lab.label('Sariq sirt — hisoblash kesimi',[0,.3,-.85],c.warning);
  }
  function rtScene(rt,m,helpers){
    const c=lab.colors,sc=helpers.isSC(),sampleCol=helpers.glow(rt.t)||`rgb(${m.color.join(',')})`,left=-2.45,right=-.45;
    if(sc){
      const x=-1.5,base=.18,top=2.7;
      for(const r of [.75,.65])for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;lab.face([[x+r*Math.cos(a),base,r*Math.sin(a)],[x+r*Math.cos(b),base,r*Math.sin(b)],[x+r*Math.cos(b),top,r*Math.sin(b)],[x+r*Math.cos(a),top,r*Math.sin(a)]],alpha(c.primary,.08));}
      lab.rod([x,.04,0],[x,.18,0],.8,c.text3,32);lab.rod([x,top,0],[x,top+.13,0],.78,c.text3,32);
      helix(lab,[x-.36,.8,0],[x+.36,1.9,0],.11,5,alpha(c.primary,.3),.034);helix(lab,[x-.36,.8,0],[x+.36,1.9,0],.11,5,c.text2,.012);
      lab.label('Kriostat · geliy',[x,3.1,0]);lab.label('Hg · muzlagan namuna',[x,.4,-.85],c.text2);
    }else{
      lab.box(left,.1,-.65,right-left,.18,1.3,c.text3);lab.box(left,.28,.49,right-left,2.2,.17,c.bg2);lab.box(left,.28,-.65,.18,2.2,1.3,c.bg2);lab.box(right-.18,.28,-.65,.18,2.2,1.3,c.bg2);lab.box(left,2.48,-.65,right-left,.18,1.3,c.bg2);
      const hot=clamp((rt.t-20)/1200,0,1);lab.box(left+.18,.29,-.46,right-left-.36,2.18,.92,alpha(rt.t<0?c.primary:c.danger,.035+hot*.13));
      helix(lab,[-2.12,1.35,0],[-.78,1.35,0],.27,9,sampleCol,.018);
      for(const x of [-2.12,-.78])lab.rod([x,.31,.2],[x,1.05,.2],.055,c.bg2,12);
      // Open inspection door: a true cutaway gives access to the suspended sample.
      lab.box(right, .35,-1.08,.16,2.04,.55,c.text3);lab.label(rt.t<0?'Sovitish kamerasi':'Elektr pech',[-1.45,2.99,0]);lab.label(m.name+' sim o‘rami',[-1.45,.5,-.7]);
    }
    meter([1.75,1.8,-.35],'Termometr',sc?fmt(rt.T,2)+' K':fmt(rt.t,0)+' °C');const R=sc?helpers.mercuryR():helpers.RofT(rt.t);meter([1.75,.67,-.35],'Ommetr',sc?fmt(R*1000,2)+' mΩ':fmt(R,3)+' Ω');
    // Separate thermometer probe and electrical leads, with two insulated feedthroughs.
    lab.rod([-1.45,2.93,.22],[-1.45,1.23,.22],.025,c.text3,10);path(lab,[[-1.45,2.93,.22],[-.1,2.93,.5],[1.75,2.08,-.05]],c.primary,.014);
    path(lab,[[sc?-1.86:-2.12,sc?.8:1.35,0],[-2.2,.22,.5],[1.48,.22,.5],[1.48,.41,-.1]],c.danger,.018);
    path(lab,[[sc?-1.14:-.78,sc?1.9:1.35,0],[-.33,.17,.25],[2.02,.17,.25],[2.02,.41,-.1]],c.text2,.018);
    const min=sc?3:-100,max=sc?6:helpers.tMax(),v=sc?rt.T:rt.t,f=(v-min)/(max-min),p=temperaturePoint(f);
    lab.box(.12,.38,-.3,.26,2.4,.16,c.bg2);lab.rod(temperaturePoint(0),temperaturePoint(1),.025,c.text3,8);dot(p,.07,c.danger);lab.handle('temp',p,.2);lab.label('T',[.25,2.97,-.3],c.danger);
  }
  return {lab,draw(ctx,stage,ui,drift,dens,rt,electrons,m,helpers,time=0){state={ui,drift,dens,rt,helpers};lab.begin(ctx,stage,{target:[0,1.5,0],focal:1.7});if(ui.mode==='drift')driftScene(drift,electrons,m,time);else if(ui.mode==='dens')densityScene(dens,electrons,m,helpers);else rtScene(rt,m,helpers);lab.finish(time,ui.mode==='drift'?'Panjara va harakat: kattalashtirilgan model':ui.mode==='dens'?'Radius ∝ √S · zarralar/vaqt shartli':'Kamera ochiq kesimda · R(t) ideal model');},
    parameter(id,p){if(id==='rheo')return lab.nearest(rheostatPoint,.2,10,p.x,p.y);if(id==='gate')return lab.nearest(gatePoint,.5,29.5,p.x,p.y);if(id==='temp')return lab.nearest(temperaturePoint,0,1,p.x,p.y);return null;}
  };
}
