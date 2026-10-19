# Public market feeds

Pilihan sumber ada pada **Feed** di toolbar. Default **Otomatis** memilih Binance untuk BTC/ETH/SOL dan biquote.io untuk EURUSD/XAUUSD. Pilihan Binance, OKX, Bitget, biquote, atau Simulasi juga tersedia secara eksplisit. Tidak ada API key atau koneksi akun/order.

## Provider

| Provider | REST history | Streaming | Instrumen di terminal |
| --- | --- | --- | --- |
| Binance | `data-api.binance.vision/api/v3/klines` | `data-stream.binance.vision/ws/{symbol}@kline_{interval}` | BTCUSDT, ETHUSDT, SOLUSDT spot |
| OKX | `www.okx.com/api/v5/market/candles` | `ws.okx.com/ws/v5/business` | BTC-USDT, ETH-USDT, SOL-USDT spot |
| Bitget v3 | `api.bitget.com/api/v3/market/candles?category=SPOT` | `ws.bitget.com/v3/ws/public`, topic `kline` | BTCUSDT, ETHUSDT, SOLUSDT spot |
| biquote.io | `biquote.io/api/{symbol}/ohlc` | SignalR `biquote.io/hubs/tick`, `Subscribe` / `ReceiveTick` | BTCUSD, ETHUSD, SOLUSD, EURUSD, XAUUSD, sesuai ketersediaan provider |

API ini menyediakan market data publik tanpa kredensial. Ketersediaan jaringan, batas request, batas wilayah, dan kualitas data tetap mengikuti provider. Tidak ada jaminan uptime/SLA dari terminal ini.

Sumber resmi yang diperiksa:

- Binance: https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md
- OKX REST/WebSocket: https://www.okx.com/docs-v5 ; endpoint candle memakai `/business`. URL WebSocket memakai port 443, bukan port 8443 yang dijadwalkan berhenti: https://my.okx.com/docs-v5/log_en/
- Bitget REST: https://www.bitget.com/docs/catalog/market/market-data
- Bitget WebSocket: https://www.bitget.com/docs/uta/websocket/public/Candlesticks-Channel dan https://www.bitget.com/docs/uta/quick-start
- biquote: https://biquote.io/docs/

Binance mendukung seluruh interval toolbar termasuk bulanan. OKX memakai UTC untuk candle harian, mingguan, dan bulanan. Bitget v3 yang digunakan tidak menawarkan 2H/1W/1M; biquote tidak menawarkan 3m/2H/1W/1M. Tombol interval yang tidak tersedia dinonaktifkan; tidak ada penggantian interval atau pencampuran feed secara diam-diam. Utility agregasi OHLCV tersedia untuk bucket intraday, minggu Senin UTC, dan bulan kalender UTC.

## Perilaku data

- Pembukaan awal mengambil satu halaman terbaru: Binance/Bitget hingga 1.000 candle, OKX hingga 300, dan biquote hingga 1.000. Jumlah aktual tetap bergantung provider. Semua timestamp dinormalisasi menjadi Unix seconds, diurutkan, dideduplikasi, dan divalidasi OHLCV.
- Ketika viewport mendekati sisi kiri, terminal meminta halaman yang lebih lama memakai cursor waktu provider: Binance `endTime`, OKX `history-candles?after`, Bitget `endTime`, dan biquote `to`. Halaman lama ditambahkan tanpa menggeser candle yang sedang dilihat. Respons kosong menandai batas awal history dan mencegah request berulang.
- History disimpan per `provider:symbol:timeframe` dalam chunk IndexedDB. Memory aktif dibatasi 50.000 candle dan cache browser memakai eviction LRU sekitar 250.000 candle. Saat pengguna menelusuri melewati jendela memory, sisi terbaru dilepas dari RAM tetapi tetap dicache; mencapai sisi kanan memulihkan jendela terbaru. Stream tetap diterima dan dicache selama pengguna melihat history lama. Request lama dibatalkan saat simbol/timeframe diganti dan halaman overlap dideduplikasi.
- Gap intraday dicatat setelah normalisasi. Penutupan akhir pekan forex/logam tidak dianggap kehilangan data dan engine tidak membuat candle flat untuk menutup gap.
- WebSocket memperbarui candle yang sama berdasarkan timestamp, atau menambah bar baru. Zoom tidak di-reset pada setiap tick.
- Binance/OKX memakai flag penutupan provider. Bitget menutup bar sebelumnya ketika candle baru datang. biquote membentuk candle berjalan dari tick `mid`, dan menutup bar sebelumnya ketika tick pada periode berikutnya datang.
- biquote `volume` forex/logam bisa nol. `tickVolume` disimpan terpisah; tidak disamakan dengan traded volume. Riwayat biquote dapat berasal dari beberapa feed agregasi/MT5/bootstrap sesuai dokumentasi mereka.
- Snapshot REST digunakan untuk pemulihan gap setelah reconnect. Tidak ada candle flat buatan untuk menutup periode tanpa data.
- Request lama dibatalkan dan event koneksi lama diabaikan setelah simbol, timeframe, atau sumber berubah. Chart sekunder memiliki subscription sendiri; kombinasi identik berbagi satu entry.
- Status membedakan memuat, terhubung/menunggu, live, reconnect, data terlambat, dan market tutup. Jika REST gagal dan belum ada data, chart kosong dengan pesan. Jika stream terputus setelah data tersedia, chart mempertahankan data terakhir dengan status reconnect. **Tidak ada fallback otomatis ke simulasi**.
- Retry memakai exponential backoff sampai 60 detik dan menghormati `Retry-After`. Tidak memakai loop polling harga. Data history dipulihkan saat koneksi gagal atau ada gap.
- Watchlist menampilkan data yang sudah dimuat oleh chart aktif/sekunder. Simbol yang belum dimuat tampil `—`; pilih simbol untuk memuat. Tidak ada harga simulasi yang disamarkan sebagai harga live.
- Kunci simbol lama seperti `BTCUSD` dipertahankan internal untuk kompatibilitas workspace. Tampilan dan sumber exchange menggunakan `BTCUSDT` secara eksplisit; quote USD dan USDT tidak dianggap identik.

## Viewport dan navigasi

- Pembukaan simbol/timeframe menampilkan 150 candle terbaru dengan right offset 10 bar. Dataset history tetap berada di memory/cache dan tidak dipadatkan menjadi satu layar.
- Right offset dapat diubah dari **Pengaturan → Skala dan garis → Ruang kanan**, rentang 0–50 bar, dan disimpan dalam layout.
- Panning ke kanan data dapat membuka future whitespace tanpa membuat candle sintetis. Batas bawaan 300 logical bar dapat diubah dari **Pengaturan → Skala dan garis → Batas ruang masa depan**. Posisi realtime tetap memakai right offset normal 10 bar.
- Label waktu masa depan diproyeksikan dari timeframe aktif. Crypto memakai kalender 24/7; forex dan logam melewati penutupan akhir pekan Jumat 22:00 UTC sampai Minggu 22:00 UTC. Crosshair memakai proyeksi waktu yang sama.
- Drag pada area chart menggeser waktu secara horizontal serta posisi harga secara vertikal. Drag pada price axis mengubah skala harga; drag pada time axis mengubah zoom horizontal. Wheel pada chart melakukan zoom horizontal berpusat di cursor, sedangkan wheel pada price axis melakukan zoom vertikal.
- Arah panning harga mengikuti cursor: drag ke atas mengangkat candle dan drag ke bawah menurunkannya. Drag diagonal menggeser waktu dan harga dalam satu interaksi. Panning memakai rentang harga chart, sehingga OHLC asli, crosshair, indikator, dan koordinat gambar tidak berubah.
- Saat sisi kiri viewport mendekati batas data, halaman history berikutnya dimuat otomatis. Anchor drag dan logical range digeser sebesar jumlah candle yang ditambahkan agar candle yang sedang dilihat tidak meloncat. Status **Loading historical candles…** ditampilkan selama request; respons kosong menampilkan **Beginning of available history** dan menutup pagination untuk rentang tersebut agar request tidak berulang.
- Panning atau zoom menjauh dari candle terbaru mengaktifkan mode navigasi bebas. Data WebSocket tetap diperbarui tanpa mengubah viewport. Tombol **Ke realtime** mengembalikan viewport ke sisi live dengan zoom pengguna dan right offset tetap dipertahankan.
- Tombol reset viewport kembali ke sekitar 150 candle terbaru. Tombol rentang **All** tetap menjadi aksi eksplisit untuk menampilkan seluruh candle dalam jendela memory. Reset price scale hanya mengaktifkan kembali autoscale vertikal dan tidak mengubah rentang waktu.

## Replay, indikator, gambar, layout

Replay menggunakan snapshot history pada saat dimulai. Aktivasi dan pemilihan titik replay mempertahankan logical range, jumlah bar terlihat, right offset, status follow, serta price scale; tidak menjalankan `fitContent()`. Titik awal ditempatkan dekat sisi kanan dengan ruang kosong logis tanpa membuat candle palsu. Playback mengikuti replay edge selama follow aktif, lalu berhenti mengikuti ketika pengguna menggeser chart. Saat replay ditutup, data live dan viewport sebelum replay dipulihkan. Stream dapat terus mengisi cache tetapi tidak mengubah candle replay. Indikator bawaan dan Indicator Studio dihitung dari OHLCV feed terpilih. Statistik pie/donut/radar/gauge/heatmap tetap simulasi seperti labelnya.

Alert biasa dan node Alert Condition dievaluasi pada penutupan bar live atau replay, bukan setiap tick pembentuk bar. Alert biasa terikat provider saat dibuat. Event Studio menyertakan nama sumber feed, bukan selalu `simulated`; deduplikasi juga memasukkan provider. Snapshot riwayat/reconnect tidak memicu ulang seluruh riwayat alert. Eksekusi tetap lokal selama halaman terbuka, tanpa backend 24/7.

Pemilihan provider disimpan bersama layout. Gambar dipisahkan per pilihan sumber agar gambar simulasi atau exchange lain tidak langsung dianggap cocok dengan feed baru. Titik gambar diberi waktu saat disimpan/diganti dan disejajarkan kembali dengan candle saat history berubah. Layout lama tanpa sumber data dibuka sebagai simulasi saat dipilih dari daftar layout. Pada startup pertama versi feed, gambar lama tersedia kembali melalui pilihan Simulasi.

## Cakupan history dan lisensi

- Binance dipaginasi mundur sampai pair mulai tersedia atau API mengembalikan halaman kosong. Terminal tidak mengunduh semuanya saat chart dibuka.
- OKX mendokumentasikan `history-candles` untuk data beberapa tahun; cakupan aktual bergantung instrumen dan interval.
- Bitget API dapat dipaginasi dengan `startTime/endTime`; arsip lebih tua juga ditawarkan melalui Download Center dan tidak disalin ke repository.
- biquote mendokumentasikan OHLC `from/to` untuk M1 sampai D1 serta sumber bootstrap, tick aggregation, dan MT5. Terminal hanya menampilkan rentang yang benar-benar dikembalikan API.
- Dukascopy sudah dievaluasi tetapi belum dimasukkan. Export/JForex menyediakan history forex/komoditas, namun penggunaan ulang memiliki ketentuan lisensi/atribusi dan jalur akses berbeda. Integrasi harus menunggu kepastian hak penggunaan untuk distribusi open-source.
- Cache merupakan salinan lokal pengguna untuk navigasi chart, bukan dataset yang didistribusikan bersama source code. Tidak ada API key atau dump market dalam Git.

## File

- `market-adapters.js`: kontrak provider dan transformasi data murni.
- `historical-cache.js`: penyimpanan chunk IndexedDB, deduplikasi, dan eviction.
- `market-client.js`: REST pagination, WebSocket/SignalR, heartbeat, cancellation, retry, cache, dan history recovery.
- `market-feed.js`: kontrol sumber, status UI, chart/watchlist/search, subscription chart sekunder, layout dan bar-close event.
- `vendor/signalr/`: Microsoft SignalR 8.0.0 untuk protokol hub biquote, beserta lisensi MIT.
- Integrasi kecil pada HTML, chart/replay, layout, symbol search, alert, dan Studio agar mendukung state kosong serta feed live.

Jalankan halaman melalui server statis (`python -m http.server 8000`) atau buka file HTML. Semua akses dilakukan langsung dari browser dengan TLS; tidak ada public CORS proxy dan verifikasi sertifikat tidak dinonaktifkan.

## Hasil verifikasi

Pada pengujian jaringan sesi implementasi:

- Binance: REST dan pembaruan candle WebSocket nyata berhasil di browser.
- Binance cursor `endTime` juga berhasil mengembalikan halaman M1 tahun 2017, sehingga traversal menuju awal pair tidak bergantung pada mock.
- biquote XAUUSD: REST dan SignalR tick nyata berhasil di browser.
- biquote `to` berhasil untuk rentang yang tersedia dan mengembalikan halaman kosong pada rentang yang tidak tersedia; respons kosong diperlakukan sebagai batas history, bukan data buatan.
- OKX: REST tidak dapat diakses dari lingkungan pengujian (timeout/fetch gagal).
- Bitget: REST gagal dari lingkungan pengujian; probe Node melaporkan `ERR_TLS_CERT_ALTNAME_INVALID`. Browser juga gagal fetch. Tidak ada klaim koneksi live berhasil untuk kedua provider ini; implementasi format REST/WS diuji dengan payload terkontrol.

Pengujian deterministik:

```powershell
node --test tests/market-data.test.cjs tests/indicator-engine.test.cjs
# Set PLAYWRIGHT_MODULE dan BROWSER_PATH sesuai instalasi lokal:
node tests/market-feed.browser.cjs
node tests/indicator-studio.browser.cjs
```

Mencakup normalisasi semua provider, interval/simbol, candle forming/closed, koreksi historis, penolakan frame dari subscription berbeda, pembatalan request lama, mid/tickVolume biquote, merge realtime, alert close deduplicated, isolasi replay, cleanup koneksi, serta error tanpa fallback simulasi. Tes browser memakai fixture; probe jaringan nyata dicatat terpisah di atas.
