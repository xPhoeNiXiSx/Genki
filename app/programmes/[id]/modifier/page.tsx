import { notFound } from "next/navigation";

import { listExercises } from "@/lib/exercises";
import { getProgram } from "@/lib/programs";

import { databaseBlocker } from "../../../db-screens";
import { ProgramEditor } from "../../program-editor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { id } = await params;
  const [program, exercises] = await Promise.all([UUID.test(id) ? getProgram(id) : null, listExercises()]);
  if (!program) notFound();

  return <ProgramEditor program={program} exercises={exercises} />;
}
