import { buildSong, normalizeWords, parseSections } from './lyrics'
import { Follower, align, wordSimilarity } from './follower'
import { simulateSinging, type NoiseOptions } from './simulate'
import { SAMPLE_SONGS } from './songs'

function songFor(title: string) {
  const sample = SAMPLE_SONGS.find(song => song.title === title)!
  return buildSong(sample.title, sample.text, sample.order)
}

// Feed the follower one heard word at a time, like a live recognizer.
function run(title: string, noise: Partial<NoiseOptions>) {
  const song = songFor(title)
  const follower = new Follower(song)
  const heard = simulateSinging(song, noise)
  const words: string[] = []
  const shown: number[] = []
  for (const h of heard) {
    words.push(h.word)
    follower.update(words)
    shown.push(follower.current)
  }
  // Showing the sung slide, or the next one near the end of a slide, both count.
  const ok = heard.filter((h, i) => shown[i] === h.slide || shown[i] === h.slide + 1).length
  const visited = new Set(shown)
  return { song, accuracy: ok / heard.length, final: shown[shown.length - 1], visited }
}

describe('lyrics parsing', () => {
  it('reads section headers and blank-line stanzas', () => {
    const sections = parseSections('[Verse 1]\na\nb\n\n[Chorus]\nc\n\nd\ne')
    expect(sections.map(s => s.id)).toEqual(['V1', 'C', 'V2'])
    expect(sections[2].label).toBe('Verse 2')
  })

  it('expands the arrangement into slides with repeats', () => {
    const song = songFor('Blessed Assurance')
    // 3 verses + 3 choruses, 2 slides each
    expect(song.slides).toHaveLength(12)
    expect(song.slides[2].label).toBe('Chorus')
    expect(song.slides[6].label).toBe('Chorus')
  })

  it('normalizes punctuation and curly quotes', () => {
    expect(normalizeWords('’Twas grace, that taught—my heart!')).toEqual(['twas', 'grace', 'that', 'taught', 'my', 'heart'])
  })
})

describe('matching', () => {
  it('scores near-misses as similar', () => {
    expect(wordSimilarity('savior', 'saviour')).toBeGreaterThan(0.8)
    expect(wordSimilarity('grace', 'house')).toBeLessThan(0.5)
  })

  it('finds where in a slide the heard words end', () => {
    const fit = align(['saved', 'a', 'wrech', 'like'], normalizeWords('That saved a wretch like me'))
    expect(fit.score).toBeGreaterThan(0.6)
    expect(fit.end).toBe(4)
  })
})

describe('following a band', () => {
  for (const title of SAMPLE_SONGS.map(song => song.title)) {
    for (const seed of [1, 2, 3, 4, 5]) {
      it(`${title}, noisy run ${seed}`, () => {
        const { song, accuracy, final, visited } = run(title, { seed })
        expect(accuracy).toBeGreaterThan(0.85)
        expect(final).toBe(song.slides.length - 1)
        expect(visited.size).toBeGreaterThanOrEqual(song.slides.length - 1)
      })
    }
  }

  it('survives a very noisy room', () => {
    const { accuracy, final, song } = run('Amazing Grace', { seed: 9, drop: 0.35, mangle: 0.25, filler: 0.1 })
    expect(accuracy).toBeGreaterThan(0.75)
    expect(final).toBe(song.slides.length - 1)
  })

  it('jumps to the chorus when the band skips ahead', () => {
    const song = songFor('Blessed Assurance')
    const follower = new Follower(song)
    const words = normalizeWords('blessed assurance jesus is mine this is my story this is my song praising my savior')
    for (let i = 1; i <= words.length; i++) follower.update(words.slice(0, i))
    expect(song.slides[follower.current].label).toBe('Chorus')
  })
})
