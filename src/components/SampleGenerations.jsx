function DigitImage({ candidate, size = 64 }) {
  return (
    <div style={{ textAlign: "center" }}>
      <img
        src={candidate.dataUrl}
        alt={`Generated ${candidate.digit}`}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          border: "1px solid #2a2d35",
          cursor: "default",
          opacity: 1,
          transform: "scale(1)",
          transition: "all 0.22s ease",
          imageRendering: "pixelated",
          background: "#020617",
          display: "block",
        }}
      />
    </div>
  );
}

export default function SampleGenerations({
  latentPane,
  sampleDigit,
  baseSamples,
  tunedSamples,
  onRefreshSamples,
  onSampleDigitChange,
}) {
  const generations = (
    <div
      style={{
        background: "#13161e",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: "#94a3b8",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Sample Generations
          </span>

          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              background: "#1e293b",
              color: "#64748b",
              borderRadius: 10,
            }}
          >
            generation only
          </span>
        </div>

        <button
          onClick={onRefreshSamples}
          style={{
            fontSize: 11,
            padding: "4px 9px",
            background: "#1e293b",
            color: "#94a3b8",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          refresh samples
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "#64748b", marginRight: 4 }}>Inspect digit:</span>

        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            onClick={() => onSampleDigitChange(d)}
            style={{
              width: 26,
              height: 24,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              background: sampleDigit === d ? "#4f46e5" : "#1e293b",
              color: sampleDigit === d ? "#fff" : "#64748b",
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        <div
          style={{
            border: "1px solid #334155",
            borderRadius: 9,
            padding: 12,
            background: "#10141d",
          }}
        >
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>
            Base Generator
          </div>

          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
            Random outputs before preference tuning for digit {sampleDigit}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {baseSamples.map((candidate) => (
              <DigitImage key={candidate.id} candidate={candidate} size={58} />
            ))}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #4f46e5",
            borderRadius: 9,
            padding: 12,
            background: "rgba(79,70,229,0.08)",
          }}
        >
          <div style={{ fontSize: 12, color: "#c7d2fe", marginBottom: 3 }}>
            RLHF-Tuned Generator
          </div>

          <div style={{ fontSize: 11, color: "#818cf8", marginBottom: 10 }}>
            Outputs selected by the learned reward model for digit {sampleDigit}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {tunedSamples.map((candidate) => (
              <DigitImage key={candidate.id} candidate={candidate} size={58} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (!latentPane) return generations;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "290px 1fr",
        gap: 12,
        marginBottom: 12,
      }}
    >
      {latentPane}
      {generations}
    </div>
  );
}
