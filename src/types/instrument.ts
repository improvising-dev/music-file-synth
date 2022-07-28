import { Pitch } from './pitch'

export type InstrumentCollection = Record<string, Record<Pitch, AudioBuffer>>
