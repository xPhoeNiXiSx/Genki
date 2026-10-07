# Genki

**En ligne :** https://genki-eight.vercel.app

Application personnelle de sport : métronome de course, bibliothèque
d'exercices, programmes à timers enchaînés, mode séance et suivi. Les
spécifications sont dans le doc « Spécifications – Genki (web / PWA) ».

**L'application entière est privée.** Toute route autre que la page de
connexion redirige vers celle-ci tant que la session n'est pas ouverte. La
fermeture se fait dans `proxy.ts`, pour qu'une route ajoutée plus tard soit
fermée par défaut. La connexion est freinée au-delà de 5 mots de passe faux en
15 minutes depuis une même adresse (`lib/throttle.ts`).

Installée sur l'écran d'accueil de l'iPhone (Safari → Partager → Sur l'écran
d'accueil), elle s'ouvre en plein écran grâce au manifeste (`app/manifest.ts`).

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Postgres** (Neon), schéma dans `lib/schema.ts`, appliqué depuis
  l'application (Mon compte → Appliquer les migrations)

## Configuration Vercel

Variables d'environnement à poser (Settings → Environment Variables) :

- `DATABASE_URL` — chaîne de connexion Neon
- `APP_PASSWORD` — le mot de passe de connexion
- `AUTH_SECRET` — une longue chaîne aléatoire, qui signe la session

## Développement

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de production
npm run typecheck  # tsc --noEmit
npm test           # couche données, sur un Postgres en mémoire (PGlite)
```
