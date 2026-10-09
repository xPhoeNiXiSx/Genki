import { query } from "@/lib/db";
import { normalizeMuscles, type MuscleKey } from "@/lib/muscles";

export type Exercise = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  equipment: string | null;
  muscles: MuscleKey[];
  active: boolean;
};

export type ExerciseInput = Omit<Exercise, "id" | "active">;

type Row = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string;
  equipment: string | null;
  muscles: string[];
  active: boolean;
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
    active: row.active,
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
      equipment: blankToNull(form.get("equipment")),
      muscles: normalizeMuscles(muscles),
    },
  };
}

const COLUMNS = `id, name, description, image_url, category, equipment, muscles, active`;

/** Par défaut, les exercices désactivés sont tenus à l'écart. */
export async function listExercises({ inactive = false }: { inactive?: boolean } = {}): Promise<Exercise[]> {
  const rows = await query<Row>(
    `select ${COLUMNS} from exercises
      where active or $1
      order by category, lower(name)`,
    [inactive],
  );
  return rows.map(fromRow);
}

/** Nombre d'exercices désactivés, pour proposer de les afficher. */
export async function countInactiveExercises(): Promise<number> {
  const rows = await query<{ n: number | string }>(`select count(*) as n from exercises where not active`);
  return Number(rows[0]?.n ?? 0);
}

/** Noms des séances qui utilisent l'exercice. */
export async function exerciseUsage(id: string): Promise<string[]> {
  const rows = await query<{ name: string }>(
    `select distinct p.name
       from program_steps s join programs p on p.id = s.program_id
      where s.exercise_id = $1
      order by p.name`,
    [id],
  );
  return rows.map((row) => row.name);
}

export async function setExerciseActive(id: string, active: boolean): Promise<void> {
  await query(`update exercises set active = $2, updated_at = now() where id = $1`, [id, active]);
}

/**
 * Catégorie et matériel s'ajoutent à leur liste s'ils n'y figurent pas
 * encore : une fiche n'emploie que des valeurs que l'on peut gérer.
 */
async function rememberCatalog(input: ExerciseInput): Promise<void> {
  await query(
    `insert into catalog (kind, name)
     select 'exercise_category', $1::text
     union all select 'equipment', $2::text where $2::text is not null
     on conflict do nothing`,
    [input.category, input.equipment],
  );
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const rows = await query<Row>(`select ${COLUMNS} from exercises where id = $1`, [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createExercise(input: ExerciseInput): Promise<string> {
  await rememberCatalog(input);
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
  await rememberCatalog(input);
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
 * Supprime un exercice, seulement si aucune séance ne l'utilise : sinon on
 * le désactive. Renvoie `false` s'il est encore utilisé.
 */
export async function deleteExercise(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `delete from exercises
      where id = $1
        and not exists (select 1 from program_steps where exercise_id = $1)
     returning id`,
    [id],
  );
  return rows.length > 0;
}
