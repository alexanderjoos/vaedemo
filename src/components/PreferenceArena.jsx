function DigitImage({
  candidate,
  size = 64,
  onClick,
  selected,
  rejected,
  muted = false,
  showLabel = false,
  label = "",
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <img
        src={candidate.dataUrl}
        alt={`Generated ${candidate.digit}`}
        onClick={onClick}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          border: selected
            ? "2px solid #4ade80"
            : rejected
            ? "2px solid #f87171"
            : "1px solid #2a2d35",
          cursor: onClick ? "pointer" : "default",
          opacity: rejected || muted ? 0.45 : 1,
          transform: selected ? "scale(1.08)" : "scale(1)",
          transition: "all 0.22s ease",
          imageRendering: "pixelated",
          background: "#020617",
          display: "block",
        }}
      />

      {showLabel && (
        <div
          style={{
            marginTop: 5,
            color: "#94a3b8",
            fontSize: 11,
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export default function PreferenceArena({
  candidates,
  selectedIdx,
  rejectedIdxs,
  onChoice,
  onNewCandidates,
}) {
  return (
    <div
      style={{
        background: "#13161e",
        border: "1px solid #4f46e5",
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
            Preference Arena
          </span>

          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              background: "#4f46e5",
              color: "#e0e7ff",
              borderRadius: 10,
              fontWeight: 500,
            }}
          >
            TRAINING ACTION
          </span>
        </div>

        <button
          onClick={onNewCandidates}
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
          new candidates
        </button>
      </div>

      <p style={{ fontSize: 13, color: "#cbd5e1", margin: "0 0 12px 0" }}>
        Which output do you prefer? Click or press 1 / 2 / 3.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 28,
        }}
      >
        {candidates.map((candidate, i) => (
          <DigitImage
            key={candidate.id}
            candidate={candidate}
            size={96}
            onClick={() => onChoice(i)}
            selected={selectedIdx === i}
            rejected={rejectedIdxs.includes(i)}
            showLabel
            label={String(i + 1)}
          />
        ))}
      </div>
    </div>
  );
}
