/**
 * Vérifie la couche données contre un vrai Postgres, en mémoire (PGlite).
 * Le schéma et les requêtes exécutés ici sont exactement ceux de production :
 * seul le pilote change, via `setQueryRunner`.
 *
 *   npm test
 */

import assert from "node:assert/strict";

import { PGlite } from "@electric-sql/pglite";

import { addCatalog, deleteCatalog, listCatalog, renameCatalog } from "../lib/catalog";
import {
  completePlanSession,
  currentWeek,
  daysToRace,
  decideAdjustment,
  ensureAdjustment,
  ensurePlan,
  getPlanSession,
  listAdjustments,
  listPlanSessions,
  matchActivities,
  parsePlanReport,
  planWeekOf,
  setPlanStatus,
  weekProgress,
  withAdjustment,
} from "../lib/plan";
import { planKindOf, saveActivities } from "../lib/activities";
import { fromIntervals } from "../lib/intervals";
import { planExerciseLinks } from "../lib/plan-exercises";
import { glossaryFor } from "../lib/plan-glossary";
import { PLAN_WEEKS, plannedSessions } from "../lib/plan-data";
import { ensureSchema, isSchemaReady, query, runMigrations, setQueryRunner } from "../lib/db";
import {
  MAX_FAILURES,
  clearFailures,
  lockedMinutes,
  recordFailure,
} from "../lib/throttle";
import { newToken, safeEquals, verifyToken } from "../lib/session";
import {
  createExercise,
  countInactiveExercises,
  deleteExercise,
  exerciseUsage,
  setExerciseActive,
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
  parseProgramPayload,
  totalSeconds,
  sessionSteps,
  updateProgram,
} from "../lib/programs";
import { currentStreak, dailyTotals, getWorkout, listWorkouts, recordWorkout, reviewWorkout, weeklyTotals } from "../lib/workouts";
import { BACK, FRONT, bestView } from "../lib/anatomy";
import { MUSCLES } from "../lib/muscles";
import { exportData, importData, parseBackup } from "../lib/backup";
import { DEFAULT_SETTINGS, getSettings, saveSetting, validSetting } from "../lib/settings";
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

  // Une base restée à une version antérieure : il lui manque les derniers ajouts.
  await query(`drop table plan_adjustments`);
  await query(`alter table plan_sessions drop column activity_id`);
  assert.equal(await isSchemaReady(), false);
  await ensureSchema();
  assert.equal(await isSchemaReady(), true);
  ok("une base en retard est détectée et mise à jour d'elle-même");

  await exercisesAndPrograms();
  await workouts();
  await trainingPlan();
  await settingsAndBackup();
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

  const withImage = parseExerciseForm(form([["name", "Planche"], ["category", "Musculaire"], ["imageUrl", "data:image/jpeg;base64,/9j/4AAQ=="], ["equipment", "Banc"]]));
  assert.ok("input" in withImage);
  assert.equal(withImage.input.imageUrl, "data:image/jpeg;base64,/9j/4AAQ==");
  assert.equal(withImage.input.equipment, "Banc");
  assert.ok("error" in parseExerciseForm(form([["name", "X"], ["category", "Musculaire"], ["imageUrl", "data:text/html;base64,PHA+"]])));
  ok("une photo réduite est acceptée en data URL");

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

  const program = parseProgramPayload(
    JSON.stringify({
      name: " Kiné genou ",
      category: "Kiné",
      prepSeconds: 5,
      sound: "bip",
      steps: [
        { kind: "warmup", durationSeconds: 30 },
        { kind: "exercise", exerciseId: squat, label: "jambe gauche", durationSeconds: 45, loopGroup: 1, loopRounds: 3 },
        { kind: "rest", durationSeconds: 15, loopGroup: 1, loopRounds: 3 },
        { kind: "exercise", exerciseId: plank, reps: 10, durationSeconds: 1, loopGroup: 1, loopRounds: 3 },
      ],
    }),
  );
  assert.ok("input" in program);
  assert.equal(program.input.name, "Kiné genou");
  assert.equal(program.input.steps[0].label, null);
  // Une étape en répétitions a une durée estimée, à 3 s la répétition.
  assert.deepEqual(program.input.steps.map((step) => step.durationSeconds), [30, 45, 15, 30]);
  assert.deepEqual(program.input.steps.map((step) => step.reps), [null, null, null, 10]);
  ok("l'éditeur envoie la séance, ses options et ses étapes typées, en temps ou en répétitions");

  const bad = parseProgramPayload({ name: "X", steps: [{ kind: "rest", durationSeconds: 0 }] });
  assert.ok("error" in bad && bad.error.startsWith("Étape 1"));
  assert.ok("error" in parseProgramPayload({ name: "X", steps: [] }));
  assert.ok("error" in parseProgramPayload({ name: "X", steps: [{ kind: "rest", durationSeconds: 10, loopGroup: 1, loopRounds: 50 }] }));
  // Une boucle coupée en deux par une étape hors boucle est refusée.
  assert.ok("error" in parseProgramPayload({ name: "X", steps: [
    { kind: "rest", durationSeconds: 10, loopGroup: 1, loopRounds: 2 },
    { kind: "rest", durationSeconds: 10 },
    { kind: "rest", durationSeconds: 10, loopGroup: 1, loopRounds: 2 },
  ] }));
  assert.ok("error" in parseProgramPayload({ name: "X", steps: [{ kind: "exercise", durationSeconds: 10 }] }));
  assert.ok("error" in parseProgramPayload("pas du json"));
  ok("une durée nulle, un exercice manquant ou des options hors bornes sont refusés");

  assert.equal(totalSeconds(program.input.steps), 30 + (45 + 15 + 30) * 3);
  const loopy = (n: number, loopGroup: number | null, loopRounds = 1) => ({ n, durationSeconds: 1, loopGroup, loopRounds });
  assert.deepEqual(
    sessionSteps([loopy(1, null), loopy(2, 1, 2), loopy(3, 1, 2), loopy(4, null), loopy(5, 2, 3)]).map((s) => s.n),
    [1, 2, 3, 2, 3, 4, 5, 5, 5],
  );
  ok("une séance déroule chaque boucle autant de fois que demandé, le reste une seule fois");

  const id = await createProgram(program.input);
  let saved = await getProgram(id);
  assert.deepEqual(saved?.steps.map((step) => step.name), [
    "Échauffement",
    "Squat contre le mur — jambe gauche",
    "Récup",
    "Planche",
  ]);
  assert.deepEqual(saved?.steps[1].muscles, ["fessiers", "quadriceps"]);
  assert.deepEqual(saved?.steps.map((step) => step.kind), ["warmup", "exercise", "rest", "exercise"]);
  assert.deepEqual(saved?.steps.map((step) => step.loopGroup), [null, 1, 1, 1]);
  assert.deepEqual(saved?.steps.map((step) => step.loopRounds), [1, 3, 3, 3]);
  assert.equal(saved?.steps[3].reps, 10);
  assert.equal(saved?.prepSeconds, 5);
  assert.equal(saved?.sound, "bip");
  assert.equal(saved?.category, "Kiné");
  ok("une séance se relit avec ses étapes dans l'ordre, boucles, répétitions, options, noms et muscles compris");

  await updateProgram(id, { ...program.input, steps: program.input.steps.slice(1) });
  saved = await getProgram(id);
  assert.equal(saved?.steps.length, 3);
  assert.equal(saved?.steps[0].name, "Squat contre le mur — jambe gauche");
  ok("modifier un programme remplace ses étapes");

  const summary = (await listPrograms()).find((p) => p.id === id);
  assert.equal(summary?.stepCount, 3);
  assert.equal(summary?.totalSeconds, (45 + 15 + 30) * 3);
  ok("la liste des séances donne le nombre d'étapes et la durée totale, boucles comprises");

  const copy = await duplicateProgram(id);
  assert.ok(copy);
  assert.equal((await getProgram(copy))?.name, "Kiné genou (copie)");
  assert.equal((await getProgram(copy))?.steps.length, 3);
  ok("un programme se duplique");

  assert.deepEqual(await exerciseUsage(plank), ["Kiné genou", "Kiné genou (copie)"]);
  assert.equal(await deleteExercise(plank), false);
  assert.ok(await getExercise(plank));
  await setExerciseActive(plank, false);
  assert.deepEqual((await listExercises()).map((e) => e.name), ["Squat contre le mur"]);
  assert.equal((await listExercises({ inactive: true })).length, 2);
  assert.equal(await countInactiveExercises(), 1);
  assert.equal((await getProgram(id))?.steps[2].name, "Planche");
  await setExerciseActive(plank, true);
  const spare = await createExercise({ ...parsed.input, name: "Inutilisé" });
  assert.equal(await deleteExercise(spare), true);
  assert.equal(await getExercise(spare), null);
  ok("un exercice utilisé ne se supprime pas mais se désactive ; inutilisé, il se supprime");

  // Listes gérables : catégories, matériel.
  assert.ok((await listCatalog("equipment")).some((e) => e.name === "Tapis" && e.uses === 1));
  assert.ok("error" in (await deleteCatalog("equipment", "Tapis")));
  assert.ok("ok" in (await addCatalog("equipment", "  Kettlebell ")));
  assert.ok("error" in (await addCatalog("equipment", "Kettlebell")));
  assert.ok("ok" in (await renameCatalog("equipment", "Tapis", "Tapis de sol")));
  assert.equal((await getExercise(plank))?.equipment, "Tapis de sol");
  assert.ok("error" in (await renameCatalog("equipment", "Tapis de sol", "Kettlebell")));
  assert.ok("ok" in (await deleteCatalog("equipment", "Kettlebell")));
  assert.ok("ok" in (await renameCatalog("program_category", "Kiné", "Rééduc")));
  assert.equal((await getProgram(id))?.category, "Rééduc");
  ok("une liste s'enrichit, se renomme sur toutes les fiches, et ne perd que ce qui ne sert plus");

  // Reprise des étapes antérieures au type : « Repos » devient un repos, un
  // exercice supprimé reste un exercice.
  await query(`insert into program_steps (program_id, position, label, duration_seconds) values ($1, 9, 'Repos', 15)`, [id]);
  await query(`insert into program_steps (program_id, position, label, duration_seconds) values ($1, 10, 'Planche', 15)`, [id]);
  await runMigrations();
  const kinds = await query<{ label: string; kind: string }>(`select label, kind from program_steps where program_id = $1 order by position`, [id]);
  assert.deepEqual(kinds.map((k) => k.kind), ["exercise", "rest", "exercise", "rest", "exercise"]);
  await query(`delete from program_steps where program_id = $1 and position >= 9`, [id]);

  // Les anciens tours d'un programme deviennent une boucle de toutes ses étapes.
  const legacy = await createProgram({ name: "Ancien", category: null, notes: null, prepSeconds: 0, sound: "gong", steps: [
    { kind: "rest", exerciseId: null, label: null, durationSeconds: 10, reps: null, loopGroup: null, loopRounds: 1 },
    { kind: "rest", exerciseId: null, label: null, durationSeconds: 20, reps: null, loopGroup: null, loopRounds: 1 },
  ] });
  await query(`update programs set rounds = 4 where id = $1`, [legacy]);
  await runMigrations();
  await runMigrations();
  assert.deepEqual((await getProgram(legacy))?.steps.map((s) => [s.loopGroup, s.loopRounds]), [[1, 4], [1, 4]]);
  assert.equal((await query<{ rounds: number }>(`select rounds from programs where id = $1`, [legacy]))[0].rounds, 1);
  await deleteProgram(legacy);
  ok("les tours d'un ancien programme deviennent une boucle, une seule fois");
  ok("les anciennes étapes « Repos » sont reprises en repos, sans toucher aux exercices supprimés");

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

  const reviewed = await recordWorkout({ programId: program.id, programName: program.name, startedAt: new Date("2026-10-07T06:00:00Z"), durationSeconds: 300, completed: false, stepsDone: 3, stepsTotal: 8 });
  assert.ok(await reviewWorkout(reviewed, 4, "Genou un peu raide"));
  const detail = await getWorkout(reviewed);
  assert.equal(detail?.feeling, 4);
  assert.equal(detail?.note, "Genou un peu raide");
  assert.equal(detail?.stepsDone, 3);
  assert.equal(detail?.stepsTotal, 8);
  await assert.rejects(reviewWorkout(reviewed, 9, null));
  ok("le bilan garde ressenti, note et étapes faites ; un ressenti hors de 1 à 5 est refusé");

  // Séances les 4, 5, 6 et 7 octobre (heure de Paris) : série de 4 jours le
  // 7, encore de 4 le 8 tant que rien n'est fait, rompue le 10.
  assert.equal(await currentStreak(now), 4);
  assert.equal(await currentStreak(new Date("2026-10-08T10:00:00Z")), 4);
  assert.equal(await currentStreak(new Date("2026-10-10T10:00:00Z")), 0);
  ok("la série compte les jours consécutifs d'entraînement, jusqu'à hier si rien n'est fait aujourd'hui");

  await deleteProgram(program.id);
  assert.ok((await listWorkouts()).every((w) => w.programName));
  ok("supprimer un programme garde l'historique lisible");
}

async function settingsAndBackup() {
  assert.deepEqual(await getSettings(), DEFAULT_SETTINGS);
  await saveSetting("voice", false);
  await saveSetting("signalSound", "cloche");
  await saveSetting("voice", false);
  const settings = await getSettings();
  assert.equal(settings.voice, false);
  assert.equal(settings.signalSound, "cloche");
  assert.equal(settings.signal, true);
  assert.equal(validSetting("signalSound", "klaxon"), null);
  assert.equal(validSetting("voice", "oui"), null);
  ok("les réglages gardent leurs valeurs par défaut et n'enregistrent que des valeurs valides");

  const ex = await createExercise({ name: "Gainage latéral", description: null, imageUrl: null, category: "Musculaire", equipment: null, muscles: ["obliques"] });
  const prog = await createProgram({ name: "Sauvegarde", category: "Renfo", notes: null, prepSeconds: 5, sound: "bip", steps: [{ kind: "exercise", exerciseId: ex, label: null, durationSeconds: 36, reps: 12, loopGroup: 1, loopRounds: 2 }, { kind: "rest", exerciseId: null, label: null, durationSeconds: 10, reps: null, loopGroup: 1, loopRounds: 2 }] });
  await recordWorkout({ programId: prog, programName: "Sauvegarde", startedAt: new Date("2026-10-08T07:00:00Z"), durationSeconds: 80, completed: true });

  const backup = JSON.parse(JSON.stringify(await exportData()));
  const counts = { exercises: backup.data.exercises.length, programs: backup.data.programs.length, workouts: backup.data.workout_sessions.length };
  await query(`delete from exercises`);
  await saveSetting("voice", true);

  const parsed = parseBackup(JSON.stringify(backup));
  assert.ok("backup" in parsed);
  assert.deepEqual(await importData(parsed.backup), counts);
  const restored = await getProgram(prog);
  assert.deepEqual(restored?.steps.map((s) => s.loopRounds), [2, 2]);
  assert.equal(restored?.steps[0].reps, 12);
  assert.ok((await listCatalog("equipment")).some((e) => e.name === "Tapis de sol"));
  assert.deepEqual(restored?.steps.map((s) => s.name), ["Gainage latéral", "Récup"]);
  assert.deepEqual(restored?.steps[0].muscles, ["obliques"]);
  assert.equal((await getSettings()).voice, false);
  assert.equal((await listWorkouts()).length, counts.workouts);
  ok("un export se restaure à l'identique : exercices, programmes, étapes, séances et réglages");

  // Fichier ancien, sans les colonnes ajoutées depuis : valeurs par défaut.
  delete backup.data.programs[0].rounds;
  delete backup.data.program_steps[0].kind;
  delete backup.data.program_steps[0].loop_group;
  delete backup.data.exercises[0].active;
  delete backup.data.catalog;
  const old = parseBackup(JSON.stringify(backup));
  assert.ok("backup" in old);
  await importData(old.backup);
  assert.ok((await listExercises()).length > 0);
  assert.ok((await listCatalog("exercise_category")).some((e) => e.name === "Musculaire"));
  assert.ok("error" in parseBackup("{}"));
  assert.ok("error" in parseBackup("pas du json"));
  assert.ok("error" in parseBackup(JSON.stringify({ ...backup, version: 99 })));
  ok("un export plus ancien se restaure avec les valeurs par défaut ; un fichier étranger est refusé");
}

async function trainingPlan() {
  const planned = plannedSessions();
  assert.equal(PLAN_WEEKS.length, 16);
  assert.equal(PLAN_WEEKS[0].monday, "2026-11-30");
  assert.equal(PLAN_WEEKS[15].monday, "2027-03-15");
  assert.equal(planned.length, 15 * 5 + 4);
  assert.ok(planned.some((s) => s.week === 15 && s.title === "Semi d'Orvault"));
  assert.ok(planned.some((s) => s.week === 16 && s.targetMeters === 45000));
  ok("le plan compte 16 semaines, du 30 novembre à la course, semi d'Orvault compris");

  const sessions = await listPlanSessions();
  assert.equal(sessions.length, planned.length);
  await ensurePlan();
  assert.equal((await listPlanSessions()).length, planned.length);
  ok("le plan s'enregistre à la première visite, une seule fois");

  const first = sessions[0];
  const parsed = parsePlanReport(form([["duration", "1:24"], ["km", "11,8"], ["climb", "110"], ["feeling", "4"], ["note", " Mollet dur "]]));
  assert.ok("report" in parsed);
  assert.deepEqual(parsed.report, { actualSeconds: 5040, actualMeters: 11800, actualClimb: 110, feeling: 4, note: "Mollet dur" });
  const short = parsePlanReport(form([["duration", "45"]]));
  assert.ok("report" in short && short.report.actualSeconds === 2700);
  assert.ok("error" in parsePlanReport(form([["duration", "une heure"]])));
  assert.ok("error" in parsePlanReport(form([["feeling", "9"]])));
  ok("la saisie d'une séance lit 1:24, 45 min, 11,8 km et refuse l'illisible");

  await completePlanSession(first.id, parsed.report);
  let again = await getPlanSession(first.id);
  assert.equal(again?.status, "done");
  assert.equal(again?.actualMeters, 11800);
  const progress = weekProgress(await listPlanSessions());
  assert.equal(progress[0].done, 1);
  assert.equal(progress[0].metersDone, 11800);
  await setPlanStatus(first.id, "skipped");
  again = await getPlanSession(first.id);
  assert.equal(again?.status, "skipped");
  assert.equal(again?.actualMeters, null);
  await setPlanStatus(first.id, "todo");
  ok("une séance se coche avec le réalisé, se marque non faite ou se remet à faire");

  assert.equal(currentWeek("2026-11-02"), 1);
  assert.equal(currentWeek("2026-12-06"), 1);
  assert.equal(currentWeek("2026-12-07"), 2);
  assert.equal(currentWeek("2027-03-20"), 16);
  assert.equal(currentWeek("2027-05-01"), 16);
  assert.equal(daysToRace("2026-11-30", "2027-03-20"), 110);
  ok("la semaine en cours et le compte à rebours suivent le calendrier");

  const fartlek = planned.find((x) => x.title === "Fartlek")!;
  const words = glossaryFor([fartlek.title, fartlek.summary, ...fartlek.blocks.flatMap((b) => [b.label, b.detail])]).map((g) => g.term);
  assert.ok(words.includes("Fartlek"));
  assert.ok(words.includes("Échauffement"));
  const renfoB = planned.find((x) => x.title.startsWith("Renfo B"))!;
  const renfoWords = glossaryFor([renfoB.title, renfoB.summary, ...renfoB.blocks.flatMap((b) => [b.label, b.detail])]).map((g) => g.term);
  assert.ok(renfoWords.includes("Squat bulgare") && !renfoWords.includes("Squat"));
  assert.ok(renfoWords.includes("Excentrique") && renfoWords.includes("Proprioception (proprio)"));
  // Chaque séance du plan a au moins un mot expliqué.
  assert.ok(planned.every((x) => glossaryFor([x.title, x.summary, ...x.blocks.flatMap((b) => [b.label, b.detail])]).length > 0));
  ok("chaque séance explique ses mots : fartlek, seuil, excentrique, squat bulgare…");

  const links = await planExerciseLinks();
  const renfoLabels = new Set(planned.filter((x) => x.kind === "renfo").flatMap((x) => x.blocks.map((b) => b.label)));
  assert.ok([...renfoLabels].every((label) => links.has(label)));
  const again2 = await planExerciseLinks();
  assert.equal(again2.get("Squats")?.id, links.get("Squats")?.id);
  assert.match((await getExercise(links.get("Squat bulgare")!.id))?.description ?? "", /pied arrière/);
  ok("chaque exercice de renfo a sa fiche dans la bibliothèque, créée une seule fois");

  // intervals.icu : une activité se traduit, se range par type, ne s'importe qu'une fois.
  const run = fromIntervals({ id: "i42", name: "Sortie du dimanche", type: "TrailRun", source: "GARMIN_CONNECT", start_date_local: "2026-12-06T09:30:00", start_date: "2026-12-06T08:30:00Z", moving_time: 4980, elapsed_time: 5200, distance: 11234.5, total_elevation_gain: 96.4 })!;
  assert.deepEqual([run.id, run.localDate, run.distanceMeters, run.climbMeters, run.movingSeconds], ["intervals:i42", "2026-12-06", 11235, 96, 4980]);
  assert.equal(fromIntervals({ id: "i9", type: "Run", source: "STRAVA", start_date_local: "2026-12-06T09:30:00" }), null);
  assert.equal(planKindOf("Run"), "course");
  assert.equal(planKindOf("WeightTraining"), "renfo");
  assert.equal(planKindOf("Ride"), null);
  // Un footing tard le soir reste dans sa journée, et donc dans sa semaine.
  const late = fromIntervals({ id: "i40", type: "Run", start_date_local: "2026-12-06T23:30:00", moving_time: 1800, distance: 4000 })!;
  assert.equal(late.localDate, "2026-12-06");
  const strength = fromIntervals({ id: "i43", name: "Renfo", type: "WeightTraining", start_date_local: "2026-12-02T19:00:00", moving_time: 1900 })!;
  const ride = fromIntervals({ id: "i44", name: "Vélo", type: "Ride", start_date_local: "2026-12-03T19:00:00", moving_time: 3600, distance: 30000 })!;
  const outside = fromIntervals({ id: "i45", name: "Avant le plan", type: "Run", start_date_local: "2026-11-20T09:00:00", moving_time: 2700, distance: 6500 })!;
  const fresh = await saveActivities([run, strength, ride, outside]);
  assert.equal(fresh.length, 4);
  assert.equal((await saveActivities([run])).length, 0);
  ok("une activité d'intervals.icu se traduit, se range par type et ne s'importe qu'une fois ; les coquilles Strava sont écartées");

  assert.equal(planWeekOf("2026-11-29"), null);
  assert.equal(planWeekOf("2026-12-06"), 1);
  assert.equal(await matchActivities(fresh), 2);
  const week1 = (await listPlanSessions()).filter((x) => x.week === 1);
  const long = week1.find((x) => x.title === "Sortie longue")!;
  assert.equal(long.status, "done");
  assert.equal(long.actualMeters, 11235);
  assert.equal(long.activityId, "intervals:i42");
  assert.equal(week1.filter((x) => x.kind === "renfo" && x.status === "done").length, 1);
  assert.equal(week1.find((x) => x.title === "Footing en endurance")!.status, "todo");
  assert.equal(await matchActivities([run]), 0);
  ok("une sortie importée coche, dans sa semaine, la séance du même type à la durée la plus proche");

  // Adaptation.
  const mk = (kind: "course" | "renfo", status: "todo" | "done" | "skipped", feeling: number | null = null) =>
    ({ ...week1[0], kind, status, feeling, actualMeters: null, targetMeters: null }) as typeof week1[0];
  const full = [mk("course", "done", 5), mk("renfo", "done", 5), mk("course", "done", 5), mk("renfo", "todo"), mk("course", "done", 5)];
  assert.equal(decideAdjustment(1, full).factor, 1);
  assert.equal(decideAdjustment(3, full).factor, 1.05);
  assert.equal(decideAdjustment(4, full).factor, 1);
  assert.equal(decideAdjustment(3, [mk("course", "skipped"), mk("course", "todo"), mk("course", "done", 3), mk("renfo", "done")]).factor, 0.8);
  assert.equal(decideAdjustment(3, [mk("course", "done", 2), mk("course", "done", 1), mk("course", "done", 3)]).factor, 0.85);
  const oneMissed = decideAdjustment(3, [mk("course", "skipped"), mk("course", "done", 3), mk("course", "done", 3), mk("renfo", "todo"), mk("renfo", "todo")]);
  assert.equal(oneMissed.factor, 1);
  assert.match(oneMissed.reason, /ne la rattrape pas/);
  assert.equal(decideAdjustment(15, [mk("course", "skipped"), mk("course", "skipped")]).factor, 1);
  ok("le plan s'allège après des sorties manquées ou une semaine dure, s'allonge un peu si tout est facile, jamais avant la course");

  const footing = week1.find((x) => x.title === "Footing en endurance")!;
  const lighter = withAdjustment(footing, 0.8);
  assert.equal(lighter.targetSeconds, 35 * 60);
  assert.equal(lighter.summary, "35 min · 6:45–7:15 /km");
  assert.equal(lighter.blocks[0].duration, "35′");
  assert.equal(withAdjustment(week1.find((x) => x.position === 2)!, 0.8).adjusted, false);
  const longer = withAdjustment({ ...long, status: "todo" }, 1.05);
  assert.equal(longer.targetSeconds, 85 * 60);
  assert.equal(longer.blocks[1].duration, "1 h 05");
  ok("un ajustement raccourcit footing et sortie longue, pas les séances de qualité");

  const sessionsNow = await listPlanSessions();
  const adj = await ensureAdjustment(2, sessionsNow);
  assert.equal((await listAdjustments()).get(2)?.factor, adj.factor);
  const someWeek2 = sessionsNow.find((x) => x.week === 2)!;
  await completePlanSession(someWeek2.id, { actualSeconds: 600, actualMeters: null, actualClimb: null, feeling: 3, note: null });
  await query(`update plan_adjustments set factor = 0.9, reason = 'figé' where week = 2`);
  assert.equal((await ensureAdjustment(2, await listPlanSessions())).reason, "figé");
  await setPlanStatus(someWeek2.id, "todo");
  ok("l'ajustement suit la semaine passée tant que la semaine n'a pas commencé, puis il est figé");
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
