const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * La semaine en petits soleils : un disque volt par jour d'entraînement,
 * d'autant plus grand que la séance a été longue ; un simple cercle sinon.
 */
export function WeekSuns({ seconds, today, gap = 26 }: { seconds: number[]; today: number; gap?: number }) {
  const max = Math.max(...seconds, 1);
  return (
    <div style={{ display: "flex", gap: gap - 18 }} aria-label="Entraînement de la semaine, jour par jour">
      {seconds.map((s, i) => {
        const size = s > 0 ? 12 + 14 * Math.sqrt(s / max) : 8;
        return (
          <div key={i} style={{ width: 18, display: "grid", justifyItems: "center", gap: 6 }}>
            <div style={{ height: 28, display: "grid", placeItems: "center" }}>
              <span
                style={{
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  background: s > 0 ? "var(--volt)" : "transparent",
                  border: s > 0 ? "1.5px solid var(--ink)" : "1.5px solid rgba(26,26,29,.35)",
                }}
              />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: i === today ? "var(--ink)" : "var(--grey)" }}>{DAYS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}
