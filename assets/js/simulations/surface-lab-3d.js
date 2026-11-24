// Soap film, true signed capillary levels and drop-counting apparatus.
import { createLab3D } from './lab-3d.js?v=20261123-batch8d';
import { alpha, arrowSolid, path, helix, dial, stand } from './apparatus-3d.js?v=20261123-batch8d';
import { clamp, fmt } from './sim-kit.js';
import * as P from './surface-physics.js';

const TAU=2*Math.PI;
export const filmPoint=x=>[-2.3+30*x,1.7,-.08];
export const filmLengthPoint=L=>[-2.3,1.7+15*L,-.08];
export const capillaryPoint=(r,h=0)=>[2.1+.035+r*40,.95+h*12,-.08];
export const DROP_TIP=1.95;
export const dropLanding=N=>.46+.12*N/60;
export const dropStart=(sigma,d,rho)=>DROP_TIP-P.dropRadius(P.dropMass(sigma,d),rho)*17;
export function createSurfaceLab(){
  const lab=createLab3D();let current;
  const cylinder=(p,r,h,col)=>lab.rod(p,[p[0],p[1]+h,p[2]],r,col,24);
  function tube(p,r,height,col,glass=false){
    const n=28;for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n,at=(t,y)=>[p[0]+r*Math.cos(t),y,p[2]+r*Math.sin(t)];lab.face([at(a,p[1]),at(b,p[1]),at(b,p[1]+height),at(a,p[1]+height)],col);}
    if(glass){
      const edge=alpha(lab.colors.text2,.6),at=(a,y)=>[p[0]+r*Math.cos(a),y,p[2]+r*Math.sin(a)];
      for(let i=0;i<4;i++)lab.line(at(i*TAU/4,p[1]),at(i*TAU/4,p[1]+height),edge,.8);
      for(const y of [p[1],p[1]+height])for(let i=0;i<n;i++)lab.line(at(i*TAU/n,y),at((i+1)*TAU/n,y),edge,.8);
    }
  }
  function disk(p,r,col){const ps=[];for(let i=0;i<32;i++)ps.push([p[0]+r*Math.cos(i*TAU/32),p[1],p[2]+r*Math.sin(i*TAU/32)]);lab.face(ps,col);}
  function meniscus(x,y,z,r,wet,col){
    const at=(f,t)=>[x+f*r*Math.cos(t),y+(wet?1:-1)*.03*f*f,z+f*r*Math.sin(t)];
    for(let i=0;i<28;i++)for(let j=0;j<4;j++)lab.face([at(j/4,i*TAU/28),at((j+1)/4,i*TAU/28),at((j+1)/4,(i+1)*TAU/28),at(j/4,(i+1)*TAU/28)],col);
  }
  function filmScene(st,film,sigma){
    const c=lab.colors,left=-2.3,half=film.L*15,bar=filmPoint(film.x),top=1.7+half,bot=1.7-half,F=P.filmForce(sigma,film.L),q=clamp(F/.012,0,1);
    for(const x of [left,.75]){stand(lab,x,.25,bot,c.text3);lab.rod([x,bot,.25],[x,bot,0],.025,c.text3,8);}
    path(lab,[[.8,bot,0],[left,bot,0],[left,top,0],[.8,top,0]],c.text2,.028);
    for(const z of [-.006,.006])for(let i=0;i<12;i++){
      const x=left+(bar[0]-left)*i/12,x1=left+(bar[0]-left)*(i+1)/12,col=[c.special,c.primary,c.warning][Math.floor(i/4)];
      lab.face([[x,bot,z],[x1,bot,z],[x1,top,z],[x,top,z]],alpha(col,.12));
    }
    lab.rod([bar[0],bot-.08,0],[bar[0],top+.08,0],.04,c.warning,12);
    lab.handle('bar',bar,.2);lab.handle('length',filmLengthPoint(film.L),.18);
    lab.rod(bar,[bar[0]+.27,bar[1],bar[2]],.015,c.text3,8);
    const dx=bar[0]+.28;
    // A sliding carriage reacts the dynamometer force into the lab bench.
    lab.rod([-1.8,.1,.42],[2.2,.1,.42],.035,c.text3,10);
    stand(lab,dx+.94,.42,1.7,c.text3);
    lab.rod([dx+.94,1.7,.42],[dx+.94,1.7,.03],.035,c.text3,10);
    lab.rod([dx,1.7,0],[dx+1.03,1.7,0],.13,alpha(c.text3,.13),24);
    helix(lab,[dx+.05,1.7,0],[dx+.53+.26*q,1.7,0],.06,7,c.text3,.01);
    lab.rod([dx+.53+.26*q,1.7,0],[dx+1.2,1.7,0],.016,c.text3,8);
    for(let i=0;i<=6;i++)lab.line([dx+.1+i*.14,1.66,-.14],[dx+.1+i*.14,1.74,-.14],c.text3,.8);
    lab.line([dx+.1+.84*q,1.58,-.15],[dx+.1+.84*q,1.82,-.15],c.danger,2);
    for(const f of [-.6,0,.6])arrowSolid(lab,[bar[0]-.04,1.7+half*f,-.08],[bar[0]-.4,1.7+half*f,-.08],c.primary,.012);
    arrowSolid(lab,[dx+1.05,1.7,-.05],[dx+1.45,1.7,-.05],c.danger,.015);
    lab.label('F = '+fmt(F*1000,2)+' mN',[dx+.5,2.16,-.1],c.danger);
    lab.label('L '+fmt(film.L*100,1)+' cm',[left-.25,1.7,0]);
    lab.label('x '+fmt(film.x*100,1)+' cm',[(left+bar[0])/2,bot-.3,0]);
    lab.label('Sovun pardasi: ikki sirt',[-.7,3.2,0],c.special);
    lab.box(-1.2,.04,-1.35,1.1,.36,.35,c.bg2);dial(lab,[-.65,.26,-1.38],st.t/90,c.danger,'temp','t');lab.label(fmt(st.t,0)+' °C',[-.65,.84,-1.3],c.danger);
  }
  function capScene(st,cap,sigma){
    const c=lab.colors,L=P.LIQUIDS[st.liq],wet=P.wets(L.theta),col=st.liq==='mercury'?c.text3:c.primary,ys=.95;
    lab.box(-1.05,.16,-.5,3.8,.06,1,c.text3);
    lab.box(-1.05,.22,-.5,3.8,ys-.22,1,alpha(col,.15));
    for(const z of [-.5,.5])lab.face([[-1.05,.22,z],[2.75,.22,z],[2.75,1.02,z],[-1.05,1.02,z]],alpha(c.text3,.12));
    for(const x of [-1.05,2.75])lab.face([[x,.22,-.5],[x,.22,.5],[x,1.02,.5],[x,1.02,-.5]],alpha(c.text3,.12));
    const radii=[.25e-3,.5e-3,1e-3,cap.r],xs=[-.6,.25,1.1,2.1];
    for(let i=0;i<4;i++){
      const r=radii[i],x=xs[i],rr=.035+r*40,h=P.capillaryH(sigma,L.rho,r,L.theta),y=ys+12*h;
      tube([x,.25,0],rr,2.6,alpha(c.text3,.22),true);
      tube([x,.25,0],rr*.85,Math.max(.01,y-.25),alpha(col,.52));
      disk([x,.25,0],rr*.85,alpha(col,.5));meniscus(x,y,0,rr*.86,wet,col);
      lab.label(fmt(r*1000,2)+' mm',[x,3.09,0],i===3?c.warning:c.text2);
      lab.label((h<0?'−':'')+fmt(Math.abs(h)*1000,1)+' mm',[x,y+.2,-.12],col);
      if(i===3){const p=[x+rr,2.6,-.08];lab.rod([x,2.6,0],p,.018,c.warning,8);lab.handle('radius',p,.18);}
    }
    lab.line([-1.05,ys,-.51],[2.75,ys,-.51],c.text3,1.2);
    lab.label('Sath: h = 0',[1,.58,-.65]);
    // Sessile drop: contact angle measured through liquid, on a real glass plate.
    const x=-2.2,plate=.3,z=.1,theta=Math.max(.08,L.theta),R=.42;
    lab.box(x-.65,.18,z-.6,1.3,.12,1.2,alpha(c.text3,.3));
    if(L.theta<.05){cylinder([x,plate,z],.54,.025,alpha(col,.5));}
    else{
      const at=(a,t)=>[x+R*Math.sin(a)*Math.cos(t),plate+R*(Math.cos(a)-Math.cos(theta)),z+R*Math.sin(a)*Math.sin(t)];
      for(let j=0;j<16;j++)for(let i=0;i<32;i++)lab.face([at(j*theta/16,i*TAU/32),at((j+1)*theta/16,i*TAU/32),at((j+1)*theta/16,(i+1)*TAU/32),at(j*theta/16,(i+1)*TAU/32)],alpha(col,.7));
    }
    lab.label(wet?'Botiq menisk · ho‘llash':'Qavariq menisk · ho‘llamaslik',[0,3.5,0]);
    lab.label('θ '+fmt(L.theta/P.DEG,0)+'°',[x,1.55,z]);
    lab.label('Shisha plastinka',[x,.07,-.6]);
    lab.box(-2.7,.04,-1.32,1,.3,.35,c.bg2);dial(lab,[-2.2,.24,-1.35],st.t/90,c.danger,'temp','t');
  }
  function dropsScene(st,drops,sigma){
    const c=lab.colors,L=P.LIQUIDS[st.liq],cx=-.7,m=P.dropMass(sigma,drops.d),r=P.dropRadius(m,L.rho)*17;
    stand(lab,-1.65,.3,3.3,c.text3);lab.rod([-1.65,2.8,.3],[cx,2.8,0],.03,c.text3,10);
    tube([cx,2.25,0],.13,1,alpha(c.text3,.22),true);cylinder([cx,2.25,0],.115,.8,alpha(c.primary,.4));
    for(let i=1;i<9;i++){const y=2.25+i*.11;lab.line([cx-.12,y,-.06],[cx-.045,y,-.12],c.text3,.8);}
    lab.rod([cx,2.08,0],[cx,2.25,0],.035,c.text3,12);
    lab.rod([cx-.22,2.15,0],[cx+.22,2.15,0],.045,drops.open?c.success:c.danger,12);lab.handle('cock',[cx+.2,2.15,-.03],.2);
    const rr=.025+drops.d*15;lab.rod([cx,2.08,0],[cx,DROP_TIP,0],rr,alpha(c.text3,.5),14);
    lab.handle('tip',[cx+rr,DROP_TIP,-.03],.16);
    if(drops.grow>.01)lab.sphere([cx,DROP_TIP-r*Math.cbrt(drops.grow),0],r*Math.cbrt(drops.grow),c.primary);
    for(const f of drops.falling)lab.sphere([cx,f.y,0],r,c.primary);
    lab.box(cx-.85,.04,-.67,1.7,.29,1.34,c.bg2);lab.rod([cx,.33,0],[cx,.39,0],.5,c.text3,32);
    const fill=.04+.12*drops.N/60;
    tube([cx,.4,0],.43,.55,alpha(c.text3,.22),true);disk([cx,.4,0],.43,c.text3);cylinder([cx,.42,0],.4,fill,alpha(c.primary,.45));
    lab.box(cx-.5,.12,-.69,1,.15,.018,c.sunken);lab.label(Math.round(drops.M*1e6)+' mg',[cx,.19,-.72],c.success);
    lab.label('N = '+drops.N,[1.1,1.5,-.1],c.text2);lab.label('d '+fmt(drops.d*1000,1)+' mm',[1.1,2,-.1]);
    lab.label(drops.open?'Jo‘mrak ochiq':'Jo‘mrak yopiq',[cx,3.55,0],drops.open?c.success:c.danger);
    lab.label('σ = Mg / (πdN)',[1.3,.8,-.1],c.primary);
  }
  return {lab,
    draw(ctx,stage,ui,st,film,cap,drops,sigma){current={ui,st,film,cap,drops};lab.begin(ctx,stage,{target:[0,1.6,0],focal:1.65});if(ui.mode==='film')filmScene(st,film,sigma);else if(ui.mode==='cap')capScene(st,cap,sigma);else dropsScene(st,drops,sigma);lab.finish(0,ui.mode==='cap'?'h bir xil masshtabda · nay radiuslari kattalashtirilgan':ui.mode==='drops'?'Tomchilar kattalashtirilgan · tarozi: 1 mg':'Parda: ikki sirt · kuch to‘singa perpendikulyar');},
    parameter(id,p){if(id==='bar')return lab.nearest(filmPoint,.01,.09,p.x,p.y);if(id==='length')return lab.nearest(filmLengthPoint,.02,.08,p.x,p.y);return null;},
  };
}
