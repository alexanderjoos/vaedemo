import { TRAIT_LABELS, describeTraitDirection } from "../model/analyzers";

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
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>
        color temperature
      </div>
      {rankings < 3 ? (
        <div style={{ fontSize: 11, color: "#64748b" }}>need a few more rankings</div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
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

          <div
            style={{
              fontSize: 10,
              color: "#94a3b8",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {analysis.level === "confirmed" || analysis.level === "strong"
              ? describeTraitDirection(key, analysis.direction)
              : TRAIT_LABELS[key]}
          </div>
        </div>
      )}
    </div>
  );
}
