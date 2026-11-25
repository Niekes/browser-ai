# WebGPU with 16-bit floats on the desktop

Context: ADR-0004 let only Chromium run the engine. On an Apple M5, Safari
27.2 and Firefox 161 expose WebGPU with `shader-f16` as Chrome does, and
Firefox loads the fp16 encoder with `webgpu-hybrid` and transcribes as
accurately as Chrome. Firefox is slower: every pass takes about 3 s, 5 s of
audio or 30 s alike, as each readback from the GPU waits about 100 ms.
Safari transcribes as accurately, 30 s in 0.8–3 s depending on the run, with
single passes stalling for seconds, and in two of three downloads it closed
the IndexedDB connection before parakeet.js could store the model ("The
database connection is closing"). Phones and tablets still lack the memory
for a 1.3 GB model.

Decision: the engine runs where the GPU adapter has `shader-f16` and the
page is not on a phone or a tablet. The worker checks the adapter; the page
tells it whether it is on a phone or a tablet (its user agent, or a Mac
with a touch screen, which is how iPadOS calls itself), as a worker cannot
see an iPad. Elsewhere the input says so and stays a plain textarea. There is still no WASM fallback.

What would reopen it: a desktop browser that passes the check and cannot
load or run the model, a Firefox fast enough for live text every second, or
a Safari that keeps the model cached.

## Considered Options

- **Adding Safari and Firefox by name.** Rejected: the adapter's features say
  what the engine needs, a browser's name does not.
- **A WASM fallback where `shader-f16` is missing.** Not built: every desktop
  browser measured has it, and live text on WASM is too slow (ADR-0004).
