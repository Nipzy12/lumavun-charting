// Native VibeCharts examples, separate from the financial renderer.
(() => {
  const types = {pie:'Pie',donut:'Donut',radar:'Radar',gauge:'Gauge',heatmap:'Heatmap'};
  const colors = ['#7199ef','#48c5a5','#e5b965','#b593e8','#ed8195'];
  const assets = ['XAUUSD','BTCUSD','ETHUSD','EURUSD','SOLUSD'];
  let selected = 'pie', nativeChart;
  const dialog = document.createElement('dialog');
  dialog.id = 'simulatedCharts';
  dialog.setAttribute('aria-labelledby','simulatedChartsTitle');
  dialog.innerHTML = `<header><div><h2 id="simulatedChartsTitle">Statistik pasar</h2><span class="simulation-badge">DATA SIMULASI</span></div><button id="closeSimulatedCharts" aria-label="Tutup statistik">×</button></header>
    <nav aria-label="Jenis statistik">${Object.entries(types).map(([id,label])=>`<button data-native-type="${id}" aria-pressed="false">${label}</button>`).join('')}</nav>
    <section><h3 id="simulationHeading"></h3><p id="simulationDescription"></p><div id="nativeSimulationChart" role="img" aria-label="Grafik data simulasi; nilai tersedia pada tabel di bawah"></div><div id="simulationValues"></div></section>
    <footer><span>Contoh acak · bukan data pasar langsung</span><button id="regenerateSimulation">Acak data simulasi</button></footer>`;
  document.body.append(dialog);
  const css = document.createElement('style');
  css.textContent = `
    #simulatedCharts{box-sizing:border-box;width:760px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);padding:0;background:#1d1d20;color:#d8d8df;border:1px solid #424249;border-radius:10px;overflow:auto;box-shadow:0 20px 70px #0008}
    #simulatedCharts::backdrop{background:#0009}
    #simulatedCharts header,#simulatedCharts footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px}
    #simulatedCharts header{border-bottom:1px solid #38383e}#simulatedCharts h2{margin:0 0 7px;font-size:18px}
    #simulatedCharts .simulation-badge{color:#e5b965;font-size:9px;letter-spacing:1.4px}
    #simulatedCharts button{padding:8px 12px;border-radius:5px}#closeSimulatedCharts{font-size:24px}
    #simulatedCharts nav{display:flex;gap:5px;padding:14px 22px 0;overflow:auto}#simulatedCharts nav button[aria-pressed=true]{background:#dedee5;color:#18181c}
    #simulatedCharts section{padding:0 22px}#simulatedCharts h3{font-size:15px;margin:20px 0 6px}#simulatedCharts p,#simulatedCharts footer span{font-size:11px;color:#a1a1ad;line-height:1.6}
    #nativeSimulationChart{width:100%;overflow:hidden;border-radius:6px}#nativeSimulationChart canvas{display:block;max-width:100%}
    #simulationValues{overflow:auto;margin-top:12px}#simulationValues table{border-collapse:collapse;width:100%;font-size:11px}#simulationValues th,#simulationValues td{text-align:right;padding:9px 8px;border-bottom:1px solid #34343a;white-space:nowrap}#simulationValues th:first-child,#simulationValues td:first-child{text-align:left}#simulationValues i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}
    #simulatedCharts footer{border-top:1px solid #38383e;margin-top:18px}#regenerateSimulation{background:#303b55;color:#c7d7ff}
    @media(max-width:500px){#simulatedCharts header,#simulatedCharts footer{padding:14px}#simulatedCharts section{padding:0 12px}#simulatedCharts nav{padding:12px 12px 0;gap:0}#simulatedCharts nav button{padding:8px 10px}#simulatedCharts footer{align-items:flex-start;flex-direction:column}}
  `;
  document.head.append(css);
  const number = () => 10 + Math.floor(Math.random()*81);
  let allocation, profile, sentiment, activity;
  function generate() {
    const weights = assets.map(number), total = weights.reduce((a,b)=>a+b,0);
    const shares = weights.slice(0,4).map(n=>Math.round(n/total*100));
    shares.push(100-shares.reduce((a,b)=>a+b,0));
    allocation = assets.map((label,i)=>({label,value:shares[i]}));
    profile = ['Momentum','Volume','Likuiditas','Volatilitas','Tren'].map(label=>({label,value:number()}));
    sentiment = number();
    activity = assets.map(label=>({label,values:Array.from({length:5},number)}));
  }
  function render() {
    const meta = {
      pie:['Alokasi aset','Porsi setiap aset dalam contoh portofolio, total 100%.'],
      donut:['Komposisi portofolio','Alokasi yang sama dengan Pie; angka di tengah menunjukkan total persentase.'],
      radar:['Profil pasar','Skor contoh 0–100 per faktor. Radius grafik mengikuti skor terbesar pada data.'],
      gauge:['Sentimen pasar','Skor contoh 0–100: semakin tinggi, semakin positif sentimennya.'],
      heatmap:['Aktivitas pasar','Skor aktivitas 0–100. Baris: XAUUSD, BTCUSD, ETHUSD, EURUSD, SOLUSD. Kolom: Senin–Jumat. Warna makin gelap menunjukkan aktivitas makin tinggi.']
    };
    document.getElementById('simulationHeading').textContent = meta[selected][0];
    document.getElementById('simulationDescription').textContent = meta[selected][1];
    dialog.querySelectorAll('[data-native-type]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.nativeType===selected));
    const data = selected==='gauge'?{value:sentiment,max:100}:selected==='radar'?profile:selected==='heatmap'?activity:allocation;
    const options = {type:selected,data,colors:selected==='heatmap'?['#b8e7de','#245c87']:colors,height:320,showLegend:false,showPlaceholder:false,responsive:false,animated:false,customTheme:{backgroundColor:'#1d1d20',textColor:'#d8d8df',gridColor:'#42424d'}};
    if (!nativeChart) nativeChart = new VibeCharts('nativeSimulationChart', options);
    else nativeChart.options = {...nativeChart.options,...options};
    nativeChart.canvas.width = document.getElementById('nativeSimulationChart').clientWidth;
    nativeChart.render();
    const table = selected==='heatmap'
      ? `<thead><tr><th>Aset</th>${['Sen','Sel','Rab','Kam','Jum'].map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody>${activity.map(r=>`<tr><th>${r.label}</th>${r.values.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>`
      : `<thead><tr><th>${selected==='gauge'?'Indikator':selected==='radar'?'Faktor':'Aset'}</th><th>${['pie','donut'].includes(selected)?'Alokasi':'Skor'}</th></tr></thead><tbody>${(selected==='gauge'?[{label:'Sentimen',value:sentiment}]:data).map((r,i)=>`<tr><td><i style="background:${colors[i%colors.length]}"></i>${r.label}</td><td>${r.value}${['pie','donut'].includes(selected)?'%':' / 100'}</td></tr>`).join('')}</tbody>`;
    document.getElementById('simulationValues').innerHTML = `<table>${table}</table>`;
  }
  generate();
  dialog.querySelectorAll('[data-native-type]').forEach(b=>b.onclick=()=>{selected=b.dataset.nativeType;render()});
  document.getElementById('regenerateSimulation').onclick=()=>{generate();render()};
  document.getElementById('closeSimulatedCharts').onclick=()=>dialog.close();
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  new ResizeObserver(()=>{if(dialog.open&&nativeChart)render()}).observe(document.getElementById('nativeSimulationChart'));
  const button = document.createElement('button');
  button.id = 'simulationToggle';
  button.className = 'icon';
  button.title = 'Statistik simulasi · Pie, Donut, Radar, Gauge, Heatmap';
  button.setAttribute('aria-label', 'Statistik simulasi');
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', dialog.id);
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3a9 9 0 1 0 10 10H11Z"/><path d="M14 2v8h8a9 9 0 0 0-8-8Z"/></svg>';
  button.onclick = () => {
    closeStyles();
    dialog.showModal();
    button.classList.add('active');
    button.setAttribute('aria-expanded', 'true');
    render();
  };
  dialog.addEventListener('close', () => {
    button.classList.remove('active');
    button.setAttribute('aria-expanded', 'false');
  });
  document.getElementById('objectTreeToggle').after(button);
})();
