# Statut du site Sidetrade

**v2 — RESYNCHRONISÉ le 15/07/2026 — présentable.**

Le site (src/ + dist/) est aligné sur le workbook v2 et la valorisation au 15/07/2026 :

- **LBO** : 4,0x / 7,2% all-in / sweep 75% + 1% amort / exit 15x ; fourchette affordability 222,5 / 241,9 / 283,5 M€ (moteur lbo_engine.py, CIR single-count).
- **Trading comps** : peers rafraîchis au 15/07/2026 (BL 2,4x / BILL 2,4x / NCNO 3,2x / WK 2,8x fwd sales), fourchette 171 / 202 / 264 M€ ; Q2 Holdings et SPS Commerce marqués non rafraîchis.
- **Transaction comps** : 289 / 411 / 547 M€ ; multiples EV/EBITDA de contrôle passés en n.m. (Esker n.d., Coupa breakeven).
- **Market reference remplie** : 174,00 € (15/07/2026) × 1,537m actions diluées + 14,7 M€ DN stricte ≈ 282 M€ EV ; narratif « DCF 301 ≈ +7% vs marché ; peers dératés = plancher de sentiment ; débat de prime assumé » (plus de « convergence »).
- **Placeholders [A]/[B]/[X]/[Y]/[Z]/[DATE] remplis** ; wording CIR corrigé (« statutory mechanism, subject to tax audit » au lieu de « guaranteed by the French State ») ; décalage CIR requalifié en effet de timing par millésime.

**Vérification** : page /cases/sidetrade-valuation/analysis servie et scannée en navigateur le 15/07/2026 — 0 valeur périmée sur 16 tokens surveillés, 20/20 nouvelles valeurs rendues, console sans erreur.

**Caveat technique** : `dist/` a été patché en place (Node/npm absents de la machine → rebuild impossible). `src/` porte les mêmes corrections. À la prochaine installation de Node : `npm install && npm run build` pour régénérer proprement dist depuis src, puis re-vérifier. NB : servir le site avec un fallback SPA (les routes /cases/... nécessitent une réécriture vers index.html).

L'ancien standalone `Sidetrade Valuation (1).html` reste NON resynchronisé — ne pas présenter (archive).

Historique : v1 archivée le 15/07/2026 au matin (ancien LBO simplifié 3,5x/6,5%/sweep 100%/exit 18x, fourchette 135-283-455, placeholders visibles — cf. NOTE_CONSOLIDEE_AUDITS_PORTFOLIO.md §5).
