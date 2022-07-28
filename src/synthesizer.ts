import { InstrumentCollection } from './types/instrument'
import { Pitch } from './types/pitch'
import { PITCHES, PITCH_INDEX_MAP } from './utils/pitch'

type ProcessingTask = readonly [AudioBufferSourceNode, GainNode]

export class Synthesizer {
  private collection: InstrumentCollection
  private processingTasks: ProcessingTask[]

  constructor(private ctx: AudioContext) {
    this.collection = {}
    this.processingTasks = []
  }

  async load(
    instrument: string,
    {
      baseUrl,
      pitchRange,
    }: {
      baseUrl: string
      pitchRange: [Pitch, Pitch]
    },
  ) {
    const pitches = PITCHES.slice(
      PITCH_INDEX_MAP[pitchRange[0]],
      PITCH_INDEX_MAP[pitchRange[1]],
    )

    for (const pitch of pitches) {
      const url = new URL(`/${pitch}.mp3`, baseUrl)
      const audioBuffer = await fetch(url)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))

      this.collection[instrument][pitch] = audioBuffer
    }
  }

  getInstruments() {
    return Object.keys(this.collection)
  }

  soundOn(
    pitch: Pitch,
    {
      instrument,
      volume = 127,
    }: {
      instrument?: string
      volume?: number
    },
  ) {
    const instruments = this.getInstruments()

    if (instruments.length === 0) {
      throw new Error('no instruments')
    }

    const selectedInstrument = instrument ?? instruments[0]
    const audioBuffer = this.collection[selectedInstrument][pitch]

    const source = this.ctx.createBufferSource()

    source.buffer = audioBuffer

    source.connect(this.ctx.destination)
    source.playbackRate.value = 1

    const gain = (volume / 127) * 2 - 1
    const gainNode = this.ctx.createGain()

    gainNode.connect(this.ctx.destination)
    gainNode.gain.value = Math.min(1.0, Math.max(-1.0, gain))

    source.connect(gainNode)
    source.start()

    this.processingTasks.push([source, gainNode])

    return () => this.soundOff([source, gainNode])
  }

  soundOff([source, gainNode]: ProcessingTask) {
    gainNode.disconnect()

    source.stop()
    source.disconnect()

    for (let i = 0; i < this.processingTasks.length; i++) {
      if (this.processingTasks[i][0] === source) {
        this.processingTasks.splice(i, 1)
        return
      }
    }
  }

  allSoundOff() {
    for (const task of this.processingTasks) {
      this.soundOff(task)
    }
  }
}
