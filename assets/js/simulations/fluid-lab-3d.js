// Tabletop ideal-flow apparatus. Particle advection and all SI models stay in fluid.js.
import { createLab3D } from './lab-3d.js?v=20261123-batch7b';
import { alpha, arrowSolid, dashed, dial, path } from './apparatus-3d.js?v=20261123-batch7b';
import { clamp, fmt } from './sim-kit.js';
import * as P from './fluid-physics.js';

export const flowPoint=(x,y=0,z=0)=>[-2.2+x*.052,1.25+y*.052,z];
export const bernPoint=(x,y=0,z=0)=>[-2.55+x*.038,.65+y*.038,z];
export const torPoint=(x,y,z=0)=>[-1.9+x*1.5,.18+y*1.5,z];
export const wingPoint=(x,y,z=0)=>[x*.55,1.6+y*.55,z];
export const sprayPoint=(x,y,z=0)=>[-2.6+x*.065,.95+y*.065,z];

export function createFluidLab() {
  const lab=createLab3D();let current,fieldKey='',field=[];
  const dot=(p,r,color)=>{
    const a=[[p[0]+r,p[1],p[2]],[p[0]-r,p[1],p[2]],[p[0],p[1]+r,p[2]],[p[0],p[1]-r,p[2]],[p[0],p[1],p[2]+r],[p[0],p[1],p[2]-r]];
    for(const ids of [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]])lab.face(ids.map(i=>a[i]),color);
  };
  function circleX(p,r,color,width=.014) {
    for(let i=0;i<32;i++){const point=t=>[p[0],p[1]+r*Math.cos(t),p[2]+r*Math.sin(t)];lab.rod(point(i*Math.PI/16),point((i+1)*Math.PI/16),width,color,6);}
  }
  function pipe(pipe,map,color,opacity=.16,from=pipe.x0,to=pipe.x1) {
    if(to<=from)return;
    const count=Math.ceil((to-from)/2),n=14;
    let prev;
    for(let i=0;i<=count;i++){
      const x=from+(to-from)*i/count,a=pipe.at(x),r=a.d/2;
      const row=Array.from({length:n},(_,j)=>map(x,a.y+r*Math.cos(j*Math.PI*2/n),r*Math.sin(j*Math.PI*2/n)*(map===flowPoint?.052:.038)));
      if(prev)for(let j=0;j<n;j++)lab.face([prev[j],row[j],row[(j+1)%n],prev[(j+1)%n]],alpha(color,opacity));
      prev=row;
    }
  }
  function pipeDetails(pipe,map,parts,color) {
    const c=lab.colors,k=map===flowPoint?.052:.038;
    for(const x of [pipe.x0,pipe.x1]){const a=pipe.at(x);circleX(map(x,a.y),a.d/2*k,c.text3,.018);}
    for(let i=0;i<parts.n;i+=2){const x=parts.x[i],a=pipe.at(x),theta=i*2.399963,e=parts.e[i];dot(map(x,a.y+e*a.d/2*Math.cos(theta),e*a.d/2*Math.sin(theta)*k),.025,color);}
    for(const t of [.1,.5,.9]){
      const x=pipe.x0+(pipe.x1-pipe.x0)*t,a=pipe.at(x),p=map(x,a.y-a.d/2);
      for(const z of [-.24,.24]){lab.rod([p[0],.08,z],[p[0],p[1],z],.023,c.text3,8);lab.box(p[0]-.14,.03,z-.15,.28,.05,.3,c.text3);}
    }
  }
  function knob(x,label,id,frac,value,color) {
    const c=lab.colors;
    lab.box(x-.3,.05,-1.15,.6,.42,.3,c.bg2);
    dial(lab,[x,.29,-1.17],frac,color,id,label);
    lab.label(value,[x,.85,-1.16],color);
  }
  function flowScene(ui,flow,parts) {
    const c=lab.colors,pipeModel=flow.pipe;
    pipe(pipeModel,flowPoint,c.primary);pipeDetails(pipeModel,flowPoint,parts,c.primary);
    const sl=flow.slab;
    pipe(pipeModel,flowPoint,c.warning,.45,Math.max(0,sl.a),Math.min(pipeModel.x1,sl.b));
    for(const [i,x]of [12,46,80].entries()){
      const d=flow.d[i],r=d*.052/2,p=flowPoint(x,d/2,-.03);
      circleX(flowPoint(x),r,c.text3,.014);dot(p,.055,c.warning);lab.handle('d'+i,p,.16);
      lab.label('d'+'₁₂₃'[i]+' = '+fmt(d,1)+' cm',[p[0],.75,-.38],c.text2);
      if(ui.show.vec){const v=P.speed(flow.Q/1000,d/100),len=v/Math.max(...flow.d.map(dd=>P.speed(flow.Q/1000,dd/100)))*.65;arrowSolid(lab,flowPoint(x-3,0,-.08),[flowPoint(x-3)[0]+len,1.25,-.08],c.danger,.014);}
    }
    knob(-2.55,'Q','knobF',(flow.Q-.2)/1.8,fmt(flow.Q,2)+' L/s',c.primary);
    lab.label('V = '+fmt(sl.V,0)+' cm³',[.7,2.05,.1],c.warning);
    lab.rod([flowPoint(0)[0],.2,-.55],[flowPoint(92)[0],.2,-.55],.01,c.text3,6);
    for(let x=0;x<=80;x+=20){const px=flowPoint(x)[0];lab.line([px,.2,-.55],[px,.27,-.55],c.text3);lab.label(String(x),[px,.07,-.55]);}
    lab.label('Q = Sv · x: cm',[.5,.14,-1.2]);
  }
  function bernScene(ui,bern,parts,at) {
    const c=lab.colors;
    pipe(bern.pipe,bernPoint,c.primary);pipeDetails(bern.pipe,bernPoint,parts,c.primary);
    const E=at(0).E;
    dashed(lab,bernPoint(0,E,.15),bernPoint(136,E,.15),c.special);
    lab.label('To‘liq napor',[0,bernPoint(0,E)[1]+.25,.1],c.special);
    for(const [i,x]of [12,50,85,122].entries()){
      const b=at(x),bottom=b.y+b.d/2,start=bernPoint(x,bottom),top=bernPoint(x,66),surface=bernPoint(x,Math.max(bottom,b.lvl));
      lab.rod(start,top,.055,alpha(c.text3,.16),12);
      if(b.lvl>bottom)lab.rod(start,surface,.028,c.primary,10);
      lab.label('h'+'₁₂₃₄'[i]+' '+fmt(b.hp,1)+' cm',[top[0],Math.max(surface[1],start[1])+.18,0],b.hp<0?c.danger:c.primary);
      lab.label(String(i+1),[top[0],top[1]+.15,0]);
      if(i===0){dot(surface,.05,c.warning);lab.handle('lv',surface,.17);}
      if(ui.show.vec){const p=bernPoint(x,b.y,-.12);arrowSolid(lab,p,[p[0]+Math.max(.1,b.v/at(50).v*.55),p[1],p[2]],c.danger,.012);}
    }
    const th=bernPoint(50,-bern.dt/2,-.12),ry=bernPoint(129,bern.dy-5,-.12);
    for(const [id,p]of [['th',th],['ry',ry]]){dot(p,.05,c.warning);lab.handle(id,p,.17);}
    knob(-2.62,'Q','knobB',(bern.Q-.5)/3.5,fmt(bern.Q,1)+' L/s',c.primary);
  }
  function torScene(ui,tor) {
    const c=lab.colors,left=torPoint(0,0),right=torPoint(.5,0),top=torPoint(0,1.6),surface=torPoint(0,tor.H);
    lab.box(left[0]-.05,.04,-.44,.85,.14,.88,c.text3);
    lab.box(left[0],left[1],-.34,.75,tor.H*1.5,.68,alpha(c.primary,.24));
    lab.face([[left[0],surface[1],-.34],[right[0],surface[1],-.34],[right[0],surface[1],.34],[left[0],surface[1],.34]],alpha(c.primary,.4));
    for(const x of [left[0],right[0]])for(const z of [-.36,.36])lab.rod([x,left[1],z],[x,top[1],z],.02,c.text3,8);
    for(const z of [-.36,.36])lab.rod([left[0],top[1],z],[right[0],top[1],z],.02,c.text3,8);
    path(lab,[[-2.55,.08,.3],[-2.55,2.95,.3],[-1.55,2.95,.3],[-1.55,2.75,.3]],c.text3,.04);
    lab.rod([-1.55,2.75,.3],[-1.55,surface[1],.3],.016,alpha(c.primary,.5),6);
    lab.box(right[0],.04,-.5,3.9,.11,1,c.bg2);
    for(let x=0;x<=2;x+=.25){const p=torPoint(.5+x,0,-.44);lab.line(p,[p[0],p[1]+.08,p[2]],c.text3,1);if(x%0.5===0)lab.label(fmt(x,1)+' m',[p[0],.18,-.68]);}
    const hp=torPoint(.25,tor.H,-.36);dot(hp,.06,c.warning);lab.handle('lvl',hp,.16);
    lab.label('H '+fmt(tor.H,2)+' m',[left[0]-.25,surface[1],-.36],c.primary);
    const holes=tor.holes===1?[tor.yh]:[.25,.5,.75].map(f=>f*tor.H);
    for(const [i,y]of holes.entries()){
      const v=P.torricelliV(tor.H-y),T=Math.sqrt(2*y/P.G),points=[];
      for(let j=0;j<=40;j++){const t=T*j/40;points.push(torPoint(.5+v*t,y-.5*P.G*t*t,0));}
      path(lab,points,alpha(c.primary,.5),.02);
      for(let j=0;j<14;j++){const t=((ui.t*.7+j*T/14)%T);dot(torPoint(.5+v*t,y-.5*P.G*t*t,0),.035,c.primary);}
      const start=torPoint(.5,y,0);circleX(start,.035,c.text2,.01);
      if(tor.holes===1){lab.handle('hole',start,.17);lab.label('l = '+fmt(P.jetRange(tor.H,y),2)+' m',[torPoint(.5+P.jetRange(tor.H,y),0)[0],.5,.15],c.success);}
      if(ui.show.vec)arrowSolid(lab,start,[start[0]+v*.1,start[1],0],c.danger,.014);
    }
    dashed(lab,torPoint(0,tor.H/2,-.36),torPoint(.5,tor.H/2,-.36),c.text3);
  }
  function wingScene(ui,wing,particles,helpers) {
    const c=lab.colors,outline=wing.foil.outline.filter((_,i)=>i%2===0),at=(x,y,z)=>{const q=helpers.rot(x,y);return wingPoint(q[0],q[1],z);};
    for(const x of [-2.8,2.8])for(const z of [-.85,.85])lab.rod([x,.3,z],[x,2.95,z],.025,c.text3,8);
    for(const y of [.3,2.95])for(const z of [-.85,.85])lab.rod([-2.8,y,z],[2.8,y,z],.025,c.text3,8);
    lab.rod([-.3,.05,.6],[-.3,1.42,.6],.03,c.text3,8);
    const key=wing.key+'|'+c.primary+'|'+c.danger;
    if(fieldKey!==key){fieldKey=key;field=[];for(let y=-2.2;y<2.2;y+=.2)for(let x=-4.6;x<4.8;x+=.22){const v=helpers.vel(x+.11,y+.1);if(!v)continue;const cp=1-v[0]**2-v[1]**2;field.push({x,y,color:alpha(cp<0?c.primary:c.danger,Math.min(.3,Math.abs(cp)*.2))});}}
    for(const f of field)lab.face([wingPoint(f.x,f.y,.79),wingPoint(f.x+.22,f.y,.79),wingPoint(f.x+.22,f.y+.2,.79),wingPoint(f.x,f.y+.2,.79)],f.color);
    for(const L of helpers.lines())for(let i=4;i<L.length;i+=4)lab.line(wingPoint(...L[i-4],-.7),wingPoint(...L[i],-.7),alpha(c.text3,.48),.8);
    for(let i=0;i<particles.X.length;i+=3)dot(wingPoint(particles.X[i],particles.Y[i],-.67),.023,c.text2);
    for(let i=0;i<outline.length-1;i++){
      const [x,y]=outline[i],[x1,y1]=outline[i+1];
      lab.face([at(x,y,-.55),at(x1,y1,-.55),at(x1,y1,.55),at(x,y,.55)],c.text3);
    }
    for(const z of [-.55,.55])lab.face(outline.map(p=>at(...p,z)),c.bg2);
    const te=at(2,0,-.58);dot(te,.055,c.warning);lab.handle('te',te,.17);
    const lift=at(-.9,.12,-.63),L=clamp(wing.foil.CL*.45,-.65,1.1);
    if(Math.abs(L)>.015){arrowSolid(lab,lift,[lift[0],lift[1]+L,lift[2]],c.success,.02);lab.label('F',[lift[0]-.15,lift[1]+L,lift[2]],c.success);}
    if(ui.show.vec)for(const p of [wing.top,wing.bot]){if(!Number.isFinite(p.q))continue;const a=at(p.x,p.y,-.62),len=p.q*.35;arrowSolid(lab,[a[0]-len/2,a[1],a[2]],[a[0]+len/2,a[1],a[2]],c.danger,.012);}
    knob(-2.3,'V','knobW',(wing.V-10)/70,fmt(wing.V,0)+' m/s',c.primary);
    lab.label('α '+fmt(wing.alpha*180/Math.PI,1)+'°',[1.6,.25,-1.2],c.warning);
    lab.label('Ko‘k: p < p₀ · qizil: p > p₀',[.5,3.17,.79],c.text2);
    if(wing.alpha>10*Math.PI/180)lab.label('Oqim uzilishi modelga kirmaydi',[.5,.05,-1.35],c.warning);
  }
  function sprayScene(ui,spray) {
    const c=lab.colors,h=P.sprayRise(spray.v)*100,on=h>=spray.hs,jy=spray.hs+1.3,at=sprayPoint;
    const a=at(28,-10),b=at(52,0);
    lab.box(a[0]-.04,.15,-.47,1.64,.14,.94,c.text3);
    lab.box(a[0],a[1],-.4,b[0]-a[0],.65,.8,alpha(c.primary,.24));
    lab.face([[a[0],.95,-.4],[b[0],.95,-.4],[b[0],.95,.4],[a[0],.95,.4]],alpha(c.primary,.38));
    for(const x of [a[0],b[0]])for(const z of [-.42,.42])lab.rod([x,a[1],z],[x,1.02,z],.018,c.text3,8);
    const bottom=at(40,-9.3),tip=at(40,spray.hs);
    lab.rod(bottom,tip,.055,alpha(c.text3,.18),16);lab.rod(bottom,at(40,Math.min(h,spray.hs)),.028,c.primary,12);
    const airA=at(6,jy),airB=at(39,jy);
    lab.rod(airA,airB,.065,alpha(c.text3,.18),16);circleX(airB,.065,c.text3,.014);
    const bulb=at(1,jy);lab.sphere(bulb,.24,c.danger);lab.rod([bulb[0]+.15,bulb[1],0],airA,.05,c.text3,12);
    for(let j=0;j<30;j++)if(spray.v>.2){const x=7+((ui.t*(6+spray.v*.9)+j*17.9)%71),off=Math.sin(j*2.4)*(x<39?.4:.4+.04*(x-39)),p=at(x,jy+off);lab.line(p,[p[0]+.08,p[1],p[2]],c.text3,1.2);}
    if(on)for(let j=0;j<28;j++){const t=(ui.t+j*1.5/28)%1.5,v=(8+spray.v*.9)*(.6+.7*((Math.sin(j*91)+1)/2)),y=spray.hs+.5+Math.sin(j*7)*2*t-4.5*t*t,x=40.4+v*t;if(x<79&&y>-10)dot(at(x,y,Math.sin(j*3)*.06),.025,c.primary);}
    dot([tip[0],tip[1],-.1],.05,c.warning);lab.handle('tip',[tip[0],tip[1],-.1],.16);
    lab.label('hₛ '+fmt(spray.hs,1)+' cm',[.55,tip[1]+.25,0],c.primary);
    knob(-1.8,'v','knobS',spray.v/50,fmt(spray.v,1)+' m/s',c.primary);
    lab.label(on?'Purkash':'Suyuqlik uchigacha yetmadi',[1.4,.28,-.65],on?c.success:c.warning);
    if(ui.show.vec&&spray.v>.2){const p=at(48,jy+2.6);arrowSolid(lab,p,[p[0]+Math.min(.7,spray.v*.02),p[1],0],c.danger,.014);}
  }
  function draw(ctx,stage,ui,flow,bern,tor,wing,spray,parts,helpers) {
    current={ui,flow,bern,tor,wing,spray,helpers};
    lab.begin(ctx,stage,{target:[0,1.35,0],focal:1.7});
    if(ui.mode==='flow')flowScene(ui,flow,parts.flow);else if(ui.mode==='bern')bernScene(ui,bern,parts.bern,helpers.bernAt);
    else if(ui.sub==='tor')torScene(ui,tor);else if(ui.sub==='wing')wingScene(ui,wing,parts.wing,helpers);else sprayScene(ui,spray);
    lab.finish(ui.t,ui.mode==='flow'?'Quvur: bir xil x/y masshtab · Q = Sv':ui.mode==='bern'?'Manometr: ortiqcha bosim · napor: cm':ui.sub==='tor'?'Oqim tezligi haqiqiy · vaqt sekinlashtirilgan':ui.sub==='wing'?'Bosim: 2D kesim · qanot modeli: 3D':'Havo va tomchilar sekinlashtirilgan');
  }
  function parameter(id,p) {
    const {flow,bern,tor}=current;
    if(/^d\d$/.test(id)){const i=+id[1];return lab.nearest(d=>flowPoint([12,46,80][i],d/2,-.03),3,14,p.x,p.y);}
    if(id==='th')return lab.nearest(d=>bernPoint(50,-d/2,-.12),3.5,9,p.x,p.y);
    if(id==='ry')return lab.nearest(y=>bernPoint(129,y-5,-.12),0,20,p.x,p.y);
    if(id==='lv')return lab.nearest(y=>bernPoint(12,y),25,60,p.x,p.y);
    if(id==='lvl')return lab.nearest(H=>torPoint(.25,H,-.36),.7,1.5,p.x,p.y);
    if(id==='hole')return lab.nearest(y=>torPoint(.5,y),.05,tor.H-.05,p.x,p.y);
    if(id==='te')return lab.nearest(a=>wingPoint(2*Math.cos(a),-2*Math.sin(a),-.58),-4*Math.PI/180,12*Math.PI/180,p.x,p.y);
    if(id==='tip')return lab.nearest(h=>{const q=sprayPoint(40,h);q[2]=-.1;return q;},1,10,p.x,p.y);
    return null;
  }
  return {lab,draw,parameter};
}
