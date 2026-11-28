// Shared perspective laboratory, GPU depth rendering and orbit controls.
// Physics stays in each simulation's existing DOM-free model.
import { clamp, fmt, arrow, tag } from './sim-kit.js';

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
    // Opaque solids and rays write depth; glass is blended afterwards, back to front.
    for(const f of faces)if(f.fill && rgba(f.fill)[3] >= .999){
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
    gl.depthMask(true);
    gl.drawArrays(gl.TRIANGLES,0,data.length/8);
    data.length=0;
    for(const f of faces.filter(f=>f.fill && rgba(f.fill)[3]<.999).sort((a,b)=>b.d-a.d)) {
      const col=rgba(f.fill);
      for(let i=1;i<f.p.length-1;i++)for(const p of [f.p[0],f.p[i],f.p[i+1]])vertex(p,col,f.shade);
    }
    if(data.length) {
      gl.depthMask(false);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES,0,data.length/8);
      gl.depthMask(true);
    }
    ctx.drawImage(surface,0,0,w,h);
  };
}

export const labStageHeight = () => Math.round(Math.min(420, Math.max(285, innerHeight * .46)));
export function createLab3D() {
  const gpu = createDepthRenderer();
  const camera = { yaw: -.5, pitch: .35, zoom: 1 };
  let ctx, w, h, c, focal, target, faces, labels, handles;
  let angleYaw, anglePitch, cy, sy, cp, sp;
  const reset = () => Object.assign(camera, { yaw: -.5, pitch: .35, zoom: 1 });
  function project(point) {
    if (angleYaw !== camera.yaw) { angleYaw=camera.yaw;cy=Math.cos(angleYaw);sy=Math.sin(angleYaw); }
    if (anglePitch !== camera.pitch) { anglePitch=camera.pitch;cp=Math.cos(anglePitch);sp=Math.sin(anglePitch); }
    const x=point[0]-target[0],y=point[1]-target[1],z=point[2]-target[2];
    const xx=cy*x-sy*z,zz=sy*x+cy*z,d=9-sp*y+cp*zz;
    return {x:w/2+focal*xx/d,y:h*.48-focal*(cp*y+sp*zz)/d,d};
  }
  function planePoint(x,y,z=0) {
    const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
    const right=[cy,0,-sy],up=[sy*sp,cp,cy*sp],forward=[sy*cp,-sp,cy*cp];
    const origin=target.map((v,i)=>v-9*forward[i]);
    const dx=(x-w/2)/focal,dy=-(y-h*.48)/focal;
    const ray=forward.map((v,i)=>v+dx*right[i]+dy*up[i]);
    if(Math.abs(ray[2])<.1)return null; // edge-on: orbit before manipulating the apparatus
    const t=(z-origin[2])/ray[2];
    return t>0?origin.map((v,i)=>v+t*ray[i]):null;
  }
  function face(points,fill,stroke=null,width=.7,projected=null) {
    // Connected surfaces may share projected vertices; solids keep the simple API.
    const p=projected||points.map(project);
    let shade=1;
    if(points.length>2) {
      const u=points[1].map((x,i)=>x-points[0][i]),v=points[2].map((x,i)=>x-points[0][i]);
      const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      shade=.62+.38*Math.abs((n[0]*.3+n[1]*.85+n[2]*.43)/(Math.hypot(...n)||1));
    }
    faces.push({p,fill,stroke,width,shade,d:p.reduce((sum,p)=>sum+p.d,0)/p.length});
  }
  const line=(a,b,color=c.text3,width=1)=>face([a,b],null,color,width);
  function solid(p,color) {
    for(const ids of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]])face(ids.map(i=>p[i]),color);
  }
  function box(x,y,z,sx,sy,sz,color=c.text3) {
    solid([[x,y,z],[x+sx,y,z],[x+sx,y+sy,z],[x,y+sy,z],[x,y,z+sz],[x+sx,y,z+sz],[x+sx,y+sy,z+sz],[x,y+sy,z+sz]],color);
  }
  function rod(a,b,r,color=c.text3,n=12) {
    const u=b.map((x,i)=>x-a[i]),len=Math.hypot(...u);
    if(len<1e-6)return;
    for(let i=0;i<3;i++)u[i]/=len;
    const q=Math.abs(u[1])<.9?[0,1,0]:[1,0,0];
    let v=[u[1]*q[2]-u[2]*q[1],u[2]*q[0]-u[0]*q[2],u[0]*q[1]-u[1]*q[0]];
    const vl=Math.hypot(...v);v=v.map(x=>x/vl);
    const t=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const ring=p=>Array.from({length:n},(_,i)=>p.map((x,j)=>x+r*(v[j]*Math.cos(i*2*Math.PI/n)+t[j]*Math.sin(i*2*Math.PI/n))));
    const aa=ring(a),bb=ring(b);
    for(let i=0;i<n;i++)face([aa[i],aa[(i+1)%n],bb[(i+1)%n],bb[i]],color);
    face(aa,color);face(bb,color);
  }
  function sphere(p,r,color=c.primary) {
    const ring=(i,j)=>[p[0]+r*Math.sin(i*Math.PI/12)*Math.cos(j*Math.PI/12),p[1]+r*Math.cos(i*Math.PI/12),p[2]+r*Math.sin(i*Math.PI/12)*Math.sin(j*Math.PI/12)];
    for(let i=0;i<12;i++)for(let j=0;j<24;j++)face([ring(i,j),ring(i+1,j),ring(i+1,j+1),ring(i,j+1)],color);
  }
  function bench() {
    face([[-7,-1.18,-7],[7,-1.18,-7],[7,-1.18,7],[-7,-1.18,7]],c.sunken);
    for(let i=-6;i<=6;i++){line([i,-1.175,-7],[i,-1.175,7],c.border);line([-7,-1.175,i],[7,-1.175,i],c.border);}
    for(const x of [-2.7,2.7])for(const z of [-1.35,1.35]) {
      box(x-.07,-1.12,z-.07,.14,1.05,.14,c.text3);box(x-.13,-1.16,z-.13,.26,.07,.26,c.text2);
    }
    box(-3.15,-.12,-1.7,6.3,.12,3.4,c.bg2);
    for(const z of [-1.48,1.38])box(-2.95,-.31,z,5.9,.19,.1,c.text3);
    face([[-2.7,.006,-1.1],[2.7,.006,-1.1],[2.7,.006,1.1],[-2.7,.006,1.1]],c.sunken);
    for(let x=-2.5;x<=2.5;x+=.25)line([x,.009,-1.1],[x,.009,1.1],c.border,.45);
    for(let z=-1;z<=1;z+=.25)line([-2.7,.009,z],[2.7,.009,z],c.border,.45);
  }
  function begin(context,stage,options={}) {
    ctx=context;({w,h,colors:c}=stage);target=options.target||[0,1.2,0];
    focal=Math.min(w*1.35,h*(options.focal||1.7))*camera.zoom;
    faces=[];labels=[];handles=[];
    ctx.fillStyle=c.bg;ctx.fillRect(0,0,w,h);
    const bg=ctx.createRadialGradient(w*.5,h*.35,10,w*.5,h*.5,w*.7);
    bg.addColorStop(0,c.bg2);bg.addColorStop(1,c.sunken);ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    if(options.bench!==false)bench(); // ochiq havo sahnalari (dala, osmon) o'z yerini chizadi
  }
  const label=(text,p,color=c.text2)=>labels.push(()=>{const a=project(p);tag(ctx,text,a.x,a.y,{color,bg:c.bg2,align:'center',font:'600 10px system-ui'});});
  function vector(p,delta,color,text) {
    labels.push(()=>{const a=project(p),b=project(p.map((v,i)=>v+delta[i]));
      arrow(ctx,a.x,a.y,b.x-a.x,b.y-a.y,color,{width:2.4,head:7,label:text,font:'italic 700 12px serif'});});
  }
  const handle=(id,p,r=.15)=>{
    const a=project(p);handles.push({id,p:a,r:Math.max(18,focal*r/a.d)});
  };
  function hit(x,y) {
    return handles.map(a=>({...a,distance:Math.hypot(a.p.x-x,a.p.y-y)})).filter(a=>a.distance<a.r).sort((a,b)=>a.distance-b.distance)[0]?.id||null;
  }
  function nearest(pointAt,lo,hi,x,y) {
    let best=lo,d=Infinity;
    for(let i=0;i<=240;i++) {
      const t=lo+(hi-lo)*i/240,p=project(pointAt(t)),dd=Math.hypot(p.x-x,p.y-y);
      if(dd<d){d=dd;best=t;}
    }
    return best;
  }
  function finish(time,note='Tasvir masshtabi avtomatik') {
    if(gpu)gpu(ctx,faces,w,h);
    else {
      faces.sort((a,b)=>b.d-a.d);
      for(const f of faces){ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(f.p.length>2)ctx.closePath();
        if(f.fill){ctx.fillStyle=f.fill;ctx.fill();}if(f.stroke){ctx.strokeStyle=f.stroke;ctx.lineWidth=f.width;ctx.stroke();}}
    }
    labels.forEach(fn=>fn());
    // time — soniya yoki tayyor matn (masalan, yarim yemirilish davrlarida)
    tag(ctx,typeof time==='string'?time:`3D laboratoriya · t = ${fmt(time,1)} s`,14,21,{color:c.text2,bg:c.bg2,font:'600 11px system-ui'});
    tag(ctx,note,14,h-14,{color:c.text3,bg:c.bg,font:'10px system-ui'});
  }
  function bars(K,U,ref) {
    labels.push(()=>{
      const bottom=108,top=40,r=Math.max(ref,K+U,.001);
      [['K',K,c.success],['U',U,c.warning],['E',K+U,c.primary]].forEach(([name,v,col],i)=>{
        const x=w-68+i*20,bh=clamp(v/r,0,1)*(bottom-top);
        ctx.fillStyle=c.border;ctx.fillRect(x,top,10,bottom-top);ctx.fillStyle=col;ctx.fillRect(x,bottom-bh,10,bh);
        tag(ctx,name,x+5,bottom+12,{color:c.text2,bg:c.bg,align:'center',font:'600 10px system-ui'});
      });
    });
  }
  return {camera,reset,begin,face,line,solid,box,rod,sphere,label,vector,handle,hit,nearest,planePoint,project,finish,bars,get colors(){return c;}};
}

export function bindLabCamera(canvas,lab,render,interaction={}) {
  const pointers=new Map();let gesture=null;
  const position=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  canvas.style.touchAction='none';canvas.tabIndex=0;
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.pointerType!=='touch')return;
    const p=position(e);pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
    if(pointers.size>1){if(gesture?.id)interaction.end?.(gesture.id,true);gesture={kind:'pinch',distance:distance(),zoom:lab.camera.zoom};return;}
    const id=lab.hit(p.x,p.y);
    gesture={kind:id?'object':'orbit',id,last:p};canvas.dataset.dragging='true';
    if(id)interaction.start?.(id,p);
  });
  canvas.addEventListener('pointermove',e=>{
    const p=position(e);if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
    if(!gesture){canvas.style.cursor=lab.hit(p.x,p.y)?'grab':'move';return;}
    if(!pointers.has(e.pointerId))return;
    if(gesture.kind==='pinch'){
      if(pointers.size>1)lab.camera.zoom=clamp(gesture.zoom*distance()/Math.max(1,gesture.distance),.7,1.65);
    }else if(gesture.id)interaction.move?.(gesture.id,p);
    else{lab.camera.yaw+=(p.x-gesture.last.x)*.009;lab.camera.pitch=clamp(lab.camera.pitch+(p.y-gesture.last.y)*.006,.08,1.35);gesture.last=p;}
    render();
  });
  const end=e=>{
    if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);
    if(gesture?.id)interaction.end?.(gesture.id,e.type!=='pointerup');
    gesture=null;canvas.dataset.dragging='false';
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    render();
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,end);
  canvas.addEventListener('wheel',e=>{e.preventDefault();lab.camera.zoom=clamp(lab.camera.zoom*Math.exp(-e.deltaY*.001),.7,1.65);render();},{passive:false});
  canvas.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;e.preventDefault();
    if(e.key==='ArrowLeft')lab.camera.yaw-=.15;if(e.key==='ArrowRight')lab.camera.yaw+=.15;
    if(e.key==='ArrowUp')lab.camera.pitch=clamp(lab.camera.pitch+.1,.08,1.35);
    if(e.key==='ArrowDown')lab.camera.pitch=clamp(lab.camera.pitch-.1,.08,1.35);
    if(e.key==='+'||e.key==='=')lab.camera.zoom=clamp(lab.camera.zoom+.1,.7,1.65);
    if(e.key==='-')lab.camera.zoom=clamp(lab.camera.zoom-.1,.7,1.65);if(e.key==='Home')lab.reset();render();
  });
  document.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>{
    const name=button.dataset.camera;
    if(name==='reset')lab.reset();
    if(name==='front')Object.assign(lab.camera,{yaw:0,pitch:.12,zoom:1});
    if(name==='side')Object.assign(lab.camera,{yaw:Math.PI/2,pitch:.3,zoom:1});
    if(name==='top')Object.assign(lab.camera,{yaw:0,pitch:1.3,zoom:1});
    render();
  }));
}
