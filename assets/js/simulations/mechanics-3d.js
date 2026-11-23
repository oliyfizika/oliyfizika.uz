// Laboratory apparatus only; positions and forces come from the existing physics models.
import { createLab3D } from './lab-3d.js?v=20261122';
import { DEG, clamp, fmt } from './sim-kit.js';
import { dynamics, G, PLANE_LENGTH, BLOCK } from './incline-physics.js';
import { stateAt } from './projectile-physics.js';

export function createPendulumLab() {
  const lab=createLab3D();
  let length=1.4,pivot=[0,2,0];
  const bob=th=>[pivot[0]+length*Math.sin(th),pivot[1]-length*Math.cos(th),0];
  function draw(ctx,stage,P,s,lin,show,hist,energy) {
    lab.begin(ctx,stage,{target:[0,1.6,0],focal:1.5});
    const c=lab.colors;
    length=1.25+.3*Math.sqrt(P.L/10);pivot=[0,2,0];
    // Rear support leaves the full 360° swing of the mass unobstructed.
    lab.box(-.65,.02,-.9,1.3,.12,.85,c.text3);
    lab.rod([0,.14,-.6],[0,2.2,-.6],.045,c.text3);
    lab.rod([0,2,-.6],pivot,.04,c.text3);
    lab.rod([0,2,-.15],[0,2,.15],.075,c.primary);
    lab.line(pivot,[0,2-length,0],c.borderStrong,1);
    for(let i=-90;i<90;i+=3) {
      const a=i*DEG,b=(i+3)*DEG;
      lab.line([.38*Math.sin(a),2-.38*Math.cos(a),.025],[.38*Math.sin(b),2-.38*Math.cos(b),.025],c.text3,1);
    }
    for(const a of [-90,-60,-30,0,30,60,90]) {
      const t=a*DEG;
      lab.line([.36*Math.sin(t),2-.36*Math.cos(t),.025],[.42*Math.sin(t),2-.42*Math.cos(t),.025],c.text2,1.5);
    }
    if(show.trail&&hist.length>1) {
      const i0=Math.max(hist.firstFrom(s.t-5),1);
      for(let i=i0;i<hist.length;i+=3)lab.line(bob(hist.th[Math.max(i0-1,i-3)]),bob(hist.th[i]),c.primary,1.4);
    }
    if(show.lin) {
      const ghost=bob(lin.th);
      lab.rod(pivot,[ghost[0],ghost[1],-.04],.012,c.text3);
      lab.sphere([ghost[0],ghost[1],-.04],.085,c.text3);
      lab.label('sin θ ≈ θ',[ghost[0],ghost[1]+.22,-.04]);
    }
    const b=bob(s.th),r=.13+.035*Math.cbrt(P.m);
    lab.rod(pivot,b,.018,c.text2);lab.sphere(b,r,c.primary);lab.handle('bob',b,r);
    lab.label(`L = ${fmt(P.L,2)} m`,[b[0]*.5+.35,(b[1]+2)*.5,.05]);
    lab.label(`θ = ${fmt(Math.atan2(Math.sin(s.th),Math.cos(s.th))/DEG,1)}°`,[-.6,2.35,.05]);
    const origin=[b[0],b[1],.2],mg=P.m*P.g,N=P.m*(P.g*Math.cos(s.th)+P.L*s.w*s.w);
    if(show.forces) {
      lab.vector(origin,[0,-.65,0],c.special,'mg');
      const len=clamp(N/mg*.65,-1.2,1.2);
      lab.vector(origin,[-Math.sin(s.th)*len,Math.cos(s.th)*len,0],c.success,'N');
    }
    if(show.components) {
      const a=-Math.sin(s.th)*.65,b=Math.cos(s.th)*.65;
      lab.vector(origin,[Math.cos(s.th)*a,Math.sin(s.th)*a,0],c.special,'mg sinθ');
      lab.vector(origin,[Math.sin(s.th)*b,-Math.cos(s.th)*b,0],c.text3,'mg cosθ');
    }
    if(show.velocity){const v=clamp(P.L*s.w/Math.sqrt(P.g*P.L)*.65,-1.2,1.2);lab.vector(origin,[Math.cos(s.th)*v,Math.sin(s.th)*v,0],c.warning,'v');}
    if(show.energy)lab.bars(energy.K,energy.U,energy.ref);
    lab.finish(s.t,'Vaznsiz qattiq sterjen · tasvir masshtabi avtomatik');
  }
  return {lab,draw,angle:(x,y)=>lab.nearest(bob,-179*DEG,179*DEG,x,y)};
}

export function createInclineLab() {
  const lab=createLab3D(),scale=.82;
  let theta=30*DEG;
  const topAt=t=>[-PLANE_LENGTH*scale*Math.cos(t)/2,.18+PLANE_LENGTH*scale*Math.sin(t),0];
  const point=x=>{
    const top=topAt(theta),n=[Math.sin(theta),Math.cos(theta),0];
    return [top[0]+x*scale*Math.cos(theta)+n[0]*BLOCK*scale/2,top[1]-x*scale*Math.sin(theta)+n[1]*BLOCK*scale/2,0];
  };
  function draw(ctx,stage,p,st,show) {
    theta=p.theta;lab.begin(ctx,stage,{target:[0,1.4,0],focal:1.4});
    const c=lab.colors,top=topAt(theta),bottom=[-top[0],.18,0],width=.78;
    // Solid ramp: triangular side plates and a calibrated sliding surface.
    for(const z of [-width/2,width/2])lab.face([[top[0],.08,z],[bottom[0],.08,z],[bottom[0],bottom[1],z],[top[0],top[1],z]],c.bg2);
    lab.face([[top[0],top[1],-.39],[bottom[0],bottom[1],-.39],[bottom[0],bottom[1],.39],[top[0],top[1],.39]],c.text3);
    lab.face([[top[0],.08,-.39],[top[0],top[1],-.39],[top[0],top[1],.39],[top[0],.08,.39]],c.bg2);
    for(const x of [top[0],bottom[0]])lab.box(x-.18,.015,-.6,.36,.07,1.2,c.text2);
    for(let i=0;i<=50;i++) {
      const t=i/50,x=top[0]+(bottom[0]-top[0])*t,y=top[1]+(bottom[1]-top[1])*t+.008;
      lab.line([x,y,.4],[x,y,.4+(i%10===0?.15:.07)],c.text2,i%10===0?1.5:1);
      if(i%10===0)lab.label(`${i/10} m`,[x,y+.06,.7]);
    }
    const b=point(st.x),a=BLOCK*scale/2,t=[Math.cos(theta),-Math.sin(theta),0],n=[Math.sin(theta),Math.cos(theta),0];
    const corner=(tx,ny,z)=>[b[0]+tx*t[0]+ny*n[0],b[1]+tx*t[1]+ny*n[1],z];
    lab.solid([corner(-a,-a,-a),corner(a,-a,-a),corner(a,a,-a),corner(-a,a,-a),corner(-a,-a,a),corner(a,-a,a),corner(a,a,a),corner(-a,a,a)],c.primary);
    lab.handle('block',b,a);lab.label(`${fmt(p.m,1)} kg`,[b[0],b[1]+.25,.32],c.primary);
    const knob=[top[0]-.55,top[1]+.12,.55];lab.rod([top[0],top[1],.4],knob,.025,c.text3);lab.sphere(knob,.09,c.warning);lab.handle('angle',knob);
    lab.label(`θ = ${fmt(theta/DEG,0)}°`,[top[0]-.1,top[1]+.4,.5]);
    const d=dynamics(st.v,p),origin=[b[0],b[1],.36],force=v=>clamp(v/(p.m*G)*.7,-1,1);
    const along=(u,axis)=>axis.map(v=>v*u);
    if(show.forces) {
      lab.vector(origin,[0,-.7,0],c.special,'mg');
      lab.vector(origin,along(force(d.N),n),c.success,'N');
      lab.vector(origin,along(force(d.friction),t),c.warning,'Fᵢ');
    }
    if(show.net)lab.vector([b[0],b[1],-.5],along(force(p.m*d.a),t),c.danger,'ma');
    if(show.components) {
      lab.vector(origin,along(force(d.gPar),t),c.special,'mg sinθ');
      lab.vector(origin,along(-force(d.N),n),c.text3,'mg cosθ');
    }
    lab.finish(st.t,`Tekislik: 5 m · μ = ${fmt(p.mu,2)} · tasvir masshtabi avtomatik`);
  }
  return {lab,draw,angle:(x,y)=>lab.nearest(t=>{const p=topAt(t);return[p[0]-.55,p[1]+.12,.55];},0,60*DEG,x,y),position:(x,y)=>lab.nearest(point,BLOCK/2,PLANE_LENGTH-BLOCK/2,x,y)};
}

export function createProjectileLab() {
  const lab=createLab3D();
  let map,origin,velocityScale;
  function draw(ctx,stage,p,sol,flight,traces,show) {
    lab.begin(ctx,stage,{target:[0,1.25,0],focal:1.6});const c=lab.colors;
    const all=[...traces,{p,sol}];
    const range=Math.max(1,...all.map(t=>t.sol.L)),height=Math.max(1,...all.map(t=>t.sol.H));
    const scale=Math.min(4.5/range,2.65/height);
    const offset=sol.vertical?0:-range*scale/2;
    map=(x,y)=>[offset+x*scale,.13+y*scale,0];origin=map(0,p.h0);
    velocityScale=.8/Math.max(p.v0,10);
    if(p.h0>0){
      lab.box(origin[0]-.35,.02,-.36,.7,Math.max(.02,p.h0*scale-.04),.72,c.bg2);
      lab.rod([origin[0]-.4,.02,-.5],[origin[0]-.4,origin[1]+.2,-.5],.025,c.text3);
    }
    // Adjustable launch cradle and a target tray stand on the laboratory bench.
    lab.box(origin[0]-.22,origin[1]-.12,-.3,.44,.09,.6,c.text3);
    lab.rod([origin[0]-.1*Math.cos(p.alpha),origin[1]-.1*Math.sin(p.alpha),-.18],[origin[0]+.28*Math.cos(p.alpha),origin[1]+.28*Math.sin(p.alpha),-.18],.055,c.primary);
    const endpoint=map(sol.L,0);
    lab.box(endpoint[0]-.22,.015,-.38,.44,.035,.76,c.success);
    for(let i=0;i<=10;i++){
      const x=-2.5+i*.5;lab.line([x,.025,.8],[x,.025,.9],c.text2,1);
    }
    const path=(pp,ss,end,color,width=1.5,dashed=false)=>{
      let prev=stateAt(pp,0);
      for(let i=1;i<=120;i++){
        const a=stateAt(pp,end*i/120);
        if(!dashed||i%4<2)lab.line(map(prev.x,Math.max(0,prev.y)),map(a.x,Math.max(0,a.y)),color,width);
        prev=a;
      }
    };
    for(const tr of traces)if(!tr.sol.vertical)path(tr.p,tr.sol,tr.sol.T,c.text3,1.1);
    if(show.preview)path(p,sol,sol.T,c.primary,1.6,true);
    if(flight)path(p,sol,flight.t,c.primary,2.3);
    const t=flight?flight.t:0,state=stateAt(p,t),ball=map(state.x,Math.max(0,state.y));
    lab.sphere(ball,.12,c.primary);
    if(!flight||flight.landed){
      const handle=origin.map((v,i)=>v+[Math.cos(p.alpha)*p.v0*velocityScale,Math.sin(p.alpha)*p.v0*velocityScale,0][i]);
      lab.vector(origin,handle.map((v,i)=>v-origin[i]),c.warning,'v₀');lab.sphere(handle,.07,c.warning);lab.handle('aim',handle);lab.handle('aim',origin);
    }
    const vref=.9/Math.max(p.v0,Math.abs(sol.vy-p.g*sol.T),10);
    if(show.velocity)lab.vector(ball,[state.vx*vref,state.vy*vref,0],c.warning,'v');
    if(show.components){lab.vector(ball,[state.vx*vref,0,0],c.success,'vₓ');lab.vector(ball,[0,state.vy*vref,0],c.primary,'vᵧ');}
    if(show.gravity)lab.vector([ball[0],ball[1],.22],[0,-.65,0],c.special,'g');
    if(show.markers){
      const apex=map(sol.xTop,sol.H);lab.sphere(apex,.045,c.success);
      lab.label(`H = ${fmt(sol.H,1)} m`,[apex[0],apex[1]+.2,0]);
      lab.label(`L = ${fmt(sol.L,1)} m`,[endpoint[0],.1,.65]);
      lab.label(`h₀ = ${fmt(p.h0,0)} m`,[origin[0]-.3,origin[1]+.2,0]);
    }
    lab.finish(t,'x va y bir xil masshtabda · havo qarshiligi hisobga olinmaydi');
  }
  return {lab,draw,aim(x,y){const q=lab.planePoint(x,y);return q?{vx:(q[0]-origin[0])/velocityScale,vy:(q[1]-origin[1])/velocityScale}:null;}};
}
