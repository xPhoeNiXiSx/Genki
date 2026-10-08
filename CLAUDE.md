# Genki — conventions

## Langue

**Tout se dit en français** : les réponses, les messages de commit, les
commentaires du code et la documentation.

## Réponses courtes

**Être bref.** Quelques lignes : ce qui a été fait, puis la question s'il y en
a une, mise en évidence.

## Décisions produit qui reviennent à l'utilisateur

**Ne jamais pousser une modification graphique ou ergonomique sans que
l'utilisateur ait tranché.** Proposer des options concrètes — de préférence
visibles, pas décrites — et attendre son choix. Cela vaut pour la
typographie, la palette, la hiérarchie de l'information, l'ajout ou le retrait
d'éléments d'interface.

Les corrections de bugs visuels (débordement, texte tronqué, contraste
illisible) ne sont pas concernées : elles se corrigent directement.

## Thème et direction graphique

**Clair uniquement**, direction « Soleil × Piste » (proposition 4 des
maquettes Figma) : papier `#F3F2EB`, encre `#1A1A1D`, un seul accent, le jaune
volt `#D7FF3E`. Pas de thème sombre, pas de `prefers-color-scheme` à suivre.
Les variables vivent dans `app/globals.css`, `:root` déclare
`color-scheme: light`.

Polices : Dela Gothic One (titres, grands chiffres, katakana), Zen Kaku
Gothic New (texte), DM Mono (numéros, dates, durées).

La planche anatomique (`lib/anatomy.ts`, rendue par `app/ui/body-map.tsx`)
range chaque tracé sous une clé de `lib/muscles.ts` : un nouveau groupe
musculaire doit y recevoir son tracé.

## Règles techniques

- Les durées sont stockées en **secondes entières**.
- Le schéma de base vit dans `lib/schema.ts` et s'applique depuis
  l'application. La base n'est joignable que par les fonctions serveur.
- `npm test` rejoue les requêtes de production contre un Postgres en mémoire.
  À lancer avant chaque commit touchant à la couche données.

## Publication

**Tout part directement sur `main`**, qui est déployée en production par
Vercel. Pas de branche de travail qui traîne, pas de pull request en attente
de validation. Les vérifications (`npm run typecheck`, `npm test`,
`npm run build`) se font avant le push, pas après.
