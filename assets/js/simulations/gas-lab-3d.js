// The collision engine is planar. All particle centres stay in its z=0 layer;
// the surrounding cell, piston and instruments have real solid depth.
import {createLab3D} from './lab-3d.js?v=20261123-batch7c';
import {alpha,dial,dashed,ring} from './apparatus-3d.js?v=20261123-batch7c';
import {clamp,fmt} from './sim-kit.js';
import * as G from './gas-engine.js';

const TAU=2*Math.PI;
const octa=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const triangles=[[2,0,4],[2,4,1],[2,1,5],[2,5,0],[3,4,0],[3,1,4],[3,5,1],[3,0,5]];
const rgb=color=>{const h=color.replace('#','');if(/^[\da-f]{6}$/i.test(h))return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));if(/^[\da-f]{3}$/i.test(h))return[...h].map(x=>parseInt(x+x,16));return(color.match(/[\d.]+/g)||[128,128,128]).slice(0,3).map(Number);};
const blend=(a,b,t)=>{const A=rgb(a),B=rgb(b);return `rgb(${A.map((x,i)=>Math.round(x+(B[i]-x)*t)).join(',')})`;};

export function createGasLab(){
  const lab=createLab3D();let current,scale=.008,paletteKey='',palette=[];
  const worldPoint=(x,y,z=0)=>[(x-current.world.W/2)*scale,.42+(current.world.H-y)*scale,z];
  const pistonPoint=V=>worldPoint(current.world.W/2,300-150*V,-.22).map((v,i)=>i===1?v+.13:v);
  function particle(point,r,color,detailed=false){
    if(detailed){
      const n=12,m=6,at=(i,j)=>[point[0]+r*Math.sin(i*Math.PI/m)*Math.cos(j*TAU/n),point[1]+r*Math.cos(i*Math.PI/m),point[2]+r*Math.sin(i*Math.PI/m)*Math.sin(j*TAU/n)];
      for(let i=0;i<m;i++)for(let j=0;j<n;j++)lab.face([at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)],color);
    }else{
      const vertices=octa.map(p=>p.map((v,i)=>point[i]+v*r));
      const projected=vertices.map(lab.project);
      for(const ids of triangles)lab.face(ids.map(i=>vertices[i]),color,null,.7,ids.map(i=>projected[i]));
    }
  }
  function track(points,color){for(let i=1;i<points.length;i++)lab.line(worldPoint(points[i-1][0],points[i-1][1],-.01),worldPoint(points[i][0],points[i][1],-.01),color,1.25);}
  function observationCell(world){
    const c=lab.colors,left=worldPoint(0,world.H)[0],right=worldPoint(world.W,world.H)[0],top=worldPoint(0,0)[1],d=world.big>=0?.24:.11;
    lab.box(left-.17,.08,-d-.1,right-left+.34,.18,d*2+.2,c.text3);
    for(const x of [left-.06,right+.06]){
      lab.box(x-.04,.26,-d-.035,.08,top-.23,.07,c.text3);
      lab.box(x-.04,.26,d-.035,.08,top-.23,.07,c.text3);
      lab.face([[x,.4,-d],[x,top,-d],[x,top,d],[x,.4,d]],alpha(c.primary,.09));
    }
    for(const y of [.4,top])for(const z of [-d,d])lab.rod([left-.1,y,z],[right+.1,y,z],.025,c.text3,8);
    lab.face([[left,.42,d],[right,.42,d],[right,top,d],[left,top,d]],alpha(c.primary,.045));
    lab.face([[left,.42,-d],[right,.42,-d],[right,top,-d],[left,top,-d]],alpha(c.primary,.025));
    for(const x of [left,right])for(const z of [-d,d])lab.rod([x,.42,z],[x,top,z],.012,c.text3,6);
    return {left,right,top,d};
  }
  function instrumentPanel(ui,cfg){
    const c=lab.colors;
    lab.box(-2.65,.045,-1.45,5.3,.43,.46,c.text3);
    lab.box(-2.58,.09,-1.465,5.16,.34,.025,c.bg2);
    for(const [id,x,frac,name,text,col]of [
      ['temp',-1.85,(cfg.T-100)/700,'T',`${fmt(cfg.T,0)} K`,c.danger],
      ['count',-.55,(cfg.N-40)/(ui.mode==='diff'?100:ui.mode==='brown'?280:210),'N',`${fmt(cfg.N,0)} ${ui.mode==='diff'?'× 2':'zarra'}`,c.primary],
      ...(ui.mode==='brown'?[
        ['mass',.75,(cfg.bigM-10)/190,'M/m',`${fmt(cfg.bigM,0)} m`,c.warning],
        ['radius',2.05,(cfg.bigR-8)/16,'r',`${fmt(cfg.bigR,0)} u`,c.success],
      ]:[]),
    ]){
      dial(lab,[x,.3,-1.49],clamp(frac,0,1),col,id,name);
      lab.label(text,[x,.73,-1.42],col);
    }
  }
  function gauge(p,pMax,T,mode){
    const c=lab.colors,x=2.32,y=2.3,z=-.22,r=.35;
    lab.rod([x,.15,.04],[x,y,.04],.025,c.text3,8);
    lab.rod([x,y,z],[x,y,z+.12],r,c.text3,32);
    lab.rod([x,y,z-.005],[x,y,z-.012],r*.94,c.bg2,32);
    for(let i=0;i<=10;i++){
      const a=(-.75+i*.15)*Math.PI;
      lab.line([x+Math.sin(a)*r*.75,y+Math.cos(a)*r*.75,z-.025],[x+Math.sin(a)*r*.91,y+Math.cos(a)*r*.91,z-.025],c.text3,1);
    }
    const a=(-.75+1.5*clamp(p/pMax,0,1))*Math.PI;
    lab.rod([x,y,z-.04],[x+Math.sin(a)*r*.72,y+Math.cos(a)*r*.72,z-.04],.012,c.danger,6);
    lab.label('kPa',[x,y-.14,z-.04],c.text3);lab.label('Manometr',[x,y+.55,z]);
    lab.label(`${fmt(p/1000,1)} kPa`,[x,y-.56,z],c.primary);
    // Separate liquid-column thermometer remains readable below the pressure dial.
    lab.rod([x,.6,z],[x,1.49,z],.05,alpha(c.text3,.2),12);
    lab.rod([x,.6,z-.035],[x,.6+.85*clamp(T/900,0,1),z-.035],.024,c.danger,10);
    particle([x,.55,z],.075,c.danger,true);
    lab.label(`${fmt(T,0)} K`,[x,1.61,z],c.danger);
    if(mode==='gas')lab.line([x-.35,2.32,.04],[1.7,2.32,.04],c.text3,1.2);
  }
  function draw(ctx,stage,ui,cfg,world,meas,values){
    current={ui,cfg,world};scale=Math.min(4.4/world.W,2.4/world.H);
    lab.begin(ctx,stage,{target:[0,1.55,0],focal:1.75});const c=lab.colors;
    const cell=observationCell(world);
    const key=[c.primary,c.success,c.warning,c.danger].join('');
    if(key!==paletteKey){paletteKey=key;const stops=[c.primary,c.success,c.warning,c.danger];palette=Array.from({length:48},(_,i)=>{const t=i/47*3,j=Math.min(2,Math.floor(t));return blend(stops[j],stops[j+1],t-j);});}
    if(ui.mode==='gas'&&cfg.trace)track(meas.trace,c.danger);
    if(ui.mode==='brown')track(meas.btrace,c.warning);
    const speedRef=Math.sqrt(2*G.kinetic(world).mean)||1;
    for(let i=0;i<world.x.length;i++){
      if(i===world.big||(ui.mode==='brown'&&cfg.hideSmall))continue;
      const speed=Math.hypot(world.vx[i],world.vy[i])*Math.sqrt(world.m[i])/speedRef;
      const tracked=ui.mode==='gas'&&cfg.trace&&i===0;
      const color=tracked?c.danger:ui.mode==='diff'?(world.sp[i]===0?c.primary:c.warning):ui.mode==='brown'?c.text3:cfg.colorSpeed?palette[Math.round(clamp(speed/1.6,0,1)*47)]:c.primary;
      const point=worldPoint(world.x[i],world.y[i]);
      particle(point,Math.max(tracked?.028:.018,world.r[i]*scale),color);
      if(tracked)for(let j=0;j<16;j++){
        const at=a=>[point[0]+.05*Math.cos(a),point[1]+.05*Math.sin(a),-.025];
        lab.line(at(j*TAU/16),at((j+1)*TAU/16),c.danger,1.2);
      }
    }
    if(ui.mode==='gas'){
      const py=worldPoint(0,world.top)[1],depth=cell.d+.035;
      lab.box(cell.left-.02,py,-depth,cell.right-cell.left+.04,.075,depth*2,c.text2);
      lab.rod([0,py+.075,0],[0,3.35,0],.035,c.text3,12);
      lab.box(-.36,3.32,-.12,.72,.07,.24,c.text3);
      if(ui.proc==='p')for(let i=0;i<3;i++)lab.box(-.24,py+.08+i*.055,-.11,.48,.05,.22,c.warning);
      if(ui.proc!=='p'){
        const handle=pistonPoint(cfg.V);ring(lab,handle,.09,c.warning,'z',.016);lab.handle('piston',handle,.18);
        if(Math.abs(values.V-cfg.V)>.025)dashed(lab,[cell.left,handle[1]-.13,-.2],[cell.right,handle[1]-.13,-.2],c.warning);
      }
      for(let v=0;v<=2.001;v+=.5){const y=.42+v*1.2;lab.line([cell.left-.08,y,-.18],[cell.left-.24,y,-.18],c.text3,1);lab.label(fmt(v,1),[cell.left-.42,y,-.18]);}
      lab.label('L',[cell.left-.42,3.12,-.18]);lab.label(`V = ${fmt(values.V,2)} L`,[0,py-.25,-.2],c.primary);
      lab.label(G.GASES[cfg.gasA].name,[0,3.5,0]);
      const thermal=cfg.T-values.T;
      if(Math.abs(thermal)>5)for(let i=0;i<6;i++){
        const x=cell.left+.24+i*(cell.right-cell.left-.48)/5;
        const col=thermal>0?c.danger:c.primary;
        lab.rod([x,.29,-.04],[x,.37,-.04],.025,col,6);
      }
      gauge(values.p,values.pMax,values.T,'gas');
    }else if(ui.mode==='diff'){
      if(world.barrier!==null)lab.box(-.018,.42,-cell.d-.015,.036,cell.top-.38,cell.d*2+.03,c.text2);
      else dashed(lab,worldPoint(world.W/2,0),worldPoint(world.W/2,world.H),c.text3,.8);
      // The partition slides out into a small storage bracket beside the cell.
      const bx=world.barrier===null?cell.left-.28:0;
      if(world.barrier===null)lab.box(bx-.018,.45,-.03,.036,.8,.06,c.text3);
      lab.rod([bx,world.barrier===null?1.25:cell.top,0],[bx,world.barrier===null?1.45:cell.top+.25,0],.035,c.warning,12);
      lab.handle('barrier',[bx,world.barrier===null?1.42:cell.top+.2,0],.18);
      lab.label(world.barrier===null?'To‘siq olindi':'To‘siqni olish',[0,cell.top+.42,0],c.warning);
      lab.label(G.GASES[cfg.gasA].name,[cell.left*.48,cell.top+.12,0],c.primary);
      lab.label(G.GASES[cfg.gasB].name,[cell.right*.48,cell.top+.12,0],c.warning);
    }else{
      const b=world.big,p=worldPoint(world.x[b],world.y[b]);
      particle(p,world.r[b]*scale,c.warning,true);lab.handle('brown',p,.18);
      if(meas.b0){const start=worldPoint(meas.b0.x,meas.b0.y,-.02);ring(lab,start,.045,c.danger,'z',.009);}
      lab.label('Mikroskopdagi kuzatish qatlami',[0,cell.top+.3,0]);
    }
    instrumentPanel(ui,cfg);
    lab.finish(world.time,'Zarralar: 2D model · moslama: 3D');
  }
  return{lab,draw,worldPoint,pistonPoint,
    volume(p){return lab.nearest(pistonPoint,.6,2,p.x,p.y);},
    modelPoint(p){const q=lab.planePoint(p.x,p.y,0);return q?{x:q[0]/scale+current.world.W/2,y:current.world.H-(q[1]-.42)/scale}:null;},
  };
}
