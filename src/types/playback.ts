export type TickEvent = () => void

export interface TickEventsMap {
  [tick: number]: TickEvent[]
}

export interface PlaybackIntervalRef {
  dispose: () => void
  getCurrentTick: () => number
  setCurrentTick: (tick: number) => void
}
