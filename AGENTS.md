# Instructions locales — Sidetrade / Portfolio

Les instructions du `AGENTS.md` racine restent applicables.

## Source de vérité

- Application React/Vite dans `src/`.
- Scripts de contrôle dans `scripts/`.
- Workbook canonique : `Sidetrade_Valuation_2026_v2.xlsx`.
- `dist/` est généré et ne doit jamais être édité ou committé.

## Commandes

Tests ciblés via les scripts `npm` de `package.json`.
Recette finale :

```powershell
npm.cmd run test:quality
```

Pour GitHub Pages, construire et tester dans le même environnement :

```powershell
$env:GITHUB_ACTIONS='true'
$env:CI='true'
npm.cmd run test:quality
```

## Intégration Cockpit

- Le Cockpit est copié par `scripts/integrate-real-estate-case.mjs`.
- Les pins doivent correspondre au commit Cockpit autorisé.
- Ne jamais bumper un pin sans commit Cockpit vérifié.
- Toute modification du pin exige le gate d’intégration et la mise à jour du
  gitlink Sidetrade dans le parent.

## Intégration Opella inactive

- `integrations/opella/manifest.json` ferme le bundle ; les valeurs financières
  vivent uniquement dans `snapshot.json`.
- Régénérer le bundle depuis `Sidetrade/` avec
  `node scripts/integrate-opella-case.mjs`.
- Le contrôle interne est agrégé à `test:financial`. Depuis le dépôt parent,
  le contrôle croisé s’exécute avec
  `node Sidetrade/scripts/check-opella-integration.mjs --source "Transaction Services"`.
- Ce bundle interne n’autorise ni route, ni CTA actif, ni téléchargement, ni
  copie du workbook sous `public/`.

## Efficacité

- Ne pas afficher le JSON complet de `test:navigation:browser` en succès.
- Pour une modification limitée aux commentaires ou tests, vérifier d’abord le
  diff puis choisir des tests proportionnés.
