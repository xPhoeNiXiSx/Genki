"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { bestView } from "@/lib/anatomy";
import { keepScreenAwake, playCue, unlockAudio } from "@/lib/audio";
import { formatClock } from "@/lib/duration";
import { muscleLabel, type MuscleKey } from "@/lib/muscles";
import { sessionSteps, type Program, type StepKind } from "@/lib/programs";
import { cuesBetween, elapsed, newClock, pause, play, seek, stateAt, stepStartMs, type SessionClock } from "@/lib/session-engine";
import type { Settings } from "@/lib/settings";

import { BodyMap } from "../../ui/body-map";
import { Icon } from "../../ui/icons";
import { Lanes } from "../../ui/lanes";
import { recordSessionAction, reviewSessionAction } from "../actions";

/** Durée minimale pour qu'une séance interrompue soit enregistrée. */
const MIN_RECORDED_MS = 10_000;
const EXTEND_SECONDS = 15;

type PlayStep = {
  kind: StepKind | "prep";
  name: string;
  muscles: MuscleKey[];
  durationSeconds: number;
  /** Position de l'étape dans un tour, pour le récap. */
  source: number;
};

const FEELINGS = [
  { value: 1, label: "très dur" },
  { value: 2, label: "dur" },
  { value: 3, label: "correct" },
  { value: 4, label: "bien" },
  { value: 5, label: "facile" },
];

export function SessionPlayer({ program, settings, streakAfter }: { program: Program; settings: Settings; streakAfter: number }) {
  const router = useRouter();

  // Les étapes jouées : préparation éventuelle, puis un tour répété.
  const initialSteps = useMemo<PlayStep[]>(() => {
    const rounds = sessionSteps(program.steps.map((s, i) => ({ ...s, source: i })), program.rounds).map(
      (s): PlayStep => ({ kind: s.kind, name: s.name, muscles: s.muscles, durationSeconds: s.durationSeconds, source: s.source }),
    );
    return program.prepSeconds > 0
      ? [{ kind: "prep", name: "Préparation", muscles: [], durationSeconds: program.prepSeconds, source: -1 }, ...rounds]
      : rounds;
  }, [program]);
  const offset = program.prepSeconds > 0 ? 1 : 0;
  const realCount = initialSteps.length - offset;

  const [steps, setSteps] = useState<PlayStep[]>(initialSteps);
  const [clock, setClock] = useState<SessionClock>(newClock);
  const [now, setNow] = useState(0);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState<null | { completed: boolean; durationMs: number; done: number }>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const startedAt = useRef<Date | null>(null);
  const lastMs = useRef(-1);
  const release = useRef<(() => void) | null>(null);
  const recorded = useRef(false);

  const ms = elapsed(clock, now);
  const state = stateAt(steps, ms);
  const running = clock.runningSince !== null;
  const current = steps[Math.min(state.index, steps.length - 1)];
  const next = steps[state.index + 1];
  const shownIndex = Math.max(0, state.index - offset);
  const prepMs = offset ? steps[0].durationSeconds * 1000 : 0;

  // Rafraîchissement : l'état est recalculé du temps écoulé, chaque signal est
  // joué une seule fois, même après une mise en veille.
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      const t = performance.now();
      const at = elapsed(clock, t);
      for (const cue of cuesBetween(steps, lastMs.current, at)) {
        if (cue.kind === "step" && steps[cue.index]?.kind === "prep") continue;
        playCue(cue, {
          signal: settings.signal,
          voice: settings.voice,
          vibration: settings.vibration,
          stepTone: program.sound,
          signalTone: settings.signalSound,
          stepName: cue.kind === "step" ? steps[cue.index]?.name : undefined,
        });
      }
      lastMs.current = at;
      setNow(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, clock, steps, settings, program.sound]);

  async function record(completed: boolean, durationMs: number, done: number) {
    if (recorded.current || !startedAt.current) return;
    recorded.current = true;
    release.current?.();
    setEnded({ completed, durationMs, done });
    if (durationMs < MIN_RECORDED_MS) return;
    const { id } = await recordSessionAction({
      programId: program.id,
      programName: program.name,
      startedAt: startedAt.current.toISOString(),
      durationSeconds: Math.round(durationMs / 1000),
      completed,
      stepsDone: done,
      stepsTotal: realCount,
    });
    setWorkoutId(id);
  }

  // Fin naturelle de la séance.
  useEffect(() => {
    if (started && state.finished && !recorded.current) void record(true, state.totalMs - prepMs, realCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.finished, started]);

  useEffect(() => () => release.current?.(), []);

  async function start() {
    await unlockAudio();
    startedAt.current = new Date();
    if (settings.keepAwake) release.current = keepScreenAwake();
    setStarted(true);
    const t = performance.now();
    setNow(t);
    setClock((c) => play(c, t));
  }

  function toggle() {
    const t = performance.now();
    setNow(t);
    setClock((c) => (c.runningSince === null ? play(c, t) : pause(c, t)));
  }

  function jump(index: number, resume = false) {
    const t = performance.now();
    const target = stepStartMs(steps, index);
    // Le signal de l'étape visée sera joué par le prochain rafraîchissement.
    lastMs.current = target - 1;
    setNow(t);
    setClock((c) => {
      const moved = seek(c, t, target);
      return resume ? play(moved, t) : moved;
    });
  }

  function extend() {
    setSteps((list) => list.map((s, i) => (i === state.index ? { ...s, durationSeconds: s.durationSeconds + EXTEND_SECONDS } : s)));
  }

  function terminate() {
    const t = performance.now();
    setClock((c) => pause(c, t));
    void record(false, Math.max(0, ms - prepMs), shownIndex);
  }

  async function close() {
    if (started && !ended) {
      if (ms - prepMs >= MIN_RECORDED_MS) {
        terminate();
        return;
      }
      release.current?.();
    }
    router.push(workoutId ? `/suivi/${workoutId}` : "/");
  }

  // --- Bilan --------------------------------------------------------------
  if (ended) {
    const doneBySource = new Map<number, number>();
    steps.slice(offset, offset + ended.done).forEach((s) => doneBySource.set(s.source, (doneBySource.get(s.source) ?? 0) + 1));
    return (
      <form action={reviewSessionAction} className="screen bare">
        <Lanes />
        {workoutId ? <input type="hidden" name="id" value={workoutId} /> : null}
        {feeling ? <input type="hidden" name="feeling" value={feeling} /> : null}
        <div className="top-bar">
          <button type="button" className="round" onClick={close} aria-label="Fermer le bilan"><Icon name="close" size={18} /></button>
        </div>
        <div style={{ position: "relative", width: 156, height: 156, margin: "6px auto 0" }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: ended.completed ? "var(--volt)" : "var(--stone)", border: "1.5px solid var(--ink)", display: "grid", placeItems: "center" }}>
            <Icon name={ended.completed ? "check" : "pause"} size={48} strokeWidth={2} />
          </span>
          <span className="stamp" style={{ position: "absolute", top: -6, right: -14 }} aria-hidden="true">{ended.completed ? "済" : "止"}</span>
        </div>
        <h1 className="display" style={{ fontSize: 30, textAlign: "center", marginTop: 20 }}>{ended.completed ? "Séance terminée !" : "Séance interrompue"}</h1>
        <p className="muted" style={{ textAlign: "center", margin: "6px 0 0", fontSize: 13 }}>おつかれさま · {program.name}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 22 }}>
          <div className="stat" style={{ background: "var(--ink)", borderColor: "var(--ink)", color: "var(--white)" }}>
            <span className="label" style={{ color: "var(--volt)" }}>Durée</span>
            <span className="display" style={{ fontSize: 22 }}>{formatClock(ended.durationMs / 1000)}</span>
          </div>
          <div className="stat">
            <span className="label">Étapes</span>
            <span className="display" style={{ fontSize: 22 }}>{ended.done}/{realCount}</span>
          </div>
          <div className="stat">
            <span className="label">Série</span>
            <span className="display" style={{ fontSize: 22 }}>{streakAfter} j</span>
          </div>
        </div>

        {workoutId ? (
          <>
            <span className="field-label">Ressenti</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} role="radiogroup" aria-label="Ressenti">
              {FEELINGS.map((f, i) => {
                const size = 30 + i * 4;
                const on = feeling === f.value;
                return (
                  <button key={f.value} type="button" role="radio" aria-checked={on} aria-label={`${f.value} · ${f.label}`} onClick={() => setFeeling(f.value)} style={{ display: "grid", justifyItems: "center", gap: 8, background: "none", border: 0, cursor: "pointer", padding: 0 }}>
                    <span style={{ width: 46, height: 46, display: "grid", placeItems: "center" }}>
                      <span style={{ width: size, height: size, borderRadius: "50%", background: on ? "var(--volt)" : "var(--white)", border: on ? "1.5px solid var(--ink)" : "1px solid var(--line)" }} />
                    </span>
                    <span className="mono muted" style={{ fontSize: 11 }}>{f.value}</span>
                  </button>
                );
              })}
            </div>
            <div className="mono muted" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4 }}>
              <span>très dur</span>
              <span>facile</span>
            </div>

            <label className="field-label" htmlFor="note">Note pour le kiné</label>
            <textarea id="note" name="note" className="textarea" rows={3} placeholder="Une gêne, un progrès, une question…" />
          </>
        ) : (
          <p className="muted" style={{ marginTop: 22, textAlign: "center" }}>
            {ended.durationMs < MIN_RECORDED_MS ? "Séance trop courte pour être enregistrée." : "Enregistrement…"}
          </p>
        )}

        <span className="field-label">Récap</span>
        <div className="settings" style={{ padding: "6px 0" }}>
          {program.steps.map((s, i) => {
            const count = doneBySource.get(i) ?? 0;
            const full = count >= program.rounds;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px", borderTop: 0 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: full ? "var(--ink)" : "transparent", border: full ? 0 : "1.5px dashed rgba(26,26,29,.4)", color: "var(--volt)" }}>
                  {full ? <Icon name="check" size={13} strokeWidth={3} /> : null}
                </span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14, opacity: count ? 1 : 0.5 }}>{s.name}</span>
                <span className="mono muted" style={{ fontSize: 12 }}>
                  {formatClock(s.durationSeconds)}{program.rounds > 1 ? ` ×${count}` : ""}
                </span>
              </div>
            );
          })}
        </div>

        {workoutId ? (
          <button type="submit" className="btn wide" style={{ marginTop: 20 }}>
            <Icon name="check" size={20} /> Enregistrer dans le carnet
          </button>
        ) : (
          <Link href="/" className="btn wide" style={{ marginTop: 20 }}>Retour à l&apos;accueil</Link>
        )}
      </form>
    );
  }

  const remaining = Math.ceil(state.stepRemainingMs / 1000);
  const ring = 2 * Math.PI * 112;
  const progressDots = (dark: boolean) => (
    <div style={{ display: "flex", gap: 4, marginTop: 18 }} aria-hidden="true">
      {steps.slice(offset).map((_, i) => {
        const done = i < shownIndex;
        const now = i === shownIndex;
        return (
          <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: done ? (dark ? "var(--white)" : "var(--ink)") : now ? "var(--volt)" : dark ? "rgba(255,255,255,.15)" : "var(--soft)", border: now && !dark ? "1px solid var(--ink)" : undefined }} />
        );
      })}
    </div>
  );
  const header = (dark: boolean) => (
    <div className="top-bar">
      <button type="button" className="round" onClick={close} aria-label="Quitter la séance" style={dark ? { background: "var(--white)" } : undefined}><Icon name="close" size={18} /></button>
      <span style={{ fontWeight: 700, fontSize: 15 }}>{program.name}</span>
      {state.index >= offset ? (
        <span className="mono" style={{ fontSize: 12, border: `1.5px solid ${dark ? "var(--white)" : "var(--ink)"}`, borderRadius: 14, padding: "5px 12px" }}>
          {shownIndex + 1} / {realCount}
        </span>
      ) : <span style={{ width: 44 }} />}
    </div>
  );

  // --- Démarrage : préparation ou attente du premier toucher ---------------
  if (!started || current.kind === "prep") {
    const first = steps[offset];
    const second = steps[offset + 1];
    const digit = started ? remaining : program.prepSeconds || "始";
    const fraction = started ? state.stepRemainingMs / (current.durationSeconds * 1000) : 1;
    return (
      <main className="screen bare">
        <Lanes centered />
        {header(false)}
        <p className="label" style={{ textAlign: "center", margin: "22px 0 4px", opacity: 0.7 }}>{started ? "Prépare-toi" : "Prêt ?"}</p>
        <h1 className="display" style={{ fontSize: 30, textAlign: "center" }}>{first.name}</h1>
        <p className="mono muted" style={{ textAlign: "center", margin: "6px 0 0", fontSize: 12 }}>
          première étape · {formatClock(first.durationSeconds)}{program.rounds > 1 ? ` · ${program.rounds} tours` : ""}
        </p>
        <div style={{ position: "relative", width: 260, height: 260, margin: "24px auto 0" }}>
          <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true">
            <circle cx="130" cy="130" r="122" fill="none" stroke="var(--soft)" strokeWidth="10" />
            <circle cx="130" cy="130" r="122" fill="none" stroke="var(--ink)" strokeWidth="10" strokeDasharray={`${2 * Math.PI * 122 * fraction} ${2 * Math.PI * 122}`} transform="rotate(-90 130 130)" />
            <circle cx="130" cy="130" r="98" fill="var(--volt)" stroke="var(--ink)" strokeWidth="1.5" />
          </svg>
          <span className="display" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: typeof digit === "number" && digit >= 10 ? 110 : 150, lineHeight: 1 }} aria-live="assertive">{digit}</span>
          <span className="stamp" style={{ position: "absolute", top: 4, right: -4 }} aria-hidden="true">始</span>
          <span className="display" aria-hidden="true" style={{ position: "absolute", right: -46, top: 70, writingMode: "vertical-rl", textOrientation: "upright", fontSize: 18 }}>ジュンビ</span>
        </div>
        {settings.voice ? (
          <p className="muted" style={{ textAlign: "center", fontSize: 13, display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
            <Icon name="speaker" size={16} /> décompte vocal · « trois, deux, un »
          </p>
        ) : null}
        {second ? (
          <div className="galet ink alt" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, padding: "12px 22px" }}>
            <span>
              <span style={{ display: "block", fontSize: 12, color: "var(--volt)", opacity: 0.85 }}>Puis</span>
              <span className="display" style={{ fontSize: 18 }}>{second.name}</span>
            </span>
            <span className="mono" style={{ color: "var(--volt)", fontSize: 18 }}>{formatClock(second.durationSeconds)}</span>
          </div>
        ) : null}
        {started ? (
          <>
            <button type="button" className="btn wide" style={{ marginTop: 22, background: "transparent", color: "var(--ink)", border: "1.5px solid var(--ink)" }} onClick={() => jump(offset, true)}>
              <Icon name="next" size={18} /> Passer le décompte
            </button>
            <p className="mono muted" style={{ textAlign: "center", fontSize: 12, marginTop: 12 }}>la séance démarre dans {remaining} s</p>
          </>
        ) : (
          <button type="button" className="btn volt wide" style={{ marginTop: 22 }} onClick={start}>
            <Icon name="play" size={18} /> Démarrer la séance
          </button>
        )}
      </main>
    );
  }

  // --- Pause ----------------------------------------------------------------
  if (!running) {
    return (
      <main className="screen bare">
        <Lanes centered />
        {header(false)}
        {progressDots(false)}
        <p className="label" style={{ margin: "20px 0 4px", opacity: 0.7 }}>En pause</p>
        <h1 className="display" style={{ fontSize: 28, lineHeight: 1.1, paddingRight: 30 }}>{current.name}</h1>
        <div style={{ position: "relative", width: 240, height: 240, margin: "20px auto 0" }}>
          <svg width="240" height="240" viewBox="0 0 240 240" aria-hidden="true">
            <circle cx="120" cy="120" r="104" fill="none" stroke="var(--soft)" strokeWidth="16" />
            <circle cx="120" cy="120" r="104" fill="none" stroke="#c9c8be" strokeWidth="16" strokeDasharray="5 5" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center" }}>
            <span className="display" style={{ fontSize: 60, lineHeight: 1, color: "var(--grey)" }}>{formatClock(remaining)}</span>
            <span className="muted" style={{ fontSize: 13, marginTop: 8 }}>timer figé</span>
          </div>
          <span className="stamp" style={{ position: "absolute", top: 4, right: -10 }} aria-hidden="true">止</span>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
          <button type="button" className="btn volt wide" onClick={toggle}><Icon name="play" size={16} /> Reprendre</button>
          <button type="button" className="btn wide" style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid var(--line)" }} onClick={() => jump(state.index, true)}>
            <Icon name="restart" size={18} /> Recommencer l&apos;étape
          </button>
          <button type="button" className="btn wide" style={{ background: "transparent", color: "var(--ink)", border: "1.5px solid var(--ink)" }} onClick={terminate}>
            <Icon name="stop" size={18} /> Terminer la séance
          </button>
        </div>
        <p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 14 }}>
          La séance sera enregistrée comme interrompue · {shownIndex}/{realCount} étapes
        </p>
      </main>
    );
  }

  const controls = (dark: boolean) => (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 30, marginTop: 24 }}>
      <button type="button" className="round" style={{ width: 60, height: 60, background: "var(--white)" }} onClick={() => jump(Math.max(offset, state.index - (state.stepElapsedMs < 2000 ? 1 : 0)))} aria-label="Étape précédente"><Icon name="prev" /></button>
      <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <button type="button" className={dark ? "round volt" : "round ink"} style={{ width: 84, height: 84, border: 0 }} onClick={toggle} aria-label="Pause">
          <Icon name="pause" size={30} strokeWidth={3} />
        </button>
        <span style={{ fontWeight: 900, fontSize: 13 }}>Pause</span>
      </div>
      <button type="button" className="round" style={{ width: 60, height: 60, background: "var(--white)" }} onClick={() => jump(state.index + 1)} aria-label="Étape suivante"><Icon name="next" /></button>
    </div>
  );

  // --- Repos : écran inversé ---------------------------------------------
  if (current.kind === "rest") {
    const left = state.stepRemainingMs / (current.durationSeconds * 1000);
    return (
      <main className="screen bare" style={{ background: "var(--ink)", color: "var(--white)", minHeight: "100dvh" }}>
        <Lanes centered dark />
        {header(true)}
        {progressDots(true)}
        <p className="label" style={{ margin: "20px 0 4px", color: "var(--volt)" }}>Repos</p>
        <h1 className="display" style={{ fontSize: 30 }}>Respire</h1>
        <div style={{ position: "relative", width: 260, height: 260, margin: "18px auto 0" }}>
          <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true">
            <circle cx="130" cy="130" r="112" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="14" />
            <circle cx="130" cy="130" r="112" fill="none" stroke="var(--volt)" strokeWidth="14" strokeDasharray={`${ring * left} ${ring}`} transform="rotate(-90 130 130)" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center" }}>
            <span className="display" style={{ fontSize: 66, lineHeight: 1 }}>{formatClock(remaining)}</span>
            <span style={{ fontSize: 13, marginTop: 8, opacity: 0.7 }}>secondes de repos</span>
          </div>
          {remaining <= 3 ? <span className="stamp" style={{ position: "absolute", top: -6, right: -16, width: 52, height: 52, fontSize: 28, background: "var(--volt)", color: "var(--ink)" }} aria-live="assertive">{remaining}</span> : null}
          <span className="display" aria-hidden="true" style={{ position: "absolute", right: -46, top: 84, writingMode: "vertical-rl", textOrientation: "upright", fontSize: 18, color: "var(--volt)" }}>ヤスミ</span>
        </div>
        {next ? (
          <div className="galet alt" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, padding: "12px 22px", color: "var(--ink)" }}>
            <span>
              <span className="muted" style={{ display: "block", fontSize: 12 }}>Ensuite</span>
              <span className="display" style={{ fontSize: 18 }}>{next.name}</span>
            </span>
            <span className="mono" style={{ fontSize: 18 }}>{formatClock(next.durationSeconds)}</span>
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10, marginTop: 12 }}>
          <button type="button" className="btn" style={{ background: "var(--white)", color: "var(--ink)", height: 52, borderRadius: 26 }} onClick={extend}>+ {EXTEND_SECONDS} s</button>
          <button type="button" className="btn volt" style={{ height: 52, borderRadius: 26, border: 0 }} onClick={() => jump(state.index + 1)}><Icon name="next" size={18} /> Passer le repos</button>
        </div>
        {controls(true)}
      </main>
    );
  }

  // --- Effort ----------------------------------------------------------------
  return (
    <main className="screen bare">
      <Lanes centered />
      {header(false)}
      {progressDots(false)}
      <p className="label" style={{ margin: "20px 0 4px", opacity: 0.7 }}>{current.kind === "warmup" ? "Échauffement" : "Exercice en cours"}</p>
      <h1 className="display" style={{ fontSize: 28, lineHeight: 1.1, paddingRight: 30 }}>{current.name}</h1>

      <div style={{ position: "relative", width: 260, height: 260, margin: "22px auto 0" }}>
        <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true">
          <circle cx="130" cy="130" r="112" fill="none" stroke="var(--soft)" strokeWidth="18" />
          <circle cx="130" cy="130" r="112" fill="none" stroke="var(--ink)" strokeWidth="20" strokeDasharray={`${ring * state.stepProgress} ${ring}`} transform="rotate(-90 130 130)" strokeLinecap="round" opacity={state.stepProgress > 0.02 ? 1 : 0} />
          <circle cx="130" cy="130" r="112" fill="none" stroke="var(--volt)" strokeWidth="16" strokeDasharray={`${ring * state.stepProgress} ${ring}`} transform="rotate(-90 130 130)" strokeLinecap="round" opacity={state.stepProgress > 0.02 ? 1 : 0} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center" }}>
          <span className="display" style={{ fontSize: 66, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{formatClock(remaining)}</span>
          <span className="muted" style={{ fontSize: 13, marginTop: 8 }}>secondes restantes</span>
        </div>
        {remaining <= 3 ? (
          <span className="stamp" style={{ position: "absolute", top: -6, right: -16, width: 52, height: 52, fontSize: 28, transform: "rotate(-8deg)" }} aria-live="assertive">{remaining}</span>
        ) : null}
        <span className="display" aria-hidden="true" style={{ position: "absolute", right: -46, top: 84, writingMode: "vertical-rl", textOrientation: "upright", fontSize: 20 }}>ガンバレ</span>
      </div>

      {current.muscles.length > 0 ? (
        <div className="galet" style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24, padding: "6px 18px" }}>
          <BodyMap view={bestView(current.muscles)} highlight={current.muscles} height={76} />
          <div style={{ flex: 1 }}>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>Muscles sollicités</p>
            <p style={{ margin: "2px 0 0", fontWeight: 900, fontSize: 16 }}>{current.muscles.map(muscleLabel).join(" · ")}</p>
          </div>
          {settings.voice ? <Icon name="speaker" size={18} /> : null}
        </div>
      ) : null}

      {next ? (
        <div className="galet ink alt" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, padding: "12px 22px" }}>
          <span>
            <span style={{ display: "block", fontSize: 12, color: "var(--volt)", opacity: 0.85 }}>Ensuite</span>
            <span className="display" style={{ fontSize: 18 }}>{next.name}</span>
          </span>
          <span className="mono" style={{ color: "var(--volt)", fontSize: 18 }}>{formatClock(next.durationSeconds)}</span>
        </div>
      ) : null}

      {controls(false)}
    </main>
  );
}
