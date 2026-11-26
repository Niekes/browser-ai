# browser-ai

Shared language for the registry of local AI components. The terms here
describe what the reader does and sees, not how the code does it.

## Speech input

**Dictation**:
One recording, from the click on the microphone until it is stopped or
cancelled. One input dictates at a time on a page.
_Avoid_: recording session, utterance, take

**Live text**:
The provisional text shown during a dictation, at the cursor, while the
reader speaks. It may still change.
_Avoid_: partial, interim result, preview

**Final text**:
The text after the last pass, when the dictation is stopped. It replaces the
live text and becomes part of the input's value.
_Avoid_: result, transcript, committed text

**Model download**:
The one-time loading of the model into the browser's cache, which the reader
confirms before it starts.
_Avoid_: install, setup, fetch

**Engine**:
The model and the runtime that turn a dictation into text.
_Avoid_: backend, provider, recognizer, ASR

**Browser fallback**:
The browser's own speech recognition, which takes the dictation where the
engine cannot run, if the page turns it on. It need not run on the device:
the audio may go to the browser's maker.
_Avoid_: native engine, Web Speech engine, cloud mode
