// Indicator legend and per-indicator settings for the financial chart.
(() => {
  const defaults={ema20:{period:20,color:'#d8b879',width:1},ema50:{period:50,color:'#8e9fcd',width:1},sma20:{period:20,color:'#6fb3d2',width:1},volume:{up:'#285b4f',down:'#65383e'}};
  let preferences=structuredClone(defaults),hiddenVolume=false,editing;
  const legend=document.createElement('div');legend.id='indicatorLegend';legend.setAttribute('aria-label','Indikator aktif');
  let legendCollapsed=false;
  const legendRows=document.createElement('div');legendRows.id='indicatorLegendRows';
  const legendToggle=document.createElement('button');legendToggle.id='indicatorLegendToggle';legendToggle.type='button';legendToggle.setAttribute('aria-controls',legendRows.id);
  legendToggle.onclick=()=>{legendCollapsed=!legendCollapsed;syncLegendToggle()};
  function syncLegendToggle(){
    const count=legendRows.children.length;
    legendRows.hidden=legendCollapsed;
    legendToggle.hidden=count===0;
    legendToggle.setAttribute('aria-expanded',String(!legendCollapsed));
    legendToggle.title=legendCollapsed?`Tampilkan ${count} indikator`:'Sembunyikan daftar indikator';
    legendToggle.setAttribute('aria-label',legendToggle.title);
    legendToggle.innerHTML=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${legendCollapsed?'m4 6 4 4 4-4':'m4 10 4-4 4 4'}"/></svg>${legendCollapsed?`<span>${count}</span>`:''}`;
  }
  legend.append(legendRows,legendToggle);
  document.querySelector('.charttop').append(legend);
  const css=document.createElement('style');css.textContent=`
    #indicatorLegend{pointer-events:auto;display:flex;flex-direction:column;align-items:flex-start;gap:2px;margin-top:6px;max-width:100%}
    #indicatorLegendRows{display:flex;flex-direction:column;align-items:flex-start;gap:2px;max-width:100%}#indicatorLegendRows[hidden],#indicatorLegendToggle[hidden]{display:none}
    #indicatorLegendToggle{display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:26px;height:21px;padding:2px 5px;margin-top:3px;border:1px solid #39393f;border-radius:3px;background:#141417b8;color:#bdbdc7;font-size:10px}
    #indicatorLegendToggle:hover{background:#2b2b32;color:#fff}#indicatorLegendToggle:focus-visible{outline:2px solid #789cf3;outline-offset:2px}#indicatorLegendToggle svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
    .indicator-legend-row{display:flex;align-items:center;background:#151518b8;border:1px solid transparent;border-radius:3px;max-width:100%;height:24px;font-size:11px}
    .indicator-legend-row:hover,.indicator-legend-row:focus-within{border-color:#4d6396;background:#1c1c22}.indicator-legend-row.is-hidden .indicator-name{opacity:.45}
    .indicator-legend-row button{padding:3px 5px;height:23px;display:inline-flex;align-items:center;justify-content:center}.indicator-legend-row .indicator-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;min-width:65px;text-align:left}
    .indicator-legend-row svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
    #indicatorSettings{width:410px}#indicatorSettings label{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:20px 0;font-size:12px}#indicatorSettings input{width:120px}#indicatorSettings input[type=color]{width:44px;height:34px;padding:3px}#indicatorSettings nav{display:flex;gap:18px;border-bottom:1px solid #45454d}#indicatorSettings nav button{padding:9px 0;border-radius:0}#indicatorSettings nav button.active{border-bottom:3px solid #ddd;background:none}#indicatorSettings [hidden]{display:none}#indicatorSettings .settings-note{line-height:1.6;color:#999;font-size:11px}
  `;document.head.append(css);
  const dialog=document.createElement('dialog');dialog.id='indicatorSettings';dialog.className='workspace-dialog';dialog.setAttribute('aria-labelledby','indicatorSettingsTitle');
  dialog.innerHTML=`<form><header><h2 id="indicatorSettingsTitle"></h2><button type="button" id="closeIndicatorSettings" aria-label="Tutup">×</button></header><nav><button type="button" data-ind-tab="input">Input</button><button type="button" data-ind-tab="style">Corak</button></nav><section data-ind-panel="input"><label id="indicatorPeriodRow">Periode<input id="indicatorPeriod" type="number" min="1" max="500" step="1" required></label><p class="settings-note" id="indicatorInputNote"></p></section><section data-ind-panel="style" hidden><div id="indicatorLineStyle"><label>Warna garis<input type="color" id="indicatorColor"></label><label>Ketebalan (px)<input id="indicatorWidth" type="number" min="1" max="5" step="1" required></label></div><div id="indicatorVolumeStyle"><label>Volume naik<input type="color" id="indicatorUp"></label><label>Volume turun<input type="color" id="indicatorDown"></label></div></section><footer><button type="button" id="indicatorDefaults">Bawaan</button><button type="button" id="cancelIndicatorSettings">Batal</button><button type="submit">Ok</button></footer></form>`;
  document.body.append(dialog);
  const option=id=>[...$('indicators').options].find(o=>o.value===id);
  const enabled=id=>id==='volume'?volOn:option(id).selected;
  const name=id=>id==='volume'?'Volume':`${id.startsWith('ema')?'EMA':'SMA'} ${preferences[id].period}`;
  const paths={eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',gear:'<path d="m7 3-5 9 5 9h10l5-9-5-9Z"/><circle cx="12" cy="12" r="4"/>',trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>'};
  function renderLegend(){
    legendRows.replaceChildren();
    for(const id of Object.keys(defaults)){
      if(!enabled(id)&&!(id==='volume'?hiddenVolume:hiddenTreeIndicators.has(id)))continue;
      const row=document.createElement('div');row.className='indicator-legend-row';row.dataset.indicator=id;row.classList.toggle('is-hidden',!enabled(id));
      const label=document.createElement('button');label.className='indicator-name';label.textContent=name(id);label.title='Pengaturan · '+name(id);label.onclick=()=>openSettings(id);row.append(label);
      for(const [action,title,icon] of [['visibility',enabled(id)?'Sembunyikan':'Tampilkan','eye'],['settings','Pengaturan','gear'],['delete','Hapus','trash']]){
        const b=document.createElement('button');b.dataset.action=action;b.title=`${title} ${name(id)}`;b.setAttribute('aria-label',b.title);b.innerHTML=`<svg viewBox="0 0 24 24">${paths[icon]}${action==='visibility'&&!enabled(id)?'<path d="m3 3 18 18"/>':''}</svg>`;
        b.onclick=()=>{if(action==='settings'){openSettings(id);return}const on=enabled(id),next=action==='visibility'?!on:false;if(id==='volume'){volOn=next;hiddenVolume=action==='visibility'&&on;$('volBtn').classList.toggle('active',volOn)}else{option(id).selected=next;if(action==='visibility'&&on)hiddenTreeIndicators.add(id);else hiddenTreeIndicators.delete(id)}refreshChart();renderIndicatorPicker();renderObjectTree();captureWorkspaceChange()};row.append(b);
      }legendRows.append(row);
    }
    syncLegendToggle();
  }
  function tab(which){dialog.querySelectorAll('[data-ind-tab]').forEach(b=>b.classList.toggle('active',b.dataset.indTab===which));dialog.querySelectorAll('[data-ind-panel]').forEach(p=>p.hidden=p.dataset.indPanel!==which)}
  function fill(config){$('indicatorPeriod').value=config.period||20;$('indicatorColor').value=config.color||'#d8b879';$('indicatorWidth').value=config.width||1;$('indicatorUp').value=config.up||defaults.volume.up;$('indicatorDown').value=config.down||defaults.volume.down}
  function openSettings(id){editing=id;$('indicatorSettingsTitle').textContent=name(id);fill(preferences[id]);$('indicatorPeriodRow').hidden=id==='volume';$('indicatorLineStyle').hidden=id==='volume';$('indicatorVolumeStyle').hidden=id!=='volume';$('indicatorInputNote').textContent=id==='volume'?'Volume per bar dari data simulasi. Warna naik dan turun dapat diatur pada tab Corak.':'Perhitungan menggunakan harga penutupan setiap bar. Periode 1–500 bar.';tab('input');dialog.showModal()}
  dialog.querySelectorAll('[data-ind-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.indTab));
  for(const id of ['closeIndicatorSettings','cancelIndicatorSettings'])$(id).onclick=()=>dialog.close();
  $('indicatorDefaults').onclick=()=>fill(defaults[editing]);dialog.addEventListener('keydown',e=>e.stopPropagation());
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();preferences[editing]=editing==='volume'?{up:$('indicatorUp').value,down:$('indicatorDown').value}:{period:Number($('indicatorPeriod').value),color:$('indicatorColor').value,width:Number($('indicatorWidth').value)};refreshChart();captureWorkspaceChange();dialog.close()};
  function applyTo(data,lines,vol){
    for(const id of ['ema20','ema50','sma20']){const s=lines[id],c=preferences[id];if(!s)continue;s.applyOptions({color:c.color,lineWidth:c.width});s.setData(enabled(id)?(id.startsWith('ema')?ema(data,c.period):sma(data,c.period)):[])}
    vol?.setData(volOn?data.map(d=>({time:d.time,value:d.volume,color:d.close>=d.open?preferences.volume.up:preferences.volume.down})):[]);
  }
  function update(){applyTo(candles.data,{ema20,ema50,sma20},volume);for(const e of secondaryCharts)applyTo(e.price.data,{ema20:e.emaA,ema50:e.emaB,sma20:e.smaA},e.vol);if(volOn)hiddenVolume=false;renderLegend()}
  const oldLoad=load;load=function(){oldLoad();update()};
  const oldApply=applySeriesToChart;applySeriesToChart=function(data){oldApply(data);update()};
  const oldSync=syncSecondaryCharts;syncSecondaryCharts=function(){oldSync();update()};
  const oldCapture=captureWorkspace;captureWorkspace=function(){return {...oldCapture(),indicatorPreferences:structuredClone(preferences),hiddenIndicators:[...hiddenTreeIndicators],hiddenVolume}};
  const oldRestore=restoreWorkspace;restoreWorkspace=function(state){preferences=structuredClone(defaults);for(const id of Object.keys(defaults)){const c=state.indicatorPreferences?.[id];if(c){for(const key of Object.keys(defaults[id])){const value=c[key];if(['color','up','down'].includes(key)?/^#[0-9a-f]{6}$/i.test(value):Number.isInteger(value)&&value>=1&&value<=(key==='period'?500:5))preferences[id][key]=value}}}oldRestore(state);hiddenTreeIndicators.clear();for(const id of state.hiddenIndicators||[])if(option(id)&&!option(id).selected)hiddenTreeIndicators.add(id);hiddenVolume=!!state.hiddenVolume&&!volOn;update()};
  // The workspace was restored before this extension loaded; recover its additional fields.
  try{const saved=JSON.parse(localStorage.getItem('syndicate.layouts.v1'));const entry=saved?.layouts?.find(l=>l.id===saved.active);if(entry?.state?.indicatorPreferences)restoreWorkspace(entry.state)}catch{}
  update();
  workspaceHistory=[captureWorkspace()];workspaceHistoryIndex=0;updateWorkspaceButtons();
})();
