// Local drawing and price-scale tools for VibeCharts.
const toolCSS=document.createElement('style');toolCSS.textContent=`
.scale-gear{position:absolute;right:18px;bottom:0;z-index:6;width:28px;height:27px;background:#202024}.scale-gear svg{width:17px;height:17px}.scale-menu{position:fixed;z-index:20;width:270px;max-height:calc(100dvh - 65px);overflow:auto;padding:5px;background:#222225;border:1px solid #414146;border-radius:5px;box-shadow:0 10px 35px #0008}.scale-menu[hidden]{display:none}.scale-menu button{display:flex;gap:10px;width:100%;text-align:left;padding:10px 9px;align-items:center}.scale-menu button span:first-child{width:15px}.scale-menu hr{border:0;border-top:1px solid #414145;margin:4px 0}.scale-menu p{padding:0 10px;color:#96969f;font-size:10px;line-height:1.5}.rail:not(.right){overflow-y:auto;scrollbar-width:none}.rail:not(.right) .icon{flex-shrink:0}.drawing-text{position:absolute;top:110px;left:12px;z-index:7;background:#25252a;padding:8px;border:1px solid #555;border-radius:4px;max-width:calc(100% - 90px)}.drawing-text[hidden]{display:none}.drawing-text input{width:150px;max-width:100%;color:#eee;background:#18181b;border:1px solid #555;padding:6px}.drawing-text small{display:block;margin-top:5px;color:#b4b4c0}.tool-note{font-size:10px;color:#aaa}
@media(max-width:1100px){.toolbar{overflow-x:auto;scrollbar-width:none}.toolbar>*{flex-shrink:0}}
`;document.head.append(toolCSS);
const scaleButton=document.createElement('button');scaleButton.id='scaleSettingsBtn';scaleButton.className='scale-gear';scaleButton.title='Pengaturan skala harga';scaleButton.setAttribute('aria-label','Pengaturan skala harga');scaleButton.setAttribute('aria-expanded','false');scaleButton.innerHTML='<svg><use href="#gear"/></svg>';document.querySelector('.chart-wrap').append(scaleButton);
const scaleMenu=document.createElement('div');scaleMenu.id='scaleMenu';scaleMenu.className='scale-menu';scaleMenu.hidden=true;scaleMenu.setAttribute('role','menu');document.body.append(scaleMenu);
const scaleDefaults={mode:'regular',auto:true,invert:false,priceOnly:false,grid:true,label:true,priceLine:true,rightOffset:10,maxFutureWhitespace:300};chart.scaleSettings={...scaleDefaults};chart.rightOffset=scaleDefaults.rightOffset;chart.maxFutureWhitespace=scaleDefaults.maxFutureWhitespace;
function scaleRow(label,action,checked,id){const b=document.createElement('button');b.id=id;b.setAttribute('role',checked===undefined?'menuitem':'menuitemcheckbox');if(checked!==undefined)b.setAttribute('aria-checked',checked);b.innerHTML=`<span>${checked?'✓':''}</span><span>${label}</span>`;b.onclick=()=>{action();chart.schedule();renderScaleMenu()};scaleMenu.append(b)}
function renderScaleMenu(){const s=chart.scaleSettings;scaleMenu.replaceChildren();
 scaleRow('Reset skala harga',()=>{chart.scaleSettings={...scaleDefaults};chart.rightOffset=scaleDefaults.rightOffset;chart.maxFutureWhitespace=scaleDefaults.maxFutureWhitespace;chart.schedule()},undefined,'scaleReset');
 scaleRow('Auto · Paskan data pada layar',()=>{s.auto=s.auto===false;if(s.auto)delete s.manualRange;else s.manualRange=[...(chart.priceRange||[0,1])]},s.auto!==false,'scaleAuto');
 scaleRow('Skalakan harga saja',()=>s.priceOnly=!s.priceOnly,s.priceOnly,'scalePriceOnly');
 scaleRow('Inversikan skala',()=>s.invert=!s.invert,s.invert,'scaleInvert');
 scaleMenu.insertAdjacentHTML('beforeend','<hr>');
 for(const [mode,label] of [['regular','Reguler'],['percent','Persen'],['indexed','Diindeks ke 100'],['log','Logaritma']])scaleRow(label,()=>s.mode=mode,s.mode===mode,'scale-'+mode);
 scaleMenu.insertAdjacentHTML('beforeend','<hr>');
 for(const [key,label] of [['label','Label harga terakhir'],['priceLine','Garis harga terakhir'],['grid','Garis grid']])scaleRow(label,()=>s[key]=!s[key],s[key],'scale-'+key);
 scaleRow('Pengaturan lainnya…',()=>{closeScale();$('settingsBtn').click()},undefined,'scaleMore');
 scaleMenu.insertAdjacentHTML('beforeend','<p>Persen dan indeks dihitung dari penutupan bar pertama dalam data aktif.</p>');
}
function closeScale(){scaleMenu.hidden=true;scaleButton.setAttribute('aria-expanded','false')}
scaleButton.onclick=()=>{const opening=scaleMenu.hidden;renderScaleMenu();scaleMenu.hidden=!opening;scaleButton.setAttribute('aria-expanded',opening);if(opening){const r=scaleButton.getBoundingClientRect();scaleMenu.style.left=Math.max(8,Math.min(innerWidth-278,r.right-270))+'px';scaleMenu.style.top=Math.max(48,r.top-scaleMenu.offsetHeight-5)+'px'}};
document.addEventListener('pointerdown',e=>{if(!scaleMenu.contains(e.target)&&!scaleButton.contains(e.target))closeScale()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeScale();draft=null;drawing=false;redrawShapes()}});
const rail=document.querySelector('.rail:not(.right)');let magnet=false,locked=false,draft=null;
const icons={horizontal:'M3 12h18',vertical:'M12 3v18',arrow:'M4 20 20 4M11 4h9v9',fib:'M4 4h16M4 9h12M4 14h16M4 20h12M5 3v18',brush:'M4 18c8 2 1-14 9-12s-3 15 7 12',text:'M5 4h14M12 4v16M8 20h8',measure:'m3 17 14-14 4 4L7 21zM7 13l3 3m1-7 3 3',longPosition:'M4 12h16M7 9l-3 3 3 3M17 5v14',shortPosition:'M4 12h16M17 9l3 3-3 3M7 5v14',magnet:'M5 4v10a7 7 0 0 0 14 0V4h-4v10a3 3 0 0 1-6 0V4z',lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4',undo:'M9 5 3 11l6 6M3 11h12a5 5 0 0 1 0 10',zoom:'M10 5v10M5 10h10m1 6 6 6M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'};
function addTool(id,label,path,click){const b=document.createElement('button');b.id=id;b.className='icon';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=`<svg viewBox="0 0 24 24"><path d="${path}"/></svg>`;b.onclick=click;rail.insertBefore(b,$('hideDraw'));return b}
for(const [tool,label] of [['horizontal','Garis horizontal'],['vertical','Garis vertikal'],['arrow','Panah'],['fib','Fibonacci retracement'],['brush','Kuas'],['text','Teks'],['measure','Penggaris'],['longPosition','Long Position'],['shortPosition','Short Position']]){
 const option=new Option(label,tool);$('drawTool').append(option);addTool(tool+'Tool',label,icons[tool],()=>activateTool(tool));
}
addTool('zoomTool','Perbesar chart',icons.zoom,()=>{const g=chart.geometry;chart.clampView(g.start+g.count*.15,g.count*.7)});
addTool('magnetTool','Magnet: snap ke OHLC',icons.magnet,()=>{magnet=!magnet;$('magnetTool').classList.toggle('active',magnet);$('magnetTool').setAttribute('aria-pressed',magnet)});
addTool('lockTool','Kunci alat gambar',icons.lock,()=>{locked=!locked;$('lockTool').classList.toggle('active',locked);$('lockTool').setAttribute('aria-pressed',locked);if(locked)$('cursorBtn').click();$('clearDraw').disabled=locked;$('undoTool').disabled=locked});
addTool('undoTool','Batalkan gambar terakhir',icons.undo,()=>{if(locked)return;const i=shapes.findLastIndex(s=>s.market===current.symbol&&s.tf===tf);if(i>=0)shapes.splice(i,1);redrawShapes()});
const textBox=document.createElement('div');textBox.className='drawing-text';textBox.hidden=true;textBox.innerHTML='<input id="drawingText" aria-label="Teks anotasi" maxlength="100" value="Catatan"><small>Ketik teks, lalu klik posisi di chart.</small>';document.querySelector('.chart-wrap').append(textBox);
function activateTool(tool){if(locked||selectingBar)return;$('drawTool').value=tool;drawEnabled=true;drawCanvas.hidden=false;drawCanvas.style.pointerEvents='auto';$('hideDraw').classList.remove('active');rail.querySelectorAll('button').forEach(b=>{if(!['magnetTool','lockTool'].includes(b.id))b.classList.remove('active')});$(tool==='line'?'lineBtn':tool==='rect'?'rectBtn':tool+'Tool')?.classList.add('active');updateDrawingMode();textBox.hidden=tool!=='text';if(tool==='text')$('drawingText').focus()}
const cursorAction=$('cursorBtn').onclick;$('cursorBtn').onclick=()=>{cursorAction();textBox.hidden=true;draft=null;drawing=false;rail.querySelectorAll('button').forEach(b=>{if(!['magnetTool','lockTool'].includes(b.id))b.classList.remove('active')});$('cursorBtn').classList.add('active');updateDrawingMode();redrawShapes()};
$('lineBtn').onclick=()=>activateTool('line');$('rectBtn').onclick=()=>activateTool('rect');$('drawTool').onchange=()=>activateTool($('drawTool').value);
let keepDrawing=false;
const pencil=$('drawBtn');
const modeCSS=document.createElement('style');modeCSS.textContent='#drawBtn{position:relative}#drawBtn .mode-lock{position:absolute;right:0;bottom:1px;width:12px;height:12px;background:#242428;border-radius:2px;stroke-width:2}';document.head.append(modeCSS);
function updateDrawingMode(){
 pencil.title=keepDrawing?'Matikan tetap menggambar':'Aktifkan tetap menggambar';
 pencil.setAttribute('aria-label','Tetap menggambar');pencil.setAttribute('aria-pressed',keepDrawing);
 pencil.classList.toggle('active',keepDrawing);
 pencil.querySelector('.mode-lock')?.remove();if(keepDrawing)pencil.insertAdjacentHTML('beforeend','<svg class="mode-lock" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4"/></svg>');
}
pencil.onclick=()=>{keepDrawing=!keepDrawing;if(keepDrawing)activateTool($('drawTool').value);updateDrawingMode()};
updateDrawingMode();
$('clearDraw').onclick=()=>{if(!locked){shapes=shapes.filter(s=>s.market!==current.symbol||s.tf!==tf);redrawShapes();window.captureWorkspaceChange?.()}};
function coordinate(e){const g=chart.geometry;let index=g.start+e.offsetX/g.width*g.count-.5,price=g.priceAtY(e.offsetY);if(magnet){index=Math.max(0,Math.min(candles.data.length-1,Math.round(index)));const d=candles.data[index];price=[d.open,d.high,d.low,d.close].sort((a,b)=>Math.abs(g.y(a)-e.offsetY)-Math.abs(g.y(b)-e.offsetY))[0]}return {index,price}}
function project(point){return {x:chart.geometry.x(point.index),y:chart.geometry.y(point.price)}}
function fibonacciLevels(shape){return shape.fibLevels??[0,.236,.382,.5,.618,.786,1].map(value=>({value,label:String(value),visible:true}))}
function isPositionShape(shape){return shape.type==='longPosition'||shape.type==='shortPosition'}
function positionValues(shape){return{entry:shape.a.price,stop:shape.stopPrice,target:shape.targetPrice??shape.b.price}}
function normalizePosition(shape){
 const entry=shape.a.price,span=Math.max(Math.abs(entry)*1e-8,1e-8);shape.targetPrice=Number.isFinite(shape.targetPrice)?shape.targetPrice:shape.b.price;shape.stopPrice=Number.isFinite(shape.stopPrice)?shape.stopPrice:(shape.type==='longPosition'?entry-Math.abs(shape.targetPrice-entry)/2:entry+Math.abs(shape.targetPrice-entry)/2);
 if(shape.type==='longPosition'){shape.targetPrice=Math.max(entry+span,shape.targetPrice);shape.stopPrice=Math.min(entry-span,shape.stopPrice)}else{shape.targetPrice=Math.min(entry-span,shape.targetPrice);shape.stopPrice=Math.max(entry+span,shape.stopPrice)}shape.b.price=shape.targetPrice;return shape;
}
function initializePosition(shape,point){const entry=shape.a.price,difference=Math.max(Math.abs(point.price-entry),Math.abs(entry)*.002,1e-8),targetSide=shape.type==='longPosition'?point.price>entry:point.price<entry;if(targetSide){shape.targetPrice=point.price;shape.stopPrice=shape.type==='longPosition'?entry-difference/2:entry+difference/2}else{shape.stopPrice=point.price;shape.targetPrice=shape.type==='longPosition'?entry+difference*2:entry-difference*2}normalizePosition(shape)}
window.renderDrawings=()=>{
 drawCtx.clearRect(0,0,drawCanvas.width,drawCanvas.height);if(!chart.geometry)return;
 const c=drawCtx,g=chart.geometry;c.save();c.beginPath();c.rect(0,0,g.width,g.height);c.clip();c.strokeStyle='#b4c9ea';c.fillStyle='#b4c9ea';c.lineWidth=1.5;c.font='12px Segoe UI';
 const segment=(a,b)=>{c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke()};
 for(const s of [...shapes,...(draft?[draft]:[])]){if(s.hidden||s.market!==current.symbol||s.tf!==tf)continue;const a=project(s.a),b=project(s.b);c.globalAlpha=s.opacity??1;c.font='12px Segoe UI';c.strokeStyle=s.color||'#b4c9ea';c.fillStyle=s.color||'#b4c9ea';c.lineWidth=s.width||1.5;c.setLineDash(s.dash==='dashed'?[7,5]:s.dash==='dotted'?[2,4]:[]);
  if(isPositionShape(s)){normalizePosition(s);const {entry,stop,target}=positionValues(s),entryY=g.y(entry),stopY=g.y(stop),targetY=g.y(target),left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),width=Math.max(1,right-left),risk=Math.abs(entry-stop),reward=Math.abs(target-entry),ratio=risk?reward/risk:0,percent=(price)=>(Math.abs(price-entry)/entry*100).toFixed(2)+'%';c.save();c.globalAlpha*=.24;c.fillStyle='#29a37a';c.fillRect(left,Math.min(entryY,targetY),width,Math.abs(targetY-entryY));c.fillStyle='#d95763';c.fillRect(left,Math.min(entryY,stopY),width,Math.abs(stopY-entryY));c.restore();for(const [price,color] of [[target,'#43c89a'],[entry,'#d5d9e2'],[stop,'#ef6f79']]){c.strokeStyle=color;c.setLineDash(price===entry?[]:[5,4]);segment({x:left,y:g.y(price)},{x:right,y:g.y(price)})}c.setLineDash([]);c.font='11px Segoe UI';const labels=[[target,`TP ${fmt(target)}  +${percent(target)}`,'#43c89a'],[entry,`Entry ${fmt(entry)}  R:R 1:${ratio.toFixed(2)}`,'#e0e3ea'],[stop,`SL ${fmt(stop)}  -${percent(stop)}`,'#ef7d86']];for(const [price,label,color] of labels){const py=g.y(price),tw=c.measureText(label).width+10,tx=Math.max(0,Math.min(g.width-tw,right+5));c.fillStyle='#1d2026e8';c.fillRect(tx,py-9,tw,18);c.fillStyle=color;c.fillText(label,tx+5,py+1)}}
  else if(s.type==='rect'){if(s.fill){c.save();c.globalAlpha*=.2;c.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);c.restore()}c.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y)}
  else if(s.type==='ellipse'){c.beginPath();c.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.abs(b.x-a.x)/2,Math.abs(b.y-a.y)/2,0,0,Math.PI*2);c.stroke()}
  else if(s.type==='ray'||s.type==='extended'){const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)<.01)segment({x:a.x,y:s.type==='extended'?0:a.y},{x:a.x,y:dy>=0?g.height:0});else{const left=s.type==='extended'?0:a.x,right=s.type==='extended'||dx>=0?g.width:0;segment({x:left,y:a.y+(left-a.x)*dy/dx},{x:right,y:a.y+(right-a.x)*dy/dx})}}
  else if(s.type==='crossline'){segment({x:0,y:a.y},{x:g.width,y:a.y});segment({x:a.x,y:0},{x:a.x,y:g.height})}
  else if(s.type==='horizontal')segment({x:0,y:a.y},{x:g.width,y:a.y});
  else if(s.type==='vertical')segment({x:a.x,y:0},{x:a.x,y:g.height});
  else if(s.type==='text'){c.fillStyle=s.textColor||s.color||'#b4c9ea';c.font=`${s.textBold?'bold ':''}${s.textSize||12}px Segoe UI`;c.fillText(s.text,a.x,a.y)}
  else if(s.type==='brush'){c.beginPath();s.points.forEach((p,i)=>{const q=project(p);if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y)});c.stroke()}
  else if(s.type==='fib'){for(const level of fibonacciLevels(s)){if(level.visible===false)continue;const price=s.a.price+(s.b.price-s.a.price)*level.value,py=g.y(price);segment({x:a.x,y:py},{x:b.x,y:py});const label=s.fibShowLabels===false?'':(level.label||String(level.value)),priceText=s.fibShowPrices===false?'':`(${fmt(price)})`;c.fillText([label,priceText].filter(Boolean).join(' '),Math.min(a.x,b.x)+4,py-4)}}
  else{segment(a,b);if(s.type==='arrow'){const angle=Math.atan2(b.y-a.y,b.x-a.x);for(const offset of [-.5,.5])segment(b,{x:b.x-12*Math.cos(angle+offset),y:b.y-12*Math.sin(angle+offset)})}if(s.type==='measure'){const delta=s.b.price-s.a.price,label=`${delta>=0?'+':''}${fmt(delta)} (${(delta/s.a.price*100).toFixed(2)}%) · ${Math.abs(Math.round(s.b.index-s.a.index))} bar`;c.fillText(label,Math.max(5,Math.min(a.x,g.width-c.measureText(label).width-5)),Math.max(16,Math.min(a.y,b.y)-10))}}
  if(s.type!=='text'&&s.annotation){c.fillStyle=s.textColor||s.color||'#b4c9ea';c.font=`${s.textBold?'bold ':''}${s.textSize||12}px Segoe UI`;c.textAlign=s.textAlign||'center';const tx=c.textAlign==='left'?a.x:c.textAlign==='right'?b.x:(a.x+b.x)/2;c.fillText(s.annotation,tx,(a.y+b.y)/2-9);c.textAlign='left'}
 }c.restore();window.renderDrawingEditor?.();
};chart.onRender=redrawShapes;
function finishDrawing(point){if(!draft)return;draft.b=point;if(draft.type==='brush')draft.points.push(point);if(isPositionShape(draft))initializePosition(draft,point);const completed=draft;shapes.push(completed);draft=null;drawing=false;redrawShapes();if(!keepDrawing)$('cursorBtn').click();window.selectDrawing?.(completed);window.captureWorkspaceChange?.()}
drawCanvas.addEventListener('pointerdown',e=>{if(e.button!==0||!drawEnabled||locked||!chart.geometry||e.offsetX<0||e.offsetY<0||e.offsetX>=chart.geometry.width||e.offsetY>=chart.geometry.height)return;const point=coordinate(e);if(drawing&&draft){finishDrawing(point);return}window.selectDrawing?.(null);drawing=true;draft={type:$('drawTool').value,a:point,b:point,points:[point],text:$('drawingText').value||'Catatan',market:current.symbol,tf};if(draft.type==='text')finishDrawing(point);else redrawShapes()});
drawCanvas.addEventListener('pointermove',e=>{window.updateDrawingGuide?.(e);if(!drawing||!draft){redrawShapes();return}draft.b=coordinate(e);if(draft.type==='brush')draft.points.push(draft.b);if(isPositionShape(draft))initializePosition(draft,draft.b);redrawShapes()});
drawCanvas.addEventListener('pointercancel',()=>{draft=null;drawing=false;redrawShapes()});
chart.schedule();
