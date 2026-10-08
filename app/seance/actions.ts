"use server";

import { revalidatePath } from "next/cache";

import { isAuthenticated } from "@/lib/auth";
import { recordWorkout } from "@/lib/workouts";

/** Enregistre une séance terminée ou interrompue. */
export async function saveWorkoutAction(input: {
  programId: string;
  programName: string;
  startedAt: string;
  durationSeconds: number;
  completed: boolean;
}): Promise<void> {
  if (!(await isAuthenticated())) return;

  const startedAt = new Date(input.startedAt);
  if (Number.isNaN(startedAt.getTime()) || input.durationSeconds <= 0) return;

  await recordWorkout({
    programId: input.programId,
    programName: input.programName.slice(0, 200),
    startedAt,
    durationSeconds: Math.min(input.durationSeconds, 24 * 3600),
    completed: input.completed,
  });
  revalidatePath("/");
  revalidatePath("/suivi");
  revalidatePath("/programmes");
}
