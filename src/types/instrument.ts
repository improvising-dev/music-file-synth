import { Pitch } from './pitch'

export interface InstrumentCollection {
  [instrument: string]: InstrumentState
}

export interface InstrumentState {
  params: InstrumentParams
  buffers: {
    [pitch in Pitch]?: AudioBuffer
  }
}

export interface InstrumentParams {
  volDelay: number
  volAttack: number
  volHold: number
  volDecay: number
  volSustain: number
  volRelease: number
  modDelay: number
  modAttack: number
  modHold: number
  modDecay: number
  modSustain: number
  modRelease: number
  initialFilterFc: number
  modEnvToFilterFc: number
  initialFilterQ: number
  initialAttenuation: number
}
