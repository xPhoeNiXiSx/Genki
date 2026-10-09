import { notFound } from "next/navigation";

import { listCatalog } from "@/lib/catalog";
import { listExercises } from "@/lib/exercises";
import { getProgram } from "@/lib/programs";

import { databaseBlocker } from "../../../db-screens";
import { ProgramEditor } from "../../program-editor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { id } = await params;
  // Exercices désactivés compris : une étape existante doit rester lisible.
  const [program, exercises, categories] = await Promise.all([
    UUID.test(id) ? getProgram(id) : null,
    listExercises({ inactive: true }),
    listCatalog("program_category"),
  ]);
  if (!program) notFound();

  return <ProgramEditor program={program} exercises={exercises} categories={categories} />;
}
