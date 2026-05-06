import {
  SAMPLE_COUNT,
  sampleLatent,
} from "./generator";
import { decodeCandidate } from "./decoder";
import { getGlobalLatentParams } from "./latentMap";
import { scoreCandidate } from "./rewardModel";

export function createLatentPolicy(latentMap = null) {
  const g = getGlobalLatentParams(latentMap || {});
  return {
    mean: [...g.mean],
    std: g.std,
    baseMean: [...g.mean],
    baseStd: g.std,
  };
}

export async function updateLatentPolicyFromRewardScores(policy, rm, poolSize = 36) {
  const next = {
    mean: [...policy.mean],
    std: policy.std,
    baseMean: [...policy.baseMean],
    baseStd: policy.baseStd,
  };

  const candidates = await Promise.all(
    Array.from({ length: poolSize }, () =>
      decodeCandidate({
        z: sampleLatent(next.mean, next.std),
        source: "policy_probe",
      })
    )
  );
  const scored = candidates.map((candidate) => ({
    z: candidate.z,
    score: scoreCandidate(rm, candidate),
  }));
  const maxScore = Math.max(...scored.map((item) => item.score));
  const weights = scored.map((item) => Math.exp((item.score - maxScore) * 2.5));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
  const target = scored.reduce(
    (acc, item, i) => [
      acc[0] + item.z[0] * (weights[i] / weightTotal),
      acc[1] + item.z[1] * (weights[i] / weightTotal),
    ],
    [0, 0]
  );

  next.mean = [
    next.mean[0] * 0.72 + target[0] * 0.28,
    next.mean[1] * 0.72 + target[1] * 0.28,
  ];
  next.std = Math.max(0.36, next.std * 0.985);

  return next;
}

export function sampleBaseLatentDistribution(latentMap, count = 90) {
  const g = getGlobalLatentParams(latentMap || {});
  return Array.from({ length: count }, () => sampleLatent(g.mean, g.std));
}

export function sampleTunedLatentDistribution(policy, count = 70) {
  return Array.from({ length: count }, () => sampleLatent(policy.mean, policy.std));
}

export function getLatentPolicyMean(policy) {
  return policy?.mean || [0, 0];
}

export function getLatentPolicyEntry(policy) {
  return policy || {
    mean: [0, 0],
    std: 0.62,
    baseMean: [0, 0],
    baseStd: 0.62,
  };
}

export function getBaseLatentParams(latentMap) {
  return getGlobalLatentParams(latentMap);
}

export async function bestOfN(rm, n = 24, policy = createLatentPolicy()) {
  let best = null;
  let bestScore = -Infinity;
  const policyEntry = policy || createLatentPolicy();

  for (let i = 0; i < n; i += 1) {
    const candidate = await decodeCandidate({
      source: "tuned",
      z: sampleLatent(policyEntry.mean, policyEntry.std),
    });
    const score = scoreCandidate(rm, candidate);

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  best.reward = bestScore;
  return best;
}

export async function generateTunedSamples(rm, count = SAMPLE_COUNT, policy) {
  return Promise.all(Array.from({ length: count }, () => bestOfN(rm, 32, policy)));
}

export async function generateEvaluationTunedSamples(rm, count = 24, policy) {
  return Promise.all(Array.from({ length: count }, () => bestOfN(rm, 24, policy)));
}
