# The reader confirms the model download

Context: the model is about 1.3 GB. A page that downloads it unasked spends
the reader's data and memory for an input they may never use.

Decision: the model downloads only after the reader confirms it, with its
size named and a progress bar while it loads. parakeet.js keeps the files in
IndexedDB; the worker looks there first, so a reader who confirmed once is
not asked again, and the model loads from the cache on the first click on
the microphone.

The worker only sees that a file is in the cache, as parakeet.js 1.4.4 uses
any cached file. A newer parakeet.js validates its cache and downloads again
when needed: before upgrading to it, the worker has to match its validation,
or the model could download again without the reader confirming.
