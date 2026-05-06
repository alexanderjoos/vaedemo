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
}) {
  const [pressedIdx, setPressedIdx] = useState(null);

  useEffect(() => {
    if (pressedIdx === null) return undefined;

    const timer = setTimeout(() => {
      setPressedIdx(null);
    }, 350);

    return () => clearTimeout(timer);
  }, [pressedIdx]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "1" || event.key === "ArrowLeft") setPressedIdx(0);
      if (event.key === "2" || event.key === "ArrowUp") setPressedIdx(1);
      if (event.key === "3" || event.key === "ArrowRight") setPressedIdx(2);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      style={{
        background: "#13161e",
        border: "1px solid #4f46e5",
        borderRadius: 8,
        padding: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <button
          onClick={onNewCandidates}
          style={{
            fontSize: 11,
            padding: "4px 8px",
            background: "#1e293b",
            color: "#94a3b8",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          regenerate
        </button>
      </div>

      <p style={{ fontSize: 12, color: "#cbd5e1", margin: "0 0 6px 0" }}>
        Pick the best output. Click or press `1 / 2 / 3`.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 14,
          minHeight: 78,
          alignItems: "center",
        }}
      >
        {candidates.length > 0 ? (
          candidates.map((candidate, i) => (
            <DigitImage
              key={candidate.id}
              candidate={candidate}
              size={70}
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
