/* Pure OHLCV graph engine: no DOM, chart engine, storage or network dependencies. */
(function(root){
  const definitions=root.SyndicateNodes?.definitions||(typeof require==='function'?require('./indicator-nodes.js').definitions:null);
  function validate(graph,{incomplete=false}={}){
    const errors=[],order=[];
    if(!graph||graph.version!==1||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))return {ok:false,errors:['Format graph tidak valid (version 1 diperlukan).'],order};
    if(graph.nodes.length>128||graph.edges.length>512)return {ok:false,errors:['Batas graph: 128 node / 512 koneksi.'],order};
    const nodes=new Map(),incoming=new Map(),outgoing=new Map(),degree=new Map(),edgeIds=new Set();
    for(const n of graph.nodes){
      if(!n||typeof n.id!=='string'||!n.id||nodes.has(n.id)||!Object.hasOwn(definitions,n.type)){errors.push('ID node duplikat atau tipe node tidak valid.');continue}
      nodes.set(n.id,n);degree.set(n.id,0);outgoing.set(n.id,[]);
      if(!Number.isFinite(n.x)||!Number.isFinite(n.y))errors.push(`${n.id}: posisi tidak valid.`);
      for(const [key,spec] of Object.entries(definitions[n.type].params)){
        const v=n.params?.[key];
        const valid=spec.type==='number'?Number.isFinite(v)&&v>=spec.min&&v<=spec.max&&(!spec.integer||Number.isInteger(v)):spec.type==='boolean'?typeof v==='boolean':spec.type==='color'?typeof v==='string'&&/^#[\da-f]{6}$/i.test(v):spec.type==='select'?Object.hasOwn(spec.options,v):typeof v==='string'&&v.length<=120;
        if(!valid)errors.push(`${n.id}: parameter ${spec.label} tidak valid.`);
      }
    }
    for(const e of graph.edges){
      if(!e||typeof e.id!=='string'||edgeIds.has(e.id)){errors.push('ID koneksi tidak valid / duplikat.');continue}edgeIds.add(e.id);
      const from=nodes.get(e.from),to=nodes.get(e.to);if(!from||!to){errors.push('Koneksi mengarah ke node yang tidak ada.');continue}
      const output=definitions[from.type].output,input=definitions[to.type].inputs[e.input],key=e.to+':'+e.input;
      if(!output||output!==input)errors.push(`${e.id}: tipe socket tidak cocok.`);
      if(incoming.has(key))errors.push(`${e.to}: satu input hanya menerima satu koneksi.`);incoming.set(key,e.from);
      outgoing.get(e.from).push(e.to);degree.set(e.to,degree.get(e.to)+1);
    }
    for(const n of nodes.values())for(const input of Object.keys(definitions[n.type].inputs))if(!incomplete&&!definitions[n.type].optional?.includes(input)&&!incoming.has(n.id+':'+input))errors.push(`${n.id}: input ${input} belum terhubung.`);
    const queue=[...degree].filter(([,v])=>v===0).map(([id])=>id);
    for(let i=0;i<queue.length;i++){const id=queue[i];order.push(id);for(const next of outgoing.get(id)){degree.set(next,degree.get(next)-1);if(!degree.get(next))queue.push(next)}}
    if(order.length!==nodes.size)errors.push('Circular dependency tidak diperbolehkan.');
    if(!incomplete&&!graph.nodes.some(n=>definitions[n.type]?.group==='Output'))errors.push('Tambahkan minimal satu node Output.');
    return {ok:!errors.length,errors,order,incoming,nodes};
  }
  function average(values,period,exponential=false){let sum=0,queue=[],previous=null;return values.map(v=>{if(!Number.isFinite(v)){sum=0;queue=[];previous=null;return null}if(exponential&&previous!==null){previous+=(v-previous)*2/(period+1);return previous}queue.push(v);sum+=v;if(queue.length>period)sum-=queue.shift();if(queue.length<period)return null;previous=sum/period;return previous})}
  function rsi(values,period){let prev=null,gain=0,loss=0,count=0;return values.map(v=>{if(!Number.isFinite(v)){prev=null;gain=loss=count=0;return null}if(prev===null){prev=v;return null}const diff=v-prev;prev=v;const up=Math.max(diff,0),down=Math.max(-diff,0);if(count<period){gain+=up;loss+=down;count++;if(count<period)return null;gain/=period;loss/=period}else{gain=(gain*(period-1)+up)/period;loss=(loss*(period-1)+down)/period}return loss===0?(gain===0?50:100):100-100/(1+gain/loss)})}
  function execute(graph,bars){
    const check=validate(graph);if(!check.ok)throw Error(check.errors.join('\n'));
    if(!Array.isArray(bars)||bars.length>100000)throw Error('Data OHLCV tidak valid atau melebihi 100.000 bar.');
    let time=-Infinity;for(const b of bars){if(!b||!['time','open','high','low','close','volume'].every(k=>Number.isFinite(b[k]))||b.time<=time)throw Error('OHLCV harus numerik, urut, dan tanpa waktu duplikat.');time=b.time}
    const values=new Map(),plots=[],markers=[],alerts=[];
    for(const id of check.order){
      const n=check.nodes.get(id),p=n.params,type=n.type;
      const input=key=>values.get(check.incoming.get(id+':'+key));
      let out;
      if(['Open','High','Low','Close','Volume'].includes(type))out=bars.map((_,i)=>i>=p.offset?bars[i-p.offset][type.toLowerCase()]:null);
      else if(type==='Constant')out=bars.map(()=>p.value);
      else if(type==='SMA'||type==='EMA')out=average(input('source'),p.period,type==='EMA');
      else if(type==='RSI')out=rsi(input('source'),p.period);
      else if(['Greater','Less','CrossAbove','CrossBelow'].includes(type)){const a=input('a'),b=input('b')||bars.map(()=>p.threshold);out=a.map((v,i)=>{if(!Number.isFinite(v)||!Number.isFinite(b[i]))return null;if(type==='Greater')return v>b[i];if(type==='Less')return v<b[i];if(!i||!Number.isFinite(a[i-1])||!Number.isFinite(b[i-1]))return null;return type==='CrossAbove'?a[i-1]<=b[i-1]&&v>b[i]:a[i-1]>=b[i-1]&&v<b[i]})}
      else if(type==='AND'||type==='OR'){const a=input('a'),b=input('b');out=a.map((v,i)=>type==='AND'?(v===false||b[i]===false?false:v===null||b[i]===null?null:true):(v===true||b[i]===true?true:v===null||b[i]===null?null:false))}
      else if(type==='Plot'){plots.push({id,label:p.label,color:p.color,width:p.width,pane:p.pane,data:input('source').map((value,i)=>({time:bars[i].time,value})).filter(d=>Number.isFinite(d.value))})}
      else {const conditions=input('condition'),hits=conditions.map((v,i)=>v===true&&(!p.transition||i>0&&conditions[i-1]===false));if(type==='Alert')alerts.push({id,message:p.message,values:hits});else hits.forEach((hit,i)=>{if(hit)markers.push({id,time:bars[i].time,side:type.toLowerCase(),text:p.label})})}
      if(out)values.set(id,out);
    }
    markers.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
    return {version:1,values,plots,markers,alerts};
  }
  root.SyndicateEngine={validate,execute,average,rsi};if(typeof module!=='undefined')module.exports=root.SyndicateEngine;
})(globalThis);
