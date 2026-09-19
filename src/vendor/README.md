# Vendored dependencies

`ggwave.js` is the upstream Emscripten browser build from
<https://github.com/ggerganov/ggwave> (MIT licensed). It is vendored because the
published npm package does not yet expose the upstream frequency-start controls
used by SottoLink's test presets.
