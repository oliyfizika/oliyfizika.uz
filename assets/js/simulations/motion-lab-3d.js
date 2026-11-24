// Bench-mounted road model. The car and rider are enlarged; x and vector
// lengths use one physical road scale, including the expanded v(t) window.
import { createLab3D } from './lab-3d.js?v=20261123-batch6b';
import { alpha, arrowSolid, dashed, ring } from './apparatus-3d.js?v=20261123-batch6b';
import { fmt } from './sim-kit.js';

export function createMotionLab() {
  const lab = createLab3D();
  let current, lo = -10, hi = 160, scale = 5.4 / 170;
  const roadX = x => -2.7 + (x - lo) * scale;
  const lane = key => current.models.B ? (key === 'A' ? -.5 : .5) : 0;
  const carPoint = (key, x) => [roadX(x), key === 'A' ? .61 : .85, lane(key)];
  const vectorPoint = (key, part, value) => {
    const body = current.models[key].state(Math.min(current.sim.t, current.sim.T));
    return [roadX(body.x) + value * scale * (part === 'a' ? 5 : 1),
      (key === 'A' ? 1.4 : 1.7) + (part === 'a' ? .68 : 0), lane(key)];
  };
  function wheel(center, radius, rotation, color, wide = .07) {
    const c = lab.colors;
    lab.rod([center[0], center[1], center[2] - wide / 2], [center[0], center[1], center[2] + wide / 2], radius, color, 16);
    for (const sign of [-1, 1]) {
      const z = center[2] + sign * (wide / 2 + .002);
      lab.rod([center[0], center[1], z], [center[0], center[1], z + sign * .005], radius * .43, c.bg2, 12);
      for (let n = 0; n < 4; n++) {
        const a = rotation + n * Math.PI / 2;
        lab.line([center[0], center[1], z + sign * .006], [center[0] + radius * .81 * Math.cos(a), center[1] + radius * .81 * Math.sin(a), z + sign * .006], c.bg2, 1);
      }
    }
  }
  function car(x, z, dir, rotation, color) {
    const c = lab.colors, at = (px, py, pz) => [x + dir * px, .22 + py, z + pz];
    const box = (px, py, pz, sx, sy, sz, col) => lab.solid([
      [px,py,pz],[px+sx,py,pz],[px+sx,py+sy,pz],[px,py+sy,pz],
      [px,py,pz+sz],[px+sx,py,pz+sz],[px+sx,py+sy,pz+sz],[px,py+sy,pz+sz]
    ].map(p => at(...p)), col);
    box(-.39,.11,-.2,.78,.17,.4,color);
    box(-.35,.25,-.18,.7,.06,.36,color);
    // Sloping windscreen, roof, rear window and two side windows on each side.
    const cabin = [[-.24,.28,-.17],[-.14,.52,-.15],[.11,.52,-.15],[.26,.28,-.17],[-.24,.28,.17],[-.14,.52,.15],[.11,.52,.15],[.26,.28,.17]];
    lab.face([0,1,2,3].map(i => at(...cabin[i])), color);
    lab.face([4,7,6,5].map(i => at(...cabin[i])), color);
    lab.face([1,5,6,2].map(i => at(...cabin[i])), color);
    lab.face([0,4,5,1].map(i => at(...cabin[i])), c.sunken);
    lab.face([3,2,6,7].map(i => at(...cabin[i])), c.sunken);
    for (const s of [-1,1]) {
      const zz = s * .176;
      lab.face([[-.205,.3,zz],[-.125,.485,zz],[.015,.485,zz],[.015,.3,zz]].map(p=>at(...p)), c.sunken);
      lab.face([[.04,.3,zz],[.04,.485,zz],[.095,.485,zz],[.215,.3,zz]].map(p=>at(...p)), c.sunken);
      lab.rod(at(-.025,.29,zz),at(-.025,.51,zz),.009,c.text2,6);
      box(.35,.18,s*.15-.03,.045,.065,.06,c.warning);
      box(-.4,.18,s*.15-.03,.025,.06,.06,c.danger);
      lab.rod(at(.16,.35,s*.18),at(.15,.35,s*.255),.012,color,6);
      box(.1,.32,s*.25-.025,.08,.055,.05,c.text3);
    }
    box(-.4,.105,-.21,.8,.035,.42,c.text3);
    for (const xx of [-.25,.25]) {
      lab.rod(at(xx,.11,-.25),at(xx,.11,.25),.015,c.text2,6);
      for (const zz of [-.225,.225]) wheel(at(xx,.11,zz),.105,rotation,c.text,.065);
    }
  }
  function bicycle(x, z, dir, rotation, color) {
    const c = lab.colors, at = (px, py, pz = 0) => [x + dir * px, .22 + py, z + pz];
    for (const xx of [-.28,.28]) {
      const center = at(xx,.17); wheel(center,.165,rotation,c.text3,.035);
      ring(lab, center, .165, c.text3, 'z', .012);
    }
    for (const [a,b] of [[[ -.28,.17],[-.08,.43]],[[-.28,.17],[.04,.17]],[[-.08,.43],[.04,.17]],[[.04,.17],[.2,.43]],[[-.08,.43],[.2,.43]],[[.2,.43],[.28,.17]]])lab.rod(at(...a),at(...b),.021,color,7);
    lab.rod(at(-.08,.43),at(-.09,.52),.018,c.text2,7);
    lab.rod(at(-.16,.52),at(-.02,.52),.028,c.text2,8);
    lab.rod(at(.28,.17),at(.18,.54),.018,c.text2,7);
    lab.rod(at(.18,.54,-.09),at(.18,.54,.09),.018,c.text2,7);
    const pedal = [.04 + .07 * Math.cos(rotation), .17 + .07 * Math.sin(rotation)];
    lab.rod(at(.04,.17),at(...pedal),.016,c.text2,6);
    // Bent legs and arms make the bicycle a laboratory model with a rider.
    for (const side of [-1,1]) {
      const p = side < 0 ? pedal : [.08-pedal[0],.34-pedal[1]];
      lab.rod(at(-.07,.61,side*.04),at(.07,.42,side*.06),.032,c.text3,8);
      lab.rod(at(.07,.42,side*.06),at(p[0],p[1],side*.06),.028,c.text3,8);
      lab.rod(at(.04,.85,side*.06),at(.15,.66,side*.08),.024,color,8);
      lab.rod(at(.15,.66,side*.08),at(.18,.54,side*.09),.022,c.warning,8);
    }
    lab.rod(at(-.07,.6),at(.04,.85),.065,color,12);
    lab.rod(at(.04,.85),at(.055,.9),.025,c.warning,8);
    lab.sphere(at(.06,.99),.085,c.warning);
    lab.rod(at(.06,1.04,-.045),at(.06,1.04,.045),.075,color,12);
  }
  function draw(ctx, stage, ui, models, sim, meet, win, dirMemo, running) {
    current = {ui,models,sim}; [lo,hi] = win; scale = 5.4 / (hi-lo);
    const c = stage.colors;
    lab.begin(ctx,stage,{target:[0,1.05,0],focal:1.82});
    // Raised diorama road, curbs, alignment marks and detachable measuring rail.
    lab.box(-2.93,.03,-.98,5.86,.15,1.96,c.text3);
    lab.box(-2.86,.18,-.91,5.72,.04,1.82,c.sunken);
    for (const z of [-.95,.91])lab.box(-2.9,.18,z,5.8,.085,.04,c.bg2);
    if (models.B) for(let x=-2.75;x<2.7;x+=.37)lab.box(x,.223,-.014,.18,.005,.028,c.bg2);
    for (const x of [-2.86,2.86]) {
      lab.rod([x,.22,-.85],[x,.72,-.85],.025,c.text3,8);
      lab.rod([x,.22,.85],[x,.72,.85],.025,c.text3,8);
      lab.line([x,.23,-.84],[x,.23,.84],c.warning,1.4);
    }
    lab.box(-2.8,.19,-1.26,5.6,.025,.19,c.bg2);
    const step = (hi-lo)>240 ? 50 : 20;
    for(let x=Math.ceil(lo/5)*5;x<=hi;x+=5) {
      const px=roadX(x),major=x%step===0;
      lab.line([px,.22,-1.2],[px,.22,major?-1.05:-1.14],c.text3,major?1.2:.6);
      if(major)lab.label(fmt(x,0),[px,.25,-1.36],c.text2);
    }
    lab.label('x, m',[2.8,.25,-1.36]);
    if(lo<=0&&hi>=0)dashed(lab,[roadX(0),.23,-.87],[roadX(0),.23,.87],c.warning,.9);
    if(meet&&(ui.show.ghost||sim.t>=meet.t)) {
      const x=roadX(meet.x);
      dashed(lab,[x,.24,-.8],[x,.24,.8],c.special,1.6);
      lab.rod([x,.22,.85],[x,1.95,.85],.016,c.special,8);
      lab.label(`Uchrashish: ${fmt(meet.t,2)} s`,[x,2.12,.85],c.special);
    }
    for(const [key,model]of [['A',models.A],['B',models.B]]) {
      if(!model)continue;
      const s=model.state(Math.min(sim.t,sim.T)),z=lane(key),color=key==='A'?c.primary:c.success;
      if(Math.abs(s.v)>1e-6)dirMemo[key]=Math.sign(s.v);
      if(ui.show.dots)for(let t=0;t<=Math.floor(Math.min(sim.t,sim.T)+1e-9);t++){
        const x=roadX(model.state(t).x);
        lab.rod([x,.228,z-.32],[x,.234,z-.32],.03,color,8);
      }
      const x=roadX(s.x),rotation=(s.x-model.state(0).x)*scale/.105;
      if(key==='A')car(x,z,dirMemo[key],rotation,color);else bicycle(x,z,dirMemo[key],rotation,color);
      const cp=carPoint(key,s.x);lab.handle(key+':car',cp,.22);
      lab.label(key,[x,key==='A'?.99:1.5,z],color);
      const vp=vectorPoint(key,'v',s.v),vo=vectorPoint(key,'v',0);
      arrowSolid(lab,vo,vp,color,.018);
      lab.label(`${key}: v = ${fmt(s.v,1)} m/s`,[vp[0],vp[1]+.17,vp[2]],color);
      if(ui.mode!=='pw') {
        ring(lab,vp,.055,color,'z',.008);lab.handle(key+':v',vp,.12);
      }
      if(ui.mode==='acc') {
        const ap=vectorPoint(key,'a',s.a),ao=vectorPoint(key,'a',0);
        arrowSolid(lab,ao,ap,c.warning,.016);
        lab.label(`${key}: a = ${fmt(s.a,2)} m/s²`,[ap[0],ap[1]+.17,ap[2]],c.warning);
        ring(lab,ap,.05,c.warning,'z',.008);lab.handle(key+':a',ap,.12);
      }
      if(!running&&sim.t===0) {
        const start=carPoint(key,model.state(0).x);
        lab.line([start[0],.23,z-.28],[start[0],.23,z+.28],color,1.8);
      }
    }
    lab.finish(Math.min(sim.t,sim.T),'Jismlar kattalashtirilgan · v: 1 s yo‘l · a: ×5');
  }
  return {lab,draw,roadX,carPoint,vectorPoint,
    parameter(id,p) {
      const [key,part]=id.split(':');
      if(part==='car')return lab.nearest(x=>carPoint(key,x),0,current.ui.mode==='pw'?100:150,p.x,p.y);
      return lab.nearest(v=>vectorPoint(key,part,v),part==='a'?-4:-15,part==='a'?4:20,p.x,p.y);
    }
  };
}
