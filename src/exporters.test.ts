import { buildSong } from './lyrics'
import { buildPptx, toPlainText } from './exporters'
import { SAMPLE_SONGS } from './songs'

const songs = SAMPLE_SONGS.slice(0, 2).map(s => buildSong(s.title, s.text, s.order))

it('builds a real .pptx file', async () => {
  const pptx = await buildPptx(songs, { theme: 'dark', fontSize: 44, showLabels: true })
  const data = (await pptx.write({ outputType: 'uint8array' })) as Uint8Array
  // .pptx is a zip: starts with "PK"
  expect(String.fromCharCode(data[0], data[1])).toBe('PK')
  expect(data.length).toBeGreaterThan(20_000)
})

it('exports plain text in sung order', () => {
  const text = toPlainText(songs[0])
  expect(text.split('\n\n')).toHaveLength(songs[0].slides.length)
  expect(text.indexOf('This is my story')).toBeLessThan(text.indexOf('Perfect submission'))
})
