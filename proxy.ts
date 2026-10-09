import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, isAuthConfigured, verifyToken } from "@/lib/session";

/**
 * L'application entière est privée. Fermer au niveau du proxy plutôt que page
 * par page évite qu'une route ajoutée plus tard soit publique par oubli — le
 * défaut devient « fermé ». Seule exception : la page de connexion.
 */
const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path)) {
    return NextResponse.next();
  }

  // Sans mot de passe configuré, personne ne pourrait se connecter : les pages
  // affichent à la place un écran expliquant ce qui manque.
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  if (await verifyToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  /** Tout sauf les fichiers servis par Next, les icônes et le logo : la page de
   *  connexion en a besoin avant toute session. */
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|apple-icon.png|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|genki-logotype.svg).*)",
  ],
};
