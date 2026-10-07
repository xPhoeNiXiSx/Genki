/**
 * Durées : toujours en secondes entières, de la base jusqu'au moteur de
 * séance. Ce module ne fait que traduire depuis et vers ce qu'on tape et ce
 * qu'on lit.
 */

/** Plafond d'une étape : au-delà, c'est une faute de frappe. */
export const MAX_STEP_SECONDS = 3 * 60 * 60;

/**
 * Lit « 45 », « 1:30 », « 1 min 30 », « 2 min », « 90 s ». Renvoie `null` si
 * la saisie n'est pas une durée strictement positive.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (text === "") return null;

  let seconds: number | null = null;

  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(text);
  const words = /^(?:(\d{1,3}) ?(?:min|mn|m)\.?)? ?(?:(\d{1,4}) ?(?:s|sec|secondes?)?\.?)?$/.exec(
    text,
  );

  if (clock) {
    seconds = Number(clock[1]) * 60 + Number(clock[2]);
  } else if (words && (words[1] || words[2])) {
    seconds = Number(words[1] ?? 0) * 60 + Number(words[2] ?? 0);
  }

  if (seconds === null || seconds <= 0) return null;
  return seconds;
}

/** 45 → « 0:45 », 754 → « 12:34 », 3725 → « 1:02:05 ». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = String(s % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** Pour un résumé : 45 → « 45 s », 720 → « 12 min », 11400 → « 3 h 10 ». */
export function formatLength(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}
