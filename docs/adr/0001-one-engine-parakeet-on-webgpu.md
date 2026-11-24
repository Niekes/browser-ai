# One engine: Parakeet on WebGPU

Context: a speech input that runs in the browser needs a model that is
accurate, finds the language by itself and is fast enough to show live text.
Parakeet TDT 0.6B v3 (NVIDIA, CC-BY-4.0) through parakeet.js on
onnxruntime-web, with its encoder in 16-bit floats on WebGPU, transcribes
5 s of audio in 0.2–0.3 s and 30 s in 0.8–1.3 s on an Apple M5 in Chrome,
without cross-origin isolation.

Decision: Parakeet is the one engine of v1, behind no abstraction. The model
comes from `ysdede/parakeet-tdt-0.6b-v3-onnx` on Hugging Face, pinned to one
revision; nothing is self-hosted. The worker asks parakeet.js for the
`webgpu-hybrid` backend, with the 18 MB decoder in int8, which runs on WASM
in every WebGPU mode of parakeet.js: in parakeet.js 1.4.4 `webgpu` names no execution
provider, so the 1.2 GB encoder lands on WASM and runs out of memory, and
`webgpu-strict` starts the WASM runtime twice at once and fails.

What would reopen it: a second engine a user asks for, such as Whisper or
the Web Speech API of the browser, or a model that beats Parakeet on the
same measurement.

## Considered Options

- **Whisper through transformers.js.** Rejected for v1: slower for the same
  audio and prone to inventing text in silence.
- **The Web Speech API.** Rejected: Chrome sends the audio to a server.
- **An engine interface now.** Rejected: one implementation does not show
  what the interface should be.
