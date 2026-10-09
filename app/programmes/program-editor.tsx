"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";

import { bestView } from "@/lib/anatomy";
import { formatClock } from "@/lib/duration";
import type { CatalogEntry } from "@/lib/catalog";
import type { Exercise } from "@/lib/exercises";
import type { MuscleKey } from "@/lib/muscles";
import {
  MAX_REPS,
  MAX_ROUNDS,
  REP_SECONDS,
  SOUNDS,
  STEP_KIND_LABELS,
  STEP_KINDS,
  stepBlocks,
  totalSeconds,
  type Program,
  type SoundKey,
  type StepKind,
} from "@/lib/programs";

import { BodyMap } from "../ui/body-map";
import { CatalogPicker } from "../ui/catalog-picker";
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
  reps: number | null;
  loopGroup: number | null;
  loopRounds: number;
  name: string;
  muscles: MuscleKey[];
};

type Draft = { kind: StepKind; exerciseId: string | null; durationSeconds: number; reps: number | null };

/** Panneau de boucle : création (group null) ou boucle existante. */
type LoopSheet = { group: number | null; rounds: number; members: Set<number> };

const PRESETS = [30, 45, 60, 90];
const REP_PRESETS = [8, 10, 12, 15];
const DEFAULT_REPS = 10;
const PREP_CHOICES = [0, 5, 10, 15, 20, 30];
const DEFAULT_DURATION: Record<StepKind, number> = { exercise: 45, rest: 15, warmup: 180 };

let nextUid = 1;

/** Valeurs proposées pour un exercice : sa mesure et sa cible. */
function exerciseDraft(exercise: Exercise | undefined, base: Draft): Draft {
  if (!exercise) return base;
  return exercise.measure === "reps"
    ? { ...base, exerciseId: exercise.id, reps: exercise.target ?? DEFAULT_REPS }
    : { ...base, exerciseId: exercise.id, reps: null, durationSeconds: exercise.target ?? DEFAULT_DURATION.exercise };
}

/**
 * Une boucle regroupe des étapes consécutives : si un déplacement en a
 * séparé une partie, la partie isolée devient une boucle à part.
 */
function normalizeLoops(list: EditorStep[]): EditorStep[] {
  const closed = new Set<number>();
  const renamed = new Map<number, number>();
  let top = Math.max(0, ...list.map((s) => s.loopGroup ?? 0));
  let previous: number | null = null;
  return list.map((step) => {
    let group = step.loopGroup;
    if (group !== null) {
      if (group !== previous && closed.has(group)) {
        renamed.set(group, ++top);
      } else if (group !== previous) {
        renamed.delete(group);
      }
      const original = group;
      group = renamed.get(group) ?? group;
      previous = original;
      closed.add(original);
    } else {
      previous = null;
    }
    return group === step.loopGroup ? step : { ...step, loopGroup: group };
  });
}

export function ProgramEditor({
  program,
  exercises,
  categories,
}: {
  program?: Program;
  exercises: Exercise[];
  categories: CatalogEntry[];
}) {
  const [state, action, pending] = useActionState<ProgramFormState, FormData>(saveProgramAction, {});
  const [name, setName] = useState(program?.name ?? "");
  const [category, setCategory] = useState<string | null>(program?.category ?? null);
  const [prepSeconds, setPrepSeconds] = useState(program?.prepSeconds ?? 10);
  const [sound, setSound] = useState<SoundKey>(program?.sound ?? "gong");
  const [steps, setSteps] = useState<EditorStep[]>(
    () => program?.steps.map((s) => ({ ...s, uid: nextUid++ })) ?? [],
  );
  // Panneau ouvert : nouvelle étape (uid null) ou étape existante, avec la
  // boucle où l'ajouter.
  const [sheet, setSheet] = useState<{ uid: number | null; loopGroup: number | null; draft: Draft } | null>(null);
  const [loopSheet, setLoopSheet] = useState<LoopSheet | null>(null);
  const [option, setOption] = useState<"prep" | "sound" | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  // Les exercices désactivés ne sont plus proposés, sauf celui de l'étape ouverte.
  const offered = exercises.filter((e) => e.active || e.id === sheet?.draft.exerciseId);
  const total = totalSeconds(steps);

  const payload = JSON.stringify({
    name,
    category,
    notes: program?.notes ?? null,
    prepSeconds,
    sound,
    steps: steps.map(({ kind, exerciseId, label, durationSeconds, reps, loopGroup, loopRounds }) => ({ kind, exerciseId, label, durationSeconds, reps, loopGroup, loopRounds })),
  });

  // --- Réordonner à la poignée -------------------------------------------
  function startDrag(uid: number, event: React.PointerEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDragging(uid);
  }

  /** Au lâcher, l'étape rejoint la boucle où elle est tombée, ou en sort. */
  function endDrag() {
    if (dragging === null) return;
    setSteps((list) => {
      const i = list.findIndex((s) => s.uid === dragging);
      const step = list[i];
      if (!step) return list;
      const prev = list[i - 1];
      const next = list[i + 1];
      let loopGroup: number | null = null;
      let loopRounds = 1;
      if (prev && next && prev.loopGroup !== null && prev.loopGroup === next.loopGroup) {
        loopGroup = prev.loopGroup;
        loopRounds = prev.loopRounds;
      } else if (step.loopGroup !== null && (prev?.loopGroup === step.loopGroup || next?.loopGroup === step.loopGroup)) {
        loopGroup = step.loopGroup;
        loopRounds = step.loopRounds;
      }
      const moved = list.map((s) => (s.uid === step.uid ? { ...s, loopGroup, loopRounds } : s));
      return normalizeLoops(moved);
    });
    setDragging(null);
  }

  function moveDrag(event: React.PointerEvent) {
    if (dragging === null) return;
    const y = event.clientY;
    setSteps((list) => {
      const from = list.findIndex((s) => s.uid === dragging);
      let to = 0;
      list.forEach((s, i) => {
        const rect = rowRefs.current.get(s.uid)?.getBoundingClientRect();
        if (rect && y > rect.top + rect.height / 2) to = i;
      });
      if (y < (rowRefs.current.get(list[0].uid)?.getBoundingClientRect().top ?? 0)) to = 0;
      if (from === to || from < 0) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  // --- Panneau d'étape ----------------------------------------------------
  function openNew(loopGroup: number | null = null) {
    const first = exercises.find((e) => e.active);
    const base: Draft = { kind: "exercise", exerciseId: null, durationSeconds: DEFAULT_DURATION.exercise, reps: null };
    setSheet({ uid: null, loopGroup, draft: exerciseDraft(first, base) });
  }

  function openStep(step: EditorStep) {
    setSheet({ uid: step.uid, loopGroup: step.loopGroup, draft: { kind: step.kind, exerciseId: step.exerciseId, durationSeconds: step.durationSeconds, reps: step.reps } });
  }

  function applySheet() {
    if (!sheet) return;
    const { kind, exerciseId, durationSeconds } = sheet.draft;
    const reps = kind === "exercise" ? sheet.draft.reps : null;
    const exercise = exerciseId ? byId.get(exerciseId) : undefined;
    if (kind === "exercise" && !exercise) return;
    const previous = sheet.uid !== null ? steps.find((s) => s.uid === sheet.uid) : undefined;
    const label = previous && kind === "exercise" && previous.kind === kind && previous.exerciseId === exerciseId ? previous.label : null;
    const loop = sheet.loopGroup !== null ? steps.find((s) => s.loopGroup === sheet.loopGroup) : undefined;
    const built: EditorStep = {
      uid: sheet.uid ?? nextUid++,
      kind,
      exerciseId: kind === "exercise" ? exerciseId : null,
      label,
      durationSeconds: reps !== null ? reps * REP_SECONDS : durationSeconds,
      reps,
      loopGroup: previous?.loopGroup ?? loop?.loopGroup ?? null,
      loopRounds: previous?.loopRounds ?? loop?.loopRounds ?? 1,
      name: kind === "exercise" ? (exercise!.name + (label ? ` — ${label}` : "")) : STEP_KIND_LABELS[kind],
      muscles: kind === "exercise" ? exercise!.muscles : [],
    };
    setSteps((list) => {
      if (sheet.uid !== null) return list.map((s) => (s.uid === sheet.uid ? built : s));
      if (sheet.loopGroup === null) return [...list, built];
      // Dans une boucle : après sa dernière étape.
      const last = list.findLastIndex((s) => s.loopGroup === sheet.loopGroup);
      return [...list.slice(0, last + 1), built, ...list.slice(last + 1)];
    });
    setSheet(null);
  }

  // --- Boucles ------------------------------------------------------------
  function openLoop(group: number | null) {
    const members = steps.filter((s) => group !== null && s.loopGroup === group);
    setLoopSheet({ group, rounds: members[0]?.loopRounds ?? 3, members: new Set(members.map((s) => s.uid)) });
  }

  /** Les étapes cochées forment la boucle, regroupées à la place de la première. */
  function applyLoop() {
    if (!loopSheet || loopSheet.members.size === 0) return;
    const group = loopSheet.group ?? Math.max(0, ...steps.map((s) => s.loopGroup ?? 0)) + 1;
    setSteps((list) => {
      const freed = list.map((s) =>
        s.loopGroup === group && !loopSheet.members.has(s.uid) ? { ...s, loopGroup: null, loopRounds: 1 } : s,
      );
      const firstAt = freed.findIndex((s) => loopSheet.members.has(s.uid));
      const members = freed.filter((s) => loopSheet.members.has(s.uid)).map((s) => ({ ...s, loopGroup: group, loopRounds: loopSheet.rounds }));
      const others = freed.filter((s) => !loopSheet.members.has(s.uid));
      const before = freed.slice(0, firstAt).filter((s) => !loopSheet.members.has(s.uid)).length;
      return normalizeLoops([...others.slice(0, before), ...members, ...others.slice(before)]);
    });
    setLoopSheet(null);
  }

  function removeLoop() {
    if (loopSheet?.group == null) return;
    setSteps((list) => list.map((s) => (s.loopGroup === loopSheet.group ? { ...s, loopGroup: null, loopRounds: 1 } : s)));
    setLoopSheet(null);
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

      <h1 className="display" style={{ fontSize: 34, marginTop: 18 }}>{program ? "Édition" : "Nouvelle séance"}</h1>
      <p className="subtitle">
        {program ? "へんしゅう" : "あたらしい"} · {steps.length} étape{steps.length > 1 ? "s" : ""} · {formatClock(total)} au total
      </p>

      <label className="field-label" htmlFor="program-name">Nom</label>
      <input id="program-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" placeholder="Renfo bas du corps" />

      <span className="field-label">Catégorie</span>
      <CatalogPicker kind="program_category" title="Catégories de séance" entries={categories} value={category} onChange={setCategory} noneLabel="Aucune" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="field-label">Étapes</span>
        {steps.length > 1 ? <span className="mono muted" style={{ fontSize: 11 }}>glisse pour réordonner</span> : null}
      </div>
      <div style={{ display: "grid", gap: 8 }} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {stepBlocks(steps).map((block) => {
          const rows = block.steps.map((step) => {
            const i = steps.indexOf(step);
            return (
              <div
                key={step.uid}
                ref={(el) => {
                  if (el) rowRefs.current.set(step.uid, el);
                  else rowRefs.current.delete(step.uid);
                }}
                style={dragging === step.uid ? { transform: "rotate(-1.5deg) scale(1.02)", boxShadow: "0 12px 28px rgba(26,26,29,.18)", borderRadius: 14, position: "relative", zIndex: 2 } : undefined}
              >
                <StepRow kind={step.kind} n={i + 1} name={step.name} muscles={step.muscles} durationSeconds={step.durationSeconds} reps={step.reps} durationAsPill>
                  <span className="handle" onPointerDown={(e) => startDrag(step.uid, e)} aria-hidden="true">
                    <Icon name="grip" size={18} />
                  </span>
                  <button type="button" onClick={() => openStep(step)} aria-label={`Modifier l'étape ${i + 1} : ${step.name}`} style={{ position: "absolute", inset: 0, opacity: 0, zIndex: 0 }} />
                </StepRow>
              </div>
            );
          });
          if (!block.loop) return rows;
          const loop = block.loop;
          return (
            <section key={`loop-${loop.group}-${block.steps[0].uid}`} aria-label={`Boucle répétée ${loop.rounds} fois`} style={{ border: "1.5px solid var(--ink)", borderRadius: 26, padding: "10px 8px 8px", display: "grid", gap: 8 }}>
              <button type="button" onClick={() => openLoop(loop.group)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: 0, padding: "0 8px", cursor: "pointer", color: "var(--ink)" }}>
                <span className="label">Boucle · {formatClock(totalSeconds(block.steps.map((s) => ({ ...s, loopGroup: null }))))} / tour</span>
                <span className="chip on" style={{ height: 28, fontSize: 13 }}>×{loop.rounds} <Icon name="edit" size={13} /></span>
              </button>
              {rows}
              <button type="button" onClick={() => openNew(loop.group)} className="chip dashed" style={{ justifySelf: "center" }}>
                <Icon name="plus" size={14} /> Ajouter dans la boucle
              </button>
            </section>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: steps.length > 0 ? "1fr 1fr" : "1fr", gap: 8, marginTop: 10 }}>
        <button type="button" onClick={() => openNew()} className="galet" style={{ width: "100%", border: "1.5px dashed rgba(26,26,29,.45)", background: "transparent", borderRadius: 26, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, minHeight: 56, fontWeight: 900, fontSize: 14, cursor: "pointer", padding: "0 10px" }}>
          <Icon name="plus" size={18} /> Ajouter une étape
        </button>
        {steps.length > 0 ? (
          <button type="button" onClick={() => openLoop(null)} className="galet" style={{ width: "100%", border: "1.5px dashed rgba(26,26,29,.45)", background: "transparent", borderRadius: 26, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, minHeight: 56, fontWeight: 900, fontSize: 14, cursor: "pointer", padding: "0 10px" }}>
            <Icon name="restart" size={18} /> Créer une boucle
          </button>
        ) : null}
      </div>

      <span className="field-label">Options</span>
      <div className="settings">
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
        {pending ? <Spinner /> : <Icon name="check" size={20} />} {pending ? "Enregistrement…" : "Enregistrer la séance"}
      </button>
      {program ? (
        <button type="submit" formAction={deleteProgramAction} className="btn" style={{ background: "transparent", color: "var(--grey)", width: "100%", marginTop: 6 }}>
          <Icon name="trash" size={18} /> Supprimer la séance
        </button>
      ) : null}

      {sheet ? (
        <StepSheet
          editing={sheet.uid !== null}
          draft={sheet.draft}
          exercises={offered}
          onChange={(draft) => setSheet({ ...sheet, draft })}
          onApply={applySheet}
          onRemove={removeStep}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {loopSheet ? (
        <div className="sheet-veil" onClick={() => setLoopSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Boucle">
            <h2 className="display" style={{ fontSize: 22 }}>{loopSheet.group === null ? "Créer une boucle" : "Boucle"}</h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>Les étapes cochées sont jouées à la suite, autant de fois que demandé.</p>
            <Stepper value={loopSheet.rounds} min={1} max={MAX_ROUNDS} onChange={(rounds) => setLoopSheet({ ...loopSheet, rounds })} display={`×${loopSheet.rounds}`} />
            <span className="field-label">Étapes de la boucle</span>
            <div style={{ display: "grid", gap: 6 }}>
              {steps.map((step, i) => {
                const elsewhere = step.loopGroup !== null && step.loopGroup !== loopSheet.group;
                const on = loopSheet.members.has(step.uid);
                return (
                  <label key={step.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 18, background: on ? "var(--volt)" : "var(--paper)", opacity: elsewhere ? 0.4 : 1, cursor: elsewhere ? "default" : "pointer" }}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={elsewhere}
                      onChange={() => {
                        const members = new Set(loopSheet.members);
                        if (on) members.delete(step.uid);
                        else members.add(step.uid);
                        setLoopSheet({ ...loopSheet, members });
                      }}
                      style={{ width: 20, height: 20, accentColor: "var(--ink)" }}
                    />
                    <span className="mono" style={{ fontSize: 11 }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{step.name}</span>
                    <span className="mono muted" style={{ fontSize: 12 }}>{elsewhere ? "autre boucle" : step.reps !== null ? `×${step.reps}` : formatClock(step.durationSeconds)}</span>
                  </label>
                );
              })}
            </div>
            <button type="button" className="btn wide" style={{ marginTop: 22 }} onClick={applyLoop} disabled={loopSheet.members.size === 0}>
              <Icon name="check" size={20} /> {loopSheet.group === null ? "Créer la boucle" : "Mettre à jour la boucle"}
            </button>
            {loopSheet.group !== null ? (
              <button type="button" className="btn" style={{ background: "transparent", color: "var(--danger)", width: "100%", marginTop: 6 }} onClick={removeLoop}>
                <Icon name="close" size={18} /> Défaire la boucle
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {option ? (
        <div className="sheet-veil" onClick={() => setOption(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            {option === "prep" ? (
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
              onClick={() => {
                if (k === draft.kind) return;
                const base: Draft = { kind: k, exerciseId: draft.exerciseId, durationSeconds: DEFAULT_DURATION[k], reps: null };
                onChange(k === "exercise" ? exerciseDraft(exercises.find((e) => e.id === draft.exerciseId) ?? exercises[0], base) : base);
              }}
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
                    onClick={() => onChange(exerciseDraft(e, draft))}
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

        {draft.kind === "exercise" ? (
          <div className="choices" role="radiogroup" aria-label="Mesure" style={{ marginTop: 18 }}>
            <button type="button" role="radio" aria-checked={draft.reps === null} className={draft.reps === null ? "chip on" : "chip"} onClick={() => onChange({ ...draft, reps: null })}>Temps</button>
            <button type="button" role="radio" aria-checked={draft.reps !== null} className={draft.reps !== null ? "chip on" : "chip"} onClick={() => onChange({ ...draft, reps: draft.reps ?? DEFAULT_REPS })}>Répétitions</button>
          </div>
        ) : null}

        {draft.kind === "exercise" && draft.reps !== null ? (
          <>
            <span className="field-label">Répétitions</span>
            <Stepper value={draft.reps} min={1} max={MAX_REPS} onChange={(v) => onChange({ ...draft, reps: v })} display={`×${draft.reps}`} />
            <div className="choices" style={{ justifyContent: "center", marginTop: 14 }}>
              {REP_PRESETS.map((p) => (
                <button key={p} type="button" className={draft.reps === p ? "chip on" : "chip"} onClick={() => onChange({ ...draft, reps: p })}>×{p}</button>
              ))}
            </div>
            <p className="muted" style={{ textAlign: "center", fontSize: 12, margin: "10px 0 0" }}>En séance, touche « Fait » pour passer à la suite.</p>
          </>
        ) : (
          <>
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
          </>
        )}

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
