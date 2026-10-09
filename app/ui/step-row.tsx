import { formatClock } from "@/lib/duration";
import { muscleLabel, type MuscleKey } from "@/lib/muscles";
import type { StepKind } from "@/lib/programs";

/** Ce qui s'affiche sous le nom de l'étape ; rien pour une récup. */
export function stepSubtitle(kind: StepKind, muscles: MuscleKey[]): string | null {
  if (kind === "rest") return null;
  if (kind === "warmup") return "mobilité articulaire";
  return muscles.slice(0, 2).map(muscleLabel).join(" · ") || "exercice";
}

/**
 * Pastille numérotée d'une étape : volt pour l'échauffement, encre pour
 * l'effort, cercle pointillé pour le repos.
 */
export function StepNumber({ kind, n }: { kind: StepKind; n: number }) {
  const styles: Record<StepKind, React.CSSProperties> = {
    warmup: { background: "var(--volt)", border: "1.5px solid var(--ink)", color: "var(--ink)" },
    exercise: { background: "var(--ink)", color: "var(--volt)" },
    rest: { border: "1.5px dashed rgba(26,26,29,.45)", color: "var(--grey)" },
  };
  return (
    <span className="mono" style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 500, ...styles[kind] }}>
      {String(n).padStart(2, "0")}
    </span>
  );
}

/** Ligne d'étape, en lecture : numéro, nom, sous-titre et durée. */
export function StepRow({
  kind,
  n,
  name,
  muscles,
  durationSeconds,
  reps = null,
  children,
  durationAsPill = false,
}: {
  kind: StepKind;
  n: number;
  name: string;
  muscles: MuscleKey[];
  durationSeconds: number;
  /** Étape en répétitions : affichée « ×12 » au lieu de la durée. */
  reps?: number | null;
  /** Contenu ajouté en tête de ligne (poignée de l'éditeur). */
  children?: React.ReactNode;
  durationAsPill?: boolean;
}) {
  const subtitle = stepSubtitle(kind, muscles);
  return (
    <div className="step-row" data-kind={kind}>
      {children}
      <StepNumber kind={kind} n={n} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 900, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        {subtitle ? <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 2 }}>{subtitle}</span> : null}
      </span>
      <span className="mono" style={durationAsPill ? { border: "1.5px solid var(--ink)", borderRadius: 14, padding: "4px 10px", fontSize: 15, fontWeight: 500 } : { fontSize: 15, fontWeight: 500 }}>
        {reps !== null ? `×${reps}` : formatClock(durationSeconds)}
      </span>
    </div>
  );
}
