import { useCallback, useEffect, useRef, useState } from "react";

import ControlsSummary from "./components/ControlsSummary";
import LatentSpacePane from "./components/LatentSpacePane";
import PreferenceArena from "./components/PreferenceArena";
import SampleGenerations from "./components/SampleGenerations";
import TraitAnalyzer from "./components/TraitAnalyzer";
import { SAMPLE_COUNT } from "./model/generator";
import {
  generateCandidateBatch,
  generateEvaluationBaseSamples,
  generateSamplesBase,
  loadDecoder,
} from "./model/decoder";
import { loadLatentMap } from "./model/latentMap";
import {
  cloneRewardModel,
  createRewardModel,
  updateRewardModelFromPreference,
} from "./model/rewardModel";
import { computeTraitAnalysis, describeTraitDirection } from "./model/analyzers";
import {
  createLatentPolicy,
  getBaseLatentParams,
  generateEvaluationTunedSamples,
  generateTunedSamples,
  updateLatentPolicyFromRewardScores,
} from "./model/latentPolicy";

const PREFERENCE_BATCH_TARGET = 2;
const EVAL_SAMPLE_COUNT = 24;

export default function App() {
  const [decoderStatus, setDecoderStatus] = useState("loading");
  const [decoderError, setDecoderError] = useState("");
  const [latentMap, setLatentMap] = useState(null);
  const [rewardModel, setRewardModel] = useState(() => createRewardModel());
  const [latentPolicy, setLatentPolicy] = useState(() => createLatentPolicy());
  const [trainingPhase, setTrainingPhase] = useState("idle");
  const [rankings, setRankings] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [candidateQueue, setCandidateQueue] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [rejectedIdxs, setRejectedIdxs] = useState([]);
  const [highlightDigit, setHighlightDigit] = useState(7);
  const [baseSamples, setBaseSamples] = useState([]);
  const [tunedSamples, setTunedSamples] = useState([]);
  const [evalBaseSamples, setEvalBaseSamples] = useState([]);
  const [traitAnalysis, setTraitAnalysis] = useState({});

  const preferredHistory = useRef([]);
  const rejectedHistory = useRef([]);
  const candidateQueueRef = useRef([]);
  const queueFillInFlight = useRef(false);
  const latentPolicyRef = useRef(createLatentPolicy());

  useEffect(() => {
    latentPolicyRef.current = latentPolicy;
  }, [latentPolicy]);

  useEffect(() => {
    candidateQueueRef.current = candidateQueue;
  }, [candidateQueue]);

  const generateCandidateSets = useCallback(async (count, policy) => {
    const latentParams = { mean: policy.mean, std: policy.std };
    const batches = [];

    for (let i = 0; i < count; i += 1) {
      batches.push(await generateCandidateBatch({ count: 3, latentParams }));
    }

    return batches;
  }, []);

  const topUpCandidateQueue = useCallback(
    async (knownQueueLength = candidateQueueRef.current.length) => {
      const missing = Math.max(0, PREFERENCE_BATCH_TARGET - 1 - knownQueueLength);
      if (!missing || queueFillInFlight.current) return;

      queueFillInFlight.current = true;
      try {
        const policy = latentPolicyRef.current;
        const nextBatches = await generateCandidateSets(missing, policy);
        setCandidateQueue((queue) => [...queue, ...nextBatches]);
      } finally {
        queueFillInFlight.current = false;
      }
    },
    [generateCandidateSets]
  );

  const advanceCandidateBatch = useCallback(async () => {
    const policy = latentPolicyRef.current;
    const queued = candidateQueueRef.current;

    setSelectedIdx(null);
    setRejectedIdxs([]);

    if (queued.length > 0) {
      const [nextBatch, ...rest] = queued;
      setCandidates(nextBatch);
      setCandidateQueue(rest);
      void topUpCandidateQueue(rest.length);
      return;
    }

    const [nextBatch, ...rest] = await generateCandidateSets(PREFERENCE_BATCH_TARGET, policy);
    setCandidates(nextBatch || []);
    setCandidateQueue(rest);
  }, [generateCandidateSets, topUpCandidateQueue]);

  const updateDiagnostics = useCallback((nextEvalBaseSamples, nextEvalTunedSamples) => {
    setTraitAnalysis(
      computeTraitAnalysis(
        nextEvalBaseSamples,
        nextEvalTunedSamples,
        preferredHistory.current,
        rejectedHistory.current
      )
    );
  }, []);

  const makeNewCandidates = useCallback(async () => {
    setTrainingPhase("idle");
    await advanceCandidateBatch();
  }, [advanceCandidateBatch]);

  const refreshVisibleSamples = useCallback(
    async (rm = rewardModel, policy = latentPolicy) => {
      const baseParams = getBaseLatentParams(latentMap);
      const [nextBase, nextTuned] = await Promise.all([
        generateSamplesBase(SAMPLE_COUNT, baseParams.mean, baseParams.std),
        generateTunedSamples(rm, SAMPLE_COUNT, policy),
      ]);

      setBaseSamples(nextBase);
      setTunedSamples(nextTuned);
    },
    [rewardModel, latentPolicy, latentMap]
  );

  const refreshEvaluationAndAnalyzers = useCallback(
    async (rm = rewardModel, policy = latentPolicy) => {
      const baseParams = getBaseLatentParams(latentMap);
      const [nextEvalBase, nextEvalTuned] = await Promise.all([
        generateEvaluationBaseSamples(EVAL_SAMPLE_COUNT, baseParams),
        generateEvaluationTunedSamples(rm, EVAL_SAMPLE_COUNT, policy),
      ]);

      setEvalBaseSamples(nextEvalBase);
      updateDiagnostics(nextEvalBase, nextEvalTuned);
    },
    [rewardModel, latentPolicy, updateDiagnostics, latentMap]
  );

  const handleChoice = useCallback(
    async (idx) => {
      if (selectedIdx !== null || !candidates[idx]) return;

      const preferred = candidates[idx];
      const rejected = candidates.filter((_, i) => i !== idx);
      const rejectedIdxsNext = candidates.map((_, i) => i).filter((i) => i !== idx);

      setSelectedIdx(idx);
      setRejectedIdxs(rejectedIdxsNext);
      setTrainingPhase("preference_selected");

      const rmCopy = cloneRewardModel(rewardModel);
      rejected.forEach((rej) => {
        updateRewardModelFromPreference(rmCopy, preferred, rej);
      });

      preferredHistory.current.push(preferred);
      rejected.forEach((entry) => rejectedHistory.current.push(entry));

      try {
        setTrainingPhase("reward_training");
        setRewardModel(rmCopy);
        setRankings((value) => value + 1);

        setTrainingPhase("policy_training");
        const nextLatentPolicy = await updateLatentPolicyFromRewardScores(latentPolicy, rmCopy);
        latentPolicyRef.current = nextLatentPolicy;
        setLatentPolicy(nextLatentPolicy);

        setTrainingPhase("refreshing_samples");
        await advanceCandidateBatch();

        const [nextTuned, nextEvalTuned] = await Promise.all([
          generateTunedSamples(rmCopy, SAMPLE_COUNT, nextLatentPolicy),
          generateEvaluationTunedSamples(rmCopy, EVAL_SAMPLE_COUNT, nextLatentPolicy),
        ]);
        setTunedSamples(nextTuned);
        updateDiagnostics(evalBaseSamples, nextEvalTuned);
        setTrainingPhase("complete");
      } catch (error) {
        setDecoderError(error.message);
        setTrainingPhase("complete");
      }
    },
    [
      selectedIdx,
      candidates,
      rewardModel,
      latentPolicy,
      advanceCandidateBatch,
      evalBaseSamples,
      updateDiagnostics,
    ]
  );

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "1" || event.key === "ArrowLeft") void handleChoice(0);
      if (event.key === "2" || event.key === "ArrowUp") void handleChoice(1);
      if (event.key === "3" || event.key === "ArrowRight") void handleChoice(2);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleChoice]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        setDecoderStatus("loading");
        await loadDecoder();
        const nextLatentMap = await loadLatentMap();
        const rm = createRewardModel();
        const policy = createLatentPolicy(nextLatentMap);
        latentPolicyRef.current = policy;

        const baseParams = getBaseLatentParams(nextLatentMap);
        const candidateBatches = await generateCandidateSets(PREFERENCE_BATCH_TARGET, policy);

        if (cancelled) return;

        setLatentMap(nextLatentMap);
        setRewardModel(rm);
        setLatentPolicy(policy);
        setCandidates(candidateBatches[0] || []);
        setCandidateQueue(candidateBatches.slice(1));
        setDecoderStatus("ready");

        const [nextBaseSamples, nextTunedSeed, nextEvalBase, nextEvalTuned] = await Promise.all([
          generateSamplesBase(SAMPLE_COUNT, baseParams.mean, baseParams.std),
          generateSamplesBase(SAMPLE_COUNT, baseParams.mean, baseParams.std),
          generateEvaluationBaseSamples(EVAL_SAMPLE_COUNT, baseParams),
          generateEvaluationBaseSamples(EVAL_SAMPLE_COUNT, baseParams),
        ]);

        if (cancelled) return;

        setBaseSamples(nextBaseSamples);
        setTunedSamples(nextTunedSeed);
        setEvalBaseSamples(nextEvalBase);
        updateDiagnostics(nextEvalBase, nextEvalTuned);
      } catch (error) {
        if (cancelled) return;
        setDecoderError(error.message);
        setDecoderStatus("error");
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [generateCandidateSets, updateDiagnostics]);

  const handleLearningRateChange = (lr) => {
    setRewardModel((rm) => ({
      ...rm,
      lr,
    }));
  };

  const handleReset = async () => {
    const rm = createRewardModel();
    const nextLatentPolicy = createLatentPolicy(latentMap);
    latentPolicyRef.current = nextLatentPolicy;
    const baseParams = getBaseLatentParams(latentMap);

    const [candidateBatches, nextBaseSamples, nextTunedSeed, nextEvalBase, nextEvalTuned] =
      await Promise.all([
        generateCandidateSets(PREFERENCE_BATCH_TARGET, nextLatentPolicy),
        generateSamplesBase(SAMPLE_COUNT, baseParams.mean, baseParams.std),
        generateSamplesBase(SAMPLE_COUNT, baseParams.mean, baseParams.std),
        generateEvaluationBaseSamples(EVAL_SAMPLE_COUNT, baseParams),
        generateEvaluationBaseSamples(EVAL_SAMPLE_COUNT, baseParams),
      ]);

    preferredHistory.current = [];
    rejectedHistory.current = [];

    setRewardModel(rm);
    setLatentPolicy(nextLatentPolicy);
    setTrainingPhase("idle");
    setRankings(0);
    setCandidates(candidateBatches[0] || []);
    setCandidateQueue(candidateBatches.slice(1));
    setSelectedIdx(null);
    setRejectedIdxs([]);
    setBaseSamples(nextBaseSamples);
    setTunedSamples(nextTunedSeed);
    setEvalBaseSamples(nextEvalBase);
    setTraitAnalysis({});

    updateDiagnostics(nextEvalBase, nextEvalTuned);
  };

  const learnedTraits = Object.entries(traitAnalysis)
    .filter(([, value]) => value.level === "confirmed" || value.level === "strong")
    .map(([trait, value]) => describeTraitDirection(trait, value.direction));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c0e14",
        color: "#e2e8f0",
        fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
        padding: "12px 16px",
        boxSizing: "border-box",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            margin: 0,
            letterSpacing: "-0.02em",
            color: "#f1f5f9",
          }}
        >
          Variational Autoencoder · MNIST · 2D latent space
        </h1>

        <span style={{ fontSize: 12, color: "#64748b" }}>
          RLHF shifts the learned Gaussian sampler over z (decoder stays frozen).
        </span>

        <div
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: decoderStatus === "error" ? "#f87171" : "#94a3b8",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {decoderStatus === "loading" && "Loading ONNX decoder..."}
          {decoderStatus === "ready" &&
            "Unconditional decode(z). Training runs only when you pick a preferred candidate."}
          {decoderStatus === "error" && `Decoder load failed: ${decoderError}`}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <PreferenceArena
          candidates={candidates}
          selectedIdx={selectedIdx}
          rejectedIdxs={rejectedIdxs}
          onChoice={(idx) => {
            void handleChoice(idx);
          }}
          onNewCandidates={makeNewCandidates}
          queueDepth={candidateQueue.length}
        />

        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              background: "#13161e",
              border: "1px solid #1e293b",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <ControlsSummary
              rewardModel={rewardModel}
              onLearningRateChange={handleLearningRateChange}
              onReset={handleReset}
              learnedTraits={learnedTraits}
              rankings={rankings}
            />
          </div>

          <TraitAnalyzer rankings={rankings} traitAnalysis={traitAnalysis} />
        </div>
      </div>

      <SampleGenerations
        latentPane={
          <LatentSpacePane
            latentMap={latentMap}
            sampleDigit={highlightDigit}
            latentPolicy={latentPolicy}
            candidates={candidates}
            selectedIdx={selectedIdx}
            rejectedIdxs={rejectedIdxs}
            trainingPhase={trainingPhase}
          />
        }
        sampleDigit={highlightDigit}
        baseSamples={baseSamples}
        tunedSamples={tunedSamples}
        onRefreshSamples={() => {
          void refreshVisibleSamples();
          void refreshEvaluationAndAnalyzers();
        }}
        onSampleDigitChange={setHighlightDigit}
      />
    </div>
  );
}
