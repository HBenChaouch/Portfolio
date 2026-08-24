# S11 — Preuve mobile reproductible

## Objet

Ce dossier documente exclusivement le rendu mobile de la home produite au commit source `bb6fd9c0446f9fc6bdf5a508da000c6087a60a2a`. Il ne modifie ni l'application, ni ses données, ni ses moteurs.

## Traçabilité Git

- baseline Sidetrade : `bb6fd9c0446f9fc6bdf5a508da000c6087a60a2a` ;
- baseline parent : `c28ec594c7edee37ba2fa33444fc48e51b5461e9` ;
- arbre de la baseline parent : `28aeb9c40e85770ae766f62e8c8f553e8a04ba8c`.

L'arbre parent ci-dessus remplace la valeur erronée `28aeb9c40e85770ae766f62e8c8c8776255de86` qui figurait dans la passation initiale. La chaîne de commits n'est pas modifiée par cette correction documentaire.

## Artefact servi

Le dossier `dist` préexistant a été servi sans reconstruction avec :

```powershell
python -m http.server 4190 --bind 127.0.0.1 --directory dist
```

Empreintes du bundle servi :

| Fichier | SHA-256 |
|---|---|
| `dist/index.html` | `2322051DD29A55CF946ADAFE826A07712E12EB611EF15E1C328C3609B2D7ACCE` |
| `dist/assets/index-BQM_EaRh.css` | `399FD7A2B7F1D6EAB9E3515FC362CB4FF2848BBC65EA6195A6A0449E1F6549B8` |
| `dist/assets/index-BTjUAFP9.js` | `2C4CB9255EA643D8A4E9E2AE32D0EFEF9BEC76C2F0388EBBA709A318970BFBFD` |

## Protocole

Pour chaque viewport, le navigateur intégré a :

1. fixé explicitement la largeur et la hauteur du viewport ;
2. chargé la home française par défaut ;
3. relevé la géométrie DOM de la page, du titre et des trois cartes ;
4. contrôlé le type de conteneur et le statut de chaque projet ;
5. calculé la part de surface occupée par Sidetrade dans la surface cumulée des trois cartes ;
6. enregistré une capture du viewport, sans capture pleine page.

Les mesures brutes et les hashes sont dans `mobile-layout-evidence.json`.

## Synthèse des mesures

| Viewport | Débordement horizontal | Bas Sidetrade | Bas secondaires | Toutes les cartes visibles | Part de surface Sidetrade |
|---|---:|---:|---:|---|---:|
| 360 × 800 | 0 px | 611,42 px | 751,55 px | oui | 64,38 % |
| 390 × 844 | 0 px | 620,08 px | 764,30 px | oui | 63,71 % |
| 430 × 932 | 0 px | 627,06 px | 760,06 px | oui | 65,56 % |

Dans les trois cas :

- Sidetrade porte le statut `Cas principal` ;
- Opella porte le statut `En développement`, est rendu par un `DIV`, sans lien, téléchargement ni descendant interactif ;
- Real Estate porte le statut `Cockpit opérationnel` ;
- le nom, l'école, l'adresse e-mail et le contrôle de langue sont présents dans le viewport ;
- le titre occupe trois lignes ;
- aucun identifiant dupliqué n'est relevé.

## Captures et hashes

| Capture | Dimensions PNG | Taille | SHA-256 |
|---|---:|---:|---|
| `mobile-360x800.png` | 360 × 800 | 47 750 octets | `7646883C65DDA2D1D4395E366836828C2D86009E3CBA2DC2F3262053C24F6293` |
| `mobile-390x844.png` | 390 × 844 | 49 095 octets | `58C56135F4904361A47C49A72FB2AE3C58C03DE5369714F5BE11F9E042724EDD` |
| `mobile-430x932.png` | 430 × 932 | 53 237 octets | `CB222FEF4E36457A01839F2768F1E6ACBD326A171F686B3657C90953473CD2E0` |

## Reproduction indépendante

Le dossier `dist` n'est pas versionné. Depuis un checkout propre dans lequel le commit de preuve est disponible, reconstruire d'abord le bundle :

```powershell
git clone https://github.com/HBenChaouch/Portfolio.git Sidetrade-audit
Set-Location Sidetrade-audit
git checkout 5bf27f3e347262277e1bd77298d2aa59f8be9808
npm ci
npm.cmd run build
```

Contrôler ensuite que la reconstruction produit les empreintes documentées, puis servir le dossier généré :

```powershell
Get-FileHash dist/index.html, dist/assets/index-BQM_EaRh.css, dist/assets/index-BTjUAFP9.js -Algorithm SHA256
python -m http.server 4190 --bind 127.0.0.1 --directory dist
```

Le commit `5bf27f3e347262277e1bd77298d2aa59f8be9808` ne diffère du commit source de la home que par les cinq artefacts de preuve sous `audit/s11/`. Si ce commit n'est pas encore disponible sur le remote, utiliser un checkout local propre de ce commit.

Ouvrir ensuite `http://127.0.0.1:4190/`, fixer successivement les viewports à 360 × 800, 390 × 844 et 430 × 932, puis comparer les captures et mesures aux artefacts versionnés. Le port 4190 n'est pas une dépendance : tout port local libre convient.
