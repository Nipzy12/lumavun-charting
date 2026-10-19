/* Versioned, declarative node definitions shared by the editor and execution engine. */
(function(root){
  const number=(label,value,min,max)=>({label,type:'number',default:value,min,max,integer:true});
  const text=(label,value)=>({label,type:'text',default:value});
  const definitions={};
  for(const type of ['Open','High','Low','Close','Volume'])definitions[type]={group:'Market Data',description:`${type} candle. Offset 0 = bar saat ini; angka positif = bar sebelumnya.`,inputs:{},output:'number',params:{offset:number('Offset bar',0,0,500)}};
  definitions.Constant={group:'Market Data',description:'Nilai tetap, misalnya 30 dan 70 untuk ambang RSI.',inputs:{},output:'number',params:{value:{...number('Nilai',30,-1e12,1e12),integer:false}}};
  for(const type of ['SMA','EMA','RSI'])definitions[type]={group:'Indicators',description:type==='RSI'?'RSI Wilder. Warm-up membutuhkan periode + 1 bar; rentang 0–100.':`${type} dari input numerik. Nilai belum tersedia selama warm-up. EMA diawali SMA.`,inputs:{source:'number'},output:'number',params:{period:number('Periode',type==='RSI'?14:20,1,500)}};
  for(const [type,title] of [['Greater','Greater Than'],['Less','Less Than'],['CrossAbove','Crosses Above'],['CrossBelow','Crosses Below']])definitions[type]={title,group:'Logic',description:`${title}: membandingkan A dan B. Jika B tidak terhubung, gunakan nilai ambang.`,inputs:{a:'number',b:'number'},optional:['b'],output:'boolean',params:{threshold:{...number('Ambang B (tanpa koneksi)',30,-1e12,1e12),integer:false}}};
  for(const type of ['AND','OR'])definitions[type]={group:'Logic',description:`${type} pada dua kondisi boolean. Warm-up tetap ditandai belum tersedia.`,inputs:{a:'boolean',b:'boolean'},output:'boolean',params:{label:text('Label',type)}};
  definitions.Plot={title:'Plot Line',group:'Output',description:'Garis harga pada chart utama, atau osilator pada pane terpisah. Pilih osilator untuk RSI.',inputs:{source:'number'},output:null,params:{label:text('Nama plot','Plot'),color:{label:'Warna',type:'color',default:'#7fa6ed'},width:number('Ketebalan',2,1,5),pane:{label:'Pane',type:'select',default:'price',options:{price:'Harga',oscillator:'Osilator (RSI)'}}}};
  for(const type of ['Buy','Sell'])definitions[type]={title:`${type} Signal`,group:'Output',description:'Marker pada bar ketika kondisi true; hanya transisi false → true bila dipilih.',inputs:{condition:'boolean'},output:null,params:{label:text('Teks',type.toUpperCase()),transition:{label:'Hanya saat kondisi mulai true',type:'boolean',default:true}}};
  definitions.Alert={title:'Alert Condition',group:'Output',description:'Peringatan lokal pada penutupan bar replay berikutnya. Tidak berjalan saat halaman ditutup.',inputs:{condition:'boolean'},output:null,params:{message:text('Pesan','Kondisi indikator terpenuhi'),transition:{label:'Hanya saat kondisi mulai true',type:'boolean',default:true}}};
  function create(type,id,x=40,y=40){const d=definitions[type];if(!d)throw Error('Jenis node tidak dikenal.');return {id,type,x,y,params:Object.fromEntries(Object.entries(d.params).map(([k,v])=>[k,v.default]))}}
  function sample(){return {version:1,nodes:[create('Close','close',30,60),create('EMA','ema',270,60),create('Plot','plot',510,60)],edges:[{id:'e1',from:'close',to:'ema',input:'source'},{id:'e2',from:'ema',to:'plot',input:'source'}]}}
  root.SyndicateNodes={definitions,create,sample};
  if(typeof module!=='undefined')module.exports=root.SyndicateNodes;
})(globalThis);
