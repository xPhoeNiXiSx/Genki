import { listExercises } from "@/lib/exercises";

import { databaseBlocker } from "../../db-screens";
import { ProgramEditor } from "../program-editor";

export default async function NewProgramPage() {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;
  return <ProgramEditor exercises={await listExercises()} />;
}
