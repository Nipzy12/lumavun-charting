const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      localStorage.setItem('syndicate.layouts.v1',JSON.stringify({version:1,active:'test',layouts:[{id:'test',name:'Feed test',state:{symbol:'BTCUSD',tf:'1m',style:'hollow',indicators:[],volume:false,shapes:[],appearance:{},scale:{},grid:'single',secondary:[],marketSource:'binance'}}]}));
      window.feedSockets=[];window.feedFailure=false;window.feedHistoryCalls=0;
      const now=Math.floor(Date.now()/60000)*60000;
      window.feedRows=Array.from({length:30},(_,i)=>[String(now-(29-i)*60000),String(100+i),'150','90',String(101+i),'2',String(now-(29-i)*60000+59999),'0',i===29?'0':'1']);
      const realFetch=fetch;window.fetch=async(url,options)=>{
        if(!/binance\.vision|okx\.com|bitget\.com|biquote\.io/.test(String(url)))return realFetch(url,options);
        if(window.feedFailure)return new Response('{}',{status:503});
        let bars=window.feedRows;if(String(url).includes('endTime=')){const end=Number(new URL(String(url)).searchParams.get('endTime')),last=Math.floor(end/60000)*60000,call=window.feedHistoryCalls++;bars=call<3?Array.from({length:5},(_,i)=>{const stamp=last-(4-i)*60000;return [String(stamp),String(90-call*5+i),'150','80',String(91-call*5+i),'2',String(stamp+59999),'0','1']}):[];await new Promise(resolve=>setTimeout(resolve,100))}
        let data=String(url).includes('binance')?bars:String(url).includes('okx')?{code:'0',data:[...bars].reverse()}:String(url).includes('bitget')?{code:'00000',data:bars}:String(url).includes('/ohlc')?{bars:bars.map((r,i)=>({openTime:new Date(Number(r[0])).toISOString(),open:Number(r[1]),high:150,low:90,close:Number(r[4]),volume:0,tickVolume:40,isOpen:i===29}))}:{symbol:'XAUUSD',mid:130,timestamp:new Date(now).toISOString(),marketState:'open',stale:false};
        return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
      };
      class Socket extends EventTarget{
        static OPEN=1;static CONNECTING=0;static CLOSED=3;static CLOSING=2;
        constructor(url){super();this.url=url;this.readyState=0;window.feedSockets.push(this);setTimeout(()=>{if(this.readyState===3)return;this.readyState=1;this.onopen?.(new Event('open'));this.dispatchEvent(new Event('open'))},5)}
        send(text){this.sent=text;if(String(this.url).includes('/hubs/tick')){for(const part of text.split('\u001e').filter(Boolean)){const m=JSON.parse(part);if(m.protocol)setTimeout(()=>this.raw('{}\u001e'),0);if(m.invocationId)setTimeout(()=>this.raw(JSON.stringify({type:3,invocationId:m.invocationId})+'\u001e'),0)}}}
        raw(data){this.onmessage?.({data});this.dispatchEvent(new MessageEvent('message',{data}))}
        message(value){this.raw(JSON.stringify(value))}
        close(){if(this.readyState===3)return;this.readyState=3;this.onclose?.({code:1000,reason:'test',wasClean:true});this.dispatchEvent(new Event('close'))}
      }window.WebSocket=Socket;
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../syndicate-trade.html')).href,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>seriesData.length===30&&MarketFeed.getEntry()?.state==='connected');
    assert.match(await page.locator('#marketTitle').innerText(),/BTCUSDT.*BINANCE/);
    await page.evaluate(()=>chart.clampView(0,15));assert.match(await page.locator('#historyState').innerText(),/Loading historical/);await page.waitForFunction(()=>seriesData.length===35);assert.equal(await page.evaluate(()=>chart.view.start),5);
    const oldestPage1=await page.evaluate(()=>seriesData[0].time);await page.evaluate(()=>chart.clampView(0,20));await page.waitForFunction(()=>seriesData.length===40);assert.equal(await page.evaluate(()=>chart.view.start),5);assert.equal(await page.evaluate(()=>seriesData[5].time),oldestPage1);
    const oldestPage2=await page.evaluate(()=>seriesData[0].time);await page.evaluate(()=>chart.clampView(0,20));await page.waitForFunction(()=>seriesData.length===45);assert.equal(await page.evaluate(()=>seriesData[5].time),oldestPage2);
    await page.evaluate(()=>chart.clampView(0,20));await page.waitForFunction(()=>MarketFeed.getEntry()?.hasMore===false);assert.match(await page.locator('#historyState').innerText(),/Beginning of available history/);const emptyCalls=await page.evaluate(()=>feedHistoryCalls);await page.evaluate(()=>{chart.clampView(0,20);chart.clampView(0,20)});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>feedHistoryCalls),emptyCalls);
    await page.evaluate(()=>{gridMode='columns';syncSymbols=false;secondaryStates=[{symbol:'ETHUSD',tf:'1m'}];buildGrid()});await page.waitForFunction(()=>secondaryCharts[0]?.price.data.length===30&&MarketFeed.client.entries.size===2);
    await page.evaluate(()=>{gridMode='single';buildGrid()});await page.waitForFunction(()=>MarketFeed.client.entries.size===1);
    await page.evaluate(()=>{chart.clampView(5,15);const s=feedSockets.filter(s=>s.readyState===1).at(-1),t=Number(feedRows.at(-1)[0]);s.message({s:'BTCUSDT',k:{i:'1m',t,o:'129',h:'150',l:'90',c:'131',v:'4',x:false}})});
    await page.waitForFunction(()=>MarketFeed.getEntry()?.bars.at(-1)?.close===131);await page.waitForTimeout(300);
    await page.waitForFunction(()=>seriesData.at(-1)?.close===131);
    assert.equal(await page.evaluate(()=>seriesData.length),45);assert.equal(await page.evaluate(()=>seriesData.at(-1).close),131);assert.equal(await page.evaluate(()=>chart.view.count),20);
    await page.evaluate(()=>priceAlerts.push({id:999,name:'Live price QA',symbol:current.symbol,tf,provider:'binance',conditions:[{source:'price',operation:'greater',target:'value',value:0}],frequency:'every',expiry:null,notifications:{app:true,toast:false,sound:false,schedule:'always'},enabled:true,fired:false,events:[],time:seriesData.at(-2).time,wasTrue:false}));
    await page.evaluate(()=>{const n=SyndicateNodes.create,c=n('Close','c'),g=n('Greater','g');g.params.threshold=0;const a=n('Alert','a');a.params.transition=false;SyndicatePreview.attach({id:'feed-alert',name:'Feed alert',version:1,graph:{version:1,nodes:[c,g,a],edges:[{id:'e',from:'c',to:'g',input:'a'},{id:'f',from:'g',to:'a',input:'condition'}]}});const t=Number(feedRows.at(-1)[0]);feedSockets.filter(s=>s.readyState===1).at(-1).message({s:'BTCUSDT',k:{i:'1m',t,o:'129',h:'150',l:'90',c:'131',v:'4',x:true}})});
    assert.equal(await page.evaluate(()=>SyndicatePreview.events().length),1);
    assert.equal(await page.evaluate(()=>priceAlerts.find(a=>a.id===999).events.length),1);
    await page.evaluate(()=>{const t=Number(feedRows.at(-1)[0]);feedSockets.filter(s=>s.readyState===1).at(-1).message({s:'BTCUSDT',k:{i:'1m',t,o:'129',h:'150',l:'90',c:'131',v:'4',x:true}})});assert.equal(await page.evaluate(()=>SyndicatePreview.events().length),1);
    await page.locator('#marketProvider').selectOption('okx');await page.waitForFunction(()=>MarketFeed.getEntry()?.state==='connected');assert.match(await page.locator('#marketTitle').innerText(),/OKX/);assert.equal(await page.evaluate(()=>feedSockets.filter(s=>s.readyState===1).length),1);
    await page.evaluate(()=>{feedSockets.filter(s=>s.readyState===1).at(-1).message({arg:{channel:'candle1m',instId:'BTC-USDT'},data:[[...feedRows.at(-1).slice(0,4),'133','3','0','0','0']]})});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>seriesData.at(-1).close),133);
    await page.locator('#marketProvider').selectOption('bitget');await page.waitForFunction(()=>MarketFeed.getEntry()?.state==='connected');assert.equal(await page.locator('[data-tf="2H"]').isDisabled(),true);
    await page.evaluate(()=>feedSockets.filter(s=>s.readyState===1).at(-1).message({arg:{topic:'kline',symbol:'BTCUSDT',interval:'1m'},data:[{start:feedRows.at(-1)[0],open:'129',high:'150',low:'90',close:'134',volume:'5'}]}));await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>seriesData.at(-1).close),134);
    await page.evaluate(()=>{current=markets[4];MarketFeed.setSource('biquote')});await page.waitForFunction(()=>MarketFeed.getEntry()?.state==='connected');
    await page.evaluate(()=>feedSockets.filter(s=>s.readyState===1).at(-1).raw(JSON.stringify({type:1,target:'ReceiveTick',arguments:[{symbol:'XAUUSD',mid:140,timestamp:new Date(Number(feedRows.at(-1)[0])+3000).toISOString(),marketState:'open',stale:false}]})+'\u001e'));await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>seriesData.at(-1).close),140);
    await page.locator('#replayBtn').click();await page.evaluate(()=>beginAt(10));const replayClose=await page.evaluate(()=>candles.data.at(-1).close);await page.evaluate(()=>feedSockets.filter(s=>s.readyState===1).at(-1).raw(JSON.stringify({type:1,target:'ReceiveTick',arguments:[{symbol:'XAUUSD',mid:142,timestamp:new Date(Number(feedRows.at(-1)[0])+4000).toISOString(),marketState:'open',stale:false}]})+'\u001e'));await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>candles.data.at(-1).close),replayClose);await page.locator('#replayClose').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>seriesData.at(-1).close),142);
    await page.evaluate(()=>{window.feedFailure=true;current=markets[0];MarketFeed.setSource('binance')});await page.waitForFunction(()=>MarketFeed.getEntry()?.state==='reconnecting'&&seriesData.length>0);assert.equal(await page.locator('#marketFeedEmpty').isVisible(),false);assert.match(await page.locator('#marketTitle').innerText(),/BINANCE/);
    await page.locator('#marketProvider').selectOption('simulated');assert.ok(await page.evaluate(()=>seriesData.length>0));assert.equal(await page.evaluate(()=>feedSockets.filter(s=>s.readyState===1).length),0);
    for(const width of [1366,768,390]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.locator('#marketProvider').scrollIntoViewIfNeeded();assert.ok(await page.locator('#marketProvider').isVisible())}
    assert.deepEqual(errors,[]);console.log('PASS: historical prepend/cache recovery, all four REST/WS formats, real-time merge, live close alert, replay isolation, unsubscribe, unsupported intervals and failure without simulated fallback.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
