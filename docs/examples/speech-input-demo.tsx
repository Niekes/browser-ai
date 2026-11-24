import { useState } from "react"

import { SpeechInput } from "@/components/ui/speech-input"

export default function SpeechInputDemo() {
  const [message, setMessage] = useState("")

  return (
    <SpeechInput
      aria-label="Message"
      placeholder="Type, or click the microphone and speak."
      value={message}
      onChange={setMessage}
    />
  )
}
