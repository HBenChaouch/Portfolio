# S1 — Cartographie de l’interface actuelle

**Statut :** spécification d’architecture éditoriale, sans modification applicative ni financière
**Baseline analysée :** dépôt Sidetrade, commit `c92db888287ea638d1fa73fc25cec6b34f42c60e`
**Sources fonctionnelles :** `src/App.jsx`, `src/routes/PortfolioHome.jsx`, `src/routes/AnalysisView.jsx`, `src/components/CaseShell.jsx`, `src/data/portfolioCases.js`, `src/data/sidetradeCase.js`, `src/utils/dcfEngine.js`, `src/styles/global.css`
**Sources financières de référence, inchangées :** `Sidetrade_Valuation_2026_v2.xlsx`, `lbo_engine.py`, note QoE auditée dans `../Transaction Services/`

## 1. Objet et règle de cette passe

Cette cartographie fixe la future architecture de l’information avant toute refonte de composants. Elle répond à six questions :

1. quel contenu actuel est conservé ;
2. quel contenu est déplacé ;
3. quel contenu est fusionné ou supprimé parce qu’il répète une information déjà présentée ;
4. où et comment intégrer la nouvelle section QoE ;
5. quelles valeurs sont calculées et quelles valeurs sont hardcodées ;
6. quel parcours doit être obtenu sur desktop et sur mobile.

La suppression décrite ci-dessous signifie « supprimer une répétition de l’interface cible », jamais supprimer une analyse, une source ou une convention financière. Aucun chiffre, formule, scénario, multiple, définition ou résultat financier n’est modifié par S1.

## 2. Carte de l’interface actuelle

### 2.1 Routes existantes

| Route actuelle | Contenu | Décision cible |
|---|---|---|
| `/` | Hero portfolio et trois cartes, dont deux placeholders | Conserver la route ; remplacer la hiérarchie et les projets lors d’une passe ultérieure |
| `/cases/sidetrade-valuation` | Shell Sidetrade et analyse complète | Conserver comme route canonique du projet |
| `/cases/sidetrade-valuation/analysis` | Même analyse complète | Conserver comme alias compatible ou rediriger vers la route canonique |
| `*` | Redirection vers `/` | Conserver |

Il n’existe actuellement aucune route Opella ni Real Estate dans l’application React.

### 2.2 Structure Sidetrade actuelle

| Ordre actuel | Bloc | Localisation actuelle | Observation |
|---:|---|---|---|
| 0 | Shell projet | `CaseShell.jsx` | Sidebar fixe, contrôle scénario, date statique et retour « Workspace » |
| 1 | Hero de synthèse | `AnalysisView.jsx` | Thèse DCF/contrôle, quatre KPI FY25 |
| 2 | Company snapshot | `#snapshot` | Profil société, P&L, OCF/FCF, qualité du revenu |
| 3 | Market sanity check | `#market` | Prix, capitalisation, EV marché, upside DCF et contrôle |
| 4 | DCF | `#dcf` | Scénarios, trajectoires, hypothèses, sensibilités et méthodologie |
| 5 | Trading comps | `#trading` | Peers, multiples, fourchette et méthodologie |
| 6 | Transaction comps | `#transaction` | Précédents, benchmarks internes, fourchette et méthodologie |
| 7 | LBO affordability | `#lbo` | Résultat moteur, hypothèses et fourchette ; pas de configurateur |
| 8 | Football field | `#football` | Quatre méthodes, repères marché/stand-alone/contrôle et bridge equity |
| 9 | Caveats & limits | `#caveats` | Limites méthodologiques et spécificités comptables |
| 10 | Sources | `#sources` | Trois documents publics téléchargeables |
| 11 | Footer | fin de page | Auteur, sources répétées, date marché, disclaimer |

## 3. Architecture cible Sidetrade

La profondeur actuelle est conservée, mais regroupée en quatre chapitres lisibles.

### Chapitre A — Investment case et qualité financière

1. **Executive view** — thèse, trois repères de valorisation maximum et avertissement de date de marché.
2. **Company & revenue quality** — business model, mix abonnements/services, récurrence, clients, géographie et croissance.
3. **Quality of Earnings — nouvelle section** — pont EBITDA, CIR, ajustements, conversion cash et points d’attention.
4. **Cash conversion & CIR** — OCF, FCF statutaire, FCF normalisé, BFR et convention de timing.
5. **Market reference** — prix, capitalisation, dette nette, EV marché et comparaison au DCF.

### Chapitre B — Valuation

6. **DCF Bear/Base/Bull** — moteur JavaScript existant, trajectoire, outputs et sensibilités.
7. **Trading comps** — table complète, agrégats, fourchette et limites de comparabilité.
8. **Transaction comps** — table complète, contrôle, benchmarks internes et limites.
9. **LBO affordability** — résultat du moteur audité, principales hypothèses et sensitivité déjà disponible ; aucun configurateur complet.

### Chapitre C — Synthesis

10. **Football field** — quatre méthodes et repères marché/stand-alone/contrôle.
11. **EV → Equity → Share price** — bridge complet et nombre d’actions diluées.
12. **Red flags & diligence priorities** — registre synthétique, distinct des limites méthodologiques.

### Chapitre D — Audit trail

13. **Conventions & limitations** — conventions comptables, limites, avertissements et données à rafraîchir.
14. **Methodology** — formules, construction des scénarios et méthodes de valorisation sous accordéons.
15. **Sources** — documents primaires, date de valeur, source workbook/note et politique de mise à jour manuelle.

## 4. Matrice de décision sur le contenu

### 4.1 Contenu conservé

| Contenu actuel | Décision | Destination cible |
|---|---|---|
| Thèse stand-alone / contrôle | Conserver | Executive view |
| Revenue, abonnements, EBITDA et dette nette FY25 | Conserver | Executive view et Company & revenue quality, une occurrence principale par information |
| Profil O2C SaaS, présence internationale et qualité client | Conserver | Company & revenue quality |
| P&L FY25 détaillé | Conserver | Company & revenue quality, disclosure « Financial snapshot » |
| OCF/FCF statutaire et normalisé | Conserver intégralement | Cash conversion & CIR |
| Narratif CIR et timing par millésime | Conserver | QoE puis détail dans Cash conversion & CIR |
| Référence marché datée | Conserver | Market reference |
| DCF Bear/Base/Bull et moteur JS | Conserver intégralement | DCF |
| Sensibilités WACC × g et WACC × multiple | Conserver | DCF, sous-blocs lisibles |
| Trading comps | Conserver intégralement | Trading comps |
| Transaction comps | Conserver intégralement | Transaction comps |
| LBO affordability audité | Conserver intégralement | LBO affordability |
| Football field | Conserver | Synthesis |
| Bridge EV/equity/prix par action | Conserver | Section autonome après football field |
| Caveats comptables et méthodologiques | Conserver | Conventions & limitations |
| Trois sources publiques | Conserver | Sources |
| Disclaimer et identité auteur | Conserver | Footer allégé |

### 4.2 Contenu déplacé

| Contenu | Emplacement actuel | Nouvel emplacement | Motif |
|---|---|---|---|
| Qualité du revenu | Mélangée au snapshot | Section Company & revenue quality dédiée | Rendre le raisonnement TS immédiatement lisible |
| OCF/FCF et détail CIR | Au milieu du snapshot | QoE pour la conclusion, Cash conversion & CIR pour le détail | Séparer résultat de diligence et mécanique de cash |
| Spécificités comptables | Caveats en fin de page | Red flags pour les risques, Conventions & limitations pour la méthode | Distinguer risque transactionnel et limite analytique |
| Méthodologie DCF | Accordéon attaché au DCF | Reste attachée au DCF, plus index global Methodology | Préserver le contexte tout en améliorant la navigation |
| Méthodologies comps et LBO | Après chaque méthode | Accordéons locaux, référencés dans Methodology | Éviter un long appendice déconnecté |
| Bridge EV/equity/share price | Sous le football field | Section autonome immédiatement après | Donner un point d’arrêt clair à la chaîne de valeur |
| Date de marché | Market card et footer | Avertissement global + Market reference + Sources | Une convention visible, sans répétition dans chaque paragraphe |

### 4.3 Contenu fusionné ou supprimé car répétitif

| Répétition actuelle | Décision cible |
|---|---|
| Les repères DCF, marché et contrôle apparaissent dans le hero, la market card, le football field, trois cartes de synthèse et le strategic read | Garder un résumé dans le hero, la preuve dans les sections concernées et le récapitulatif dans le football field ; supprimer les cartes de synthèse redondantes |
| Les fourchettes trading, transaction et LBO sont répétées dans leurs tables, result strips, football field et prose | Garder la table source, un callout de conclusion et le football field ; supprimer les result strips purement duplicatifs lorsque la table est immédiatement visible |
| Le positionnement « affordability, not fair value » est répété dans le titre, la prose, la méthodologie et les caveats | Garder un label permanent dans le bloc LBO et une explication dans sa méthodologie |
| La liste des sources est répétée dans la section Sources et le footer | Garder le registre complet dans Sources ; réduire le footer à l’auteur, au disclaimer et à la date de mise à jour |
| `scenarioMeta` et `scenarioCopy` portent deux narratifs Bear/Base/Bull | Fusionner ultérieurement dans une seule source de contenu |
| Plusieurs styles legacy (`summary-*`, `subpage-*`, anciens composants dashboard) coexistent avec `.analysis-view` | Inventorier leur usage avant suppression ; retirer uniquement les sélecteurs prouvés inutilisés lors d’une passe code dédiée |
| Les boutons de contrôle sans action `€ ▾` et `…` occupent la barre | Les supprimer jusqu’à ce qu’une fonction réelle soit définie |
| La date `09 May 2025`, `Updated May 2026` et la date marché 15/07/2026 créent trois temporalités concurrentes | Remplacer ultérieurement par une convention unique : « modèle / données marché / dernière mise à jour » |

## 5. Nouvelle section QoE

### 5.1 Position et rôle

La section **Quality of Earnings** se place après **Company & revenue quality** et avant **Cash conversion & CIR**. Elle ne crée aucune nouvelle définition : elle présente visuellement les chiffres et distinctions déjà audités dans la note QoE et le workbook.

### 5.2 Contenu proposé

1. **Conclusion QoE en une phrase** — profil de qualité, avec dépendance matérielle au CIR et effets d’intégration à confirmer.
2. **Pont EBITDA publié → ajusté** — publié incluant CIR ; ajustements estimés ; ajusté incluant CIR ; lecture hors CIR.
3. **Deux définitions hors CIR clairement séparées** — EBITDA publié hors CIR et EBITDA ajusté hors CIR.
4. **Qualité du revenu** — mix abonnements/services, croissance publiée/organique, concentration et qualité client.
5. **Conversion en cash** — OCF communiqué, FCF statutaire, normalisation du timing CIR et FCF économique.
6. **Red flags QoE** — CIR, ezyCollect pro forma, fiscalité normative, BFR/créance CIR et éléments à confirmer en data room.
7. **Conventions et limites** — données publiques, ajustements estimés, absence de data room et absence de nouvelle définition financière.

### 5.3 Valeurs de référence à afficher ultérieurement, sans modification en S1

| Élément | Valeur de référence | Source actuelle |
|---|---:|---|
| EBITDA publié incluant CIR | 13,4 M€ | Note QoE auditée / FY25 |
| CIR | 3,5 M€ | Note QoE auditée / FY25 |
| EBITDA publié hors CIR | ≈ 9,9 M€ | Note QoE auditée |
| EBITDA ajusté incluant CIR | ≈ 14,2 M€ | Note QoE auditée |
| EBITDA ajusté hors CIR | ≈ 10,7 M€ | Note QoE auditée |
| EBITDA ajusté pro forma incluant CIR | ≈ 13,7–14,7 M€ | Note QoE auditée, à confirmer |
| OCF communiqué hors timing CIR | 8,7 M€ | Note QoE / PR FY25 |
| FCF statutaire | 4,216 M€ | Workbook FY25_base |
| FCF normalisé | 7,163 M€ | Workbook FY25_base |

Les valeurs estimées doivent conserver un marqueur visuel « e » ou « à confirmer ». Le pont ne doit jamais faire passer l’EBITDA publié hors CIR de 9,9 M€ pour l’EBITDA ajusté hors CIR de 10,7 M€.

## 6. Valeurs calculées vs hardcodées dans l’interface actuelle

### 6.1 Calculées à l’exécution

| Famille | Calcul actuel | Fichier |
|---|---|---|
| Trajectoires de scénario | Revenue, EBITDA, EBIT, FCF, marges 2026–2030 | `src/utils/dcfEngine.js` |
| DCF | PV des FCF, valeur terminale Gordon et EV | `src/utils/dcfEngine.js` |
| Sensibilités | WACC × g et WACC × multiple de sortie | `src/utils/dcfEngine.js` |
| Equity bridge | EV − dette nette, puis prix par action | `src/utils/dcfEngine.js` |
| Contrôle FCF | EBITDA et EBIT donnent le même FCF | `src/utils/dcfEngine.js` |
| Affichage scénario | KPI, trajectoire, heatmap, bridge et barre DCF | `AnalysisView.jsx` |

### 6.2 Hardcodées mais centralisées

| Famille | État actuel | Fichier |
|---|---|---|
| Ancres FY25 | Constantes JS | `src/utils/dcfEngine.js` |
| Hypothèses Bear/Base/Bull | Constantes JS | `src/utils/dcfEngine.js` |
| Fourchettes trading/transaction/LBO | `VALUATION_CONTEXT` | `src/utils/dcfEngine.js` |
| Prix de marché et EV contrôle | `VALUATION_CONTEXT` | `src/utils/dcfEngine.js` |
| Métadonnées narratives des scénarios | Objet séparé | `src/data/sidetradeCase.js` |

### 6.3 Hardcodées et dupliquées dans la présentation

| Famille | Exemples actuels | Risque d’interface |
|---|---|---|
| KPI FY25 | Revenue, abonnements, EBITDA, dette nette | Divergence avec le moteur ou le workbook |
| Référence marché | Prix, capitalisation, EV et upside | Mise à jour manuelle incomplète |
| Comps | Multiples, fourchettes et conclusions | Table et synthèse peuvent diverger |
| LBO | Hypothèses et affordability | Résultat moteur recopié à plusieurs endroits |
| Football field | Repères 301/410/282 et bases de méthodes | Mélange de valeurs dynamiques et statiques |
| Wording daté | Dates et version | Incohérence de temporalité |
| Home | 301/410 dans les chips | Divergence avec la page projet |

### 6.4 Règle cible

- Une valeur financière de base doit être définie dans une seule source JS auditable.
- Une valeur dérivée doit être calculée, pas recopiée dans le JSX.
- Le wording peut arrondir une valeur, mais doit recevoir la valeur depuis la même source.
- Les résultats LBO restent des constantes importées depuis le dernier moteur audité, avec date de génération et sentinelles ; ils ne deviennent pas un configurateur.
- Les données de marché restent manuelles, datées et regroupées dans un seul objet de référence.
- La prochaine passe touchant ces données devra exécuter les tests financiers avant et après.

## 7. Parcours desktop cible

### 7.1 Portfolio

1. Arrivée sur une home sobre à trois projets.
2. Sidetrade porte 60–65 % de la hiérarchie visuelle.
3. Opella est présenté en deuxième, avec un angle carve-out / TS.
4. Real Estate est présenté en troisième et explicitement nommé.
5. Chaque carte expose une promesse analytique, pas une accumulation de badges.

### 7.2 Projet Sidetrade

1. Barre globale : **« ← Portfolio »** puis panneau **« Choisir un projet »**.
2. Navigation locale sticky par chapitres A–D.
3. Executive view visible sans interaction.
4. Les conclusions de chaque méthode restent visibles ; détails, méthodologies et longues tables peuvent être ouverts sans changer de route.
5. Le scénario DCF reste accessible depuis le chapitre DCF et garde son état pendant la lecture.
6. La synthèse aboutit au football field puis au bridge EV/equity/share price.
7. Red flags, conventions et sources ferment le parcours sans répéter la thèse.
8. Le retour Portfolio reste visible sans dépendre du bouton précédent du navigateur.

## 8. Parcours mobile cible

### 8.1 Principes

- Aucune sidebar desktop permanente.
- En-tête compact sticky avec **« ← Portfolio »** et **« Choisir un projet »**.
- Navigation locale sous forme de rail horizontal accessible ou de sommaire déroulant, sans masquer le contenu.
- Une seule colonne de lecture.
- La hiérarchie éditoriale de l’option A est conservée ; les scénarios, disclosures et accordéons suivent la logique web-native de l’option B.
- Les accordéons réduisent la longueur perçue mais ne suppriment aucun contenu analytique.

### 8.2 Comportement des contenus denses

| Contenu | Comportement mobile cible |
|---|---|
| KPI | Grille 2 × 2 ou pile compacte, sans cartes décoratives excessives |
| Pont QoE | Étapes verticales reliées, puis table complète accessible |
| Tableaux financiers | Conteneur horizontal annoncé, première colonne lisible, unités répétées dans l’en-tête |
| Sélecteur Bear/Base/Bull | Contrôle segmenté pleine largeur |
| Graphiques | SVG responsive, labels simplifiés mais valeurs complètes accessibles |
| Sensibilités | Scroll horizontal contrôlé, cellule active annoncée textuellement |
| Football field | Labels au-dessus des barres ou vue verticale ; aucune largeur fixe desktop |
| Méthodologie, sources et limites | Accordéons natifs avec intitulés explicites |

### 8.3 Parcours mobile attendu

1. Portfolio → carte Sidetrade.
2. Executive view → Company & revenue quality → QoE.
3. Cash conversion → Market reference.
4. DCF avec changement de scénario.
5. Comps et LBO, détails à la demande.
6. Football field → equity bridge.
7. Red flags → conventions → sources.
8. Retour permanent vers Portfolio.

## 9. Critères d’acceptation de la cartographie S1

- Chaque bloc actuel est identifié et possède une décision : conserver, déplacer, fusionner ou supprimer comme répétition.
- La nouvelle section QoE a une position, un rôle, un contenu, des sources et des limites explicites.
- Les valeurs calculées, centralisées et dupliquées sont distinguées.
- Les parcours desktop et mobile sont décrits de bout en bout.
- La profondeur DCF, comps, LBO, football field, bridge, caveats et sources est explicitement préservée.
- Le LBO demeure un résultat du moteur audité, sans configurateur complet.
- Aucune API de marché live n’est introduite.
- Aucun fichier applicatif, workbook, moteur ou livrable financier n’est modifié dans S1.

## 10. Hors périmètre S1

- implémentation React/CSS de la nouvelle architecture ;
- modification de route ;
- correction ou centralisation d’une valeur financière ;
- modification du workbook canonique ;
- modification du moteur DCF ou LBO ;
- génération d’un nouveau calcul QoE ;
- modification des fichiers Opella ou Real Estate ;
- build de production, publication ou déploiement.
