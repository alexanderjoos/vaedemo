const REWARD_GRID = 8;
const COLOR_GRID = 4;

export const REWARD_FEATURE_DIM =
  REWARD_GRID * REWARD_GRID + COLOR_GRID * COLOR_GRID * 3;

export function createRewardModel() {
  return {
    weights: Array(REWARD_FEATURE_DIM).fill(0),
    bias: 0,
    lr: 0.07,
    conditioning: "none",
  };
}

export function cloneRewardModel(rm) {
  return {
    weights: [...rm.weights],
    bias: rm.bias,
    lr: rm.lr,
    conditioning: rm.conditioning ?? "none",
  };
}

function encodeRewardFeatures(candidate) {
  if (candidate.rewardFeatures) return candidate.rewardFeatures;

  const { imageData } = candidate;
  const { data, width, height } = imageData;

  const gray = Array(REWARD_GRID * REWARD_GRID).fill(0);
  const grayCounts = Array(REWARD_GRID * REWARD_GRID).fill(0);

  const color = Array(COLOR_GRID * COLOR_GRID * 3).fill(0);
  const colorCounts = Array(COLOR_GRID * COLOR_GRID).fill(0);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      const gx = Math.min(REWARD_GRID - 1, Math.floor((x / width) * REWARD_GRID));
      const gy = Math.min(REWARD_GRID - 1, Math.floor((y / height) * REWARD_GRID));
      const gCell = gy * REWARD_GRID + gx;

      gray[gCell] += lum;
      grayCounts[gCell] += 1;

      const cx = Math.min(COLOR_GRID - 1, Math.floor((x / width) * COLOR_GRID));
      const cy = Math.min(COLOR_GRID - 1, Math.floor((y / height) * COLOR_GRID));
      const cCell = cy * COLOR_GRID + cx;
      const base = cCell * 3;

      color[base] += r;
      color[base + 1] += g;
      color[base + 2] += b;
      colorCounts[cCell] += 1;
    }
  }

  for (let i = 0; i < gray.length; i += 1) {
    gray[i] = grayCounts[i] ? gray[i] / grayCounts[i] - 0.5 : 0;
  }

  for (let i = 0; i < colorCounts.length; i += 1) {
    const count = colorCounts[i] || 1;
    color[i * 3] = color[i * 3] / count - 0.5;
    color[i * 3 + 1] = color[i * 3 + 1] / count - 0.5;
    color[i * 3 + 2] = color[i * 3 + 2] / count - 0.5;
  }

  const features = [...gray, ...color];
  candidate.rewardFeatures = features;

  return features;
}

export function scoreCandidate(rm, candidate) {
  const features = encodeRewardFeatures(candidate);
  let s = rm.bias;

  for (let i = 0; i < features.length; i += 1) {
    s += rm.weights[i] * features[i];
  }

  return s;
}

export function updateRewardModelFromPreference(rm, preferred, rejected) {
  const prefScore = scoreCandidate(rm, preferred);
  const rejScore = scoreCandidate(rm, rejected);
  const margin = prefScore - rejScore;
  const prob = 1 / (1 + Math.exp(-margin));
  const grad = 1 - prob;

  const prefFeatures = encodeRewardFeatures(preferred);
  const rejFeatures = encodeRewardFeatures(rejected);

  for (let i = 0; i < rm.weights.length; i += 1) {
    rm.weights[i] += rm.lr * grad * (prefFeatures[i] - rejFeatures[i]);
  }

  return {
    prob,
    loss: -Math.log(prob + 1e-8),
    margin,
    correctBeforeUpdate: margin > 0,
  };
}
