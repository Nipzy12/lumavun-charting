/* Connection lifecycle, cancellation, history recovery and normalized candle updates. */
(function(root){
  class MarketClient{
    constructor(onUpdate,{cache,maxMemoryBars=50000}={}){this.entries=new Map();this.onUpdate=onUpdate;this.cache=cache||new (root.SyndicateHistoricalCache||class{async get(){return []}async put(){}})();this.maxMemoryBars=maxMemoryBars}
    key(provider,market,tf){return `${provider}:${market.symbol}:${tf}`}
    get(provider,market,tf){return this.entries.get(this.key(provider,market,tf))}
    reconcile(requests){const wanted=new Set(requests.map(r=>this.key(r.provider,r.market,r.tf)));for(const [key,e] of this.entries)if(!wanted.has(key)){this.close(e);this.entries.delete(key)}for(const r of requests){const key=this.key(r.provider,r.market,r.tf);if(this.entries.has(key))continue;const e={...r,key,bars:[],state:'loading',detail:'Memuat riwayat',alive:true,attempt:0,version:0,closedTime:0,lastMessage:0,hasMore:true,loadingOlder:false,gaps:[]};this.entries.set(key,e);try{e.cfg=SyndicateMarketAdapters.config(r.provider,r.market,r.tf);this.start(e)}catch(error){this.status(e,'error',error.message)}}}
    status(e,state,detail){if(!e.alive)return;e.state=state;e.detail=detail;this.onUpdate(e,{status:true})}
    async fetchJSON(url,signal){const r=await fetch(url,{signal,credentials:'omit'});if(!r.ok){const error=Error(`HTTP ${r.status} dari provider`),header=r.headers.get('Retry-After'),seconds=header===null?NaN:Number(header),wait=Number.isFinite(seconds)?seconds*1000:Date.parse(header)-Date.now();error.retryAfter=Math.max(1000,Number.isFinite(wait)?wait:r.status===429?60000:1000);throw error}return r.json()}
    async history(e){
      e.abort?.abort();const controller=new AbortController();e.abort=controller;const version=e.version;const timeout=setTimeout(()=>controller.abort(),15000);
      try{const json=await this.fetchJSON(e.cfg.url,controller.signal);if(!e.alive)return;const bars=SyndicateMarketAdapters.history(e.cfg,json);e.bars=(e.version===version?SyndicateMarketAdapters.merge(e.bars,bars):SyndicateMarketAdapters.merge(bars,e.bars)).slice(-this.maxMemoryBars);e.version++;e.closedTime=e.bars.filter(b=>b.closed).at(-1)?.time||0;e.loadedAt=Date.now();e.gaps=SyndicateMarketAdapters.gaps(e.bars,e.tf,e.market);this.cache.put(e.key,bars).catch(()=>{});this.onUpdate(e,{history:true});
        if(e.provider==='biquote'){try{const q=await this.fetchJSON(`https://biquote.io/api/${e.cfg.symbol}`,controller.signal);if(e.alive){e.quote=q;this.onUpdate(e,{status:true})}}catch{}}
      }finally{clearTimeout(timeout)}
    }
    async start(e){if(!e.alive)return;this.status(e,'loading',e.bars.length?'Memulihkan riwayat':'Memuat riwayat');try{const cached=await this.cache.get(e.key);if(e.alive&&cached.length&&!e.bars.length){e.bars=cached.slice(-this.maxMemoryBars);e.gaps=SyndicateMarketAdapters.gaps(e.bars,e.tf,e.market);this.onUpdate(e,{history:true,cached:true})}await this.history(e);if(!e.alive)return;this.connect(e)}catch(error){if(!e.alive)return;this.retry(e,error.message,error.retryAfter)}}
    async loadOlder(provider,market,tf){
      const e=this.get(provider,market,tf);if(!e||!e.alive||e.loadingOlder||!e.hasMore||!e.bars.length)return false;
      e.loadingOlder=true;const before=e.bars[0].time,controller=new AbortController(),priorDetail=e.detail;e.olderAbort=controller;this.status(e,e.state,`Memuat candle sebelum ${new Date(before*1000).toLocaleDateString()}`);
      try{const json=await this.fetchJSON(e.cfg.historyUrl(before),controller.signal);if(!e.alive)return false;const page=SyndicateMarketAdapters.history(e.cfg,json,Date.now(),true).filter(b=>b.time<before);if(!page.length){e.hasMore=false;e.detail='Batas awal riwayat tercapai';this.onUpdate(e,{end:true});return false}
        const merged=SyndicateMarketAdapters.merge(page,e.bars),overflow=merged.length>this.maxMemoryBars;e.bars=overflow?merged.slice(0,this.maxMemoryBars):merged;e.historicalWindow=e.historicalWindow||overflow;const prepended=Math.max(0,e.bars.findIndex(b=>b.time===before));e.version++;e.gaps=SyndicateMarketAdapters.gaps(e.bars,e.tf,e.market);e.hasMore=page[0].time<before;e.detail=priorDetail;await this.cache.put(e.key,page);this.onUpdate(e,{history:true,older:true,prepended,gaps:e.gaps});return prepended>0
      }catch(error){if(error.name!=='AbortError'){e.detail=`Riwayat lama gagal: ${error.message}`;this.onUpdate(e,{historicalError:true})}return false}finally{e.loadingOlder=false;if(e.olderAbort===controller)e.olderAbort=null}
    }
    async restoreLatest(provider,market,tf){const e=this.get(provider,market,tf);if(!e?.historicalWindow||e.restoringLatest)return false;e.restoringLatest=true;try{const cached=await this.cache.get(e.key),combined=SyndicateMarketAdapters.merge(cached,e.liveBars||[]);if(combined.length){e.bars=combined.slice(-this.maxMemoryBars);e.historicalWindow=false;e.gaps=SyndicateMarketAdapters.gaps(e.bars,e.tf,e.market);this.onUpdate(e,{history:true,latest:true});return true}return false}finally{e.restoringLatest=false}}
    accept(e,bars){if(!e.alive||!bars.length)return;const prior=(e.liveBars?.at(-1)||e.bars.at(-1))?.time||0;if(e.historicalWindow)e.liveBars=SyndicateMarketAdapters.merge(e.liveBars||[],bars).slice(-2000);else e.bars=SyndicateMarketAdapters.merge(e.bars,bars).slice(-this.maxMemoryBars);e.version++;e.receivedAt=Date.now();e.attempt=0;if(!e.historicalWindow)e.gaps=SyndicateMarketAdapters.gaps(e.bars,e.tf,e.market);this.cache.put(e.key,bars).catch(()=>{});
      const active=e.historicalWindow?e.liveBars:e.bars,closed=active.filter(b=>b.closed),latest=closed.at(-1)?.time||0;const closedEvent=latest>e.closedTime;e.closedTime=Math.max(latest,e.closedTime);e.state='live';e.detail=e.historicalWindow?'Live aktif · melihat history lama':'WebSocket terhubung';this.onUpdate(e,{closed:closedEvent,closedBars:closed,historicalWindow:e.historicalWindow});
      if(prior&&bars.at(-1).time>prior+e.cfg.step&&Date.now()-(e.loadedAt||0)>10000)this.history(e).catch(()=>{});
    }
    connect(e){
      if(e.provider==='biquote'){this.connectSignalR(e);return}
      this.status(e,'connecting','Menghubungkan WebSocket');const ws=new WebSocket(e.cfg.ws);e.ws=ws;e.lastMessage=Date.now();
      e.connectTimeout=setTimeout(()=>{if(ws.readyState!==1)ws.close()},15000);
      ws.onopen=()=>{if(!e.alive){ws.close();return}clearTimeout(e.connectTimeout);e.lastMessage=Date.now();if(e.cfg.subscription)ws.send(JSON.stringify(e.cfg.subscription));this.status(e,'connected','Terhubung · menunggu data');e.heartbeat=setInterval(()=>{if(!e.alive||ws.readyState!==1)return;if(Date.now()-e.lastMessage>65000){ws.close();return}if(e.provider!=='binance')ws.send('ping')},20000)};
      ws.onmessage=event=>{if(!e.alive)return;e.lastMessage=Date.now();if(event.data==='pong')return;try{const json=JSON.parse(event.data);this.accept(e,SyndicateMarketAdapters.message(e.cfg,json))}catch(error){e.socketError=error.message;ws.close()}};
      ws.onerror=()=>{e.socketError='WebSocket gagal. Periksa jaringan atau akses provider.'};
      ws.onclose=()=>{clearInterval(e.heartbeat);clearTimeout(e.connectTimeout);if(e.alive)this.retry(e,e.socketError||'WebSocket terputus')};
    }
    async connectSignalR(e){
      if(!root.signalR){this.retry(e,'Klien SignalR tidak tersedia.');return}
      const connection=new signalR.HubConnectionBuilder().withUrl(e.cfg.ws,{transport:signalR.HttpTransportType.WebSockets,skipNegotiation:true,withCredentials:false}).configureLogging(signalR.LogLevel.None).build();e.hub=connection;
      connection.on('ReceiveTick',quote=>{if(!e.alive||quote.symbol!==e.cfg.symbol)return;const stamp=Date.parse(quote.timestamp);if(!Number.isFinite(stamp)||stamp<=(e.tickStamp||0))return;e.tickStamp=stamp;e.lastMessage=Date.now();e.quote=quote;const bars=SyndicateMarketAdapters.tick(e.cfg,e.bars,quote);if(bars!==e.bars)this.accept(e,bars.slice(-2));else this.onUpdate(e,{status:true})});
      connection.onclose(()=>{if(e.alive)this.retry(e,'Stream biquote terputus')});
      this.status(e,'connecting','Menghubungkan stream biquote');
      try{await connection.start();if(!e.alive){await connection.stop();return}await connection.invoke('Subscribe',[e.cfg.symbol]);e.lastMessage=Date.now();e.attempt=0;this.status(e,'connected','Terhubung · menunggu tick')}catch(error){if(e.alive)this.retry(e,error.message)}
    }
    retry(e,message,delay=0){if(!e.alive||e.retryTimer)return;clearInterval(e.heartbeat);clearTimeout(e.connectTimeout);const wait=Math.max(delay,Math.min(60000,2000*2**Math.min(e.attempt++,5)));this.status(e,'reconnecting',`${message}. Coba lagi ${Math.ceil(wait/1000)} dtk.`);e.retryTimer=setTimeout(()=>{e.retryTimer=null;if(e.hub){const h=e.hub;e.hub=null;h.onclose(()=>{});h.stop().catch(()=>{})}this.start(e)},wait)}
    close(e){e.alive=false;e.abort?.abort();e.olderAbort?.abort();clearInterval(e.heartbeat);clearTimeout(e.connectTimeout);clearTimeout(e.retryTimer);if(e.ws){e.ws.onclose=null;e.ws.close()}e.hub?.stop().catch(()=>{})}
    dispose(){for(const e of this.entries.values())this.close(e);this.entries.clear()}
  }
  root.SyndicateMarketClient=MarketClient;if(typeof module!=='undefined')module.exports=MarketClient;
})(globalThis);
