import assert from 'node:assert/strict';
import { solve,resistanceOf,voltmeterReading } from '../../../assets/js/simulations/circuit-physics.js';
import { PRESETS,PRESET_ORDER,EDGES,NODE_COUNT,toElements,labelsFor,defaultProps } from '../../../assets/js/simulations/circuit-grid.js';
import { createDCCircuitLab,nodePoint,componentPoint } from '../../../assets/js/simulations/dc-circuit-lab-3d.js';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);
const models=[];
for(const id of PRESET_ORDER){
  const cells=PRESETS[id].build(),{elements,index}=toElements(cells),sol=solve(NODE_COUNT,elements);
  assert.ok(sol.ok&&sol.converged,id);assert.equal(sol.error,null,id);
  const net=new Float64Array(NODE_COUNT);let supply=0,load=0;
  elements.forEach((e,k)=>{
    const r=sol.el[k];net[e.a]+=r.I;net[e.b]-=r.I;
    if(e.type==='battery')supply+=r.P;else load+=r.P;
    if(['resistor','rheostat','conductor','lamp'].includes(e.type))near(r.U,r.I*resistanceOf(e));
    if(e.type==='voltmeter')near(voltmeterReading(e,r),e.plus==='b'?-r.U:r.U);
  });
  for(const I of net)near(I,0,2e-6);near(supply,load,2e-6);
  models.push({id,cells,model:{elements,index,sol,labels:labelsFor(cells)}});
}
const ohm=models.find(m=>m.id==='ohm');near(ohm.model.sol.el[ohm.model.elements.findIndex(e=>e.type==='resistor')].I,.3);
const series=solve(3,[{type:'battery',a:0,b:1,emf:12,r:2,plus:'a'},{type:'resistor',a:1,b:2,R:10},{type:'resistor',a:2,b:0,R:20}]);
near(Math.abs(series.el[1].I),12/32);near(series.el[0].Ut,12-12/32*2);

globalThis.document={createElement:()=>({getContext:()=>null})};let numeric=0;
const check=(...args)=>{for(const x of args)if(typeof x==='number'){assert.ok(Number.isFinite(x));numeric++;}};
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:check});
const colors=Object.fromEntries(['bg','bg2','sunken','border','borderStrong','text','text2','text3','primary','warning','danger','success','special'].map(k=>[k,'#64748b']));
const scene=createDCCircuitLab();
const base={ui:{potential:true,values:true,dir:'conv'},phase:new Float64Array(EDGES.length),selected:null,tool:'select',hover:null,drag:null,dropPreview:null,
  potentialRange:()=>[0,12],toRGB:()=>[100,116,139],mixRGB:()=>colors.primary,formatValue:e=>e.type,amps:v=>String(v)+' A',placeTools:new Set(['voltmeter']),defaultProps};
for(const width of [375,850])for(const yaw of [-Math.PI,-.35,0,Math.PI/2,Math.PI])for(const pitch of [.12,.8,1.3]){
  Object.assign(scene.lab.camera,{yaw,pitch});const stage={w:width,h:320,colors};
  for(const {cells,model}of models){
    scene.draw(ctx,stage,{...base,cells,model,selected:model.index[0]});
    for(const edge of model.index.filter(i=>cells.get(i).type==='rheostat')){
      const p=scene.lab.project(componentPoint(edge,-.17+.34*.35,.47));near(scene.slider(edge,p),.35,.003);
    }
  }
  // Every movable body, plus a voltmeter preview with no solved result.
  const cells=new Map(Object.keys({wire:1,switch:1,resistor:1,rheostat:1,conductor:1,lamp:1,battery:1,ammeter:1,voltmeter:1,diode:1,led:1}).map((t,i)=>[i,defaultProps(t)]));
  const {elements,index}=toElements(cells),model={elements,index,sol:solve(NODE_COUNT,elements),labels:labelsFor(cells)};
  scene.draw(ctx,stage,{...base,cells,model,dropPreview:{edge:20,el:defaultProps('voltmeter')},drag:{kind:'move',from:0,active:true}});
}
Object.assign(scene.lab.camera,{yaw:0,pitch:1.3});scene.draw(ctx,{w:850,h:320,colors},{...base,...ohm});
for(const edge of EDGES){const a=nodePoint(edge.a),b=nodePoint(edge.b),p=scene.lab.project(a.map((v,i)=>(v+b[i])/2));assert.equal(scene.pick(p.x,p.y)?.id,edge.i);}
assert.ok(numeric>10000);
console.log('Circuit 3D: all12presets, KCL/power/Ohm/source voltage, every component/preview, orbital slider inverse and grid picking passed.');
