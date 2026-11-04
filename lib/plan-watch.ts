import { query } from "@/lib/db";
import { deleteWorkout, saveWorkout } from "@/lib/intervals";
import type { PlanSession } from "@/lib/plan";
import { workoutText } from "@/lib/watch";

/** Une séance envoyée à la montre : le jour choisi. */
export type WatchEntry = { day: string; eventId: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function getWatchEntry(sessionId: string): Promise<WatchEntry | null> {
  const rows = await query<{ day: string; event_id: string }>(`select to_char(day, 'YYYY-MM-DD') as day, event_id from plan_watch where session_id = $1`, [sessionId]);
  const row = rows[0];
  if (!row) return null;
  return { day: row.day, eventId: row.event_id };
}

/** Envoie (ou déplace) la séance au jour donné. Les séances de renfo ne partent pas. */
export async function sendToWatch(session: PlanSession, day: string): Promise<void> {
  if (session.kind !== "course") throw new Error("Seules les sorties de course partent sur la montre.");
  if (!DAY.test(day)) throw new Error("Choisis un jour.");
  const current = await getWatchEntry(session.id);
  const eventId = await saveWorkout(current?.eventId ?? null, {
    day,
    name: session.title,
    description: workoutText(session.blocks),
    seconds: session.targetSeconds,
    meters: session.targetMeters,
  });
  await query(
    `insert into plan_watch (session_id, event_id, day) values ($1, $2, $3)
     on conflict (session_id) do update set event_id = excluded.event_id, day = excluded.day, sent_at = now()`,
    [session.id, eventId, day],
  );
}

export async function removeFromWatch(sessionId: string): Promise<void> {
  const current = await getWatchEntry(sessionId);
  if (!current) return;
  await deleteWorkout(current.eventId);
  await query(`delete from plan_watch where session_id = $1`, [sessionId]);
}
