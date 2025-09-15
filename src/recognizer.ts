// Thin wrapper around the browser's speech recognizer (Chrome / Edge / Safari).
// Keeps it running for a whole set: the browser stops it after silence, so we
// restart it until the operator presses stop.

export interface Heard {
  final: string // everything confirmed so far
  interim: string // the guess for what's being sung right now
}

type Listener = (heard: Heard) => void

interface SpeechResultLike { isFinal: boolean; 0: { transcript: string } }
interface SpeechEventLike { resultIndex: number; results: ArrayLike<SpeechResultLike> }
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  start(): void
  stop(): void
}

function recognizerClass(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null
}

export const speechSupported = () => typeof window !== 'undefined' && !!recognizerClass()

export class LiveRecognizer {
  private recognition: SpeechRecognitionLike | null = null
  private running = false
  private finalText = ''

  constructor(private onHeard: Listener, private onError: (message: string) => void, private lang = 'en-US') {}

  start() {
    const Recognition = recognizerClass()
    if (!Recognition) {
      this.onError('This browser has no speech recognizer. Try Chrome or Edge, or use the demo run.')
      return
    }
    this.running = true
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = this.lang
    recognition.onresult = event => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) this.finalText += ' ' + result[0].transcript
        else interim += ' ' + result[0].transcript
      }
      this.onHeard({ final: this.finalText, interim })
    }
    recognition.onerror = event => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.running = false
        this.onError('Microphone access was blocked. Allow it in the browser and try again.')
      }
    }
    recognition.onend = () => {
      if (this.running) {
        try { recognition.start() } catch { /* already restarting */ }
      }
    }
    recognition.start()
    this.recognition = recognition
  }

  stop() {
    this.running = false
    this.recognition?.stop()
    this.recognition = null
  }

  reset() {
    this.finalText = ''
  }
}
