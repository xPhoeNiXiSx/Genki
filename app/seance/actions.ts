"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { recordWorkout, reviewWorkout } from "@/lib/workouts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh() {
  revalidatePath("/");
  revalidatePath("/suivi");
  revalidatePath("/programmes");
}

/**
 * Enregistre une séance dès qu'elle se termine (ou qu'on l'arrête) : le
 * carnet est à jour même si l'on ferme l'appli sur l'écran de bilan.
 */
export async function recordSessionAction(input: {
  programId: string;
  programName: string;
  startedAt: string;
  durationSeconds: number;
  completed: boolean;
  stepsDone: number;
  stepsTotal: number;
}): Promise<{ id: string | null }> {
  if (!(await isAuthenticated())) return { id: null };

  const startedAt = new Date(input.startedAt);
  if (Number.isNaN(startedAt.getTime()) || !(input.durationSeconds > 0)) return { id: null };
  const total = Math.max(0, Math.round(input.stepsTotal));

  const id = await recordWorkout({
    programId: UUID.test(input.programId) ? input.programId : null,
    programName: String(input.programName).slice(0, 200),
    startedAt,
    durationSeconds: Math.min(Math.round(input.durationSeconds), 24 * 3600),
    completed: Boolean(input.completed),
    stepsDone: Math.min(total, Math.max(0, Math.round(input.stepsDone))),
    stepsTotal: total,
  });
  refresh();
  return { id };
}

/** Ajoute ressenti et note au bilan, puis ouvre la fiche de la séance. */
export async function reviewSessionAction(form: FormData): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login?next=/suivi");
  const id = form.get("id");
  if (typeof id !== "string" || !UUID.test(id)) redirect("/suivi");

  const raw = Number(form.get("feeling"));
  const feeling = Number.isInteger(raw) && raw >= 1 && raw <= 5 ? raw : null;
  const noteValue = form.get("note");
  const note = typeof noteValue === "string" && noteValue.trim() ? noteValue.trim().slice(0, 2000) : null;

  await reviewWorkout(id, feeling, note);
  refresh();
  redirect(`/suivi/${id}`);
}
