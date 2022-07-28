import {
  getChordOctaveNotes,
  getKeyOffset,
  getNoteIndex,
  MFChord,
  MFKey,
  MFNote,
  MFOctave,
  OCTAVES,
  splitOctaveNote,
} from '@improvising/music-file'
import { Pitch, Tone } from '../types/pitch'

export const TONES: readonly Tone[] = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

export const PITCHES = OCTAVES.reduce<Pitch[]>(
  (pitches, octave) => [
    ...pitches,
    ...TONES.map(pitch => `${pitch}${octave}` as const),
  ],
  [],
)

export const PITCH_INDEX_MAP = PITCHES.reduce((prev, curr, index) => {
  prev[curr] = index
  return prev
}, {} as Record<string, number>)

export const noteToPitch = (note: MFNote, octave: MFOctave, key: MFKey) => {
  const octaveOffset = (octave - 1) * 12

  const keyOffset = getKeyOffset(key)
  const noteOffset = getNoteIndex(note)

  return PITCHES[octaveOffset + keyOffset + noteOffset]
}

export const chordToPitches = (
  chord: MFChord,
  octave: MFOctave,
  key: MFKey,
) => {
  return getChordOctaveNotes(chord, octave).map(note => {
    return noteToPitch(...splitOctaveNote(note), key)
  })
}
