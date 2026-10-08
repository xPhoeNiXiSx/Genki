"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { createMetronome, keepScreenAwake, unlockAudio, type Metronome as Engine } from "@/lib/audio";
import { DEFAULT_BPM, MAX_BPM, MIN_BPM, clampBpm } from "@/lib/metronome";

import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { TabBar } from "../ui/tab-bar";

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
  const fill = ((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100;

  return (
    <main className="screen">
      <Lanes centered />
      <p className="katakana" aria-hidden="true">リズム</p>
      <div className="top-bar">
        <Link href="/" className="round" aria-label="Retour à l'accueil"><Icon name="back" size={20} /></Link>
      </div>
      <h1 className="display" style={{ fontSize: 34, marginTop: 18 }}>Métronome</h1>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 15 }}>Cale ta foulée sur la cadence</p>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 22, height: 40, marginTop: 34 }} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => {
          const on = running ? i === beat : i === 0;
          return (
            <span key={i} style={{ width: on ? 26 : 16, height: on ? 26 : 16, borderRadius: "50%", background: on ? "var(--volt)" : "transparent", border: on ? "2px solid var(--ink)" : "1.5px solid rgba(26,26,29,.4)", transition: "all 80ms" }} />
          );
        })}
      </div>

      <p className="display" style={{ fontSize: 120, lineHeight: 1, textAlign: "center", marginTop: 10 }} aria-live="polite">{bpm}</p>
      <p className="mono muted" style={{ textAlign: "center", margin: "8px 0 0", fontSize: 13 }}>bpm · pas par minute</p>

      <div style={{ display: "flex", justifyContent: "center", gap: 50, marginTop: 24 }}>
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
        style={{ width: "100%", marginTop: 28, background: `linear-gradient(to right, var(--volt) ${fill}%, var(--soft) ${fill}%)` }}
      />
      <div className="mono muted" style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span>{MIN_BPM}</span>
        <span>{MAX_BPM}</span>
      </div>

      <p className="label" style={{ margin: "20px 0 10px", opacity: 0.7 }}>Préréglages</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
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

      <button type="button" className="btn volt wide" style={{ marginTop: 20, fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 20 }} onClick={toggle}>
        <Icon name={running ? "pause" : "play"} size={20} strokeWidth={3} /> {running ? "Arrêter" : "Lancer"}
      </button>

      <TabBar />
    </main>
  );
}
