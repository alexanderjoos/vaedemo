import { useEffect, useMemo, useState } from "react";

import { decodeAllDigitsAtLatent } from "../model/decoder";
import { getLatentMapExtent } from "../model/latentMap";
import { getLatentPolicyMean, transformLatentPoint } from "../model/latentPolicy";

const phaseText = {
  idle: "Waiting for a preference.",
  preference_selected: "Preference captured. Holding the chosen and rejected points.",
  reward_training: "Reward model update is fitting the chosen image above rejected images.",
  policy_training: "Latent policy is shifting toward the preferred region.",
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

function maxAbs(points) {
  return points.reduce(
    (acc, point) => Math.max(acc, Math.abs(point[0]), Math.abs(point[1])),
    0
  );
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

function PointCloud({ points, digit, size, extent, highlight = false }) {
  const fill = DIGIT_COLORS[digit];

  return points.map((point, i) => {
    const [x, y] = project(point, size, extent);
    return (
      <circle
        key={`${digit}-${i}`}
        cx={x}
        cy={y}
        r={highlight ? 2.4 : 2}
        fill={fill}
        opacity={highlight ? 0.48 : 0.22}
      />
    );
  });
}

function DigitMarker({ digit, point, size, extent, selected = false }) {
  const [x, y] = project(point, size, extent);
  const fill = DIGIT_COLORS[digit];

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={selected ? 8.5 : 6.5}
        fill={selected ? fill : "#111827"}
        stroke={fill}
        strokeWidth="1.4"
      />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fill={selected ? "#020617" : fill}
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

function PlotFrame({
  title,
  subtitle,
  size,
  extent,
  children,
  onSelectPoint,
  onDragStart,
  onDragMove,
  onDragEnd,
}) {
  const pickPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return unproject(event.clientX, event.clientY, rect, size, extent);
  };

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{title}</div>
        <div
          style={{
            color: "#64748b",
            fontSize: 10,
            fontFamily: "'IBM Plex Mono', monospace",
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height={size}
        role="img"
        aria-label={title}
        onClick={(event) => onSelectPoint(pickPoint(event))}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          onDragStart(pickPoint(event));
        }}
        onPointerMove={(event) => {
          if ((event.buttons & 1) !== 1) return;
          onDragMove(pickPoint(event));
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          onDragEnd(pickPoint(event));
        }}
        style={{
          display: "block",
          border: "1px solid #263244",
          borderRadius: 8,
          cursor: "crosshair",
          touchAction: "none",
        }}
      >
        <Background size={size} />
        {children}
      </svg>
    </div>
  );
}

export default function LatentSpacePane({
  latentMap,
  sampleDigit,
  latentPolicy,
  candidates,
  selectedIdx,
  rejectedIdxs,
  trainingPhase,
}) {
  const plotSize = 258;
  const [previewPoint, setPreviewPoint] = useState(() =>
    getLatentPolicyMean(latentPolicy, sampleDigit)
  );
  const [previewCandidates, setPreviewCandidates] = useState([]);
  const [previewStatus, setPreviewStatus] = useState("loading");
  const [dragging, setDragging] = useState(false);

  const baseDigits = latentMap?.digits || [];

  useEffect(() => {
    setPreviewPoint(getLatentPolicyMean(latentPolicy, sampleDigit));
  }, [sampleDigit, latentPolicy]);

  useEffect(() => {
    let cancelled = false;
    setPreviewStatus("loading");

    decodeAllDigitsAtLatent({
      z: previewPoint,
      source: "latent_inspector",
    })
      .then((candidatesAtPoint) => {
        if (cancelled) return;
        setPreviewCandidates(candidatesAtPoint);
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

  const transformedDigits = useMemo(
    () =>
      baseDigits.map((entry) => ({
        ...entry,
        transformedMean: latentPolicy[entry.digit]?.mean || entry.mean,
        transformedPoints: entry.points.map((point) =>
          transformLatentPoint(point, latentPolicy[entry.digit] || {
            mean: entry.mean,
            std: entry.std,
            baseMean: entry.mean,
            baseStd: entry.std,
          })
        ),
      })),
    [baseDigits, latentPolicy]
  );

  const extent = useMemo(() => {
    const baseExtent = getLatentMapExtent(latentMap);
    const tunedExtent = maxAbs(
      transformedDigits.flatMap((entry) => [entry.transformedMean, ...entry.transformedPoints])
    );
    return Math.max(baseExtent, tunedExtent + 0.35, 2.8);
  }, [latentMap, transformedDigits]);

  const tunedEntry = latentPolicy[sampleDigit] || {
    mean: [0, 0],
    std: 0.44,
    baseMean: [0, 0],
    baseStd: 0.44,
  };
  const baseDensity = scoreDensity(previewPoint, tunedEntry.baseMean || [0, 0], tunedEntry.baseStd || 0.44);
  const tunedDensity = scoreDensity(previewPoint, tunedEntry.mean, tunedEntry.std);

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
            color: "#cbd5e1",
            borderRadius: 10,
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          base map vs rlhf clone
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <PlotFrame
          title="Base VAE Map"
          subtitle="encoder-space digit regions"
          size={plotSize}
          extent={extent}
          onSelectPoint={setPreviewPoint}
          onDragStart={(point) => {
            setDragging(true);
            setPreviewPoint(point);
          }}
          onDragMove={setPreviewPoint}
          onDragEnd={(point) => {
            setDragging(false);
            setPreviewPoint(point);
          }}
        >
          {baseDigits.map((entry) => (
            <PointCloud
              key={`base-${entry.digit}`}
              points={entry.points}
              digit={entry.digit}
              size={plotSize}
              extent={extent}
              highlight={entry.digit === sampleDigit}
            />
          ))}

          {candidates.map((candidate, i) => {
            const selected = selectedIdx === i;
            const rejected = rejectedIdxs.includes(i);
            const fill = selected ? "#4ade80" : rejected ? "#f87171" : "#f8fafc";
            const [x, y] = project(candidate.z, plotSize, extent);

            return (
              <g key={candidate.id}>
                <circle cx={x} cy={y} r={selected || rejected ? 5.2 : 4.2} fill={fill} stroke="#020617" strokeWidth="1" />
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

          {baseDigits.map((entry) => (
            <DigitMarker
              key={`base-marker-${entry.digit}`}
              digit={entry.digit}
              point={entry.mean}
              size={plotSize}
              extent={extent}
              selected={entry.digit === sampleDigit}
            />
          ))}

          <PreviewCursor point={previewPoint} size={plotSize} extent={extent} />
        </PlotFrame>

        <PlotFrame
          title="RLHF Clone"
          subtitle="same map, shifted by the learned policy"
          size={plotSize}
          extent={extent}
          onSelectPoint={setPreviewPoint}
          onDragStart={(point) => {
            setDragging(true);
            setPreviewPoint(point);
          }}
          onDragMove={setPreviewPoint}
          onDragEnd={(point) => {
            setDragging(false);
            setPreviewPoint(point);
          }}
        >
          {transformedDigits.map((entry) => (
            <PointCloud
              key={`tuned-${entry.digit}`}
              points={entry.transformedPoints}
              digit={entry.digit}
              size={plotSize}
              extent={extent}
              highlight={entry.digit === sampleDigit}
            />
          ))}

          {transformedDigits.map((entry) => (
            <DigitMarker
              key={`tuned-marker-${entry.digit}`}
              digit={entry.digit}
              point={entry.transformedMean}
              size={plotSize}
              extent={extent}
              selected={entry.digit === sampleDigit}
            />
          ))}

          <PreviewCursor point={previewPoint} size={plotSize} extent={extent} />
        </PlotFrame>
      </div>

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
              color: digit === sampleDigit ? "#e2e8f0" : "#94a3b8",
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

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gap: 10,
          background: "#0f131b",
          border: "1px solid #263244",
          borderRadius: 8,
          padding: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>
            z = [{previewPoint[0].toFixed(2)}, {previewPoint[1].toFixed(2)}]
          </div>
          <div
            style={{
              color: dragging ? "#f8fafc" : "#94a3b8",
              fontSize: 10,
              fontFamily: "'IBM Plex Mono', monospace",
              textTransform: "uppercase",
            }}
          >
            {dragging ? "dragging latent cursor" : "digit sweep at current z"}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 12,
            alignItems: "start",
          }}
        >
          {previewStatus === "ready" ? (
            previewCandidates.map((candidate) => (
              <div
                key={`preview-${candidate.digit}`}
                style={{
                  display: "grid",
                  gap: 6,
                  justifyItems: "center",
                }}
              >
                <div
                  style={{
                    width: 74,
                    height: 74,
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#020617",
                    border:
                      candidate.digit === sampleDigit
                        ? `1px solid ${DIGIT_COLORS[candidate.digit]}`
                        : "1px solid #1e293b",
                  }}
                >
                  <img
                    src={candidate.dataUrl}
                    alt={`Digit ${candidate.digit} at selected latent point`}
                    style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
                  />
                </div>
                <div
                  style={{
                    color:
                      candidate.digit === sampleDigit
                        ? "#e2e8f0"
                        : DIGIT_COLORS[candidate.digit],
                    fontSize: 11,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                  }}
                >
                  {candidate.digit}
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                gridColumn: "1 / -1",
                minHeight: 92,
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                fontSize: 10,
                fontFamily: "'IBM Plex Mono', monospace",
                textTransform: "uppercase",
              }}
            >
              {previewStatus}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5 }}>
            Left is the exported encoder map. Right is a clone transformed by the learned latent
            policy, so preference feedback visibly moves the digit regions instead of leaving the
            same cloud in place.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              fontSize: 11,
            }}
          >
            <div>
              <span style={{ color: "#94a3b8" }}>digit {sampleDigit} base weight</span>{" "}
              <span style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
                {baseDensity.toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ color: "#a78bfa" }}>digit {sampleDigit} rlhf weight</span>{" "}
              <span style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
                {tunedDensity.toFixed(2)}
              </span>
            </div>
          </div>
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
