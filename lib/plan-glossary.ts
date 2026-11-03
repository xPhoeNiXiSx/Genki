/**
 * Lexique du plan : ce que veulent dire les mots de l'entraînement, et
 * comment se fait chaque exercice de renfo. Une séance affiche les entrées
 * dont le mot apparaît dans son titre, son résumé ou son déroulé.
 */

export type GlossaryEntry = { term: string; text: string };

type Entry = GlossaryEntry & { match: RegExp };

const ENTRIES: Entry[] = [
  // --- Allures et formats de course ---------------------------------------
  { term: "Endurance fondamentale (EF)", match: /endurance fondamentale|\bEF\b|footing/i, text: "Allure très facile, où tu peux parler en phrases complètes sans être essoufflé. Pour toi, vers 6:45–7:15 /km. C'est la base de tout le plan : elle doit rester facile, même si ça paraît lent." },
  { term: "Endurance active", match: /endurance active/i, text: "Un cran au-dessus de l'endurance fondamentale : soutenu mais confortable, la respiration s'accélère sans gêner. Pour toi, vers 6:00–6:15 /km." },
  { term: "Fartlek", match: /fartlek/i, text: "« Jeu de vitesse » en suédois : au milieu d'un footing, on alterne des passages vite et des passages lents, sans s'arrêter. Le « vite » est soutenu mais contrôlé (tu ne pourrais dire que quelques mots), le « lent » est un trot très facile pour récupérer." },
  { term: "Seuil", match: /seuil/i, text: "Allure soutenue que tu pourrais tenir environ une heure en course : respiration forte mais régulière, tu peux encore dire une phrase courte. Pour toi, vers 5:40–5:50 /km. Ni sprint, ni footing." },
  { term: "Côtes", match: /côte/i, text: "Monter une pente en courant : buste droit, petits pas rapides, bras qui poussent. Effort soutenu mais régulier du bas jusqu'en haut. On redescend en trottinant, c'est la récupération. Pas de grande côte ? Un pont, une rampe ou des escaliers font l'affaire." },
  { term: "Descentes travaillées", match: /descentes travaillées|redescendre en foulées/i, text: "Redescendre vite mais relâché : petits pas rapides, buste légèrement en avant, regard 3-4 m devant. On laisse la pente faire le travail, sans freiner sur les talons." },
  { term: "Lignes droites", match: /lignes droites|accélérations/i, text: "Environ 80 m en accélérant progressivement jusqu'à presque sprinter, en restant relâché, puis retour en marchant. Ça réveille la foulée sans fatiguer." },
  { term: "Allure course", match: /allure course|allure ecotrail/i, text: "L'allure visée le jour J sur chemin, vers 7:00 /km. Le but est de l'avoir dans les jambes pour ne pas partir trop vite le 20 mars." },
  { term: "Sortie longue (SL)", match: /sortie longue/i, text: "La sortie la plus longue de la semaine, toujours en endurance fondamentale. On marche dans les côtes raides comme en trail, on boit toutes les 20 min et on teste ce qu'on mangera en course." },
  { term: "Enchaînement", match: /enchaînement|enchaîne/i, text: "Deux sorties sur deux jours de suite (footing la veille, sortie longue le lendemain) : on court la seconde sur des jambes déjà fatiguées, comme dans la deuxième moitié du trail." },
  { term: "Récup", match: /récup/i, text: "Le temps de pause entre deux efforts : trot très lent ou marche, jusqu'à retrouver une respiration calme." },
  { term: "Échauffement", match: /échauffement|mise en route/i, text: "10 à 20 min de footing très facile avant un effort, pour monter doucement le cœur et chauffer les muscles." },
  { term: "Retour au calme", match: /retour au calme/i, text: "Trot léger puis marche après l'effort, pour redescendre doucement." },
  { term: "Ravitaillements", match: /ravitaillement/i, text: "Les points où l'on boit et mange pendant la course. On s'y arrête juste le temps de remplir et d'attraper à manger, puis on repart en marchant en mangeant. Vérifie dans le règlement le matériel obligatoire (gobelet, réserve d'eau…)." },
  { term: "D+", match: /D\+|dénivelé/i, text: "Dénivelé positif : le total des montées, en mètres. L'EcoTrail en compte 800 m sur 45 km." },
  { term: "Semaine allégée", match: /allégée/i, text: "Une semaine sur quatre, on court moins. C'est pendant ce repos relatif que le corps assimile le travail et progresse : ne rien rattraper." },
  { term: "Affûtage", match: /affûtage|semaine de course/i, text: "Les dernières semaines : le volume baisse, un peu d'intensité reste. On arrive frais le jour J." },

  // --- Renfo --------------------------------------------------------------
  { term: "Excentrique", match: /excentrique/i, text: "Le muscle travaille en freinant pendant qu'il s'allonge, comme les cuisses en descente. On fait le mouvement lentement (3 s pour descendre). C'est ce qui protège les cuisses dans les descentes du trail." },
  { term: "Proprioception (proprio)", match: /proprio|équilibre/i, text: "L'équilibre et les réflexes des chevilles et des genoux. Les entraîner évite les entorses sur un sol irrégulier." },
  { term: "Gainage", match: /gainage/i, text: "Face : en appui sur les avant-bras et la pointe des pieds, corps droit comme une planche, ventre serré, sans creuser le dos ni lever les fesses. Côté : sur un avant-bras, pieds empilés, bassin levé." },
  { term: "Mountain climbers", match: /mountain climbers/i, text: "En position de pompe bras tendus, ramener vite un genou vers la poitrine puis l'autre, en alternance, comme si tu courais au sol." },
  { term: "Squat", match: /squats?\b/i, text: "Pieds largeur d'épaules, descendre comme pour s'asseoir sur une chaise, genoux dans l'axe des pieds, dos droit, talons au sol. Remonter en poussant dans les talons." },
  { term: "Squat bulgare", match: /squat bulgare/i, text: "Le pied arrière posé sur une chaise ou un banc, descendre sur la jambe avant jusqu'à ce que la cuisse soit presque parallèle au sol, puis remonter. Lentement." },
  { term: "Fentes avant", match: /fentes/i, text: "Un grand pas en avant, descendre jusqu'à ce que le genou arrière frôle le sol, genou avant au-dessus de la cheville, puis revenir en poussant sur le pied avant." },
  { term: "Montées sur marche", match: /montées sur marche/i, text: "Un pied sur une marche ou un banc solide, monter en poussant uniquement sur cette jambe, genou de l'autre jambe qui monte haut, puis redescendre en contrôlant." },
  { term: "Pont fessier", match: /pont fessier|pont une jambe/i, text: "Allongé sur le dos, genoux pliés, pieds au sol : monter le bassin en serrant les fessiers jusqu'à aligner genoux, hanches et épaules, tenir 1 s, redescendre. En version une jambe, l'autre jambe reste tendue en l'air." },
  { term: "Mollets", match: /mollets/i, text: "Sur le bord d'une marche, talons dans le vide : monter sur la pointe des pieds, puis redescendre lentement les talons sous le niveau de la marche." },
  { term: "Descentes de marche lentes", match: /descentes de marche/i, text: "Debout sur une marche, sur une jambe : descendre l'autre pied vers le sol en 3 s en pliant la jambe d'appui, l'effleurer sans s'y poser, remonter. Le genou reste dans l'axe du pied." },
  { term: "Chevilles à l'élastique", match: /élastique/i, text: "Assis, un élastique passé autour de l'avant du pied : pousser vers l'avant, tirer vers soi, puis vers l'intérieur et l'extérieur, contre la résistance. Sans élastique : marcher sur la pointe puis sur les talons." },
  { term: "Ischios", match: /ischios/i, text: "Les muscles de l'arrière de la cuisse. Ils freinent la jambe à chaque foulée ; les renforcer protège des claquages." },
  { term: "Sauts légers (pliométrie)", match: /sauts/i, text: "Petits sauts pieds joints, en restant sur l'avant du pied, réception souple et silencieuse. Ça rend la foulée plus réactive. Arrêter au moindre choc dans les genoux." },
];

/** Les entrées utiles à une séance, dans l'ordre du lexique. */
export function glossaryFor(texts: string[]): GlossaryEntry[] {
  const all = texts.join(" \n ");
  const found = ENTRIES.filter((e) => e.match.test(all));
  // « Squat bulgare » suffit quand c'est le seul squat de la séance.
  const plainSquat = /squats?\b(?! bulgare)/i.test(all);
  return found.filter((e) => e.term !== "Squat" || plainSquat).map(({ term, text }) => ({ term, text }));
}
