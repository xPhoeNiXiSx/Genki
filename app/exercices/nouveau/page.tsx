import { databaseBlocker } from "../../db-screens";
import { ExerciseForm } from "../exercise-form";

export default async function NewExercisePage() {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;
  return <ExerciseForm />;
}
