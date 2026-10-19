/* Terminal integration: live data is explicit, simulation is an opt-in source. */
(() => {
  const adapters=SyndicateMarketAdapters,originalGenerate=generate,bank=new Map();
  let source='auto',reconciling=false,renderTimer,lastKey='',context=null;
  const saved=(()=>{try{const store=JSON.parse(localStorage.getItem('syndicate.layouts.v1'));return store?.layouts?.find(e=>e.id===store.active)?.state}catch{return null}})();
  const allowed=['auto','binance','okx','bitget','biquote','simulated'];
  if(allowed.includes(saved?.marketSource))source=saved.marketSource;
  else{bank.set('simulated',structuredClone(shapes));shapes=[];selectDrawing(null)}
  if(saved?.sourceDrawings)for(const [key,value] of Object.entries(saved.sourceDrawings))if(allowed.includes(key)&&Array.isArray(value))bank.set(key,value);
  const resolve=m=>source==='auto'?(m.type==='CRYPTO'?'binance':'biquote'):source;
  const label=m=>resolve(m)==='simulated'||resolve(m)==='biquote'?m.symbol:m.symbol.replace(/USD$/,'USDT');
  const displayName=m=>resolve(m)==='simulated'||resolve(m)==='biquote'?m.name:m.name.replace('US Dollar','Tether USDT');
  const key=m=>`${resolve(m)}:${m.symbol}:${tf}`;
  const client=new SyndicateMarketClient((entry,event)=>{
    if(entry.key===key(current)){
      if(event.prepended&&chart.view){chart.view={...chart.view,start:chart.view.start+event.prepended};if(chart.drag)chart.drag.start+=event.prepended;if(chart.timeDrag)chart.timeDrag.start+=event.prepended;for(const s of shapes)if(s.market===current.symbol&&s.tf===tf)for(const p of points(s))if(!Number.isFinite(p.marketTime))p.index+=event.prepended}
      updateHistoryState(entry,event);
      if(event.history)window.dispatchEvent(new CustomEvent('syndicate:market-close',{detail:{baseline:true,provider:entry.provider,symbol:current.symbol,timeframe:tf,bars:entry.bars.filter(b=>b.closed)}}));
      if(event.closed&&!replayActive)window.dispatchEvent(new CustomEvent('syndicate:market-close',{detail:{baseline:false,provider:entry.provider,symbol:current.symbol,timeframe:tf,bars:event.closedBars}}));
    }
    if(!renderTimer)renderTimer=setTimeout(()=>{renderTimer=null;if(!replayActive)paint();else status();for(const secondary of secondaryCharts)secondary.signature='';syncSecondaryCharts();renderWatch()},120);
  });
  const api={get source(){return source},provider:resolve,display:label,displayName,client,getBars(m,t){return source==='simulated'?originalGenerate(m,t):client.get(resolve(m),m,t)?.bars||[]},getEntry(m=current,t=tf){return client.get(resolve(m),m,t)},loadOlder(m=current,t=tf){if(source==='simulated'||replayActive)return Promise.resolve(false);return client.loadOlder(resolve(m),m,t)},restoreLatest(m=current,t=tf){if(source==='simulated'||replayActive)return Promise.resolve(false);return client.restoreLatest(resolve(m),m,t)},setSource:setSource};window.MarketFeed=api;
  const controls=document.createElement('div');controls.className='market-feed-controls';controls.innerHTML='<select id="marketProvider" aria-label="Sumber data market"><option value="auto">Feed: Otomatis</option><option value="binance">Binance · Spot</option><option value="okx">OKX · Spot</option><option value="bitget">Bitget · Spot</option><option value="biquote">biquote.io · USD</option><option value="simulated">Simulasi lokal</option></select><button id="marketReconnect" title="Hubungkan ulang feed" aria-label="Hubungkan ulang feed">↻</button><span id="marketFeedStatus" role="status"></span>';
  document.querySelector('.toolbar .toolbar-symbol').after(controls);$('marketProvider').value=source;
  const error=document.createElement('div');error.id='marketFeedEmpty';error.hidden=true;error.setAttribute('role','status');document.querySelector('.chart-wrap').append(error);
  const historyState=document.createElement('div');historyState.id='historyState';historyState.hidden=true;historyState.setAttribute('role','status');historyState.setAttribute('aria-live','polite');document.querySelector('.chart-wrap').append(historyState);
  const style=document.createElement('style');style.textContent=`.market-feed-controls{display:none!important}#marketFeedEmpty{position:absolute;top:40%;left:12px;right:80px;padding:15px;text-align:center;color:#c4c8d0;background:#202026;border:1px solid #424652;border-radius:5px;z-index:5;font-size:12px;line-height:1.7}#marketFeedEmpty[hidden]{display:none}#historyState{display:none!important}.toolbar button:disabled{cursor:not-allowed}.sidefoot{font-size:10px}`;document.head.append(style);
  function updateHistoryState(entry,event={}){if(event.end){historyState.dataset.state='end';historyState.textContent='Beginning of available history';historyState.hidden=false}else if(event.historicalError){historyState.dataset.state='error';historyState.textContent='Historical data unavailable';historyState.hidden=false}else if(event.older){historyState.hidden=true}else if(entry.loadingOlder){historyState.dataset.state='loading';historyState.textContent='Loading historical candles…';historyState.hidden=false}}
  function points(shape){return [...new Set([shape.a,shape.b,...(shape.points||[])])].filter(Boolean)}
  function tagDrawings(){if(!context?.bars?.length)return;for(const s of shapes)if(s.market===context.symbol&&s.tf===context.tf)for(const p of points(s)){const i=Math.floor(p.index),bar=context.bars[i];if(bar)p.marketTime=bar.time+(p.index-i)*interval(context.tf)}}
  function alignDrawings(bars){if(!bars.length)return;const times=new Map(bars.map((b,i)=>[b.time,i]));for(const s of shapes)if(s.market===current.symbol&&s.tf===tf)for(const p of points(s))if(Number.isFinite(p.marketTime)){const base=Math.floor(p.marketTime/interval(tf))*interval(tf);let i=times.get(base);if(i===undefined){i=bars.findLastIndex(b=>b.time<=p.marketTime);if(i<0)continue}p.index=i+(p.marketTime-bars[i].time)/interval(tf)}}
  function requests(){if(source==='simulated')return [];const list=[{provider:resolve(current),market:current,tf}];for(const e of secondaryCharts){const m=markets.find(m=>m.symbol===(syncSymbols?current.symbol:e.state.symbol))||current;list.push({provider:resolve(m),market:m,tf:syncIntervals?tf:e.state.tf})}return list}
  function reconcile(){if(reconciling)return;reconciling=true;try{client.reconcile(requests())}finally{reconciling=false}}
  const originalClamp=chart.clampView.bind(chart);chart.clampView=(start,count)=>{originalClamp(start,count);const entry=api.getEntry(),edge=Math.max(20,count*.25);if(start<=edge&&entry?.hasMore!==false){chart.liveFollow=false;api.loadOlder()}else if(entry?.historicalWindow&&start+count>=entry.bars.length-edge)api.restoreLatest()};
  function status(){
    const provider=resolve(current),entry=api.getEntry(),name=adapters.providers[provider]?.name||'Simulasi',bars=replayActive?replaySeries:seriesData;
    let text=provider==='simulated'?'SIMULASI LOKAL':entry?.detail||'Memuat data';let state=entry?.state||'loading';
    if(replayActive)text=`REPLAY · ${name}`;
    else if(entry?.quote?.marketState==='closed')text='MARKET TUTUP · harga terakhir';
    else if(entry?.quote?.stale)text='DATA TERLAMBAT · harga terakhir';
    else if(entry?.receivedAt&&Date.now()-entry.receivedAt>90000)text='Menunggu pembaruan · data terakhir';
    if(provider==='simulated')state='demo';
    $('marketFeedStatus').dataset.state=state;$('marketFeedStatus').title=text;$('marketFeedStatus').setAttribute('aria-label',text);controls.title=text;
    $('marketTitle').textContent=`${label(current)} · ${tf} · ${name.toUpperCase()}`;$('symbolBtn').textContent=label(current);$('watermarkSymbol').textContent=label(current)+', '+tf;$('watermarkName').textContent=displayName(current);
    $('marketSub').textContent=`${current.type} · ${text}`;
    const badge=document.querySelector('.status .demo');if(badge){badge.textContent=provider==='simulated'?'SIMULATED DATA':name.toUpperCase();badge.title=text}
    const currency=document.querySelector('.currency');if(currency){const quote=['simulated','biquote'].includes(provider)?'USD':'USDT';if(currency.tagName==='SELECT'){currency.replaceChildren(new Option(quote,quote))}else currency.textContent=quote}
    $('replayBtn').disabled=!bars.length;
    for(const id of ['toolbarAlertBtn','createPriceAlert'])if($(id))$(id).disabled=!bars.length;
    document.querySelectorAll('[data-tf]').forEach(b=>{const enabled=provider==='simulated'||!!adapters.providers[provider]?.frames[b.dataset.tf];b.disabled=!enabled;b.title=enabled?b.dataset.tf:`Tidak tersedia pada ${name}`});
    error.hidden=!!bars.length||provider==='simulated';error.textContent=entry?.detail||'Memuat riwayat market…';
    document.querySelector('.feed-dot').style.background=state==='live'?'#70b7a3':state==='demo'?'#999':'#c5a16b';
    if(entry?.quote?.marketState==='closed')$('priceChange').textContent='MARKET TUTUP';
  }
  function paint(){
    if(source==='simulated'){status();return}if(replayActive){status();return}const bars=api.getBars(current,tf),nextKey=key(current),changed=nextKey!==lastKey;
    if(changed){lastKey=nextKey;historyState.hidden=true;chart.viewportInitialized=false;chart.liveFollow=true;chart.scaleSettings.auto=true;delete chart.scaleSettings.manualRange}
    seriesData=bars;if(!bars.length){chart.series.forEach(s=>s.setData([]));$('lastPrice').textContent='—';$('priceChange').textContent='';for(const id of ['mOpen','mHigh','mLow','mClose','mVol'])$(id).textContent='—';context=null;status();return}
    alignDrawings(bars);context={bars,symbol:current.symbol,tf};candles.applyOptions({priceFormat:{precision:current.base<2?5:2}});applySeriesToChart(bars);const last=bars.at(-1),previous=bars.at(-2)||last;metrics(last);$('lastPrice').textContent=fmt(last.close);const change=(last.close/previous.close-1)*100;$('priceChange').textContent=`${change>=0?'+':''}${change.toFixed(2)}% · BAR`;$('priceChange').style.color=change>=0?'#5ac8a5':'#ed797b';status();redrawShapes();
  }
  const priorLoad=load;load=function(){tagDrawings();const nextKey=key(current);if(nextKey!==lastKey){lastKey=nextKey;historyState.hidden=true;chart.viewportInitialized=false;chart.liveFollow=true;chart.scaleSettings.auto=true;delete chart.scaleSettings.manualRange}reconcile();priorLoad();paint();status()};
  const priorSync=syncSecondaryCharts;syncSecondaryCharts=function(){reconcile();priorSync();for(const e of secondaryCharts){const m=markets.find(m=>m.symbol===e.state.symbol)||current,provider=resolve(m);for(const opt of e.symbolSelect.options){const market=markets.find(x=>x.symbol===opt.value);opt.textContent=label(market||current)}for(const opt of e.tfSelect.options)opt.disabled=provider!=='simulated'&&!adapters.providers[provider]?.frames[opt.value];const entry=api.getEntry(m,e.state.tf);e.symbolSelect.parentElement.querySelector('small').textContent=provider==='simulated'?'Simulasi':`${adapters.providers[provider]?.name} · ${entry?.state||'loading'}`}};
  renderWatch=function(){const q=$('search').value.toLowerCase();$('watch').replaceChildren();for(const m of markets.filter(m=>(m.symbol+' '+label(m)+' '+m.name).toLowerCase().includes(q))){const bars=api.getBars(m,tf),last=bars.at(-1),entry=api.getEntry(m,tf),row=document.createElement('div');row.className='asset'+(m.symbol===current.symbol?' active':'');row.tabIndex=0;row.setAttribute('role','button');const left=document.createElement('div'),symbol=document.createElement('b'),provider=document.createElement('small');symbol.textContent=label(m);provider.textContent=adapters.providers[resolve(m)]?.name||'Simulasi';left.append(symbol,provider);const right=document.createElement('div');right.className='right';const price=document.createElement('b');price.textContent=last?last.close.toLocaleString('en-US',{maximumFractionDigits:m.base<2?5:2}):'—';const meta=document.createElement('small');meta.textContent=entry?.quote?.marketState==='closed'?'Market tutup':last?'Bar terakhir':'Pilih untuk memuat';right.append(price,meta);row.append(left,right);row.onclick=()=>chooseSymbol(m);row.onkeydown=e=>{if(e.key==='Enter')row.click()};$('watch').append(row)}};
  const priorSearch=renderSymbolSearch;renderSymbolSearch=function(){priorSearch();[...$('symbolResults').children].forEach((row,i)=>{const m=symbolMatches[i];if(!m)return;row.querySelector('.symbol-code').textContent=label(m);row.querySelector('.symbol-description').textContent=displayName(m);row.querySelector('.symbol-provider').textContent=adapters.providers[resolve(m)]?.name||'SIMULASI'});symbolDialog.querySelector('footer').textContent='Sumber dapat dipilih di toolbar. Exchange crypto memakai USDT; biquote memakai simbol USD.'};
  document.querySelector('.sidefoot').textContent='Harga berasal dari sumber yang dipilih. Baris belum dimuat ditandai —. Tidak ada transaksi order.';
  function setSource(next){if(!allowed.includes(next))return;tagDrawings();bank.set(source,structuredClone(shapes));if(replayActive)stopReplay();source=next;$('marketProvider').value=source;shapes=structuredClone(bank.get(source)||[]);selectDrawing(null);context=null;lastKey='';client.dispose();for(const e of secondaryCharts)e.signature='';load();renderWatch();captureWorkspaceChange()}
  $('marketProvider').onchange=e=>setSource(e.target.value);$('marketReconnect').onclick=()=>{client.dispose();reconcile();paint()};
  const capture=captureWorkspace;captureWorkspace=function(){tagDrawings();const sourceDrawings=Object.fromEntries(bank);sourceDrawings[source]=structuredClone(shapes);return {...capture(),marketSource:source,sourceDrawings}};
  const restore=restoreWorkspace;restoreWorkspace=function(state){client.dispose();source=allowed.includes(state.marketSource)?state.marketSource:'simulated';$('marketProvider').value=source;context=null;lastKey='';bank.clear();for(const [k,v] of Object.entries(state.sourceDrawings||{}))if(allowed.includes(k)&&Array.isArray(v))bank.set(k,v);restore(state);reconcile();paint()};
  setInterval(status,1000);window.addEventListener('beforeunload',()=>client.dispose());window.addEventListener('online',()=>{client.dispose();reconcile()});
  window.addEventListener('syndicate:market-close',event=>{const d=event.detail;if(d.baseline||replayActive)return;checkPriceAlerts(d.bars,{live:true})});
  const createAlert=$('createPriceAlert').onclick;$('createPriceAlert').onclick=()=>{createAlert();$('alertMarketLabel').textContent=`${label(current)} · ${tf} · ${adapters.providers[resolve(current)]?.name||'Simulasi'}`};
  load();renderWatch();workspaceHistory=[captureWorkspace()];workspaceHistoryIndex=0;updateWorkspaceButtons();
})();
