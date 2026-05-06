import {
  ANALYZER_TRAITS,
  TRAIT_LABELS,
  describeTraitDirection,
} from "../model/analyzers";

function confColor(level) {
  if (level === "confirmed") return "#4ade80";
  if (level === "strong") return "#a3e635";
  if (level === "emerging") return "#facc15";
  return "#64748b";
}

function confLabel(level) {
  if (level === "confirmed") return "confirmed";
  if (level === "strong") return "strong signal";
  if (level === "emerging") return "emerging";
  return "unclear";
}

export default function TraitAnalyzer({ rankings, traitAnalysis }) {
  const key = "colorTemperature";
  const analysis = traitAnalysis[key] || {
    confidence: 0,
    level: "unclear",
    direction: "higher",
  };

  return (
    <div
      style={{
        background: "#13161e",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: "#94a3b8",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Live Trait Analyzer
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
          diagnostic only
        </span>
      </div>

      {rankings < 3 ? (
        <p style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
          Provide a few rankings to start seeing a color preference signal.
        </p>
      ) : (
        <div>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 8px 0" }}>
            Detected preference signal:
          </p>

          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 2,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "#cbd5e1",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {TRAIT_LABELS[key]}
              </span>

              <span style={{ fontSize: 10, color: confColor(analysis.level) }}>
                {analysis.level === "confirmed" || analysis.level === "strong"
                  ? "✓"
                  : analysis.level === "emerging"
                  ? "..."
                  : "?"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: "#1e293b",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${analysis.confidence * 100}%`,
                    height: "100%",
                    background: confColor(analysis.level),
                    borderRadius: 3,
                    transition: "width 0.4s ease, background 0.4s ease",
                  }}
                />
              </div>

              <span
                style={{
                  fontSize: 9,
                  color: "#64748b",
                  width: 70,
                  textAlign: "right",
                }}
              >
                {confLabel(analysis.level)}
              </span>
            </div>

            {(analysis.level === "confirmed" || analysis.level === "strong") && (
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
                {describeTraitDirection(key, analysis.direction)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
