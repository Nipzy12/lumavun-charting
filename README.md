# LUMAVUN Charting Terminal

**Imagine Beyond the Mist.**

LUMAVUN is a browser-based financial charting terminal with real-time market data, historical navigation, technical indicators, advanced drawing tools, alerts, and bar replay.

## Features

- Candlestick, hollow candle, bar, line, area, Heikin Ashi, and other chart styles
- Real-time and historical market data adapters for Binance, OKX, Bitget, and biquote.io
- Infinite historical pagination with a local IndexedDB cache
- Horizontal and vertical panning, price scaling, future whitespace, and configurable right offset
- Technical indicators, volume, and a visual Indicator Studio
- Drawing tools including trend lines, Fibonacci retracement, shapes, annotations, and Long/Short Position
- Bar Replay with preserved viewport and price scale
- Price alerts and in-app notifications
- Multiple chart layouts, object tree, workspace persistence, undo, and redo
- Responsive desktop, tablet, and mobile interface

## Run locally

The application uses plain HTML, CSS, and JavaScript. No build step is required.

1. Clone the repository.
2. Start a static web server in the repository directory:

   ```bash
   python -m http.server 8000
   ```

3. Open [http://localhost:8000/syndicate-trade.html](http://localhost:8000/syndicate-trade.html).

Using a static server is recommended because browser storage and network behavior are more consistent than when opening the page through `file://`.

## Market data

Select market symbols and timeframes from the terminal. Public REST and WebSocket endpoints are used directly from the browser; no API keys are required by the current integrations.

Provider availability, supported intervals, history behavior, caching, and known network limitations are documented in [MARKET-DATA.md](MARKET-DATA.md).

Market data is provided by third parties and may be delayed, incomplete, or unavailable. LUMAVUN does not execute trades and is not financial advice.

## Tests

Run deterministic unit tests with Node.js:

```bash
node --test tests/market-data.test.cjs tests/indicator-engine.test.cjs
```

Browser interaction tests require Playwright and a Chromium-compatible browser:

```bash
node tests/chart-viewport.browser.cjs
node tests/future-whitespace.browser.cjs
node tests/replay-viewport.browser.cjs
node tests/position-tools.browser.cjs
node tests/market-feed.browser.cjs
node tests/indicator-studio.browser.cjs
```

Set `PLAYWRIGHT_MODULE` and `BROWSER_PATH` when Playwright or the browser is installed outside the default locations.

## Architecture

- `syndicate-trade.html` — application shell and chart initialization
- `vibe-trading.js` — financial rendering, viewport, price scale, and time scale extensions
- `market-adapters.js`, `market-client.js`, `market-feed.js` — provider normalization, history, and real-time feeds
- `chart-tools.js`, `drawing-editor.js`, `object-settings.js` — drawing system and object editing
- `indicator-*.js` — indicators and Indicator Studio
- `layout-workspace.js` — layouts, persistence, undo, and redo
- `vendor/` — pinned third-party libraries and their original licenses

Additional Indicator Studio details are available in [INDICATOR-STUDIO.md](INDICATOR-STUDIO.md).

## Third-party software

- [VibeCharts](https://github.com/alteredindian/VibeCharts), pinned at commit `c4b81f6e624d2b72efece5a670f1c159f93286a0`, under Apache License 2.0
- [Microsoft ASP.NET Core SignalR JavaScript client](https://github.com/dotnet/aspnetcore), version 8.0.0, under the MIT License

The corresponding license files and provenance notes are preserved under `vendor/`.

## License

A license for the original LUMAVUN source has not yet been selected. The vendored libraries remain governed by their respective licenses.

