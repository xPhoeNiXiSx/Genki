/**
 * Schéma de Genki — source unique de vérité.
 *
 * Il vit dans le code pour que l'application l'applique elle-même depuis une
 * fonction serveur (voir `runMigrations`) : personne n'a à ouvrir un éditeur
 * SQL, ni au premier déploiement ni aux évolutions suivantes.
 *
 * Règle à tenir : chaque instruction doit être rejouable sans erreur sur une
 * base déjà à jour. `if not exists` partout, jamais de `drop`.
 *
 * Les durées sont stockées en secondes entières.
 */
export const SCHEMA_STATEMENTS: string[] = [
  // Bibliothèque d'exercices. L'exercice décrit le mouvement ; la durée et
  // l'enchaînement relèvent du programme.
  `create table if not exists exercises (
     id           uuid primary key default gen_random_uuid(),
     name         text not null,
     description  text,
     image_url    text,
     -- Musculaire, endurance, course à pied…
     category     text not null,
     equipment    text,
     -- Groupes musculaires sollicités, pour le schéma du corps.
     muscles      text[] not null default '{}',
     created_at   timestamptz not null default now(),
     updated_at   timestamptz not null default now()
   )`,

  `create table if not exists programs (
     id           uuid primary key default gen_random_uuid(),
     name         text not null,
     notes        text,
     created_at   timestamptz not null default now(),
     updated_at   timestamptz not null default now()
   )`,

  // Étapes d'un programme, dans l'ordre. Une étape sans exercice est une
  // pause ou un temps libre (« Repos », « Échauffement »…), d'où le libellé.
  `create table if not exists program_steps (
     id                uuid primary key default gen_random_uuid(),
     program_id        uuid not null references programs(id) on delete cascade,
     position          integer not null,
     exercise_id       uuid references exercises(id) on delete set null,
     label             text,
     duration_seconds  integer not null check (duration_seconds > 0)
   )`,
  `create index if not exists program_steps_program
     on program_steps (program_id, position)`,

  // Historique des séances. Le nom du programme est recopié : une séance
  // reste lisible même si le programme est renommé ou supprimé ensuite.
  `create table if not exists workout_sessions (
     id                uuid primary key default gen_random_uuid(),
     program_id        uuid references programs(id) on delete set null,
     program_name      text not null,
     started_at        timestamptz not null default now(),
     duration_seconds  integer not null default 0 check (duration_seconds >= 0),
     completed         boolean not null default false
   )`,
  `create index if not exists workout_sessions_started
     on workout_sessions (started_at desc)`,

  // Échecs de connexion, pour freiner qui devine le mot de passe.
  `create table if not exists login_failures (
     ip         text not null,
     failed_at  timestamptz not null default now()
   )`,
  `create index if not exists login_failures_ip
     on login_failures (ip, failed_at)`,
];
