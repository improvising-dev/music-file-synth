import {
  computeMusicFileTiming,
  computeTrackItemEndTick,
  MFChord,
  MFKey,
  MFMusicFile,
  MFNote,
  MFOctave,
} from '@improvising/music-file'
import { Synthesizer } from './synthesizer'
import { PlaybackIntervalRef, TickEventsMap } from './types/playback'
import { chordToPitches, noteToPitch } from './utils/pitch'

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
    const release = this.synthesizer.soundOn(noteToPitch(note, octave, key), {
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
    const releases = chordToPitches(chord, octave, key).map(pitch => {
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
  ): PlaybackIntervalRef {
    const { key } = musicFile
    const { tickMs, numTicks } = computeMusicFileTiming(musicFile)

    const tickEventsMap: TickEventsMap = {}

    for (const track of musicFile.tracks) {
      const { instrument, volume } = track

      for (const item of track.items) {
        switch (item.type) {
          case 'note':
            {
              const pitch = noteToPitch(item.note, item.octave, key)
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
              const pitches = chordToPitches(item.chord, item.octave, key)
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

    schedule()

    const interval = window.setInterval(schedule, tickMs)

    return {
      dispose: () => {
        window.clearInterval(interval)

        this.synthesizer.allSoundOff()
      },
      getCurrentTick: () => currentTick,
      setCurrentTick: tick => {
        currentTick = tick
      },
    }
  }
}
