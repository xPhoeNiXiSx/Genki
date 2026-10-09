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

  // Options d'un programme, ajoutées avec l'éditeur.
  `alter table programs add column if not exists category text`,
  `alter table programs add column if not exists rounds integer not null default 1`,
  `alter table programs add column if not exists prep_seconds integer not null default 10`,
  `alter table programs add column if not exists sound text not null default 'gong'`,

  // Type d'étape : exercice de la bibliothèque, repos ou échauffement.
  `alter table program_steps add column if not exists kind text not null default 'exercise'`,
  // Étapes antérieures au type : « Repos » et « Échauffement » étaient de
  // simples libellés. Un exercice supprimé de la bibliothèque garde, lui,
  // son nom en libellé et reste un exercice. Rejouable sans effet.
  `update program_steps
      set kind = case when lower(label) like '%chauff%' then 'warmup' else 'rest' end
    where kind = 'exercise' and exercise_id is null
      and (lower(label) like 'repos%' or lower(label) like '%chauff%')`,

  // Boucles : des étapes consécutives qui partagent un numéro de boucle sont
  // jouées `loop_rounds` fois avant de passer à la suite.
  `alter table program_steps add column if not exists loop_group smallint`,
  `alter table program_steps add column if not exists loop_rounds smallint`,
  // Les tours portaient sur tout le programme : ils deviennent une boucle qui
  // englobe toutes ses étapes. Rejouable sans effet (rounds repasse à 1).
  `update program_steps s
      set loop_group = 1, loop_rounds = p.rounds
     from programs p
    where p.id = s.program_id and p.rounds > 1 and s.loop_group is null`,
  `update programs set rounds = 1 where rounds > 1`,
  // Étape en répétitions : la durée reste une estimation, la séance attend
  // que l'on touche « Fait ».
  `alter table program_steps add column if not exists reps integer check (reps > 0)`,

  // Un exercice se mesure au temps ou aux répétitions ; la valeur sert de
  // proposition quand on l'ajoute à une séance. Un exercice désactivé reste
  // dans les séances qui l'utilisent mais n'est plus proposé.
  `alter table exercises add column if not exists measure text not null default 'time'`,
  `alter table exercises add column if not exists target integer check (target > 0)`,
  `alter table exercises add column if not exists active boolean not null default true`,

  // Listes modifiables : catégories d'exercice, matériel, catégories de
  // séance. Le nom est recopié sur les fiches, renommer le répercute.
  `create table if not exists catalog (
     kind  text not null,
     name  text not null,
     primary key (kind, name)
   )`,
  // Valeurs de départ, posées une seule fois : une liste vidée exprès ne se
  // remplit pas de nouveau.
  `insert into catalog (kind, name)
   select v.kind, v.name
     from (values ('exercise_category', 'Musculaire'), ('exercise_category', 'Endurance'),
                  ('exercise_category', 'Course à pied'), ('equipment', 'Tapis'),
                  ('equipment', 'Haltères'), ('equipment', 'Élastique'),
                  ('program_category', 'Kiné'), ('program_category', 'Renfo'),
                  ('program_category', 'Course')) as v(kind, name)
    where not exists (select 1 from catalog c where c.kind = v.kind)
   on conflict do nothing`,
  // Les valeurs déjà employées sur les fiches y figurent toujours.
  `insert into catalog (kind, name)
   select 'exercise_category', category from exercises
   union select 'equipment', equipment from exercises where equipment is not null
   union select 'program_category', category from programs where category is not null
   on conflict do nothing`,

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

  // Bilan de fin de séance : ressenti de 1 à 5, note libre pour le kiné,
  // étapes réalisées sur le total.
  `alter table workout_sessions add column if not exists feeling smallint check (feeling between 1 and 5)`,
  `alter table workout_sessions add column if not exists note text`,
  `alter table workout_sessions add column if not exists steps_done integer`,
  `alter table workout_sessions add column if not exists steps_total integer`,

  // Réglages de l'appli : une ligne par réglage, valeur en JSON.
  `create table if not exists settings (
     key         text primary key,
     value       jsonb not null,
     updated_at  timestamptz not null default now()
   )`,

  // Échecs de connexion, pour freiner qui devine le mot de passe.
  `create table if not exists login_failures (
     ip         text not null,
     failed_at  timestamptz not null default now()
   )`,
  `create index if not exists login_failures_ip
     on login_failures (ip, failed_at)`,
];
