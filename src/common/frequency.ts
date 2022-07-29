export const amountToFreq = (val: number) =>
  Math.pow(2, (val - 6900) / 1200) * 440
