const stages = [
  {
    id: "reward_training",
    label: "Reward Model Update",
    activePhases: ["preference_selected", "reward_training"],
  },
  {
    id: "policy_training",
    label: "Latent Policy Update",
    activePhases: ["policy_training"],
  },
  {
    id: "refreshing_samples",
    label: "Sample Refresh",
    activePhases: ["refreshing_samples", "complete"],
  },
];

function getStageState(stage, trainingPhase) {
  if (trainingPhase === "idle") return "idle";
  if (trainingPhase === "complete") return "complete";
  if (stage.activePhases.includes(trainingPhase)) return "active";

  const order = ["reward_training", "policy_training", "refreshing_samples"];
  const currentIdx = order.indexOf(trainingPhase);
  const stageIdx = order.indexOf(stage.id);

  return currentIdx > stageIdx ? "complete" : "idle";
}

function statusColor(state) {
  if (state === "active") return "#a78bfa";
  if (state === "complete") return "#4ade80";
  return "#475569";
}

export default function TrainingPipeline({ trainingPhase }) {
  return (
    <div>
      <span
        style={{
          fontSize: 12,
          color: "#94a3b8",
          fontWeight: 600,
          display: "block",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Training Pipeline
      </span>

      <div style={{ display: "grid", gap: 8 }}>
        {stages.map((stage, i) => {
          const state = getStageState(stage, trainingPhase);
          const color = statusColor(state);

          return (
            <div
              key={stage.id}
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  display: "grid",
                  placeItems: "center",
                  color: state === "idle" ? "#94a3b8" : "#0c0e14",
                  background: state === "idle" ? "#1e293b" : color,
                  border: `1px solid ${color}`,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {i + 1}
              </div>

              <div>
                <div style={{ color: "#e2e8f0", fontSize: 12 }}>{stage.label}</div>
                <div
                  style={{
                    color,
                    fontSize: 10,
                    fontFamily: "'IBM Plex Mono', monospace",
                    textTransform: "uppercase",
                  }}
                >
                  {state}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 9,
          color: "#94a3b8",
          fontSize: 11,
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        phase: {trainingPhase}
      </div>
    </div>
  );
}
