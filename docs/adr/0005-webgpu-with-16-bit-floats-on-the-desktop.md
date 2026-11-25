# WebGPU with 16-bit floats on the desktop

Context: ADR-0004 let only Chromium run the engine. On an Apple M5, Safari
27.2 and Firefox 161 expose WebGPU with `shader-f16` as Chrome does, and
Firefox loads the fp16 encoder with `webgpu-hybrid` and transcribes as
accurately as Chrome. Firefox is slower: every pass takes about 3 s, 5 s of
audio or 30 s alike, as each readback from the GPU waits about 100 ms. Phones
and tablets still lack the memory for a 1.3 GB model.

Decision: the engine runs where the GPU adapter has `shader-f16` and the
page is not on a phone or a tablet. The worker checks the adapter; the page
tells it whether it is on a phone or a tablet (`navigator.userAgentData`,
else the user agent, and a Mac with a touch screen, which is how iPadOS
calls itself), as a worker cannot see an iPad. Elsewhere the input says so
and stays a plain textarea. There is still no WASM fallback.

What would reopen it: a desktop browser that passes the check and cannot
load or run the model, or a Firefox fast enough for live text every second.
