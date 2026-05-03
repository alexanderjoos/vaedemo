export default function TaskExplanation() {
  return (
    <div>
      <div
        style={{
          fontWeight: 600,
          fontSize: 13,
          color: "#94a3b8",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        What you are doing
      </div>

      <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.65 }}>
        <p style={{ marginTop: 0 }}>
          You are training a <span style={{ color: "#a5b4fc" }}>reward model</span> through
          preference feedback.
        </p>

        <p>
          The base generator creates colored MNIST-style digits. It was not trained on traits
          like thickness, centeredness, slant, cleanliness, or color temperature.
        </p>

        <p>
          Your only job is to choose which generated image you prefer. Each choice creates
          preference pairs like:
        </p>

        <div
          style={{
            background: "#0f131b",
            border: "1px solid #263244",
            borderRadius: 7,
            padding: "8px 10px",
            color: "#e2e8f0",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            marginBottom: 10,
          }}
        >
          chosen image &gt; rejected image
        </div>

        <p>
          The tuned generator then uses the reward model to select outputs that better match
          your preferences.
        </p>

        <div
          style={{
            background: "#1a1d28",
            borderRadius: 6,
            padding: "8px 10px",
            marginTop: 10,
            borderLeft: "2px solid #f59e0b",
            fontSize: 11,
            color: "#cbd5e1",
          }}
        >
          The trait analyzer is separate. It only explains what changed after training.
          It is not used to train the reward model.
        </div>
      </div>
    </div>
  );
}
