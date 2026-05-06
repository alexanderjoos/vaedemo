export default function ControlsSummary({
  rewardModel,
  onLearningRateChange,
  onReset,
  rankings,
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          alignItems: "baseline",
          columnGap: 8,
          padding: "7px 10px",
          borderRadius: 6,
          background: "#10141d",
          border: "1px solid #263244",
        }}
      >
        <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>rankings</div>
        <div
          style={{
            color: "#f8fafc",
            fontSize: 20,
            lineHeight: 1,
            fontWeight: 600,
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {rankings}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#64748b", width: 64 }}>learn rate</span>

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
          padding: "6px 10px",
          fontSize: 11,
          fontWeight: 500,
          background: "#1e293b",
          color: "#f87171",
          border: "1px solid #991b1b",
          borderRadius: 5,
          cursor: "pointer",
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        reset
      </button>
    </div>
  );
}
