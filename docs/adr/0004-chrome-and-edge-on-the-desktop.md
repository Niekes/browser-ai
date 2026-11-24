# Chrome and Edge on the desktop

Context: the encoder runs in 16-bit floats on WebGPU. Safari and Firefox
differ in their WebGPU, phones lack the memory for a 1.3 GB model, and on
WASM the model is far too slow for live text.

Decision: the engine runs where the browser is Chromium on a desktop
(`navigator.userAgentData`) and its GPU adapter has `shader-f16`. Elsewhere
the input says so and stays a plain textarea. There is no WASM fallback. The
page needs no cross-origin isolation: WebGPU and the single-threaded WASM of
the decoder do without `SharedArrayBuffer`.
