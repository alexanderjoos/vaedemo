const LATENT_MAP_URL = "/models/latent_map.json";

let latentMapPromise = null;

function fallbackDigitMap() {
  const radius = 1.6;
  const digits = Array.from({ length: 10 }, (_, digit) => {
    const angle = (digit / 10) * Math.PI * 2 - Math.PI / 2;
    const mean = [Math.cos(angle) * radius, Math.sin(angle) * radius];
    const points = Array.from({ length: 140 }, (_, i) => {
      const t = (i / 140) * Math.PI * 2;
      return [
        mean[0] + Math.cos(t) * 0.45 + Math.sin(i * 1.7) * 0.08,
        mean[1] + Math.sin(t) * 0.38 + Math.cos(i * 1.3) * 0.08,
      ];
    });

    return {
      digit,
      mean,
      std: 0.44,
      points,
    };
  });

  return {
    latent_dim: 2,
    extent: 2.8,
    digits,
  };
}

export async function loadLatentMap() {
  if (!latentMapPromise) {
    latentMapPromise = fetch(LATENT_MAP_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`latent map load failed: ${response.status}`);
        return response.json();
      })
      .catch(() => fallbackDigitMap());
  }

  return latentMapPromise;
}

export function getLatentMapDigit(latentMap, digit) {
  return latentMap?.digits?.find((entry) => entry.digit === digit) || null;
}

export function getLatentMapExtent(latentMap) {
  return Math.max(2.8, latentMap?.extent || 2.8);
}

export function getGlobalLatentParams(latentMap) {
  if (latentMap?.global_mean && latentMap?.global_std) {
    return {
      mean: [...latentMap.global_mean],
      std: latentMap.global_std,
    };
  }

  return {
    mean: [0, 0],
    std: 0.9,
  };
}
