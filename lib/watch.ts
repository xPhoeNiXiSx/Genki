import type { PlanBlock } from "@/lib/plan-data";

/**
 * Traduit une séance de course du plan en entraînement structuré au format
 * texte d'intervals.icu (« Workout Builder »), que la montre suit étape par
 * étape. Les allures sont absolues (min/km), seules comprises à coup sûr
 * par Garmin.
 *
 * Rappels du format : `m` = minutes, `s` = secondes, `km` = distance ;
 * une ligne de titre terminée par `3x` répète les étapes qui suivent.
 */

type Pace = { slow: number; fast: number };

const pace = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const target = (p: Pace | null) => (p ? ` ${pace(p.slow)}-${pace(p.fast)}/km Pace` : "");

function time(seconds: number): string {
  const s = Math.max(5, Math.round(seconds / 5) * 5);
  if (s % 60 === 0) return `${s / 60}m`;
  return s > 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`;
}

const toSeconds = (clock: string) => {
  const [m, s] = clock.split(":").map(Number);
  return m * 60 + s;
};

/** Durée d'un bloc : « 49′ », « 1 h 15 », « 1 h » ; ou distance « 10 km ». */
export function blockLength(duration: string): { seconds: number } | { km: number } | null {
  const km = duration.match(/^([\d,.]+)\s*km$/);
  if (km) return { km: Number(km[1].replace(",", ".")) };
  const hours = duration.match(/^(\d+)\s*h(?:\s*(\d+))?$/);
  if (hours) return { seconds: (Number(hours[1]) * 60 + Number(hours[2] ?? 0)) * 60 };
  const minutes = duration.match(/^(\d+)\s*′$/);
  if (minutes) return { seconds: Number(minutes[1]) * 60 };
  return null;
}

/** Allure lue dans le détail : « 6:45–7:15 /km », « vers 5:45 /km », « 7:15 /km et plus ». */
function paceIn(detail: string): Pace | null {
  const range = detail.match(/(\d:\d\d)\s*[–-]\s*(\d:\d\d)\s*\/km/);
  if (range) {
    const [a, b] = [toSeconds(range[1]), toSeconds(range[2])];
    return { slow: Math.max(a, b), fast: Math.min(a, b) };
  }
  const plus = detail.match(/(\d:\d\d)\s*\/km et plus/);
  if (plus) return { slow: toSeconds(plus[1]) + 30, fast: toSeconds(plus[1]) };
  const one = detail.match(/(\d:\d\d)\s*\/km/);
  if (one) return { slow: toSeconds(one[1]) + 5, fast: toSeconds(one[1]) - 5 };
  return null;
}

const EASY: Pace = { slow: 435, fast: 405 }; // 7:15–6:45
const VERY_EASY: Pace = { slow: 465, fast: 435 }; // 7:45–7:15
const FARTLEK: Pace = { slow: 360, fast: 340 }; // 6:00–5:40

/** Allure par défaut d'un bloc sans allure écrite. */
function defaultPace(b: PlanBlock): Pace | null {
  if (/échauffement|mise en route|retour au calme/i.test(b.label) || /très facile/i.test(b.detail)) return VERY_EASY;
  if (/endurance|footing/i.test(`${b.label} ${b.detail}`)) return EASY;
  return null;
}

/** « 30 s », « 1 min », « 1 min 30 », « 8 min » ; « 80 m » en distance. */
function effort(text: string): { seconds: number } | { km: number } | null {
  const m = text.match(/^(\d+)\s*min(?:\s*(\d+))?/);
  if (m) return { seconds: Number(m[1]) * 60 + Number(m[2] ?? 0) };
  const s = text.match(/^(\d+)\s*s\b/);
  if (s) return { seconds: Number(s[1]) };
  const d = text.match(/^(\d+)\s*m\b/);
  if (d) return { km: Number(d[1]) / 1000 };
  return null;
}

const length = (l: { seconds: number } | { km: number }) => ("km" in l ? `${Number(l.km.toFixed(2))}km` : time(l.seconds));

/** Un bloc → une ou plusieurs lignes du format intervals.icu. */
function blockText(b: PlanBlock): string {
  const total = blockLength(b.duration);
  const reps = b.detail.match(/^(\d+)\s*×\s*\(?\s*(.+)$/);
  const work = reps ? effort(reps[2]) : null;
  if (reps && work && total && "seconds" in total) {
    const count = Number(reps[1]);
    const after = reps[2];
    const explicit = after.match(/récup\s+(\d+\s*min(?:\s*\d+)?|\d+\s*s)/) ?? after.match(/,\s*(\d+\s*min(?:\s*\d+)?|\d+\s*s)\s+\w*\s*lente/);
    const workSeconds = "seconds" in work ? work.seconds : 25;
    const restLength = explicit ? effort(explicit[1]) : null;
    const rest = restLength && "seconds" in restLength ? restLength.seconds : Math.max(30, (total.seconds - count * workSeconds) / count);
    const hill = /côte|montée/i.test(`${b.label} ${b.detail}`);
    const workPace = paceIn(b.detail) ?? (/fartlek/i.test(b.label) ? FARTLEK : null);
    const workCue = hill ? "Montée" : /lignes droites/i.test(b.label) ? "Accélère" : "Effort";
    const restCue = hill ? "Redescends au trot" : "Récup";
    return [`${b.label} ${count}x`, `- ${workCue} ${length(work)}${target(workPace)}`, `- ${restCue} ${time(rest)}`].join("\n");
  }
  if (!total) return `- ${b.label} 5m`;
  return `- ${b.label} ${length(total)}${target(paceIn(b.detail) ?? defaultPace(b))}`;
}

/** Texte complet de l'entraînement : un paragraphe par bloc. */
export function workoutText(blocks: PlanBlock[]): string {
  return blocks.map(blockText).join("\n\n");
}
