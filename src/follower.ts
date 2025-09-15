// Figures out which slide the band is on from a noisy speech-to-text stream.
//
// Same idea as the thesis clip matcher, shrunk down to run live: take the last
// few words the recognizer heard, fuzzy-align them against every slide, and
// mix that with a prior that says "you're probably still here, or one ahead".

import type { Song } from './lyrics'

export interface FollowerOptions {
  window: number // how many recent words to align
  minWords: number // don't decide anything on fewer words than this
  switchScore: number // a slide needs at least this (0..1) to be jumped to
  switchMargin: number // and must beat the current slide by this much
  advanceAt: number // flip to the next slide this far through the current one
}

export const DEFAULT_OPTIONS: FollowerOptions = {
  window: 8,
  minWords: 3,
  switchScore: 0.5,
  switchMargin: 0.12,
  advanceAt: 0.8,
}

export interface Decision {
  current: number
  changed: boolean
  reason: 'heard' | 'look-ahead' | 'manual' | null
  confidence: number // how well the recent words fit the shown slide, 0..1
  progress: number // how far through the shown slide the singer is, 0..1
}

// --- word similarity -------------------------------------------------------

function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = temp
    }
  }
  return row[b.length]
}

const cache = new Map<string, number>()
export function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const key = a < b ? `${a}|${b}` : `${b}|${a}`
  let value = cache.get(key)
  if (value === undefined) {
    value = 1 - editDistance(a, b) / Math.max(a.length, b.length)
    if (cache.size > 50_000) cache.clear()
    cache.set(key, value)
  }
  return value
}

// --- local alignment (Smith-Waterman over words) ---------------------------

export interface Alignment {
  score: number // 0..1
  end: number // index in the slide's words where the match ends, -1 if none
  heardEnd: number // index in the heard words where the match ends
  length: number // heard words covered by the match
}

const MATCH_AT = 0.7
const MISMATCH = -0.5
const GAP = -0.35

export function align(heard: string[], target: string[]): Alignment {
  const rows = heard.length + 1
  const cols = target.length + 1
  const score = new Float64Array(rows * cols)
  const start = new Int32Array(rows * cols)
  let best = 0, bestI = 0, bestJ = 0
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const sim = wordSimilarity(heard[i - 1], target[j - 1])
      const diag = score[(i - 1) * cols + j - 1] + (sim >= MATCH_AT ? sim : MISMATCH)
      const up = score[(i - 1) * cols + j] + GAP
      const left = score[i * cols + j - 1] + GAP
      let value = 0, from = i
      if (diag > value) { value = diag; from = start[(i - 1) * cols + j - 1] || i }
      if (up > value) { value = up; from = start[(i - 1) * cols + j] || i }
      if (left > value) { value = left; from = start[i * cols + j - 1] || i }
      score[i * cols + j] = value
      start[i * cols + j] = value > 0 ? from : 0
      // Prefer matches that end on the most recent word.
      if (value > best || (value === best && i > bestI)) { best = value; bestI = i; bestJ = j }
    }
  }
  if (best <= 0) return { score: 0, end: -1, heardEnd: -1, length: 0 }
  const length = bestI - start[bestI * cols + bestJ] + 1
  const possible = Math.max(3, Math.min(heard.length, target.length))
  return { score: Math.min(1, best / possible), end: bestJ - 1, heardEnd: bestI - 1, length }
}

// --- the follower ----------------------------------------------------------

export class Follower {
  current = 0
  private anchor = 0 // index into the word stream where the shown slide began
  private options: FollowerOptions

  constructor(private song: Song, options: Partial<FollowerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // Operator pressed an arrow key or clicked a slide.
  goTo(index: number, wordCount: number): Decision {
    this.current = Math.max(0, Math.min(this.song.slides.length - 1, index))
    this.anchor = wordCount
    return { current: this.current, changed: true, reason: 'manual', confidence: 0, progress: 0 }
  }

  private prior(index: number): number {
    const gap = index - this.current
    if (gap === 0) return 0
    if (gap === 1) return 0.05
    if (gap > 1) return Math.min(0.45, 0.3 + 0.05 * (gap - 1))
    // Going back is rarer, but must stay possible so a wrong flip can recover.
    return Math.min(0.45, 0.3 + 0.03 * (-gap - 1))
  }

  // `words` is everything heard so far (final + interim), already normalized.
  update(words: string[]): Decision {
    const { window, minWords, switchScore, switchMargin, advanceAt } = this.options
    const slides = this.song.slides
    this.anchor = Math.min(this.anchor, words.length)
    // Only words heard since the shown slide started, so the tail end of the
    // previous slide can't drag us backwards or re-trigger a flip.
    const from = Math.max(this.anchor, words.length - window, 0)
    const tail = words.slice(from)
    const still: Decision = { current: this.current, changed: false, reason: null, confidence: 0, progress: 0 }
    if (tail.length < minWords || !slides.length) return still

    let bestIndex = this.current
    let bestValue = -Infinity
    let currentFit: Alignment | null = null
    let currentValue = -Infinity
    let bestFit: Alignment | null = null
    for (const slide of slides) {
      const fit = align(tail, slide.words)
      // A match that stopped a few words ago is about something already sung.
      const recency = fit.heardEnd >= tail.length - 2 ? 1 : 0.6
      const value = fit.score * recency - this.prior(slide.index)
      if (slide.index === this.current) { currentFit = fit; currentValue = value }
      if (value > bestValue) { bestValue = value; bestIndex = slide.index; bestFit = fit }
    }

    const shown = slides[this.current]
    const progress = currentFit && currentFit.end >= 0 ? (currentFit.end + 1) / shown.words.length : 0
    const confidence = currentFit?.score ?? 0

    // Going backwards needs a long, clean match: right after a look-ahead flip
    // the last words of the old slide are still being sung.
    const backwards = bestIndex < this.current
    const strongEnough = backwards ? bestFit!.score >= 0.8 && bestFit!.length >= 4 : bestFit!.score >= switchScore
    if (bestIndex !== this.current && bestFit && strongEnough && bestValue - currentValue >= switchMargin) {
      this.current = bestIndex
      // Keep the words that matched the new slide so we know where we are in it.
      this.anchor = Math.max(from + bestFit.heardEnd + 1 - bestFit.length, 0)
      const slide = slides[bestIndex]
      return { current: this.current, changed: true, reason: 'heard', confidence: bestFit.score, progress: (bestFit.end + 1) / slide.words.length }
    }

    // Flip early so the room sees the next line before they need to sing it.
    // Repeated lines (a chorus sung twice) look identical, so also require that
    // most of the slide has actually been heard since it went up.
    const heardSince = words.length - this.anchor
    const enough = heardSince >= Math.max(minWords, Math.ceil(shown.words.length * 0.5))
    if (progress >= advanceAt && enough && confidence >= switchScore && this.current < slides.length - 1) {
      this.current += 1
      this.anchor = words.length
      return { current: this.current, changed: true, reason: 'look-ahead', confidence, progress: 0 }
    }

    return { ...still, confidence, progress }
  }
}
