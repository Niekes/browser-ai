import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"

// The demo page in Chrome, with a WAV file for the microphone instead of a voice.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:5317/browser-ai/" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-audio-capture=${fileURLToPath(new URL("e2e/hello.wav", import.meta.url))}`,
          ],
        },
      },
    },
  ],
  webServer: {
    command: "pnpm docs:dev --port 5317 --strictPort",
    url: "http://localhost:5317/browser-ai/",
    reuseExistingServer: !process.env.CI,
  },
})
