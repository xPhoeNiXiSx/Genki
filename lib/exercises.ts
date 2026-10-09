import { query } from "@/lib/db";
import { normalizeMuscles, type MuscleKey } from "@/lib/muscles";

/** Catégories proposées à la saisie. D'autres restent acceptées. */
export const SUGGESTED_CATEGORIES = ["Musculaire", "Endurance", "Course à pied"];

export type Exercise = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  equipment: string | null;
  muscles: MuscleKey[];
};

export type ExerciseInput = Omit<Exercise, "id">;

type Row = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string;
  equipment: string | null;
  muscles: string[];
};

function fromRow(row: Row): Exercise {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    category: row.category,
    equipment: row.equipment,
    muscles: normalizeMuscles(row.muscles),
  };
}

function blankToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * L'image d'un exercice est réduite dans le navigateur puis stockée telle
 * quelle en base, en data URL : pas de stockage de fichiers à brancher, et
 * elle reste disponible hors ligne avec le reste de la fiche.
 */
const IMAGE_DATA = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
/** Environ 500 Ko d'image : largement assez pour 900 px en JPEG. */
export const MAX_IMAGE_CHARS = 700_000;

/** Lit le formulaire d'un exercice. Renvoie l'erreur à afficher, le cas échéant. */
export function parseExerciseForm(
  form: FormData,
): { input: ExerciseInput } | { error: string } {
  const name = blankToNull(form.get("name"));
  if (!name) return { error: "Donne un nom à l'exercice." };

  const category = blankToNull(form.get("category"));
  if (!category) return { error: "Choisis une catégorie." };

  const imageUrl = blankToNull(form.get("imageUrl"));
  if (imageUrl && !/^https:\/\//.test(imageUrl) && !IMAGE_DATA.test(imageUrl)) {
    return { error: "Cette image n'est pas lisible. Choisis une photo JPEG, PNG ou WebP." };
  }
  if (imageUrl && imageUrl.length > MAX_IMAGE_CHARS) {
    return { error: "L'image est trop lourde, même réduite." };
  }

  const muscles = form
    .getAll("muscles")
    .filter((value): value is string => typeof value === "string");

  return {
    input: {
      name,
      category,
      imageUrl,
      description: blankToNull(form.get("description")),
      // « Autre matériel », saisi en clair, l'emporte sur les pastilles.
      equipment: blankToNull(form.get("equipmentOther")) ?? blankToNull(form.get("equipment")),
      muscles: normalizeMuscles(muscles),
    },
  };
}

const COLUMNS = `id, name, description, image_url, category, equipment, muscles`;

export async function listExercises(): Promise<Exercise[]> {
  const rows = await query<Row>(
    `select ${COLUMNS} from exercises order by category, lower(name)`,
  );
  return rows.map(fromRow);
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const rows = await query<Row>(`select ${COLUMNS} from exercises where id = $1`, [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createExercise(input: ExerciseInput): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into exercises (name, description, image_url, category, equipment, muscles)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [
      input.name,
      input.description,
      input.imageUrl,
      input.category,
      input.equipment,
      input.muscles,
    ],
  );
  return rows[0].id;
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update exercises
        set name = $2, description = $3, image_url = $4, category = $5,
            equipment = $6, muscles = $7, updated_at = now()
      where id = $1
      returning id`,
    [
      id,
      input.name,
      input.description,
      input.imageUrl,
      input.category,
      input.equipment,
      input.muscles,
    ],
  );
  return rows.length > 0;
}

/**
 * Supprime un exercice. Les étapes de programme qui l'utilisaient restent en
 * place sous leur libellé : un programme ne se vide pas en silence.
 */
export async function deleteExercise(id: string): Promise<void> {
  await query(
    `update program_steps s
        set label = coalesce(s.label, e.name)
       from exercises e
      where e.id = $1 and s.exercise_id = e.id`,
    [id],
  );
  await query(`delete from exercises where id = $1`, [id]);
}
