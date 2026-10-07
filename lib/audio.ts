import { beatsUntil, clampBpm } from "@/lib/metronome";
import type { Cue } from "@/lib/session-engine";

/**
 * Sons de l'application, côté navigateur uniquement : signaux de séance,
 * décompte vocal et métronome. Tout est synthétisé (Web Audio et synthèse
 * vocale), aucun fichier son à charger : ça marche hors ligne.
 *
 * Contraintes iOS à garder en tête :
 *  - le son ne peut démarrer qu'à la suite d'un geste de l'utilisateur :
 *    appeler `unlockAudio()` dans le gestionnaire du bouton « Démarrer » ;
 *  - une PWA dont l'écran se verrouille est suspendue, sons compris :
 *    `keepScreenAwake()` empêche la mise en veille pendant une séance.
 */

let context: AudioContext | null = null;

type AudioSessionNavigator = Navigator & {
  audioSession?: { type: string };
};

function audio(): AudioContext {
  if (!context) {
    // « ambient » : les signaux se mêlent à la musique en cours au lieu de la
    // couper — on court avec ses écouteurs. Contrepartie : le bouton
    // silencieux de l'iPhone coupe ces sons sur le haut-parleur.
    const nav = navigator as AudioSessionNavigator;
    if (nav.audioSession) nav.audioSession.type = "ambient";
    context = new AudioContext();
  }
  return context;
}

/** À appeler dans un gestionnaire de clic, avant tout son. */
export async function unlockAudio(): Promise<void> {
  const ctx = audio();
  if (ctx.state !== "running") await ctx.resume();
  // iOS ne libère vraiment la sortie qu'après un premier son, même muet.
  const silence = ctx.createBufferSource();
  silence.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  silence.connect(ctx.destination);
  silence.start();
}

/** Un bip bref, à l'instant `at` de l'horloge audio (maintenant par défaut). */
function beep(frequency: number, durationS: number, at?: number, volume = 0.6): void {
  const ctx = audio();
  const start = at ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  // Attaque et chute rapides : un clic net, sans craquement.
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationS);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + durationS + 0.02);
}

const COUNT_WORDS = { 3: "trois", 2: "deux", 1: "un" } as const;

let frenchVoice: SpeechSynthesisVoice | null | undefined;

function voice(): SpeechSynthesisVoice | null {
  if (frenchVoice === undefined && "speechSynthesis" in window) {
    const voices = speechSynthesis.getVoices();
    // La liste peut arriver vide au premier appel : on réessaiera.
    if (voices.length > 0) frenchVoice = voices.find((v) => v.lang.startsWith("fr")) ?? null;
  }
  return frenchVoice ?? null;
}

/** Dit un texte en français. Renvoie `false` si la synthèse vocale manque. */
export function speak(text: string): boolean {
  if (!("speechSynthesis" in window)) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 1.1;
  const v = voice();
  if (v) utterance.voice = v;
  // Un mot en retard ne doit pas décaler le suivant.
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
  return true;
}

/**
 * Joue un signal de séance. `stepName` permet d'annoncer l'étape qui démarre
 * (« Squat »), en plus du bip.
 */
export function playCue(cue: Cue, options: { voice: boolean; stepName?: string } = { voice: true }): void {
  switch (cue.kind) {
    case "count":
      if (!options.voice || !speak(COUNT_WORDS[cue.value])) beep(880, 0.12);
      break;
    case "step":
      beep(1320, 0.35, undefined, 0.8);
      if (options.voice && options.stepName) {
        // Laisse le bip se terminer avant d'annoncer l'étape.
        setTimeout(() => speak(options.stepName as string), 400);
      }
      break;
    case "end": {
      const now = audio().currentTime;
      [0, 0.18, 0.36].forEach((offset) => beep(1320, 0.3, now + offset, 0.8));
      if (options.voice) setTimeout(() => speak("Séance terminée"), 900);
      break;
    }
  }
}

/* -------------------------------------------------------------------------
   Métronome
   ------------------------------------------------------------------------- */

/** Fréquence du programmateur et avance prise sur l'horloge audio. */
const TICK_MS = 25;
const LOOKAHEAD_S = 0.12;

export type Metronome = {
  start: (bpm: number) => void;
  setBpm: (bpm: number) => void;
  stop: () => void;
  readonly running: boolean;
};

export function createMetronome(): Metronome {
  let timer: ReturnType<typeof setInterval> | null = null;
  let bpm = 180;
  let nextBeat = 0;

  function schedule() {
    const ctx = audio();
    const planned = beatsUntil(nextBeat, ctx.currentTime + LOOKAHEAD_S, bpm);
    for (const at of planned.times) beep(1000, 0.05, at);
    nextBeat = planned.nextBeat;
  }

  return {
    start(value) {
      bpm = clampBpm(value);
      if (timer) return;
      nextBeat = audio().currentTime + 0.05;
      schedule();
      timer = setInterval(schedule, TICK_MS);
    },
    setBpm(value) {
      bpm = clampBpm(value);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    get running() {
      return timer !== null;
    },
  };
}

/* -------------------------------------------------------------------------
   Écran allumé pendant la séance
   ------------------------------------------------------------------------- */

/**
 * Empêche la mise en veille de l'écran. Renvoie de quoi relâcher. Sans effet
 * (et sans erreur) là où le navigateur ne le permet pas. Le verrou tombe de
 * lui-même quand la page passe en arrière-plan : on le reprend au retour.
 */
export function keepScreenAwake(): () => void {
  let sentinel: WakeLockSentinel | null = null;
  let released = false;

  async function acquire() {
    if (released || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
    } catch {
      sentinel = null;
    }
  }

  const onVisible = () => void acquire();
  document.addEventListener("visibilitychange", onVisible);
  void acquire();

  return () => {
    released = true;
    document.removeEventListener("visibilitychange", onVisible);
    void sentinel?.release();
  };
}
