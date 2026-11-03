import { query } from "@/lib/db";
import { createExercise } from "@/lib/exercises";
import { normalizeMuscles, type MuscleKey } from "@/lib/muscles";

/**
 * Les exercices des renfos du plan, en fiches de la bibliothèque : chaque
 * ligne de renfo ouvre sa fiche (pas-à-pas, muscles sur la planche
 * anatomique, photo si on en ajoute une). Les fiches sont créées à la
 * première visite, sous leur nom ; une fiche existante du même nom sert
 * telle quelle.
 */

type PlanExercise = { label: string; name: string; muscles: MuscleKey[]; equipment: string | null; description: string };

const EXERCISES: PlanExercise[] = [
  {
    label: "Squats",
    name: "Squat",
    muscles: ["quadriceps", "fessiers", "adducteurs"],
    equipment: null,
    description: "1. Pieds largeur d'épaules, pointes légèrement ouvertes.\n2. Descends comme pour t'asseoir sur une chaise, en 3 s, jusqu'à ce que les cuisses soient presque parallèles au sol.\n3. Remonte en poussant dans les talons.\n\nÀ surveiller : genoux dans l'axe des pieds (ils ne rentrent pas vers l'intérieur), dos droit, talons au sol.",
  },
  {
    label: "Fentes avant",
    name: "Fentes avant",
    muscles: ["quadriceps", "fessiers", "ischio-jambiers"],
    equipment: null,
    description: "1. Debout, fais un grand pas en avant.\n2. Descends jusqu'à ce que le genou arrière frôle le sol.\n3. Reviens en poussant sur le pied avant, puis change de jambe.\n\nÀ surveiller : le genou avant reste au-dessus de la cheville, le buste reste droit.",
  },
  {
    label: "Montées sur marche",
    name: "Montées sur marche",
    muscles: ["quadriceps", "fessiers", "mollets"],
    equipment: "Marche ou banc",
    description: "1. Pose un pied entier sur une marche ou un banc solide (hauteur genou au plus).\n2. Monte en poussant uniquement sur cette jambe, l'autre genou monte haut.\n3. Redescends lentement, toujours sur la même jambe. Fais toutes les répétitions, puis change.\n\nÀ surveiller : ne pas s'aider de la jambe au sol pour monter.",
  },
  {
    label: "Pont fessier",
    name: "Pont fessier",
    muscles: ["fessiers", "ischio-jambiers", "lombaires"],
    equipment: "Tapis",
    description: "1. Allongé sur le dos, genoux pliés, pieds à plat au sol largeur de hanches.\n2. Monte le bassin en serrant les fessiers jusqu'à aligner genoux, hanches et épaules.\n3. Tiens 1 s en haut, redescends lentement.\n\nÀ surveiller : c'est les fessiers qui poussent, pas le bas du dos (ne creuse pas).",
  },
  {
    label: "Ischios (pont une jambe)",
    name: "Pont fessier une jambe",
    muscles: ["ischio-jambiers", "fessiers"],
    equipment: "Tapis",
    description: "1. Même position que le pont fessier, une jambe tendue en l'air.\n2. Monte le bassin en poussant sur le talon de la jambe au sol.\n3. Redescends lentement. Toutes les répétitions, puis change de jambe.\n\nÀ surveiller : le bassin reste horizontal, il ne bascule pas du côté de la jambe levée.",
  },
  {
    label: "Gainage face + côtés",
    name: "Gainage face et côtés",
    muscles: ["abdominaux", "obliques", "lombaires", "epaules"],
    equipment: "Tapis",
    description: "Face : en appui sur les avant-bras et la pointe des pieds, corps droit comme une planche, ventre serré.\nCôté : sur un avant-bras, coude sous l'épaule, pieds empilés, bassin levé.\nEnchaîne face, côté droit, côté gauche.\n\nÀ surveiller : ni dos creusé ni fesses en l'air ; respire normalement.",
  },
  {
    label: "Gainage dynamique",
    name: "Mountain climbers",
    muscles: ["abdominaux", "obliques", "epaules"],
    equipment: "Tapis",
    description: "1. En position de pompe, bras tendus, mains sous les épaules.\n2. Ramène vite un genou vers la poitrine, repose, puis l'autre, en alternance, comme si tu courais au sol.\n\nÀ surveiller : les fesses restent basses, les épaules au-dessus des mains.",
  },
  {
    label: "Mollets",
    name: "Mollets sur marche",
    muscles: ["mollets"],
    equipment: "Marche ou banc",
    description: "1. Sur le bord d'une marche, l'avant des pieds en appui, talons dans le vide. Tiens-toi au mur.\n2. Monte sur la pointe des pieds le plus haut possible.\n3. Redescends lentement, talons sous le niveau de la marche.\n\nPlus dur : sur une seule jambe.",
  },
  {
    label: "Descentes de marche lentes",
    name: "Descentes de marche lentes",
    muscles: ["quadriceps", "fessiers"],
    equipment: "Marche ou banc",
    description: "1. Debout sur une marche, sur une jambe, l'autre pied dans le vide devant.\n2. Plie la jambe d'appui pour descendre l'autre talon vers le sol en 3 s.\n3. Effleure le sol sans t'y poser, remonte.\n\nÀ surveiller : le genou d'appui reste dans l'axe du pied. C'est l'exercice qui prépare les cuisses aux descentes.",
  },
  {
    label: "Squat bulgare",
    name: "Squat bulgare",
    muscles: ["quadriceps", "fessiers", "adducteurs"],
    equipment: "Marche ou banc",
    description: "1. Dos à une chaise ou un banc, pose le dessus du pied arrière dessus.\n2. Descends lentement sur la jambe avant jusqu'à ce que la cuisse soit presque parallèle au sol.\n3. Remonte en poussant dans le talon avant. Toutes les répétitions, puis change.\n\nÀ surveiller : le genou avant ne part pas vers l'intérieur.",
  },
  {
    label: "Équilibre sur une jambe",
    name: "Équilibre sur une jambe",
    muscles: ["mollets", "fessiers"],
    equipment: null,
    description: "1. Debout sur une jambe, genou légèrement fléchi, l'autre pied décollé.\n2. Tiens 40 s sans poser le pied.\n3. Quand c'est facile : yeux fermés, ou sur un coussin.\n\nÀ surveiller : le bassin reste horizontal.",
  },
  {
    label: "Chevilles à l'élastique",
    name: "Chevilles à l'élastique",
    muscles: ["mollets"],
    equipment: "Élastique",
    description: "1. Assis jambe tendue, l'élastique passé autour de l'avant du pied.\n2. Pousse le pied vers l'avant, puis tire-le vers toi, puis vers l'intérieur et l'extérieur (l'élastique attaché sur le côté), contre la résistance.\n\nSans élastique : 1 min sur la pointe des pieds, 1 min sur les talons.",
  },
  {
    label: "Sauts légers",
    name: "Sauts légers",
    muscles: ["mollets", "quadriceps"],
    equipment: null,
    description: "1. Pieds joints, petits sauts sur l'avant du pied, genoux souples.\n2. Réception douce et silencieuse, rebondis aussitôt.\n\nÀ surveiller : arrête au moindre choc dans les genoux ou les tibias.",
  },
];

export type PlanExerciseLink = { id: string; muscles: MuscleKey[] };

/** Crée les fiches qui manquent ; renvoie, par libellé de bloc, la fiche à ouvrir. */
export async function planExerciseLinks(): Promise<Map<string, PlanExerciseLink>> {
  const rows = await query<{ id: string; name: string; muscles: string[] }>(
    `select id, name, muscles from exercises where lower(name) = any($1::text[])`,
    [EXERCISES.map((e) => e.name.toLowerCase())],
  );
  const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r]));
  const links = new Map<string, PlanExerciseLink>();
  for (const e of EXERCISES) {
    const found = byName.get(e.name.toLowerCase());
    if (found) {
      links.set(e.label, { id: found.id, muscles: normalizeMuscles(found.muscles) });
      continue;
    }
    const id = await createExercise({
      name: e.name,
      description: e.description,
      imageUrl: null,
      category: "Musculaire",
      equipment: e.equipment,
      muscles: e.muscles,
    });
    links.set(e.label, { id, muscles: e.muscles });
  }
  return links;
}
