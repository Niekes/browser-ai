import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

const transcribe = vi.fn()
const fromHub = vi.fn()
vi.mock("parakeet.js", () => ({ fromHub }))

const sent: { type: string; [key: string]: unknown }[] = []
const scope: {
  postMessage: (data: never) => void
  onmessage?: (event: { data: unknown }) => void
} = {
  postMessage: (data) => sent.push(data),
}

// IndexedDB as parakeet.js leaves it: a store of the files it cached, by key.
function fakeIndexedDB(keys: string[], fails = false) {
  return {
    open() {
      const request: Record<string, unknown> = {}
      queueMicrotask(() => {
        if (fails) return (request.onerror as () => void)()
        const store = {
          count: (key: string) => {
            const count: Record<string, unknown> = {}
            queueMicrotask(() =>
              (count.onsuccess as (e: unknown) => void)({
                target: { result: keys.includes(key) ? 1 : 0 },
              })
            )
            return count
          },
        }
        request.result = {
          transaction: () => ({ objectStore: () => store }),
          createObjectStore() {},
        }
        ;(request.onupgradeneeded as () => void)?.call(null)
        ;(request.onsuccess as () => void)()
      })
      return request
    },
  }
}

const browser = (features: string[]) => ({
  gpu: { requestAdapter: async () => ({ features: new Set(features) }) },
})

const KEY = (file: string) =>
  `hf-ysdede/parakeet-tdt-0.6b-v3-onnx-e5356bf6e24bdb7a269536b0e9e7869bc034b893--${file}`
const ALL = ["encoder-model.fp16.onnx", "decoder_joint-model.int8.onnx", "vocab.txt"].map(KEY)

async function send(data: object) {
  scope.onmessage?.({ data })
  await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0))
  await new Promise((resolve) => setTimeout(resolve))
  return sent.splice(0)
}

beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal("self", scope)
  vi.stubGlobal("navigator", browser(["shader-f16"]))
  vi.stubGlobal("indexedDB", fakeIndexedDB(ALL))
  fromHub.mockReset().mockResolvedValue({ transcribe })
  transcribe.mockReset()
  await import("@/registry/new-york/hooks/speech-to-text.worker")
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the speech-to-text worker", () => {
  it("finds the engine runnable and its model cached", async () => {
    expect(await send({ type: "probe" })).toEqual([
      { type: "probe", supported: true, cached: true },
    ])
  })

  it("finds a model that is not cached yet", async () => {
    vi.stubGlobal("indexedDB", fakeIndexedDB(ALL.slice(1)))
    expect(await send({ type: "probe" })).toEqual([
      { type: "probe", supported: true, cached: false },
    ])
    vi.stubGlobal("indexedDB", fakeIndexedDB(ALL, true))
    expect(await send({ type: "probe" })).toEqual([
      { type: "probe", supported: true, cached: false },
    ])
  })

  it.each([
    ["a GPU without 16-bit floats", browser([]), false],
    ["a phone or a tablet", browser(["shader-f16"]), true],
    ["a browser without WebGPU", {}, false],
    ["a GPU it cannot get", { gpu: { requestAdapter: async () => null } }, false],
  ])("finds no engine on %s", async (_, agent, mobile) => {
    vi.stubGlobal("navigator", agent)
    expect(await send({ type: "probe", mobile })).toEqual([
      { type: "probe", supported: false, cached: false },
    ])
  })

  it("loads the pinned model, reports the download and warms it up", async () => {
    fromHub.mockImplementation(async (_repo, options) => {
      options.progress({ file: "encoder-model.fp16.onnx", loaded: 628632294, total: 1238960452 })
      return { transcribe }
    })
    const messages = await send({ type: "load" })

    expect(fromHub).toHaveBeenCalledWith(
      "ysdede/parakeet-tdt-0.6b-v3-onnx",
      expect.objectContaining({
        revision: "e5356bf6e24bdb7a269536b0e9e7869bc034b893",
        backend: "webgpu-hybrid",
        encoderQuant: "fp16",
        decoderQuant: "int8",
      })
    )
    expect(messages).toEqual([{ type: "progress", progress: 0.5 }, { type: "ready" }])
    expect(transcribe).toHaveBeenCalledWith(new Float32Array(16000), 16000)
  })

  it("transcribes audio into text and timed words", async () => {
    await send({ type: "load" })
    transcribe.mockResolvedValue({
      utterance_text: "Hello world.",
      words: [{ text: "Hello", start_time: 0.1, end_time: 0.4 }],
    })
    const audio = new Float32Array(16000)
    expect(await send({ type: "transcribe", id: 3, audio })).toEqual([
      {
        type: "text",
        id: 3,
        text: "Hello world.",
        words: [{ text: "Hello", start: 0.1, end: 0.4 }],
      },
    ])
    expect(transcribe).toHaveBeenLastCalledWith(audio, 16000, { returnTimestamps: true })
  })

  it("reports what failed", async () => {
    fromHub.mockRejectedValue(new Error("No GPU memory."))
    expect(await send({ type: "load" })).toEqual([{ type: "error", message: "No GPU memory." }])
    fromHub.mockRejectedValue("lost")
    expect(await send({ type: "load" })).toEqual([{ type: "error", message: "lost" }])
  })
})
