// A plug-in DC bench. Grid topology and the nonlinear solver remain unchanged.
import { createLab3D } from './lab-3d.js?v=20261123-batch8c';
import { alpha, path, helix, ring } from './apparatus-3d.js?v=20261123-batch8c';
import { COLS, ROWS, EDGES, nodeCR } from './circuit-grid.js';
import { clamp, fmt } from './sim-kit.js';
import { LED_COLORS, LED_I_NOM, voltmeterReading } from './circuit-physics.js';

export const nodePoint = n => { const {c,r}=nodeCR(n); return [(c-(COLS-1)/2)*.64,.2,((ROWS-1)/2-r)*.64]; };
export function componentPoint(edge,x=0,y=.3,z=0) {
  const e=EDGES[edge],a=nodePoint(e.a),b=nodePoint(e.b),u=b.map((v,i)=>(v-a[i])/.64);
  return [(a[0]+b[0])/2+u[0]*x-u[2]*z,y,(a[2]+b[2])/2+u[2]*x+u[0]*z];
}
export function segmentDistance(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function createDCCircuitLab() {
  const lab=createLab3D();let state;
  Object.assign(lab.camera,{pitch:.8,yaw:-.35});
  const dot=(p,r,color)=>{
    const v=[[r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]].map(q=>q.map((x,i)=>x+p[i]));
    const projected=v.map(lab.project);
    for(const ids of [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]])lab.face(ids.map(i=>v[i]),color,null,.7,ids.map(i=>projected[i]));
  };
  const box=(edge,x,y,z,dx,dy,dz,col)=>lab.solid([[x,y,z],[x+dx,y,z],[x+dx,y+dy,z],[x,y+dy,z],[x,y,z+dz],[x+dx,y,z+dz],[x+dx,y+dy,z+dz],[x,y+dy,z+dz]].map(p=>componentPoint(edge,...p)),col);
  const at=(edge,x,y=.3,z=0)=>componentPoint(edge,x,y,z);
  function apparatus(edge,e,r,colorA,colorB,ghost=false) {
    const c=lab.colors,g=EDGES[edge],a=nodePoint(g.a),b=nodePoint(g.b),isWire=e.type==='wire';
    const col=ghost?alpha(c.primary,.4):c.text3;
    if(isWire){path(lab,[a,at(edge,-.2,.24),at(edge,.2,.24),b],ghost?alpha(c.primary,.5):colorA,.018);return;}
    box(edge,-.26,.07,-.17,.52,.06,.34,ghost?alpha(c.primary,.25):c.bg2);
    const ta=at(edge,-.23,.23),tb=at(edge,.23,.23);
    path(lab,[a,ta],colorA,.018);path(lab,[tb,b],colorB,.018);
    for(const [p,color]of [[ta,colorA],[tb,colorB]])lab.rod([p[0],.12,p[2]],p,.033,color,10);
    switch(e.type) {
      case 'battery': {
        const plus=e.plus==='b'?1:-1;
        lab.rod(at(edge,-.18,.3),at(edge,.18,.3),.105,ghost?col:c.primary,16);
        lab.rod(at(edge,plus*.18,.3),at(edge,plus*.22,.3),.052,c.warning,12);
        path(lab,[ta,at(edge,-.21,.3)],colorA,.019);path(lab,[at(edge,.21,.3),tb],colorB,.019);
        lab.label('+',at(edge,plus*.18,.48),c.danger);lab.label('−',at(edge,-plus*.18,.48),c.primary);
        break;
      }
      case 'switch': {
        for(const x of [-.18,.18])lab.rod(at(edge,x,.13),at(edge,x,.28),.035,c.warning,10);
        lab.rod(at(edge,-.18,.28),at(edge,e.closed?.18:.12,e.closed?.28:.51),.022,e.closed?c.success:c.warning,8);
        lab.rod(at(edge,e.closed?.08:.04,e.closed?.31:.48,-.045),at(edge,e.closed?.08:.04,e.closed?.31:.48,.045),.035,col,10);
        path(lab,[ta,at(edge,-.18,.28)],colorA,.018);path(lab,[at(edge,.18,.28),tb],colorB,.018);
        break;
      }
      case 'resistor': {
        lab.rod(at(edge,-.15,.3),at(edge,.15,.3),.075,ghost?col:c.warning,12);
        for(const x of [-.1,0,.1])lab.rod(at(edge,x-.014,.3),at(edge,x+.014,.3),.079,c.text3,12);
        path(lab,[ta,at(edge,-.15,.3)],colorA,.018);path(lab,[at(edge,.15,.3),tb],colorB,.018);
        break;
      }
      case 'rheostat': case 'conductor': {
        const aa=at(edge,-.18,.3),bb=at(edge,.18,.3);
        lab.rod(aa,bb,.061,col,12);helix(lab,aa,bb,.066,e.type==='rheostat'?7:5,c.warning,.009);
        path(lab,[ta,aa],colorA,.018);
        if(e.type==='rheostat'){
          const x=-.17+.34*e.pos,p=at(edge,x,.47);
          lab.rod(at(edge,-.2,.44),at(edge,.2,.44),.014,c.text2,8);
          box(edge,x-.035,.4,-.06,.07,.1,.12,c.primary);
          lab.rod(p,at(edge,x,.31),.014,c.warning,8);
          path(lab,[at(edge,.2,.44),tb],colorB,.018);lab.handle('slider:'+edge,p,.1);
        }else path(lab,[bb,tb],colorB,.018);
        break;
      }
      case 'lamp': case 'led': {
        const led=e.type==='led',brightness=clamp((led?(r?.If||0)/LED_I_NOM:(r?.P||0)/(e.pNom||3)),0,1);
        const tint=led?(LED_COLORS[e.color]?.color||c.danger):c.warning;
        lab.rod(at(edge,0,.14),at(edge,0,.24),led?.07:.095,col,12);
        path(lab,[ta,at(edge,-.045,.24)],colorA,.015);path(lab,[at(edge,.045,.24),tb],colorB,.015);
        if(led){
          lab.rod(at(edge,0,.24),at(edge,0,.35),.072,alpha(tint,brightness>.02?.4+.6*brightness:.25),12);
          lab.sphere(at(edge,0,.35),.072,alpha(tint,brightness>.02?.45+.55*brightness:.25));
          const cath=e.rev?-1:1;box(edge,cath*.08-.012,.15,-.035,.024,.05,.07,c.text3);
          lab.label('K',at(edge,cath*.18,.45),c.text3);
        }else{
          lab.sphere(at(edge,0,.36),.13,alpha(brightness>.01?tint:c.text3,brightness>.01?.2+.25*brightness:.12));
          path(lab,[at(edge,-.04,.26),at(edge,-.04,.37),at(edge,.04,.37),at(edge,.04,.26)],brightness>.01?tint:c.text3,.012);
        }
        break;
      }
      case 'diode': {
        lab.rod(at(edge,-.13,.3),at(edge,.13,.3),.07,col,12);
        const cath=e.rev?-1:1;lab.rod(at(edge,cath*.075-.015,.3),at(edge,cath*.075+.015,.3),.074,c.bg2,12);
        path(lab,[ta,at(edge,-.13,.3)],colorA,.018);path(lab,[at(edge,.13,.3),tb],colorB,.018);
        lab.label('K',at(edge,cath*.18,.45),c.text3);break;
      }
      case 'ammeter': case 'voltmeter': {
        box(edge,-.19,.14,-.15,.38,.26,.3,col);box(edge,-.155,.405,-.115,.31,.008,.23,c.sunken);
        const letter=e.type==='ammeter'?'A':'V';
        const value=state.model.sol.ok&&r?(letter==='A'?state.amps(r.I):fmt(voltmeterReading(e,r),2)+' V'):'—';
        lab.label(letter+' '+value,at(edge,0,.55),c.success);
        if(letter==='V'){
          const x=e.plus==='b'?.23:-.23;
          lab.rod(at(edge,x-.03,.25),at(edge,x+.03,.25),.006,c.danger,6);
          lab.rod(at(edge,x,.25,-.03),at(edge,x,.25,.03),.006,c.danger,6);
        }
        break;
      }
    }
  }
  function draw(ctx,stage,s) {
    state=s;const {model,cells,ui,phase,selected,tool,hover,drag,dropPreview}=s;
    lab.begin(ctx,stage,{target:[0,.48,0],focal:2});const c=lab.colors;
    lab.box(-2.87,.015,-1.57,5.74,.05,3.14,c.bg2);
    if(!model){lab.finish(0);return;}
    const sol=model.sol,range=ui.potential&&sol.ok?s.potentialRange():null,lo=s.toRGB(c.primary),hi=s.toRGB(c.danger);
    const pot=n=>range&&Number.isFinite(sol.phi[n])?s.mixRGB(lo,hi,(sol.phi[n]-range[0])/(range[1]-range[0])):c.text3;
    for(let n=0;n<COLS*ROWS;n++){const p=nodePoint(n);lab.rod([p[0],.065,p[2]],p,.024,pot(n),8);}
    const target=dropPreview?.edge??(tool!=='select'?hover?.id:null),moving=drag?.kind==='move'&&drag.active?drag.from:null;
    if(target!==null&&target!==undefined)lab.rod(nodePoint(EDGES[target].a),nodePoint(EDGES[target].b),.048,alpha(tool==='erase'?c.danger:c.primary,.25),8);
    model.index.forEach((edge,k)=>{
      const e=model.elements[k],r=sol.el[k];apparatus(edge,e,r,pot(e.a),pot(e.b),edge===moving);
      if(edge===selected)ring(lab,at(edge,0,.29),.27,c.primary,'z',.008);
      if(sol.ok&&Math.abs(r.I)>1e-5&&edge!==moving){
        const a=nodePoint(e.a),b=nodePoint(e.b),offset=((phase[edge]%13)+13)%13;
        for(let j=0;j<3;j++){
          const t=(offset/13+j)/3;if(e.type!=='wire'&&t>.14&&t<.86)continue;
          dot(a.map((v,i)=>v+(b[i]-v)*t+(i===1?.035:0)),.024,ui.dir==='elec'?c.primary:c.warning);
        }
      }
      if(e.type==='wire'||edge===moving||e.type==='ammeter'||e.type==='voltmeter')return;
      const label=model.labels.get(edge),value=s.formatValue(e,r),p=at(edge,0,e.type==='switch'?.67:.58);
      lab.label([label,value].filter(Boolean).join(' '),p,edge===selected?c.primary:c.text2);
      if(ui.values&&sol.ok)lab.label(s.amps(r.I)+' · '+fmt(Math.abs(e.type==='battery'?r.Ut:r.U),2)+' V',at(edge,0,.77),c.text2);
    });
    const ghost=dropPreview||(target!==undefined&&target!==null&&s.placeTools.has(tool)?{edge:target,el:s.defaultProps(tool)}:null);
    if(ghost)apparatus(ghost.edge,ghost.el,null,c.primary,c.primary,true);
    lab.finish(0,sol.error==='short'?'Qisqa tutashuv: manba qarshiliksiz ulangan':cells.size?'Yig‘ish maydoni · asbob o‘lchamlari shartli · tok sekinlashtirilgan':'Asbobni tanlang va ikki uyacha orasiga qo‘ying');
  }
  function pick(x,y,touch=false) {
    let best=null,dist=Infinity;
    for(const e of EDGES){
      const a=lab.project(nodePoint(e.a)),b=lab.project(nodePoint(e.b));
      const body=lab.project(at(e.i,0,.32)),base=lab.project(at(e.i,0,.2));
      let d=segmentDistance({x,y},a,b);
      if(state?.cells.has(e.i))d=Math.min(d,segmentDistance({x,y},body,base));
      const span=Math.hypot(a.x-b.x,a.y-b.y),tol=touch?Math.max(12,span*.35):Math.max(7,span*.25);
      if(d<tol&&d<dist){dist=d;best=e.i;}
    }
    return best===null?null:{kind:'edge',id:best};
  }
  return {lab,draw,pick,slider(edge,p){return lab.nearest(v=>at(edge,-.17+.34*v,.47),0,1,p.x,p.y);}};
}
