"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { deleteWorkout } from "@/lib/workouts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteWorkoutAction(form: FormData): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login?next=/suivi");
  const id = form.get("id");
  if (typeof id === "string" && UUID.test(id)) await deleteWorkout(id);
  revalidatePath("/");
  revalidatePath("/suivi");
  redirect("/suivi");
}
