import { MFOctave } from '@improvising/music-file'

export type Tone =
  | 'C'
  | 'Db'
  | 'D'
  | 'Eb'
  | 'E'
  | 'F'
  | 'Gb'
  | 'G'
  | 'Ab'
  | 'A'
  | 'Bb'
  | 'B'

export type Pitch = `${Tone}${MFOctave}`
