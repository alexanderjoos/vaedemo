export const IMAGE_SIZE = 64;
export const SAMPLE_COUNT = 12;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function gaussian() {
  const u = Math.max(Math.random(), 1e-8);
  const v = Math.max(Math.random(), 1e-8);

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function sampleLatent(mean = [0, 0], std = 0.78) {
  return [mean[0] + gaussian() * std, mean[1] + gaussian() * std];
}
