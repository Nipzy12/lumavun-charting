/* Trading extension for VibeCharts. Upstream remains unmodified in vendor/.
 * Adds OHLC series, indicators, volume, price/time axes, crosshair and pan/zoom.
 */
class VibeTradingChart extends VibeCharts {
  constructor(id) {
    super(id, {showPlaceholder:false, showLegend:false, animated:false,
      responsive:false, height:document.getElementById(id).clientHeight,
      customTheme:{backgroundColor:'#080809',textColor:'#b2b2b6',gridColor:'#202023'}});
    this.series=[];
    this.view=null;
    this.defaultVisibleBars=150;
    this.rightOffset=10;
    this.maxFutureWhitespace=300;
    this.timeframeSeconds=60;
    this.marketCalendar='24x7';
    this.liveFollow=true;
    this.viewportInitialized=false;
    this.pointer=null;
    this.canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none';
    this.bindInteractions();
    this.resizeObserver=new ResizeObserver(()=>this.render());
    this.resizeObserver.observe(this.container);
  }
  addSeries(kind, options={}) {
    const series={kind,options,data:[],setData:data=>{const primary=this.series[0]===series,previous=series.data.length;series.data=data;if(primary){if(!this.viewportInitialized&&data.length)this.initializeViewport(data.length,true);else if(this.liveFollow&&data.length!==previous)this.goToRealtime(false)}this.schedule()},
      applyOptions:options=>{Object.assign(series.options,options);this.schedule()}};
    this.series.push(series);
    return series;
  }
  addCandlestickSeries(options){return this.addSeries('candles',options)}
  addLineSeries(options){return this.addSeries('line',options)}
  addHistogramSeries(options){return this.addSeries('volume',options)}
  // Local financial extensions used by Indicator Studio (not upstream VibeCharts API).
  removeSeries(series){this.series=this.series.filter(item=>item!==series);this.schedule()}
  setStudioMarkers(markers){this.studioMarkers=markers;this.schedule()}
  applyOptions(){this.schedule()}
  subscribeCrosshairMove(callback){this.onCrosshair=callback}
  schedule(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=null;this.render()})}
  timeScale(){return {
    fitContent:()=>{const length=this.series[0]?.data.length||0;this.viewportInitialized=true;this.liveFollow=true;this.view={start:0,count:Math.max(20,length+this.rightOffset)};this.schedule()},
    resetToLatest:()=>this.initializeViewport(this.series[0]?.data.length||0,true),
    scrollToRealTime:()=>this.goToRealtime(),
    setVisibleRange:({from,to})=>{
      const data=this.series[0]?.data||[];
      const start=data.findIndex(d=>d.time>=from);
      let end=data.findIndex(d=>d.time>to);if(end<0)end=data.length;
      const actual=Math.max(10,end-Math.max(0,start)),nearLatest=end>=data.length-1;this.viewportInitialized=true;this.view={start:Math.max(0,start),count:actual+(nearLatest?this.rightOffset:0)};this.liveFollow=nearLatest;this.schedule();
    }
  }}
  initializeViewport(length=this.series[0]?.data.length||0,force=false){if(!length)return;if(this.viewportInitialized&&!force)return;const actual=Math.min(this.defaultVisibleBars,length);this.viewportInitialized=true;this.liveFollow=true;this.view={start:Math.max(0,length-actual),count:Math.max(20,actual+this.rightOffset)};this.schedule()}
  realtimeViewStart(length,count){return length-count+this.rightOffset}
  maxViewStart(length,count){const future=Math.min(this.maxFutureWhitespace,Math.max(this.rightOffset,count-1));return length-count+future}
  goToRealtime(schedule=true){const length=this.series[0]?.data.length||0;if(!length)return;const count=Math.max(20,this.view?.count||Math.min(length+this.rightOffset,this.defaultVisibleBars+this.rightOffset));this.viewportInitialized=true;this.liveFollow=true;this.view={start:this.realtimeViewStart(length,count),count};if(schedule)this.schedule()}
  clampView(start,count){
    const length=this.series[0]?.data.length||1;
    const limit=Math.max(length+this.rightOffset,this.view?.count||0);count=Math.max(20,Math.min(limit,count));
    const realtime=this.realtimeViewStart(length,count),future=this.maxViewStart(length,count),lower=Math.min(0,realtime),upper=Math.max(0,future),next=Math.max(lower,Math.min(upper,start));
    this.viewportInitialized=true;this.view={start:next,count};this.liveFollow=Math.abs(next-realtime)<1.5;this.schedule();
  }
  futureTime(lastTime,steps){
    const step=Math.max(1,this.timeframeSeconds||60);if(this.marketCalendar==='24x7')return lastTime+steps*step;
    let time=lastTime;for(let i=0;i<steps;i++){time+=step;const date=new Date(time*1000),day=date.getUTCDay(),hour=date.getUTCHours();if(day===6)time+=((24-hour)+22)*3600-date.getUTCMinutes()*60-date.getUTCSeconds();else if(day===0&&hour<22)time+=((22-hour)*3600-date.getUTCMinutes()*60-date.getUTCSeconds());else if(day===5&&hour>=22)time+=((24-hour)+22+24)*3600-date.getUTCMinutes()*60-date.getUTCSeconds()}return time
  }
  timeAtLogical(index,data=this.series[0]?.data||[]){if(!data.length)return null;const rounded=Math.max(0,Math.round(index));if(rounded<data.length)return data[rounded].time;return this.futureTime(data.at(-1).time,rounded-data.length+1)}
  bindInteractions(){
    const c=this.canvas;
    c.addEventListener('wheel',e=>{
      e.preventDefault();if(!this.geometry)return;
      const {start,count,width}=this.geometry;
      if(e.offsetX>=width){const scale=this.scaleSettings||(this.scaleSettings={}),range=scale.manualRange||this.priceRange;if(!range)return;const center=(range[0]+range[1])/2,span=(range[1]-range[0])*Math.exp(e.deltaY*.0015);scale.auto=false;scale.manualRange=[center-span/2,center+span/2];this.schedule();return}
      const anchor=Math.max(0,Math.min(1,e.offsetX/width));
      const next=Math.max(20,Math.min(this.series[0].data.length+this.rightOffset,count*Math.exp(e.deltaY*.0015)));
      this.clampView(start+anchor*(count-next),next);
    },{passive:false});
    c.addEventListener('pointerdown',e=>{
      if(this.pickBar&&this.geometry){const i=Math.floor(this.geometry.start+e.offsetX/this.geometry.width*this.geometry.count);if(i>=0&&i<this.series[0].data.length)this.pickBar(i);return}
      if(!this.geometry||e.button!==0)return;c.setPointerCapture(e.pointerId);const range=[...(this.scaleSettings?.manualRange||this.priceRange||[0,1])];
      if(e.offsetX>=this.geometry.width){this.priceDrag={y:e.offsetY,range};return}
      if(e.offsetY>=this.geometry.height){this.timeDrag={x:e.offsetX,start:this.geometry.start,count:this.geometry.count};return}
      this.drag={x:e.offsetX,y:e.offsetY,start:this.geometry.start,count:this.geometry.count,range};
    });
    c.addEventListener('pointermove',e=>{
      if(!this.geometry)return;
      if(this.priceDrag){const scale=this.scaleSettings||(this.scaleSettings={}),center=(this.priceDrag.range[0]+this.priceDrag.range[1])/2,span=(this.priceDrag.range[1]-this.priceDrag.range[0])*Math.exp((e.offsetY-this.priceDrag.y)*.01);scale.auto=false;scale.manualRange=[center-span/2,center+span/2];this.schedule()}
      else if(this.timeDrag){const next=this.timeDrag.count*Math.exp((e.offsetX-this.timeDrag.x)*.01);this.clampView(this.timeDrag.start+(this.timeDrag.count-next)/2,next)}
      else if(this.drag){this.clampView(this.drag.start-(e.offsetX-this.drag.x)/this.geometry.width*this.drag.count,this.drag.count);const dy=e.offsetY-this.drag.y;if(Math.abs(dy)>2){const scale=this.scaleSettings||(this.scaleSettings={}),span=this.drag.range[1]-this.drag.range[0],shift=dy/Math.max(1,this.geometry.height)*span;scale.auto=false;scale.manualRange=[this.drag.range[0]+shift,this.drag.range[1]+shift];this.schedule()}}
      this.pointer={x:e.offsetX,y:e.offsetY};this.schedule();
      const data=this.series[0].data;
      const index=Math.floor(this.geometry.start+e.offsetX/this.geometry.width*this.geometry.count);
      const d=data[index];if(d)this.onCrosshair?.({seriesData:new Map([[this.series[0],d]])});
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(event,()=>{this.drag=null;this.priceDrag=null;this.timeDrag=null});
    c.addEventListener('pointerleave',()=>{this.pointer=null;this.schedule()});
    c.addEventListener('dblclick',()=>this.timeScale().resetToLatest());
    c.addEventListener('contextmenu',e=>e.preventDefault());
  }
  render(){
    if(!this.series||!this.ctx)return;
    const w=this.container.clientWidth,h=this.container.clientHeight;
    if(w<1||h<1)return;
    const dpr=window.devicePixelRatio||1,c=this.ctx;
    this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
    c.setTransform(dpr,0,0,dpr,0,0);
    const appearance=this.appearance||{};
    const gradient=c.createLinearGradient(0,0,0,h);gradient.addColorStop(0,appearance.backgroundTop||'#080809');gradient.addColorStop(1,appearance.backgroundBottom||'#252526');
    c.fillStyle=gradient;c.fillRect(0,0,w,h);
    const data=this.series[0]?.data||[];if(!data.length){this.geometry=null;this.onRender?.();return}
    const width=Math.max(1,w-70),height=Math.max(1,h-28);
    const count=Math.max(20,this.view?.count||data.length+this.rightOffset),realtime=this.realtimeViewStart(data.length,count),future=this.maxViewStart(data.length,count);
    const start=Math.max(Math.min(0,realtime),Math.min(Math.max(0,future),this.view?.start||0)),first=Math.max(0,Math.floor(start));
    const visible=data.slice(first,Math.min(data.length,Math.ceil(start+count)));
    const overlays=this.series.filter(s=>s.kind==='line'&&s.options.pane!=='oscillator'&&s.data.length);
    const oscillators=this.series.filter(s=>s.kind==='line'&&s.options.pane==='oscillator'&&s.data.length);
    let lo=Math.min(...visible.map(d=>d.low)),hi=Math.max(...visible.map(d=>d.high));
    const scale=this.scaleSettings||{};
    if(!scale.priceOnly)for(const s of overlays){const values=s.data.filter(d=>d.time>=visible[0].time&&d.time<=visible.at(-1).time).map(d=>d.value);if(values.length){lo=Math.min(lo,...values);hi=Math.max(hi,...values)}}
    const pad=(hi-lo||Math.abs(hi)*.001||1)*.1;lo-=pad;hi+=pad;
    if(scale.auto===false&&Array.isArray(scale.manualRange)&&scale.manualRange.length===2&&scale.manualRange.every(Number.isFinite)&&scale.manualRange[1]>scale.manualRange[0]){
      [lo,hi]=scale.manualRange;
    }
    this.priceRange=[lo,hi];
    const volume=this.series.find(s=>s.kind==='volume'&&s.data.length);
    const oscillatorHeight=oscillators.length?Math.min(130,height*.28):0;
    const priceHeight=height-oscillatorHeight;
    const top=Math.min(70,priceHeight*.25),bottom=priceHeight*(volume ? .82 : .96),plotHeight=Math.max(20,bottom-top);
    const logarithmic=scale.mode==='log'&&lo>0;
    const transform=value=>logarithmic?Math.log(Math.max(Number.MIN_VALUE,value)):value;
    const inverse=value=>logarithmic?Math.exp(value):value;
    const low=transform(lo),high=transform(hi);
    const y=price=>top+(scale.invert?(transform(price)-low):(high-transform(price)))/(high-low)*plotHeight;
    const priceAtY=py=>inverse(scale.invert?low+(py-top)/plotHeight*(high-low):high-(py-top)/plotHeight*(high-low));
    const x=index=>(index-start+.5)*width/count;
    const precision=appearance.precision==null?(this.series[0].options.priceFormat?.precision??2):appearance.precision;
    const base=data[0].close;
    const format=price=>scale.mode==='percent'?((price/base-1)*100).toFixed(2)+'%':scale.mode==='indexed'?(price/base*100).toFixed(2):price.toLocaleString('en-US',{minimumFractionDigits:precision,maximumFractionDigits:precision});
    this.geometry={start,count,width,height,y,priceAtY,x,timeAtLogical:index=>this.timeAtLogical(index,data)};
    c.font='11px Segoe UI, sans-serif';c.textBaseline='middle';
    const line=(x1,y1,x2,y2)=>{c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()};
    for(let i=0;i<=8;i++){
      const price=inverse(low+(high-low)*i/8),py=y(price);
      c.strokeStyle=appearance.gridColor||this.options.gridColor;c.lineWidth=1;if(scale.grid!==false)line(0,py,width,py);
      c.fillStyle=appearance.textColor||this.options.textColor;c.fillText(format(price),width+6,py);
    }
    c.strokeStyle='#303033';line(width,0,width,height);line(0,height,w,height);
    const ticks=Math.max(2,Math.floor(width/100));
    for(let i=0;i<ticks;i++){
      const logical=Math.floor(start+(i+.4)*count/ticks),time=this.timeAtLogical(logical,data),date=new Date(time*1000),futureTick=logical>=data.length;
      const label=futureTick?date.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:appearance.timezone||'Asia/Makassar'}):count>100&&data.at(-1).time-data[0].time>86400*7?date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:appearance.timezone||'Asia/Makassar'}):date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:appearance.timezone||'Asia/Makassar'});
      c.fillStyle=appearance.textColor||this.options.textColor;c.textAlign='center';c.fillText(label,x(logical),height+15);
    }
    c.textAlign='left';c.save();c.beginPath();c.rect(0,0,width,height);c.clip();
    const body=Math.max(1,Math.min(18,width/count*.64));
    if(volume){
      const map=new Map(volume.data.map(d=>[d.time,d]));
      const max=Math.max(1,...visible.map(d=>map.get(d.time)?.value||0));
      visible.forEach((d,i)=>{const v=map.get(d.time);if(!v)return;c.fillStyle=v.color||'#546b69';const vh=v.value/max*priceHeight*.15;c.fillRect(x(first+i)-body/2,priceHeight-vh,body,vh)});
    }
    const style=this.series[0].options.chartStyle||'hollow';
    const linear=['line','markers','step','area'].includes(style);
    if(linear){
      c.beginPath();visible.forEach((d,i)=>{const px=x(first+i);if(!i)c.moveTo(px,y(d.close));else{if(style==='step')c.lineTo(px,y(visible[i-1].close));c.lineTo(px,y(d.close))}});
      c.strokeStyle='#b9c4dc';c.lineWidth=1.5;c.stroke();
      if(style==='area'){c.lineTo(x(first+visible.length-1),height);c.lineTo(x(first),height);c.closePath();c.fillStyle='#8fa7d329';c.fill()}
      if(style==='markers')visible.forEach((d,i)=>{c.beginPath();c.arc(x(first+i),y(d.close),2,0,Math.PI*2);c.fillStyle='#c9d5eb';c.fill()});
    }else visible.forEach((d,i)=>{
      const px=x(first+i),up=d.close>=d.open;
      c.strokeStyle=up?(appearance.wickUp||'#99999e'):(appearance.wickDown||'#bdbdbf');c.fillStyle=up?(appearance.bodyUp||(style==='hollow'?'#252526':'#8b929e')):(appearance.bodyDown||'#bdbdbf');c.lineWidth=1;
      if(style==='bar'){line(px,y(d.high),px,y(d.low));line(px-body/2,y(d.open),px,y(d.open));line(px,y(d.close),px+body/2,y(d.close));return}
      if(style==='highlow'){line(px,y(d.high),px,y(d.low));line(px-body/2,y(d.high),px+body/2,y(d.high));line(px-body/2,y(d.low),px+body/2,y(d.low));return}
      if(appearance.wicks!==false)line(px,y(d.high),px,y(d.low));const py=Math.min(y(d.open),y(d.close)),size=Math.max(1,Math.abs(y(d.open)-y(d.close)));
      if(appearance.bodies!==false)c.fillRect(px-body/2,py,body,size);
      c.strokeStyle=up?(appearance.borderUp||'#99999e'):(appearance.borderDown||'#bdbdbf');if(appearance.borders!==false)c.strokeRect(px-body/2,py,body,size);
    });
    const indices=new Map(data.map((d,i)=>[d.time,i]));
    for(const s of overlays){c.strokeStyle=s.options.color||'#d8b879';c.lineWidth=s.options.lineWidth||1;c.beginPath();let begun=false;for(const d of s.data){const i=indices.get(d.time);if(i===undefined)continue;const px=x(i);if(!begun){c.moveTo(px,y(d.value));begun=true}else c.lineTo(px,y(d.value))}c.stroke()}
    c.font='10px Segoe UI';c.textAlign='center';
    for(const marker of this.studioMarkers||[]){const i=indices.get(marker.time);if(i===undefined||i<start||i>=start+count)continue;const buy=marker.side==='buy',px=x(i),py=y(buy?data[i].low:data[i].high)+(buy?12:-12);c.fillStyle=buy?'#57c7a2':'#ec8c94';c.beginPath();c.moveTo(px,py);c.lineTo(px-4,py+(buy?6:-6));c.lineTo(px+4,py+(buy?6:-6));c.closePath();c.fill();c.fillText(marker.text,px,py+(buy?15:-15))}
    c.font='11px Segoe UI';c.textAlign='left';
    const last=data.at(-1),lastY=y(last.close);c.setLineDash([2,3]);c.strokeStyle='#929299';if(scale.priceLine!==false)line(0,lastY,width,lastY);c.setLineDash([]);
    if(this.pointer&&this.pointer.x<width){
      const mode=this.cursorMode||'cross';
      if(mode==='cross'){c.setLineDash([4,4]);c.strokeStyle='#85858d';line(this.pointer.x,0,this.pointer.x,height);line(0,this.pointer.y,width,this.pointer.y);c.setLineDash([]);const logical=start+this.pointer.x/width*count-.5,time=this.timeAtLogical(logical,data);if(time){const label=new Date(time*1000).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:appearance.timezone||'Asia/Makassar'});c.font='10px Segoe UI';const tw=c.measureText(label).width+10,tx=Math.max(0,Math.min(width-tw,this.pointer.x-tw/2));c.fillStyle='#303039';c.fillRect(tx,height-20,tw,18);c.fillStyle='#ddd';c.fillText(label,tx+5,height-11)}}
      if(mode==='dot'||mode==='demo'){c.beginPath();c.arc(this.pointer.x,this.pointer.y,mode==='demo'?18:3,0,Math.PI*2);c.fillStyle=mode==='demo'?'#ffb74d50':'#d4d8e2';c.fill();if(mode==='demo'){c.strokeStyle='#ffbc60';c.stroke()}}
    }
    c.restore();
    if(oscillators.length){
      c.save();c.beginPath();c.rect(0,priceHeight,w,oscillatorHeight);c.clip();c.fillStyle=appearance.backgroundBottom||'#202023';c.fillRect(0,priceHeight,w,oscillatorHeight);c.strokeStyle='#44444a';line(0,priceHeight,w,priceHeight);
      const points=oscillators.flatMap(s=>s.data.filter(d=>d.time>=visible[0].time&&d.time<=visible.at(-1).time).map(d=>d.value));const min=Math.min(0,...points),max=Math.max(100,...points);const oy=value=>priceHeight+15+(max-value)/(max-min)*(oscillatorHeight-30);
      c.font='10px Segoe UI';c.textAlign='left';c.fillStyle='#aaa';c.fillText('Studio · Osilator',8,priceHeight+10);
      for(const value of [30,70]){c.setLineDash([3,3]);c.strokeStyle='#414149';line(0,oy(value),width,oy(value));c.setLineDash([]);c.fillText(String(value),width+5,oy(value))}
      c.beginPath();c.rect(0,priceHeight,width,oscillatorHeight);c.clip();
      for(const s of oscillators){c.strokeStyle=s.options.color;c.lineWidth=s.options.lineWidth||1;c.beginPath();let first=true;for(const d of s.data){const i=indices.get(d.time);if(i===undefined)continue;if(first){c.moveTo(x(i),oy(d.value));first=false}else c.lineTo(x(i),oy(d.value))}c.stroke()}c.restore();
    }
    if(scale.label!==false&&lastY>0&&lastY<height){c.fillStyle='#bdbdbf';c.fillRect(width,lastY-10,70,20);c.fillStyle='#151518';c.fillText(format(last.close),width+5,lastY)}
    this.onRender?.();
  }
}
