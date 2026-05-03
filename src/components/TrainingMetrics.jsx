function LossChart({ data }) {
  if (data.length < 2) {
    return <span style={{ color: "#64748b", fontSize: 11 }}>waiting for data...</span>;
  }

  const h = 38;
  const w = 180;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke="#818cf8" strokeWidth="1.6" />
    </svg>
  );
}

export default function TrainingMetrics({
  rankings,
  preferenceAccuracy,
  lossHistory,
  marginHistory,
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
        Training Metrics
      </span>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
        <div style={{ color: "#64748b" }}>Rankings:</div>
        <div style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
          {rankings}
        </div>

        <div style={{ color: "#64748b" }}>Preference Acc:</div>
        <div style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
          {preferenceAccuracy}
        </div>

        <div style={{ color: "#64748b" }}>Reward Model Preference Loss:</div>
        <div style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
          {lossHistory.length ? lossHistory[lossHistory.length - 1].toFixed(3) : "---"}
        </div>

        <div style={{ color: "#64748b" }}>Avg Margin:</div>
        <div style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
          {marginHistory.length ? marginHistory[marginHistory.length - 1].toFixed(3) : "---"}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>Reward model loss curve:</span>
        <LossChart data={lossHistory} />
      </div>
    </div>
  );
}
