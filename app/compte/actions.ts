"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { importData, parseBackup } from "@/lib/backup";
import { runMigrations } from "@/lib/db";
import { saveSetting, validSetting, type SettingKey, type Settings } from "@/lib/settings";

async function guard() {
  if (!(await isAuthenticated())) redirect("/login?next=/compte");
}

export async function migrateAction(): Promise<void> {
  await guard();
  await runMigrations();
  revalidatePath("/", "layout");
  redirect("/compte?migre=1");
}

export async function saveSettingAction(key: SettingKey, value: unknown): Promise<{ ok: boolean }> {
  await guard();
  const valid = validSetting(key, value);
  if (valid === null) return { ok: false };
  await saveSetting(key, valid as Settings[typeof key]);
  revalidatePath("/compte");
  return { ok: true };
}

export type ImportState = { error?: string; done?: string };

export async function importAction(_state: ImportState, form: FormData): Promise<ImportState> {
  await guard();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisis un fichier d'export Genki." };
  if (file.size > 20_000_000) return { error: "Ce fichier est trop lourd pour un export Genki." };

  const parsed = parseBackup(await file.text());
  if ("error" in parsed) return { error: parsed.error };

  try {
    const summary = await importData(parsed.backup);
    revalidatePath("/", "layout");
    return {
      done: `Données restaurées : ${summary.exercises} exercice${summary.exercises > 1 ? "s" : ""}, ${summary.programs} programme${summary.programs > 1 ? "s" : ""}, ${summary.workouts} séance${summary.workouts > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    console.error("[import]", error);
    return { error: "La restauration a échoué. Les migrations sont-elles appliquées ?" };
  }
}
