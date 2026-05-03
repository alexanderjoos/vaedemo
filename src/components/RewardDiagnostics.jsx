import { clamp } from "../model/generator";

function RewardHistogram({ values }) {
  const width = 180;
  const height = 38;

  if (!values.length) {
    return <span style={{ color: "#64748b", fontSize: 11 }}>waiting for samples...</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const bins = Array(12).fill(0);

  values.forEach((v) => {
    const idx = clamp(Math.floor(((v - min) / range) * bins.length), 0, bins.length - 1);
    bins[idx] += 1;
  });

  const maxBin = Math.max(...bins) || 1;

  return (
    <svg width={width} height={height}>
      {bins.map((b, i) => {
        const barW = width / bins.length - 2;
        const barH = (b / maxBin) * (height - 4);

        return (
          <rect
            key={i}
            x={i * (width / bins.length)}
            y={height - barH}
            width={barW}
            height={barH}
            fill="#0d9488"
            opacity={0.85}
            rx={2}
          />
        );
      })}
    </svg>
  );
}

export default function RewardDiagnostics({
  avgBaseReward,
  avgTunedReward,
  rewardDistribution,
}) {
  return (
    <div>
      <span
        style={{
          fontSize: 12,
          color: "#94a3b8",
          fontWeight: 600,
          display: "block",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Reward Diagnostics
      </span>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
        <div style={{ color: "#64748b" }}>Avg Base Reward:</div>
        <div style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
          {avgBaseReward.toFixed(3)}
        </div>

        <div style={{ color: "#64748b" }}>Avg Tuned Reward:</div>
        <div style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
          {avgTunedReward.toFixed(3)}
        </div>

        <div style={{ color: "#64748b" }}>Reward Lift:</div>
        <div style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
          {(avgTunedReward - avgBaseReward).toFixed(3)}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>Reward distribution:</span>
        <RewardHistogram values={rewardDistribution} />
      </div>
    </div>
  );
}
