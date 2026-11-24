import { createLab3D } from './lab-3d.js?v=20261122-detail4';
import * as V from './vectors-physics.js';
import { fmt } from './sim-kit.js';
import { arrowSolid, dashed } from './apparatus-3d.js?v=20261122-detail4';

export function createVectorLab() {
  const lab=createLab3D();let scale=.34;
  const at=v=>[v.x*scale,1.85+v.y*scale,.09];
  function draw(ctx,stage,ui,vec,sum,force) {
    const O=V.vec(0,0),fs=force.on3?force.f:force.f.slice(0,2),result=V.resultant(fs);
    const extent=ui.mode==='vec'?[vec.a,V.scale(vec.a,vec.k)]:ui.mode==='add'?[sum.a,sum.b,V.add(sum.a,sum.b),V.sub(sum.a,sum.b)]:[...fs,result,V.neg(result),V.add(fs[0],fs[1])];
    scale=Math.min(.34,2.45/Math.max(1,...extent.map(p=>Math.abs(p.x))),1.35/Math.max(1,...extent.map(p=>Math.abs(p.y))));
    lab.begin(ctx,stage,{target:[0,1.7,0],focal:1.5});const c=lab.colors;
    // Calibrated vertical board, frame and feet; x and y share the same metric.
    for(const x of [-2.4,2.4]){lab.box(x-.2,.02,-.45,.4,.12,.9,c.text3);lab.rod([x,.14,-.18],[x,3.4,-.18],.035,c.text3);}
    lab.box(-2.65,.4,.18,5.3,3,.09,c.bg2);
    for(const y of [.4,3.4])lab.rod([-2.65,y,-.04],[2.65,y,-.04],.035,c.text3);
    const n=Math.min(30,Math.floor(2.6/scale));
    for(let i=-n;i<=n;i++){
      const x=i*scale;if(Math.abs(x)<=2.6)lab.line([x,.43,.15],[x,3.37,.15],c.border,.65);
      const y=1.85+i*scale;if(y>.43&&y<3.37)lab.line([-2.61,y,.15],[2.61,y,.15],c.border,.65);
    }
    arrowSolid(lab,[-2.55,1.85,.12],[2.55,1.85,.12],c.text3,.012);
    arrowSolid(lab,[0,.46,.12],[0,3.32,.12],c.text3,.012);
    lab.label('x',[2.52,1.7,.04]);lab.label('y',[.15,3.3,.04]);lab.label('O',[-.12,1.72,.04]);
    const arrow=(from,v,color,label,id)=>{
      const a=at(from),b=at(V.add(from,v));arrowSolid(lab,a,b,color,.025);
      if(V.mag(v)>.1)lab.label(label,[(a[0]+b[0])*.5+.08,(a[1]+b[1])*.5+.13,.14],color);
      if(id){lab.sphere(b,.065,color);lab.handle(id,b,.12);}
    };
    if(ui.mode==='vec') {
      const a=vec.a;
      if(vec.proj) {
        dashed(lab,at(a),at(V.vec(a.x,0)),c.text3);dashed(lab,at(a),at(V.vec(0,a.y)),c.text3);
        arrow(O,V.vec(a.x,0),c.danger,`aₓ = ${fmt(a.x,1)}`);arrow(O,V.vec(0,a.y),c.success,`aᵧ = ${fmt(a.y,1)}`);
      }
      if(vec.k!==1)arrow(O,V.scale(a,vec.k),c.special,`${fmt(vec.k,1)}a`);
      arrow(O,a,c.primary,'a','a');
    } else if(ui.mode==='add') {
      const a=sum.a,b=sum.b,s=V.add(a,b),tri=sum.meth==='tri';
      if(!tri){dashed(lab,at(a),at(s),c.success);dashed(lab,at(b),at(s),c.primary);}
      if(sum.diff)arrow(b,V.sub(a,b),c.special,'a − b');
      arrow(O,s,c.warning,'a + b');arrow(O,a,c.primary,'a','a');arrow(tri?a:O,b,c.success,'b','b');
    } else {
      if(force.poly){let p=fs[0];for(let i=1;i<fs.length;i++){const next=V.add(p,fs[i]);dashed(lab,at(p),at(next),[c.primary,c.success,c.danger][i]);p=next;}}
      if(force.bal)arrow(O,V.neg(result),c.special,'−R');
      if(V.mag(result)>.05)arrow(O,result,c.warning,'R');
      fs.forEach((f,i)=>arrow(O,f,[c.primary,c.success,c.danger][i],`F${'₁₂₃'[i]}`,`f${i}`));
      lab.rod([0,1.85,.04],[0,1.85,.15],.08,c.text3,24);
    }
    lab.finish(0,`1 katak = 1 ${ui.mode==='forces'?'N':'birlik'} · x va y bir xil masshtabda`);
  }
  return {lab,draw,point(x,y){const p=lab.planePoint(x,y,.09);return p?V.vec(p[0]/scale,(p[1]-1.85)/scale):null;}};
}
