// Perspective 3D laboratory renderer. Geometry stays independent of the RK4 model.
import { clamp, fmt, arrow, tag } from './sim-kit.js';

// WebGL depth buffer resolves occlusion for coils, supports and the table from any angle.
function createDepthRenderer() {
  const surface=document.createElement('canvas');
  const gl=surface.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
  if(!gl)return null;
  const shader=(type,source)=>{
    const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec4 position; attribute vec4 color; varying vec4 tint;
    void main(){gl_Position=position;tint=color;}`));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float; varying vec4 tint;
    void main(){gl_FragColor=tint;}`));
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  const buffer=gl.createBuffer(), colors=new Map();
  const swatch=document.createElement('canvas');swatch.width=swatch.height=1;
  const sample=swatch.getContext('2d',{willReadFrequently:true});
  function rgba(value) {
    if(colors.has(value))return colors.get(value);
    sample.clearRect(0,0,1,1);sample.fillStyle=value;sample.fillRect(0,0,1,1);
    const color=[...sample.getImageData(0,0,1,1).data].map(x=>x/255);
    colors.set(value,color);return color;
  }
  return (ctx,faces,w,h)=>{
    const dpr=Math.min(devicePixelRatio||1,2);
    if(surface.width!==Math.round(w*dpr)||surface.height!==Math.round(h*dpr)){
      surface.width=Math.round(w*dpr);surface.height=Math.round(h*dpr);
    }
    gl.viewport(0,0,surface.width,surface.height);gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    const data=[];
    const vertex=(p,col,shade=1,bias=0)=>data.push((p.x/w*2-1)*p.d,(1-p.y/h*2)*p.d,
      (30.1/29.9)*p.d-6/29.9+bias,p.d,col[0]*shade,col[1]*shade,col[2]*shade,col[3]);
    // Fill first, edges second. Offset only edges to prevent z fighting.
    for(const f of faces)if(f.fill){
      const col=rgba(f.fill);
      for(let i=1;i<f.p.length-1;i++)for(const p of [f.p[0],f.p[i],f.p[i+1]])vertex(p,col,f.shade);
    }
    for(const f of faces)if(f.stroke){
      const col=rgba(f.stroke),count=f.p.length===2?1:f.p.length;
      for(let i=0;i<count;i++){
        const a=f.p[i],b=f.p[(i+1)%f.p.length],len=Math.hypot(b.x-a.x,b.y-a.y);
        if(len<.01)continue;
        const nx=-(b.y-a.y)/len*f.width/2,ny=(b.x-a.x)/len*f.width/2;
        const aa={...a,x:a.x+nx,y:a.y+ny},ab={...a,x:a.x-nx,y:a.y-ny};
        const ba={...b,x:b.x+nx,y:b.y+ny},bb={...b,x:b.x-nx,y:b.y-ny};
        for(const p of [aa,ab,ba,ab,bb,ba])vertex(p,col,1,-.0003);
      }
    }
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);
    for(const [name,offset]of [['position',0],['color',16]]){
      const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,32,offset);
    }
    gl.drawArrays(gl.TRIANGLES,0,data.length/8);ctx.drawImage(surface,0,0,w,h);
  };
}

export function createSpringLab() {
  const depthRender = createDepthRenderer();
  const camera = { yaw: -0.55, pitch: 0.32, zoom: 1 };
  let project, massPoint, axisPoint, hitRadius = 25;
  const reset = () => Object.assign(camera, { yaw: -0.55, pitch: 0.32, zoom: 1 });
  function draw(ctx, stage, P, s, show, energy) {
    const { w, h, colors: c } = stage;
    const vert = P.mode === 'vertical';
    const k = P.link === 'parallel' ? P.k1 + P.k2 : P.link === 'series' ? P.k1 * P.k2 / (P.k1 + P.k2) : P.k1;
    const dl = vert ? P.m * P.g / k : 0;
    const scale = (vert ? 2.5 : 3.4) / (0.5 + dl + 0.45);
    const side = 0.38 + 0.09 * Math.cbrt(P.m);
    const anchor = vert ? [-0.3, 3.05, 0] : [-2.15, 0.34, 0];
    const point = (u, off = 0) => vert ? [anchor[0] + off, anchor[1] - u * scale, 0] : [anchor[0] + u * scale, anchor[1], off];
    const end = point(0.5 + dl + s.x);
    const centre = vert ? [end[0], end[1] - side / 2, 0] : [end[0] + side / 2, end[1], 0];
    const focal = Math.min(w * 1.35, h * 1.7) * camera.zoom;
    project = ([x, y, z]) => {
      const xx = Math.cos(camera.yaw) * x - Math.sin(camera.yaw) * z;
      const zz = Math.sin(camera.yaw) * x + Math.cos(camera.yaw) * z;
      const yy = y - (vert ? 1.25 : .45);
      const depth = 9 - Math.sin(camera.pitch) * yy + Math.cos(camera.pitch) * zz;
      return { x: w / 2 + focal * xx / depth, y: h * 0.48 - focal * (Math.cos(camera.pitch) * yy + Math.sin(camera.pitch) * zz) / depth, d: depth };
    };
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * .5, h * .35, 10, w * .5, h * .5, w * .7);
    glow.addColorStop(0, c.bg2); glow.addColorStop(1, c.sunken);
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    const faces = [];
    const face = (pts, fill, stroke = c.border, width = .7) => {
      const p=pts.map(project);
      let shade=1;
      if(pts.length>2) {
        const u=pts[1].map((x,i)=>x-pts[0][i]),v=pts[2].map((x,i)=>x-pts[0][i]);
        const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        const len=Math.hypot(...n)||1;
        shade=.62+.38*Math.abs((n[0]*.3+n[1]*.85+n[2]*.43)/len);
      }
      faces.push({d:p.reduce((a,b)=>a+b.d,0)/p.length,p,fill,stroke,width,shade});
    };
    const line = (a,b,color,width=1) => face([a,b],null,color,width);
    const box = (x, y, z, sx, sy, sz, color) => {
      const p = [[x,y,z],[x+sx,y,z],[x+sx,y+sy,z],[x,y+sy,z],[x,y,z+sz],[x+sx,y,z+sz],[x+sx,y+sy,z+sz],[x,y+sy,z+sz]];
      [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]].forEach((ids, i) => {
        face(ids.map(j => p[j]), color);
      });
    };
    const rod = (a, b, radius, color, n = 12) => {
      const dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2], length = Math.hypot(dx,dy,dz);
      const u = [dx/length,dy/length,dz/length];
      const q = Math.abs(u[1]) < .9 ? [0,1,0] : [1,0,0];
      let v = [u[1]*q[2]-u[2]*q[1],u[2]*q[0]-u[0]*q[2],u[0]*q[1]-u[1]*q[0]];
      const vl = Math.hypot(...v); v = v.map(x => x/vl);
      const t = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const ring = a => Array.from({length:n}, (_,i) => a.map((x,j) => x + radius*(v[j]*Math.cos(i*2*Math.PI/n)+t[j]*Math.sin(i*2*Math.PI/n))));
      const aa=ring(a), bb=ring(b);
      for(let i=0;i<n;i++) face([aa[i],aa[(i+1)%n],bb[(i+1)%n],bb[i]],color);
      face(aa,color); face(bb,color);
    };
    // Bench: laminated surface, metal frame, feet and a gridded instrument mat.
    face([[-6,-1.18,-6],[6,-1.18,-6],[6,-1.18,6],[-6,-1.18,6]],c.sunken);
    for(let i=-5;i<=5;i++) {
      line([i,-1.175,-6],[i,-1.175,6],c.border);
      line([-6,-1.175,i],[6,-1.175,i],c.border);
    }
    for(const x of [-2.7,2.7]) for(const z of [-1.35,1.35]) {
      box(x-.07,-1.12,z-.07,.14,1.05,.14,c.text3);
      box(x-.13,-1.16,z-.13,.26,.07,.26,c.text2);
    }
    box(-3.15,-.12,-1.7,6.3,.12,3.4,c.bg2);
    box(-2.95,-.31,-1.48,5.9,.19,.10,c.text3);
    box(-2.95,-.31,1.38,5.9,.19,.10,c.text3);
    face([[-2.7,.006,-1.1],[2.7,.006,-1.1],[2.7,.006,1.1],[-2.7,.006,1.1]],c.sunken);
    for(let x=-2.5;x<=2.5;x+=.25) line([x,.009,-1.1],[x,.009,1.1],c.border,.45);
    for(let z=-1;z<=1;z+=.25) line([-2.7,.009,z],[2.7,.009,z],c.border,.45);
    if(vert) {
      box(-1.15,.02,-.5,1.25,.12,1,c.text3);
      rod([-.9,.14,0],[-.9,3.25,0],.045,c.text3);
      rod([-.9,3.05,0],[.02,3.05,0],.045,c.text3);
      box(-.99,2.96,-.1,.18,.18,.2,c.primary);
      rod(anchor,[anchor[0],3.15,0],.025,c.text2);
    } else {
      box(-2.45,.015,-.55,.36,.1,1.1,c.text3);
      box(-2.3,.1,-.36,.15,.8,.72,c.text3);
      // Frictionless air-track representation; no rollers affecting the physical model.
      box(-2.05,.02,-.28,4.6,.08,.56,c.bg2);
      for(const z of [-.23,.23]) rod([-2,.11,z],[2.5,.11,z],.018,c.text3);
    }
    const spring = (u0,u1,off,color,turns) => {
      const a=point(u0,off), b=point(u1,off), radius=.105;
      let prev=a;
      const n=turns*24;
      for(let i=1;i<=n;i++) {
        const t=i/n, axial=.06+.88*t, theta=t*turns*2*Math.PI;
        const p=a.map((x,j)=>x+(b[j]-x)*axial);
        p[vert?0:1]+=radius*Math.cos(theta); p[2]+=radius*Math.sin(theta);
        line(prev,p,color,2.6); prev=p;
      }
      line(prev,b,color,2.6);
    };
    const length=.5+dl+s.x;
    if(P.link==='parallel') {
      spring(0,length,-.15,c.text2,12); spring(0,length,.15,c.primary,12);
      const a=point(length,-.21),b=point(length,.21); rod(a,b,.022,c.text3);
      rod(point(0,-.21),point(0,.21),.022,c.text3);
    } else if(P.link==='series') {
      const joint=.25+(vert?P.m*P.g/P.k1:0)+s.x*P.k2/(P.k1+P.k2);
      spring(0,joint,0,c.text2,7); spring(joint,length,0,c.primary,7);
    } else spring(0,length,0,c.text2,12);
    // Soft contact shadow and anodised mass with metal end caps.
    face([[centre[0]-.32,.012,-.35],[centre[0]+.32,.012,-.35],[centre[0]+.32,.012,.35],[centre[0]-.32,.012,.35]],'rgba(0,0,0,.12)',null);
    box(centre[0]-side/2,centre[1]-side/2,-side/2,side,side,side,c.primary);
    box(centre[0]-side/2,centre[1]+side/2-.025,-side/2,side,.025,side,c.borderStrong);
    if(show.marks) {
      const eq=.5+dl;
      for(let i=-25;i<=25;i++) {
        const u=eq+i/100, a=point(u,.42), b=point(u,.42+(i%5===0?.1:.045));
        line(a,b,i===0?c.primary:c.text3,i===0?2:1);
      }
      line(point(eq-.25,.42),point(eq+.25,.42),c.text3);
      // Text is added after geometry so it remains readable at every camera angle.
      massPoint = project(centre); axisPoint=project(vert?[centre[0],centre[1]-scale,0]:[centre[0]+scale,centre[1],0]);
      faces.sort((a,b)=>b.d-a.d);
      paint();
      const r0=project(point(eq,.56)),r1=project(point(eq+.1,.56));
      const crowded=Math.hypot(r1.x-r0.x,r1.y-r0.y)<14;
      for(const cm of (crowded ? [0] : [-20,-10,0,10,20])) {
        const mark=project(point(eq+cm/100,.56));
        tag(ctx,cm===0?'0':fmt(cm,0),mark.x+5,mark.y,{color:cm===0?c.primary:c.text2,bg:c.bg2,font:'600 9px system-ui'});
      }
      const unit=project(point(eq+.3,.56));
      tag(ctx,'x, sm',unit.x+5,unit.y,{color:c.text2,bg:c.bg2,font:'600 9px system-ui'});
    } else { faces.sort((a,b)=>b.d-a.d); paint(); massPoint=project(centre); axisPoint=project(vert?[centre[0],centre[1]-scale,0]:[centre[0]+scale,centre[1],0]); }
    function paint() {
      if(depthRender){depthRender(ctx,faces,w,h);return;}
      for(const f of faces) {
        ctx.beginPath(); ctx.moveTo(f.p[0].x,f.p[0].y);
        for(const p of f.p.slice(1))ctx.lineTo(p.x,p.y);
        if(f.p.length>2)ctx.closePath();
        if(f.fill){ctx.fillStyle=f.fill;ctx.fill();}
        if(f.stroke){ctx.strokeStyle=f.stroke;ctx.lineWidth=f.width;ctx.lineJoin='round';ctx.stroke();}
      }
    }
    hitRadius=Math.max(16, focal*side/massPoint.d*.65);
    tag(ctx,`${fmt(P.m,1)} kg`,massPoint.x,massPoint.y,{color:c.bg,bg:c.primary,align:'center',font:'700 11px system-ui'});
    const vector=(origin,delta,color,label)=>{
      const a=project(origin),b=project(origin.map((x,i)=>x+delta[i]));
      arrow(ctx,a.x,a.y,b.x-a.x,b.y-a.y,color,{width:2.3,head:7,label,font:'italic 700 12px serif'});
    };
    const axis=v=>vert?[0,-v,0]:[v,0,0];
    if(show.forces) {
      const fScale=.65/Math.max(k*.25,P.m*P.g);
      vector([centre[0],centre[1],.32],axis((vert?-k*(dl+s.x):-k*s.x)*fScale),c.success,'F');
      vector([centre[0]-.16,centre[1],.32],[0,-P.m*P.g*fScale,0],c.special,'mg');
      if(!vert)vector([centre[0]+.16,centre[1],.32],[0,P.m*P.g*fScale,0],c.text2,'N');
      if(P.b>0)vector([centre[0],centre[1],-.4],axis(clamp(-P.b*s.v*fScale,-.8,.8)),c.danger,'Fq');
      if(P.driveOn)vector([centre[0],centre[1]+.3,.4],axis(P.F*Math.cos(P.ratio*Math.sqrt(k/P.m)*s.t)*fScale),c.special,'F(t)');
    }
    if(show.net&&vert)vector([centre[0]+.4,centre[1],0],axis(clamp(-k*s.x/(k*.25)*.65,-1,1)),c.danger,'−kx');
    if(show.velocity)vector([centre[0],centre[1]+.35,.2],axis(clamp(s.v/Math.sqrt(k/P.m)*2,-.8,.8)),c.warning,'v');
    tag(ctx,`3D laboratoriya · t = ${fmt(s.t,1)} s`,14,21,{color:c.text2,bg:c.bg2,font:'600 11px system-ui'});
    if(show.energy) {
      const values=[['K',energy.K,c.success],['U',energy.U,c.warning],['E',energy.K+energy.U,c.primary]];
      const top=45,bottom=112,ref=Math.max(energy.ref,energy.K+energy.U,.001);
      values.forEach(([name,value,col],i)=>{
        const x=w-68+i*20;
        ctx.fillStyle=c.border;ctx.fillRect(x,top,10,bottom-top);
        ctx.fillStyle=col;const bh=(bottom-top)*Math.min(1,value/ref);ctx.fillRect(x,bottom-bh,10,bh);
        tag(ctx,name,x+5,bottom+13,{color:c.text2,bg:c.bg,align:'center',font:'600 10px system-ui'});
      });
    }
    tag(ctx,'Tasvir masshtabi avtomatik · x muvozanatdan o‘lchanadi',14,h-14,{color:c.text3,bg:c.bg,font:'10px system-ui'});
  }
  return {
    camera, reset, draw,
    hit(x,y) { return massPoint && Math.hypot(x-massPoint.x,y-massPoint.y)<hitRadius; },
    displacement(dx,dy) {
      if(!massPoint||!axisPoint)return 0;
      const x=axisPoint.x-massPoint.x,y=axisPoint.y-massPoint.y;
      return (dx*x+dy*y)/Math.max(400,x*x+y*y);
    },
  };
}
