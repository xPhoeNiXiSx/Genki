import { notFound } from "next/navigation";

import { parisToday } from "@/lib/dates";
import { getProgram } from "@/lib/programs";
import { getSettings } from "@/lib/settings";
import { currentStreak, dailyTotals } from "@/lib/workouts";

import { databaseBlocker } from "../../db-screens";
import { SessionPlayer } from "./session-player";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { id } = await params;
  const program = UUID.test(id) ? await getProgram(id) : null;
  if (!program || program.steps.length === 0) notFound();

  const [settings, streak, days] = await Promise.all([getSettings(), currentStreak(), dailyTotals()]);
  const doneToday = days.some((d) => d.day === parisToday() && d.seconds > 0);

  // La série affichée au bilan compte la séance en cours.
  return <SessionPlayer program={program} settings={settings} streakAfter={doneToday ? streak : streak + 1} />;
}
