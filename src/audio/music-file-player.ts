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

export type TickEvent = () => void
export interface TickEventsMap {
  [tick: number]: TickEvent[]
}

export interface MusicFilePlaybackState {
  key: MFKey
  numTicks: number
  tickMs: number
  tickEventsMap: TickEventsMap
  currentTick: number
}

export interface MusicFilePlaybackController {
  dispose: () => void
  getCurrentState: () => MusicFilePlaybackState
  updateState: (musicFile: MFMusicFile) => void
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
    initialMusicFile: MFMusicFile,
    {
      startTick = 0,
      onProgress,
      onFinish,
    }: {
      startTick?: number
      onProgress?: (currentTick: number) => void
      onFinish?: (currentTick: number) => void
    } = {},
  ): MusicFilePlaybackController {
    const state: MusicFilePlaybackState = {
      key: 'C',
      numTicks: 0,
      tickMs: 0,
      tickEventsMap: {},
      currentTick: startTick,
    }

    const updateState = (musicFile: MFMusicFile) => {
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

      state.key = key
      state.numTicks = numTicks
      state.tickMs = tickMs
      state.tickEventsMap = tickEventsMap
    }

    const schedule = () => {
      const tickEvents = state.tickEventsMap[state.currentTick]

      if (tickEvents) {
        for (const tickEvent of tickEvents) {
          tickEvent()
        }
      }

      onProgress?.(state.currentTick)

      if (state.currentTick >= state.numTicks) {
        onFinish?.(state.currentTick)

        return window.clearInterval(interval)
      }

      state.currentTick++
    }

    const dispose = () => {
      this.synthesizer.allSoundOff()

      return window.clearInterval(interval)
    }

    const getCurrentState = () => state

    updateState(initialMusicFile)
    schedule()

    const interval = window.setInterval(schedule, state.tickMs)

    return {
      dispose,
      getCurrentState,
      updateState,
    }
  }
}
