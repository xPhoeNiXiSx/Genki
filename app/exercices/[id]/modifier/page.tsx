import { notFound } from "next/navigation";

import { listCatalog } from "@/lib/catalog";
import { exerciseUsage, getExercise } from "@/lib/exercises";

import { databaseBlocker } from "../../../db-screens";
import { ExerciseForm } from "../../exercise-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { id } = await params;
  const exercise = UUID.test(id) ? await getExercise(id) : null;
  if (!exercise) notFound();

  const [categories, equipment, usedIn] = await Promise.all([
    listCatalog("exercise_category"),
    listCatalog("equipment"),
    exerciseUsage(exercise.id),
  ]);
  return <ExerciseForm exercise={exercise} categories={categories} equipment={equipment} usedIn={usedIn} />;
}
