import {
  getLatentPolicyMean,
  sampleBaseLatentDistribution,
  sampleTunedLatentDistribution,
} from "../model/latentPolicy";

const phaseText = {
  idle: "Waiting for a preference.",
  preference_selected: "Preference captured. Holding the chosen and rejected points.",
  reward_training: "Reward model update is fitting the chosen image above rejected images.",
  policy_training: "Latent policy is shifting toward the preferred region.",
  refreshing_samples: "Refreshing candidates and tuned samples from the updated policy.",
  complete: "Update complete. New samples reflect the latest feedback.",
};

function project([x, y], size) {
  const scale = 34;
  const cx = size / 2;
  const cy = size / 2;

  return [cx + x * scale, cy - y * scale];
}

function Point({ point, size, fill, opacity = 1, r = 2.2, label }) {
  const [x, y] = project(point, size);

  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} opacity={opacity} />
      {label && (
        <text
          x={x + 6}
          y={y - 5}
          fill={fill}
          fontSize="10"
          fontFamily="'IBM Plex Mono', monospace"
          fontWeight="600"
        >
          {label}
        </text>
      )}
    </g>
  );
}

export default function LatentSpacePane({
  sampleDigit,
  latentPolicy,
  candidates,
  selectedIdx,
  rejectedIdxs,
  trainingPhase,
}) {
  const size = 220;
  const basePoints = sampleBaseLatentDistribution(80);
  const tunedPoints = sampleTunedLatentDistribution(latentPolicy, sampleDigit, 65);
  const tunedMean = getLatentPolicyMean(latentPolicy, sampleDigit);
  const [baseX, baseY] = project([0, 0], size);
  const [tunedX, tunedY] = project(tunedMean, size);

  return (
    <div
      style={{
        background: "#13161e",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: "#94a3b8",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Latent Space
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
          simulated 2D
        </span>
      </div>

      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height={size}
        role="img"
        aria-label="Simulated latent space plot"
        style={{
          display: "block",
          background: "#0f131b",
          border: "1px solid #263244",
          borderRadius: 7,
        }}
      >
        <defs>
          <marker
            id="latent-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#c4b5fd" />
          </marker>
        </defs>

        <line x1="0" y1={size / 2} x2={size} y2={size / 2} stroke="#1f2937" />
        <line x1={size / 2} y1="0" x2={size / 2} y2={size} stroke="#1f2937" />
        <circle cx={size / 2} cy={size / 2} r="28" fill="none" stroke="#273142" />
        <circle cx={size / 2} cy={size / 2} r="58" fill="none" stroke="#1f2937" />

        {basePoints.map((point, i) => (
          <Point key={`base-${i}`} point={point} size={size} fill="#94a3b8" opacity={0.24} />
        ))}

        {tunedPoints.map((point, i) => (
          <Point key={`tuned-${i}`} point={point} size={size} fill="#8b5cf6" opacity={0.36} />
        ))}

        <line
          x1={baseX}
          y1={baseY}
          x2={tunedX}
          y2={tunedY}
          stroke="#c4b5fd"
          strokeWidth="2"
          markerEnd="url(#latent-arrow)"
        />

        <circle cx={baseX} cy={baseY} r="4" fill="#cbd5e1" />
        <circle cx={tunedX} cy={tunedY} r="5" fill="#a78bfa" />

        {candidates.map((candidate, i) => {
          const selected = selectedIdx === i;
          const rejected = rejectedIdxs.includes(i);
          const fill = selected ? "#4ade80" : rejected ? "#f87171" : "#f8fafc";

          return (
            <Point
              key={candidate.id}
              point={candidate.z}
              size={size}
              fill={fill}
              r={selected || rejected ? 5.2 : 4.4}
              label={String(i + 1)}
            />
          );
        })}
      </svg>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginTop: 10,
          fontSize: 11,
          color: "#94a3b8",
        }}
      >
        <div>
          <span style={{ color: "#94a3b8" }}>base mean</span>{" "}
          <span style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
            [0.00, 0.00]
          </span>
        </div>
        <div>
          <span style={{ color: "#a78bfa" }}>digit {sampleDigit}</span>{" "}
          <span style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
            [{tunedMean[0].toFixed(2)}, {tunedMean[1].toFixed(2)}]
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: "8px 10px",
          borderRadius: 6,
          background: "#10141d",
          borderLeft: "2px solid #8b5cf6",
          color: "#cbd5e1",
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        {phaseText[trainingPhase]}
      </div>
    </div>
  );
}
