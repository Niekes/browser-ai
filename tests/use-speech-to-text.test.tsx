// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { FakeNode, FakeWorker, stubBrowser, track } from "./fakes"

let useOther: () => { status: string; start: () => void }

async function load() {
  vi.resetModules()
  const module = await import("@/registry/new-york/hooks/use-speech-to-text")
  useOther = () => module.useSpeechToText({ onFinal: () => {} })
  return module
}

// A hook whose engine is loaded, ready for a dictation.
async function ready(onFinal = vi.fn()) {
  const { useSpeechToText } = await load()
  const hook = renderHook(() => useSpeechToText({ onFinal }))
  FakeWorker.last.reply({ type: "probe", supported: true, cached: true })
  await act(async () => hook.result.current.start())
  FakeWorker.last.reply({ type: "ready" })
  await act(async () => {})
  return { ...hook, onFinal, worker: FakeWorker.last }
}

beforeEach(stubBrowser)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useSpeechToText", () => {
  it("says so where the browser cannot run the engine", async () => {
    const { useSpeechToText } = await load()
    const { result } = renderHook(() => useSpeechToText({ onFinal: () => {} }))
    expect(result.current.status).toBe("checking")

    FakeWorker.last.reply({ type: "probe", supported: false, cached: false })
    expect(result.current.status).toBe("unsupported")
  })

  it("downloads the model only once asked to, and reports how far it got", async () => {
    const { useSpeechToText } = await load()
    const { result } = renderHook(() => useSpeechToText({ onFinal: () => {} }))
    FakeWorker.last.reply({ type: "probe", supported: true, cached: false })
    expect(result.current.status).toBe("not-downloaded")
    expect(FakeWorker.last.sent.map((m) => m.type)).toEqual(["probe"])

    act(() => result.current.download())
    expect(FakeWorker.last.sent.at(-1)).toEqual({ type: "load" })
    FakeWorker.last.reply({ type: "progress", progress: 0.25 })
    expect(result.current).toMatchObject({ status: "downloading", progress: 0.25 })

    FakeWorker.last.reply({ type: "ready" })
    expect(result.current.status).toBe("ready")
  })

  it("shows live text while recording and hands over the final text on stop", async () => {
    vi.useFakeTimers()
    const { result, onFinal, worker } = await ready()
    expect(result.current.status).toBe("recording")

    act(() => FakeNode.last.speak(1))
    act(() => vi.advanceTimersByTime(1000))
    const pass = worker.sent.at(-1)!
    expect(pass).toMatchObject({ type: "transcribe" })
    expect((pass.audio as Float32Array).length).toBe(16000)

    worker.reply({ type: "text", id: pass.id, text: "Hello", words: [] })
    expect(result.current.liveText).toBe("Hello")

    act(() => FakeNode.last.speak(0.5))
    act(() => result.current.stop())
    expect(result.current.status).toBe("finishing")
    const last = worker.sent.at(-1)!
    expect((last.audio as Float32Array).length).toBe(24000)
    expect(track.stop).toHaveBeenCalled()

    worker.reply({ type: "text", id: last.id, text: "Hello world.", words: [] })
    expect(onFinal).toHaveBeenCalledWith("Hello world.")
    expect(result.current).toMatchObject({ status: "ready", liveText: "" })
    vi.useRealTimers()
  })

  it("drops a cancelled dictation without any text", async () => {
    vi.useFakeTimers()
    const { result, onFinal, worker } = await ready()
    act(() => FakeNode.last.speak(1))
    act(() => vi.advanceTimersByTime(1000))
    const pass = worker.sent.at(-1)!
    act(() => result.current.cancel())
    worker.reply({ type: "text", id: pass.id, text: "Hello", words: [] })

    expect(onFinal).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({ status: "ready", liveText: "" })
    vi.useRealTimers()
  })

  it("lets one input dictate at a time", async () => {
    const { result } = await ready()
    const other = renderHook(() => useOther())
    expect(other.result.current.status).toBe("busy")
    await act(async () => other.result.current.start())
    expect(result.current.status).toBe("recording")
    expect(other.result.current.status).toBe("busy")
  })

  it("freezes the older text past a minute and transcribes only the rest", async () => {
    vi.useFakeTimers()
    const { result, onFinal, worker } = await ready()
    act(() => FakeNode.last.speak(30))
    act(() => FakeNode.last.speak(40))
    act(() => vi.advanceTimersByTime(1000))
    // Words that all still lie in the last seconds, or none past them: nothing to freeze yet.
    const late = [{ text: "Late", start: 65, end: 66 }]
    worker.reply({ type: "text", id: worker.sent.at(-1)!.id, text: "Late", words: late })
    act(() => vi.advanceTimersByTime(1000))
    const early = [{ text: "Early", start: 1, end: 2 }]
    worker.reply({ type: "text", id: worker.sent.at(-1)!.id, text: "Early", words: early })
    act(() => vi.advanceTimersByTime(1000))
    expect((worker.sent.at(-1)!.audio as Float32Array).length).toBe(16000 * 70)
    const words = [
      { text: "Early", start: 1, end: 2 },
      { text: "words.", start: 2, end: 3 },
      { text: "Late", start: 65, end: 66 },
      { text: "words.", start: 66, end: 67 },
    ]
    worker.reply({
      type: "text",
      id: worker.sent.at(-1)!.id,
      text: "Early words. Late words.",
      words,
    })
    expect(result.current.liveText).toBe("Early words. Late words.")

    act(() => result.current.stop())
    const last = worker.sent.at(-1)!
    expect((last.audio as Float32Array).length).toBe(16000 * 5)
    worker.reply({ type: "text", id: last.id, text: "Late words, final.", words: [] })
    expect(onFinal).toHaveBeenCalledWith("Early words. Late words, final.")
    vi.useRealTimers()
  })

  it("reports a microphone it may not use", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: async () => Promise.reject(new Error("denied")) },
    })
    const { result } = await ready()
    expect(result.current).toMatchObject({
      status: "ready",
      error: "The microphone is not available.",
    })
  })

  it("reports an engine that failed to load", async () => {
    const { useSpeechToText } = await load()
    const { result } = renderHook(() => useSpeechToText({ onFinal: () => {} }))
    FakeWorker.last.reply({ type: "probe", supported: true, cached: false })
    act(() => result.current.download())
    FakeWorker.last.reply({ type: "error", message: "No GPU memory." })
    expect(result.current).toMatchObject({ status: "error", error: "No GPU memory." })
  })

  it("ends a dictation whose transcription failed", async () => {
    const { result, worker } = await ready()
    act(() => result.current.stop())
    worker.reply({ type: "error", message: "Device lost." })
    expect(result.current).toMatchObject({ status: "error", error: "Device lost.", liveText: "" })
    expect(track.stop).toHaveBeenCalled()
  })

  it("lets go of a microphone granted after the dictation was cancelled", async () => {
    let grant!: (stream: unknown) => void
    const stream = new Promise((resolve) => (grant = resolve))
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => stream } })
    const { result } = await ready()
    act(() => result.current.cancel())
    await act(async () => grant({ getTracks: () => [track] }))
    expect(track.stop).toHaveBeenCalled()
    expect(result.current.status).toBe("ready")
  })

  it("ignores what does not apply to where it stands", async () => {
    const { useSpeechToText } = await load()
    const { result } = renderHook(() => useSpeechToText({ onFinal: () => {} }))
    act(() => result.current.start())
    expect(FakeWorker.last.sent.map((m) => m.type)).toEqual(["probe"])

    FakeWorker.last.reply({ type: "probe", supported: true, cached: true })
    act(() => result.current.start())
    act(() => result.current.start())
    act(() => result.current.stop())
    act(() => result.current.cancel())
    expect(FakeWorker.last.sent.map((m) => m.type)).toEqual(["probe", "load"])
    FakeWorker.last.reply({ type: "ready" })
    await act(async () => {})
    act(() => result.current.cancel())
    await act(async () => result.current.start())
    expect(result.current.status).toBe("recording")
  })
})
