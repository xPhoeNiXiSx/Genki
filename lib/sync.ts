import { getIntervalsConnection, syncIntervals } from "@/lib/intervals";
import { matchActivities } from "@/lib/plan";
import { PLAN_START } from "@/lib/plan-data";
import { addDays } from "@/lib/stats";

/** La page Sorties remonte jusqu'à 26 semaines : on importe au moins depuis là. */
export const IMPORTED_WEEKS = 26;

export function importSince(today: string): string {
  const back = addDays(today, -7 * IMPORTED_WEEKS);
  return back < PLAN_START ? back : PLAN_START;
}

/**
 * Synchronise intervals.icu au plus toutes les 30 min, à l'ouverture d'une
 * page. Jamais bloquant : au-delà de 6 s, la page s'affiche sans attendre.
 */
export async function syncIfStale(today: string): Promise<void> {
  const connection = await getIntervalsConnection().catch(() => null);
  if (!connection) return;
  if (connection.lastSyncAt && Date.now() - connection.lastSyncAt.getTime() < 30 * 60_000) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 6000));
  await Promise.race([syncIntervals(importSince(today), matchActivities).catch(() => undefined), timeout]);
}
