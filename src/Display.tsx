// The projector window. Open it on the second screen and press F for fullscreen.

import { useEffect, useState } from 'react'
import { CHANNEL, type Screen } from './library'

export default function Display() {
  const [screen, setScreen] = useState<Screen | null>(null)

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = event => setScreen(event.data as Screen)
    channel.postMessage({ type: 'hello' })
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.().catch(() => {})
    }
    window.addEventListener('keydown', onKey)
    return () => { channel.close(); window.removeEventListener('keydown', onKey) }
  }, [])

  const theme = screen?.theme ?? 'dark'
  return (
    <div className={`display display-${theme}`}>
      {screen && !screen.blank ? (
        <div className="display-lines" key={screen.lines.join('|')}>
          {screen.lines.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      ) : (
        !screen && <p className="display-hint">Waiting for the operator window… (press F for fullscreen)</p>
      )}
    </div>
  )
}
