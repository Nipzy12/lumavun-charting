# Syndicate Indicator Studio v1

## Menjalankan

Buka `syndicate-trade.html` di browser desktop modern (Edge/Chrome), atau jalankan server statis dari direktori ini:

```powershell
python -m http.server 8000
```

Lalu buka `http://localhost:8000/syndicate-trade.html`. Server statis lebih sesuai untuk penggunaan rutin karena penyimpanan memiliki origin yang konsisten. Penyimpanan `file://`, localhost, profil browser lain, dan mode privat tidak dibagikan.

1. Klik ikon node di sidebar kanan, di bawah Statistik, atau buka **Indikator → Syndicate Indicator Studio**.
2. Contoh awal: **Close → EMA → Plot Line**. Pilih contoh RSI atau EMA crossover lewat **Contoh graph**.
3. Tambah node lewat library di kiri; pada mobile gunakan **Tambah node**.
4. Klik socket output lalu input untuk membuat koneksi. Alternatif: pilih node, lalu atur sumber setiap input pada **Node Properties**. Satu input hanya menerima satu koneksi; penggantian dilakukan atomik setelah validasi.
5. Geser header node untuk memindahkannya. Geser latar untuk pan; scroll atau tombol −/+ untuk zoom. **Fit** mengembalikan tampilan graph.
6. Pilih node untuk mengedit parameter; **Hapus node** menghapus node beserta koneksinya. Klik garis koneksi untuk menghapus koneksi saja. Undo/Redo tersedia di toolbar dan melalui Ctrl+Z / Ctrl+Y ketika editor fokus.
7. **Live Preview** memperbarui chart utama. Graph yang belum lengkap menampilkan pesan validasi, tidak dieksekusi. Preview tidak memicu alert dan dibersihkan ketika Studio ditutup.
8. **Add to Chart** memasang snapshot graph yang valid. Perubahan editor berikutnya perlu **Add to Chart** lagi untuk memperbarui indikator terpasang. Nama indikator tampil di kiri atas chart; klik nama untuk edit, lingkaran untuk tampil/sembunyi, × untuk hapus.
9. **Save** menyimpan definisi indikator di browser; **Load** membukanya kembali. Graph draft yang belum lengkap boleh disimpan, tetapi graph dengan parameter atau koneksi tidak valid ditolak. **Reset** membuat dokumen kosong baru. Load, Reset, dan pemilihan contoh mengganti dokumen editor; simpan dahulu untuk menyimpan dokumen lama.
10. **Simpan layout** mempertahankan indikator terpasang setelah reload, termasuk graph, parameter, visibilitas, dan status alert. Definisi indikator tersimpan dan layout memiliki siklus penyimpanan terpisah.

## Struktur dan keputusan arsitektur

Audit: terminal ini adalah HTML dengan script klasik modular, tanpa package manager atau build system. `vibe-trading.js` adalah perluasan lokal dari VibeCharts vendor. Sistem lain meliputi `chart-tools.js` / `drawing-editor.js` / `object-settings.js` untuk gambar, `indicator-legend.js` untuk indikator bawaan, `layout-workspace.js` untuk layout/history, dan `advanced-alerts.js` untuk alert replay.

Rete.js secara teknis dapat diintegrasikan melalui core, area, connection, dan renderer plugin; ia bukan library drop-in renderer untuk halaman ini. Versi ini memilih DOM/SVG Vanilla untuk mempertahankan pembukaan langsung HTML, tanpa dependency runtime/CDN, framework rendering, atau bundler baru. Referensi: https://retejs.org/docs/concepts/editor/ dan https://retejs.org/docs/concepts/presets/.

File baru:

- `indicator-nodes.js`: definisi node, tipe socket, parameter, deskripsi, contoh graph.
- `indicator-engine.js`: validasi, topological sort, evaluasi numerik/boolean, output plot/marker/alert. Tidak memakai DOM, chart, storage, network, `eval`, atau kode pengguna.
- `indicator-storage.js`: adapter localStorage dengan record berversi. Dapat diganti adapter cloud; tidak ada konfigurasi Firebase.
- `indicator-preview.js`: pemilik series Studio, deduplikasi, marker, integrasi replay/alert, dan serialisasi layout.
- `indicator-studio.js` / `.css`: editor, interaksi socket, properties, history, sidebar, dan daftar indikator aktif.
- `tests/indicator-engine.test.cjs` / `tests/indicator-studio.browser.cjs`: pengujian deterministik dan integrasi browser.

Perubahan integrasi:

- `syndicate-trade.html`: memuat stylesheet dan modul Studio setelah modul terminal sebelumnya.
- `vibe-trading.js`: API lokal `removeSeries`, `setStudioMarkers`, dan opsi series `pane: 'oscillator'`. Ini implementasi milik terminal, **bukan klaim API upstream VibeCharts atau Lightweight Charts**. VibeCharts vendor tidak diubah.

## Kontrak engine

Graph v1 berisi `nodes: [{id,type,x,y,params}]` dan `edges: [{id,from,to,input}]`. Output satu node memiliki tipe `number` atau `boolean`; node Output tidak dapat menjadi sumber koneksi. Semua input wajib terhubung kecuali B pada perbandingan, yang memakai parameter `threshold` bila tidak terhubung. `Constant` tersedia untuk ambang eksplisit.

`SyndicateEngine.validate(graph, {incomplete})` menghasilkan errors dan urutan topologis. `execute(graph, bars)` menerima OHLCV berurutan, numerik, dengan waktu unik. Hasilnya memiliki `values` (Map per node), `plots`, `markers`, dan `alerts`. Map dapat dikonversi dengan `Object.fromEntries` untuk serialisasi backend. Compiler Syndicate Script di masa depan dapat menargetkan graph v1 yang sama; scripting dan backtesting belum diimplementasikan.

- SMA: rata-rata jendela penuh. EMA: seed SMA periode pertama, lalu alpha `2/(period+1)`. Seed ini berbeda dari helper EMA bawaan terminal yang memulai dari harga pertama.
- RSI: smoothing Wilder; periode N memerlukan N+1 harga. Deret datar memberi 50; tanpa kerugian memberi 100.
- Nilai warm-up berupa `null`, tidak dipaksa menjadi nol. Crossover membutuhkan nilai valid bar sebelumnya. AND/OR memakai logika tiga nilai dengan short-circuit false/true yang sudah pasti.
- Plot menghilangkan nilai belum tersedia. Marker/alert dengan **Hanya saat kondisi mulai true** memerlukan transisi eksplisit false → true, bukan null → true.
- Source memakai OHLCV asli simulasi, termasuk ketika chart tampil dalam Heikin Ashi. Tidak ada look-ahead: setiap output pada bar i hanya menggunakan bar sampai i.
- Batas v1: 128 node, 512 koneksi, 100.000 bar per evaluasi, dan 12 indikator Studio terpasang. Preview editor diberi debounce 100 ms.

## Alert dan keterbatasan

Node Alert Condition hanya aktif setelah **Add to Chart**. Mulai replay, pilih titik awal, lalu maju satu bar atau jalankan replay. Setiap bar replay baru dianggap bar tertutup. Kondisi tidak mengirim ulang seluruh sinyal historis saat attach/preview, dan kombinasi indikator + node + simbol + timeframe + waktu bar dideduplikasi sepanjang sesi halaman, termasuk jika replay dimundurkan.

Peringatan muncul sebagai toast serta riwayat di sidebar Peringatan. Jeda/Aktifkan tersedia per indikator. Menyembunyikan plot tidak mematikan alert; gunakan tombol Jeda pada panel Peringatan. Maksimum 200 event disimpan di memori, 20 terakhir ditampilkan. Event/riwayat tidak bertahan setelah reload.

Event `syndicate:indicator-alert` memiliki payload JSON-ready:

```js
{
  version: 1, type: 'indicator.alert', id: 'dedup-key',
  indicatorId: '...', indicatorName: '...', nodeId: '...',
  symbol: 'XAUUSD', timeframe: '15m', barTime: 1234567890,
  close: 3980.28, message: '...', source: 'simulated',
  createdAt: 'ISO timestamp'
}
```

Tidak ada pengiriman webhook, email, cloud sync, atau eksekusi 24/7. Cloudflare Worker nantinya dapat memakai kontrak engine/event yang sama, tetapi belum terhubung.

Versi ini menampilkan Studio pada chart utama saja; chart sekunder tetap memakai indikator bawaan. Semua plot osilator berbagi satu pane dan skala, dengan garis panduan 30/70; pilih pane osilator secara eksplisit pada Plot Line (contoh RSI sudah disetel). Pane belum dapat di-resize secara terpisah. Preview menggunakan perhitungan batch sinkron, belum Web Worker/incremental engine. Editor mobile mendukung pan, zoom lewat tombol, tambah node via select, dan properties drawer; graph besar memerlukan zoom/pan.

## Pengujian

Tanpa dependency untuk engine:

```powershell
node --test tests/indicator-engine.test.cjs
```

Browser test memerlukan Playwright dan browser Chromium/Edge. Gunakan paket yang tersedia di lingkungan Anda:

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/path/to/node_modules/playwright'
$env:BROWSER_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node tests/indicator-studio.browser.cjs
```

Pengujian engine mencakup referensi SMA/EMA/RSI, crossover, AND/OR, urutan marker, warm-up, invalid graph/parameter, siklus, batas graph, data tanpa look-ahead, serta storage roundtrip. Browser test mencakup parameter dan koneksi, penolakan siklus, hapus, undo/redo, drag node, Save/Load, tidak ada duplicate series, pane RSI, desktop/tablet/mobile, alert replay deduplicated, marker, drawing click-click, dan reload layout.
