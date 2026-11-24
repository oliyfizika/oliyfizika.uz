// Gold-leaf electroscope: connected ball/stem/leaves isolated from the glass case.
import { createLab3D } from './lab-3d.js?v=20261123-batch8c';
import { alpha, path, ring } from './apparatus-3d.js?v=20261123-batch8c';
import { fmt } from './sim-kit.js';

export const scopePoint=(x,y,z=0)=>[(x-320)*.009,(312-y)*.009,z];
export function createElectroscopeLab(){
  const lab=createLab3D();
  function mark(sign,p,r=.035){const c=lab.colors,col=sign>0?c.danger:c.primary;lab.line([p[0]-r,p[1],p[2]],[p[0]+r,p[1],p[2]],col,2);if(sign>0)lab.line([p[0],p[1]-r,p[2]],[p[0],p[1]+r,p[2]],col,2);}
  function casing(s,name,ui){
    const c=lab.colors,x=scopePoint(s.bx,0)[0],base=scopePoint(0,s.by+222)[1],top=scopePoint(0,s.by+46)[1];
    lab.rod([x,base-.08,0],[x,base,0],.66,c.text3,36);
    lab.rod([x,top,0],[x,top+.06,0],.57,c.text3,36);
    // A transparent cylindrical enclosure and two solid rim rings.
    for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;lab.face([[x+.56*Math.cos(a),base,.56*Math.sin(a)],[x+.56*Math.cos(b),base,.56*Math.sin(b)],[x+.56*Math.cos(b),top,.56*Math.sin(b)],[x+.56*Math.cos(a),top,.56*Math.sin(a)]],alpha(c.primary,.045));}
    for(const y of [base,top])for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;lab.rod([x+.57*Math.cos(a),y,.57*Math.sin(a)],[x+.57*Math.cos(b),y,.57*Math.sin(b)],.014,c.text3,6);}
    // Rubber stopper keeps the charged conductor clear of the housing.
    lab.rod([x,top-.04,0],[x,top+.13,0],.115,c.sunken,24);
    const ball=scopePoint(s.bx,s.by),hinge=scopePoint(s.bx,s.by+105);
    lab.rod(ball,hinge,.021,c.text2,12);lab.sphere(ball,.144,c.text3);
    for(const side of [-1,1]){
      const p=scopePoint(s.bx+side*3,s.by+105),end=scopePoint(s.bx+side*(3+60*Math.sin(s.th)),s.by+105+60*Math.cos(s.th));
      lab.solid([[p[0]-.027,p[1],-.035],[p[0]+.027,p[1],-.035],[end[0]+.021,end[1],-.035],[end[0]-.021,end[1],-.035],[p[0]-.027,p[1],.035],[p[0]+.027,p[1],.035],[end[0]+.021,end[1],.035],[end[0]-.021,end[1],.035]],c.warning);
      if(ui.show.charges)for(let k=0;k<Math.min(4,Math.round(Math.abs(s.leaf)/3));k++){const t=.35+k*.18;mark(Math.sign(s.leaf),[p[0]+(end[0]-p[0])*t,p[1]+(end[1]-p[1])*t,-.06],.025);}
    }
    // Angular scale sits behind the leaves, so rotation reveals their separation.
    for(let deg=-70;deg<=70;deg+=5){const a=deg*Math.PI/180,y=s.by+105+70*Math.cos(a),xx=s.bx+70*Math.sin(a),p=scopePoint(xx,y,.26);lab.line(p,scopePoint(s.bx+(deg%30===0?78:74)*Math.sin(a),s.by+105+(deg%30===0?78:74)*Math.cos(a),.26),c.text3,.8);if(deg%30===0)lab.label(String(Math.abs(deg)),scopePoint(s.bx+88*Math.sin(a),s.by+105+88*Math.cos(a),.26));}
    if(ui.show.charges)for(let k=0;k<Math.min(8,Math.round(Math.abs(s.ball)/1.5));k++){const a=k*Math.PI/4;mark(Math.sign(s.ball),[ball[0]+.13*Math.cos(a),ball[1]+.13*Math.sin(a),-.075],.025);}
    lab.label((ui.mode==='two'?'AB'[+name]+' · ':'')+'θ '+fmt(s.th*180/Math.PI,0)+'°',[x,base-.18,-.56],c.text2);
    if(ui.show.names){lab.label('Izolyator',[x,top+.24,.1]);lab.label('Metall yaproqchalar',[x,hinge[1]-.7,-.55]);}
    if(s.gx){
      const gx=scopePoint(s.gx,0)[0],piv=scopePoint(s.gx,s.by+104),upper=scopePoint(s.gx,s.by+70),end=s.g?upper:scopePoint(s.gx+21,s.by+77);
      path(lab,[scopePoint(s.bx+15,s.by),scopePoint(s.gx,s.by),upper],c.text2,.018);
      path(lab,[piv,scopePoint(s.gx,s.by+214)],c.text2,.018);
      lab.box(gx-.16,piv[1]-.09,.08,.32,.5,.1,c.bg2);lab.rod(piv,end,.035,s.g?c.success:c.warning,10);
      for(const p of [piv,upper])lab.sphere(p,.035,c.text2);
      for(let k=0;k<3;k++){const p=scopePoint(s.gx,s.by+214+k*5);lab.line([gx-.13+k*.04,p[1],0],[gx+.13-k*.04,p[1],0],c.text3,1.5);}
      lab.handle('sw'+name,scopePoint(s.gx+6,s.by+87),.2);lab.label(s.g?'Yer: ulangan':'Yer: uzilgan',[gx+.12,piv[1]-.25,-.1],s.g?c.success:c.text2);
    }
  }
  return {lab,draw(ctx,stage,ui,scopes,rod,cloth,bar,pr,rodMat,particles,partPos,time=0){
    lab.begin(ctx,stage,{target:[0,1.3,0],focal:1.7});const c=lab.colors;
    scopes.forEach((s,i)=>casing(s,String(i),ui));
    if(rod.on){
      const col=rodMat==='glass'?alpha(c.primary,.42):rodMat==='amber'?c.warning:rodMat==='metal'?c.text3:c.sunken;
      lab.rod(scopePoint(rod.x-173,rod.y),scopePoint(rod.x-7,rod.y),.063,col,24);
      // The hand grip grounds a hand-held metal rod in the original model.
      lab.rod(scopePoint(rod.x-182,rod.y),scopePoint(rod.x-146,rod.y),.095,rodMat==='metal'?c.warning:c.text3,16);
      if(rodMat==='metal'){const p=scopePoint(rod.x-166,rod.y);path(lab,[p,[p[0],Math.max(.14,p[1]-.4),-.28],[-2.9,.1,-.65]],c.text3,.014);lab.label('Qo‘l orqali yerga',[-2.55,.25,-.8],c.text2);}
      lab.handle('rod',scopePoint(rod.x-80,rod.y),.3);lab.handle('rod',scopePoint(rod.x-12,rod.y),.2);
      if(ui.show.charges)for(let k=0;k<Math.min(10,Math.round(Math.abs(rod.q)/3));k++)mark(Math.sign(rod.q),scopePoint(rod.x-14-k*10,rod.y,-.075));
      if(ui.show.names)lab.label(pr.rod,scopePoint(rod.x-90,rod.y-22));
    }
    if(cloth.on){
      const x0=cloth.x-37,y0=cloth.y-22,col=pr.cloth==='Ipak'?c.special:c.warning;
      for(let i=0;i<8;i++)for(let j=0;j<5;j++){
        const at=(u,v)=>scopePoint(x0+u*74,y0+v*44,-.085+.025*Math.sin(u*Math.PI*4)+.02*Math.sin(v*Math.PI*2));
        lab.face([at(i/8,j/5),at((i+1)/8,j/5),at((i+1)/8,(j+1)/5),at(i/8,(j+1)/5)],alpha(col,.72));
      }
      lab.handle('cloth',scopePoint(cloth.x,cloth.y,-.08),.35);
      if(ui.show.charges)for(let k=0;k<Math.min(8,Math.round(Math.abs(cloth.q)/3));k++)mark(Math.sign(cloth.q),scopePoint(x0+12+(k%4)*16,y0+12+Math.floor(k/4)*20,-.12));
      if(ui.show.names)lab.label(pr.cloth,scopePoint(cloth.x,cloth.y+34,-.1));
    }
    if(ui.mode==='two'){
      const a=scopes[0],b=scopes[1],y=bar.y+3,center=(a.bx+b.bx)/2;
      lab.rod(scopePoint(a.bx-10,y),scopePoint(b.bx+10,y),.027,bar.mat==='metal'?c.text3:alpha(c.primary,.4),16);
      lab.rod(scopePoint(center,bar.y-24),scopePoint(center,bar.y),.045,c.sunken,12);
      ring(lab,scopePoint(center,bar.y-31),.08,c.warning,'z',.015);lab.handle('bar',scopePoint(center,bar.y-26),.22);
      lab.label(bar.mat==='metal'?'Metall ulagich':'Shisha ulagich',scopePoint(center,bar.y-50),c.text2);
    }
    for(const p of particles){if(p.t<0)continue;const q=partPos(p);mark(-1,scopePoint(q.x,q.y,-.1),.028);}
    lab.finish(time,'Moslama: 3D · zaryad belgilari shartli');
  },modelPoint(p,id){const q=lab.planePoint(p.x,p.y,id==='cloth'?-.08:0);return q?{x:q[0]/.009+320,y:312-q[1]/.009}:null;}};
}
