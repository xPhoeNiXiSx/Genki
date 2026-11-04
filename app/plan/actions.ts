"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { completePlanSession, getPlanSession, listAdjustments, parsePlanReport, setPlanStatus, withAdjustment } from "@/lib/plan";
import { removeFromWatch, sendToWatch } from "@/lib/plan-watch";

export type PlanReportState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idOf(form: FormData): string | null {
  const id = form.get("id");
  return typeof id === "string" && UUID.test(id) ? id : null;
}

async function guard(path: string) {
  if (!(await isAuthenticated())) redirect(`/login?next=${encodeURIComponent(path)}`);
}

function refresh() {
  revalidatePath("/plan", "layout");
  revalidatePath("/");
}

/** Coche la séance avec ce qui a été réalisé, puis revient à sa semaine. */
export async function completePlanAction(_state: PlanReportState, form: FormData): Promise<PlanReportState> {
  const id = idOf(form);
  if (!id) return { error: "Séance inconnue." };
  await guard(`/plan/${id}`);
  const parsed = parsePlanReport(form);
  if ("error" in parsed) return { error: parsed.error };
  const session = await getPlanSession(id);
  if (!session || !(await completePlanSession(id, parsed.report))) return { error: "Cette séance n'existe plus." };
  refresh();
  redirect(`/plan?semaine=${session.week}`);
}

/** « Pas faite », ou retour à « à faire ». */
export async function setPlanStatusAction(form: FormData): Promise<void> {
  const id = idOf(form);
  if (!id) return;
  await guard(`/plan/${id}`);
  const status = form.get("status") === "skipped" ? "skipped" : "todo";
  await setPlanStatus(id, status);
  refresh();
  redirect(`/plan/${id}`);
}

export type WatchState = { error?: string; done?: boolean };

/** Envoie la séance à la montre (via intervals.icu) pour le jour choisi. */
export async function sendToWatchAction(_state: WatchState, form: FormData): Promise<WatchState> {
  const id = idOf(form);
  if (!id) return { error: "Séance inconnue." };
  await guard(`/plan/${id}`);
  const stored = await getPlanSession(id);
  if (!stored) return { error: "Cette séance n'existe plus." };
  const adjustment = (await listAdjustments()).get(stored.week);
  const day = form.get("day");
  try {
    await sendToWatch(withAdjustment(stored, adjustment?.factor), typeof day === "string" ? day : "");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Envoi impossible." };
  }
  revalidatePath(`/plan/${id}`);
  return { done: true };
}

/** Retire la séance de la montre. */
export async function removeFromWatchAction(_state: WatchState, form: FormData): Promise<WatchState> {
  const id = idOf(form);
  if (!id) return { error: "Séance inconnue." };
  await guard(`/plan/${id}`);
  try {
    await removeFromWatch(id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Retrait impossible." };
  }
  revalidatePath(`/plan/${id}`);
  return { done: true };
}
