import { listCatalog } from "@/lib/catalog";

import { databaseBlocker } from "../../db-screens";
import { ExerciseForm } from "../exercise-form";

export default async function NewExercisePage() {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;
  const [categories, equipment] = await Promise.all([listCatalog("exercise_category"), listCatalog("equipment")]);
  return <ExerciseForm categories={categories} equipment={equipment} />;
}
