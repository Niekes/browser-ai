// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { insertAtCursor } from "@/registry/new-york/ui/speech-input"
import { FakeNode, FakeRecognition, FakeWorker, stubBrowser } from "./fakes"

describe("insertAtCursor", () => {
  it("puts dictated text at the caret, spaced from the words around it", () => {
    expect(insertAtCursor("Hello world", 5, 5, "big")).toEqual({
      value: "Hello big world",
      caret: 9,
    })
  })

  it("replaces the selection", () => {
    expect(insertAtCursor("Hello there world", 6, 11, "big")).toEqual({
      value: "Hello big world",
      caret: 9,
    })
  })

  it("leaves the text as it is when nothing was said", () => {
    expect(insertAtCursor("Hello world", 5, 5, "")).toEqual({ value: "Hello world", caret: 5 })
  })

  it("keeps a space before the word after the caret", () => {
    expect(insertAtCursor("world", 0, 0, "Hello")).toEqual({ value: "Hello world", caret: 5 })
  })

  it("starts an empty field without a space", () => {
    expect(insertAtCursor("", 0, 0, "Hi.")).toEqual({ value: "Hi.", caret: 3 })
  })
})

// A form that owns the text, as react-hook-form or a state does.
async function mount(initial = "", props: { disabled?: boolean; browserFallback?: boolean } = {}) {
  vi.resetModules()
  const { SpeechInput } = await import("@/registry/new-york/ui/speech-input")
  const changes = vi.fn()
  function Form() {
    const [value, setValue] = useState(initial)
    return (
      <SpeechInput
        aria-label="Message"
        value={value}
        onChange={(next) => {
          changes(next)
          setValue(next)
        }}
        {...props}
      />
    )
  }
  render(<Form />)
  return {
    changes,
    worker: FakeWorker.last,
    field: screen.getByLabelText<HTMLTextAreaElement>("Message"),
  }
}

const mic = () => screen.getByRole("button", { name: /dictation/ })

// Clicks the mic with the caret at `at` and lets the cached model load.
async function dictate(worker: FakeWorker, field: HTMLTextAreaElement, at: number) {
  worker.reply({ type: "probe", supported: true, cached: true })
  field.setSelectionRange(at, at)
  fireEvent.click(mic())
  expect(screen.getByRole("status").textContent).toBe("Loading the speech model…")
  worker.reply({ type: "ready" })
  await act(async () => {})
}

beforeEach(stubBrowser)

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("SpeechInput", () => {
  it("takes typing", async () => {
    const { changes, field } = await mount()
    fireEvent.change(field, { target: { value: "Hi" } })
    expect(changes).toHaveBeenCalledWith("Hi")
  })

  it("asks before it downloads the model, then shows how far it got", async () => {
    const { worker } = await mount()
    worker.reply({ type: "probe", supported: true, cached: false })

    fireEvent.click(mic())
    fireEvent.click(screen.getByRole("button", { name: "Not now" }))
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull()

    fireEvent.click(mic())
    expect(worker.sent.map((m) => m.type)).toEqual(["probe"])
    fireEvent.click(screen.getByRole("button", { name: "Download" }))
    expect(worker.sent.at(-1)).toEqual({ type: "load" })

    worker.reply({ type: "progress", progress: 0.42 })
    expect(screen.getByLabelText("Downloading the speech model")).toBeTruthy()
    expect(screen.getByText("42%")).toBeTruthy()
    expect(mic().hasAttribute("disabled")).toBe(true)

    worker.reply({ type: "ready" })
    expect(mic().hasAttribute("disabled")).toBe(false)
  })

  it("shows the live text at the cursor and puts the final text there", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] })
    const { changes, worker, field } = await mount("Hello world")
    await dictate(worker, field, 5)
    expect(mic().getAttribute("aria-label")).toBe("Stop dictation")

    act(() => FakeNode.last.speak(1))
    act(() => vi.advanceTimersByTime(1000))
    worker.reply({ type: "text", id: worker.sent.at(-1)!.id, text: "big", words: [] })
    expect(field.value).toBe("Hello big world")
    expect(field.readOnly).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Stop dictation" }))
    expect(screen.getByRole("status").textContent).toBe("Transcribing…")
    worker.reply({ type: "text", id: worker.sent.at(-1)!.id, text: "big", words: [] })
    expect(changes).toHaveBeenCalledWith("Hello big world")
    expect(field.readOnly).toBe(false)

    await act(() => new Promise(requestAnimationFrame))
    expect(document.activeElement).toBe(field)
    expect(field.selectionStart).toBe(9)
  })

  it("cancels a dictation with Escape and keeps the text", async () => {
    const { changes, worker, field } = await mount("Hello")
    await dictate(worker, field, 5)
    fireEvent.keyDown(field, { key: "Escape" })
    expect(mic().getAttribute("aria-label")).toBe("Start dictation")
    fireEvent.keyDown(field, { key: "Escape" })
    expect(field.value).toBe("Hello")
    expect(changes).not.toHaveBeenCalled()
  })

  it("cancels with Escape while the model still loads", async () => {
    const { worker, field } = await mount("Hello")
    worker.reply({ type: "probe", supported: true, cached: true })
    fireEvent.click(mic())
    fireEvent.keyDown(field, { key: "Escape" })
    worker.reply({ type: "ready" })
    await act(async () => {})
    expect(mic().getAttribute("aria-label")).toBe("Start dictation")
  })

  it("says why it cannot dictate in this browser", async () => {
    const { worker } = await mount()
    worker.reply({ type: "probe", supported: false, cached: false })
    expect(screen.getByRole("status").textContent).toMatch(
      /desktop computer whose browser runs WebGPU with 16-bit floats/
    )
    expect(mic().hasAttribute("disabled")).toBe(true)
  })

  it("reports what went wrong", async () => {
    const { worker } = await mount()
    worker.reply({ type: "probe", supported: true, cached: true })
    worker.reply({ type: "error", message: "No GPU memory." })
    expect(screen.getByRole("alert").textContent).toBe("No GPU memory.")
  })

  it("stays off while the field is disabled", async () => {
    const { worker } = await mount("", { disabled: true })
    worker.reply({ type: "probe", supported: true, cached: true })
    expect(mic().hasAttribute("disabled")).toBe(true)
  })
})

describe("SpeechInput with the browser fallback", () => {
  beforeEach(() => vi.stubGlobal("webkitSpeechRecognition", FakeRecognition))

  it("says the browser's speech recognition hears the dictation, and dictates at the cursor", async () => {
    const { changes, worker, field } = await mount("Hello world", { browserFallback: true })
    worker.reply({ type: "probe", supported: false, cached: false })
    expect(screen.getByRole("status").textContent).toMatch(
      /browser's speech recognition.*leave this device/
    )

    field.setSelectionRange(5, 5)
    fireEvent.click(mic())
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull()
    FakeRecognition.last.hear("big")
    expect(field.value).toBe("Hello big world")
    expect(field.readOnly).toBe(true)
    expect(screen.getByRole("status").textContent).toMatch(/^Listening….*leave this device/)

    fireEvent.click(screen.getByRole("button", { name: "Stop dictation" }))
    FakeRecognition.last.end()
    expect(changes).toHaveBeenCalledWith("Hello big world")
    expect(field.readOnly).toBe(false)
  })

  it("cancels with Escape", async () => {
    const { changes, worker, field } = await mount("Hello", { browserFallback: true })
    worker.reply({ type: "probe", supported: false, cached: false })
    fireEvent.click(mic())
    FakeRecognition.last.hear("big")
    fireEvent.keyDown(field, { key: "Escape" })
    FakeRecognition.last.end()
    expect(field.value).toBe("Hello")
    expect(changes).not.toHaveBeenCalled()
  })

  it("keeps the notice where the page leaves it off", async () => {
    const { worker } = await mount()
    worker.reply({ type: "probe", supported: false, cached: false })
    expect(screen.getByRole("status").textContent).toMatch(/WebGPU with 16-bit floats/)
    expect(mic().hasAttribute("disabled")).toBe(true)
  })
})
