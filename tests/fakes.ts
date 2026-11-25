// The hook reaches these fakes through the globals they stand in for, which fallow cannot follow.
// fallow-ignore-file unused-class-member
import { act } from "@testing-library/react"
import { vi } from "vite-plus/test"

// The engine runs in a Web Worker: the tests stand in for it and answer its messages.
export class FakeWorker {
  static last: FakeWorker
  sent: { type: string; [key: string]: unknown }[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  constructor() {
    FakeWorker.last = this
  }
  postMessage(message: { type: string }) {
    this.sent.push(message)
  }
  reply(data: object) {
    act(() => this.onmessage?.({ data }))
  }
}

// The microphone: an audio graph whose worklet hands the tests' samples to the hook.
export const track = { stop: vi.fn() }
export class FakeNode {
  static last: FakeNode
  port: { onmessage: ((event: { data: Float32Array }) => void) | null } = { onmessage: null }
  constructor() {
    FakeNode.last = this
  }
  disconnect() {}
  speak(seconds: number) {
    this.port.onmessage?.({ data: new Float32Array(16000 * seconds).fill(0.1) })
  }
}
class FakeContext {
  audioWorklet = { addModule: async () => {} }
  createMediaStreamSource() {
    return { connect() {} }
  }
  close = vi.fn(async () => {})
}

// The browser of a desktop Chrome: the worker, the audio graph and a microphone.
export function stubBrowser() {
  track.stop.mockClear()
  vi.stubGlobal("Worker", FakeWorker)
  vi.stubGlobal("AudioContext", FakeContext)
  vi.stubGlobal("AudioWorkletNode", FakeNode)
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) },
  })
}
