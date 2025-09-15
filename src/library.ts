// Songs the operator has saved, kept in this browser only.

import { SAMPLE_SONGS } from './songs'

export interface SavedSong {
  id: string
  title: string
  order: string
  text: string
}

const KEY = 'lyric-follower:songs'

export function loadSongs(): SavedSong[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const songs = JSON.parse(raw) as SavedSong[]
      if (Array.isArray(songs) && songs.length) return songs
    }
  } catch { /* storage blocked or corrupt: fall back to samples */ }
  return SAMPLE_SONGS.map((song, i) => ({ id: `sample-${i}`, ...song }))
}

export function saveSongs(songs: SavedSong[]) {
  try { localStorage.setItem(KEY, JSON.stringify(songs)) } catch { /* ignore */ }
}

// What the projector window shows.
export interface Screen {
  title: string
  label: string
  lines: string[]
  blank: boolean
  theme: 'dark' | 'light'
}

export const CHANNEL = 'lyric-follower'
