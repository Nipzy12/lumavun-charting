/* Adapter between the pure engine and the terminal's local VibeTradingChart API. */
(() => {
  const active=new Map(),series=new Map(),events=[],seen=new Set(),baselines=new Map(),liveBaselines=new Map();
  let draft=null,listener=()=>{},updating=false;
  function recordCopy(record){if(!record||record.version!==1||typeof record.id!=='string'||!record.id||typeof record.name!=='string'||!record.name.trim()||record.name.length>80)throw Error('Identitas indikator tidak valid.');const v=SyndicateEngine.validate(record.graph);if(!v.ok)throw Error(v.errors.join('\n'));return structuredClone(record)}
  function data(){return replayActive&&!selectingBar?replaySeries.slice(0,replayIndex):seriesData}
  function notifyAlert(entry,output,index,bars,scope,feed=window.MarketFeed?.provider(current)||'simulated'){
    const bar=bars[index],key=`${scope}:${output.id}:${bar.time}`;if(seen.has(key)||!output.values[index])return;seen.add(key);
    const event={version:1,type:'indicator.alert',id:key,indicatorId:entry.record.id,indicatorName:entry.record.name,nodeId:output.id,symbol:window.MarketFeed?.display(current)||current.symbol,timeframe:tf,barTime:bar.time,close:bar.close,message:output.message,source:feed,createdAt:new Date().toISOString()};
    events.push(event);if(events.length>200)events.shift();
    alertToast.textContent=`${event.indicatorName}: ${event.message}`;alertToast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>alertToast.hidden=true,8000);
    window.dispatchEvent(new CustomEvent('syndicate:indicator-alert',{detail:structuredClone(event)}));
  }
  function update(closed=false){
    if(updating)return;updating=true;
    try{
      const bars=data(),desired=new Set(),markers=[];
      if(!bars?.length){for(const s of series.values())chart.removeSeries(s);series.clear();chart.setStudioMarkers([]);return}
      const entries=[...active.values()].filter(e=>e.visible&&e.record.id!==draft?.id).map(e=>e.record);if(draft)entries.push(draft);
      for(const record of entries){
        const result=SyndicateEngine.execute(record.graph,bars);
        for(const plot of result.plots){const key=record.id+':'+plot.id;desired.add(key);let s=series.get(key);if(!s){s=chart.addLineSeries({});series.set(key,s)}s.applyOptions({color:plot.color,lineWidth:plot.width,pane:plot.pane});s.setData(plot.data)}
        markers.push(...result.markers);
      }
      for(const [key,s] of series)if(!desired.has(key)){chart.removeSeries(s);series.delete(key)}
      chart.setStudioMarkers(markers);
      for(const entry of active.values()){
        const scope=`${entry.record.id}:${window.MarketFeed?.provider(current)||'simulated'}:${current.symbol}:${tf}`,last=bars.at(-1).time,previous=baselines.get(scope);
        if(closed&&entry.alerts&&previous!==undefined&&last>previous){const result=SyndicateEngine.execute(entry.record.graph,bars);for(let i=0;i<bars.length;i++)if(bars[i].time>previous)for(const output of result.alerts)notifyAlert(entry,output,i,bars,scope)}
        baselines.set(scope,last);
      }
      renderAlerts();listener();
    }finally{updating=false}
  }
  function commit(){update();const provider=window.MarketFeed?.provider(current),last=window.MarketFeed?.getEntry()?.bars.filter(b=>b.closed).at(-1)?.time;if(provider&&last)for(const entry of active.values())liveBaselines.set(`${entry.record.id}:${provider}:${current.symbol}:${tf}`,last);captureWorkspaceChange()}
  const api={
    preview(record){draft=record?recordCopy(record):null;update()},
    attach(record){const copy=recordCopy(record),prior=active.get(copy.id);if(!prior&&active.size>=12)throw Error('Maksimum 12 indikator Studio aktif.');active.set(copy.id,{record:copy,visible:true,alerts:prior?.alerts??true});draft=null;commit()},
    remove(id){active.delete(id);if(draft?.id===id)draft=null;commit()},
    toggle(id){const e=active.get(id);if(e){e.visible=!e.visible;commit()}},
    toggleAlerts(id){const e=active.get(id);if(e){e.alerts=!e.alerts;commit()}},
    list:()=>structuredClone([...active.values()]),events:()=>structuredClone(events),onChange(fn){listener=fn},update,
    snapshot:()=>structuredClone([...active.values()]),
    restore(entries){active.clear();draft=null;for(const e of (entries||[]).slice(0,12)){try{active.set(e.record.id,{record:recordCopy(e.record),visible:e.visible!==false,alerts:e.alerts!==false})}catch{}}update()}
  };
  const oldAlerts=renderAlerts;renderAlerts=function(){oldAlerts();const badge=$('alertCount'),total=priceAlerts.filter(a=>a.fired&&a.notifications?.app).length+events.length;badge.hidden=!total;badge.textContent=total;if(rightPanel!=='alerts')return;const list=$('workspacePanelContent');if(active.size||events.length){list.querySelector('.empty-panel')?.remove();const heading=document.createElement('div');heading.className='panel-caption';heading.textContent='INDICATOR STUDIO · BAR CLOSE · LOKAL';list.append(heading)}for(const entry of active.values()){const count=entry.record.graph.nodes.filter(n=>n.type==='Alert').length;if(!count)continue;const card=document.createElement('article');card.className='alert-card';const name=document.createElement('strong');name.textContent=entry.record.name;const button=document.createElement('button');button.textContent=entry.alerts?'Jeda':'Aktifkan';button.onclick=()=>api.toggleAlerts(entry.record.id);const note=document.createElement('p');note.textContent=`${count} kondisi · ${entry.alerts?'Menunggu penutupan bar':'Dijeda'}`;card.append(name,button,note);list.append(card)}for(const event of events.slice(-20).reverse()){const card=document.createElement('article');card.className='alert-card';const title=document.createElement('strong');title.textContent=event.indicatorName;const message=document.createElement('p');message.textContent=event.message;const detail=document.createElement('p');detail.textContent=`${event.symbol} · ${event.timeframe} · ${new Date(event.barTime*1000).toLocaleString('id-ID')}`;card.append(title,message,detail);list.append(card)}};
  const oldLoad=load;load=function(){oldLoad();update(false)};
  const oldApply=applySeriesToChart;applySeriesToChart=function(bars){oldApply(bars);update(replayActive&&!selectingBar)};
  const capture=captureWorkspace;captureWorkspace=function(){return {...capture(),studioIndicators:api.snapshot()}};
  const restore=restoreWorkspace;restoreWorkspace=function(state){api.restore([]);restore(state);api.restore(state.studioIndicators)};
  window.SyndicatePreview=api;
  window.addEventListener('syndicate:market-close',event=>{const {bars,provider,symbol,timeframe,baseline}=event.detail;if(replayActive||!bars.length)return;for(const entry of active.values()){const scope=`${entry.record.id}:${provider}:${symbol}:${timeframe}`,previous=liveBaselines.get(scope);liveBaselines.set(scope,bars.at(-1).time);if(baseline||!entry.alerts)continue;const result=SyndicateEngine.execute(entry.record.graph,bars);for(let i=0;i<bars.length;i++)if(bars[i].time>(previous??bars.at(-2)?.time??0))for(const output of result.alerts)notifyAlert(entry,output,i,bars,scope,provider)}renderAlerts()});
  try{const stored=JSON.parse(localStorage.getItem('syndicate.layouts.v1'));const state=stored?.layouts?.find(e=>e.id===stored.active)?.state;api.restore(state?.studioIndicators)}catch{}
  workspaceHistory=[captureWorkspace()];workspaceHistoryIndex=0;updateWorkspaceButtons();
})();
