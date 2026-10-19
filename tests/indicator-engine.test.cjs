const test=require('node:test');
const assert=require('node:assert/strict');
const Nodes=require('../indicator-nodes.js');
const Engine=require('../indicator-engine.js');
const Storage=require('../indicator-storage.js');
const bars=values=>values.map((close,i)=>({time:i+1,open:close,high:close+1,low:close-1,close,volume:100}));
const graph=(nodes,edges)=>({version:1,nodes,edges:edges.map(([from,to,input],i)=>({id:'e'+i,from,to,input}))});
const node=(type,id,params={})=>{const n=Nodes.create(type,id);Object.assign(n.params,params);return n};
test('SMA and seeded EMA match hand-calculated references; warm-up is null',()=>{
  assert.deepEqual(Engine.average([1,2,3,6,8],3),[null,null,2,11/3,17/3]);
  assert.deepEqual(Engine.average([1,2,3,6,8],3,true),[null,null,2,4,6]);
  assert.deepEqual(Engine.average([1,2,null,4,5],2,true),[null,1.5,null,null,4.5]);
});
test('RSI Wilder references, rising, flat and warm-up',()=>{
  assert.deepEqual(Engine.rsi([1,2,3,4],3),[null,null,null,100]);
  assert.deepEqual(Engine.rsi([5,5,5,5],3),[null,null,null,50]);
  const actual=Engine.rsi([1,2,3,2,4],3);
  assert.ok(Math.abs(actual[3]-66.6666666667)<1e-8);
  assert.ok(Math.abs(actual[4]-83.3333333333)<1e-8);
});
test('crossovers, comparisons, AND/OR and marker bar alignment',()=>{
  const nodes=[node('Close','c'),node('CrossAbove','up',{threshold:2}),node('CrossBelow','down',{threshold:2}),node('Greater','greater',{threshold:1}),node('AND','and'),node('OR','or'),node('Buy','buy'),node('Sell','sell'),node('Alert','alert',{transition:false})];
  const g=graph(nodes,[['c','up','a'],['c','down','a'],['c','greater','a'],['up','and','a'],['greater','and','b'],['up','or','a'],['down','or','b'],['and','buy','condition'],['down','sell','condition'],['or','alert','condition']]);
  const result=Engine.execute(g,bars([1,2,3,2,1,3]));
  assert.deepEqual(result.values.get('up'),[null,false,true,false,false,true]);
  assert.deepEqual(result.values.get('down'),[null,false,false,false,true,false]);
  assert.deepEqual(result.values.get('or'),[null,false,true,false,true,true]);
  assert.deepEqual(result.markers.map(m=>[m.time,m.side]),[[3,'buy'],[5,'sell'],[6,'buy']]);
});
test('invalid types, missing connections, cycles, duplicate input, invalid parameters',()=>{
  const g=Nodes.sample();assert.equal(Engine.validate(g).ok,true);
  g.edges.push({id:'cycle',from:'ema',to:'ema',input:'source'});assert.match(Engine.validate(g).errors.join(),/Circular/);
  const bad=graph([node('Close','c'),node('Buy','b')],[['c','b','condition']]);assert.match(Engine.validate(bad).errors.join(),/tipe socket/);
  assert.equal(Engine.validate(graph([node('EMA','ema')],[]),{incomplete:true}).ok,true);
  assert.equal(Engine.validate(graph([node('EMA','ema')],[])).ok,false);
  g.nodes[1].params.period=0;assert.match(Engine.validate(g).errors.join(),/parameter/);
});
test('graph limits, no duplicate bar time, no mutation and future independence',()=>{
  const g=Nodes.sample();g.nodes[1].params.period=2;const original=JSON.stringify(g),data=bars([2,4,3,8]);const short=Engine.execute(g,data.slice(0,3)),long=Engine.execute(g,data);
  assert.deepEqual(long.plots[0].data.slice(0,2),short.plots[0].data);assert.equal(JSON.stringify(g),original);
  assert.throws(()=>Engine.execute(g,[data[0],data[0]]),/duplikat/);
  assert.equal(Engine.validate({version:1,nodes:Array.from({length:129},(_,i)=>node('Close','n'+i)),edges:[]}).ok,false);
});
test('storage roundtrip, version, positions and timestamps; corrupt records not overwritten',()=>{
  const memory=new Map(),adapter={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
  const store=new Storage(adapter,'test');const rec=store.save({id:'one',name:'Test',version:1,graph:Nodes.sample()});
  assert.deepEqual(store.get('one'),rec);assert.ok(rec.createdAt&&rec.updatedAt);rec.graph.nodes[0].x=222;store.save(rec);assert.equal(store.list().length,1);assert.equal(store.get('one').graph.nodes[0].x,222);
  adapter.setItem('test','broken');assert.throws(()=>store.save(rec),/rusak/);assert.equal(adapter.getItem('test'),'broken');
});
