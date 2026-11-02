import type { PlanSession } from "@/lib/plan";

const MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];

/** « 30 nov », depuis une date ISO. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** « 1 h 24 » ou « 45 min ». */
export function hoursMinutes(seconds: number): string {
  const total = Math.round(seconds / 60);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** « 11,8 km ». */
export function km(meters: number): string {
  return `${String(Math.round(meters / 100) / 10).replace(".", ",")} km`;
}

/** Ce qui a été réalisé, en une ligne : « 6,6 km · 45 min · +120 m · ressenti 4/5 ». */
export function planLine(s: PlanSession): string {
  return [
    s.actualMeters ? km(s.actualMeters) : null,
    s.actualSeconds ? hoursMinutes(s.actualSeconds) : null,
    s.actualClimb ? `+${s.actualClimb} m` : null,
    s.feeling ? `ressenti ${s.feeling}/5` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "faite";
}
