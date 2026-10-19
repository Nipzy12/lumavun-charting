// Arrange the existing controls without replacing their event handlers.
(() => {
  const toolbar = document.querySelector('.toolbar');
  const svg = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  const icons = {
    indicatorPickerBtn: '<path d="M3 19h18M5 16v-4h3v4m3 0V8h3v8m3 0V5h3v11M3 8l5-4 5 2 7-5"/>',
    historyUndo: '<path d="m9 6-5 5 5 5M4 11h10a6 6 0 0 1 6 6"/>',
    historyRedo: '<path d="m15 6 5 5-5 5m5-5H10a6 6 0 0 0-6 6"/>',
    gridLayoutBtn: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M13 4v16"/>',
    settingsBtn: '<path d="m7 3-5 9 5 9h10l5-9-5-9Z"/><circle cx="12" cy="12" r="4"/>',
    volBtn: '<path d="M4 20V12h3v8m4 0V5h3v15m4 0V9h3v11"/>',
    replayBtn: '<path d="m11 5-8 7 8 7Zm10 0-8 7 8 7Z"/>'
  };
  for (const [id, paths] of Object.entries(icons)) {
    const button = document.getElementById(id);
    button.innerHTML = svg(paths);
    button.classList.add('toolbar-icon');
  }
  for (const [id, label] of Object.entries({settingsBtn:'Pengaturan chart',volBtn:'Tampilkan / sembunyikan volume',replayBtn:'Bar Replay',resetBtn:'Sesuaikan chart',fullscreenBtn:'Layar penuh',symbolBtn:'Pencarian simbol'})) {
    const button = document.getElementById(id);
    button.title = label;
    button.setAttribute('aria-label', label);
  }
  const alert = document.createElement('button');
  alert.id = 'toolbarAlertBtn';
  alert.className = 'toolbar-icon';
  alert.title = 'Buat peringatan';
  alert.setAttribute('aria-label', alert.title);
  alert.innerHTML = svg('<circle cx="11" cy="12" r="8"/><path d="M11 7v5l3 2M3 4l2-2m12 0 3 3m-1 12v6m-3-3h6"/>');
  alert.onclick = () => document.getElementById('createPriceAlert').click();
  const group = (name, ...nodes) => {
    const element = document.createElement('div');
    element.className = `toolbar-group ${name}`;
    nodes.forEach(node => element.append(typeof node === 'string' ? document.getElementById(node) : node));
    return element;
  };
  const symbol = group('toolbar-symbol', 'symbolBtn');
  const intervals = group('toolbar-intervals', document.querySelector('.tf'));
  // Keep the shared volume action available to the indicator picker and layouts.
  const volumeAction = document.getElementById('volBtn');
  volumeAction.hidden = true;
  volumeAction.style.display = 'none';
  document.body.append(volumeAction);
  const analysis = group('toolbar-analysis', 'chartStyleBtn', 'indicatorPickerBtn');
  const playback = group('toolbar-playback', alert, 'replayBtn');
  const history = group('toolbar-history', 'historyUndo', 'historyRedo');
  const workspace = document.querySelector('.workspace-controls');
  workspace.classList.add('toolbar-group');
  const utilities = group('toolbar-utilities', 'resetBtn', 'settingsBtn', 'fullscreenBtn');
  toolbar.replaceChildren(symbol, intervals, analysis, playback, history, workspace, utilities);
  const style = document.createElement('style');
  style.textContent = `
    .toolbar{height:44px;padding:0 10px;gap:0;background:#111112;overflow-x:auto;scrollbar-width:none}
    .toolbar::-webkit-scrollbar{display:none}
    .toolbar .toolbar-group{display:flex;align-items:center;gap:3px;flex:0 0 auto;height:28px;padding:0 9px;border-right:1px solid #353538}
    .toolbar .toolbar-symbol{padding-left:0}
    .toolbar .toolbar-utilities{border-right:0;padding-right:0}
    .toolbar .toolbar-history{border-right:0}
    .toolbar .workspace-controls{margin-left:auto;border-left:1px solid #353538}
    .toolbar button{height:32px;border-radius:5px;color:#bdbdc3;flex-shrink:0}
    .toolbar button:hover{background:#29292c;color:#fff}
    .toolbar button:focus-visible{outline:2px solid #789cf3;outline-offset:-2px}
    .toolbar button.active{background:#343437;color:#f5f5f6}
    .toolbar button:disabled{opacity:.3;cursor:default}
    .toolbar .toolbar-icon,.toolbar .icon,.toolbar .history-control{display:inline-flex;align-items:center;justify-content:center;width:32px;padding:6px}
    .toolbar svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.25;stroke-linecap:round;stroke-linejoin:round}
    .toolbar #symbolBtn{min-width:100px;padding:0 13px;text-align:left;border-radius:16px;background:#242427;font-size:12px;font-weight:600;letter-spacing:.15px}
    .toolbar .tf{display:flex;align-items:center;gap:1px}
    .toolbar .tf button{padding:0 7px;font-size:12px}
    .toolbar #chartStyleBtn{width:47px;justify-content:center;padding:5px;gap:5px;font-size:12px}
    .toolbar #styleName{display:none}
    .toolbar .layout-name{min-width:100px;max-width:145px;padding:1px 8px;justify-content:center;gap:1px;line-height:13px}
    .toolbar .layout-name span{max-width:129px;font-size:12px}
    .toolbar .layout-name small{font-size:9px;line-height:10px;color:#719dff}
    @media(max-width:1100px){.toolbar{padding:0 6px}.toolbar .toolbar-group{padding:0 5px;gap:1px}.toolbar .tf button{padding:0 5px}.toolbar #symbolBtn{min-width:85px}}
    @media(max-width:760px){.toolbar .tf .wide-tf{display:inline-block}.toolbar .toolbar-group{padding:0 5px}.toolbar .workspace-controls{margin-left:0}.toolbar .toolbar-icon,.toolbar .icon{width:30px}.toolbar #symbolBtn{min-width:78px}.toolbar .layout-name{min-width:90px}}
  `;
  document.head.append(style);
})();
