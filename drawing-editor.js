// Object selection, endpoint editing and drawing guides.
let selectedDrawing=null, drawingGuide=null, objectDrag=null;
const editorStyle=document.createElement('style');editorStyle.textContent=`
.object-toolbar{position:absolute;left:12px;top:110px;z-index:8;display:flex;align-items:center;gap:5px;padding:6px;background:#202024;border:1px solid #414148;border-radius:6px;box-shadow:0 6px 22px #0007;max-width:calc(100% - 85px);flex-wrap:wrap}.object-toolbar[hidden]{display:none}.object-toolbar button,.object-toolbar select{height:30px;padding:4px 7px;background:#29292f}.object-toolbar input[type=color]{width:31px;height:29px;border:0;background:transparent;padding:2px;cursor:pointer}.object-toolbar input[type=text]{width:120px;min-width:50px;max-width:100%;padding:6px;background:#29292f;border:1px solid #474750;color:#eee}.object-toolbar svg{width:18px;height:18px}.object-toolbar .object-name{font-size:10px;color:#a4a4af;margin:0 4px}.object-toolbar [hidden]{display:none}.object-toolbar :disabled{opacity:.4}.object-toolbar button.active{color:#8bb5ff}.object-toolbar label{display:flex;align-items:center}.object-toolbar input:focus-visible{outline:2px solid #7ba2e8}
`;document.head.append(editorStyle);
const objectToolbar=document.createElement('div');objectToolbar.id='objectToolbar';objectToolbar.className='object-toolbar';objectToolbar.hidden=true;objectToolbar.setAttribute('role','toolbar');objectToolbar.setAttribute('aria-label','Pengaturan objek');
objectToolbar.innerHTML='<span class="object-name">Objek</span><input id="objectColor" type="color" value="#b4c9ea" title="Warna objek" aria-label="Warna objek"><select id="objectWidth" aria-label="Ketebalan garis" title="Ketebalan garis"><option value="1">1 px</option><option value="1.5">1.5 px</option><option value="2">2 px</option><option value="3">3 px</option><option value="4">4 px</option><option value="6">6 px</option></select><select id="objectDash" aria-label="Gaya garis" title="Gaya garis"><option value="solid">Solid</option><option value="dashed">Putus-putus</option><option value="dotted">Titik</option></select><input id="objectText" type="text" maxlength="100" aria-label="Teks objek" hidden><button id="objectLock" title="Kunci objek" aria-label="Kunci objek"><svg viewBox="0 0 24 24"><path d="M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4"/></svg></button><button id="objectDelete" title="Hapus objek" aria-label="Hapus objek"><svg><use href="#trash"/></svg></button><button id="objectClose" title="Tutup pengaturan objek" aria-label="Tutup pengaturan objek">✕</button>';
document.querySelector('.chart-wrap').append(objectToolbar);
const toolbarGrip=document.createElement('button');toolbarGrip.id='objectToolbarGrip';toolbarGrip.type='button';toolbarGrip.title='Geser toolbar (atau gunakan tombol panah)';toolbarGrip.setAttribute('aria-label','Pindahkan toolbar objek');toolbarGrip.textContent='⠿';toolbarGrip.style.cssText='cursor:grab;touch-action:none;user-select:none;font-size:20px;padding:0 5px;flex-shrink:0';objectToolbar.prepend(toolbarGrip);
let toolbarDrag=null;
function positionObjectToolbar(left,top){const parent=objectToolbar.parentElement;objectToolbar.style.left=Math.max(0,Math.min(parent.clientWidth-objectToolbar.offsetWidth,left))+'px';objectToolbar.style.top=Math.max(0,Math.min(parent.clientHeight-objectToolbar.offsetHeight,top))+'px'}
toolbarGrip.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();toolbarGrip.setPointerCapture(e.pointerId);toolbarDrag={x:e.clientX,y:e.clientY,left:objectToolbar.offsetLeft,top:objectToolbar.offsetTop};toolbarGrip.style.cursor='grabbing'});
toolbarGrip.addEventListener('pointermove',e=>{if(toolbarDrag)positionObjectToolbar(toolbarDrag.left+e.clientX-toolbarDrag.x,toolbarDrag.top+e.clientY-toolbarDrag.y)});
for(const event of ['pointerup','pointercancel','lostpointercapture'])toolbarGrip.addEventListener(event,()=>{toolbarDrag=null;toolbarGrip.style.cursor='grab'});
toolbarGrip.addEventListener('keydown',e=>{const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(direction){e.preventDefault();const step=e.shiftKey?30:10;positionObjectToolbar(objectToolbar.offsetLeft+direction[0]*step,objectToolbar.offsetTop+direction[1]*step)}});
new ResizeObserver(()=>{if(!objectToolbar.hidden)positionObjectToolbar(objectToolbar.offsetLeft,objectToolbar.offsetTop)}).observe(objectToolbar.parentElement);
function syncObjectToolbar(){
 const s=selectedDrawing;
 objectToolbar.hidden=!s||s.hidden||drawCanvas.hidden;
 if(!s)return;
 positionObjectToolbar(objectToolbar.offsetLeft,objectToolbar.offsetTop);
 const blocked=locked||!!s.locked;
 for(const id of ['objectColor','objectWidth','objectDash','objectText','objectDelete'])$(id).disabled=blocked;
 $('objectLock').disabled=locked;$('objectLock').classList.toggle('active',!!s.locked);$('objectLock').setAttribute('aria-pressed',!!s.locked);
 $('objectLock').title=s.locked?'Buka kunci objek':'Kunci objek';
}
window.selectDrawing=s=>{
 selectedDrawing=s;objectDrag=null;
 if(s){$('objectColor').value=s.color||'#b4c9ea';$('objectWidth').value=String(s.width||1.5);$('objectDash').value=s.dash||'solid';$('objectText').hidden=s.type!=='text';$('objectText').value=s.text||'';}
 syncObjectToolbar();redrawShapes();
};
for(const [id,key,convert] of [['objectColor','color',String],['objectWidth','width',Number],['objectDash','dash',String],['objectText','text',String]]){$(id).addEventListener('input',()=>{if(!selectedDrawing||selectedDrawing.locked||locked)return;selectedDrawing[key]=convert($(id).value);redrawShapes()});$(id).addEventListener('change',()=>window.captureWorkspaceChange?.())}
$('objectLock').onclick=()=>{if(selectedDrawing&&!locked){selectedDrawing.locked=!selectedDrawing.locked;syncObjectToolbar();redrawShapes()}};
$('objectDelete').onclick=()=>{if(selectedDrawing&&!selectedDrawing.locked&&!locked){shapes=shapes.filter(s=>s!==selectedDrawing);selectDrawing(null);window.captureWorkspaceChange?.()}};
$('objectClose').onclick=()=>selectDrawing(null);
const hideObjectsAction=$('hideDraw').onclick;$('hideDraw').onclick=()=>{hideObjectsAction();redrawShapes()};
window.updateDrawingGuide=e=>{if(chart.geometry){drawingGuide=coordinate(e)}};
drawCanvas.addEventListener('pointerleave',()=>{drawingGuide=null;redrawShapes()});
window.renderDrawingEditor=()=>{
 if(!chart.geometry)return;
 if(selectedDrawing&&(!shapes.includes(selectedDrawing)||selectedDrawing.market!==current.symbol||selectedDrawing.tf!==tf))selectedDrawing=null;
 syncObjectToolbar();
 const c=drawCtx,g=chart.geometry;c.save();c.beginPath();c.rect(0,0,g.width,g.height);c.clip();
 if(drawEnabled&&drawingGuide&&!drawCanvas.hidden){
  const p=project(drawingGuide);c.strokeStyle='#a0a0ad';c.lineWidth=1;c.setLineDash([5,5]);c.beginPath();c.moveTo(p.x,0);c.lineTo(p.x,g.height);c.moveTo(0,p.y);c.lineTo(g.width,p.y);c.stroke();c.setLineDash([]);
  const label=fmt(drawingGuide.price);c.font='11px Segoe UI';const width=c.measureText(label).width+12,px=Math.max(0,Math.min(g.width-width,p.x+12)),py=Math.max(16,Math.min(g.height-4,p.y-12));c.fillStyle='#30303a';c.fillRect(px,py-14,width,19);c.fillStyle='#dddde6';c.fillText(label,px+6,py);
 }
 const active=draft||selectedDrawing;
 if(active&&!active.hidden&&!drawCanvas.hidden){
  c.setLineDash([]);c.lineWidth=2;c.strokeStyle='#438fff';c.fillStyle='#141a28';
  const handles=isPositionShape(active)?[{index:active.a.index,price:active.a.price},{index:active.b.index,price:active.a.price},{index:active.b.index,price:active.stopPrice},{index:active.b.index,price:active.targetPrice},{index:active.b.index,price:(active.stopPrice+active.targetPrice)/2}]:active.type==='text'?[active.a]:[active.a,active.b];
  for(const point of handles){const p=project(point);c.beginPath();c.arc(p.x,p.y,5,0,Math.PI*2);c.fill();c.stroke()}
 }
 c.restore();
};
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function hitDrawing(e){
 const p={x:e.offsetX,y:e.offsetY},g=chart.geometry;if(!g||p.x>g.width||p.y>g.height)return null;
 for(const s of [...shapes].reverse()){
  if(s.hidden||s.market!==current.symbol||s.tf!==tf)continue;
  const a=project(s.a),b=project(s.b),tolerance=8+(s.width||1.5)/2;
  if(isPositionShape(s)){normalizePosition(s);const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),entryY=g.y(s.a.price),stopY=g.y(s.stopPrice),targetY=g.y(s.targetPrice),midY=(stopY+targetY)/2;if(Math.hypot(p.x-right,p.y-targetY)<=10)return{s,part:'target'};if(Math.hypot(p.x-right,p.y-stopY)<=10)return{s,part:'stop'};if(Math.hypot(p.x-right,p.y-entryY)<=10)return{s,part:'entry'};if(Math.hypot(p.x-left,p.y-entryY)<=10)return{s,part:'left'};if(Math.hypot(p.x-right,p.y-midY)<=10)return{s,part:'right'};if(p.x>=left-tolerance&&p.x<=right+tolerance&&p.y>=Math.min(targetY,stopY)-tolerance&&p.y<=Math.max(targetY,stopY)+tolerance)return{s,part:'body'};continue}
  if(Math.hypot(p.x-a.x,p.y-a.y)<=10)return {s,part:'a'};
  if(s.type!=='text'&&Math.hypot(p.x-b.x,p.y-b.y)<=10)return {s,part:'b'};
  let distance;
  if(s.type==='ellipse'){const rx=Math.abs(b.x-a.x)/2,ry=Math.abs(b.y-a.y)/2;distance=rx&&ry?Math.abs(Math.hypot((p.x-(a.x+b.x)/2)/rx,(p.y-(a.y+b.y)/2)/ry)-1)*Math.min(rx,ry):segmentDistance(p,a,b)}
  else if(s.type==='ray'||s.type==='extended'){const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)<.01)distance=segmentDistance(p,{x:a.x,y:s.type==='extended'?0:a.y},{x:a.x,y:dy>=0?g.height:0});else{const left=s.type==='extended'?0:a.x,right=s.type==='extended'||dx>=0?g.width:0;distance=segmentDistance(p,{x:left,y:a.y+(left-a.x)*dy/dx},{x:right,y:a.y+(right-a.x)*dy/dx})}}
  else if(s.type==='crossline')distance=Math.min(Math.abs(p.y-a.y),Math.abs(p.x-a.x));
  else if(s.type==='horizontal')distance=Math.abs(p.y-a.y);
  else if(s.type==='vertical')distance=Math.abs(p.x-a.x);
  else if(s.type==='rect')distance=Math.min(...[[a,{x:b.x,y:a.y}],[{x:b.x,y:a.y},b],[b,{x:a.x,y:b.y}],[{x:a.x,y:b.y},a]].map(([v,w])=>segmentDistance(p,v,w)));
  else if(s.type==='fib')distance=Math.min(...fibonacciLevels(s).filter(l=>l.visible!==false).map(l=>{const y=g.y(s.a.price+(s.b.price-s.a.price)*l.value);return segmentDistance(p,{x:a.x,y},{x:b.x,y})}));
  else if(s.type==='brush')distance=Math.min(...s.points.slice(1).map((q,i)=>segmentDistance(p,project(s.points[i]),project(q))));
  else if(s.type==='text'){drawCtx.font=`${s.textBold?'bold ':''}${s.textSize||12}px Segoe UI`;distance=p.x>=a.x&&p.x<=a.x+drawCtx.measureText(s.text).width&&p.y>=a.y-(s.textSize||12)-2&&p.y<=a.y+4?0:Infinity}
  else distance=segmentDistance(p,a,b);
  if(distance<=tolerance)return {s,part:'body'};
 }return null;
}
// Capture object hits before chart pan handlers; empty chart space still pans.
chart.canvas.addEventListener('pointerdown',e=>{
 if(drawEnabled||drawCanvas.hidden||selectingBar)return;
 const hit=hitDrawing(e);if(!hit){selectDrawing(null);return}
 e.stopImmediatePropagation();selectDrawing(hit.s);
 if(locked||hit.s.locked)return;
 chart.canvas.setPointerCapture(e.pointerId);
 objectDrag={s:hit.s,part:hit.part,start:coordinate(e),original:structuredClone(hit.s)};
},true);
chart.canvas.addEventListener('pointermove',e=>{
 if(!objectDrag)return;
 e.stopImmediatePropagation();const {s,part,start,original}=objectDrag,p=coordinate(e);
 if(isPositionShape(s)){
  const minimum=Math.max(Math.abs(original.a.price)*1e-8,1e-8);
  if(part==='body'){const indexShift=p.index-start.index,priceShift=p.price-start.price;s.a={index:original.a.index+indexShift,price:original.a.price+priceShift};s.b={index:original.b.index+indexShift,price:original.targetPrice+priceShift};s.stopPrice=original.stopPrice+priceShift;s.targetPrice=original.targetPrice+priceShift}
  else if(part==='left')s.a.index=Math.min(p.index,s.b.index-.1);else if(part==='right')s.b.index=Math.max(p.index,s.a.index+.1);
  else if(part==='entry'){s.a.price=s.type==='longPosition'?Math.max(s.stopPrice+minimum,Math.min(s.targetPrice-minimum,p.price)):Math.max(s.targetPrice+minimum,Math.min(s.stopPrice-minimum,p.price))}
  else if(part==='stop')s.stopPrice=s.type==='longPosition'?Math.min(s.a.price-minimum,p.price):Math.max(s.a.price+minimum,p.price);
  else if(part==='target')s.targetPrice=s.type==='longPosition'?Math.max(s.a.price+minimum,p.price):Math.min(s.a.price-minimum,p.price);
  normalizePosition(s);
 }else if(part==='body'||s.type==='brush'){
  const shift=q=>({index:q.index+p.index-start.index,price:q.price+p.price-start.price});s.a=shift(original.a);s.b=shift(original.b);s.points=original.points.map(shift);
 }else{s[part]=p;if(s.type==='text')s.b=p}
 redrawShapes();
},true);
chart.canvas.addEventListener('pointerup',e=>{if(objectDrag){e.stopImmediatePropagation();objectDrag=null;redrawShapes();window.captureWorkspaceChange?.()}},true);
chart.canvas.addEventListener('pointercancel',()=>{if(objectDrag){Object.assign(objectDrag.s,objectDrag.original);objectDrag=null;redrawShapes()}},true);
chart.canvas.addEventListener('lostpointercapture',()=>{objectDrag=null});
document.addEventListener('keydown',e=>{if(e.key==='Escape')selectDrawing(null);if((e.key==='Delete'||e.key==='Backspace')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&selectedDrawing){e.preventDefault();$('objectDelete').click()}});
