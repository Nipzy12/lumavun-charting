// Chart style and bar replay controls for the local VibeCharts extension.
const controlsCSS=document.createElement('style');
controlsCSS.textContent=`
.chart-menu{position:fixed;top:46px;left:320px;width:245px;max-height:70dvh;overflow:auto;background:#202022;border:1px solid #414145;box-shadow:0 12px 35px #0008;padding:5px;z-index:15;border-radius:5px}
.chart-menu button{width:100%;display:flex;justify-content:space-between;padding:11px;text-align:left}.chart-menu button.active{background:#ededee;color:#18181a}.chart-menu small{display:block;padding:10px;color:#98989e;line-height:1.5;border-top:1px solid #38383b}
.replay-panel{border-top:1px solid #343438;background:#1b1b1e;padding:7px 12px;display:flex;align-items:center;gap:9px;min-height:48px;flex-wrap:wrap}.replay-panel[hidden],.chart-menu[hidden]{display:none}.replay-panel button,.replay-panel select,.replay-panel input{padding:7px;background:#27272b;border:1px solid #3b3b40;color:#d5d5dc;border-radius:4px}.replay-panel button:disabled{opacity:.35}.replay-panel label{font-size:11px;color:#a0a0a8}.replay-panel output{font-size:11px;color:#a4b9e9}.replay-panel .replay-message{flex:1;min-width:120px;font-size:11px;color:#aaaab5}#chartStyleBtn{white-space:nowrap}#styleName{max-width:100px;overflow:hidden;text-overflow:ellipsis}@media(max-width:760px){#styleName{display:none}.chart-menu{left:45px!important;max-width:calc(100vw - 80px)}.replay-panel{gap:5px;padding:6px}.replay-panel input{max-width:170px}.replay-panel .replay-message{flex-basis:100%}}
`;
document.head.append(controlsCSS);
const styleMenu=document.createElement('div');styleMenu.className='chart-menu';styleMenu.id='chartStyleMenu';styleMenu.hidden=true;styleMenu.setAttribute('role','menu');
for(const option of $('candleType').options){
 const button=document.createElement('button');button.dataset.style=option.value;button.setAttribute('role','menuitemradio');button.innerHTML=`<span>${option.textContent}</span><span class="check"></span>`;
 button.onclick=()=>{$('candleType').value=option.value;refreshChart();syncStyle();closeStyles()};styleMenu.append(button);
}
styleMenu.insertAdjacentHTML('beforeend','<small>Tipe yang tersedia di terminal ini. Renko, jejak volume, dan profil volume belum didukung.</small>');document.body.append(styleMenu);
function closeStyles(){styleMenu.hidden=true;$('chartStyleBtn').setAttribute('aria-expanded','false')}
function syncStyle(){const type=$('candleType').value;$('styleName').textContent=$('candleType').selectedOptions[0].textContent;styleMenu.querySelectorAll('button[data-style]').forEach(b=>{const selected=b.dataset.style===type;b.classList.toggle('active',selected);b.setAttribute('aria-checked',selected);b.querySelector('.check').textContent=selected?'✓':''})}
$('chartStyleBtn').onclick=()=>{styleMenu.hidden=!styleMenu.hidden;styleMenu.style.left=Math.max(8,Math.min(innerWidth-255,$('chartStyleBtn').getBoundingClientRect().left))+'px';$('chartStyleBtn').setAttribute('aria-expanded',!styleMenu.hidden);if(!styleMenu.hidden)styleMenu.querySelector('.active')?.focus()};
document.addEventListener('pointerdown',e=>{if(!styleMenu.contains(e.target)&&!$('chartStyleBtn').contains(e.target))closeStyles()});
styleMenu.onkeydown=e=>{const buttons=[...styleMenu.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus()}};
const panel=document.createElement('section');panel.className='replay-panel';panel.id='replayPanel';panel.hidden=true;panel.setAttribute('aria-label','Bar Replay');
panel.innerHTML=`<select id="replayStart" aria-label="Pilih titik permulaan"><option value="pick">Pilih bar di chart</option><option value="date">Tanggal…</option><option value="first">Bar pertama</option><option value="random">Bar acak</option></select><input id="replayDate" type="datetime-local" aria-label="Tanggal awal replay" hidden><button id="replayDateGo" hidden>Terapkan</button><button id="replayPlay" aria-label="Play replay">▶</button><button id="replayNext" title="Maju satu bar" aria-label="Maju satu bar">▷|</button><label><select id="replaySpeed" aria-label="Kecepatan replay"><option value="2000">0.5×</option><option value="1000" selected>1×</option><option value="500">2×</option><option value="250">4×</option></select></label><output id="replayProgress"></output><span id="replayMessage" class="replay-message" role="status"></span><button id="replayClose" aria-label="Tutup replay">✕</button>`;
document.querySelector('.main').insertBefore(panel,document.querySelector('.status'));
let selectingBar=false,replayViewport=null;
function captureReplayViewport(){return{view:chart.view?{...chart.view}:null,viewportInitialized:chart.viewportInitialized,liveFollow:chart.liveFollow,rightOffset:chart.rightOffset,scaleSettings:structuredClone(chart.scaleSettings||{})}}
function restoreReplayViewport(snapshot){if(!snapshot)return;chart.rightOffset=snapshot.rightOffset;chart.scaleSettings=structuredClone(snapshot.scaleSettings);chart.viewportInitialized=snapshot.viewportInitialized;chart.view=snapshot.view?{...snapshot.view}:null;chart.liveFollow=snapshot.liveFollow;chart.schedule()}
function applyReplayData(data,follow=chart.liveFollow){chart.liveFollow=false;applySeriesToChart(data);chart.liveFollow=follow}
function pauseReplay(){clearInterval(replayTimer);replayTimer=null;$('replayPlay').textContent='▶';$('replayPlay').setAttribute('aria-label','Play replay')}
function replayStatus(){
 const finished=replayIndex>=replaySeries.length;
 $('replayProgress').textContent=selectingBar?'':`${replayIndex} / ${replaySeries.length}`;
 $('replayNext').disabled=selectingBar||finished;$('replayPlay').disabled=selectingBar||finished;
 $('replayMessage').textContent=selectingBar?'Klik bar pada chart untuk menentukan awal replay.':finished?'Replay selesai. Pilih titik awal untuk mengulang.':new Date(replaySeries[replayIndex-1].time*1000).toLocaleString('id-ID');
}
function refreshChart(){
 if(replayActive&&!selectingBar){applySeriesToChart(replaySeries.slice(0,replayIndex));updateReplayPrice()}
 else load();
 syncStyle();
}
function updateReplayPrice(){const data=candles.data,last=data.at(-1),prev=data.at(-2)||last;if(!last)return;metrics(last);const change=(last.close/prev.close-1)*100;$('lastPrice').textContent=fmt(last.close);$('priceChange').textContent=(change>=0?'+':'')+change.toFixed(2)+'% · REPLAY';$('priceChange').style.color=change>=0?'#5ac8a5':'#ed797b'}
function beginAt(index){
 pauseReplay();selectingBar=false;chart.pickBar=null;chart.canvas.style.cursor='';const selectedTime=replaySeries[Math.max(0,Math.min(replaySeries.length-1,index))]?.time;replayIndex=Math.max(1,replaySeries.findIndex(bar=>bar.time===selectedTime)+1);
 const count=chart.view?.count||replayViewport?.view?.count||chart.defaultVisibleBars+chart.rightOffset;applyReplayData(replaySeries.slice(0,replayIndex),false);chart.viewportInitialized=true;chart.view={start:chart.realtimeViewStart(replayIndex,count),count};chart.liveFollow=true;chart.schedule();updateReplayPrice();replayStatus();
}
function stepReplay(){if(selectingBar||replayIndex>=replaySeries.length)return;replayIndex++;applySeriesToChart(replaySeries.slice(0,replayIndex));updateReplayPrice();if(replayIndex===replaySeries.length)pauseReplay();replayStatus()}
function startReplay(){if(selectingBar||replayIndex>=replaySeries.length)return;pauseReplay();$('replayPlay').textContent='Ⅱ';$('replayPlay').setAttribute('aria-label','Pause replay');replayTimer=setInterval(stepReplay,Number($('replaySpeed').value))}
function selectStart(){
 pauseReplay();const method=$('replayStart').value;$('replayDate').hidden=method!=='date';$('replayDateGo').hidden=method!=='date';
 if(method==='first')beginAt(0);
 else if(method==='random')beginAt(Math.floor(Math.random()*Math.max(1,replaySeries.length-1)));
 else{selectingBar=true;applyReplayData(replaySeries,false);$('cursorBtn').click();chart.pickBar=method==='pick'?beginAt:null;chart.canvas.style.cursor=method==='pick'?'crosshair':'';replayStatus();if(method==='date')$('replayMessage').textContent='Pilih tanggal dalam rentang data yang tersedia.'}
}
function openReplay(){if(!chart||!seriesData.length)return;replayViewport=captureReplayViewport();replayActive=true;replaySeries=seriesData.slice();panel.hidden=false;$('replayBtn').classList.add('active');$('replayStart').value='pick';
 const localDate=time=>{const date=new Date(time*1000);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,16)};
 $('replayDate').min=localDate(replaySeries[0].time);$('replayDate').max=localDate(replaySeries.at(-1).time);$('replayDate').value=localDate(replaySeries[Math.floor(replaySeries.length/2)].time);selectStart();
}
function stopReplay(){pauseReplay();replayActive=false;selectingBar=false;chart.pickBar=null;chart.canvas.style.cursor='';panel.hidden=true;$('replayBtn').classList.remove('active');const snapshot=replayViewport;replayViewport=null;chart.liveFollow=false;load();restoreReplayViewport(snapshot)}
$('replayBtn').onclick=()=>replayActive?stopReplay():openReplay();$('replayClose').onclick=stopReplay;
$('replayStart').onchange=selectStart;$('replayNext').onclick=stepReplay;$('replayPlay').onclick=()=>replayTimer?pauseReplay():startReplay();
$('replaySpeed').onchange=()=>{if(replayTimer)startReplay()};
$('replayDateGo').onclick=()=>{const time=new Date($('replayDate').value).getTime()/1000;if(!Number.isFinite(time)||time<replaySeries[0].time-60||time>replaySeries.at(-1).time){$('replayMessage').textContent='Tanggal di luar rentang data yang tersedia.';return}const index=replaySeries.findIndex(d=>d.time>=time);beginAt(index)};
$('candleType').onchange=refreshChart;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeStyles();if(selectingBar)stopReplay()}});
syncStyle();
