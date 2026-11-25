/// <reference lib="webworker" />
import type { ParakeetModel } from "parakeet.js"

// Parakeet TDT 0.6B v3 (CC-BY-4.0, NVIDIA) in ONNX, pinned to one revision of the repository.
const REPO = "ysdede/parakeet-tdt-0.6b-v3-onnx"
const REVISION = "e5356bf6e24bdb7a269536b0e9e7869bc034b893"
// The files parakeet.js downloads for this setup, with their sizes in bytes at that revision.
const FILES: Record<string, number> = {
  "encoder-model.fp16.onnx": 1238960452,
  "decoder_joint-model.int8.onnx": 18202004,
  "vocab.txt": 102132,
}
const TOTAL = Object.values(FILES).reduce((sum, size) => sum + size, 0)

declare const self: DedicatedWorkerGlobalScope

let model: ParakeetModel | undefined
// One message at a time: a session of the model runs one transcription at once.
let queue = Promise.resolve()

type UserAgentData = { brands: { brand: string }[]; mobile: boolean }

// Chrome and Edge on the desktop, with a GPU that computes in 16-bit floats.
async function supported() {
  const agent = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData
  if (!agent?.brands.some(({ brand }) => brand === "Chromium") || agent.mobile) return false
  const adapter = await navigator.gpu?.requestAdapter()
  return !!adapter?.features.has("shader-f16")
}

// Whether parakeet.js holds every file in its IndexedDB cache already.
// shortcut: reads the private cache layout of parakeet.js 1.4.4; check it again on an upgrade.
function cached() {
  return new Promise<boolean>((resolve) => {
    const request = indexedDB.open("parakeet-cache-db", 1)
    // The store parakeet.js creates itself: a database opened first without it would lack it.
    request.onupgradeneeded = () => request.result.createObjectStore("file-store")
    request.onerror = () => resolve(false)
    request.onsuccess = () => {
      const store = request.result.transaction("file-store").objectStore("file-store")
      const keys = Object.keys(FILES).map((file) => `hf-${REPO}-${REVISION}--${file}`)
      let found = 0
      for (const key of keys) {
        store.count(key).onsuccess = (event) => {
          found += (event.target as IDBRequest<number>).result
          if (key === keys.at(-1)) resolve(found === keys.length)
        }
      }
    }
  })
}

async function load() {
  const { fromHub } = await import("parakeet.js")
  const loaded: Record<string, number> = {}
  model = await fromHub(REPO, {
    revision: REVISION,
    backend: "webgpu-hybrid",
    encoderQuant: "fp16",
    decoderQuant: "int8",
    progress: ({ file, loaded: bytes }) => {
      loaded[file] = bytes
      const done = Object.values(loaded).reduce((sum, size) => sum + size, 0)
      self.postMessage({ type: "progress", progress: Math.min(1, done / TOTAL) })
    },
  })
  // The first pass compiles the shaders: it runs now, not on the first word.
  await model.transcribe(new Float32Array(16000), 16000)
  self.postMessage({ type: "ready" })
}

async function transcribe(id: number, audio: Float32Array) {
  const result = await model!.transcribe(audio, 16000, { returnTimestamps: true })
  const words = result.words.map((word) => ({
    text: word.text,
    start: word.start_time,
    end: word.end_time,
  }))
  self.postMessage({ type: "text", id, text: result.utterance_text, words })
}

async function handle(data: { type: string; id: number; audio: Float32Array }) {
  if (data.type === "probe") {
    const ok = await supported()
    self.postMessage({ type: "probe", supported: ok, cached: ok && (await cached()) })
  } else if (data.type === "load") {
    await load()
  } else {
    await transcribe(data.id, data.audio)
  }
}

self.onmessage = ({ data }) => {
  queue = queue
    .then(() => handle(data))
    .catch((error: unknown) => {
      self.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    })
}
