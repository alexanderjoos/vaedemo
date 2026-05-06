import { clamp } from "./generator";

export const ANALYZER_TRAITS = ["colorTemperature"];

export const TRAIT_LABELS = {
  thickness: "Stroke Thickness",
  centeredness: "Centeredness",
  slant: "Slant",
  cleanliness: "Cleanliness",
  colorTemperature: "Color Temperature",
};

function analyzeImageTraits(imageData) {
  const { data, width, height } = imageData;
  const total = width * height;

  let borderSum = 0;
  let borderCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x > 2 && x < width - 3 && y > 2 && y < height - 3) continue;

      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      borderSum += 0.299 * r + 0.587 * g + 0.114 * b;
      borderCount += 1;
    }
  }

  const bgLum = borderSum / Math.max(1, borderCount);
  const threshold = Math.max(38, bgLum + 24);
  const mask = new Uint8Array(total);

  let fg = 0;
  let sumX = 0;
  let sumY = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);

      if (lum > threshold || (chroma > 38 && lum > 34)) {
        const m = y * width + x;
        mask[m] = 1;

        fg += 1;
        sumX += x;
        sumY += y;
        sumR += r;
        sumG += g;
        sumB += b;
      }
    }
  }

  if (fg < 5) {
    return {
      thickness: 0,
      centeredness: 0,
      slant: 0.5,
      cleanliness: 0,
      colorTemperature: 0.5,
    };
  }

  const cx = sumX / fg;
  const cy = sumY / fg;

  let mu02 = 0;
  let mu11 = 0;
  let isolated = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const m = y * width + x;
      if (!mask[m]) continue;

      const dx = x - cx;
      const dy = y - cy;

      mu02 += dy * dy;
      mu11 += dx * dy;

      let neighbors = 0;

      for (let yy = -1; yy <= 1; yy += 1) {
        for (let xx = -1; xx <= 1; xx += 1) {
          if (xx === 0 && yy === 0) continue;
          if (mask[(y + yy) * width + (x + xx)]) neighbors += 1;
        }
      }

      if (neighbors <= 1) isolated += 1;
    }
  }

  const centerDist = Math.hypot(cx - width / 2, cy - height / 2);
  const centeredness = clamp(1 - centerDist / (width * 0.45), 0, 1);

  const thickness = clamp((fg / total) * 7.5, 0, 1);

  const slope = mu02 > 0 ? mu11 / mu02 : 0;
  const slant = clamp(0.5 + slope * 1.35, 0, 1);

  const cleanliness = clamp(1 - (isolated / fg) * 4.2, 0, 1);

  const meanR = sumR / fg;
  const meanG = sumG / fg;
  const meanB = sumB / fg;

  const colorTemperature = clamp((meanB - meanR + 255) / 510 + (meanG - meanR) / 900, 0, 1);

  return {
    thickness,
    centeredness,
    slant,
    cleanliness,
    colorTemperature,
  };
}

function averageAnalyzerScores(samples) {
  const totals = {};

  ANALYZER_TRAITS.forEach((k) => {
    totals[k] = 0;
  });

  if (!samples.length) return totals;

  samples.forEach((sample) => {
    const scores = analyzeImageTraits(sample.imageData);

    ANALYZER_TRAITS.forEach((k) => {
      totals[k] += scores[k];
    });
  });

  ANALYZER_TRAITS.forEach((k) => {
    totals[k] /= samples.length;
  });

  return totals;
}

export function computeTraitAnalysis(
  evalBaseSamples,
  evalTunedSamples,
  preferredHistory,
  rejectedHistory
) {
  const result = {};
  const baseAvg = averageAnalyzerScores(evalBaseSamples);
  const tunedAvg = averageAnalyzerScores(evalTunedSamples);
  const prefAvg = averageAnalyzerScores(preferredHistory);
  const rejAvg = averageAnalyzerScores(rejectedHistory);

  ANALYZER_TRAITS.forEach((k) => {
    const tunedShift = tunedAvg[k] - baseAvg[k];
    const prefDiff =
      preferredHistory.length && rejectedHistory.length ? prefAvg[k] - rejAvg[k] : 0;

    const combined = tunedShift * 0.7 + prefDiff * 0.45;
    const evidence = Math.abs(tunedShift) * 1.15 + Math.abs(prefDiff) * 0.85;

    let level = "unclear";

    if (evidence > 0.27) level = "confirmed";
    else if (evidence > 0.18) level = "strong";
    else if (evidence > 0.09) level = "emerging";

    result[k] = {
      level,
      confidence: clamp(evidence / 0.32, 0, 1),
      direction: combined >= 0 ? "higher" : "lower",
      tunedShift,
      prefDiff,
      baseAvg: baseAvg[k],
      tunedAvg: tunedAvg[k],
    };
  });

  return result;
}

export function describeTraitDirection(trait, direction) {
  const higher = direction === "higher";

  const phrases = {
    thickness: higher ? "thicker strokes" : "thinner strokes",
    centeredness: higher ? "more centered digits" : "more off-center digits",
    slant: higher ? "more right-leaning digits" : "more left-leaning digits",
    cleanliness: higher ? "cleaner digits" : "messier digits",
    colorTemperature: higher ? "cooler colors" : "warmer colors",
  };

  return phrases[trait] || `${direction} ${trait}`;
}
