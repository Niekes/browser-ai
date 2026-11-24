import { expect, test } from "@playwright/test"

// No model runs here: a worker stands in for the engine. It hears the microphone's
// audio, as the real one does, and says "Hello world." once that audio is not silent.
function fakeEngine() {
  class FakeWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null
    postMessage(data: { type: string; id?: number; audio?: Float32Array }) {
      const reply = (message: object) => setTimeout(() => this.onmessage?.({ data: message }), 10)
      if (data.type === "probe") reply({ type: "probe", supported: true, cached: false })
      if (data.type === "load") {
        reply({ type: "progress", progress: 0.5 })
        reply({ type: "ready" })
      }
      if (data.type === "transcribe") {
        const audio = data.audio!
        const loud = audio.some((sample) => Math.abs(sample) > 0.05)
        const text = loud ? "Hello world." : ""
        reply({ type: "text", id: data.id, text, words: [] })
      }
    }
  }
  Object.assign(window, { Worker: FakeWorker })
}

test("dictates into the demo from the microphone", async ({ page }) => {
  await page.addInitScript(fakeEngine)
  await page.goto("docs/components/speech-input")
  const field = page.getByRole("tabpanel").getByLabel("Message")
  const mic = page.getByRole("button", { name: "Start dictation" })
  // Enabled once the page has hydrated and the engine has been probed.
  await expect(mic).toBeEnabled()
  await field.fill("Note:")

  await mic.click()
  await page.getByRole("button", { name: "Download" }).click()
  await page.getByRole("button", { name: "Start dictation" }).click()
  await expect(page.getByRole("button", { name: "Stop dictation" })).toBeVisible()
  await expect(field).toHaveValue("Note: Hello world.", { timeout: 5000 })

  await page.getByRole("button", { name: "Stop dictation" }).click()
  await expect(field).toHaveValue("Note: Hello world.")
  await expect(field).toBeEditable()
  await expect(field).toBeFocused()
})
