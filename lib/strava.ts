import { query } from "@/lib/db";
import { safeEquals, signPayload } from "@/lib/session";

/**
 * Strava : connexion OAuth, puis import des activités. Garmin passe par là
 * aussi : une montre Garmin synchronisée avec Strava y envoie ses sorties.
 *
 * Il faut une application Strava (strava.com/settings/api) et, côté Vercel,
 * STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET.
 */

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";

/** Le lien de connexion reste valable dix minutes. */
const STATE_MAX_AGE_MS = 10 * 60_000;

export function isStravaConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

export type StravaConnection = {
  athleteName: string | null;
  connectedAt: Date;
  lastSyncAt: Date | null;
};

type TokenRow = { access_token: string; refresh_token: string; expires_at: string | Date };

/**
 * Le retour de Strava arrive parfois hors de l'appli installée, donc sans
 * cookie de session : c'est cet état signé qui prouve que la connexion a été
 * demandée depuis Genki.
 */
export async function newState(now = Date.now()): Promise<string> {
  const issued = String(now);
  return `${issued}.${await signPayload(`strava:${issued}`)}`;
}

export async function verifyState(state: string | null, now = Date.now()): Promise<boolean> {
  if (!state) return false;
  const [issued, signature] = state.split(".");
  if (!issued || !signature) return false;
  try {
    if (!safeEquals(signature, await signPayload(`strava:${issued}`))) return false;
  } catch {
    return false;
  }
  const age = now - Number(issued);
  return Number.isFinite(age) && age >= 0 && age < STATE_MAX_AGE_MS;
}

export function authorizeUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID ?? "",
    redirect_uri: `${origin}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Strava a refusé la connexion (${response.status}).`);
  return (await response.json()) as TokenResponse;
}

/** Échange le code reçu au retour de Strava et enregistre la connexion. */
export async function connectStrava(code: string): Promise<void> {
  const token = await tokenRequest({ code, grant_type: "authorization_code" });
  const name = [token.athlete?.firstname, token.athlete?.lastname].filter(Boolean).join(" ") || null;
  await query(
    `insert into integrations (provider, athlete_id, athlete_name, access_token, refresh_token, expires_at, connected_at)
     values ('strava', $1, $2, $3, $4, to_timestamp($5), now())
     on conflict (provider) do update
       set athlete_id = excluded.athlete_id, athlete_name = excluded.athlete_name,
           access_token = excluded.access_token, refresh_token = excluded.refresh_token,
           expires_at = excluded.expires_at, connected_at = now()`,
    [token.athlete ? String(token.athlete.id) : null, name, token.access_token, token.refresh_token, token.expires_at],
  );
}

export async function getStravaConnection(): Promise<StravaConnection | null> {
  const rows = await query<{ athlete_name: string | null; connected_at: string | Date; last_sync_at: string | Date | null }>(
    `select athlete_name, connected_at, last_sync_at from integrations where provider = 'strava'`,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    athleteName: row.athlete_name,
    connectedAt: new Date(row.connected_at),
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
  };
}

/** Oublie la connexion. Les activités déjà importées restent. */
export async function disconnectStrava(): Promise<void> {
  const rows = await query<{ access_token: string }>(`delete from integrations where provider = 'strava' returning access_token`);
  const token = rows[0]?.access_token;
  if (token) {
    // Révocation côté Strava : au mieux, sans bloquer la déconnexion locale.
    await fetch("https://www.strava.com/oauth/deauthorize", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
}

/** Jeton valable, renouvelé s'il expire dans moins d'une minute. */
async function accessToken(): Promise<string | null> {
  const rows = await query<TokenRow>(`select access_token, refresh_token, expires_at from integrations where provider = 'strava'`);
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() - Date.now() > 60_000) return row.access_token;
  const token = await tokenRequest({ refresh_token: row.refresh_token, grant_type: "refresh_token" });
  await query(
    `update integrations set access_token = $1, refresh_token = $2, expires_at = to_timestamp($3) where provider = 'strava'`,
    [token.access_token, token.refresh_token, token.expires_at],
  );
  return token.access_token;
}

/** Ce que l'API Strava renvoie d'une activité, pour ce qui nous sert. */
export type StravaActivity = {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  total_elevation_gain?: number;
};

export type Activity = {
  id: string;
  source: "strava";
  name: string;
  sportType: string;
  startDate: Date;
  movingSeconds: number;
  elapsedSeconds: number;
  distanceMeters: number;
  climbMeters: number;
};

export function fromStrava(a: StravaActivity): Activity {
  return {
    id: `strava:${a.id}`,
    source: "strava",
    name: a.name?.slice(0, 200) || "Activité",
    sportType: a.sport_type ?? a.type ?? "Workout",
    startDate: new Date(a.start_date),
    movingSeconds: Math.max(0, Math.round(a.moving_time ?? 0)),
    elapsedSeconds: Math.max(0, Math.round(a.elapsed_time ?? 0)),
    distanceMeters: Math.max(0, Math.round(a.distance ?? 0)),
    climbMeters: Math.max(0, Math.round(a.total_elevation_gain ?? 0)),
  };
}

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const STRENGTH_TYPES = new Set(["WeightTraining", "Workout", "Crossfit", "Yoga", "Pilates", "HighIntensityIntervalTraining"]);

/** Une course coche une séance de course, un renfo une séance de renfo. */
export function planKindOf(sportType: string): "course" | "renfo" | null {
  if (RUN_TYPES.has(sportType)) return "course";
  if (STRENGTH_TYPES.has(sportType)) return "renfo";
  return null;
}

/** Enregistre des activités ; renvoie celles qui sont nouvelles. */
export async function saveActivities(list: Activity[]): Promise<Activity[]> {
  if (list.length === 0) return [];
  const rows = await query<{ id: string }>(
    `insert into activities (id, source, name, sport_type, start_date, moving_seconds, elapsed_seconds, distance_meters, climb_meters)
     select a.id, a.source, a.name, a.sport_type, a.start_date, a.moving_seconds, a.elapsed_seconds, a.distance_meters, a.climb_meters
       from json_to_recordset($1::json) as a(id text, source text, name text, sport_type text, start_date timestamptz,
            moving_seconds integer, elapsed_seconds integer, distance_meters integer, climb_meters integer)
     on conflict (id) do nothing
     returning id`,
    [
      JSON.stringify(
        list.map((a) => ({
          id: a.id,
          source: a.source,
          name: a.name,
          sport_type: a.sportType,
          start_date: a.startDate.toISOString(),
          moving_seconds: a.movingSeconds,
          elapsed_seconds: a.elapsedSeconds,
          distance_meters: a.distanceMeters,
          climb_meters: a.climbMeters,
        })),
      ),
    ],
  );
  const fresh = new Set(rows.map((r) => r.id));
  return list.filter((a) => fresh.has(a.id));
}

export type SyncResult = { imported: number; checked: number };

/**
 * Importe les activités Strava depuis la dernière synchro (ou depuis le
 * début du plan), puis les reporte sur le plan.
 */
export async function syncStrava(since: Date, matchToPlan: (activities: Activity[]) => Promise<number>): Promise<SyncResult> {
  const token = await accessToken();
  if (!token) throw new Error("Strava n'est pas connecté.");

  const conn = await query<{ last_sync_at: string | Date | null }>(`select last_sync_at from integrations where provider = 'strava'`);
  const last = conn[0]?.last_sync_at ? new Date(conn[0].last_sync_at) : null;
  // Une marge d'un jour rattrape une activité envoyée en retard par la montre.
  const after = Math.floor(((last ? Math.max(last.getTime() - 86_400_000, since.getTime()) : since.getTime())) / 1000);

  const all: Activity[] = [];
  for (let page = 1; page <= 5; page++) {
    const response = await fetch(`${API}/athlete/activities?after=${after}&per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Strava ne répond pas (${response.status}).`);
    const batch = (await response.json()) as StravaActivity[];
    all.push(...batch.map(fromStrava));
    if (batch.length < 100) break;
  }

  const fresh = await saveActivities(all);
  const checked = await matchToPlan(fresh);
  await query(`update integrations set last_sync_at = now() where provider = 'strava'`);
  return { imported: fresh.length, checked };
}
