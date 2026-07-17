# S7 — Non-régression financière

## Objet et périmètre

Cette passe gèle les outputs financiers de la V1 Sidetrade sans modifier les
inputs, formules, moteurs, conventions ou conclusions. Le workbook canonique
reste `Sidetrade_Valuation_2026_v2.xlsx`.

## Matrice de contrôle

| Domaine | Site / moteur JS | Workbook canonique | Règle S7 |
|---|---:|---:|---|
| DCF Bear EV | 157.888142 | 157.921888 | écart connu ≤ €0.15m |
| DCF Base EV | 301.124575 | 301.194526 | écart connu ≤ €0.15m |
| DCF Bull EV | 496.995044 | 497.115135 | écart connu ≤ €0.15m |
| Equity Base | 286.470575 | 286.540526 | même écart d’EV, dette nette identique |
| Prix Base | 186.408407 | 186.453924 | même écart d’EV, actions identiques |
| Market EV | 282.055460 | 282.055460 | égalité à 1e-6 |
| Sensibilité WACC 9.5% / g 2.5% | 301.124575 | 301.194526 | écart connu ≤ €0.15m |
| Sensibilité WACC 9.5% / sortie 15x | 413.101895 | 413.201026 | écart connu ≤ €0.15m |
| Marge linéaire EV | 301.124575 | 301.194526 | écart connu ≤ €0.15m |
| Marge front-loaded EV | 305.408403 | 303.621908 | algorithmes historiques distincts, écart gelé ≤ €2.5m |
| Marge back-loaded EV | 296.493181 | 298.712371 | algorithmes historiques distincts, écart gelé ≤ €2.5m |
| Trading comps | 171 / 202 / 264 | 171 / 202 / 264 | égalité exacte |
| Transaction comps | 289 / 411 / 547 | 289 / 411 / 547 | égalité exacte |
| LBO affordability Base | 222.5 / 241.9 / 283.5 | 222.5 / 241.9 / 283.5 | égalité d’affichage |
| Dette nette stricte | 14.654 | 14.654 | égalité exacte |
| Actions diluées | 1,536,790 | 1,536,790 | égalité exacte |

## Convention sur l’écart DCF

Le moteur JavaScript conserve les ancrages historiques arrondis `Revenue =
61.4` et `EBITDA = 13.4`. Excel utilise les valeurs statutaires exactes `61.416`
et `13.384`. Cette différence préexistait à S7 et explique les écarts limités
ci-dessus. S7 ne la corrige pas : une variation supérieure à `€0.15m` par
scénario est désormais traitée comme une nouvelle divergence.

Les sensibilités de marge utilisent également deux constructions historiques
distinctes : racine carrée / carré dans le moteur JavaScript, contre pondérations
annuelles explicites dans Excel. S7 gèle leurs outputs et une tolérance de
`€2.5m`, sans tenter de les remodéliser. Les grilles WACC / sortie n’ont par
ailleurs pas la même largeur de présentation ; leurs cellules centrales communes
sont rapprochées explicitement.

## Tests automatisés

La commande `npm.cmd run test:financial` couvre :

- les neuf sentinelles DCF EV / equity / prix par action ;
- tous les paramètres Bear / Base / Bull ;
- les cellules centrales et extrêmes WACC × croissance terminale ;
- les cellules centrales et extrêmes WACC × multiple de sortie ;
- les trois trajectoires de marge ;
- le cross-check FCF annuel pour chaque scénario ;
- l’equity bridge, le market EV et l’upside contrôle ;
- les fourchettes trading, transactions et LBO ;
- les principales sentinelles LBO ;
- la tolérance de rapprochement DCF site / Excel.

Le contrôle workbook en lecture seule couvre `Checks`, `Inputs`, `DCF`,
`Sensitivity`, `Margin_path`, `Trading_comps`, `Transaction_comps`, `LBO_full`,
`Football_field`, `Equity_bridge` et `FY25_base`, ainsi qu’une recherche des
erreurs Excel usuelles.

## Commandes reproductibles

```powershell
npm.cmd run test:financial
npm.cmd run build
& 'C:\Users\Abbah\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'lbo_engine.py'
Get-FileHash -Algorithm SHA256 -LiteralPath 'Sidetrade_Valuation_2026_v2.xlsx'
```

## Limites

- Les données de marché restent manuelles et datées du 15 juillet 2026.
- Le rapprochement DCF conserve volontairement la différence de précision
  historique entre le moteur JavaScript et Excel.
- Le LBO reste un test d’affordability produit par le moteur existant, pas un
  configurateur.
