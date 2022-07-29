import {
  computeMusicFileTiming,
  computeTrackItemEndTick,
  MFChord,
  MFKey,
  MFMusicFile,
  MFNote,
  MFOctave,
} from '@improvising/music-file'
import { getChordPitches, getNotePitch } from '../common/pitch'
import { Synthesizer } from './synthesizer'

type TickIntervalDisposer = () => void
type TickEvent = () => void

interface TickEventsMap {
  [tick: number]: TickEvent[]
}

export class MusicFilePlayer {
  constructor(private synthesizer: Synthesizer) {}

  playNote(
    note: MFNote,
    octave: MFOctave,
    key: MFKey,
    {
      instrument,
      volume = 127,
      durationMs = 1000,
    }: {
      instrument?: string
      volume?: number
      durationMs?: number
    } = {},
  ) {
    const release = this.synthesizer.soundOn(getNotePitch(note, octave, key), {
      instrument,
      volume,
    })

    setTimeout(release, durationMs)
  }

  playChord(
    chord: MFChord,
    octave: MFOctave,
    key: MFKey,
    {
      instrument,
      volume = 127,
      durationMs = 1000,
    }: {
      instrument?: string
      volume?: number
      durationMs?: number
    } = {},
  ) {
    const releases = getChordPitches(chord, octave, key).map(pitch => {
      return this.synthesizer.soundOn(pitch, { instrument, volume })
    })

    setTimeout(() => releases.forEach(release => release()), durationMs)
  }

  playMusicFile(
    musicFile: MFMusicFile,
    {
      startTick = 0,
      onProgress,
      onFinish,
    }: {
      startTick?: number
      onProgress?: (currentTick: number) => void
      onFinish?: (currentTick: number) => void
    } = {},
  ): TickIntervalDisposer {
    const { key } = musicFile
    const { tickMs, numTicks } = computeMusicFileTiming(musicFile)

    const tickEventsMap: TickEventsMap = {}

    for (const track of musicFile.tracks) {
      const { instrument, volume } = track

      for (const item of track.items) {
        switch (item.type) {
          case 'note':
            {
              const pitch = getNotePitch(item.note, item.octave, key)
              const end = computeTrackItemEndTick(item)

              tickEventsMap[item.begin] ??= []
              tickEventsMap[item.begin].push(() => {
                const release = this.synthesizer.soundOn(pitch, {
                  instrument,
                  volume,
                })

                tickEventsMap[end] ??= []
                tickEventsMap[end].push(release)
              })
            }
            break
          case 'chord':
            {
              const pitches = getChordPitches(item.chord, item.octave, key)
              const end = computeTrackItemEndTick(item)

              tickEventsMap[item.begin] ??= []
              tickEventsMap[item.begin].push(() => {
                const releases = pitches.map(pitch => {
                  return this.synthesizer.soundOn(pitch, {
                    instrument,
                    volume,
                  })
                })

                tickEventsMap[end] ??= []
                tickEventsMap[end].push(...releases)
              })
            }
            break
        }
      }
    }

    let currentTick = startTick

    const schedule = () => {
      const tickEvents = tickEventsMap[currentTick]

      if (tickEvents) {
        for (const tickEvent of tickEvents) {
          tickEvent()
        }
      }

      onProgress?.(currentTick)

      if (currentTick >= numTicks) {
        onFinish?.(currentTick)

        return window.clearInterval(interval)
      }

      currentTick++
    }

    const interval = window.setInterval(schedule, tickMs)

    schedule()

    return () => {
      this.synthesizer.allSoundOff()

      return window.clearInterval(interval)
    }
  }
}
