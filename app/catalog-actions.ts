"use server";

import { revalidatePath } from "next/cache";

import { isAuthenticated } from "@/lib/auth";
import {
  addCatalog,
  deleteCatalog,
  isCatalogKind,
  listCatalog,
  renameCatalog,
  type CatalogEntry,
  type CatalogResult,
} from "@/lib/catalog";

export type CatalogState = { entries: CatalogEntry[]; error?: string };

export type CatalogChange =
  | { op: "add"; name: string }
  | { op: "rename"; from: string; to: string }
  | { op: "delete"; name: string };

/** Ajoute, renomme ou supprime une entrée, puis renvoie la liste à jour. */
export async function changeCatalogAction(kind: string, change: CatalogChange): Promise<CatalogState> {
  if (!(await isAuthenticated())) return { entries: [], error: "Session expirée, reconnecte-toi." };
  if (!isCatalogKind(kind)) return { entries: [], error: "Liste inconnue." };

  let result: CatalogResult;
  if (change.op === "add") result = await addCatalog(kind, change.name);
  else if (change.op === "rename") result = await renameCatalog(kind, change.from, change.to);
  else result = await deleteCatalog(kind, change.name);

  revalidatePath("/exercices");
  revalidatePath("/programmes");
  const entries = await listCatalog(kind);
  return "error" in result ? { entries, error: result.error } : { entries };
}
