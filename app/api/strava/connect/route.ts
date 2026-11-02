import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { authorizeUrl, isStravaConfigured, newState } from "@/lib/strava";

/** Envoie vers Strava pour autoriser Genki à lire les activités. */
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) redirect("/login?next=/compte");
  if (!isStravaConfigured()) redirect("/compte?strava=config");
  redirect(authorizeUrl(request.nextUrl.origin, await newState()));
}
