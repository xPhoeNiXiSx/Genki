/**
 * Vérifie la couche données contre un vrai Postgres, en mémoire (PGlite).
 * Le schéma et les requêtes exécutés ici sont exactement ceux de production :
 * seul le pilote change, via `setQueryRunner`.
 *
 *   npm test
 */

import assert from "node:assert/strict";

import { PGlite } from "@electric-sql/pglite";

import { isSchemaReady, query, runMigrations, setQueryRunner } from "../lib/db";
import {
  MAX_FAILURES,
  clearFailures,
  lockedMinutes,
  recordFailure,
} from "../lib/throttle";
import { newToken, safeEquals, verifyToken } from "../lib/session";

const checks: string[] = [];

function ok(label: string) {
  checks.push(label);
}

async function main() {
  const pg = new PGlite();
  setQueryRunner(async (text, params = []) => {
    const result = await pg.query(text, params as unknown[]);
    return result.rows as never[];
  });

  assert.equal(await isSchemaReady(), false);
  ok("une base vide est détectée comme non initialisée");

  await runMigrations();
  assert.equal(await isSchemaReady(), true);
  ok("le schéma s'applique depuis l'application");

  await runMigrations();
  ok("le schéma est idempotent");

  // Un programme et ses étapes : la suppression d'un exercice ne doit pas
  // casser le programme, et celle du programme emporte ses étapes.
  const [squat] = await query<{ id: string }>(
    `insert into exercises (name, category, muscles)
     values ('Squat', 'musculaire', '{quadriceps,fessiers}') returning id`,
  );
  const [program] = await query<{ id: string }>(
    `insert into programs (name) values ('Kiné genou') returning id`,
  );
  await query(
    `insert into program_steps (program_id, position, exercise_id, label, duration_seconds)
     values ($1, 0, null, 'Échauffement', 30), ($1, 1, $2, null, 45)`,
    [program.id, squat.id],
  );

  await query(`delete from exercises where id = $1`, [squat.id]);
  const steps = await query<{ exercise_id: string | null }>(
    `select exercise_id from program_steps where program_id = $1 order by position`,
    [program.id],
  );
  assert.equal(steps.length, 2);
  assert.equal(steps[1].exercise_id, null);
  ok("supprimer un exercice laisse l'étape en place, sans exercice");

  await query(
    `insert into workout_sessions (program_id, program_name, duration_seconds, completed)
     values ($1, 'Kiné genou', 75, true)`,
    [program.id],
  );
  await query(`delete from programs where id = $1`, [program.id]);
  assert.equal(
    (await query(`select 1 from program_steps where program_id = $1`, [program.id])).length,
    0,
  );
  const [history] = await query<{ program_id: string | null; program_name: string }>(
    `select program_id, program_name from workout_sessions`,
  );
  assert.equal(history.program_id, null);
  assert.equal(history.program_name, "Kiné genou");
  ok("supprimer un programme emporte ses étapes et garde l'historique lisible");

  await assert.rejects(
    query(
      `insert into program_steps (program_id, position, duration_seconds)
       values (gen_random_uuid(), 0, 0)`,
    ),
  );
  ok("une étape de durée nulle est refusée");

  // Freinage de la connexion.
  for (let i = 0; i < MAX_FAILURES - 1; i += 1) await recordFailure("1.2.3.4");
  assert.equal(await lockedMinutes("1.2.3.4"), 0);
  await recordFailure("1.2.3.4");
  assert.ok((await lockedMinutes("1.2.3.4")) > 0);
  assert.equal(await lockedMinutes("5.6.7.8"), 0);
  ok("la connexion se bloque au-delà de 5 échecs, par adresse");

  await clearFailures("1.2.3.4");
  assert.equal(await lockedMinutes("1.2.3.4"), 0);
  ok("une connexion réussie efface les échecs");

  // Session.
  process.env.AUTH_SECRET = "secret-de-test";
  const token = await newToken();
  assert.equal(await verifyToken(token), true);
  assert.equal(await verifyToken(`${token}x`), false);
  assert.equal(await verifyToken(undefined), false);
  assert.equal(safeEquals("abc", "abd"), false);
  ok("le jeton de session se vérifie et refuse une signature altérée");

  for (const label of checks) console.log(`✓ ${label}`);
  console.log(`\n${checks.length} vérifications passées.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
