// Small, reusable solid components. All dimensions are scene units, not model units.
export const detailedStageHeight = width => Math.round(width < 560
  ? Math.min(320, Math.max(285, innerHeight * .38))
  : Math.min(420, Math.max(285, innerHeight * .46)));
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const mul=(a,k)=>a.map(v=>v*k);
export function alpha(color,opacity) {
  const hex=color.replace('#','');
  if(/^[\da-f]{6}$/i.test(hex))return `rgba(${parseInt(hex.slice(0,2),16)},${parseInt(hex.slice(2,4),16)},${parseInt(hex.slice(4,6),16)},${opacity})`;
  if(/^[\da-f]{3}$/i.test(hex))return alpha('#'+[...hex].map(c=>c+c).join(''),opacity);
  const values=color.match(/[\d.]+/g);
  return values?.length>=3?`rgba(${values.slice(0,3).join(',')},${opacity})`:color;
}
export function arrowSolid(lab,start,end,color,radius=.022) {
  const d=end.map((v,i)=>v-start[i]),len=Math.hypot(...d);
  if(len<.025){lab.sphere(start,.035,color);return;}
  const u=mul(d,1/len),head=Math.min(.16,len*.27),base=add(end,mul(u,-head));
  lab.rod(start,base,radius,color);
  const q=Math.abs(u[1])<.9?[0,1,0]:[1,0,0];
  let a=[u[1]*q[2]-u[2]*q[1],u[2]*q[0]-u[0]*q[2],u[0]*q[1]-u[1]*q[0]];a=mul(a,1/Math.hypot(...a));
  const b=[u[1]*a[2]-u[2]*a[1],u[2]*a[0]-u[0]*a[2],u[0]*a[1]-u[1]*a[0]];
  for(let i=0;i<16;i++) {
    const ring=t=>add(base,add(mul(a,Math.cos(t)*radius*2.8),mul(b,Math.sin(t)*radius*2.8)));
    lab.face([ring(i*Math.PI/8),ring((i+1)*Math.PI/8),end],color);
  }
}
export function path(lab,points,color,width=.018) {
  for(let i=1;i<points.length;i++)lab.rod(points[i-1],points[i],width,color,8);
}
export function dashed(lab,a,b,color,width=1.2) {
  const n=Math.max(4,Math.ceil(Math.hypot(...a.map((v,i)=>v-b[i]))/.08));
  for(let i=0;i<n;i+=2)lab.line(a.map((v,j)=>v+(b[j]-v)*i/n),a.map((v,j)=>v+(b[j]-v)*Math.min(i+1,n)/n),color,width);
}
export function helix(lab,a,b,r,turns,color,wire=.018) {
  const n=turns*20,pts=[];
  const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);
  if(length<1e-6)return [];
  const u=mul(d,1/length),q=Math.abs(u[1])<.9?[0,1,0]:[1,0,0];
  let v=[u[1]*q[2]-u[2]*q[1],u[2]*q[0]-u[0]*q[2],u[0]*q[1]-u[1]*q[0]];v=mul(v,1/Math.hypot(...v));
  const w=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  pts.push(a);
  for(let i=0;i<=n;i++){const t=i/n,theta=t*turns*2*Math.PI;pts.push(add(add(a,mul(d,.06+.88*t)),add(mul(v,r*Math.cos(theta)),mul(w,r*Math.sin(theta)))));}
  pts.push(b);path(lab,pts,color,wire);return pts;
}
export function ring(lab,center,r,color,normal='z',wire=.02) {
  const point=t=>normal==='x'?[center[0],center[1]+r*Math.cos(t),center[2]+r*Math.sin(t)]:[center[0]+r*Math.cos(t),center[1]+r*Math.sin(t),center[2]];
  for(let i=0;i<48;i++)lab.rod(point(i*Math.PI/24),point((i+1)*Math.PI/24),wire,color,8);
}
export function stand(lab,x,z,height,color) {
  lab.box(x-.15,.02,z-.22,.3,.08,.44,color);
  lab.rod([x,.1,z],[x,height,z],.025,color);
  lab.sphere([x,.1,z],.045,color);
}
export function dial(lab,center,frac,color,id,label) {
  lab.rod([center[0],center[1],center[2]],[center[0],center[1],center[2]+.05],.12,color,32);
  const theta=(-.8+1.6*frac)*Math.PI;
  const end=[center[0]+Math.sin(theta)*.09,center[1]+Math.cos(theta)*.09,center[2]-.015];
  lab.rod([center[0],center[1],center[2]-.015],end,.012,lab.colors.bg);
  lab.handle(id,center,.16);
  lab.label(label,[center[0],center[1]-.24,center[2]+.02]);
}
export function carriers(lab,points,offset,color,count=14,visible=()=>true) {
  const lengths=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-points[i][j]))),total=lengths.reduce((a,b)=>a+b,0);
  if(total<1e-8)return;
  for(let i=0;i<count;i++){
    let d=((offset+i*total/count)%total+total)%total;
    for(let j=0;j<lengths.length;j++){
      if(d<=lengths[j]){const f=d/(lengths[j]||1);const p=points[j].map((v,k)=>v+(points[j+1][k]-v)*f);if(visible(p))lab.sphere(p,.027,color);break;}
      d-=lengths[j];
    }
  }
}
