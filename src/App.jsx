import { useCallback, useEffect, useRef, useState } from "react";

import ControlsSummary from "./components/ControlsSummary";
import LatentSpacePane from "./components/LatentSpacePane";
import PreferenceArena from "./components/PreferenceArena";
import RewardDiagnostics from "./components/RewardDiagnostics";
import SampleGenerations from "./components/SampleGenerations";
import TaskExplanation from "./components/TaskExplanation";
import TraitAnalyzer from "./components/TraitAnalyzer";
import TrainingMetrics from "./components/TrainingMetrics";
import TrainingPipeline from "./components/TrainingPipeline";
import {
  SAMPLE_COUNT,
} from "./model/generator";
import {
  generateCandidateBatch,
  generateEvaluationBaseSamples,
  generateSamplesForDigit,
  loadDecoder,
} from "./model/decoder";
import { loadLatentMap } from "./model/latentMap";
import {
  cloneRewardModel,
  createRewardModel,
  scoreCandidate,
  updateRewardModelFromPreference,
} from "./model/rewardModel";
import {
  computeTraitAnalysis,
  describeTraitDirection,
} from "./model/analyzers";
import {
  createLatentPolicy,
  getBaseLatentParams,
  generateEvaluationTunedSamples,
  generateTunedSamplesForDigit,
  updateLatentPolicyFromRewardScores,
} from "./model/latentPolicy";

// Core rule:
// - Training happens only when the user chooses a preferred candidate.
// - Refreshing samples only generates images; it does not train.
// - Reward model learns from image embeddings.
// - Trait analyzers inspect rendered images after the fact.
// - Analyzer scores are never passed into the reward model.

export default function App() {
  const [decoderStatus, setDecoderStatus] = useState("loading");
  const [decoderError, setDecoderError] = useState("");
  const [latentMap, setLatentMap] = useState(null);
  const [rewardModel, setRewardModel] = useState(() => createRewardModel());
  const [latentPolicy, setLatentPolicy] = useState(() => createLatentPolicy());
  const [trainingPhase, setTrainingPhase] = useState("idle");
  const [rankings, setRankings] = useState(0);
  const [comparisons, setComparisons] = useState(0);
  const [correctComparisons, setCorrectComparisons] = useState(0);
  const [lossHistory, setLossHistory] = useState([]);
  const [marginHistory, setMarginHistory] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [rejectedIdxs, setRejectedIdxs] = useState([]);
  const [sampleDigit, setSampleDigit] = useState(7);
  const [baseSamples, setBaseSamples] = useState([]);
  const [tunedSamples, setTunedSamples] = useState([]);
  const [evalBaseSamples, setEvalBaseSamples] = useState([]);
  const [traitAnalysis, setTraitAnalysis] = useState({});
  const [avgBaseReward, setAvgBaseReward] = useState(0);
  const [avgTunedReward, setAvgTunedReward] = useState(0);
  const [rewardDistribution, setRewardDistribution] = useState([]);

  const preferredHistory = useRef([]);
  const rejectedHistory = useRef([]);
  const phaseTimers = useRef([]);

  const clearPhaseTimers = useCallback(() => {
    phaseTimers.current.forEach((timer) => clearTimeout(timer));
    phaseTimers.current = [];
  }, []);

  const getBaseLatentParamsByDigit = useCallback(
    () =>
      Object.fromEntries(
        Array.from({ length: 10 }, (_, digit) => [digit, getBaseLatentParams(latentMap, digit)])
      ),
    [latentMap]
  );

  const updateDiagnostics = useCallback((rm, nextEvalBaseSamples, nextEvalTunedSamples) => {
    const baseScores = nextEvalBaseSamples.map((s) => scoreCandidate(rm, s));
    const tunedScores = nextEvalTunedSamples.map((s) => scoreCandidate(rm, s));

    const baseAvg = baseScores.reduce((a, b) => a + b, 0) / Math.max(1, baseScores.length);
    const tunedAvg =
      tunedScores.reduce((a, b) => a + b, 0) / Math.max(1, tunedScores.length);

    setAvgBaseReward(baseAvg);
    setAvgTunedReward(tunedAvg);
    setRewardDistribution([...baseScores, ...tunedScores]);

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
    clearPhaseTimers();
    setCandidates(
      await generateCandidateBatch({
        count: 3,
        latentParamsByDigit: getBaseLatentParamsByDigit(),
      })
    );
    setSelectedIdx(null);
    setRejectedIdxs([]);
    setTrainingPhase("idle");
  }, [clearPhaseTimers, getBaseLatentParamsByDigit]);

  const refreshVisibleSamples = useCallback(
    async (rm = rewardModel, digit = sampleDigit, policy = latentPolicy) => {
      const baseParams = getBaseLatentParams(latentMap, digit);
      const [nextBase, nextTuned] = await Promise.all([
        generateSamplesForDigit(digit, SAMPLE_COUNT, baseParams.mean, baseParams.std),
        generateTunedSamplesForDigit(rm, digit, SAMPLE_COUNT, policy),
      ]);

      setBaseSamples(nextBase);
      setTunedSamples(nextTuned);
    },
    [rewardModel, sampleDigit, latentPolicy, latentMap]
  );

  const refreshEvaluationAndAnalyzers = useCallback(
    async (rm = rewardModel, policy = latentPolicy) => {
      const latentParamsByDigit = getBaseLatentParamsByDigit();
      const [nextEvalBase, nextEvalTuned] = await Promise.all([
        generateEvaluationBaseSamples(2, latentParamsByDigit),
        generateEvaluationTunedSamples(rm, 2, policy),
      ]);

      setEvalBaseSamples(nextEvalBase);
      updateDiagnostics(rm, nextEvalBase, nextEvalTuned);
    },
    [rewardModel, latentPolicy, updateDiagnostics, getBaseLatentParamsByDigit]
  );

  const handleChoice = useCallback(
    (idx) => {
      if (selectedIdx !== null || !candidates[idx]) return;

      clearPhaseTimers();

      const preferred = candidates[idx];
      const rejected = candidates.filter((_, i) => i !== idx);
      const rejectedIdxs = candidates.map((_, i) => i).filter((i) => i !== idx);

      setSelectedIdx(idx);
      setRejectedIdxs(rejectedIdxs);
      setTrainingPhase("preference_selected");

      const rmCopy = cloneRewardModel(rewardModel);

      let totalLoss = 0;
      let totalMargin = 0;
      let newCorrect = 0;

      rejected.forEach((rej) => {
        const update = updateRewardModelFromPreference(rmCopy, preferred, rej);

        totalLoss += update.loss;
        totalMargin += update.margin;

        if (update.correctBeforeUpdate) newCorrect += 1;
      });

      preferredHistory.current.push(preferred);
      rejected.forEach((r) => rejectedHistory.current.push(r));

      const avgLoss = totalLoss / rejected.length;
      const avgMargin = totalMargin / rejected.length;

      phaseTimers.current = [
        setTimeout(() => {
          setTrainingPhase("reward_training");
          setLossHistory((h) => [...h.slice(-49), avgLoss]);
          setMarginHistory((h) => [...h.slice(-49), avgMargin]);
          setCorrectComparisons((c) => c + newCorrect);
          setComparisons((c) => c + rejected.length);
          setRewardModel(rmCopy);
          setRankings((r) => r + 1);
        }, 220),

        setTimeout(() => {
          setTrainingPhase("policy_training");
          updateLatentPolicyFromRewardScores(latentPolicy, rmCopy, preferred.digit)
            .then((nextLatentPolicy) => {
              setLatentPolicy(nextLatentPolicy);
              phaseTimers.current.push(
                setTimeout(async () => {
                  setTrainingPhase("refreshing_samples");
                  setCandidates(await generateCandidateBatch({ count: 3 }));
                  setSelectedIdx(null);
                  setRejectedIdxs([]);

                  const nextVisibleTuned = await generateTunedSamplesForDigit(
                    rmCopy,
                    sampleDigit,
                    SAMPLE_COUNT,
                    nextLatentPolicy
                  );
                  setTunedSamples(nextVisibleTuned);

                  const nextEvalTuned = await generateEvaluationTunedSamples(
                    rmCopy,
                    2,
                    nextLatentPolicy
                  );
                  updateDiagnostics(rmCopy, evalBaseSamples, nextEvalTuned);
                }, 340),
                setTimeout(() => {
                  setTrainingPhase("complete");
                }, 680)
              );
            })
            .catch((error) => {
              setDecoderError(error.message);
              setTrainingPhase("complete");
            });
        }, 560),
      ];
    },
    [
      selectedIdx,
      candidates,
      rewardModel,
      latentPolicy,
      sampleDigit,
      evalBaseSamples,
      updateDiagnostics,
      clearPhaseTimers,
    ]
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "1" || e.key === "ArrowLeft") handleChoice(0);
      if (e.key === "2" || e.key === "ArrowUp") handleChoice(1);
      if (e.key === "3" || e.key === "ArrowRight") handleChoice(2);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleChoice]);

  useEffect(() => clearPhaseTimers, [clearPhaseTimers]);

  useEffect(() => {
    let cancelled = false;

    async function initializeDecoderSamples() {
      try {
        setDecoderStatus("loading");
        await loadDecoder();
        const nextLatentMap = await loadLatentMap();

        const rm = createRewardModel();
        const initialDigit = 7;
        const policy = createLatentPolicy(nextLatentMap);
        const initialBaseParams = getBaseLatentParams(nextLatentMap, initialDigit);
        const latentParamsByDigit = Object.fromEntries(
          Array.from({ length: 10 }, (_, digit) => [digit, getBaseLatentParams(nextLatentMap, digit)])
        );
        const [nextCandidates, nextBaseSamples, nextTunedSamples, nextEvalBase, nextEvalTuned] =
          await Promise.all([
            generateCandidateBatch({ count: 3, latentParamsByDigit }),
            generateSamplesForDigit(
              initialDigit,
              SAMPLE_COUNT,
              initialBaseParams.mean,
              initialBaseParams.std
            ),
            generateSamplesForDigit(
              initialDigit,
              SAMPLE_COUNT,
              initialBaseParams.mean,
              initialBaseParams.std
            ),
            generateEvaluationBaseSamples(2, latentParamsByDigit),
            generateEvaluationBaseSamples(2, latentParamsByDigit),
          ]);

        if (cancelled) return;

        setLatentMap(nextLatentMap);
        setRewardModel(rm);
        setLatentPolicy(policy);
        setCandidates(nextCandidates);
        setBaseSamples(nextBaseSamples);
        setTunedSamples(nextTunedSamples);
        setEvalBaseSamples(nextEvalBase);
        updateDiagnostics(rm, nextEvalBase, nextEvalTuned);
        setDecoderStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setDecoderError(error.message);
        setDecoderStatus("error");
      }
    }

    initializeDecoderSamples();

    return () => {
      cancelled = true;
    };
  }, [updateDiagnostics]);

  const handleRefreshSamples = () => {
    void refreshVisibleSamples();
    void refreshEvaluationAndAnalyzers();
  };

  const handleSampleDigitChange = (digit) => {
    setSampleDigit(digit);
    void refreshVisibleSamples(rewardModel, digit);
  };

  const handleLearningRateChange = (lr) => {
    setRewardModel((rm) => ({
      ...rm,
      lr,
    }));
  };

  const handleReset = async () => {
    const rm = createRewardModel();
    const nextLatentPolicy = createLatentPolicy(latentMap);
    const baseParams = getBaseLatentParams(latentMap, sampleDigit);
    const latentParamsByDigit = getBaseLatentParamsByDigit();
    const [nextCandidates, nextBaseSamples, nextTunedSamples, nextEvalBase, nextEvalTuned] =
      await Promise.all([
        generateCandidateBatch({ count: 3, latentParamsByDigit }),
        generateSamplesForDigit(sampleDigit, SAMPLE_COUNT, baseParams.mean, baseParams.std),
        generateSamplesForDigit(sampleDigit, SAMPLE_COUNT, baseParams.mean, baseParams.std),
        generateEvaluationBaseSamples(2, latentParamsByDigit),
        generateEvaluationBaseSamples(2, latentParamsByDigit),
      ]);

    preferredHistory.current = [];
    rejectedHistory.current = [];
    clearPhaseTimers();

    setRewardModel(rm);
    setLatentPolicy(nextLatentPolicy);
    setTrainingPhase("idle");
    setRankings(0);
    setComparisons(0);
    setCorrectComparisons(0);
    setLossHistory([]);
    setMarginHistory([]);
    setCandidates(nextCandidates);
    setSelectedIdx(null);
    setRejectedIdxs([]);
    setBaseSamples(nextBaseSamples);
    setTunedSamples(nextTunedSamples);
    setEvalBaseSamples(nextEvalBase);
    setTraitAnalysis({});

    updateDiagnostics(rm, nextEvalBase, nextEvalTuned);
  };

  const preferenceAccuracy =
    comparisons > 0 ? `${Math.round((correctComparisons / comparisons) * 100)}%` : "---";

  const learnedTraits = Object.entries(traitAnalysis)
    .filter(([, a]) => a.level === "confirmed" || a.level === "strong")
    .map(([trait, a]) => describeTraitDirection(trait, a.direction));

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
          RLHF Playground
        </h1>

        <span
          style={{
            fontSize: 12,
            color: "#64748b",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          Colored MNIST-style digit generation
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
            "ONNX decoder active. Training happens only when you choose a preferred candidate."}
          {decoderStatus === "error" && `Decoder load failed: ${decoderError}`}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "290px 1fr 270px",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            background: "#13161e",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: 14,
            fontSize: 12,
          }}
        >
          <TaskExplanation />
        </div>

        <PreferenceArena
          candidates={candidates}
          selectedIdx={selectedIdx}
          rejectedIdxs={rejectedIdxs}
          onChoice={handleChoice}
          onNewCandidates={makeNewCandidates}
        />

        <TraitAnalyzer rankings={rankings} traitAnalysis={traitAnalysis} />
      </div>

      <SampleGenerations
        latentPane={
          <LatentSpacePane
            latentMap={latentMap}
            sampleDigit={sampleDigit}
            latentPolicy={latentPolicy}
            candidates={candidates}
            selectedIdx={selectedIdx}
            rejectedIdxs={rejectedIdxs}
            trainingPhase={trainingPhase}
          />
        }
        sampleDigit={sampleDigit}
        baseSamples={baseSamples}
        tunedSamples={tunedSamples}
        onRefreshSamples={handleRefreshSamples}
        onSampleDigitChange={handleSampleDigitChange}
      />

      <div
        style={{
          background: "#13161e",
          border: "1px solid #1e293b",
          borderRadius: 8,
          padding: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 16,
        }}
      >
        <TrainingPipeline trainingPhase={trainingPhase} />

        <TrainingMetrics
          rankings={rankings}
          preferenceAccuracy={preferenceAccuracy}
          lossHistory={lossHistory}
          marginHistory={marginHistory}
        />

        <RewardDiagnostics
          avgBaseReward={avgBaseReward}
          avgTunedReward={avgTunedReward}
          rewardDistribution={rewardDistribution}
        />

        <ControlsSummary
          rewardModel={rewardModel}
          onLearningRateChange={handleLearningRateChange}
          onReset={handleReset}
          learnedTraits={learnedTraits}
        />
      </div>
    </div>
  );
}
