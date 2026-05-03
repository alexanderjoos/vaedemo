import {
  SAMPLE_COUNT,
  sampleLatent,
} from "./generator";
import { decodeCandidate } from "./decoder";
import { scoreCandidate } from "./rewardModel";

export function createLatentPolicy() {
  return Array.from({ length: 10 }, () => ({
    mean: [0, 0],
    std: 0.62,
  }));
}

export async function updateLatentPolicyFromRewardScores(policy, rm, digit, poolSize = 36) {
  const next = policy.map((entry) => ({
    mean: [...entry.mean],
    std: entry.std,
  }));

  const entry = next[digit];
  const candidates = await Promise.all(
    Array.from({ length: poolSize }, () =>
      decodeCandidate({
        digit,
        z: sampleLatent(entry.mean, entry.std),
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

  entry.mean = [
    entry.mean[0] * 0.72 + target[0] * 0.28,
    entry.mean[1] * 0.72 + target[1] * 0.28,
  ];
  entry.std = Math.max(0.36, entry.std * 0.985);

  return next;
}

export function sampleBaseLatentDistribution(count = 90) {
  return Array.from({ length: count }, () => sampleLatent([0, 0], 0.82));
}

export function sampleTunedLatentDistribution(policy, digit, count = 70) {
  const entry = policy[digit];

  return Array.from({ length: count }, () => sampleLatent(entry.mean, entry.std));
}

export function getLatentPolicyMean(policy, digit) {
  return policy[digit]?.mean || [0, 0];
}

export async function bestOfN(rm, digit, n = 24, policy = createLatentPolicy()) {
  let best = null;
  let bestScore = -Infinity;
  const policyEntry = policy[digit] || { mean: [0, 0], std: 0.62 };

  for (let i = 0; i < n; i += 1) {
    const candidate = await decodeCandidate({
      digit,
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

export function generateTunedSamplesForDigit(rm, digit, count = SAMPLE_COUNT, policy) {
  return Promise.all(Array.from({ length: count }, () => bestOfN(rm, digit, 32, policy)));
}

export async function generateEvaluationTunedSamples(rm, countPerDigit = 2, policy) {
  const jobs = [];

  for (let digit = 0; digit <= 9; digit += 1) {
    for (let i = 0; i < countPerDigit; i += 1) {
      jobs.push(bestOfN(rm, digit, 24, policy));
    }
  }

  return Promise.all(jobs);
}
