/**
 * Le plan EcoTrail Paris 2027 : 16 semaines, du lundi 30 novembre 2026 à la
 * course du samedi 20 mars 2027 (45 km, 800 m D+).
 *
 * Bâti pour un coureur à 3-4 sorties par semaine, 20 à 40 km, endurance
 * fondamentale vers 6:45 /km, objectif « finir bien ». Peu de dénivelé
 * autour de Couëron : les côtes se font en boucle sur la même pente, dans
 * les escaliers ou sur les ponts, et le renfo travaille les descentes.
 * Le semi d'Orvault, six jours avant, se court en endurance active.
 *
 * Contenu pur, sans base : `lib/plan.ts` l'enregistre à la première visite.
 */

export const RACE = {
  name: "EcoTrail Paris",
  date: "2027-03-20",
  distanceKm: 45,
  climbM: 800,
  route: "Versailles → Iéna",
  goal: "finir bien",
};

/** Lundi de la première semaine. */
export const PLAN_START = "2026-11-30";

export const PHASES = ["Fondation", "Développement", "Spécifique", "Affûtage"] as const;
export type Phase = (typeof PHASES)[number];

export type PlanKind = "course" | "renfo";

export type PlanBlock = { label: string; detail: string; duration: string };

export type PlannedSession = {
  week: number;
  position: number;
  kind: PlanKind;
  title: string;
  /** Une ligne : ce qui est prévu, en bref. */
  summary: string;
  /** Pourquoi cette séance. */
  why: string;
  blocks: PlanBlock[];
  targetSeconds: number;
  targetMeters: number | null;
  targetClimb: number | null;
};

export type PlanWeek = {
  week: number;
  phase: Phase;
  monday: string;
  title: string;
  /** Kilomètres de course prévus. */
  km: number;
  tip: string;
  light: boolean;
};

/** Allures de référence, en secondes par kilomètre. */
const EASY_PACE = 415; // ≈ 6:55
const QUALITY_PACE = 385; // moyenne d'une séance avec échauffement
const LONG_PACE = 430; // ≈ 7:10 sur chemins

const minutes = (m: number) => m * 60;
const metersAt = (seconds: number, pace: number) => Math.round((seconds / pace) * 10) * 100;

type QualityDef = { title: string; summary: string; blocks: PlanBlock[]; minutes: number; climb: number | null; why: string };

const warmup = (m = 15): PlanBlock => ({ label: "Échauffement", detail: "footing très facile, 7:15 /km et plus", duration: `${m}′` });
const cooldown = (m = 10): PlanBlock => ({ label: "Retour au calme", detail: "trot léger puis marche", duration: `${m}′` });

const QUALITY: QualityDef[] = [
  { title: "Côtes courtes", summary: "8 × 30 s en côte · récup en descendant", minutes: 50, climb: 90, why: "Force dans les jambes sans traumatisme. Prends une seule côte et fais-la en boucle.", blocks: [warmup(), { label: "Côtes", detail: "8 × 30 s en montée, appuis dynamiques · descente en trottinant", duration: "20′" }, cooldown(15)] },
  { title: "Côtes courtes", summary: "10 × 30 s en côte · récup en descendant", minutes: 55, climb: 110, why: "On ajoute deux répétitions : même côte, même qualité de foulée.", blocks: [warmup(), { label: "Côtes", detail: "10 × 30 s en montée · descente en trottinant", duration: "25′" }, cooldown(15)] },
  { title: "Fartlek", summary: "8 × 1 min vite / 1 min lent", minutes: 50, climb: null, why: "Réveiller la vitesse sans se mettre dans le rouge.", blocks: [warmup(20), { label: "Fartlek", detail: "8 × (1 min soutenue, 1 min très lente)", duration: "16′" }, cooldown(14)] },
  { title: "Footing + lignes droites", summary: "40 min facile + 6 accélérations", minutes: 40, climb: null, why: "Semaine allégée : on garde la fréquence, on baisse la charge.", blocks: [{ label: "Footing", detail: "endurance fondamentale", duration: "32′" }, { label: "Lignes droites", detail: "6 × 80 m en accélérant, retour marché", duration: "8′" }] },
  { title: "Côtes longues", summary: "6 × 1 min 30 en côte (escaliers, pont)", minutes: 60, climb: 150, why: "Plus long en montée : c'est le format des côtes de l'EcoTrail.", blocks: [warmup(), { label: "Côtes longues", detail: "6 × 1 min 30 en montée régulière · descente au trot", duration: "30′" }, cooldown(15)] },
  { title: "Seuil", summary: "3 × 8 min vers 5:45 /km · récup 2 min", minutes: 60, climb: null, why: "Le seuil fait monter l'allure que tu tiens longtemps.", blocks: [warmup(), { label: "Seuil", detail: "3 × 8 min vers 5:45 /km, récup 2 min trot", duration: "30′" }, cooldown(15)] },
  { title: "Seuil en côte", summary: "5 × 3 min en montée + descentes travaillées", minutes: 60, climb: 180, why: "Monter fort puis descendre vite et relâché : les deux s'apprennent.", blocks: [warmup(), { label: "Montées", detail: "5 × 3 min en côte, effort soutenu", duration: "15′" }, { label: "Descentes", detail: "redescendre en foulées rapides et légères", duration: "15′" }, cooldown(15)] },
  { title: "Fartlek léger", summary: "6 × 1 min vite / 1 min lent", minutes: 45, climb: null, why: "Semaine allégée : un peu de rythme, sans fatigue.", blocks: [warmup(20), { label: "Fartlek", detail: "6 × (1 min soutenue, 1 min lente)", duration: "12′" }, cooldown(13)] },
  { title: "Seuil long", summary: "2 × 15 min vers 5:50 /km · récup 3 min", minutes: 65, climb: null, why: "Tenir l'effort plus longtemps, sans s'arrêter.", blocks: [warmup(), { label: "Seuil", detail: "2 × 15 min vers 5:50 /km, récup 3 min trot", duration: "33′" }, cooldown(17)] },
  { title: "Allure course + côtes", summary: "3 × 15 min allure EcoTrail + 6 × 1 min en côte", minutes: 70, climb: 140, why: "Caler l'allure du jour J (≈ 7:00 /km sur chemin) et garder la force.", blocks: [warmup(10), { label: "Allure course", detail: "3 × 15 min vers 7:00 /km, récup 2 min marche", duration: "49′" }, { label: "Côtes", detail: "6 × 1 min en montée", duration: "6′" }, cooldown(5)] },
  { title: "Côtes longues", summary: "8 × 1 min 30 en côte", minutes: 65, climb: 200, why: "Dernier gros bloc de côtes avant le pic.", blocks: [warmup(), { label: "Côtes longues", detail: "8 × 1 min 30 en montée · descente au trot", duration: "35′" }, cooldown(15)] },
  { title: "Seuil court", summary: "6 × 2 min vers 5:40 /km", minutes: 50, climb: null, why: "Semaine allégée : un rappel de vitesse.", blocks: [warmup(), { label: "Seuil", detail: "6 × 2 min vers 5:40 /km, récup 1 min", duration: "18′" }, cooldown(17)] },
  { title: "Seuil", summary: "3 × 10 min vers 5:45 /km", minutes: 65, climb: null, why: "Dernière séance dure avant l'affûtage.", blocks: [warmup(), { label: "Seuil", detail: "3 × 10 min vers 5:45 /km, récup 2 min trot", duration: "34′" }, cooldown(16)] },
  { title: "Côtes + allure course", summary: "6 × 1 min en côte + 20 min allure EcoTrail", minutes: 60, climb: 120, why: "On garde le rythme, le volume baisse.", blocks: [warmup(), { label: "Côtes", detail: "6 × 1 min en montée", duration: "12′" }, { label: "Allure course", detail: "20 min vers 7:00 /km", duration: "20′" }, cooldown(13)] },
  { title: "Rappel d'allure", summary: "4 × 5 min allure semi relâchée", minutes: 45, climb: null, why: "Rester vif avant le semi et le trail, sans fatigue.", blocks: [warmup(), { label: "Allure", detail: "4 × 5 min vers 5:50 /km, relâché, récup 2 min", duration: "26′" }, cooldown(4)] },
  { title: "Footing + lignes droites", summary: "35 min facile + 4 accélérations", minutes: 35, climb: null, why: "Semaine de course : les jambes doivent rester légères.", blocks: [{ label: "Footing", detail: "très facile", duration: "30′" }, { label: "Lignes droites", detail: "4 × 80 m, relâché", duration: "5′" }] },
];

type WeekDef = { phase: Phase; title: string; km: number; easy: number; long: number; longClimb: number; tip: string; light?: boolean };

const WEEKS: WeekDef[] = [
  { phase: "Fondation", title: "Reprise structurée", km: 30, easy: 45, long: 80, longClimb: 100, tip: "Garde l'endurance vraiment facile : tu dois pouvoir parler en courant." },
  { phase: "Fondation", title: "Endurance + côtes courtes", km: 34, easy: 45, long: 95, longClimb: 120, tip: "Repère une côte de 30 à 60 s près de chez toi : elle servira tout le plan." },
  { phase: "Fondation", title: "Premier fractionné", km: 38, easy: 50, long: 110, longClimb: 140, tip: "Le fractionné se court relâché : épaules basses, regard loin." },
  { phase: "Fondation", title: "Allégée · fêtes", km: 28, easy: 40, long: 75, longClimb: 80, tip: "Semaine allégée : c'est pendant le repos que le corps progresse.", light: true },
  { phase: "Développement", title: "Côtes longues", km: 40, easy: 50, long: 120, longClimb: 160, tip: "Pas de grande côte ? Les escaliers et les ponts sur la Loire font très bien l'affaire." },
  { phase: "Développement", title: "Seuil", km: 44, easy: 55, long: 135, longClimb: 180, tip: "Sur la sortie longue, bois toutes les 20 min, même sans soif." },
  { phase: "Développement", title: "Seuil en côte + descentes", km: 48, easy: 55, long: 150, longClimb: 200, tip: "En descente : petits pas rapides, buste légèrement en avant." },
  { phase: "Développement", title: "Semaine allégée", km: 36, easy: 45, long: 105, longClimb: 120, tip: "Semaine allégée : dors plus, cours moins.", light: true },
  { phase: "Développement", title: "Sortie longue sur chemins", km: 52, easy: 60, long: 165, longClimb: 240, tip: "Teste ce que tu mangeras en course : gel, pâte de fruit, compote." },
  { phase: "Spécifique", title: "Allure course + côtes", km: 55, easy: 60, long: 180, longClimb: 260, tip: "Cours avec ton sac et ton matériel de course, pour t'y habituer." },
  { phase: "Spécifique", title: "Enchaînement samedi-dimanche", km: 58, easy: 90, long: 195, longClimb: 300, tip: "Enchaînement : footing la veille de la sortie longue, pour courir fatigué." },
  { phase: "Spécifique", title: "Semaine allégée", km: 42, easy: 45, long: 120, longClimb: 150, tip: "Semaine allégée avant le pic : ne rattrape rien.", light: true },
  { phase: "Spécifique", title: "Pic · 30 km sur chemins", km: 60, easy: 60, long: 210, longClimb: 350, tip: "La plus longue sortie du plan : en endurance, en marchant les côtes raides." },
  { phase: "Affûtage", title: "On garde le rythme", km: 48, easy: 55, long: 150, longClimb: 200, tip: "Le volume baisse, l'intensité reste : c'est normal de se sentir en forme." },
  { phase: "Affûtage", title: "Semi d'Orvault en endurance", km: 38, easy: 40, long: 0, longClimb: 0, tip: "Le semi n'est pas l'objectif : cours-le en endurance active, sans finir à fond." },
  { phase: "Affûtage", title: "Semaine de course", km: 15, easy: 25, long: 0, longClimb: 0, tip: "Dors, mange normalement, prépare ton sac dès jeudi.", light: true },
];

const RENFO_A: PlanBlock[] = [
  { label: "Squats", detail: "3 × 15, descente lente", duration: "6′" },
  { label: "Fentes avant", detail: "3 × 10 par jambe", duration: "6′" },
  { label: "Montées sur marche", detail: "3 × 12 par jambe, genou haut", duration: "6′" },
  { label: "Pont fessier", detail: "3 × 15", duration: "4′" },
  { label: "Gainage face + côtés", detail: "3 × 40 s chaque", duration: "6′" },
  { label: "Mollets", detail: "3 × 20 sur une marche", duration: "4′" },
];

const RENFO_B: PlanBlock[] = [
  { label: "Descentes de marche lentes", detail: "3 × 10 par jambe, 3 s pour descendre", duration: "6′" },
  { label: "Squat bulgare", detail: "3 × 8 par jambe, lent", duration: "6′" },
  { label: "Équilibre sur une jambe", detail: "3 × 40 s par jambe, yeux fermés ensuite", duration: "5′" },
  { label: "Chevilles à l'élastique", detail: "2 × 15 dans les 4 directions", duration: "5′" },
  { label: "Ischios (pont une jambe)", detail: "3 × 10 par jambe", duration: "4′" },
  { label: "Gainage dynamique", detail: "3 × 30 s de mountain climbers", duration: "4′" },
];

/** Au fil des phases, le renfo B gagne des petits sauts (pliométrie). */
function renfoB(phase: Phase): PlanBlock[] {
  if (phase === "Spécifique") {
    return [...RENFO_B.slice(0, 4), { label: "Sauts légers", detail: "3 × 20 petits sauts pieds joints, réception souple", duration: "5′" }, RENFO_B[5]];
  }
  return RENFO_B;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const PLAN_WEEKS: PlanWeek[] = WEEKS.map((w, i) => ({
  week: i + 1,
  phase: w.phase,
  monday: addDays(PLAN_START, i * 7),
  title: w.title,
  km: w.km,
  tip: w.tip,
  light: Boolean(w.light),
}));

/** Toutes les séances du plan, dans l'ordre de la semaine. */
export function plannedSessions(): PlannedSession[] {
  const out: PlannedSession[] = [];
  WEEKS.forEach((w, i) => {
    const week = i + 1;
    const q = QUALITY[i];
    const last = week === WEEKS.length;
    const renfoMinutes = w.phase === "Fondation" ? 30 : w.phase === "Affûtage" ? 25 : 35;
    const list: Omit<PlannedSession, "week" | "position">[] = [];

    list.push({
      kind: "course",
      title: last ? "Footing tranquille" : "Footing en endurance",
      summary: `${w.easy} min · 6:45–7:15 /km`,
      why: week === 11 ? "Le jour qui précède la sortie longue : on enchaîne pour courir sur jambes fatiguées." : "La base : du volume facile, sans fatigue.",
      blocks: [{ label: "Endurance fondamentale", detail: "6:45–7:15 /km, en aisance respiratoire", duration: `${w.easy}′` }],
      targetSeconds: minutes(w.easy),
      targetMeters: metersAt(minutes(w.easy), EASY_PACE),
      targetClimb: null,
    });

    list.push({
      kind: "renfo",
      title: "Renfo A · force & gainage",
      summary: `${renfoMinutes} min · 6 exercices`,
      why: "Des jambes et un tronc solides tiennent la foulée jusqu'au bout des 45 km.",
      blocks: RENFO_A,
      targetSeconds: minutes(renfoMinutes),
      targetMeters: null,
      targetClimb: null,
    });

    list.push({
      kind: "course",
      title: q.title,
      summary: `${q.minutes} min · ${q.summary}`,
      why: q.why,
      blocks: q.blocks,
      targetSeconds: minutes(q.minutes),
      targetMeters: metersAt(minutes(q.minutes), QUALITY_PACE),
      targetClimb: q.climb,
    });

    if (!last) {
      list.push({
        kind: "renfo",
        title: "Renfo B · excentrique & proprio",
        summary: `${renfoMinutes} min · descentes, chevilles`,
        why: "Peu de dénivelé autour de toi : c'est ici que les cuisses apprennent à encaisser les descentes.",
        blocks: renfoB(w.phase),
        targetSeconds: minutes(renfoMinutes),
        targetMeters: null,
        targetClimb: null,
      });
    }

    if (week === 15) {
      list.push({
        kind: "course",
        title: "Semi d'Orvault",
        summary: "21,1 km · endurance active, 6:00–6:15 /km",
        why: "À six jours du trail, le semi est une sortie longue encadrée : on ne le court pas à fond.",
        blocks: [
          { label: "Départ", detail: "laisse partir les autres, 6:15 /km", duration: "5 km" },
          { label: "Milieu", detail: "6:00–6:15 /km, en contrôle", duration: "13 km" },
          { label: "Fin", detail: "tu peux accélérer un peu si tout va bien", duration: "3 km" },
        ],
        targetSeconds: minutes(130),
        targetMeters: 21100,
        targetClimb: null,
      });
    } else if (last) {
      list.push({
        kind: "course",
        title: "EcoTrail Paris · 45 km",
        summary: "samedi 20 mars · 10 h · Versailles → Iéna",
        why: "Le jour J. Pars lentement, marche les côtes raides, mange toutes les 40 min.",
        blocks: [
          { label: "Départ", detail: "plus lent que tu ne crois, ≈ 7:30 /km", duration: "10 km" },
          { label: "Cœur de course", detail: "allure régulière, ravitaillements sans traîner", duration: "25 km" },
          { label: "Final", detail: "s'il reste du jus, c'est maintenant", duration: "10 km" },
        ],
        targetSeconds: minutes(330),
        targetMeters: 45000,
        targetClimb: 800,
      });
    } else {
      list.push({
        kind: "course",
        title: "Sortie longue",
        summary: `${formatMinutes(w.long)} · EF · boucle avec les côtes du coin`,
        why: "La sortie longue construit l'endurance du jour J. Bois toutes les 20 min et teste ce que tu mangeras en course.",
        blocks: [
          { label: "Mise en route", detail: "très facile, 7:15 /km et plus", duration: "10′" },
          { label: "Endurance fondamentale", detail: "6:45–7:15 /km · marche dans les côtes raides", duration: formatMinutes(w.long - 20) },
          { label: "Retour au calme", detail: "trot léger puis marche", duration: "10′" },
        ],
        targetSeconds: minutes(w.long),
        targetMeters: metersAt(minutes(w.long), LONG_PACE),
        targetClimb: w.longClimb,
      });
    }

    list.forEach((s, position) => out.push({ ...s, week, position }));
  });
  return out;
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total}′`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
