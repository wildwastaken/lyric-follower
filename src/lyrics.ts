// Turns pasted lyrics into sections, slides, and the order they're sung in.

export interface Section {
  id: string // short tag used in arrangements, e.g. "V1", "C", "B"
  label: string // what the operator sees, e.g. "Verse 1"
  lines: string[]
}

export interface Slide {
  index: number // position in the sung sequence
  sectionId: string
  label: string
  lines: string[]
  words: string[] // normalized words, used for matching
}

export interface Song {
  title: string
  sections: Section[]
  slides: Slide[] // already expanded into sung order (repeats included)
}

export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .map(word => word.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
}

const SECTION_NAMES: Record<string, string> = {
  v: 'Verse', verse: 'Verse',
  c: 'Chorus', chorus: 'Chorus', refrain: 'Chorus',
  b: 'Bridge', bridge: 'Bridge',
  p: 'Pre-Chorus', pc: 'Pre-Chorus', prechorus: 'Pre-Chorus', 'pre-chorus': 'Pre-Chorus',
  t: 'Tag', tag: 'Tag', e: 'Ending', ending: 'Ending', outro: 'Ending', i: 'Intro', intro: 'Intro',
}

// "[Verse 2]" -> { id: "V2", label: "Verse 2" }
// Short tags like "C" only count inside brackets, so a one-word lyric line
// ("Hallelujah", "Oh") is never mistaken for a header.
function parseHeader(raw: string): { id: string; label: string } | null {
  const line = raw.trim()
  const bracketed = /^\[.*\]$/.test(line)
  const match = line.match(/^\[?\s*([a-z-]+)\.?\s*(\d*)\s*\]?:?$/i)
  if (!match) return null
  const key = match[1].toLowerCase()
  const name = SECTION_NAMES[key]
  if (!name || (!bracketed && key.length < 3)) return null
  const number = match[2]
  const short = name === 'Pre-Chorus' ? 'PC' : name[0]
  return { id: `${short}${number}`, label: number ? `${name} ${number}` : name }
}

export function parseSections(text: string): Section[] {
  const sections: Section[] = []
  let current: Section | null = null
  let verseCount = 0
  const used = new Set<string>()

  const start = (header: { id: string; label: string } | null) => {
    if (!header) {
      verseCount += 1
      header = { id: `V${verseCount}`, label: `Verse ${verseCount}` }
    }
    let id = header.id
    for (let n = 2; used.has(id); n++) id = `${header.id}.${n}`
    used.add(id)
    current = { id, label: header.label, lines: [] }
    sections.push(current)
  }

  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim()
    const header = line ? parseHeader(line) : null
    if (header) {
      const verse = header.label.match(/^Verse (\d+)$/)
      if (verse) verseCount = Math.max(verseCount, Number(verse[1]))
      start(header)
    } else if (!line) {
      current = null
    } else {
      if (!current) start(null)
      current!.lines.push(line)
    }
  }
  return sections.filter(section => section.lines.length > 0)
}

// "V1 C V2 C B C" -> section ids. Unknown tags are ignored; an empty order
// means "sing every section once, top to bottom".
export function parseArrangement(order: string, sections: Section[]): Section[] {
  const byId = new Map(sections.map(section => [section.id.toUpperCase(), section]))
  const picked = order
    .split(/[\s,]+/)
    .map(tag => byId.get(tag.toUpperCase()))
    .filter((section): section is Section => !!section)
  return picked.length ? picked : sections
}

export function buildSong(title: string, text: string, order = '', linesPerSlide = 2): Song {
  const sections = parseSections(text)
  const slides: Slide[] = []
  for (const section of parseArrangement(order, sections)) {
    for (let i = 0; i < section.lines.length; i += linesPerSlide) {
      const lines = section.lines.slice(i, i + linesPerSlide)
      slides.push({
        index: slides.length,
        sectionId: section.id,
        label: section.label,
        lines,
        words: normalizeWords(lines.join(' ')),
      })
    }
  }
  return { title, sections, slides }
}
