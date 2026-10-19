# VibeCharts (vendored)

Source: https://github.com/alteredindian/VibeCharts
Commit: c4b81f6e624d2b72efece5a670f1c159f93286a0

`VibeCharts.js` is an unmodified copy of `assets/js/VibeCharts.js`.
The upstream LICENSE is included. The terminal supplies its own layout styles;
the upstream dashboard stylesheet is not required.

`../../vibe-trading.js` subclasses VibeCharts to add financial chart rendering
and interaction. These features are local extensions, not upstream capabilities.

The vendored commit has no native drawing or annotation API and does not provide
Long Position or Short Position tools. Lumavun implements those tools in its
local drawing extension (`../../chart-tools.js`, `../../drawing-editor.js`, and
`../../object-settings.js`) without modifying `VibeCharts.js`.

The upstream chart also has no financial logical time scale, right offset, or
future-whitespace API. Those capabilities are implemented by the local
`../../vibe-trading.js` subclass. Future labels are projected from the active
timeframe and market calendar; no OHLC row is generated for empty space.
