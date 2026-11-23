// Volumetric thermodynamics apparatus. State functions stay in thermo-physics.js.
import { createLab3D } from './lab-3d.js?v=20261123-batch8d';
import { alpha, path, ring, dial, arrowSolid } from './apparatus-3d.js?v=20261123-batch8d';
import { clamp, fmt } from './sim-kit.js';
import * as P from './thermo-physics.js';

const TAU=2*Math.PI;
export const pistonPoint=V=>[-1,.55+V/4.2e-3*1.9+.32,-.12];
export const thermoPoint=T=>[.5,.6+1.9*(T-120)/1080,-.36];
export const engineScale=g=>2.15/(2*g.r+g.l+g.Vc/g.area);
export function crankPoint(g,th){const k=engineScale(g);return[-.85+g.r*k*Math.sin(th),.65+g.r*k*Math.cos(th),-.32];}
export function createThermoLab(){
  const lab=createLab3D();let state;
  function wall(cx,y,r,h,color,cut=false){
    const n=40;
    for(let i=0;i<n;i++){
      const a=i*TAU/n,b=(i+1)*TAU/n;if(cut&&Math.sin((a+b)/2)<-.35)continue;
      const at=(t,yy)=>[cx+r*Math.cos(t),yy,r*Math.sin(t)];
      lab.face([at(a,y),at(b,y),at(b,y+h),at(a,y+h)],color);
    }
  }
  function disk(cx,y,r,h,col){lab.rod([cx,y,0],[cx,y+h,0],r,col,32);}
  function gauge(x,y,z,p,col){
    const c=lab.colors;lab.rod([x,y,z],[x,y,z+.12],.35,c.bg2,32);ring(lab,[x,y,z-.01],.35,c.text3,'z',.014);
    const max=Math.max(200,Math.ceil(p/100000)*100),a=(225-270*p/1000/max)*Math.PI/180;
    for(let i=0;i<=8;i++){const t=(225-270*i/8)*Math.PI/180;lab.line([x+.27*Math.cos(t),y+.27*Math.sin(t),z-.015],[x+.32*Math.cos(t),y+.32*Math.sin(t),z-.015],c.text3);}
    arrowSolid(lab,[x,y,z-.03],[x+.24*Math.cos(a),y+.24*Math.sin(a),z-.03],col,.012);
    lab.label(fmt(p/1000,1)+' kPa',[x,y-.52,z],col);
  }
  function particles(mol,cx,bottom,top,r,T){
    const c=lab.colors;
    for(let i=0;i<mol.length;i++){
      const m=mol[i],theta=m.x*TAU,rr=r*.8*Math.sqrt(((i*.618)%1)),p=[cx+rr*Math.cos(theta),bottom+.05+(top-bottom-.1)*m.y,rr*Math.sin(theta)];
      const s=.022,pts=[[s,0,0],[-s,0,0],[0,s,0],[0,-s,0],[0,0,s],[0,0,-s]].map(q=>q.map((v,k)=>v+p[k]));
      for(const f of [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]])lab.face(f.map(j=>pts[j]),T>600?c.warning:c.primary);
    }
  }
  function cylinder(cx,s,mol,{maxV=4.2e-3,r=.58,bottom=.55,insulated=false,weights=false,locked=false,bath=false}={}){
    const c=lab.colors,top=bottom+s.V/maxV*1.9;
    if(bath){lab.box(cx-r-.18,bottom-.2,-r-.18,2*r+.36,1.05,2*r+.36,alpha(c.primary,.12));lab.label('Termostat',[cx,bottom-.35,-.6],c.primary);}
    disk(cx,bottom-.08,r+.06,.08,c.text3);
    wall(cx,bottom,r,2.1,insulated?c.bg2:alpha(c.text3,.14),insulated);
    wall(cx,bottom+.01,r*.96,Math.max(.01,top-bottom-.01),alpha(s.T>500?c.warning:c.primary,.14));
    particles(mol,cx,bottom,top,r,s.T);
    disk(cx,top,r*.97,.12,c.text3);
    for(const yy of [top+.025,top+.075]){
      const pts=[];for(let i=0;i<=48;i++)pts.push([cx+r*Math.cos(i*TAU/48),yy,r*Math.sin(i*TAU/48)]);path(lab,pts,c.text2,.01);
    }
    lab.rod([cx,top+.12,0],[cx,top+.37,0],.04,c.text2,12);
    lab.rod([cx-.24,top+.37,0],[cx+.24,top+.37,0],.035,c.text2,12);
    if(weights)for(const dx of [-.3,.3]){lab.rod([cx+dx,top+.12,0],[cx+dx,top+.28,0],.14,c.text2,20);lab.label('m',[cx+dx,top+.28,-.17]);}
    if(locked)for(const dx of [-1,1]){const x=cx+dx*(r+.06);lab.rod([x,top+.05,-.17],[cx+dx*(r-.15),top+.05,-.17],.04,c.danger,8);}
    lab.label(fmt(s.V*1000,2)+' L',[cx,top-.22,-r-.05],c.primary);
    return top;
  }
  function procScene(proc,mol,totals){
    const c=lab.colors,s=proc.cur,k=proc.kind,top=cylinder(-1,s,mol,{insulated:k==='Q',bath:k==='T',weights:k==='p',locked:k==='V'});
    if(k!=='V'){const p=pistonPoint(s.V);ring(lab,p,.06,c.warning,'z',.01);lab.handle('piston',p,.18);}
    lab.label(k==='Q'?'Issiqlik izolyatsiyasi · kesim':k==='V'?'Porshen mahkamlangan':'Porshenli silindr',[-1,3.1,0]);
    const tp=thermoPoint(s.T),base=[.5,.6,-.36];
    lab.box(.34,.42,-.28,.33,2.27,.15,c.bg2);
    lab.rod(base,[.5,2.5,-.36],.033,alpha(c.text3,.22),12);lab.rod(base,tp,.015,c.danger,10);
    lab.sphere(base,.065,c.danger);
    path(lab,[[.5,.6,-.3],[.5,.48,.3],[-1,.48,.3],[-1,.7,.3]],c.text3,.018);
    for(let t=200;t<=1000;t+=200){const y=thermoPoint(t)[1];lab.line([.55,y,-.37],[.67,y,-.37],c.text3);lab.label(String(t),[.86,y,-.37]);}
    if(k!=='T'){ring(lab,tp,.06,c.warning,'z',.009);lab.handle('thermo',tp,.18);}
    lab.label(fmt(s.T,0)+' K',[.5,2.95,-.3],c.danger);
    path(lab,[[-.42,.85,.15],[1.25,.85,.15],[1.85,1.3,-.14],[1.85,1.55,-.14]],c.text3,.025);
    gauge(1.85,1.9,-.14,s.p,c.primary);
    lab.box(-1.75,.05,-.68,1.5,.25,1.36,c.bg2);
    if(proc.flowT>0&&proc.flow&&k!=='Q')arrowSolid(lab,[-2,.35,0],[-2,proc.flow>0?1.15:.1,0],proc.flow>0?c.danger:c.primary,.035);
    const L=totals();lab.label('Q = '+fmt(L.Q,1)+' J',[1.9,.85,-.8],c.danger);lab.label('A = '+fmt(L.A,1)+' J',[1.9,.5,-.8],c.success);
    if(k==='Q')lab.label('Q = 0',[-1,.2,-.8],c.text2);
  }
  function cycleScene(cyc,mol,cycleState,station){
    const c=lab.colors,d=cyc.data,{j,s}=cycleState(),active=station(d.legs[j]),xs=[-1.8,0,1.8];
    if(cyc.cylX===null)cyc.cylX=xs[active];
    const maxV=Math.max(...d.pts.map(p=>p.V))*1.08;
    for(let i=0;i<3;i++){
      const col=[c.danger,c.text3,c.primary][i],x=xs[i];lab.box(x-.62,.06,-.62,1.24,.33,1.24,col);
      for(let z=-.45;z<=.45;z+=.15)lab.rod([x-.53,.25,z],[x+.53,.25,z],.018,c.text2,6);
      lab.label(i===0?'Isitkich '+fmt(cyc.T1,0)+' K':i===2?'Sovitkich '+fmt(cyc.T2,0)+' K':'Izolyatsiya',[x,.11,-.98],col);
      if(i!==1){const q=[x,.23,-.65];dial(lab,q,i===0?(cyc.T1-250)/2250:(cyc.T2-150)/450,col,i===0?'hot':'cold',i===0?'T₁':'T₂');}
    }
    cylinder(cyc.cylX,s,mol,{maxV,r:.43,bottom:.4,insulated:d.legs[j].kind==='Q'});
    lab.label((j+1)+' → '+((j+1)%4+1)+' · '+({Q:'Adiabatik',T:'Izotermik',V:'Izoxorik',p:'Izobarik'}[d.legs[j].kind]),[0,3.1,0],c.text2);
    if(d.legs[j].Q!==0){const heating=d.legs[j].Q>0;arrowSolid(lab,[cyc.cylX,heating?.44:1.04,-.65],[cyc.cylX,heating?1.04:.44,-.65],heating?c.danger:c.primary,.026);}
    lab.label(d.reverse?'Sovutgich · ε '+fmt(d.cop,2):'η '+fmt(d.eta*100,1)+' %',[0,2.85,.2],c.success);
  }
  function engineScene(eng,engState){
    const c=lab.colors,g=eng.g,es=engState(),th=eng.th,TH=((th%(4*Math.PI))+4*Math.PI)%(4*Math.PI),scale=engineScale(g),cx=-.85,cy=.65,r=g.D/2*scale;
    const pin=crankPoint(g,th),wrist=[cx,cy+(g.r*Math.cos(th)+Math.sqrt(g.l*g.l-(g.r*Math.sin(th))**2))*scale,-.32],pTop=wrist[1]+.14,head=cy+(g.r+g.l+g.Vc/g.area)*scale+.14,min=cy+(g.l-g.r)*scale-.13;
    lab.box(-1.65,.02,-.62,1.6,.16,1.24,c.text3);
    for(const x of [cx-.55,cx+.55])lab.rod([x,.18,.24],[x,head+.03,.24],.035,c.text3,10);
    // The near side is open to show piston rings, wrist pin, connecting rod and crank.
    wall(cx,min,r,head-min,c.bg2,true);
    const gasCol=es.stroke===2?c.warning:es.stroke===3?c.text3:c.primary;
    wall(cx,pTop,r*.96,Math.max(.005,head-pTop),alpha(gasCol,.25));
    disk(cx,pTop-.18,r*.95,.18,c.text3);
    for(const dy of [-.035,-.085,-.125]){
      const pts=[];for(let i=0;i<=48;i++)pts.push([cx+r*.96*Math.cos(i*TAU/48),pTop+dy,r*.96*Math.sin(i*TAU/48)]);path(lab,pts,c.text2,.008);
    }
    lab.rod([wrist[0],wrist[1],-.4],[wrist[0],wrist[1],.4],.045,c.text2,14);
    // Both joints lie in the same crank plane, so the rod has the exact modeled length.
    lab.rod(pin,wrist,.052,c.text3,12);lab.rod([cx,cy,-.32],pin,.075,c.text2,14);
    lab.rod([cx,cy,-.5],[cx,cy,.5],.075,c.text2,16);
    ring(lab,[cx,cy,.3],g.r*scale+.13,c.text3,'z',.045);
    for(let i=0;i<6;i++){const a=th+i*TAU/6;lab.rod([cx,cy,.3],[cx+(g.r*scale+.1)*Math.sin(a),cy+(g.r*scale+.1)*Math.cos(a),.3],.025,c.text3,8);}
    lab.sphere(pin,.075,c.primary);lab.handle('crank',pin,.22);
    disk(cx,head,r+.13,.12,c.text3);
    const phase=(TH%Math.PI)/Math.PI;
    for(const i of [0,1]){
      const x=cx+(i?1:-1)*r*.48,open=es.stroke===(i?3:0),lift=open?.075*Math.sin(phase*Math.PI):0,col=i?c.text3:c.primary;
      lab.rod([x,head+.35,0],[x,head-.02-lift,0],.018,c.text2,10);
      lab.rod([x,head-.035-lift,0],[x,head-.01-lift,0],.105,c.text2,20);
      const side=i?1:-1;path(lab,[[x,head+.16,.1],[x+side*.5,head+.16,.1]],col,.09);
      if(open)arrowSolid(lab,[x+side*.35,head+.3,.1],[x+side*(i?.6:.05),head+.3,.1],col,.018);
    }
    lab.rod([cx,head+.07,-.1],[cx,head+.33,-.1],.04,c.bg2,12);
    if(TH>2*Math.PI-.04&&TH<2*Math.PI+.35)for(let i=0;i<6;i++){const a=i*TAU/6;lab.line([cx,head-.02,-.1],[cx+.12*Math.cos(a),head-.02+.12*Math.sin(a),-.1],c.warning,2);}
    lab.label('Ochiq kesim · shatun va tirsak',[cx,head+.7,.05]);
    lab.label((es.stroke+1)+'-takt: '+P.STROKES[es.stroke],[1.45,2.8,0],gasCol);
    lab.label(fmt(es.T,0)+' K · '+fmt(es.p/1e5,1)+' bar',[1.45,2.4,0]);
    lab.box(.8,.08,-.8,1.5,.45,.9,c.bg2);
    dial(lab,[1.15,.34,-.83],(eng.rpm-800)/5200,c.primary,'rpm','n');
    dial(lab,[1.95,.34,-.83],(eng.eps-5)/7,c.warning,'eps','ε');
    lab.label(fmt(eng.rpm,0)+' ayl/min',[1.2,.95,-.75],c.primary);
    lab.label('ε '+fmt(eng.eps,1),[2,.95,-.75],c.warning);
    lab.label(fmt(TH*180/Math.PI,0)+'° / 720°',[1.55,1.55,-.3],c.text2);
  }
  return {lab,
    draw(ctx,stage,ui,proc,cyc,eng,mol,helpers){state={ui,proc,cyc,eng};lab.begin(ctx,stage,{target:[0,1.45,0],focal:1.65});if(ui.mode==='proc')procScene(proc,mol,helpers.totals);else if(ui.mode==='cycle')cycleScene(cyc,mol,helpers.cycleState,helpers.station);else engineScene(eng,helpers.engineState);lab.finish(ui.mode==='engine'?eng.th/Math.PI:ui.mode==='cycle'?cyc.laps*4+cyc.u:0,ui.mode==='engine'?'To‘rt takt · aylanish sekinlashtirilgan':'Gaz modeli · o‘lchamlar avtomatik');},
    parameter(id,p){if(id==='piston')return lab.nearest(pistonPoint,.6e-3,4.2e-3,p.x,p.y);if(id==='thermo')return lab.nearest(thermoPoint,120,1200,p.x,p.y);if(id==='crank'){
      const g=state.eng.g,q=lab.planePoint(p.x,p.y,-.32);if(!q)return null;return Math.atan2(q[0]+.85,q[1]-.65);
    }return null;},
  };
}
