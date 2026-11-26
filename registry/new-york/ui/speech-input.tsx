"use client"

import { useRef, useState, type ComponentProps } from "react"
import { LoaderCircle, Mic, Square } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import {
  useSpeechToText,
  type SpeechToTextStatus,
} from "@/registry/new-york/hooks/use-speech-to-text"

// Dictated text replaces the selection, a space apart from the words on either side.
export function insertAtCursor(value: string, start: number, end: number, text: string) {
  if (!text) return { value, caret: end }
  const before = value.slice(0, start)
  const after = value.slice(end)
  const words = (/\S$/.test(before) ? " " : "") + text
  return {
    value: before + words + (/^\S/.test(after) ? " " : "") + after,
    caret: start + words.length,
  }
}

export type SpeechInputProps = Omit<ComponentProps<"textarea">, "value" | "onChange"> & {
  /** The text, typed and dictated. */
  value: string
  /** Receives the new text, after typing and after each dictation. */
  onChange: (value: string) => void
  /**
   * Where the model cannot run, dictates with the browser's own speech recognition instead, if
   * the browser has one. It need not run on the device: the audio may go to the browser's maker.
   * @defaultValue false
   */
  browserFallback?: boolean
}

const NOTICE: Partial<Record<SpeechToTextStatus, string>> = {
  unsupported:
    "Speech input needs a desktop computer whose browser runs WebGPU with 16-bit floats.",
  "browser-fallback":
    "Dictation uses this browser's speech recognition: the audio may leave this device.",
  loading: "Loading the speech model…",
  recording: "Listening… Click the microphone to stop, press Escape to cancel.",
  finishing: "Transcribing…",
}

// The mic starts a dictation in these states, and stops one while recording.
const MIC_ON = new Set<SpeechToTextStatus>([
  "not-downloaded",
  "downloaded",
  "ready",
  "browser-fallback",
  "recording",
])

function DownloadPrompt({
  onConfirm,
  onDismiss,
}: {
  onConfirm: () => void
  onDismiss: () => void
}) {
  return (
    <div data-slot="speech-input-download" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">
        Enable speech recognition? The model (~1.3 GB) downloads once and stays in this browser.
      </span>
      <Button size="sm" onClick={onConfirm}>
        Download
      </Button>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Not now
      </Button>
    </div>
  )
}

function MicButton({
  status,
  disabled,
  onClick,
}: {
  status: SpeechToTextStatus
  disabled?: boolean
  onClick: () => void
}) {
  const recording = status === "recording"
  const busy = status === "finishing" || status === "loading"
  return (
    <Button
      type="button"
      size="icon"
      variant={recording ? "destructive" : "ghost"}
      className="absolute top-1.5 right-1.5 size-8"
      aria-label={recording ? "Stop dictation" : "Start dictation"}
      disabled={!MIC_ON.has(status) || disabled}
      onClick={onClick}
    >
      {recording ? <Square /> : busy ? <LoaderCircle className="animate-spin" /> : <Mic />}
    </Button>
  )
}

function DownloadProgress({ progress }: { progress: number }) {
  const percent = Math.round(progress * 100)
  return (
    <div
      data-slot="speech-input-progress"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <Progress value={percent} aria-label="Downloading the speech model" className="flex-1" />
      <span>{percent}%</span>
    </div>
  )
}

function Status({
  status,
  error,
  browser,
}: {
  status: SpeechToTextStatus
  error?: string
  browser: boolean
}) {
  // While the browser's speech recognition listens, the reader still sees where the audio may go.
  const message =
    error ?? (browser ? `${NOTICE[status]} ${NOTICE["browser-fallback"]}` : NOTICE[status])
  return message ? (
    <p
      data-slot="speech-input-status"
      role={error ? "alert" : "status"}
      className={cn("text-sm text-muted-foreground", error && "text-destructive")}
    >
      {message}
    </p>
  ) : null
}

// A dictation at the cursor: the live text shows there, the final text lands there.
function useDictation(
  value: string,
  onChange: (value: string) => void,
  browserFallback: boolean | undefined
) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const [anchor, setAnchor] = useState({ start: value.length, end: value.length, browser: false })
  const speech = useSpeechToText({
    onFinal: (text) => {
      const next = insertAtCursor(value, anchor.start, anchor.end, text)
      onChange(next.value)
      requestAnimationFrame(() => {
        textarea.current?.focus()
        textarea.current?.setSelectionRange(next.caret, next.caret)
      })
    },
    browserFallback,
  })
  const dictating = speech.status === "recording" || speech.status === "finishing"
  const shown = dictating ? insertAtCursor(value, anchor.start, anchor.end, speech.liveText) : null

  function start() {
    setAnchor({
      start: textarea.current!.selectionStart,
      end: textarea.current!.selectionEnd,
      browser: speech.status === "browser-fallback",
    })
    speech.start()
  }

  return {
    textarea,
    speech,
    dictating,
    shown: shown?.value ?? value,
    start,
    viaBrowser: dictating && anchor.browser,
  }
}

/**
 * A textarea that takes dictation: the mic button records, the words show as they are spoken,
 * and the final text lands at the cursor. Speech recognition runs in the browser.
 */
export function SpeechInput({
  value,
  onChange,
  browserFallback,
  className,
  ...props
}: SpeechInputProps) {
  const { textarea, speech, dictating, shown, start, viaBrowser } = useDictation(
    value,
    onChange,
    browserFallback
  )
  const [asking, setAsking] = useState(false)
  const { status } = speech

  const mic = () =>
    status === "recording" ? speech.stop() : status === "not-downloaded" ? setAsking(true) : start()

  return (
    <div
      data-slot="speech-input"
      className="flex flex-col gap-2"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !(dictating || status === "loading")) return
        // Escape belongs to the dictation here, not to a dialog around the input.
        event.stopPropagation()
        speech.cancel()
      }}
    >
      <div className="relative">
        <Textarea
          {...props}
          ref={textarea}
          value={shown}
          onChange={(event) => onChange(event.target.value)}
          readOnly={dictating || props.readOnly}
          className={cn("pr-12", className)}
        />
        <MicButton status={status} disabled={props.disabled} onClick={mic} />
      </div>
      {asking && status === "not-downloaded" ? (
        <DownloadPrompt
          onConfirm={() => {
            setAsking(false)
            speech.download()
          }}
          onDismiss={() => setAsking(false)}
        />
      ) : status === "downloading" ? (
        <DownloadProgress progress={speech.progress} />
      ) : (
        <Status status={status} error={speech.error} browser={viaBrowser} />
      )}
    </div>
  )
}
