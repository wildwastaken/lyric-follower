// Public-domain hymns for demos and tests. Paste your own lyrics for anything
// newer (CCLI songs stay on your machine; nothing is uploaded).

export interface SampleSong {
  title: string
  order: string
  text: string
}

export const SAMPLE_SONGS: SampleSong[] = [
  {
    title: 'Blessed Assurance',
    order: 'V1 C V2 C V3 C',
    text: `[Verse 1]
Blessed assurance, Jesus is mine
O what a foretaste of glory divine
Heir of salvation, purchase of God
Born of His Spirit, washed in His blood

[Chorus]
This is my story, this is my song
Praising my Savior all the day long
This is my story, this is my song
Praising my Savior all the day long

[Verse 2]
Perfect submission, perfect delight
Visions of rapture now burst on my sight
Angels descending bring from above
Echoes of mercy, whispers of love

[Verse 3]
Perfect submission, all is at rest
I in my Savior am happy and blest
Watching and waiting, looking above
Filled with His goodness, lost in His love`,
  },
  {
    title: 'Amazing Grace',
    order: '',
    text: `[Verse 1]
Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind, but now I see

[Verse 2]
'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

[Verse 3]
Through many dangers, toils and snares
I have already come
'Tis grace hath brought me safe thus far
And grace will lead me home

[Verse 4]
When we've been there ten thousand years
Bright shining as the sun
We've no less days to sing God's praise
Than when we'd first begun`,
  },
  {
    title: 'Come Thou Fount',
    order: '',
    text: `[Verse 1]
Come, Thou Fount of every blessing
Tune my heart to sing Thy grace
Streams of mercy, never ceasing
Call for songs of loudest praise
Teach me some melodious sonnet
Sung by flaming tongues above
Praise the mount, I'm fixed upon it
Mount of Thy redeeming love

[Verse 2]
Here I raise my Ebenezer
Hither by Thy help I've come
And I hope, by Thy good pleasure
Safely to arrive at home
Jesus sought me when a stranger
Wandering from the fold of God
He, to rescue me from danger
Interposed His precious blood

[Verse 3]
O to grace how great a debtor
Daily I'm constrained to be
Let Thy goodness, like a fetter
Bind my wandering heart to Thee
Prone to wander, Lord, I feel it
Prone to leave the God I love
Here's my heart, O take and seal it
Seal it for Thy courts above`,
  },
]
