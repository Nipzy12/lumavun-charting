/* Public, read-only feed contracts. No trading endpoints or API credentials. */
(function(root){
  const seconds={'1m':60,'3m':180,'5m':300,'15m':900,'30m':1800,'1H':3600,'2H':7200,'4H':14400,'1D':86400,'1W':604800,'1M':2592000};
  const providers={
    binance:{name:'Binance',frames:{'1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m','1H':'1h','2H':'2h','4H':'4h','1D':'1d','1W':'1w','1M':'1M'}},
    okx:{name:'OKX',frames:{'1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m','1H':'1H','2H':'2H','4H':'4H','1D':'1Dutc','1W':'1Wutc','1M':'1Mutc'}},
    bitget:{name:'Bitget',frames:{'1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m','1H':'1H','4H':'4H','1D':'1D'}},
    biquote:{name:'biquote.io',frames:{'1m':'1m','5m':'5m','15m':'15m','30m':'30m','1H':'1h','4H':'4h','1D':'1d'}}
  };
  function config(provider,market,tf){
    const p=providers[provider];if(!p)throw Error('Provider tidak dikenal.');const frame=p.frames[tf];if(!frame)throw Error(`${p.name} tidak menyediakan interval ${tf} pada feed ini.`);
    if(provider!=='biquote'&&market.type!=='CRYPTO')throw Error(`${p.name}: pilih BTC, ETH, atau SOL (spot USDT). Forex/logam tersedia melalui biquote.io.`);
    const base=market.symbol.replace(/USD(T)?$/,''),symbol=provider==='biquote'?market.symbol:provider==='okx'?base+'-USDT':base+'USDT';
    if(!/^[A-Z0-9-]{3,24}$/.test(symbol))throw Error('Simbol tidak valid.');
    const query=new URLSearchParams();let url,ws,subscription;
    if(provider==='binance'){query.set('symbol',symbol);query.set('interval',frame);query.set('limit','1000');url='https://data-api.binance.vision/api/v3/klines?'+query;ws=`wss://data-stream.binance.vision/ws/${symbol.toLowerCase()}@kline_${frame}`}
    if(provider==='okx'){query.set('instId',symbol);query.set('bar',frame);query.set('limit','300');url='https://www.okx.com/api/v5/market/candles?'+query;ws='wss://ws.okx.com/ws/v5/business';subscription={op:'subscribe',args:[{channel:'candle'+frame,instId:symbol}]}}
    if(provider==='bitget'){query.set('category','SPOT');query.set('symbol',symbol);query.set('interval',frame);query.set('limit','1000');url='https://api.bitget.com/api/v3/market/candles?'+query;ws='wss://ws.bitget.com/v3/ws/public';subscription={op:'subscribe',args:[{instType:'spot',topic:'kline',symbol,interval:frame}]}}
    if(provider==='biquote'){query.set('interval',frame);query.set('limit','1000');url=`https://biquote.io/api/${symbol}/ohlc?${query}`;ws='https://biquote.io/hubs/tick'}
    return {provider,symbol,frame,tf,step:seconds[tf],url,ws,subscription,historyUrl:before=>historyUrl(provider,symbol,frame,before)};
  }
  function historyUrl(provider,symbol,frame,before,limit){
    const end=Math.max(0,Math.floor(Number(before)*1000)-1),q=new URLSearchParams();
    if(provider==='binance'){q.set('symbol',symbol);q.set('interval',frame);q.set('endTime',String(end));q.set('limit',String(Math.min(1000,limit||1000)));return 'https://data-api.binance.vision/api/v3/klines?'+q}
    if(provider==='okx'){q.set('instId',symbol);q.set('bar',frame);q.set('after',String(end+1));q.set('limit',String(Math.min(300,limit||300)));return 'https://www.okx.com/api/v5/market/history-candles?'+q}
    if(provider==='bitget'){q.set('category','SPOT');q.set('symbol',symbol);q.set('interval',frame);q.set('endTime',String(end));q.set('limit',String(Math.min(1000,limit||1000)));return 'https://api.bitget.com/api/v3/market/candles?'+q}
    if(provider==='biquote'){q.set('interval',frame);q.set('limit',String(Math.min(1000,limit||1000)));q.set('to',new Date(end).toISOString());return `https://biquote.io/api/${symbol}/ohlc?${q}`}
    throw Error('Provider historical tidak dikenal.');
  }
  function numeric(v){return v===null||v===undefined||v===''?NaN:Number(v)}
  function valid(bar){return ['time','open','high','low','close','volume'].every(k=>Number.isFinite(bar[k]))&&bar.time>0&&bar.open>0&&bar.close>0&&bar.low>0&&bar.volume>=0&&bar.high>=Math.max(bar.open,bar.close)&&bar.low<=Math.min(bar.open,bar.close)}
  function arrayBar(row,closed=false){return {time:Math.floor(numeric(row[0])/1000),open:numeric(row[1]),high:numeric(row[2]),low:numeric(row[3]),close:numeric(row[4]),volume:numeric(row[5]),closed}}
  function normalize(bars){const map=new Map();for(const b of bars)if(valid(b))map.set(b.time,b);return [...map.values()].sort((a,b)=>a.time-b.time)}
  function history(cfg,json,now=Date.now(),allowEmpty=false){
    let bars;
    if(cfg.provider==='binance'){if(!Array.isArray(json))throw Error(json?.msg||'Respons Binance tidak valid.');bars=json.map(r=>arrayBar(r,numeric(r[6])<now))}
    if(cfg.provider==='okx'){if(json.code!=='0')throw Error(json.msg||'OKX menolak permintaan.');bars=(json.data||[]).map(r=>arrayBar(r,r[8]==='1'))}
    if(cfg.provider==='bitget'){if(json.code!=='00000')throw Error(json.msg||'Bitget menolak permintaan.');bars=(json.data||[]).map(r=>arrayBar(r,numeric(r[0])+cfg.step*1000<=now))}
    if(cfg.provider==='biquote'){if(!Array.isArray(json.bars))throw Error(json.message||'Respons OHLC biquote tidak valid.');bars=json.bars.map(r=>({time:Math.floor(Date.parse(r.openTime)/1000),open:numeric(r.open),high:numeric(r.high),low:numeric(r.low),close:numeric(r.close),volume:numeric(r.volume??0),tickVolume:numeric(r.tickVolume??0),closed:r.isOpen===false}))}
    const result=normalize(bars||[]);if(!result.length&&!allowEmpty)throw Error('Tidak ada candle valid dari provider.');return result;
  }
  function message(cfg,json){
    if(json.event==='error'||json.error)throw Error(json.msg||json.error?.message||'Langganan ditolak.');
    if(cfg.provider==='binance'){const k=json.k;if(!k||json.s!==cfg.symbol||k.i!==cfg.frame)return [];return normalize([arrayBar([k.t,k.o,k.h,k.l,k.c,k.v],k.x===true)])}
    if(cfg.provider==='okx'){if(json.arg?.instId!==cfg.symbol||json.arg?.channel!=='candle'+cfg.frame)return [];return normalize((json.data||[]).map(r=>arrayBar(r,r[8]==='1')))}
    if(cfg.provider==='bitget'){if(json.arg?.symbol!==cfg.symbol||json.arg?.interval!==cfg.frame||json.arg?.topic!=='kline')return [];return normalize((json.data||[]).map(r=>arrayBar([r.start,r.open,r.high,r.low,r.close,r.volume],false)))}
    return [];
  }
  function merge(previous,updates){const map=new Map(previous.map(b=>[b.time,b]));for(const b of updates){const old=map.get(b.time);if(old?.closed&&!b.closed)continue;map.set(b.time,{...b,closed:old?.closed||b.closed})}const out=[...map.values()].sort((a,b)=>a.time-b.time);for(let i=0;i<out.length-1;i++)out[i]={...out[i],closed:true};return out}
  function bucket(time,tf){const date=new Date(time*1000);if(tf==='1M')return Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1)/1000;if(tf==='1W'){const day=(date.getUTCDay()+6)%7;return Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-day)/1000}const step=seconds[tf];return Math.floor(time/step)*step}
  function aggregate(bars,tf){const out=[];for(const bar of normalize(bars)){const time=bucket(bar.time,tf),last=out.at(-1);if(last?.time===time){last.high=Math.max(last.high,bar.high);last.low=Math.min(last.low,bar.low);last.close=bar.close;last.volume+=bar.volume;last.tickVolume=(last.tickVolume||0)+(bar.tickVolume||0);last.closed=last.closed&&bar.closed}else out.push({...bar,time})}return out}
  function marketOpen(time,market){if(!market||market.type==='CRYPTO')return true;const d=new Date(time*1000),day=d.getUTCDay(),hour=d.getUTCHours();return !((day===5&&hour>=22)||day===6||(day===0&&hour<22))}
  function gaps(bars,tf,market){const step=seconds[tf],result=[];if(!step||tf==='1M'||step>=86400)return result;for(let i=1;i<bars.length;i++){const distance=bars[i].time-bars[i-1].time;if(distance<=step*1.5)continue;let missing=0,from=0,to=0;for(let time=bars[i-1].time+step;time<bars[i].time;time+=step)if(marketOpen(time,market)){if(!from)from=time;to=time;missing++}if(missing)result.push({from,to,missing})}return result}
  function tick(cfg,previous,quote){
    if(quote.symbol!==cfg.symbol||quote.stale||quote.marketState==='closed')return previous;
    const stamp=Date.parse(quote.timestamp)/1000,price=numeric(quote.mid),time=Math.floor(stamp/cfg.step)*cfg.step,last=previous.at(-1);
    if(!Number.isFinite(stamp)||!Number.isFinite(price)||price<=0||!last||time<last.time||time===last.time&&last.closed)return previous;
    const bar=time===last.time?{...last,high:Math.max(last.high,price),low:Math.min(last.low,price),close:price,tickVolume:(last.tickVolume||0)+1}:{time,open:price,high:price,low:price,close:price,volume:0,tickVolume:1,closed:false};
    return merge(previous,[bar]);
  }
  root.SyndicateMarketAdapters={providers,seconds,config,historyUrl,history,message,normalize,merge,aggregate,gaps,tick};
  if(typeof module!=='undefined')module.exports=root.SyndicateMarketAdapters;
})(globalThis);
