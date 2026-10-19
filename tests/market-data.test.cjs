const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../market-adapters.js');
const Client=require('../market-client.js');
const HistoricalCache=require('../historical-cache.js');
const cryptoMarket={symbol:'BTCUSD',type:'CRYPTO'},gold={symbol:'XAUUSD',type:'METALS'};
const t=1700000040000;
const row=(time=t,close=102)=>[String(time),'100','105','99',String(close),'2',String(time+59999),'0','1'];
test('provider-specific symbol, interval, and public socket mapping',()=>{
  assert.equal(A.config('binance',cryptoMarket,'1H').symbol,'BTCUSDT');
  assert.equal(A.config('okx',cryptoMarket,'1D').frame,'1Dutc');
  assert.match(A.config('okx',cryptoMarket,'1m').ws,/ws\/v5\/business$/);
  assert.equal(A.config('bitget',cryptoMarket,'1m').subscription.args[0].topic,'kline');
  assert.throws(()=>A.config('bitget',cryptoMarket,'2H'),/tidak menyediakan/);
  assert.throws(()=>A.config('biquote',gold,'3m'),/tidak menyediakan/);
  assert.throws(()=>A.config('binance',gold,'1m'),/Forex/);
});
test('REST normalization: numeric OHLCV, sort, deduplicate and confirmation',()=>{
  const cfg=A.config('binance',cryptoMarket,'1m'),bars=A.history(cfg,[row(t+60000),row(),row(t,103)],t+120000);
  assert.equal(bars.length,2);assert.equal(bars[0].time,t/1000);assert.equal(bars[0].close,103);assert.equal(bars[0].closed,true);
  const ok=A.history(A.config('okx',cryptoMarket,'1m'),{code:'0',data:[row()]});assert.equal(ok[0].closed,true);
  const bit=A.history(A.config('bitget',cryptoMarket,'1m'),{code:'00000',data:[row()]},t+120000);assert.equal(bit[0].volume,2);
  assert.throws(()=>A.history(cfg,{code:-1,msg:'Invalid symbol'}),/Invalid/);
  assert.throws(()=>A.history(cfg,[[t,null,1,1,1,0]]),/Tidak ada/);
});
test('WS payloads and mismatched subscriptions are isolated',()=>{
  const bin=A.config('binance',cryptoMarket,'1m');assert.equal(A.message(bin,{s:'ETHUSDT',k:{i:'1m'}}).length,0);
  assert.equal(A.message(bin,{s:'BTCUSDT',k:{i:'1m',t,o:'100',h:'105',l:'99',c:'102',v:'2',x:true}})[0].closed,true);
  const ok=A.config('okx',cryptoMarket,'1m');assert.equal(A.message(ok,{arg:{instId:'BTC-USDT',channel:'candle1m'},data:[row()]})[0].close,102);
  const bit=A.config('bitget',cryptoMarket,'1m');assert.equal(A.message(bit,{arg:{symbol:'BTCUSDT',interval:'1m',topic:'kline'},data:[{start:t,open:'100',high:'105',low:'99',close:'102',volume:'2'}]})[0].volume,2);
});
test('same candle updates, closure, late forming frames and history recovery',()=>{
  const bars=A.history(A.config('binance',cryptoMarket,'1m'),[row()],t+1000);
  let out=A.merge(bars,[{...bars[0],close:104}]);assert.equal(out.length,1);assert.equal(out[0].close,104);
  out=A.merge(out,[{...bars[0],time:bars[0].time+60}]);assert.equal(out[0].closed,true);
  out=A.merge(out,[{...bars[0],close:101,closed:false}]);assert.equal(out[0].close,104);
  out=A.merge(out,[{...bars[0],close:103,closed:true}]);assert.equal(out[0].close,103);
});
test('biquote uses mid and ISO time; zero real volume is preserved',()=>{
  const cfg=A.config('biquote',gold,'1m'),bars=A.history(cfg,{bars:[{openTime:new Date(t).toISOString(),open:100,high:105,low:99,close:102,volume:0,tickVolume:50,isOpen:true}]});
  const tick={symbol:'XAUUSD',timestamp:new Date(t+1000).toISOString(),mid:104,last:0,volume:0,marketState:'open',stale:false};
  const next=A.tick(cfg,bars,tick);assert.equal(next.at(-1).close,104);assert.equal(next.at(-1).volume,0);assert.equal(next.at(-1).tickVolume,51);
  assert.equal(A.tick(cfg,bars,{...tick,marketState:'closed'}),bars);
  assert.equal(A.tick(cfg,bars,{...tick,stale:true}),bars);
  assert.equal(A.tick(cfg,bars,{...tick,timestamp:'bad'}),bars);
});
test('switching subscription aborts and ignores an older history response',async()=>{
  const originalFetch=global.fetch,originalWebSocket=global.WebSocket;const requests=[];
  global.fetch=(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}));
  class Socket{constructor(){this.readyState=0}close(){this.readyState=3}send(){}}
  global.WebSocket=Socket;
  const updates=[],client=new Client((e,event)=>updates.push([e.key,event]));
  try{
    client.reconcile([{provider:'binance',market:cryptoMarket,tf:'1m'}]);await new Promise(r=>setTimeout(r,0));
    client.reconcile([{provider:'binance',market:cryptoMarket,tf:'5m'}]);await new Promise(r=>setTimeout(r,0));
    assert.equal(requests[0].options.signal.aborted,true);
    requests[0].resolve({ok:true,json:async()=>[row()]});requests[1].resolve({ok:true,json:async()=>[row()]});
    await new Promise(r=>setTimeout(r,5));
    assert.equal(client.entries.size,1);assert.equal(client.get('binance',cryptoMarket,'1m'),undefined);
    assert.equal(updates.filter(([k,e])=>k.endsWith(':1m')&&e.history).length,0);
    assert.equal(client.get('binance',cryptoMarket,'5m').bars.length,1);
  }finally{client.dispose();global.fetch=originalFetch;global.WebSocket=originalWebSocket}
});
test('historical cursors are provider-specific and remain before the oldest candle',()=>{
  const before=1700000000;
  assert.match(A.config('binance',cryptoMarket,'1m').historyUrl(before),/endTime=1699999999999.*limit=1000/);
  assert.match(A.config('okx',cryptoMarket,'1m').historyUrl(before),/history-candles.*after=1700000000000/);
  assert.match(A.config('bitget',cryptoMarket,'1m').historyUrl(before),/endTime=1699999999999/);
  assert.match(A.config('biquote',gold,'1m').historyUrl(before),/to=2023-11-14T22%3A13%3A19.999Z/);
});
test('aggregation creates correct OHLCV buckets and calendar month boundaries',()=>{
  const base=Date.UTC(2024,0,31,23,58)/1000,bars=Array.from({length:4},(_,i)=>({time:base+i*60,open:10+i,high:12+i,low:9+i,close:11+i,volume:2,closed:true}));
  const five=A.aggregate(bars,'5m');assert.equal(five.length,2);assert.equal(five[0].time,Math.floor(base/300)*300);assert.equal(five[0].open,10);assert.equal(five[0].high,13);assert.equal(five[0].low,9);assert.equal(five[0].close,12);assert.equal(five[0].volume,4);
  const monthly=A.aggregate(bars,'1M');assert.equal(monthly.length,2);assert.equal(monthly[0].time,Date.UTC(2024,0,1)/1000);assert.equal(monthly[1].time,Date.UTC(2024,1,1)/1000);
});
test('gap detection reports crypto gaps but ignores the closed forex weekend',()=>{
  const fri=Date.UTC(2024,0,5,21,59)/1000,mon=Date.UTC(2024,0,7,22,0)/1000;
  const make=time=>({time,open:1,high:1,low:1,close:1,volume:0,closed:true});
  assert.ok(A.gaps([make(fri),make(fri+180)],'1m',cryptoMarket)[0].missing===2);
  assert.equal(A.gaps([make(fri),make(mon)],'1m',{type:'FOREX'}).length,0);
});
test('chunk cache deduplicates overlapping pages and preserves sorted candles',async()=>{
  const prior=global.indexedDB;delete global.indexedDB;const cache=new HistoricalCache({chunkSize:2,maxBars:20}),key='binance:BTCUSD:1m';
  const bars=[0,1,2].map(i=>({time:100+i*60,open:1,high:2,low:1,close:2,volume:1,closed:true}));await cache.put(key,bars);await cache.put(key,bars.slice(1));
  const found=await cache.get(key);assert.deepEqual(found.map(b=>b.time),[100,160,220]);global.indexedDB=prior;
});
test('older pagination prepends once, deduplicates boundary, and marks end-of-history',async()=>{
  const originalFetch=global.fetch,originalWebSocket=global.WebSocket,cache={async get(){return []},async put(){}};let page=0;
  const latest=[row(t),row(t+60000),row(t+120000)],older=[row(t-120000),row(t-60000),row(t)];
  global.fetch=async url=>({ok:true,headers:{get(){return null}},json:async()=>String(url).includes('endTime')?(page++?[]:older):latest});
  class Socket{constructor(){this.readyState=0}close(){this.readyState=3}send(){}}global.WebSocket=Socket;
  const events=[],client=new Client((e,event)=>events.push(event),{cache});try{client.reconcile([{provider:'binance',market:cryptoMarket,tf:'1m'}]);await new Promise(r=>setTimeout(r,10));const e=client.get('binance',cryptoMarket,'1m');assert.equal(e.bars.length,3);
    assert.equal(await client.loadOlder('binance',cryptoMarket,'1m'),true);assert.equal(e.bars.length,5);assert.equal(events.at(-1).prepended,2);
    assert.equal(await client.loadOlder('binance',cryptoMarket,'1m'),false);assert.equal(e.hasMore,false);
  }finally{client.dispose();global.fetch=originalFetch;global.WebSocket=originalWebSocket}
});
test('bounded memory can page left and restore the latest cached window',async()=>{
  const originalFetch=global.fetch,originalWebSocket=global.WebSocket,cache=new HistoricalCache({chunkSize:2,maxBars:30});
  const latest=[row(t),row(t+60000),row(t+120000)],older=[row(t-120000),row(t-60000),row(t)];
  global.fetch=async url=>({ok:true,headers:{get(){return null}},json:async()=>String(url).includes('endTime')?older:latest});class Socket{constructor(){this.readyState=0}close(){this.readyState=3}send(){}}global.WebSocket=Socket;
  const client=new Client(()=>{},{cache,maxMemoryBars:4});try{client.reconcile([{provider:'binance',market:cryptoMarket,tf:'1m'}]);await new Promise(r=>setTimeout(r,10));const e=client.get('binance',cryptoMarket,'1m');await client.loadOlder('binance',cryptoMarket,'1m');assert.equal(e.historicalWindow,true);assert.equal(e.bars[0].time,(t-120000)/1000);assert.equal(e.bars.at(-1).time,(t+60000)/1000);
    assert.equal(await client.restoreLatest('binance',cryptoMarket,'1m'),true);assert.equal(e.historicalWindow,false);assert.equal(e.bars.at(-1).time,(t+120000)/1000);
  }finally{client.dispose();global.fetch=originalFetch;global.WebSocket=originalWebSocket}
});
