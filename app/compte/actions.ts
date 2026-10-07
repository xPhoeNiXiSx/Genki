"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { runMigrations } from "@/lib/db";

export async function migrateAction(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login?next=/compte");

  await runMigrations();
  revalidatePath("/", "layout");
  redirect("/compte?migre=1");
}
