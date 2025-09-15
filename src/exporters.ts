// Slide decks for when you just want the slides (no live following).

import type { Song } from './lyrics'

export interface DeckStyle {
  theme: 'dark' | 'light'
  fontSize: number // points, for PowerPoint/Keynote
  showLabels: boolean
}

const colors = (theme: DeckStyle['theme']) =>
  theme === 'dark' ? { bg: '000000', text: 'FFFFFF', muted: '8A8A8A' } : { bg: 'FFFFFF', text: '111111', muted: '777777' }

export async function buildPptx(songs: Song[], style: DeckStyle) {
  const { default: PptxGenJS } = await import('pptxgenjs') // only loaded when someone exports
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 16:9
  const c = colors(style.theme)
  for (const song of songs) {
    const title = pptx.addSlide()
    title.background = { color: c.bg }
    title.addText(song.title, { x: 0.5, y: 2.8, w: 12.3, h: 1.5, align: 'center', fontSize: style.fontSize + 8, bold: true, color: c.text, fontFace: 'Helvetica' })
    for (const slide of song.slides) {
      const s = pptx.addSlide()
      s.background = { color: c.bg }
      s.addText(slide.lines.join('\n'), { x: 0.5, y: 0.6, w: 12.3, h: 6.0, align: 'center', valign: 'middle', fontSize: style.fontSize, color: c.text, fontFace: 'Helvetica', lineSpacingMultiple: 1.15 })
      if (style.showLabels) s.addText(`${song.title} · ${slide.label}`, { x: 0.4, y: 6.9, w: 8, h: 0.4, fontSize: 11, color: c.muted, fontFace: 'Helvetica' })
      s.addNotes(`${slide.label}`)
    }
  }
  return pptx
}

export async function downloadPptx(songs: Song[], style: DeckStyle) {
  const pptx = await buildPptx(songs, style)
  const name = songs.length === 1 ? songs[0].title : 'Setlist'
  await pptx.writeFile({ fileName: `${name.replace(/[^\w\s-]/g, '').trim() || 'Slides'}.pptx` })
}

// Plain text in the order it's sung, handy for pasting into ProPresenter or OBS.
export function toPlainText(song: Song): string {
  return song.slides.map(slide => slide.lines.join('\n')).join('\n\n')
}
