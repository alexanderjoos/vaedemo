import { useEffect, useState } from "react";

function DigitImage({
  candidate,
  size = 64,
  onClick,
  onPress,
  selected,
  rejected,
  pressed = false,
  muted = false,
  showLabel = false,
  label = "",
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <img
        src={candidate.dataUrl}
        alt="Preference candidate"
        onPointerDown={onPress}
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
          transform: selected ? "scale(1.08)" : pressed ? "scale(1.04)" : "scale(1)",
          boxShadow: pressed
            ? "0 0 0 4px rgba(79, 70, 229, 0.5), 0 0 24px rgba(79, 70, 229, 0.45)"
            : "none",
          transition: "all 0.12s ease",
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
  queueDepth = 0,
}) {
  const [pressedIdx, setPressedIdx] = useState(null);

  useEffect(() => {
    if (pressedIdx === null) return undefined;

    const timer = setTimeout(() => {
      setPressedIdx(null);
    }, 350);

    return () => clearTimeout(timer);
  }, [pressedIdx]);

  return (
    <div
      style={{
        background: "#13161e",
        border: "1px solid #4f46e5",
        borderRadius: 8,
        padding: 10,
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

          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              background: "#1e293b",
              color: "#94a3b8",
              borderRadius: 10,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            next ready: {queueDepth > 0 ? "yes" : "no"}
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

      <p style={{ fontSize: 12, color: "#cbd5e1", margin: "0 0 8px 0" }}>
        Pick the best output. Click or press `1 / 2 / 3`.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 18,
          minHeight: 88,
          alignItems: "center",
        }}
      >
        {candidates.length > 0 ? (
          candidates.map((candidate, i) => (
            <DigitImage
              key={candidate.id}
              candidate={candidate}
              size={74}
              onPress={() => {
                setPressedIdx(i);
              }}
              onClick={() => {
                setPressedIdx(i);
                onChoice(i);
              }}
              selected={selectedIdx === i}
              rejected={rejectedIdxs.includes(i)}
              pressed={pressedIdx === i}
              showLabel
              label={String(i + 1)}
            />
          ))
        ) : (
          <div
            style={{
              color: "#64748b",
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              textTransform: "uppercase",
            }}
          >
            warming first prompt...
          </div>
        )}
      </div>
    </div>
  );
}
