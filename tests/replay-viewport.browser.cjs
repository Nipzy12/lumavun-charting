const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:850}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>localStorage.setItem('syndicate.layouts.v1',JSON.stringify({version:1,active:'replay',layouts:[{id:'replay',name:'Replay QA',state:{symbol:'BTCUSD',tf:'15m',style:'hollow',indicators:[],volume:false,shapes:[],appearance:{},scale:{},grid:'single',secondary:[],marketSource:'simulated'}}]})));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>MarketFeed.source==='simulated'&&chart.geometry&&candles.data.length>300);
    await page.evaluate(()=>{chart.clampView(chart.view.start-35,chart.view.count);chart.scaleSettings.auto=false;chart.scaleSettings.manualRange=[chart.priceRange[0]-10,chart.priceRange[1]+15];chart.schedule()});await page.waitForTimeout(100);
    const before=await page.evaluate(()=>({view:{...chart.view},scale:structuredClone(chart.scaleSettings),follow:chart.liveFollow,rightOffset:chart.rightOffset,length:candles.data.length}));
    await page.locator('#replayBtn').click();await page.waitForTimeout(100);
    const selecting=await page.evaluate(()=>({view:{...chart.view},scale:structuredClone(chart.scaleSettings),length:candles.data.length,selectingBar}));
    assert.deepEqual(selecting.view,before.view);assert.deepEqual(selecting.scale,before.scale);assert.equal(selecting.length,before.length);assert.equal(selecting.selectingBar,true);
    await page.evaluate(()=>beginAt(0));await page.waitForTimeout(100);const first=await page.evaluate(()=>({count:chart.geometry.count,lastX:chart.geometry.x(0),width:chart.geometry.width,barWidth:chart.geometry.width/chart.geometry.count}));assert.equal(first.count,before.view.count);assert.ok(first.width-first.lastX>=first.barWidth*9&&first.width-first.lastX<=first.barWidth*12);
    await page.evaluate(()=>{selectingBar=true;applyReplayData(replaySeries,false)});const selectedIndex=Math.floor(before.view.start+before.view.count*.65);await page.evaluate(index=>beginAt(index),selectedIndex);await page.waitForTimeout(100);
    const begun=await page.evaluate(()=>({view:{...chart.view},length:candles.data.length,lastX:chart.geometry.x(candles.data.length-1),width:chart.geometry.width,barWidth:chart.geometry.width/chart.geometry.count,follow:chart.liveFollow,scale:structuredClone(chart.scaleSettings)}));
    assert.equal(begun.view.count,before.view.count);assert.equal(begun.length,selectedIndex+1);assert.equal(begun.follow,true);assert.deepEqual(begun.scale,before.scale);assert.ok(begun.width-begun.lastX>=begun.barWidth*9&&begun.width-begun.lastX<=begun.barWidth*12);
    const replayStart=begun.view.start;await page.locator('#replayNext').click();await page.waitForTimeout(100);const followed=await page.evaluate(()=>({view:{...chart.view},length:candles.data.length}));assert.equal(followed.length,begun.length+1);assert.equal(followed.view.count,before.view.count);assert.ok(followed.view.start>replayStart);
    await page.evaluate(()=>chart.clampView(chart.view.start-25,chart.view.count));const free=await page.evaluate(()=>({view:{...chart.view},follow:chart.liveFollow}));assert.equal(free.follow,false);await page.locator('#replayNext').click();await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>chart.view),free.view);
    await page.evaluate(()=>pauseReplay());assert.deepEqual(await page.evaluate(()=>chart.view),free.view);
    await page.evaluate(()=>stopReplay());await page.waitForTimeout(150);const stopped=await page.evaluate(()=>({view:{...chart.view},scale:structuredClone(chart.scaleSettings),follow:chart.liveFollow,rightOffset:chart.rightOffset,length:candles.data.length}));
    assert.deepEqual(stopped.view,before.view);assert.deepEqual(stopped.scale,before.scale);assert.equal(stopped.follow,before.follow);assert.equal(stopped.rightOffset,before.rightOffset);assert.equal(stopped.length,before.length);
    assert.deepEqual(errors,[]);console.log('PASS: replay activation, start, playback, free pan, pause and stop preserve viewport and price scale.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
