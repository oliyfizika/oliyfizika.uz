import { createLab3D } from './lab-3d.js?v=20261123-batch8e';
import { alpha, arrowSolid, dial, path } from './apparatus-3d.js?v=20261123-batch8e';
import { clamp, fmt } from './sim-kit.js';
export const fieldPoint=(x,y,z=0)=>[x*.125,1.6+y*.125,z];
export const platePoint=d=>[.2+d*.05+.035,1.55,-.48];

export function createPotentialLab(){
  const lab=createLab3D();let state,key='',field={cells:[],segs:[],lines:[]};
  function ball(p,r,color){
    const at=(i,j)=>[p[0]+r*Math.sin(i*Math.PI/8)*Math.cos(j*Math.PI/6),p[1]+r*Math.cos(i*Math.PI/8),p[2]+r*Math.sin(i*Math.PI/8)*Math.sin(j*Math.PI/6)];
    for(let i=0;i<8;i++)for(let j=0;j<12;j++)lab.face([at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)],color);
  }
  function fieldCache(ui,fld,helpers){
    const c=lab.colors,k=JSON.stringify(fld.charges)+'|'+c.primary+c.danger+ui.show.lines;
    if(k===key)return;key=k;field={cells:[],segs:[],lines:[]};const nx=48,ny=28,dx=40/nx,dy=24/ny,values=[];
    for(let j=0;j<=ny;j++){values[j]=[];for(let i=0;i<=nx;i++)values[j][i]=helpers.phiAt(-20+i*dx,-12+j*dy);}
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const x=-20+i*dx,y=-12+j*dy,p=helpers.phiAt(x+dx/2,y+dy/2),opacity=clamp(Math.log10(1+Math.abs(p)/20)/Math.log10(201),0,1)*.47;
      field.cells.push({p:[[x,y],[x+dx,y],[x+dx,y+dy],[x,y+dy]],color:alpha(p>=0?c.danger:c.primary,opacity)});
    }
    for(const L of [0,25,50,100,200,400,800,1600,3200,-25,-50,-100,-200,-400,-800,-1600,-3200]){
      for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
        const p=[[-20+i*dx,-12+j*dy],[-20+(i+1)*dx,-12+j*dy],[-20+(i+1)*dx,-12+(j+1)*dy],[-20+i*dx,-12+(j+1)*dy]],v=[values[j][i],values[j][i+1],values[j+1][i+1],values[j+1][i]],cross=[];
        for(let e=0;e<4;e++){const a=v[e]-L,b=v[(e+1)%4]-L;if((a<0)!==(b<0)){const t=a/(a-b),q=p[(e+1)%4];cross.push(p[e].map((v,k)=>v+(q[k]-v)*t));}}
        if(cross.length===2)field.segs.push({a:cross[0],b:cross[1],L});else if(cross.length===4){field.segs.push({a:cross[0],b:cross[1],L},{a:cross[2],b:cross[3],L});}
      }
    }
    // Three-dimensional field lines follow the same point charges, beyond the map cut.
    if(ui.show.lines){
      const positives=fld.charges.filter(q=>q.q>0),sources=positives.length?positives:fld.charges.filter(q=>q.q<0);
      for(const source of sources)for(let seed=0;seed<12;seed++){
        const a=seed*Math.PI/6,z=seed%3===0?.65:seed%3===1?-.65:0,r=Math.sqrt(1-z*z),sgn=positives.length?1:-1;
        let p=[source.x+.7*r*Math.cos(a),source.y+.7*r*Math.sin(a),.7*z],pts=[p];
        for(let n=0;n<200;n++){
          const E=[0,0,0];for(const q of fld.charges){const d=[p[0]-q.x,p[1]-q.y,p[2]],r3=Math.max(.4,Math.hypot(...d))**3;for(let j=0;j<3;j++)E[j]+=q.q*d[j]/r3;}
          const len=Math.hypot(...E);if(len<1e-8)break;p=p.map((v,j)=>v+sgn*.36*E[j]/len);pts.push(p);
          if(Math.abs(p[0])>20||Math.abs(p[1])>12||Math.abs(p[2])>6||fld.charges.some(q=>q!==source&&Math.hypot(p[0]-q.x,p[1]-q.y,p[2])<.6))break;
        }field.lines.push({pts,sgn});
      }
    }
  }
  function fieldScene(ui,fld,helpers){
    const c=lab.colors;fieldCache(ui,fld,helpers);
    for(const x of [-2.58,2.58]){lab.box(x-.05,.03,.25,.1,3.17,.1,c.text3);lab.box(x-.15,.01,-.15,.3,.03,.6,c.text3);}
    if(ui.show.map)for(const cell of field.cells)lab.face(cell.p.map(p=>fieldPoint(...p,.22)),cell.color);
    if(ui.show.eq)for(const seg of field.segs)lab.line(fieldPoint(...seg.a,.19),fieldPoint(...seg.b,.19),alpha(seg.L===0?c.text3:seg.L>0?c.danger:c.primary,.7),seg.L===0?1.1:.7);
    for(const {pts:line,sgn} of field.lines)for(let i=3;i<line.length;i+=3){lab.line(fieldPoint(line[i-3][0],line[i-3][1],line[i-3][2]*.125),fieldPoint(line[i][0],line[i][1],line[i][2]*.125),alpha(c.text3,.48),.8);if(i===30){const a=fieldPoint(line[i-3][0],line[i-3][1],line[i-3][2]*.125),b=fieldPoint(line[i][0],line[i][1],line[i][2]*.125);arrowSolid(lab,sgn>0?a:b,sgn>0?b:a,c.text3,.006);}}
    for(const [i,q]of fld.charges.entries()){
      const p=fieldPoint(q.x,q.y),r=.065+Math.min(.035,Math.abs(q.q)*.007);lab.rod([p[0],.03,.08],[p[0],p[1]-.06,.08],.012,alpha(c.primary,.3),6);ball(p,r,q.q>=0?c.danger:c.primary);
      lab.handle('q'+i,p,.15);if(fld.charges.length<=8||i===fld.sel)lab.label((q.q>0?'+':'')+fmt(q.q,1)+' nC',[p[0],p[1]+.2,-.06],i===fld.sel?c.warning:c.text2);
    }
    for(let i=1;i<fld.path.length;i++)lab.line(fieldPoint(fld.path[i-1].x,fld.path[i-1].y,-.06),fieldPoint(fld.path[i].x,fld.path[i].y,-.06),c.warning,1.5);
    const A=fieldPoint(fld.A.x,fld.A.y,-.04);lab.label('A',A,c.text2);
    const T=fld.test,p=fieldPoint(T.x,T.y,-.08),E=helpers.EAt(T.x,T.y);ball(p,.065,c.warning);lab.handle('test',p,.19);
    if(E.e>0){const L=clamp(Math.log10(1+E.e/200)*.18,.15,.7);arrowSolid(lab,p,[p[0]+E.ex/E.e*L,p[1]+E.ey/E.e*L,p[2]],c.warning,.012);}
    lab.label('φ '+fmt(helpers.phiAt(T.x,T.y),0)+' V',[p[0],p[1]-.22,-.1],c.warning);
    lab.label('Xarita: markaziy kesim · qₜ = +1 nC',[0,3.32,.22]);
  }
  function supply(value,id,x=-2.5){const c=lab.colors;lab.box(x-.35,.03,-.95,.7,.55,.55,c.bg2);dial(lab,[x,.28,-.97],value/300,c.danger,id,'DC');lab.label(fmt(value,0)+' V',[x,.78,-.93],c.danger);}
  function capScene(cap,st){
    const c=lab.colors,L=Math.sqrt(cap.S)*.1,gap=cap.d*.1,cx=.2,cy=1.55,xL=cx-gap/2,xR=cx+gap/2,y=cy-L/2;
    lab.box(-1.5,.03,-.8,3.1,.12,1.6,c.text3);
    for(const x of [xL-.025,xR+.025]){lab.rod([x,.16,0],[x,y,0],.055,c.sunken,12);lab.box(x-.018,y,-L/2,.036,L,L,c.text3);}
    if(cap.eps>1)lab.box(xL+.018,y,-L/2,gap-.036,L,L,alpha(cap.eps>6?c.primary:c.warning,.2));
    for(let i=0;i<5;i++)for(let j=0;j<3;j++){const yy=y+(i+.5)*L/5,z=-L/2+(j+.5)*L/3;if(gap>.08)arrowSolid(lab,[xL+.025,yy,z],[xR-.025,yy,z],alpha(c.warning,.65),.005);}
    for(let i=0;i<4;i++){const yy=y+(i+.5)*L/4;lab.label('+',[xL-.07,yy,-L/2-.03],c.danger);lab.label('−',[xR+.07,yy,-L/2-.03],c.primary);}
    // Moving plate rides on an insulated translation rail.
    lab.rod([-1.2,.25,-.5],[1.5,.25,-.5],.035,c.text3,12);lab.box(xR-.11,.17,-.64,.22,.16,.28,c.bg2);
    const grip=platePoint(cap.d);lab.rod([xR+.018,cy,-L/2],grip,.025,c.warning,8);ball(grip,.05,c.warning);lab.handle('plate',grip,.19);
    supply(cap.U0,'U');
    const sw=[-1.72,1.05,-.2],a=[-2.15,1.05,-.2];path(lab,[[-2.5,.58,-.65],[-2.5,1.05,-.2],a],c.danger,.018);lab.rod(sw,cap.conn?a:[-2.05,1.34,-.2],.03,cap.conn?c.success:c.warning,10);lab.handle('capSw',[-1.95,1.12,-.2],.18);
    path(lab,[sw,[xL-.018,1.05,-.2],[xL-.018,cy,-.2]],c.danger,.018);path(lab,[[xR+.018,cy,.22],[xR+.1,.14,.45],[-2.7,.14,.45],[-2.7,.57,-.65]],c.primary,.018);
    lab.box(1.95,.13,-.55,.85,.65,.45,c.bg2);lab.label('Voltmetr',[2.37,1.12,-.65]);lab.label(fmt(st.U,1)+' V',[2.37,.56,-.58],c.success);
    path(lab,[[xL-.018,cy+.17,.1],[1.7,cy+.17,.5],[2.18,.8,-.3]],c.danger,.012);path(lab,[[xR+.018,cy-.17,.1],[1.7,cy-.17,.35],[2.56,.8,-.3]],c.primary,.012);
    lab.label('d '+fmt(cap.d,1)+' mm',[.2,.18,-1.1],c.warning);lab.label('S '+fmt(cap.S,0)+' cm²',[.2,cy+L/2+.28,0]);lab.label(cap.conn?'U = const':'q = const',[-1.95,1.57,-.2],c.warning);
  }
  function netCap(center,k,item,net){
    const c=lab.colors,[x,y,z]=center;
    lab.box(x-.32,y-.3,z-.18,.64,.6,.36,alpha(c.primary,.12));lab.rod([x,y,.18],[x,y,.34],.035,c.sunken,8);
    lab.box(x-.12,y-.26,z-.15,.035,.52,.3,c.text3);lab.box(x+.085,y-.26,z-.15,.035,.52,.3,c.text3);
    lab.rod([x-.45,y,z],[x-.12,y,z],.02,c.text2,8);lab.rod([x+.12,y,z],[x+.45,y,z],.02,c.text2,8);
    lab.label('C'+'₁₂₃'[k]+' '+fmt(net.C[k],0)+' µF',net.kind==='par'?[x,y+.38,z]:[x,y+.5,z],c.text2);lab.label(fmt(item.U,1)+' V · '+fmt(item.q*1e6,0)+' µC',net.kind==='par'?[-.25,y,-.12]:[x,y-.47,z-.12],c.primary);
    const amount=clamp(item.U/net.E,0,1),n=Math.round(amount*3);for(let j=0;j<n;j++){const yy=y-.17+j*.17;lab.line([x-.18,yy,z-.2],[x-.12,yy,z-.2],c.danger,1.5);lab.line([x-.15,yy-.03,z-.2],[x-.15,yy+.03,z-.2],c.danger,1.5);lab.line([x+.12,yy,z-.2],[x+.18,yy,z-.2],c.primary,1.5);}
    lab.handle('C'+k,[x,y,z-.2],.23);
    return {a:[x-.45,y,z],b:[x+.45,y,z]};
  }
  function netScene(net,items){
    const c=lab.colors,wire=pts=>path(lab,pts,c.text2,.018),ret=[-2.65,.23,.12];
    supply(net.E,'netE',-2.65);
    const common=[-1.7,2.65,0],charge=[-2.23,2.65,0],discharge=[-2.23,2.17,0];
    wire([[-2.5,.6,-.65],[-2.75,2.65,0],charge]);wire([[-2.85,.6,-.65],ret]);wire([discharge,[-2.23,.23,.12],ret]);
    lab.box(-2.4,2.04,.06,.86,.76,.1,c.bg2);lab.rod(common,net.sw===1?charge:discharge,.033,c.warning,12);for(const p of [common,charge,discharge])ball(p,.04,c.text3);lab.handle('netSw',[-1.95,2.45,-.03],.24);
    lab.label(net.sw===1?'Zaryadlash':'Razryad',[-1.95,2.98,0],c.warning);
    wire([common,[-1.47,2.65,0]]);lab.rod([-1.47,2.65,0],[-.9,2.65,0],.075,c.warning,16);wire([[-.9,2.65,0],[-.65,2.65,0]]);lab.handle('netR',[-1.18,2.65,0],.2);lab.label('R '+fmt(net.R,0)+' kΩ',[.2,3.22,-.08]);
    if(net.kind==='par'){
      const centers=[[1.6,2.35,0],[1.6,1.45,0],[1.6,.55,0]];wire([[-.65,2.65,0],[.45,2.65,0],[.45,.55,0]]);wire([[2.65,2.35,0],[2.65,.23,.12],ret]);
      centers.forEach((p,k)=>{const t=netCap(p,k,items[k],net);wire([[.45,p[1],0],t.a]);wire([t.b,[2.65,p[1],0]]);});
    }else if(net.kind==='ser'){
      const centers=[[-.3,1.5,0],[1.05,1.5,0],[2.4,1.5,0]],t=centers.map((p,k)=>netCap(p,k,items[k],net));wire([[-.65,2.65,0],[-.8,2.65,0],[-.8,1.5,0],t[0].a]);for(let i=0;i<2;i++)wire([t[i].b,t[i+1].a]);wire([t[2].b,[2.95,.23,.12],ret]);
    }else{
      const a=netCap([-.35,1.5,0],0,items[0],net),b=netCap([1.65,2.15,0],1,items[1],net),d=netCap([1.65,.7,0],2,items[2],net);
      wire([[-.65,2.65,0],[-1,2.65,0],[-1,1.5,0],a.a]);wire([a.b,[.65,1.5,0],[.65,2.15,0],b.a]);wire([[.65,1.5,0],[.65,.7,0],d.a]);wire([b.b,[2.6,2.15,0],[2.6,.23,.12],ret]);wire([d.b,[2.6,.7,0]]);
    }
    lab.box(-1.1,.34,.33,4.1,2.65,.05,alpha(c.bg2,.35));
    // Insulating posts support the terminal frame rather than floating components.
    for(const x of [-2.85,2.95]){lab.box(x-.13,.02,-.2,.26,.06,.4,c.text3);lab.rod([x,.08,.15],[x,2.8,.15],.018,c.text3,6);}
  }
  return {lab,draw(ctx,stage,ui,fld,cap,net,helpers){state={ui,fld,cap,net};lab.begin(ctx,stage,{target:[0,1.45,0],focal:1.7});if(ui.mode==='field')fieldScene(ui,fld,helpers);else if(ui.mode==='cap')capScene(cap,helpers.capNow());else netScene(net,helpers.netCharges());lab.finish(ui.mode==='net'?net.t:0,ui.mode==='field'?'Nuqtaviy zaryadlar · xarita: xy kesim':ui.mode==='cap'?'Oraliq: 10× kattalashtirilgan · ideal plastinkalar':'Hajmli kondensatorlar · ulanishlar haqiqiy');},
    modelPoint(p,id){const q=lab.planePoint(p.x,p.y,id==='test'?-.08:0);return q?{x:q[0]/.125,y:(q[1]-1.6)/.125}:null;},
    parameter(id,p){if(id==='plate')return lab.nearest(platePoint,1,10,p.x,p.y);return null;}
  };
}
