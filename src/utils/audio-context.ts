export const AudioContext = window.AudioContext ?? window.webkitAudioContext

export const createAudioContext = () => new AudioContext()
