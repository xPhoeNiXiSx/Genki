import { TIME_ZONE } from "@/lib/workouts";

/** Aujourd'hui à Paris, « AAAA-MM-JJ ». */
export function parisToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/** « MAR. 07/10 », pour les bandeaux de dossard. */
export function bibDate(date: Date): string {
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, weekday: "short" }).format(date);
  const dm = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" }).format(date);
  return `${day.replace(".", "").toUpperCase()}. ${dm}`;
}

/** Jour de la semaine court et date : « MAR » et « 06/10 ». */
export function dayAndDate(date: Date): [string, string] {
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, weekday: "short" }).format(date);
  const dm = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" }).format(date);
  return [day.replace(".", "").toUpperCase(), dm];
}

/** « AUJOURD'HUI », « HIER », « IL Y A 5 J », « JAMAIS FAIT ». */
export function sinceLabel(date: Date | null, now = new Date()): string {
  if (!date) return "JAMAIS FAIT";
  const days = Math.round((Date.parse(parisToday(now)) - Date.parse(parisToday(date))) / 86_400_000);
  if (days <= 0) return "AUJOURD'HUI";
  if (days === 1) return "HIER";
  return `IL Y A ${days} J`;
}
