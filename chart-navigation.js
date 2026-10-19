// Compact navigation and price-axis shortcuts.
(() => {
  const wrap=document.querySelector('.chart-wrap');
  const navigation=document.createElement('div');navigation.className='chart-navigation';navigation.setAttribute('role','group');navigation.setAttribute('aria-label','Navigasi chart');
  const actions=[['zoomOut','Perkecil','M4 8h8'],['zoomIn','Perbesar','M4 8h8M8 4v8'],['panLeft','Geser ke bar sebelumnya','m10 4-4 4 4 4'],['panRight','Geser ke bar berikutnya','m6 4 4 4-4 4'],['resetView','Reset tampilan','M4 5a5 5 0 1 1-1 5M4 2v4h4']];
  for(const [id,label,path] of actions){
    const button=document.createElement('button');button.id=id;button.title=label;button.setAttribute('aria-label',label);button.innerHTML=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`;
    button.onclick=()=>{
      const g=chart.geometry;if(!g)return;
      if(id==='resetView'){chart.scaleSettings.auto=true;delete chart.scaleSettings.manualRange;chart.timeScale().resetToLatest()}
      else if(id==='panLeft'||id==='panRight')chart.clampView(g.start+g.count*.2*(id==='panLeft'?-1:1),g.count);
      else{const length=candles.data.length,count=Math.max(Math.min(10,length),Math.min(length,g.count*(id==='zoomIn'?.8:1.25)));chart.clampView(g.start+(g.count-count)/2,count)}
      sync();
    };navigation.append(button);
  }
  const shortcuts=document.createElement('div');shortcuts.className='price-shortcuts';shortcuts.setAttribute('role','group');shortcuts.setAttribute('aria-label','Skala harga');
  for(const [id,text,title] of [['priceAuto','A','Auto · Paskan skala harga'],['priceLog','L','Skala logaritma']]){
    const button=document.createElement('button');button.id=id;button.textContent=text;button.title=title;button.setAttribute('aria-label',title);
    button.onclick=()=>{const s=chart.scaleSettings;if(id==='priceAuto'){s.auto=s.auto===false;if(s.auto)delete s.manualRange;else s.manualRange=[...(chart.priceRange||[0,1])]}else s.mode=s.mode==='log'?'regular':'log';chart.schedule();renderScaleMenu();syncSecondaryCharts();captureWorkspaceChange()};shortcuts.append(button);
  }
  const realtime=document.createElement('button');realtime.id='goRealtime';realtime.className='go-realtime';realtime.textContent='Ke realtime';realtime.title='Kembali ke candle terbaru';realtime.onclick=()=>{chart.timeScale().scrollToRealTime();window.MarketFeed?.restoreLatest();sync()};
  wrap.append(navigation,shortcuts,realtime);
  let touchHideTimer;
  function revealNearTimeAxis(event){
    const rect=wrap.getBoundingClientRect();
    const nearBottom=event.clientY>=rect.bottom-82&&event.clientY<=rect.bottom&&event.clientX>=rect.left&&event.clientX<rect.right-70;
    navigation.classList.toggle('revealed',nearBottom||navigation.contains(event.target));
    if(event.pointerType==='touch'){
      clearTimeout(touchHideTimer);
      touchHideTimer=setTimeout(()=>navigation.classList.remove('revealed'),3000);
    }
  }
  wrap.addEventListener('pointermove',revealNearTimeAxis);
  wrap.addEventListener('pointerdown',revealNearTimeAxis);
  wrap.addEventListener('pointerleave',()=>navigation.classList.remove('revealed'));
  const css=document.createElement('style');css.textContent=`
    .chart-navigation{position:absolute;bottom:34px;left:calc((100% - 70px)/2);transform:translateX(-50%);display:flex;gap:6px;z-index:7;opacity:0;pointer-events:none;transition:opacity .15s ease}
    .chart-navigation.revealed,.chart-navigation:has(:focus-visible){opacity:1;pointer-events:auto}
    .chart-navigation button{width:25px;height:25px;padding:5px;background:#29292ddd;border:1px solid #37373c;border-radius:4px;box-shadow:0 2px 5px #0005;color:#bcbcc5}
    .chart-navigation svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
    .price-shortcuts{position:absolute;right:8px;bottom:29px;display:flex;gap:3px;z-index:7}.price-shortcuts button{height:21px;min-width:19px;padding:1px 4px;font-size:10px;border:1px solid #45454c;border-radius:3px;background:#202023;color:#a6a6af}.price-shortcuts button[aria-pressed=true]{background:#dedee3;color:#202025;border-color:#dedee3}
    .go-realtime{display:none!important}
    .chart-navigation button:hover,.price-shortcuts button:hover{background:#41414a;color:#fff}.chart-navigation button:focus-visible,.price-shortcuts button:focus-visible{outline:2px solid #789cf3;outline-offset:2px}
    @media(max-width:500px){.chart-navigation{gap:4px}.chart-navigation button{width:24px;height:24px}}
  `;document.head.append(css);
  function sync(){document.getElementById('priceAuto').setAttribute('aria-pressed',chart.scaleSettings.auto!==false);document.getElementById('priceLog').setAttribute('aria-pressed',chart.scaleSettings.mode==='log');realtime.hidden=chart.liveFollow!==false}
  const schedule=chart.schedule.bind(chart);chart.schedule=()=>{sync();schedule()};
  sync();
})();
