import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { matchActivities } from "@/lib/plan";
import { PLAN_START } from "@/lib/plan-data";
import { connectStrava, isStravaConfigured, syncStrava, verifyState } from "@/lib/strava";

/**
 * Retour de Strava. Public (l'appli installée peut l'ouvrir hors de sa
 * session) : l'état signé prouve que la demande vient de Genki.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isStravaConfigured() || !(await verifyState(params.get("state")))) redirect("/compte?strava=refus");
  const code = params.get("code");
  if (params.get("error") || !code) redirect("/compte?strava=annule");
  // Lire les activités privées est nécessaire : Strava laisse décocher la case.
  if (!params.get("scope")?.includes("activity:read")) redirect("/compte?strava=droits");

  try {
    await connectStrava(code);
  } catch {
    redirect("/compte?strava=erreur");
  }
  // Premier import : depuis le début du plan. Un échec ici n'annule pas la
  // connexion, la prochaine synchro rattrapera.
  await syncStrava(new Date(`${PLAN_START}T00:00:00Z`), matchActivities).catch(() => undefined);
  redirect("/compte?strava=ok");
}
