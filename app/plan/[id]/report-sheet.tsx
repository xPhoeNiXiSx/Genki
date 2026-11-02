"use client";

import { useActionState, useState } from "react";

import type { PlanSession } from "@/lib/plan";

import { Spinner } from "../../spinner";
import { Icon } from "../../ui/icons";
import { completePlanAction, type PlanReportState } from "../actions";
import { hoursMinutes, km } from "../format";

const FEELINGS = ["très dur", "dur", "correct", "bien", "facile"];

/** Durée en « h:mm » pour pré-remplir le champ. */
function clock(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m < 60 ? String(m) : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** Bouton qui ouvre le panneau « séance faite » : ressenti, durée, km, D+, note. */
export function ReportSheet({ session, label }: { session: PlanSession; label: string }) {
  const [open, setOpen] = useState(false);
  const [feeling, setFeeling] = useState<number | null>(session.feeling);
  const [state, action, pending] = useActionState<PlanReportState, FormData>(completePlanAction, {});
  const course = session.kind === "course";
  const planned = [hoursMinutes(session.targetSeconds), session.targetMeters ? `≈ ${km(session.targetMeters)}` : null, session.targetClimb ? `≈ ${session.targetClimb} m D+` : null].filter(Boolean).join(" · ");

  return (
    <>
      <button type="button" className="btn volt" style={{ width: "100%", height: 56, borderRadius: 28 }} onClick={() => setOpen(true)}>
        <Icon name="check" size={18} strokeWidth={3} /> {label}
      </button>
      {open ? (
        <div className="sheet-veil" onClick={() => setOpen(false)}>
          <form action={action} className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Valider la séance">
            <input type="hidden" name="id" value={session.id} />
            {feeling ? <input type="hidden" name="feeling" value={feeling} /> : null}
            <h2 className="display" style={{ fontSize: 22 }}>{session.title} faite !</h2>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>Prévu : {planned}</p>

            <span className="field-label">Ressenti</span>
            <div role="radiogroup" aria-label="Ressenti" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {FEELINGS.map((f, i) => {
                const value = i + 1;
                const on = feeling === value;
                const size = 30 + i * 4;
                return (
                  <button key={f} type="button" role="radio" aria-checked={on} aria-label={`${value} · ${f}`} onClick={() => setFeeling(value)} style={{ display: "grid", justifyItems: "center", gap: 6, background: "none", border: 0, padding: 0, cursor: "pointer" }}>
                    <span style={{ width: 46, height: 46, display: "grid", placeItems: "center" }}>
                      <span style={{ width: size, height: size, boxSizing: "border-box", borderRadius: "50%", background: on ? "var(--volt)" : "var(--white)", border: on ? "1.5px solid var(--ink)" : "1px solid var(--line)" }} />
                    </span>
                    <span className="mono muted" style={{ fontSize: 11 }}>{value}</span>
                  </button>
                );
              })}
            </div>
            <div className="mono muted" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 2 }}>
              <span>très dur</span>
              <span>facile</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: course ? "repeat(3, minmax(0, 1fr))" : "1fr", gap: 8, marginTop: 6 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="field-label" style={{ margin: 0 }}>Durée</span>
                <input name="duration" className="input mono" inputMode="numeric" defaultValue={clock(session.actualSeconds ?? session.targetSeconds)} placeholder="1:24" aria-describedby="duree-aide" />
              </label>
              {course ? (
                <>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="field-label" style={{ margin: 0 }}>Km</span>
                    <input name="km" className="input mono" inputMode="decimal" defaultValue={session.actualMeters ? String(session.actualMeters / 1000).replace(".", ",") : ""} placeholder={session.targetMeters ? String(Math.round(session.targetMeters / 100) / 10).replace(".", ",") : "10"} />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="field-label" style={{ margin: 0 }}>D+ (m)</span>
                    <input name="climb" className="input mono" inputMode="numeric" defaultValue={session.actualClimb ?? ""} placeholder={session.targetClimb ? String(session.targetClimb) : "0"} />
                  </label>
                </>
              ) : null}
            </div>
            <p id="duree-aide" className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>Durée en minutes (45) ou en heures:minutes (1:24).</p>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="field-label">Note</span>
              <textarea name="note" className="textarea" rows={2} defaultValue={session.note ?? ""} placeholder="Une gêne, une sensation, la météo…" />
            </label>

            {state.error ? <p className="error" role="alert" style={{ marginTop: 12 }}>{state.error}</p> : null}

            <button type="submit" className="btn wide" style={{ marginTop: 18 }} disabled={pending}>
              {pending ? <Spinner /> : <Icon name="check" size={20} />} {pending ? "Enregistrement…" : "Valider la séance"}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
