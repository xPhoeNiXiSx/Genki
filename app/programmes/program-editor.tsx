"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";

import { bestView } from "@/lib/anatomy";
import { formatClock } from "@/lib/duration";
import type { Exercise } from "@/lib/exercises";
import type { MuscleKey } from "@/lib/muscles";
import {
  MAX_ROUNDS,
  PROGRAM_CATEGORIES,
  SOUNDS,
  STEP_KIND_LABELS,
  STEP_KINDS,
  roundSeconds,
  type Program,
  type SoundKey,
  type StepKind,
} from "@/lib/programs";

import { BodyMap } from "../ui/body-map";
import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { StepRow } from "../ui/step-row";
import { Spinner } from "../spinner";
import { deleteProgramAction, saveProgramAction, type ProgramFormState } from "./actions";

type EditorStep = {
  uid: number;
  kind: StepKind;
  exerciseId: string | null;
  label: string | null;
  durationSeconds: number;
  name: string;
  muscles: MuscleKey[];
};

type Draft = { kind: StepKind; exerciseId: string | null; durationSeconds: number };

const PRESETS = [30, 45, 60, 90];
const PREP_CHOICES = [0, 5, 10, 15, 20, 30];
const DEFAULT_DURATION: Record<StepKind, number> = { exercise: 45, rest: 15, warmup: 180 };

let nextUid = 1;

export function ProgramEditor({ program, exercises }: { program?: Program; exercises: Exercise[] }) {
  const [state, action, pending] = useActionState<ProgramFormState, FormData>(saveProgramAction, {});
  const [name, setName] = useState(program?.name ?? "");
  const [category, setCategory] = useState<string | null>(program?.category ?? null);
  const [rounds, setRounds] = useState(program?.rounds ?? 1);
  const [prepSeconds, setPrepSeconds] = useState(program?.prepSeconds ?? 10);
  const [sound, setSound] = useState<SoundKey>(program?.sound ?? "gong");
  const [steps, setSteps] = useState<EditorStep[]>(
    () => program?.steps.map((s) => ({ ...s, uid: nextUid++ })) ?? [],
  );
  // Panneau ouvert : nouvelle étape (uid null) ou étape existante.
  const [sheet, setSheet] = useState<{ uid: number | null; draft: Draft } | null>(null);
  const [option, setOption] = useState<"rounds" | "prep" | "sound" | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const rows = useRef(new Map<number, HTMLDivElement>());

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const categories = category && !PROGRAM_CATEGORIES.includes(category) ? [...PROGRAM_CATEGORIES, category] : PROGRAM_CATEGORIES;
  const perRound = roundSeconds(steps);

  const payload = JSON.stringify({
    name,
    category,
    notes: program?.notes ?? null,
    rounds,
    prepSeconds,
    sound,
    steps: steps.map(({ kind, exerciseId, label, durationSeconds }) => ({ kind, exerciseId, label, durationSeconds })),
  });

  // --- Réordonner à la poignée -------------------------------------------
  function startDrag(uid: number, event: React.PointerEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDragging(uid);
  }

  function moveDrag(event: React.PointerEvent) {
    if (dragging === null) return;
    const y = event.clientY;
    setSteps((list) => {
      const from = list.findIndex((s) => s.uid === dragging);
      let to = 0;
      list.forEach((s, i) => {
        const rect = rows.current.get(s.uid)?.getBoundingClientRect();
        if (rect && y > rect.top + rect.height / 2) to = i;
      });
      if (y < (rows.current.get(list[0].uid)?.getBoundingClientRect().top ?? 0)) to = 0;
      if (from === to || from < 0) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  // --- Panneau d'étape ----------------------------------------------------
  function openNew() {
    setSheet({ uid: null, draft: { kind: "exercise", exerciseId: exercises[0]?.id ?? null, durationSeconds: DEFAULT_DURATION.exercise } });
  }

  function openStep(step: EditorStep) {
    setSheet({ uid: step.uid, draft: { kind: step.kind, exerciseId: step.exerciseId, durationSeconds: step.durationSeconds } });
  }

  function applySheet() {
    if (!sheet) return;
    const { kind, exerciseId, durationSeconds } = sheet.draft;
    const exercise = exerciseId ? byId.get(exerciseId) : undefined;
    if (kind === "exercise" && !exercise) return;
    const previous = sheet.uid !== null ? steps.find((s) => s.uid === sheet.uid) : undefined;
    const keepLabel = previous && previous.kind === kind && previous.exerciseId === exerciseId ? previous.label : null;
    const label = kind === "exercise" ? keepLabel : STEP_KIND_LABELS[kind];
    const built: EditorStep = {
      uid: sheet.uid ?? nextUid++,
      kind,
      exerciseId: kind === "exercise" ? exerciseId : null,
      label,
      durationSeconds,
      name: kind === "exercise" ? (exercise!.name + (label ? ` — ${label}` : "")) : STEP_KIND_LABELS[kind],
      muscles: kind === "exercise" ? exercise!.muscles : [],
    };
    setSteps((list) => (sheet.uid === null ? [...list, built] : list.map((s) => (s.uid === sheet.uid ? built : s))));
    setSheet(null);
  }

  function removeStep() {
    if (sheet?.uid == null) return;
    setSteps((list) => list.filter((s) => s.uid !== sheet.uid));
    setSheet(null);
  }

  const back = program ? `/programmes/${program.id}` : "/programmes";

  return (
    <form action={action} className="screen bare">
      <Lanes />
      {program ? <input type="hidden" name="id" value={program.id} /> : null}
      <input type="hidden" name="payload" value={payload} />

      <div className="top-bar">
        <Link href={back} className="round" aria-label="Annuler"><Icon name="close" size={18} /></Link>
        <button type="submit" className="btn volt" style={{ height: 44 }} disabled={pending}>Enregistrer</button>
      </div>

      <h1 className="display" style={{ fontSize: 34, marginTop: 18 }}>{program ? "Édition" : "Nouveau programme"}</h1>
      <p className="subtitle">
        {program ? "へんしゅう" : "あたらしい"} · {steps.length} étape{steps.length > 1 ? "s" : ""} · {formatClock(perRound * rounds)} au total
      </p>

      <label className="field-label" htmlFor="program-name">Nom</label>
      <input id="program-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" placeholder="Renfo bas du corps" />

      <span className="field-label">Catégorie</span>
      <div className="choices">
        {categories.map((c) => (
          <button key={c} type="button" className={category === c ? "chip on" : "chip"} aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
            {c}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="field-label">Étapes</span>
        {steps.length > 1 ? <span className="mono muted" style={{ fontSize: 11 }}>glisse pour réordonner</span> : null}
      </div>
      <div style={{ display: "grid", gap: 8 }} onPointerMove={moveDrag} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}>
        {steps.map((step, i) => (
          <div
            key={step.uid}
            ref={(el) => {
              if (el) rows.current.set(step.uid, el);
              else rows.current.delete(step.uid);
            }}
            style={dragging === step.uid ? { transform: "rotate(-1.5deg) scale(1.02)", boxShadow: "0 12px 28px rgba(26,26,29,.18)", borderRadius: 14, position: "relative", zIndex: 2 } : undefined}
          >
            <StepRow kind={step.kind} n={i + 1} name={step.name} muscles={step.muscles} durationSeconds={step.durationSeconds} durationAsPill>
              <span className="handle" onPointerDown={(e) => startDrag(step.uid, e)} aria-hidden="true">
                <Icon name="grip" size={18} />
              </span>
              <button type="button" onClick={() => openStep(step)} aria-label={`Modifier l'étape ${i + 1} : ${step.name}`} style={{ position: "absolute", inset: 0, opacity: 0, zIndex: 0 }} />
            </StepRow>
          </div>
        ))}
      </div>
      <button type="button" onClick={openNew} className="galet" style={{ width: "100%", marginTop: 10, border: "1.5px dashed rgba(26,26,29,.45)", background: "transparent", borderRadius: 26, display: "flex", justifyContent: "center", alignItems: "center", gap: 10, minHeight: 56, fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
        <Icon name="plus" size={20} /> Ajouter une étape
      </button>

      <span className="field-label">Options</span>
      <div className="settings">
        <button type="button" className="setting-row" onClick={() => setOption("rounds")}>
          <span><span style={{ display: "block", fontWeight: 900 }}>Répétitions</span><span className="muted" style={{ fontSize: 12 }}>tours du programme</span></span>
          <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{rounds} tour{rounds > 1 ? "s" : ""} <Icon name="chevron" size={18} /></span>
        </button>
        <button type="button" className="setting-row" onClick={() => setOption("prep")}>
          <span><span style={{ display: "block", fontWeight: 900 }}>Temps de préparation</span><span className="muted" style={{ fontSize: 12 }}>avant la première étape</span></span>
          <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{prepSeconds} s <Icon name="chevron" size={18} /></span>
        </button>
        <button type="button" className="setting-row" onClick={() => setOption("sound")}>
          <span><span style={{ display: "block", fontWeight: 900 }}>Son de transition</span><span className="muted" style={{ fontSize: 12 }}>entre deux étapes</span></span>
          <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{SOUNDS.find((s) => s.key === sound)?.label} <Icon name="chevron" size={18} /></span>
        </button>
      </div>

      {state.error ? <p className="error" role="alert" style={{ marginTop: 16 }}>{state.error}</p> : null}

      <button type="submit" className="btn wide" style={{ marginTop: 18 }} disabled={pending}>
        {pending ? <Spinner /> : <Icon name="check" size={20} />} {pending ? "Enregistrement…" : "Enregistrer le programme"}
      </button>
      {program ? (
        <button type="submit" formAction={deleteProgramAction} className="btn" style={{ background: "transparent", color: "var(--grey)", width: "100%", marginTop: 6 }}>
          <Icon name="trash" size={18} /> Supprimer le programme
        </button>
      ) : null}

      {sheet ? (
        <StepSheet
          editing={sheet.uid !== null}
          draft={sheet.draft}
          exercises={exercises}
          onChange={(draft) => setSheet({ ...sheet, draft })}
          onApply={applySheet}
          onRemove={removeStep}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {option ? (
        <div className="sheet-veil" onClick={() => setOption(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            {option === "rounds" ? (
              <>
                <h2 className="display" style={{ fontSize: 22 }}>Répétitions</h2>
                <p className="muted" style={{ margin: "6px 0 0" }}>Nombre de fois que la suite d&apos;étapes est jouée.</p>
                <Stepper value={rounds} min={1} max={MAX_ROUNDS} onChange={setRounds} display={`×${rounds}`} />
              </>
            ) : option === "prep" ? (
              <>
                <h2 className="display" style={{ fontSize: 22 }}>Temps de préparation</h2>
                <p className="muted" style={{ margin: "6px 0 16px" }}>Compte à rebours avant la première étape.</p>
                <div className="choices">
                  {PREP_CHOICES.map((p) => (
                    <button key={p} type="button" className={prepSeconds === p ? "chip on" : "chip"} onClick={() => setPrepSeconds(p)}>{p === 0 ? "Aucun" : `${p} s`}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="display" style={{ fontSize: 22 }}>Son de transition</h2>
                <p className="muted" style={{ margin: "6px 0 16px" }}>Joué à chaque changement d&apos;étape.</p>
                <div className="choices">
                  {SOUNDS.map((s) => (
                    <button key={s.key} type="button" className={sound === s.key ? "chip on" : "chip"} onClick={() => setSound(s.key)}>{s.label}</button>
                  ))}
                </div>
              </>
            )}
            <button type="button" className="btn wide" style={{ marginTop: 22 }} onClick={() => setOption(null)}>
              <Icon name="check" size={20} /> Valider
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function Stepper({ value, min, max, step = 1, onChange, display }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; display: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 0" }}>
      <button type="button" className="round" style={{ width: 64, height: 64 }} onClick={() => onChange(Math.max(min, value - step))} aria-label="Moins" disabled={value <= min}>
        <Icon name="minus" size={24} />
      </button>
      <span className="display" style={{ fontSize: 76, lineHeight: 1, fontVariantNumeric: "tabular-nums" }} aria-live="polite">{display}</span>
      <button type="button" className="round" style={{ width: 64, height: 64 }} onClick={() => onChange(Math.min(max, value + step))} aria-label="Plus" disabled={value >= max}>
        <Icon name="plus" size={24} />
      </button>
    </div>
  );
}

function StepSheet({
  editing,
  draft,
  exercises,
  onChange,
  onApply,
  onRemove,
  onClose,
}: {
  editing: boolean;
  draft: Draft;
  exercises: Exercise[];
  onChange: (draft: Draft) => void;
  onApply: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const shown = exercises.filter((e) => !needle || e.name.toLowerCase().includes(needle));
  const canApply = draft.kind !== "exercise" || draft.exerciseId !== null;

  return (
    <div className="sheet-veil" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={editing ? "Modifier l'étape" : "Ajouter une étape"}>
        <h2 className="display" style={{ fontSize: 22 }}>{editing ? "Modifier l'étape" : "Ajouter une étape"}</h2>

        <div className="choices" style={{ marginTop: 14 }}>
          {STEP_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={draft.kind === k ? "chip on" : "chip"}
              onClick={() => onChange({ kind: k, exerciseId: k === "exercise" ? (draft.exerciseId ?? exercises[0]?.id ?? null) : draft.exerciseId, durationSeconds: k === draft.kind ? draft.durationSeconds : DEFAULT_DURATION[k] })}
            >
              {STEP_KIND_LABELS[k]}
            </button>
          ))}
        </div>

        {draft.kind === "exercise" ? (
          <>
            <input
              type="search"
              className="input"
              style={{ marginTop: 14 }}
              placeholder="Rechercher dans la bibliothèque"
              aria-label="Rechercher dans la bibliothèque"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ display: "grid", gap: 8, marginTop: 12, maxHeight: 230, overflowY: "auto" }}>
              {shown.map((e, i) => {
                const on = draft.exerciseId === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onChange({ ...draft, exerciseId: e.id })}
                    aria-pressed={on}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 14px", minHeight: 60, textAlign: "left", cursor: "pointer", border: on ? "1.5px solid var(--ink)" : "0", background: on ? "var(--volt)" : "var(--paper)", borderRadius: i % 2 ? "14px 28px 14px 28px" : "28px 14px 28px 14px" }}
                  >
                    <BodyMap view={bestView(e.muscles)} highlight={e.muscles} height={52} tone={on ? "ink" : "light"} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 900 }}>{e.name}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{e.category}{e.equipment ? ` · ${e.equipment.toLowerCase()}` : ""}</span>
                    </span>
                    <span style={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", background: on ? "var(--ink)" : "var(--white)", border: on ? 0 : "1.5px solid rgba(26,26,29,.3)", color: "var(--volt)" }}>
                      {on ? <Icon name="check" size={16} strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
              {exercises.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  La bibliothèque est vide. <Link href="/exercices/nouveau" style={{ textDecoration: "underline" }}>Crée un exercice</Link> d&apos;abord.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        <span className="field-label">Durée</span>
        <Stepper
          value={draft.durationSeconds}
          min={5}
          max={3 * 60 * 60}
          step={draft.durationSeconds >= 120 ? 15 : 5}
          onChange={(v) => onChange({ ...draft, durationSeconds: v })}
          display={formatClock(draft.durationSeconds)}
        />
        <div className="choices" style={{ justifyContent: "center", marginTop: 14 }}>
          {PRESETS.map((p) => (
            <button key={p} type="button" className={draft.durationSeconds === p ? "chip on" : "chip"} onClick={() => onChange({ ...draft, durationSeconds: p })}>
              {formatClock(p)}
            </button>
          ))}
        </div>

        <button type="button" className="btn wide" style={{ marginTop: 22 }} onClick={onApply} disabled={!canApply}>
          <Icon name={editing ? "check" : "plus"} size={20} /> {editing ? "Mettre à jour l'étape" : "Ajouter l'étape"}
        </button>
        {editing ? (
          <button type="button" className="btn" style={{ background: "transparent", color: "var(--danger)", width: "100%", marginTop: 6 }} onClick={onRemove}>
            <Icon name="trash" size={18} /> Retirer l&apos;étape
          </button>
        ) : null}
      </div>
    </div>
  );
}
