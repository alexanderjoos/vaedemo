export default function ControlsSummary({
  rewardModel,
  onLearningRateChange,
  onReset,
  learnedTraits,
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
        Controls + Summary
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#64748b", width: 86 }}>Learn Rate:</span>

        <input
          type="range"
          min={0.01}
          max={0.18}
          step={0.01}
          value={rewardModel.lr}
          onChange={(e) => onLearningRateChange(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: "#4f46e5" }}
        />

        <span
          style={{
            fontSize: 10,
            color: "#94a3b8",
            fontFamily: "'IBM Plex Mono', monospace",
            width: 34,
          }}
        >
          {rewardModel.lr.toFixed(2)}
        </span>
      </div>

      <button
        onClick={onReset}
        style={{
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 500,
          background: "#1e293b",
          color: "#f87171",
          border: "1px solid #991b1b",
          borderRadius: 5,
          cursor: "pointer",
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        Reset
      </button>

      {learnedTraits.length > 0 && (
        <div
          style={{
            marginTop: 9,
            background: "#1a1d28",
            borderRadius: 5,
            padding: 8,
            borderLeft: "2px solid #818cf8",
            fontSize: 11,
            color: "#cbd5e1",
            lineHeight: 1.6,
          }}
        >
          Your feedback appears to be pushing the tuned generator toward{" "}
          {learnedTraits.join(", ")}.
        </div>
      )}

      {learnedTraits.length === 0 && (
        <div
          style={{
            marginTop: 9,
            background: "#1a1d28",
            borderRadius: 5,
            padding: 8,
            borderLeft: "2px solid #64748b",
            fontSize: 11,
            color: "#94a3b8",
            lineHeight: 1.6,
          }}
        >
          No strong trait signal yet. Keep ranking mixed-digit outputs.
        </div>
      )}
    </div>
  );
}
