"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { bestView } from "@/lib/anatomy";
import { keepScreenAwake, playCue, unlockAudio } from "@/lib/audio";
import { formatClock } from "@/lib/duration";
import { muscleLabel } from "@/lib/muscles";
import type { Program } from "@/lib/programs";
import { cuesBetween, elapsed, newClock, pause, play, seek, stateAt, stepStartMs, type SessionClock } from "@/lib/session-engine";

import { BodyMap } from "../../ui/body-map";
import { Icon } from "../../ui/icons";
import { Lanes } from "../../ui/lanes";
import { saveWorkoutAction } from "../actions";

/** Durée minimale pour qu'une séance interrompue soit enregistrée. */
const MIN_RECORDED_MS = 10_000;

export function SessionPlayer({ program }: { program: Program }) {
  const router = useRouter();
  const steps = program.steps;
  const [clock, setClock] = useState<SessionClock>(newClock);
  const [now, setNow] = useState(0);
  const [started, setStarted] = useState(false);
  const startedAt = useRef<Date | null>(null);
  const lastMs = useRef(-1);
  const saved = useRef(false);
  const release = useRef<(() => void) | null>(null);

  const ms = elapsed(clock, now);
  const state = stateAt(steps, ms);
  const running = clock.runningSince !== null;
  const step = steps[Math.min(state.index, steps.length - 1)];
  const next = steps[state.index + 1];

  // Rafraîchissement : l'état est recalculé du temps écoulé, les signaux sont
  // joués une seule fois chacun, même après une mise en veille.
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      const t = performance.now();
      const current = elapsed(clock, t);
      for (const cue of cuesBetween(steps, lastMs.current, current)) {
        const name = cue.kind === "step" ? steps[cue.index]?.name : undefined;
        playCue(cue, { voice: true, stepName: name });
      }
      lastMs.current = current;
      setNow(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, clock, steps]);

  async function save(completed: boolean, durationMs: number) {
    if (saved.current || !startedAt.current || durationMs < MIN_RECORDED_MS) return;
    saved.current = true;
    await saveWorkoutAction({
      programId: program.id,
      programName: program.name,
      startedAt: startedAt.current.toISOString(),
      durationSeconds: Math.round(durationMs / 1000),
      completed,
    });
  }

  // Fin de séance : on enregistre, on relâche l'écran.
  useEffect(() => {
    if (!state.finished || !started) return;
    release.current?.();
    void save(true, state.totalMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.finished, started]);

  useEffect(() => () => release.current?.(), []);

  async function toggle() {
    const t = performance.now();
    if (!started) {
      await unlockAudio();
      startedAt.current = new Date();
      release.current = keepScreenAwake();
      setStarted(true);
    }
    setNow(t);
    setClock((c) => (c.runningSince === null ? play(c, t) : pause(c, t)));
  }

  function jump(index: number) {
    const t = performance.now();
    const target = stepStartMs(steps, index);
    // Le signal de l'étape visée sera joué par le prochain rafraîchissement.
    lastMs.current = target - 1;
    setNow(t);
    setClock((c) => seek(c, t, target));
  }

  async function close() {
    release.current?.();
    if (started && !state.finished) await save(false, ms);
    router.push("/");
  }

  if (state.finished) {
    return (
      <main className="screen bare" style={{ display: "grid", alignContent: "center", textAlign: "center", gap: 12 }}>
        <Lanes centered />
        <p className="katakana" aria-hidden="true">オツカレ</p>
        <p className="label" style={{ margin: 0 }}>Séance terminée</p>
        <h1 className="display" style={{ fontSize: 34 }}>{program.name}</h1>
        <p className="mono muted" style={{ margin: 0 }}>{formatClock(state.totalMs / 1000)} · {steps.length} étapes</p>
        <Link href="/suivi" className="btn" style={{ justifySelf: "center", marginTop: 20 }}>Voir le suivi</Link>
      </main>
    );
  }

  const remaining = Math.ceil(state.stepRemainingMs / 1000);
  const ring = 2 * Math.PI * 112;

  return (
    <main className="screen bare">
      <Lanes centered />
      <div className="top-bar">
        <button type="button" className="round" onClick={close} aria-label="Quitter la séance"><Icon name="close" size={18} /></button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{program.name}</span>
        <span className="mono" style={{ fontSize: 12, border: "1.5px solid var(--ink)", borderRadius: 14, padding: "5px 12px" }}>
          {state.index + 1} / {steps.length}
        </span>
      </div>

      <div style={{ display: "flex", gap: 4, marginTop: 18 }} aria-hidden="true">
        {steps.map((_, i) => (
          <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < state.index ? "var(--ink)" : i === state.index ? "var(--volt)" : "var(--soft)", border: i === state.index ? "1px solid var(--ink)" : undefined }} />
        ))}
      </div>

      <p className="label" style={{ margin: "20px 0 4px", opacity: 0.7 }}>{step.exerciseId ? "Exercice en cours" : "Étape en cours"}</p>
      <h1 className="display" style={{ fontSize: 28, lineHeight: 1.1, paddingRight: 30 }}>{step.name}</h1>

      <div style={{ position: "relative", width: 260, height: 260, margin: "22px auto 0" }}>
        <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true">
          <circle cx="130" cy="130" r="112" fill="none" stroke="var(--soft)" strokeWidth="18" />
          <circle cx="130" cy="130" r="112" fill="none" stroke="var(--ink)" strokeWidth="20" strokeDasharray={`${ring * state.stepProgress} ${ring}`} transform="rotate(-90 130 130)" strokeLinecap="round" opacity={state.stepProgress > 0 ? 1 : 0} />
          <circle cx="130" cy="130" r="112" fill="none" stroke="var(--volt)" strokeWidth="16" strokeDasharray={`${ring * state.stepProgress} ${ring}`} transform="rotate(-90 130 130)" strokeLinecap="round" opacity={state.stepProgress > 0 ? 1 : 0} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center" }}>
          <span className="display" style={{ fontSize: 66, lineHeight: 1, fontVariantNumeric: "tabular-nums" }} aria-live="off">{formatClock(remaining)}</span>
          <span className="muted" style={{ fontSize: 13, marginTop: 8 }}>secondes restantes</span>
        </div>
        {running && remaining <= 3 ? (
          <span className="stamp" style={{ position: "absolute", top: -6, right: -16, width: 52, height: 52, fontSize: 28, transform: "rotate(-8deg)" }} aria-live="assertive">{remaining}</span>
        ) : null}
        <span className="display" aria-hidden="true" style={{ position: "absolute", right: -46, top: 84, writingMode: "vertical-rl", textOrientation: "upright", fontSize: 20 }}>ガンバレ</span>
      </div>

      {step.muscles.length > 0 ? (
        <div className="galet" style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24, padding: "6px 18px" }}>
          <BodyMap view={bestView(step.muscles)} highlight={step.muscles} height={76} />
          <div style={{ flex: 1 }}>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>Muscles sollicités</p>
            <p style={{ margin: "2px 0 0", fontWeight: 900, fontSize: 16 }}>{step.muscles.map(muscleLabel).join(" · ")}</p>
          </div>
          <Icon name="speaker" size={18} />
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

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 30, marginTop: 24 }}>
        <button type="button" className="round" style={{ width: 60, height: 60 }} onClick={() => jump(Math.max(0, state.index - (state.stepElapsedMs < 2000 ? 1 : 0)))} aria-label="Étape précédente" disabled={!started}><Icon name="prev" /></button>
        <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <button type="button" className="round ink" style={{ width: 84, height: 84 }} onClick={toggle} aria-label={running ? "Pause" : started ? "Reprendre" : "Démarrer"}>
            <Icon name={running ? "pause" : "play"} size={30} strokeWidth={3} />
          </button>
          <span style={{ fontWeight: 900, fontSize: 13 }}>{running ? "Pause" : started ? "Reprendre" : "Démarrer"}</span>
        </div>
        <button type="button" className="round" style={{ width: 60, height: 60 }} onClick={() => jump(state.index + 1)} aria-label="Étape suivante" disabled={!started}><Icon name="next" /></button>
      </div>
    </main>
  );
}
