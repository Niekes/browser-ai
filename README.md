<p align="center">
  <strong>Local AI components for <a href="https://ui.shadcn.com">shadcn/ui</a>.</strong><br>
  The model runs in the browser: nothing leaves the machine, and there is no server to pay for.
</p>

<p align="center">
  <a href="https://github.com/niekes/browser-ai/actions/workflows/main.yml"><img src="https://github.com/niekes/browser-ai/actions/workflows/main.yml/badge.svg" alt="Build"></a>
  <a href="https://ui.shadcn.com/docs/registry"><img src="https://img.shields.io/badge/shadcn-registry-000000?logo=shadcnui&logoColor=white" alt="shadcn registry"></a>
  <a href="https://github.com/niekes/browser-ai/blob/main/LICENSE"><img src="https://img.shields.io/github/license/niekes/browser-ai" alt="License"></a>
</p>

<p align="center">
  <a href="https://niekes.github.io/browser-ai/docs">Docs</a> ·
  <a href="https://niekes.github.io/browser-ai/docs/installation">Installation</a> ·
  <a href="https://niekes.github.io/browser-ai/docs/components">Components</a> ·
  <a href="https://niekes.github.io/browser-ai/docs/how-it-works">How it works</a>
</p>

---

## Speech Input

A textarea that takes dictation. Click the microphone and speak: the words show at the cursor while you talk, and the final text lands there when you stop. Typing and speaking mix, Escape cancels.

```bash
npx shadcn@latest add niekes/browser-ai/speech-input
```

```tsx
const [message, setMessage] = useState("")

<SpeechInput value={message} onChange={setMessage} />
```

- **Local.** [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) runs on the GPU through WebGPU, with [parakeet.js](https://github.com/ysdede/parakeet.js). It finds the language by itself.
- **Asked first.** The model is about 1.3 GB. It downloads once the reader confirms it, and stays in the browser.
- **Fast.** On an Apple M5, 5 s of audio transcribe in 0.2–0.3 s and 30 s in about a second, so the live text follows every second.
- **Browsers.** Desktop browsers with WebGPU and 16-bit floats: Chrome and Edge; Firefox, where the live text follows every 3 s; and Safari, which does not always keep the model cached. Phones and tablets are left out; there the input says so and stays a textarea. No special headers needed.

The hook behind it, `useSpeechToText`, is an item of its own, for a dictation UI of your own:

```bash
npx shadcn@latest add niekes/browser-ai/use-speech-to-text
```

## Licenses

The code is [BSD-3-Clause](LICENSE). The model is NVIDIA's, licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/): credit it on a page that uses it. parakeet.js is MIT. See [NOTICE](NOTICE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
