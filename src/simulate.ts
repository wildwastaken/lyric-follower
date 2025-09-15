// Fakes what a speech recognizer hears while a band plays: dropped words,
// near-miss spellings, stray filler. Used by the tests and the demo button.

import type { Song } from './lyrics'

export interface HeardWord {
  word: string
  slide: number // the slide actually being sung when this word was heard
}

export interface NoiseOptions {
  drop: number // chance a sung word is missed
  mangle: number // chance a word comes out misspelled / misheard
  filler: number // chance an extra junk word appears
  seed: number
}

export const DEFAULT_NOISE: NoiseOptions = { drop: 0.2, mangle: 0.15, filler: 0.05, seed: 1 }

// Small deterministic RNG so tests are repeatable.
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 0x100000000
  }
}

const FILLERS = ['oh', 'yeah', 'the', 'and', 'uh', 'la', 'whoa', 'hey']
const SOUNDALIKES: Record<string, string> = {
  grace: 'great', sound: 'sounds', wretch: 'rich', blind: 'blinds', story: 'glory',
  song: 'some', savior: 'saver', heart: 'hard', praise: 'phrase', love: 'loved',
  mine: 'mind', god: 'got', blood: 'blood', home: 'hold', fear: 'here', lord: 'lard',
}

function mangle(word: string, random: () => number): string {
  if (SOUNDALIKES[word] && random() < 0.6) return SOUNDALIKES[word]
  if (word.length < 4) return word
  const i = 1 + Math.floor(random() * (word.length - 2))
  return random() < 0.5 ? word.slice(0, i) + word.slice(i + 1) : word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)
}

export function simulateSinging(song: Song, options: Partial<NoiseOptions> = {}): HeardWord[] {
  const { drop, mangle: mangleRate, filler, seed } = { ...DEFAULT_NOISE, ...options }
  const random = rng(seed)
  const heard: HeardWord[] = []
  for (const slide of song.slides) {
    for (const word of slide.words) {
      if (random() < filler) heard.push({ word: FILLERS[Math.floor(random() * FILLERS.length)], slide: slide.index })
      if (random() < drop) continue
      heard.push({ word: random() < mangleRate ? mangle(word, random) : word, slide: slide.index })
    }
  }
  return heard
}
