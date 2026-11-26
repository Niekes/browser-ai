# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `browserFallback`, an option of `SpeechInput` and `useSpeechToText`, off by
  default: where the engine cannot run - a phone, a tablet, an iPad, a
  browser without WebGPU and `shader-f16` - the dictation goes to the
  browser's own speech recognition (Web Speech API), with the status
  `browser-fallback` and a note that the audio may leave the device. The
  examples of the docs turn it on.

## [0.1.0] - 2026-11-26

### Added

- `speech-input`, `SpeechInput`: a textarea that takes dictation. The mic
  button records, the live text shows at the cursor while the reader speaks,
  and the final text lands there on stop; Escape cancels. Controlled by
  `value` and `onChange`, so it works with react-hook-form.
- `use-speech-to-text`, `useSpeechToText`: the hook behind it - the
  microphone, a Web Worker and Parakeet TDT 0.6B v3 on WebGPU, one engine
  per page and one dictation at a time. The model downloads once the reader
  confirms it.

### Changed

- The engine runs in every desktop browser whose GPU has WebGPU with 16-bit
  floats (`shader-f16`), no longer only in Chrome and Edge: Firefox runs it,
  with live text every 3 s, and Safari, which keeps the model cached only if
  the page stays in view while it downloads. Phones and tablets, iPad included, stay left out.
