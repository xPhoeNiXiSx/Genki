import { listCatalog } from "@/lib/catalog";
import { listExercises } from "@/lib/exercises";

import { databaseBlocker } from "../../db-screens";
import { ProgramEditor } from "../program-editor";

export default async function NewProgramPage() {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;
  const [exercises, categories] = await Promise.all([listExercises(), listCatalog("program_category")]);
  return <ProgramEditor exercises={exercises} categories={categories} />;
}
