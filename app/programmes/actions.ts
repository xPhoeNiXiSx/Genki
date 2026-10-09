"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { createProgram, deleteProgram, duplicateProgram, parseProgramPayload, updateProgram } from "@/lib/programs";

export type ProgramFormState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idOf(form: FormData): string | null {
  const id = form.get("id");
  return typeof id === "string" && UUID.test(id) ? id : null;
}

async function guard(path: string) {
  if (!(await isAuthenticated())) redirect(`/login?next=${encodeURIComponent(path)}`);
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/programmes");
}

export async function saveProgramAction(_state: ProgramFormState, form: FormData): Promise<ProgramFormState> {
  const id = idOf(form);
  await guard(id ? `/programmes/${id}/modifier` : "/programmes/nouveau");

  const parsed = parseProgramPayload(form.get("payload"));
  if ("error" in parsed) return { error: parsed.error };

  let target: string;
  if (id) {
    if (!(await updateProgram(id, parsed.input))) return { error: "Ce programme n'existe plus." };
    target = id;
  } else {
    target = await createProgram(parsed.input);
  }
  refresh();
  redirect(`/programmes/${target}`);
}

export async function deleteProgramAction(form: FormData): Promise<void> {
  const id = idOf(form);
  if (!id) return;
  await guard(`/programmes/${id}`);
  await deleteProgram(id);
  refresh();
  redirect("/programmes");
}

export async function duplicateProgramAction(form: FormData): Promise<void> {
  const id = idOf(form);
  if (!id) return;
  await guard(`/programmes/${id}`);
  const copy = await duplicateProgram(id);
  refresh();
  redirect(copy ? `/programmes/${copy}/modifier` : "/programmes");
}
