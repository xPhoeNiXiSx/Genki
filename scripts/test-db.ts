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
import {
  createExercise,
  deleteExercise,
  getExercise,
  listExercises,
  parseExerciseForm,
  updateExercise,
} from "../lib/exercises";
import {
  createProgram,
  deleteProgram,
  duplicateProgram,
  getProgram,
  listPrograms,
  parseProgramForm,
  updateProgram,
} from "../lib/programs";
import { dailyTotals, listWorkouts, recordWorkout, weeklyTotals } from "../lib/workouts";
import { BACK, FRONT, bestView } from "../lib/anatomy";
import { MUSCLES } from "../lib/muscles";
import { bibDate, sinceLabel } from "../lib/dates";
import { formatClock, formatLength, parseDuration } from "../lib/duration";
import { normalizeMuscles } from "../lib/muscles";
import {
  allCues,
  cuesBetween,
  elapsed,
  newClock,
  pause,
  play,
  seek,
  stateAt,
  stepStartMs,
} from "../lib/session-engine";
import { beatsUntil, clampBpm } from "../lib/metronome";

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

  await exercisesAndPrograms();
  await workouts();
  pureLogic();

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

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

async function exercisesAndPrograms() {
  const parsed = parseExerciseForm(
    form([
      ["name", "  Squat contre le mur "],
      ["category", "Musculaire"],
      ["description", ""],
      ["muscles", "quadriceps"],
      ["muscles", "inconnu"],
      ["muscles", "fessiers"],
    ]),
  );
  assert.ok("input" in parsed);
  assert.equal(parsed.input.name, "Squat contre le mur");
  assert.equal(parsed.input.description, null);
  assert.deepEqual(parsed.input.muscles, ["fessiers", "quadriceps"]);
  ok("le formulaire d'exercice nettoie la saisie et ne garde que les muscles connus");

  assert.ok("error" in parseExerciseForm(form([["name", "X"], ["category", "Musculaire"], ["imageUrl", "http://x"]])));
  assert.ok("error" in parseExerciseForm(form([["name", " "], ["category", "Musculaire"]])));
  ok("un exercice sans nom, ou avec une image non https, est refusé");

  const squat = await createExercise(parsed.input);
  const plank = await createExercise({
    name: "Gainage",
    description: "Sur les avant-bras, dos droit.",
    imageUrl: null,
    category: "Musculaire",
    equipment: "Tapis",
    muscles: ["abdominaux"],
  });
  assert.equal((await listExercises()).length, 2);
  assert.ok(await updateExercise(plank, { ...(await getExercise(plank))!, name: "Planche" }));
  assert.equal((await getExercise(plank))?.name, "Planche");
  ok("un exercice se crée, se liste et se modifie");

  const program = parseProgramForm(
    form([
      ["name", "Kiné genou"],
      ["stepExercise", ""], ["stepLabel", "Échauffement"], ["stepDuration", "30"],
      ["stepExercise", squat], ["stepLabel", "jambe gauche"], ["stepDuration", "0:45"],
      ["stepExercise", ""], ["stepLabel", ""], ["stepDuration", ""],
      ["stepExercise", plank], ["stepLabel", ""], ["stepDuration", "1 min"],
    ]),
  );
  assert.ok("input" in program);
  assert.equal(program.input.steps.length, 3);
  assert.deepEqual(program.input.steps.map((step) => step.durationSeconds), [30, 45, 60]);
  ok("le formulaire de programme lit les étapes et ignore les lignes vides");

  const bad = parseProgramForm(form([["name", "X"], ["stepExercise", ""], ["stepLabel", "Repos"], ["stepDuration", "bientôt"]]));
  assert.ok("error" in bad && bad.error.startsWith("Étape 1"));
  assert.ok("error" in parseProgramForm(form([["name", "X"]])));
  ok("une durée illisible ou un programme sans étape est refusé, étape nommée");

  const id = await createProgram(program.input);
  let saved = await getProgram(id);
  assert.deepEqual(saved?.steps.map((step) => step.name), [
    "Échauffement",
    "Squat contre le mur — jambe gauche",
    "Planche",
  ]);
  assert.deepEqual(saved?.steps[1].muscles, ["fessiers", "quadriceps"]);
  ok("un programme se relit avec ses étapes dans l'ordre, noms et muscles compris");

  await updateProgram(id, { ...program.input, steps: program.input.steps.slice(1) });
  saved = await getProgram(id);
  assert.equal(saved?.steps.length, 2);
  assert.equal(saved?.steps[0].name, "Squat contre le mur — jambe gauche");
  ok("modifier un programme remplace ses étapes");

  const summary = (await listPrograms()).find((p) => p.id === id);
  assert.equal(summary?.stepCount, 2);
  assert.equal(summary?.totalSeconds, 105);
  ok("la liste des programmes donne le nombre d'étapes et la durée totale");

  const copy = await duplicateProgram(id);
  assert.ok(copy);
  assert.equal((await getProgram(copy))?.name, "Kiné genou (copie)");
  assert.equal((await getProgram(copy))?.steps.length, 2);
  ok("un programme se duplique");

  await deleteExercise(plank);
  saved = await getProgram(id);
  assert.equal(saved?.steps[1].exerciseId, null);
  assert.equal(saved?.steps[1].name, "Planche");
  ok("supprimer un exercice garde l'étape, sous le nom de l'exercice");

  await deleteProgram(copy);
  assert.equal(await getProgram(copy), null);
  assert.equal((await query(`select 1 from program_steps where program_id = $1`, [copy])).length, 0);
  ok("supprimer un programme emporte ses étapes");
}

async function workouts() {
  const [program] = await listPrograms();
  // Mercredi 7 octobre 2026, 10 h à Paris ; la semaine commence lundi 5.
  const now = new Date("2026-10-07T08:00:00Z");

  await recordWorkout({ programId: program.id, programName: program.name, startedAt: new Date("2026-10-06T17:00:00Z"), durationSeconds: 600, completed: true });
  // Dimanche 4 octobre, 23 h 30 à Paris : semaine précédente.
  await recordWorkout({ programId: null, programName: "Course", startedAt: new Date("2026-10-04T21:30:00Z"), durationSeconds: 1800, completed: true });
  // Lundi 5 octobre, 0 h 30 à Paris, soit dimanche 22 h 30 UTC : semaine en cours.
  await recordWorkout({ programId: program.id, programName: program.name, startedAt: new Date("2026-10-04T22:30:00Z"), durationSeconds: 120, completed: false });

  const totals = await weeklyTotals(3, now);
  assert.deepEqual(totals, [
    { week: "2026-10-05", seconds: 720, sessions: 2 },
    { week: "2026-09-28", seconds: 1800, sessions: 1 },
    { week: "2026-09-21", seconds: 0, sessions: 0 },
  ]);
  ok("les totaux par semaine suivent l'heure de Paris et montrent les semaines vides");

  const daily = await dailyTotals(now);
  assert.equal(daily.length, 7);
  assert.equal(daily[0].day, "2026-10-05");
  assert.deepEqual(daily.map((d) => d.seconds), [120, 600, 0, 0, 0, 0, 0]);
  ok("les totaux par jour couvrent la semaine en cours, du lundi au dimanche, heure de Paris");

  const list = await listWorkouts();
  assert.equal(list[0].programName, program.name);
  assert.equal(list[0].durationSeconds, 600);
  assert.equal(list.at(-1)?.programName, "Course");
  ok("l'historique liste les séances de la plus récente à la plus ancienne");

  await deleteProgram(program.id);
  assert.ok((await listWorkouts()).every((w) => w.programName));
  ok("supprimer un programme garde l'historique lisible");
}

function pureLogic() {
  assert.equal(parseDuration("45"), 45);
  assert.equal(parseDuration("1:30"), 90);
  assert.equal(parseDuration("2 min"), 120);
  assert.equal(parseDuration("1 min 30"), 90);
  assert.equal(parseDuration("90 s"), 90);
  assert.equal(parseDuration("0"), null);
  assert.equal(parseDuration("1:75"), null);
  assert.equal(parseDuration("vite"), null);
  ok("les durées se lisent sous leurs formes courantes");

  assert.equal(formatClock(45), "0:45");
  assert.equal(formatClock(754), "12:34");
  assert.equal(formatClock(3725), "1:02:05");
  assert.equal(formatLength(11400), "3 h 10");
  assert.equal(formatLength(720), "12 min");
  ok("les durées s'affichent en chrono et en résumé");

  assert.deepEqual(normalizeMuscles(["mollets", "pectoraux", "mollets", "x"]), ["pectoraux", "mollets"]);
  ok("les muscles sont dédoublonnés et rangés de haut en bas");

  const steps = [{ durationSeconds: 30 }, { durationSeconds: 2 }, { durationSeconds: 10 }];

  let state = stateAt(steps, 0);
  assert.equal(state.index, 0);
  assert.equal(state.stepRemainingMs, 30_000);
  state = stateAt(steps, 31_000);
  assert.equal(state.index, 1);
  assert.equal(state.stepRemainingMs, 1_000);
  assert.equal(stateAt(steps, 42_000).finished, true);
  assert.equal(stepStartMs(steps, 2), 32_000);
  ok("le moteur sait à chaque instant quelle étape court et ce qu'il en reste");

  const cues = allCues(steps).map((cue) => `${cue.atMs}:${cue.kind}${"value" in cue ? cue.value : "index" in cue ? cue.index : ""}`);
  assert.deepEqual(cues, [
    "0:step0", "27000:count3", "28000:count2", "29000:count1", "30000:step1",
    "31000:count1", "32000:step2",
    "39000:count3", "40000:count2", "41000:count1", "42000:end",
  ]);
  ok("le décompte « trois, deux, un » précède chaque changement, sans déborder d'une étape courte");

  let played: string[] = [];
  for (let t = -1; t < 43_000; t += 16) {
    played.push(...cuesBetween(steps, t, t + 16).map((cue) => `${cue.atMs}`));
  }
  assert.equal(played.length, 11);
  assert.equal(new Set(played).size, 11);
  ok("rafraîchi par petits pas, chaque signal sort une fois et une seule");

  played = cuesBetween(steps, 5_000, 31_500).map((cue) => `${cue.kind}`);
  assert.deepEqual(played, ["step", "count"]);
  ok("après un saut (retour de veille), on n'entend que le changement en cours");

  let clock = play(newClock(), 1_000);
  assert.equal(elapsed(clock, 4_000), 3_000);
  clock = pause(clock, 4_000);
  assert.equal(elapsed(clock, 60_000), 3_000);
  clock = play(clock, 60_000);
  assert.equal(elapsed(clock, 61_000), 4_000);
  clock = seek(clock, 61_000, 30_000);
  assert.equal(elapsed(clock, 62_000), 31_000);
  ok("l'horloge de séance gère pause, reprise et saut d'étape");

  for (const { key } of MUSCLES) assert.ok(FRONT[key] || BACK[key], `muscle absent de la planche : ${key}`);
  assert.equal(bestView(["fessiers", "ischio-jambiers"]), "dos");
  assert.equal(bestView(["quadriceps", "fessiers"]), "face");
  ok("chaque groupe musculaire figure sur la planche, et la meilleure vue est choisie");

  assert.equal(bibDate(new Date("2026-10-06T22:30:00Z")), "MER. 07/10");
  assert.equal(sinceLabel(new Date("2026-10-06T08:00:00Z"), new Date("2026-10-07T08:00:00Z")), "HIER");
  assert.equal(sinceLabel(null), "JAMAIS FAIT");
  ok("les dates de dossard et d'historique suivent l'heure de Paris");

  assert.equal(clampBpm(500), 240);
  assert.equal(clampBpm(Number.NaN), 180);
  const beats = beatsUntil(10, 11, 180);
  assert.equal(beats.times.length, 3);
  assert.ok(Math.abs(beats.nextBeat - 11) < 1e-9);
  ok("le métronome borne le tempo et programme ses battements à 180 bpm");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
