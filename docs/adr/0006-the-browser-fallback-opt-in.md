# The browser fallback, opt-in

Context: ADR-0001 rejected the Web Speech API because Chrome sends the audio
to a server. Where the engine cannot run - a phone, a tablet, an iPad, a
browser without WebGPU and `shader-f16` (ADR-0005) - the input says so and
stays a plain textarea. The owner wants to try the docs on an iPad, and a
page may prefer a dictation that leaves the device to none at all. Safari
hands the audio to Apple's speech recognition, Chrome to Google's servers;
Firefox has no API.

Decision: `browserFallback`, an option of the hook and the component, off by
default, hands the dictation to the browser's `SpeechRecognition` (or
`webkitSpeechRecognition`) only where the engine cannot run and the browser
has the API. Wherever the engine runs, it is used. The status is
`browser-fallback`, and the input says the browser's speech recognition is
used and the audio may leave the device; there is no model download. The
dictation behaves as with the engine: live text from the interim results,
the final text when the browser ends after a stop or a silence, Escape
cancels. The language is the page's (`lang` of the document, else the
browser's), as the API needs one and the engine needs none. Off, nothing
changes: the registry's promise that everything stays local holds unless a
page turns it on. The examples of the docs turn it on.

What would reopen it: on-device recognition in the browsers
(`processLocally` in Chrome) that keeps the audio local, or a second engine
small enough for phones.

## Considered Options

- **On by default.** Rejected: a page that installs the registry would send
  audio off the device without having chosen to.
- **An engine interface.** Rejected: two paths in one module do not need it.
- **A language option.** Not built: the page's language is what a page that
  names one already says.
