import Link from "next/link";

import { formatLength } from "@/lib/duration";
import type { Program } from "@/lib/programs";

import { Icon } from "./icons";

/**
 * Un programme présenté en dossard : bandeau avec son numéro, nom, durée,
 * frise des étapes (effort plein, temps libre en gris) et bouton pour lancer.
 */
export function ProgramBib({
  program,
  number,
  band,
  hero = false,
}: {
  program: Program;
  number: number;
  band: string;
  hero?: boolean;
}) {
  const total = program.steps.reduce((sum, step) => sum + step.durationSeconds, 0);
  return (
    <article className={hero ? "bib tilted" : "bib"}>
      <div className={hero ? "bib-band" : "bib-band ink"}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 500 }}>
          N° {String(number).padStart(2, "0")}
        </span>
        <span className="label" style={{ fontSize: 10 }}>{band}</span>
      </div>
      <div className="bib-body" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="display" style={{ fontSize: 19, lineHeight: 1.15 }}>{program.name}</h3>
          <p className="mono muted" style={{ margin: "6px 0 12px", fontSize: 12 }}>
            {program.steps.length} étape{program.steps.length > 1 ? "s" : ""} · {formatLength(total)}
          </p>
          <div style={{ display: "flex", gap: 3 }} aria-hidden="true">
            {program.steps.map((step, i) => (
              <span
                key={i}
                style={{
                  flex: step.durationSeconds,
                  height: 8,
                  borderRadius: 4,
                  background: step.exerciseId ? (hero ? "var(--ink)" : "var(--volt)") : "var(--soft)",
                  border: step.exerciseId && !hero ? "1px solid var(--ink)" : undefined,
                }}
              />
            ))}
          </div>
        </div>
        <Link href={`/seance/${program.id}`} className="round ink" style={{ width: 48, height: 48 }} aria-label={`Lancer ${program.name}`}>
          <Icon name="play" size={18} />
        </Link>
      </div>
    </article>
  );
}
