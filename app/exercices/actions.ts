"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { createExercise, deleteExercise, parseExerciseForm, setExerciseActive, updateExercise } from "@/lib/exercises";

export type ExerciseFormState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard(path: string) {
  if (!(await isAuthenticated())) redirect(`/login?next=${encodeURIComponent(path)}`);
}

export async function saveExerciseAction(_state: ExerciseFormState, form: FormData): Promise<ExerciseFormState> {
  const id = form.get("id");
  const editing = typeof id === "string" && UUID.test(id);
  await guard(editing ? `/exercices/${id}/modifier` : "/exercices/nouveau");

  const parsed = parseExerciseForm(form);
  if ("error" in parsed) return { error: parsed.error };

  let target: string;
  if (editing) {
    if (!(await updateExercise(id, parsed.input))) return { error: "Cet exercice n'existe plus." };
    target = id;
  } else {
    target = await createExercise(parsed.input);
  }

  revalidatePath("/exercices");
  revalidatePath("/programmes");
  redirect(`/exercices/${target}`);
}

/** Supprime l'exercice ; s'il sert encore dans une séance, il est désactivé. */
export async function deleteExerciseAction(form: FormData): Promise<void> {
  const id = form.get("id");
  if (typeof id !== "string" || !UUID.test(id)) return;
  await guard(`/exercices/${id}`);
  if (!(await deleteExercise(id))) await setExerciseActive(id, false);
  revalidatePath("/exercices");
  revalidatePath("/programmes");
  redirect("/exercices");
}

export async function setExerciseActiveAction(form: FormData): Promise<void> {
  const id = form.get("id");
  if (typeof id !== "string" || !UUID.test(id)) return;
  await guard(`/exercices/${id}`);
  await setExerciseActive(id, form.get("active") === "1");
  revalidatePath("/exercices");
  revalidatePath("/programmes");
  redirect(`/exercices/${id}`);
}
