import type { Activity } from "@/lib/activities";
import { saveActivities } from "@/lib/activities";
import { query } from "@/lib/db";

/**
 * intervals.icu : site d'entraînement gratuit, relié directement à Garmin
 * Connect. Il donne une clé d'accès personnelle (Settings → Developer
 * Settings) : pas d'application à déclarer, pas d'abonnement.
 *
 * La clé est enregistrée en base et ne quitte jamais le serveur.
 */

const API = "https://intervals.icu/api/v1";

export type IntervalsConnection = {
  athleteId: string;
  athleteName: string | null;
  connectedAt: Date;
  lastSyncAt: Date | null;
};

function authHeader(key: string): string {
  return `Basic ${Buffer.from(`API_KEY:${key}`).toString("base64")}`;
}

/** « i123456 », ou « 0 » pour « l'athlète de cette clé ». */
const ATHLETE_ID = /^(i?\d{1,12}|0)$/;

export async function getIntervalsConnection(): Promise<IntervalsConnection | null> {
  const rows = await query<{ athlete_id: string | null; athlete_name: string | null; connected_at: string | Date; last_sync_at: string | Date | null }>(
    `select athlete_id, athlete_name, connected_at, last_sync_at from integrations where provider = 'intervals'`,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    athleteId: row.athlete_id ?? "0",
    athleteName: row.athlete_name,
    connectedAt: new Date(row.connected_at),
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
  };
}

/** Vérifie la clé auprès d'intervals.icu, puis l'enregistre. */
export async function connectIntervals(rawAthlete: unknown, rawKey: unknown): Promise<{ ok: true } | { error: string }> {
  const athleteId = (typeof rawAthlete === "string" ? rawAthlete.trim() : "") || "0";
  const key = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!ATHLETE_ID.test(athleteId)) return { error: "L'ID athlète ressemble à « i123456 »." };
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) return { error: "Clé API illisible : copie-la telle quelle depuis intervals.icu." };

  let name: string | null = null;
  let id = athleteId;
  try {
    const response = await fetch(`${API}/athlete/${athleteId}`, { headers: { Authorization: authHeader(key) }, cache: "no-store" });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return { error: "intervals.icu refuse cette clé ou cet ID athlète." };
    }
    if (!response.ok) return { error: `intervals.icu ne répond pas (${response.status}). Réessaie.` };
    const athlete = (await response.json()) as { id?: string; name?: string };
    name = athlete.name ?? null;
    if (athlete.id) id = athlete.id;
  } catch {
    return { error: "intervals.icu est injoignable. Réessaie dans un moment." };
  }

  // La table des comptes reliés attend un jeton de renouvellement et une
  // expiration : une clé d'intervals.icu n'en a pas.
  await query(
    `insert into integrations (provider, athlete_id, athlete_name, access_token, refresh_token, expires_at, connected_at)
     values ('intervals', $1, $2, $3, '', 'infinity', now())
     on conflict (provider) do update
       set athlete_id = excluded.athlete_id, athlete_name = excluded.athlete_name,
           access_token = excluded.access_token, connected_at = now(), last_sync_at = null`,
    [id, name, key],
  );
  return { ok: true };
}

/** Oublie la clé. Les sorties déjà importées restent. */
export async function disconnectIntervals(): Promise<void> {
  await query(`delete from integrations where provider = 'intervals'`);
}

/** Ce qu'intervals.icu renvoie d'une activité, pour ce qui nous sert. */
export type IntervalsActivity = {
  id: string | number;
  name?: string | null;
  type?: string | null;
  source?: string | null;
  start_date?: string | null;
  start_date_local?: string | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  distance?: number | null;
  total_elevation_gain?: number | null;
};

/**
 * Traduit une activité d'intervals.icu. Celles venues de Strava n'y sont
 * que des coquilles vides (Strava interdit de les relayer) : on les écarte.
 */
export function fromIntervals(a: IntervalsActivity): Activity | null {
  if (a.source === "STRAVA" || !a.type || !(a.start_date_local || a.start_date)) return null;
  const local = a.start_date_local ?? a.start_date!;
  return {
    id: `intervals:${a.id}`,
    source: "intervals",
    name: a.name?.slice(0, 200) || "Activité",
    sportType: a.type,
    startDate: new Date(a.start_date ?? `${local}Z`),
    localDate: local.slice(0, 10),
    movingSeconds: Math.max(0, Math.round(a.moving_time ?? 0)),
    elapsedSeconds: Math.max(0, Math.round(a.elapsed_time ?? 0)),
    distanceMeters: Math.max(0, Math.round(a.distance ?? 0)),
    climbMeters: Math.max(0, Math.round(a.total_elevation_gain ?? 0)),
  };
}

export type SyncResult = { imported: number; checked: number };

/**
 * Importe les sorties depuis la dernière synchro (ou depuis `since`), puis
 * les reporte sur le plan.
 */
export async function syncIntervals(since: string, matchToPlan: (activities: Activity[]) => Promise<number>): Promise<SyncResult> {
  const rows = await query<{ athlete_id: string | null; access_token: string; last_sync_at: string | Date | null }>(
    `select athlete_id, access_token, last_sync_at from integrations where provider = 'intervals'`,
  );
  const conn = rows[0];
  if (!conn) throw new Error("intervals.icu n'est pas relié.");

  // Deux jours de marge rattrapent une sortie arrivée en retard de la montre.
  const last = conn.last_sync_at ? new Date(new Date(conn.last_sync_at).getTime() - 2 * 86_400_000).toISOString().slice(0, 10) : since;
  const oldest = last > since ? last : since;
  const newest = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const response = await fetch(`${API}/athlete/${conn.athlete_id ?? "0"}/activities?oldest=${oldest}&newest=${newest}`, {
    headers: { Authorization: authHeader(conn.access_token) },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`intervals.icu ne répond pas (${response.status}).`);
  const list = ((await response.json()) as IntervalsActivity[]).map(fromIntervals).filter((a): a is Activity => a !== null);

  const fresh = await saveActivities(list);
  const checked = await matchToPlan(fresh);
  await query(`update integrations set last_sync_at = now() where provider = 'intervals'`);
  return { imported: fresh.length, checked };
}
