// Set PLAYWRIGHT_MODULE and BROWSER_PATH when Playwright/Chromium are not on the default paths.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href,{waitUntil:'domcontentloaded',timeout:60000});
    await page.locator('#marketProvider').selectOption('simulated');await page.locator('#indicatorStudioBtn').click();await page.waitForTimeout(350);
    assert.match(await page.locator('#studioStatus').innerText(),/Preview/);
    const baseCount=await page.evaluate(()=>chart.series.length);
    await page.evaluate(()=>{chart.clampView(20,100)});
    await page.locator('[data-node-id=ema] header').click();await page.locator('[data-param=period]').fill('7');await page.locator('[data-param=period]').dispatchEvent('change');await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>chart.view.count),100);
    assert.equal(await page.evaluate(()=>SyndicateStudio.getRecord().graph.nodes.find(n=>n.id==='ema').params.period),7);
    await page.locator('[data-node-id=ema] [data-output]').click();await page.locator('[data-node-id=ema] [data-input=source]').click();assert.match(await page.locator('#studioStatus').innerText(),/Circular/);
    assert.equal(await page.evaluate(()=>SyndicateStudio.getRecord().graph.edges.length),2);
    await page.locator('[data-node-id=close] [data-output]').click();await page.locator('[data-node-id=ema] [data-input=source]').click();await page.waitForTimeout(200);
    await page.locator('[data-node-id=ema] header').click();await page.locator('#studioDeleteNode').click();assert.equal(await page.locator('[data-node-id=ema]').count(),0);await page.locator('#studioUndo').click();assert.equal(await page.locator('[data-node-id=ema]').count(),1);
    await page.locator('#studioRedo').click();assert.equal(await page.locator('[data-node-id=ema]').count(),0);await page.locator('#studioUndo').click();await page.waitForTimeout(200);
    const start=await page.locator('[data-node-id=ema] header').boundingBox();await page.mouse.move(start.x+30,start.y+10);await page.mouse.down();await page.mouse.move(start.x+70,start.y+40,{steps:5});await page.mouse.up();assert.notEqual(await page.evaluate(()=>SyndicateStudio.getRecord().graph.nodes[1].x),270);
    await page.locator('#studioName').fill('QA EMA');await page.locator('#studioName').dispatchEvent('change');await page.locator('#studioSave').click();assert.match(await page.locator('#studioStatus').innerText(),/tersimpan/);
    await page.locator('#studioAdd').click();assert.equal(await page.evaluate(()=>SyndicatePreview.list().length),1);
    await page.evaluate(()=>{const r=SyndicateStudio.getRecord();for(let i=0;i<8;i++)SyndicatePreview.preview(r)});assert.equal(await page.evaluate(()=>chart.series.length),baseCount);
    await page.locator('#studioReset').click();await page.locator('#studioLoad').click();await page.locator('.studio-saved-row button').filter({hasText:'QA EMA'}).click();assert.equal(await page.locator('#studioName').inputValue(),'QA EMA');
    await page.locator('#studioPreset').selectOption('rsi');await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>chart.series.some(s=>s.options.pane==='oscillator'&&s.data.length)));
    for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await page.locator('#studioFit').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);assert.ok(await page.locator('#studioAdd').isVisible());await page.screenshot({path:path.join(process.env.TEMP||'/tmp',`studio-qa-${width}.png`)});}
    await page.setViewportSize({width:1440,height:950});
    await page.evaluate(()=>{
      const n=SyndicateNodes.create;const a=n('Close','c'),b=n('Greater','gt');b.params.threshold=0;const alert=n('Alert','a');alert.params.transition=false;const buy=n('Buy','b');buy.params.transition=false;
      const graph={version:1,nodes:[a,b,alert,buy],edges:[['c','gt','a'],['gt','a','condition'],['gt','b','condition']].map(([from,to,input],i)=>({id:'q'+i,from,to,input}))};
      SyndicatePreview.attach({id:'qa-alert',version:1,name:'QA Alert',graph});SyndicateStudio.close();openReplay();beginAt(10);
    });
    await page.locator('#replayNext').click();assert.equal(await page.evaluate(()=>SyndicatePreview.events().length),1);
    await page.evaluate(()=>applySeriesToChart(replaySeries.slice(0,replayIndex)));assert.equal(await page.evaluate(()=>SyndicatePreview.events().length),1);
    await page.evaluate(()=>{beginAt(10)});await page.locator('#replayNext').click();assert.equal(await page.evaluate(()=>SyndicatePreview.events().length),1);
    assert.equal(await page.evaluate(()=>chart.studioMarkers.length),12);
    await page.locator('#alertsToggle').click();assert.ok(await page.locator('#workspacePanelContent').innerText().then(t=>t.includes('QA Alert')));await page.locator('#alertsToggle').click();
    await page.evaluate(()=>stopReplay());await page.waitForTimeout(150);
    const priorShapes=await page.evaluate(()=>shapes.length);await page.locator('#lineBtn').click();const rect=await page.locator('#drawLayer').boundingBox();await page.mouse.click(rect.x+200,rect.y+200);await page.mouse.move(rect.x+360,rect.y+260);await page.mouse.click(rect.x+360,rect.y+260);assert.equal(await page.evaluate(()=>shapes.length),priorShapes+1);
    await page.evaluate(()=>saveWorkspace(false));await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>SyndicatePreview.list().length),2);assert.equal(await page.evaluate(()=>shapes.length),priorShapes+1);
    assert.deepEqual(errors,[]);console.log('PASS: graph edits, cycle rejection, undo/redo, drag, storage, no duplicate plots, RSI pane, responsive UI, deduplicated replay alerts, markers, drawing, workspace reload.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
