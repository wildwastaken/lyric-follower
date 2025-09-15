import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildSong, normalizeWords, parseSections, type Song } from './lyrics'
import { Follower } from './follower'
import { LiveRecognizer, speechSupported } from './recognizer'
import { simulateSinging } from './simulate'
import { CHANNEL, loadSongs, saveSongs, type SavedSong, type Screen } from './library'
import { downloadPptx, toPlainText } from './exporters'

type View = 'follow' | 'edit' | 'slides'

export default function App() {
  const [songs, setSongs] = useState<SavedSong[]>(loadSongs)
  const [selectedId, setSelectedId] = useState(songs[0]?.id ?? '')
  const [view, setView] = useState<View>('follow')
  const [linesPerSlide, setLinesPerSlide] = useState(2)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => saveSongs(songs), [songs])

  const saved = songs.find(song => song.id === selectedId) ?? songs[0]
  const song = useMemo(
    () => (saved ? buildSong(saved.title, saved.text, saved.order, linesPerSlide) : buildSong('', '')),
    [saved, linesPerSlide],
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Lyric Follower</h1>
          <span className="muted mono">slides that keep up with the band</span>
        </div>
        <nav className="tabs">
          {(['follow', 'edit', 'slides'] as View[]).map(v => (
            <button key={v} className={view === v ? 'tab active' : 'tab'} onClick={() => setView(v)}>
              {v === 'follow' ? 'Follow' : v === 'edit' ? 'Songs' : 'Slides'}
            </button>
          ))}
        </nav>
      </header>

      <div className="layout">
        <aside className="songlist">
          <p className="label">Songs</p>
          {songs.map(s => (
            <button key={s.id} className={s.id === saved?.id ? 'song active' : 'song'} onClick={() => setSelectedId(s.id)}>
              {s.title || 'Untitled'}
            </button>
          ))}
          <button
            className="song add"
            onClick={() => {
              const id = `song-${Date.now()}`
              setSongs([...songs, { id, title: 'New song', order: '', text: '[Verse 1]\n\n[Chorus]\n' }])
              setSelectedId(id)
              setView('edit')
            }}
          >
            + Add a song
          </button>
          <div className="settings">
            <label>
              <span className="label">Lines per slide</span>
              <select value={linesPerSlide} onChange={e => setLinesPerSlide(Number(e.target.value))}>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Screen</span>
              <select value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light')}>
                <option value="dark">White on black</option>
                <option value="light">Black on white</option>
              </select>
            </label>
          </div>
        </aside>

        <main className="main">
          {view === 'follow' && saved && <FollowView key={`${saved.id}-${linesPerSlide}`} song={song} theme={theme} />}
          {view === 'edit' && saved && (
            <EditView
              song={saved}
              onChange={next => setSongs(songs.map(s => (s.id === next.id ? next : s)))}
              onDelete={() => {
                const rest = songs.filter(s => s.id !== saved.id)
                setSongs(rest)
                setSelectedId(rest[0]?.id ?? '')
              }}
            />
          )}
          {view === 'slides' && <SlidesView songs={songs} linesPerSlide={linesPerSlide} theme={theme} initial={saved?.id} />}
        </main>
      </div>
    </div>
  )
}

// --- Follow: the live view the operator watches --------------------------------

function FollowView({ song, theme }: { song: Song; theme: 'dark' | 'light' }) {
  const followerRef = useRef(new Follower(song))
  const wordsRef = useRef<string[]>([])
  const recognizerRef = useRef<LiveRecognizer | null>(null)
  const demoRef = useRef<number | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)

  const [current, setCurrent] = useState(0)
  const [auto, setAuto] = useState(true)
  const [blank, setBlank] = useState(false)
  const [listening, setListening] = useState(false)
  const [demo, setDemo] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [lastReason, setLastReason] = useState<string>('')
  const [error, setError] = useState('')
  const autoRef = useRef(auto)
  autoRef.current = auto

  const slides = song.slides
  const slide = slides[current]

  // Tell the projector window what to show.
  const screen: Screen = useMemo(
    () => ({ title: song.title, label: slide?.label ?? '', lines: slide?.lines ?? [], blank, theme }),
    [song.title, slide, blank, theme],
  )
  const screenRef = useRef(screen)
  screenRef.current = screen
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = event => { if (event.data?.type === 'hello') channel.postMessage(screenRef.current) }
    channelRef.current = channel
    return () => channel.close()
  }, [])
  useEffect(() => { channelRef.current?.postMessage(screen) }, [screen])

  const handleWords = useCallback((words: string[]) => {
    wordsRef.current = words
    setTranscript(words.slice(-14).join(' '))
    if (!autoRef.current) return
    const decision = followerRef.current.update(words)
    setConfidence(decision.confidence)
    if (decision.changed) {
      setCurrent(decision.current)
      setLastReason(decision.reason === 'look-ahead' ? 'flipped early to the next line' : 'heard a different part of the song')
    }
  }, [])

  const goTo = useCallback((index: number) => {
    const decision = followerRef.current.goTo(index, wordsRef.current.length)
    setCurrent(decision.current)
    setLastReason('moved by hand')
  }, [])

  const stopAll = useCallback(() => {
    recognizerRef.current?.stop()
    recognizerRef.current = null
    if (demoRef.current) window.clearInterval(demoRef.current)
    demoRef.current = null
    setListening(false)
    setDemo(false)
  }, [])

  useEffect(() => stopAll, [stopAll])

  const startListening = () => {
    stopAll()
    setError('')
    const recognizer = new LiveRecognizer(
      heard => handleWords(normalizeWords(`${heard.final} ${heard.interim}`)),
      message => { setError(message); setListening(false) },
    )
    recognizer.start()
    recognizerRef.current = recognizer
    setListening(true)
  }

  const startDemo = () => {
    stopAll()
    setError('')
    goTo(0)
    const heard = simulateSinging(song, { seed: Math.floor(Math.random() * 1e6) })
    const words: string[] = []
    let i = 0
    setDemo(true)
    demoRef.current = window.setInterval(() => {
      if (i >= heard.length) { stopAll(); return }
      words.push(heard[i++].word)
      handleWords([...words])
    }, 330)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.tagName === 'INPUT' || (event.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') { event.preventDefault(); goTo(current + 1) }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); goTo(current - 1) }
      if (event.key.toLowerCase() === 'b') setBlank(b => !b)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, goTo])

  const next = slides[current + 1]

  return (
    <div className="follow">
      <div className="controls">
        {listening ? (
          <button className="primary" onClick={stopAll}>■ Stop listening</button>
        ) : (
          <button className="primary" onClick={startListening} disabled={!speechSupported()} title={speechSupported() ? '' : 'Needs Chrome, Edge, or Safari'}>
            ● Listen to the band
          </button>
        )}
        <button onClick={demo ? stopAll : startDemo}>{demo ? '■ Stop demo' : '▶ Demo run'}</button>
        <label className="toggle">
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Auto-follow
        </label>
        <button onClick={() => setBlank(b => !b)}>{blank ? 'Show lyrics' : 'Blank screen'} <kbd>B</kbd></button>
        <button onClick={() => window.open(`${location.pathname}?display=1`, 'lyric-display', 'width=1024,height=576')}>Open projector window ↗</button>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="stage">
        <div className={`preview preview-${theme} ${blank ? 'is-blank' : ''}`}>
          <span className="preview-tag mono">{slide?.label} · {current + 1}/{slides.length}</span>
          {slide?.lines.map((line, i) => <p key={i}>{line}</p>)}
        </div>
        <div className="side">
          <div className="panel">
            <p className="label">Next</p>
            <p className="next">{next ? next.lines.join(' / ') : 'End of song'}</p>
          </div>
          <div className="panel">
            <p className="label">Hearing</p>
            <p className="transcript mono">{transcript || (listening || demo ? '…' : 'Press Listen or Demo run')}</p>
            <div className="meter" title="How well what we hear fits the slide on screen">
              <div style={{ width: `${Math.round(confidence * 100)}%` }} />
            </div>
            <p className="muted small">{lastReason}</p>
          </div>
          <p className="muted small">← → or space to move by hand. The follower picks up from wherever you put it.</p>
        </div>
      </div>

      <ol className="strip">
        {slides.map(s => (
          <li key={s.index}>
            <button className={s.index === current ? 'thumb active' : 'thumb'} onClick={() => goTo(s.index)}>
              <span className="mono small">{s.label}</span>
              <span>{s.lines.join(' / ')}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

// --- Songs: paste and arrange lyrics -------------------------------------------

function EditView({ song, onChange, onDelete }: { song: SavedSong; onChange: (song: SavedSong) => void; onDelete: () => void }) {
  const sections = parseSections(song.text)
  return (
    <div className="edit">
      <label>
        <span className="label">Title</span>
        <input value={song.title} onChange={e => onChange({ ...song, title: e.target.value })} />
      </label>
      <label>
        <span className="label">Order (optional)</span>
        <input value={song.order} placeholder="e.g. V1 C V2 C B C" onChange={e => onChange({ ...song, order: e.target.value })} />
        <span className="muted small">
          Sections found: {sections.map(s => s.id).join(' ') || 'none yet'}. Leave blank to sing top to bottom.
        </span>
      </label>
      <label className="grow">
        <span className="label">Lyrics</span>
        <textarea
          value={song.text}
          spellCheck={false}
          onChange={e => onChange({ ...song, text: e.target.value })}
          placeholder={'[Verse 1]\nFirst line\nSecond line\n\n[Chorus]\n...'}
        />
      </label>
      <div className="row">
        <span className="muted small">Saved in this browser only. Label sections with [Verse 1], [Chorus], [Bridge], or just leave blank lines between stanzas.</span>
        <button className="danger" onClick={() => { if (confirm(`Delete "${song.title}"?`)) onDelete() }}>Delete song</button>
      </div>
    </div>
  )
}

// --- Slides: export a deck -------------------------------------------------------

function SlidesView({ songs, linesPerSlide, theme, initial }: { songs: SavedSong[]; linesPerSlide: number; theme: 'dark' | 'light'; initial?: string }) {
  const [picked, setPicked] = useState<string[]>(initial ? [initial] : [])
  const [fontSize, setFontSize] = useState(44)
  const [showLabels, setShowLabels] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const built = picked
    .map(id => songs.find(s => s.id === id))
    .filter((s): s is SavedSong => !!s)
    .map(s => buildSong(s.title, s.text, s.order, linesPerSlide))

  return (
    <div className="slides">
      <div className="controls">
        <div className="picks">
          {songs.map(s => (
            <label key={s.id} className="toggle">
              <input
                type="checkbox"
                checked={picked.includes(s.id)}
                onChange={e => setPicked(e.target.checked ? [...picked, s.id] : picked.filter(id => id !== s.id))}
              />
              {s.title}
            </label>
          ))}
        </div>
        <label className="toggle">Text size
          <input type="range" min={28} max={64} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} />
        </label>
        <label className="toggle"><input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} /> Section labels</label>
      </div>
      <div className="controls">
        <button className="primary" disabled={!built.length || busy} onClick={async () => { setBusy(true); try { await downloadPptx(built, { theme, fontSize, showLabels }) } finally { setBusy(false) } }}>
          {busy ? 'Building…' : 'Download PowerPoint / Keynote'}
        </button>
        <button disabled={!built.length} onClick={() => window.print()}>Print / Save as PDF</button>
        <button
          disabled={!built.length}
          onClick={async () => {
            try { await navigator.clipboard.writeText(built.map(toPlainText).join('\n\n\n')); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
          }}
        >
          {copied ? 'Copied' : 'Copy as text'}
        </button>
      </div>
      {!built.length && <p className="muted">Pick one or more songs to build a deck. Order follows the order you tick them.</p>}
      <div className="deck">
        {built.map(s => (
          <section key={s.title}>
            <div className={`card card-${theme} title-card`} style={{ fontSize: fontSize * 0.55 }}><p><strong>{s.title}</strong></p></div>
            {s.slides.map(sl => (
              <div key={sl.index} className={`card card-${theme}`} style={{ fontSize: fontSize * 0.45 }}>
                {sl.lines.map((line, i) => <p key={i}>{line}</p>)}
                {showLabels && <span className="card-label">{s.title} · {sl.label}</span>}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
