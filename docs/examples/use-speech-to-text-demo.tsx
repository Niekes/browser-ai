import { useState } from "react"

import { useSpeechToText } from "@/hooks/use-speech-to-text"

export default function UseSpeechToTextDemo() {
  const [notes, setNotes] = useState<string[]>([])
  const speech = useSpeechToText({ onFinal: (text) => setNotes((all) => [...all, text]) })

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2">
        {speech.status === "not-downloaded" && (
          <button className="rounded-md border px-3 py-1.5" onClick={speech.download}>
            Download the model (~1.3 GB)
          </button>
        )}
        <button
          className="rounded-md border px-3 py-1.5 disabled:opacity-50"
          disabled={
            speech.status !== "ready" &&
            speech.status !== "downloaded" &&
            speech.status !== "recording"
          }
          onClick={speech.status === "recording" ? speech.stop : speech.start}
        >
          {speech.status === "recording" ? "Stop" : "Record a note"}
        </button>
        <span className="text-muted-foreground">
          {speech.status}
          {speech.status === "downloading" && ` ${Math.round(speech.progress * 100)}%`}
        </span>
      </div>
      {speech.liveText && <p className="text-muted-foreground italic">{speech.liveText}</p>}
      <ul className="list-disc pl-5">
        {notes.map((note, index) => (
          <li key={index}>{note}</li>
        ))}
      </ul>
    </div>
  )
}
