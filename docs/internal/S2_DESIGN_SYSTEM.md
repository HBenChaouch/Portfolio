# S2 — Design system Sidetrade

**Baseline applicative :** `ac9e9b8a3b1e7b48c482a6bafd95db87817f4218`
**Direction gelée :** environ 70 % option B / 30 % option A
**Périmètre :** présentation, responsive et accessibilité ; aucune donnée ou logique financière

## 1. Principes

1. **B structure l’expérience.** Navigation web-native, scénarios immédiatement manipulables, tableaux et graphiques lisibles, accordéons natifs et adaptation mobile explicite.
2. **A règle le ton.** Fond crème, bordeaux retenu, titres serif, corps sans-serif, lignes fines, espace et peu d’effets décoratifs.
3. **La densité reste analytique.** Le système organise l’information financière ; il ne transforme pas Sidetrade en landing marketing.
4. **Une hiérarchie avant des cartes.** Les séparateurs, groupes et respirations sont préférés à l’empilement de conteneurs arrondis.
5. **Les chiffres restent neutres.** Les couleurs différencient scénarios et statuts, jamais une nouvelle conclusion financière.

## 2. Couleurs

| Token | Valeur | Usage |
|---|---:|---|
| `--bg` | `#FAF7F2` | Fond principal crème |
| `--bg-alt` | `#F3EEE4` | Sections secondaires, en-têtes de tableaux |
| `--bg-card` | `#FFFFFE` | Surfaces nécessitant un détachement réel |
| `--ink` | `#161D2B` | Texte principal et tracés structurants |
| `--ink-2` | `#2A3142` | Corps de texte |
| `--ink-3` | `#5B6271` | Métadonnées et labels |
| `--bordeaux` | `#7A1F2B` | Accent principal, Base case et focus de marque |
| `--bear` | `#6E7480` | Scénario Bear |
| `--bull` | `#2D5C3D` | Scénario Bull |
| `--market` | `#8C6A1A` | Référence de marché datée |

Le bordeaux n’est pas une couleur décorative générale : il identifie l’accent éditorial, le scénario Base et les repères centraux. Les surfaces de scénarios utilisent des fonds pâles distincts en complément du texte, de sorte que la couleur ne porte jamais seule l’information.

## 3. Typographies

- **Titres :** Newsreader, puis Georgia/serif en fallback.
- **Corps et contrôles :** IBM Plex Sans, puis polices système.
- **Chiffres, labels et métadonnées :** IBM Plex Mono, avec chiffres tabulaires.
- **Échelle :** titres fluides via `clamp()`, corps 15–19 px, labels 10–12 px.
- **Règle :** pas de corps serif long ; pas de capitales espacées pour les paragraphes.

## 4. Espacements et géométrie

Échelle commune : `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px`, exposée par `--space-1` à `--space-8`.

- Largeur analytique maximale : `1180px`.
- Cible tactile minimale : `44px` pour les contrôles principaux.
- Rayon : `2px` par défaut, `4px` au maximum pour les surfaces fonctionnelles.
- Ombres : réservées aux éléments réellement superposés ; les cartes de contenu restent plates.
- Séparation : lignes fines et espace avant bordures multiples.

## 5. Cartes et surfaces

- Les groupes de trois cartes deviennent une composition éditoriale reliée par des lignes.
- Une surface blanche est réservée aux graphiques, tableaux, marché et résultats qui nécessitent un plan distinct.
- Les cartes de sources conservent un état hover/focus discret.
- Les callouts stratégiques utilisent une ligne bordeaux, sans ombre ni dégradé spectaculaire.

## 6. Tableaux

- En-têtes monospace sur fond crème secondaire.
- Chiffres tabulaires et alignement à droite pour les colonnes numériques.
- Zébrage faible et survol bordeaux pâle.
- Conteneurs denses navigables au clavier, nommés pour les technologies d’assistance.
- Défilement horizontal contenu sur petit écran ; aucune table ne doit élargir le viewport.
- Les cellules actives des sensibilités combinent fond, contraste et contexte textuel.

## 7. Graphiques

- Revenue : encre bleutée sombre ; EBITDA/Base : bordeaux ; Bear : gris ; Bull : vert ; marché : ocre.
- Traits et grilles fins ; pas d’aplat décoratif dominant.
- Les SVG utilisent des titres et descriptions accessibles.
- Les valeurs importantes restent disponibles sous forme textuelle ou dans les tableaux associés.
- Sur mobile, les visualisations complexes défilent dans leur propre conteneur au lieu de comprimer les labels.

## 8. Accordéons

- Élément HTML `details/summary` natif.
- Cible minimale de 44 px.
- Indicateur `+ / –`, état ouvert contrasté et focus visible.
- Le résumé décrit le contenu ; aucune action cachée derrière une icône seule.
- Le contenu méthodologique conserve sa largeur de lecture et s’imprime ouvertement.

## 9. Boutons et contrôles

- Les scénarios utilisent un contrôle segmenté et exposent `aria-pressed` ou `aria-selected`.
- Les contrôles sans action réelle sont retirés.
- Hover, actif et focus sont distincts.
- Le focus clavier utilise une bague bordeaux visible sur fond clair et sombre.
- La navigation globale affiche toujours `← Portfolio` et `Choisir un projet`.

## 10. Responsive

### Desktop — au-dessus de 900 px

- Sidebar fixe de projet.
- Barre de contrôle sticky.
- Contenu analytique jusqu’à 1180 px.
- Grilles multi-colonnes lorsque la comparaison simultanée apporte une valeur réelle.

### Tablette et mobile — 900 px et moins

- La sidebar devient un en-tête sticky compact.
- `← Portfolio` et `Choisir un projet` restent visibles.
- Les sections deviennent un rail horizontal défilable.
- Le contenu passe en une colonne ; les groupes de KPI utilisent deux colonnes puis une colonne étroite.
- Tableaux, football field et SVG denses défilent localement.
- Aucun décalage latéral de page n’est attendu.

### Petit mobile — 420 px et moins

- Le titre secondaire de la barre de contrôle est masqué.
- KPI et result strips passent à une colonne.
- Les contrôles de scénario restent utilisables sur toute la largeur.

## 11. Accessibilité

- Lien d’évitement vers l’analyse.
- Focus `:focus-visible` systématique.
- `aria-current` sur la section active.
- États de scénarios exposés aux technologies d’assistance.
- Tables scrollables nommées et focusables.
- Titres/descriptions SVG et résumé textuel de la trajectoire.
- Prise en charge de `prefers-reduced-motion` et `prefers-contrast: more`.
- Navigation et cibles tactiles dimensionnées pour clavier et mobile.
- La couleur n’est jamais le seul vecteur de statut.

## 12. Hors périmètre S2

- modification d’une valeur, formule ou convention financière ;
- modification des moteurs DCF et LBO ;
- création de la section QoE définie en S1 ;
- réarchitecture éditoriale des sections ;
- création des projets Opella et Real Estate ;
- mise à jour de données de marché ;
- publication ou déploiement.
