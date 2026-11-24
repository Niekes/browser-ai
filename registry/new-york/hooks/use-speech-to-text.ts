"use client"

import { useId, useLayoutEffect, useRef, useSyncExternalStore } from "react"

/** Where the engine of the page and the dictation of an input stand. */
export type SpeechToTextStatus =
  | "checking"
  | "unsupported"
  | "not-downloaded"
  | "downloaded"
  | "downloading"
  | "loading"
  | "ready"
  | "error"
  | "busy"
  | "recording"
  | "finishing"

// The engine of the page, shared by every input that dictates: one worker, one model.
type EngineStatus = Exclude<SpeechToTextStatus, "busy" | "recording" | "finishing">

type Dictation = {
  owner: string
  phase: "recording" | "finishing"
  liveText: string
}

type Shared = {
  engine: EngineStatus
  progress: number
  error?: string
  dictation?: Dictation
}

type Word = { text: string; start: number; end: number }

const RATE = 16000
// The live text is transcribed anew about every second.
const PASS_MS = 1000
// Past a minute of audio the older text freezes; the last seconds stay live.
const WINDOW_S = 60
const LIVE_TAIL_S = 10

// Hands the samples of the microphone to the page, 128 at a time.
const RECORDER = `data:text/javascript,${encodeURIComponent(`
registerProcessor("speech-to-text-recorder", class extends AudioWorkletProcessor {
  process([input]) {
    if (input[0]) this.port.postMessage(input[0].slice(0))
    return true
  }
})`)}`

let shared: Shared = { engine: "checking", progress: 0 }
let worker: Worker | undefined
const listeners = new Set<() => void>()

const snapshot = () => shared

function update(next: Partial<Shared>) {
  shared = { ...shared, ...next }
  for (const listener of listeners) listener()
}

// The dictation in flight: its audio, the text frozen so far and the pass awaited.
let pending: { owner: string; onFinal: (text: string) => void } | undefined
let onFinal: (text: string) => void
let closeMic: (() => void) | undefined
let chunks: Float32Array[] = []
let samples = 0
let frozenText = ""
let frozenAt = 0
let pass = 0
let passStarted = 0
let timer: ReturnType<typeof setTimeout> | undefined

const join = (...parts: string[]) => parts.filter(Boolean).join(" ")

function audioSinceFrozen() {
  const audio = new Float32Array(samples - frozenAt)
  let offset = -frozenAt
  for (const chunk of chunks) {
    if (offset + chunk.length > 0)
      audio.set(chunk.subarray(Math.max(0, -offset)), Math.max(0, offset))
    offset += chunk.length
  }
  return audio
}

function transcribe() {
  pass += 1
  passStarted = Date.now()
  const audio = audioSinceFrozen()
  worker?.postMessage({ type: "transcribe", id: pass, audio }, [audio.buffer])
}

// Freezes the words that ended well before the end of a long window, cut between two words.
function freeze(words: Word[], seconds: number) {
  if (seconds <= WINDOW_S) return
  const kept = words.findIndex((word) => word.end > seconds - LIVE_TAIL_S)
  if (kept < 1) return
  frozenText = join(
    frozenText,
    words
      .slice(0, kept)
      .map((word) => word.text)
      .join(" ")
  )
  frozenAt += Math.round(words[kept].start * RATE)
}

function heard(data: { id: number; text: string; words: Word[] }) {
  const dictation = shared.dictation
  if (!dictation || data.id !== pass) return
  const text = join(frozenText, data.text.trim())
  if (dictation.phase === "finishing") {
    end()
    onFinal(text)
    return
  }
  update({ dictation: { ...dictation, liveText: text } })
  freeze(data.words, (samples - frozenAt) / RATE)
  timer = setTimeout(transcribe, Math.max(0, PASS_MS - (Date.now() - passStarted)))
}

async function openMic(onSamples: (chunk: Float32Array) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })
  const context = new AudioContext({ sampleRate: RATE })
  await context.audioWorklet.addModule(RECORDER)
  const node = new AudioWorkletNode(context, "speech-to-text-recorder")
  node.port.onmessage = ({ data }) => onSamples(data)
  context.createMediaStreamSource(stream).connect(node)
  return () => {
    node.disconnect()
    for (const track of stream.getTracks()) track.stop()
    void context.close()
  }
}

async function begin(owner: string, callback: (text: string) => void) {
  pending = undefined
  onFinal = callback
  chunks = []
  samples = 0
  frozenText = ""
  frozenAt = 0
  update({ error: undefined, dictation: { owner, phase: "recording", liveText: "" } })
  try {
    const close = await openMic((chunk) => {
      chunks.push(chunk)
      samples += chunk.length
    })
    // Stopped or cancelled while the browser asked for the microphone.
    if (shared.dictation?.owner !== owner || shared.dictation.phase !== "recording") return close()
    closeMic = close
    timer = setTimeout(transcribe, PASS_MS)
  } catch {
    end()
    update({ error: "The microphone is not available." })
  }
}

// Ends the dictation: the microphone goes, and every pass still under way is ignored.
function end() {
  clearTimeout(timer)
  closeMic?.()
  closeMic = undefined
  pass += 1
  update({ dictation: undefined })
}

function received({ data }: MessageEvent) {
  if (data.type === "probe") {
    const engine = !data.supported ? "unsupported" : data.cached ? "downloaded" : "not-downloaded"
    update({ engine })
  } else if (data.type === "progress") {
    update({ engine: "downloading", progress: data.progress })
  } else if (data.type === "ready") {
    update({ engine: "ready" })
    if (pending) void begin(pending.owner, pending.onFinal)
  } else if (data.type === "error") {
    pending = undefined
    if (shared.dictation) end()
    update({ engine: "error", error: data.message })
  } else {
    heard(data)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!worker) {
    worker = new Worker(new URL("./speech-to-text.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = received
    worker.postMessage({ type: "probe" })
  }
  return () => listeners.delete(listener)
}

function load() {
  update({ engine: shared.engine === "downloaded" ? "loading" : "downloading", progress: 0 })
  worker?.postMessage({ type: "load" })
}

function start(owner: string, callback: (text: string) => void) {
  if (shared.dictation || pending) return
  if (shared.engine === "ready") return begin(owner, callback)
  if (shared.engine !== "downloaded") return
  pending = { owner, onFinal: callback }
  load()
}

function stop(owner: string) {
  const dictation = shared.dictation
  if (dictation?.owner !== owner || dictation.phase !== "recording") return
  clearTimeout(timer)
  closeMic?.()
  closeMic = undefined
  update({ dictation: { ...dictation, phase: "finishing" } })
  transcribe()
}

function cancel(owner: string) {
  if (pending?.owner === owner) pending = undefined
  if (shared.dictation?.owner === owner) end()
}

function statusOf(state: Shared, owner: string): SpeechToTextStatus {
  if (state.dictation?.owner === owner) return state.dictation.phase
  if (state.dictation) return "busy"
  return state.engine
}

export type UseSpeechToTextOptions = {
  /** Receives the final text of a dictation, once it has been transcribed. */
  onFinal: (text: string) => void
}

/**
 * Dictation with a speech recognition model that runs in the browser. Every input on the page
 * shares one engine, and only one of them dictates at a time.
 */
export function useSpeechToText({ onFinal }: UseSpeechToTextOptions) {
  const owner = useId()
  // The final text goes to the callback of the latest render, not of the one that started.
  const final = useRef(onFinal)
  useLayoutEffect(() => {
    final.current = onFinal
  })
  const state = useSyncExternalStore(subscribe, snapshot, snapshot)
  const mine = state.dictation?.owner === owner

  return {
    /** Where the engine and this input's dictation stand. */
    status: statusOf(state, owner),
    /** How much of the model download is done, from 0 to 1. */
    progress: state.progress,
    /** The provisional text of this input's dictation. */
    liveText: mine ? state.dictation!.liveText : "",
    /** What went wrong last, if anything. */
    error: state.error,
    /** Starts the one-time model download, once the user confirmed it. */
    download: load,
    /** Starts a dictation, loading the downloaded model first if needed. */
    start: () => void start(owner, (text) => final.current(text)),
    /** Stops recording; the final text follows. */
    stop: () => stop(owner),
    /** Drops the dictation without any text. */
    cancel: () => cancel(owner),
  }
}
