"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createMetronome, keepScreenAwake, unlockAudio, type Metronome as Engine } from "@/lib/audio";
import { DEFAULT_BPM, MAX_BPM, MIN_BPM, clampBpm } from "@/lib/metronome";

import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";

const PRESETS = [160, 170, 180, 190];

export function Metronome() {
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);
  const engine = useRef<Engine | null>(null);
  const release = useRef<(() => void) | null>(null);

  // Le tempo change en marche : le moteur suit, les pastilles aussi.
  useEffect(() => {
    engine.current?.setBpm(bpm);
    if (!running) return;
    const timer = setInterval(() => setBeat((b) => (b + 1) % 4), 60_000 / bpm);
    return () => clearInterval(timer);
  }, [bpm, running]);

  // Arrêt propre en quittant l'écran.
  useEffect(() => () => {
    engine.current?.stop();
    release.current?.();
  }, []);

  async function toggle() {
    if (running) {
      engine.current?.stop();
      release.current?.();
      release.current = null;
      setRunning(false);
      return;
    }
    await unlockAudio();
    engine.current ??= createMetronome();
    engine.current.start(bpm);
    release.current = keepScreenAwake();
    setBeat(0);
    setRunning(true);
  }

  const change = (value: number) => setBpm(clampBpm(value));

  // Modale : on revient à l'écran d'où l'on vient, ou à l'accueil si la page
  // a été ouverte directement.
  const router = useRouter();
  const close = () => (window.history.length > 1 ? router.back() : router.push("/"));
  const fill = ((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100;

  return (
    <main className="screen bare" style={{ height: "100dvh", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Lanes centered />
      <p className="katakana under-button" aria-hidden="true">リズム</p>
      <div className="top-bar" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="round" onClick={close} aria-label="Fermer le métronome"><Icon name="close" size={18} /></button>
      </div>
      <h1 className="display" style={{ fontSize: 34, marginTop: 18 }}>Métronome</h1>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 15 }}>Cale ta foulée sur la cadence</p>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 22, height: 40, flex: "none", marginTop: "clamp(8px, 3dvh, 34px)" }} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => {
          const on = running ? i === beat : i === 0;
          return (
            <span key={i} style={{ width: on ? 26 : 16, height: on ? 26 : 16, borderRadius: "50%", background: on ? "var(--volt)" : "transparent", border: on ? "2px solid var(--ink)" : "1.5px solid rgba(26,26,29,.4)", transition: "all 80ms" }} />
          );
        })}
      </div>

      <p className="display" style={{ fontSize: "clamp(84px, 15dvh, 120px)", lineHeight: 1, textAlign: "center", marginTop: 10 }} aria-live="polite">{bpm}</p>
      <p className="mono muted" style={{ textAlign: "center", margin: "8px 0 0", fontSize: 13 }}>bpm · pas par minute</p>

      <div style={{ display: "flex", justifyContent: "center", gap: 50, marginTop: "clamp(12px, 2.5dvh, 24px)" }}>
        <button type="button" className="round" style={{ width: 64, height: 64 }} onClick={() => change(bpm - 1)} aria-label="Ralentir d'un battement"><Icon name="minus" size={24} /></button>
        <button type="button" className="round" style={{ width: 64, height: 64 }} onClick={() => change(bpm + 1)} aria-label="Accélérer d'un battement"><Icon name="plus" size={24} /></button>
      </div>

      <input
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        onChange={(e) => change(Number(e.target.value))}
        aria-label="Tempo"
        className="tempo"
        style={{ width: "100%", flex: "none", marginTop: "clamp(14px, 3dvh, 28px)", background: `linear-gradient(to right, var(--volt) ${fill}%, var(--soft) ${fill}%)` }}
      />
      <div className="mono muted" style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span>{MIN_BPM}</span>
        <span>{MAX_BPM}</span>
      </div>

      <p className="label" style={{ margin: "clamp(12px, 2.5dvh, 20px) 0 10px", opacity: 0.7 }}>Préréglages</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 20 }}>
        {PRESETS.map((v, i) => (
          <button
            key={v}
            type="button"
            onClick={() => change(v)}
            className="mono"
            style={{ height: 46, borderRadius: i % 2 ? "8px 22px 8px 22px" : "22px 8px 22px 8px", border: v === bpm ? "0" : "1px solid rgba(26,26,29,.15)", background: v === bpm ? "var(--ink)" : "var(--white)", color: v === bpm ? "var(--volt)" : "var(--ink)", fontSize: 16, fontWeight: 500, cursor: "pointer" }}
          >
            {v}
          </button>
        ))}
      </div>

      <button type="button" className="btn volt wide" style={{ marginTop: "auto", flex: "none", fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 20 }} onClick={toggle}>
        <Icon name={running ? "pause" : "play"} size={20} strokeWidth={3} /> {running ? "Arrêter" : "Lancer"}
      </button>
    </main>
  );
}
