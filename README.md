# Lyric Follower

Worship slides that keep up with the band. Paste a song, press **Listen**, and the
lyrics on the projector advance on their own as the band sings, flipping a beat early
so the room sees the next line in time. Arrow keys still work at any point, and the
follower picks up from wherever you put it.

It also works as a plain slide maker: pick songs, then export a 16:9 PowerPoint/Keynote
deck, print to PDF, or copy the text in sung order.

## How it works

1. **Parse.** Lyrics are split into sections (`[Verse 1]`, `[Chorus]`, or blank lines),
   expanded by an optional order like `V1 C V2 C B C`, and cut into slides.
2. **Hear.** The browser's speech recognizer turns the room audio into words.
3. **Match.** The last ~8 words heard since the current slide went up are fuzzy-aligned
   (Smith-Waterman over words, edit-distance word similarity) against every slide. This
   is a live, shrunk-down version of the lexical clip→source matcher from my thesis.
4. **Decide.** Each slide's fit is mixed with a prior: stay put, or move one ahead;
   jumps are allowed when the evidence is strong, and going backwards needs a long clean
   match. When most of the current slide has been sung, it flips early. Repeated chorus
   lines are handled by requiring that most of a slide be heard before flipping.

On simulated noisy singing (20% of words missed, 15% misheard, stray filler words),
the right slide, or the next one flipped early, is on screen about 98–99% of the time
across the three sample hymns and 30 runs each. In a very noisy room (35% missed, 25%
misheard) it's about 84%.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 24 tests: parsing, matching, noisy-band simulations, pptx export
npm run build
```

- **Listen to the band** needs Chrome, Edge, or Safari and microphone access. Chrome's
  recognizer sends audio to Google's speech service; Safari can recognize on-device.
- **Demo run** plays a simulated, noisy band so you can watch it follow without a mic.
- **Open projector window** opens the audience view; drag it to the second screen and
  press **F** for fullscreen. **B** blanks the screen.

Songs are saved in this browser only. The three samples are public-domain hymns; paste
your own lyrics for anything newer (nothing is uploaded).

## Ideas for later

- Run Whisper locally (whisper.cpp / WebGPU) for better recognition of sung words.
- Learn each song's tempo so look-ahead timing adapts to the band.
- ProPresenter export and a phone remote.
