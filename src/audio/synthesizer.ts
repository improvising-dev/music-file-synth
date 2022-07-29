import { SynthesizerError } from '../common/error'
import { amountToFreq } from '../common/frequency'
import { getPitchesBetween } from '../common/pitch'
import {
  InstrumentCollection,
  InstrumentParams,
  InstrumentState,
} from '../types/instrument'
import { Pitch } from '../types/pitch'

export class PitchNode {
  private source: AudioBufferSourceNode
  private modulator: BiquadFilterNode
  private output: GainNode

  constructor(
    pitch: Pitch,
    private ctx: AudioContext,
    private state: InstrumentState,
    private volume: number = 127,
  ) {
    this.source = ctx.createBufferSource()
    this.modulator = ctx.createBiquadFilter()
    this.output = ctx.createGain()

    this.source.connect(this.modulator)
    this.modulator.connect(this.output)
    this.output.connect(this.ctx.destination)

    this.source.onended = () => {
      this.output.disconnect(0)
      this.modulator.disconnect(0)
      this.source.disconnect(0)
    }

    this.source.playbackRate.value = 1
    this.modulator.type = 'allpass'

    const audioBuffer = state.buffers[pitch]

    if (audioBuffer) {
      this.source.buffer = audioBuffer
    }
  }

  soundOn() {
    const { params } = this.state

    let attackVolume =
      (this.volume / 127) * (1 - params.initialAttenuation / 1000)

    if (attackVolume < 0) {
      attackVolume = 0
    }

    const now = this.ctx.currentTime

    const volDelay = now + params.volDelay
    const volAttack = volDelay + params.volAttack
    const volHold = volAttack + params.volHold
    const volDecay = volHold + params.volDecay
    const modDelay = now + params.modDelay
    const modAttack = volDelay + params.modAttack
    const modHold = modAttack + params.modHold
    const modDecay = modHold + params.modDecay

    this.output.gain
      .setValueAtTime(0, now)
      .setValueAtTime(0, volDelay)
      .setTargetAtTime(attackVolume, volDelay, params.volAttack)
      .setValueAtTime(attackVolume, volHold)
      .linearRampToValueAtTime(attackVolume * (1 - params.volSustain), volDecay)

    const baseFreq = amountToFreq(params.initialFilterFc)
    const peekFreq = amountToFreq(
      params.initialFilterFc + params.modEnvToFilterFc,
    )

    const sustainFreq =
      baseFreq + (peekFreq - baseFreq) * (1 - params.modSustain)

    this.modulator.Q.setValueAtTime(
      Math.pow(10, params.initialFilterQ / 200),
      now,
    )

    this.modulator.frequency
      .setValueAtTime(baseFreq, now)
      .setValueAtTime(baseFreq, modDelay)
      .setTargetAtTime(peekFreq, modDelay, params.modAttack)
      .setValueAtTime(peekFreq, modHold)
      .linearRampToValueAtTime(sustainFreq, modDecay)

    this.source.start()
  }

  soundOff() {
    const { params } = this.state

    const now = this.ctx.currentTime

    const volEndTimeTmp = params.volRelease * this.output.gain.value
    const volEndTime = now + volEndTimeTmp

    const baseFreq = amountToFreq(params.initialFilterFc)
    const peekFreq = amountToFreq(
      params.initialFilterFc + params.modEnvToFilterFc,
    )

    const modEndTime =
      now +
      params.modRelease *
        (baseFreq === peekFreq
          ? 1
          : (this.modulator.frequency.value - baseFreq) / (peekFreq - baseFreq))

    this.output.gain
      .cancelScheduledValues(0)
      .setValueAtTime(this.output.gain.value, now)
      .linearRampToValueAtTime(0, volEndTime)

    this.modulator.frequency
      .cancelScheduledValues(0)
      .setValueAtTime(this.modulator.frequency.value, now)
      .linearRampToValueAtTime(baseFreq, modEndTime)

    this.source.stop(volEndTime)
  }
}

export class Synthesizer {
  private collection: InstrumentCollection
  private processingPitchNodes: PitchNode[]

  constructor(private ctx: AudioContext) {
    this.collection = {}
    this.processingPitchNodes = []
  }

  async load(
    instrument: string,
    {
      baseUrl,
      pitchRange,
    }: {
      baseUrl: string
      pitchRange: readonly [Pitch, Pitch]
    },
  ) {
    const pitches = getPitchesBetween(...pitchRange)

    const paramsFetcher = await fetch(`${baseUrl}/params.json`)
    const params: InstrumentParams = await paramsFetcher.json()

    this.collection[instrument] = {
      params,
      buffers: {},
    }

    for (const pitch of pitches) {
      const audioBuffer = await fetch(`${baseUrl}/${pitch}.mp3`)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))

      this.collection[instrument].buffers[pitch] = audioBuffer
    }
  }

  getInstruments() {
    return Object.keys(this.collection)
  }

  resolveInstrumentState(instrument: string | undefined) {
    const instruments = this.getInstruments()

    if (instruments.length === 0) {
      throw new SynthesizerError('no available instruments')
    }

    const inst = instrument === undefined ? instruments[0] : instrument

    if (inst in this.collection) {
      return this.collection[inst]
    }

    throw new SynthesizerError(`instrument '${inst}' does not exist`)
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
    const state = this.resolveInstrumentState(instrument)
    const pitchNode = new PitchNode(pitch, this.ctx, state, volume)

    pitchNode.soundOn()

    this.processingPitchNodes.push(pitchNode)

    return () => this.soundOff(pitchNode)
  }

  soundOff(pitchNode: PitchNode) {
    pitchNode.soundOff()

    for (let i = 0; i < this.processingPitchNodes.length; i++) {
      if (this.processingPitchNodes[i] === pitchNode) {
        this.processingPitchNodes.splice(i, 1)
        return
      }
    }
  }

  allSoundOff() {
    for (const pitchNode of this.processingPitchNodes) {
      this.soundOff(pitchNode)
    }
  }
}
