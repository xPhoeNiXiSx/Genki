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

## Thème

**Sombre uniquement.** Pas de thème clair à maintenir, pas de
`prefers-color-scheme` à suivre. Les variables de `app/globals.css` portent
directement les valeurs sombres, et `:root` déclare `color-scheme: dark`.

## Règles techniques

- Les durées sont stockées en **secondes entières**.
- Le schéma de base vit dans `lib/schema.ts` et s'applique depuis
  l'application. La base n'est joignable que par les fonctions serveur.
- `npm test` rejoue les requêtes de production contre un Postgres en mémoire.
  À lancer avant chaque commit touchant à la couche données.

## Publication

`main` est déployée en production par Vercel. Les vérifications
(`npm run typecheck`, `npm test`, `npm run build`) se font avant le push, pas
après.
