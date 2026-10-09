import { notFound } from "next/navigation";

import { getExercise } from "@/lib/exercises";

import { databaseBlocker } from "../../../db-screens";
import { Icon } from "../../../ui/icons";
import { deleteExerciseAction } from "../../actions";
import { ExerciseForm } from "../../exercise-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { id } = await params;
  const exercise = UUID.test(id) ? await getExercise(id) : null;
  if (!exercise) notFound();

  return (
    <>
      <ExerciseForm exercise={exercise} />
      <form action={deleteExerciseAction} style={{ maxWidth: 440, margin: "-12px auto 0", padding: "0 24px calc(env(safe-area-inset-bottom) + 32px)" }}>
        <input type="hidden" name="id" value={exercise.id} />
        <button type="submit" className="btn volt wide" style={{ background: "transparent", borderColor: "var(--line)", color: "var(--danger)" }}>
          <Icon name="trash" size={18} /> Supprimer l&apos;exercice
        </button>
        <p className="muted" style={{ fontSize: 12, textAlign: "center", margin: "8px 0 0" }}>
          Les programmes qui l&apos;utilisent gardent l&apos;étape, sous son nom.
        </p>
      </form>
    </>
  );
}
