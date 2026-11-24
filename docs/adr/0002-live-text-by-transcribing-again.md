# Live text by transcribing the dictation again

Context: Parakeet transcribes a whole recording well, and a short window
without its context worse. A pass over 30 s of audio takes about a second on
WebGPU, and grows with the audio.

Decision: while recording, the whole recording is transcribed again about
every second - a pass starts a second after the one before started, or as
soon as it ends if it took longer - and its text replaces the live text. On
stop, a last pass over the recording gives the final text. Past a minute, the
words that ended more than ten seconds before the end are frozen, cut between
two words by their timestamps, and only the audio after them is transcribed
again, so a pass stays at about a minute of audio.

What would reopen it: a pass that falls behind on slower GPUs, measured.
Then the stateful streaming of parakeet.js, which carries the decoder state
from one chunk to the next, is the next step.

## Considered Options

- **Chunks with merged text.** Rejected for v1: the seams between chunks
  lose and double words, and need merging that whole passes do not.
