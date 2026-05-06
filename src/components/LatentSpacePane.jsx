import { useEffect, useMemo, useState } from "react";

import { decodeCandidate } from "../model/decoder";
import { getLatentMapExtent } from "../model/latentMap";
import { getLatentPolicyMean } from "../model/latentPolicy";

const phaseText = {
  idle: "Waiting for a preference.",
  preference_selected: "Preference captured. Holding the chosen and rejected points.",
  reward_training: "Reward model update is fitting the chosen image above rejected images.",
  policy_training: "Latent sampling policy is shifting toward higher reward regions.",
  refreshing_samples: "Refreshing candidates and tuned samples from the updated policy.",
  complete: "Update complete. New samples reflect the latest feedback.",
};

const DIGIT_COLORS = [
  "#60a5fa",
  "#f59e0b",
  "#22c55e",
  "#ef4444",
  "#a78bfa",
  "#f97316",
  "#f472b6",
  "#a3a3a3",
  "#d9d322",
  "#22d3ee",
];

function project([x, y], size, extent) {
  const scale = size / (extent * 2);
  const cx = size / 2;
  const cy = size / 2;

  return [cx + x * scale, cy - y * scale];
}

function unproject(clientX, clientY, rect, size, extent) {
  const x = ((clientX - rect.left) / rect.width) * size;
  const y = ((clientY - rect.top) / rect.height) * size;
  const scale = size / (extent * 2);

  return [
    Math.max(-extent, Math.min(extent, (x - size / 2) / scale)),
    Math.max(-extent, Math.min(extent, (size / 2 - y) / scale)),
  ];
}

function scoreDensity([x, y], mean, std) {
  const dx = x - mean[0];
  const dy = y - mean[1];
  const dist2 = dx * dx + dy * dy;
  return Math.exp(-dist2 / (2 * std * std));
}

function Background({ size }) {
  const center = size / 2;
  const rings = [0.25, 0.5, 0.75];

  return (
    <>
      <rect x="0" y="0" width={size} height={size} rx="8" fill="#0f131b" />
      <line x1="0" y1={center} x2={size} y2={center} stroke="#1f2937" />
      <line x1={center} y1="0" x2={center} y2={size} stroke="#1f2937" />
      {rings.map((ratio) => (
        <circle
          key={ratio}
          cx={center}
          cy={center}
          r={(size / 2) * ratio}
          fill="none"
          stroke="#223043"
          strokeDasharray="4 6"
        />
      ))}
    </>
  );
}

function PriorCircles({ mean, std, size, extent, stroke, dasharray }) {
  const scale = size / (extent * 2);
  const [cx, cy] = project(mean, size, extent);
  const radii = [std * scale, 2 * std * scale];

  return radii.map((r, i) => (
    <circle
      key={`${stroke}-${i}`}
      cx={cx}
      cy={cy}
      r={Math.max(2, r)}
      fill="none"
      stroke={stroke}
      strokeWidth={i === 0 ? 1.35 : 1}
      strokeDasharray={dasharray}
      opacity={i === 0 ? 0.95 : 0.65}
    />
  ));
}

function PointCloud({ points, digit, size, extent }) {
  const fill = DIGIT_COLORS[digit];

  return points.map((point, i) => {
    const [x, y] = project(point, size, extent);
    return (
      <circle
        key={`${digit}-${i}`}
        cx={x}
        cy={y}
        r={2}
        fill={fill}
        opacity={0.2}
      />
    );
  });
}

function DigitMarker({ digit, point, size, extent }) {
  const [x, y] = project(point, size, extent);
  const fill = DIGIT_COLORS[digit];

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={6.5}
        fill="#111827"
        stroke={fill}
        strokeWidth="1.4"
      />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fill={fill}
        fontSize="9"
        fontFamily="'IBM Plex Mono', monospace"
        fontWeight="700"
      >
        {digit}
      </text>
    </g>
  );
}

function PreviewCursor({ point, size, extent }) {
  const [x, y] = project(point, size, extent);

  return (
    <g opacity="0.9">
      <circle cx={x} cy={y} r="7" fill="none" stroke="#f8fafc" strokeWidth="1.5" />
      <line x1={x - 10} y1={y} x2={x + 10} y2={y} stroke="#f8fafc" strokeWidth="1" />
      <line x1={x} y1={y - 10} x2={x} y2={y + 10} stroke="#f8fafc" strokeWidth="1" />
    </g>
  );
}

function pickPoint(event, size, extent) {
  const rect = event.currentTarget.getBoundingClientRect();
  return unproject(event.clientX, event.clientY, rect, size, extent);
}

export default function LatentSpacePane({
  latentMap,
  latentPolicy,
  candidates,
  selectedIdx,
  rejectedIdxs,
  trainingPhase,
}) {
  const plotSize = 320;
  const [previewPoint, setPreviewPoint] = useState(() => getLatentPolicyMean(latentPolicy));
  const [previewCandidate, setPreviewCandidate] = useState(null);
  const [previewStatus, setPreviewStatus] = useState("loading");
  const [dragging, setDragging] = useState(false);

  const baseDigits = latentMap?.digits || [];

  const extent = useMemo(() => Math.max(getLatentMapExtent(latentMap), 2.8), [latentMap]);

  const policyEntry = latentPolicy || {
    mean: [0, 0],
    std: 0.44,
    baseMean: [0, 0],
    baseStd: 0.44,
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync preview z with updated μ after RLHF
    setPreviewPoint(getLatentPolicyMean(latentPolicy));
  }, [latentPolicy]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pending decode for new z
    setPreviewStatus("loading");

    decodeCandidate({
      z: previewPoint,
      source: "latent_inspector",
    })
      .then((candidate) => {
        if (cancelled) return;
        setPreviewCandidate(candidate);
        setPreviewStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [previewPoint]);

  const baseDensity = scoreDensity(
    previewPoint,
    policyEntry.baseMean || [0, 0],
    policyEntry.baseStd || 0.44
  );
  const tunedDensity = scoreDensity(previewPoint, policyEntry.mean, policyEntry.std);

  const handlePick = (point) => {
    setPreviewPoint(point);
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
          Latent space
        </span>

        <span
          style={{
            fontSize: 10,
            padding: "2px 8px",
            background: "#1e293b",
            color: "#cbd5e1",
            borderRadius: 10,
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          click or drag · unconditional decode(z)
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr minmax(200px, 280px)",
          gap: 14,
          alignItems: "start",
        }}
      >
        <div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>
              Encoder scatter + sampling priors
            </div>
            <div
              style={{
                color: "#64748b",
                fontSize: 10,
                fontFamily: "'IBM Plex Mono', monospace",
                textTransform: "uppercase",
              }}
            >
              cyan dashed = base N(μ₀, σ₀²) · purple solid = RLHF-adjusted N(μ, σ²)
            </div>
          </div>

          <svg
            viewBox={`0 0 ${plotSize} ${plotSize}`}
            width="100%"
            height={plotSize}
            role="img"
            aria-label="MNIST latent space"
            onClick={(event) => handlePick(pickPoint(event, plotSize, extent))}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
              handlePick(pickPoint(event, plotSize, extent));
            }}
            onPointerMove={(event) => {
              if ((event.buttons & 1) !== 1) return;
              handlePick(pickPoint(event, plotSize, extent));
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              setDragging(false);
              handlePick(pickPoint(event, plotSize, extent));
            }}
            style={{
              display: "block",
              border: "1px solid #263244",
              borderRadius: 8,
              cursor: "crosshair",
              touchAction: "none",
            }}
          >
            <Background size={plotSize} />

            <PriorCircles
              mean={policyEntry.baseMean || [0, 0]}
              std={policyEntry.baseStd || 0.44}
              size={plotSize}
              extent={extent}
              stroke="#38bdf8"
              dasharray="6 5"
            />

            <PriorCircles
              mean={policyEntry.mean}
              std={policyEntry.std}
              size={plotSize}
              extent={extent}
              stroke="#a78bfa"
            />

            {baseDigits.map((entry) => (
              <PointCloud
                key={`scatter-${entry.digit}`}
                points={entry.points}
                digit={entry.digit}
                size={plotSize}
                extent={extent}
              />
            ))}

            {baseDigits.map((entry) => (
              <DigitMarker
                key={`marker-${entry.digit}`}
                digit={entry.digit}
                point={entry.mean}
                size={plotSize}
                extent={extent}
              />
            ))}

            {candidates.map((candidate, i) => {
              const selected = selectedIdx === i;
              const rejected = rejectedIdxs.includes(i);
              const fill = selected ? "#4ade80" : rejected ? "#f87171" : "#f8fafc";
              const [x, y] = project(candidate.z, plotSize, extent);

              return (
                <g key={candidate.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={selected || rejected ? 5.2 : 4.2}
                    fill={fill}
                    stroke="#020617"
                    strokeWidth="1"
                  />
                  <text
                    x={x + 6}
                    y={y - 5}
                    fill={fill}
                    fontSize="10"
                    fontFamily="'IBM Plex Mono', monospace"
                    fontWeight="600"
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}

            <PreviewCursor point={previewPoint} size={plotSize} extent={extent} />
          </svg>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 8,
              fontSize: 11,
              marginTop: 10,
            }}
          >
            {DIGIT_COLORS.map((color, digit) => (
              <div
                key={`legend-${digit}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#94a3b8",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: color,
                    display: "inline-block",
                  }}
                />
                {digit}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            background: "#0f131b",
            border: "1px solid #263244",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>Generated image</div>

          <div style={{ color: "#64748b", fontSize: 11, lineHeight: 1.45 }}>
            Decode at the cursor position z in latent space (Cornell-style unconditional VAE).
          </div>

          <div
            style={{
              width: "100%",
              maxWidth: 240,
              aspectRatio: "1",
              borderRadius: 10,
              overflow: "hidden",
              background: "#020617",
              border: "1px solid #334155",
              margin: "0 auto",
            }}
          >
            {previewStatus === "ready" && previewCandidate ? (
              <img
                src={previewCandidate.dataUrl}
                alt="Decoded digit at selected latent point"
                style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  color: "#64748b",
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {previewStatus}
              </div>
            )}
          </div>

          <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
            z = [{previewPoint[0].toFixed(2)}, {previewPoint[1].toFixed(2)}]
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4, fontSize: 11 }}>
              <div>
                <span style={{ color: "#38bdf8" }}>base prior density at z</span>{" "}
                <span style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {baseDensity.toFixed(3)}
                </span>
              </div>
              <div>
                <span style={{ color: "#a78bfa" }}>RLHF prior density at z</span>{" "}
                <span style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {tunedDensity.toFixed(3)}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 10,
              color: dragging ? "#f8fafc" : "#64748b",
              fontFamily: "'IBM Plex Mono', monospace",
              textTransform: "uppercase",
            }}
          >
            {dragging ? "dragging · decoding live" : "pointer sampling"}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
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
