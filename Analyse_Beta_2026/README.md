# Analyse du bêta Sidetrade — 15 juillet 2026

Ce dossier isole la justification statistique du bêta utilisé dans le WACC du modèle Sidetrade. Il ne modifie pas le fichier de valorisation existant.

## Résultat

- Bêta relevered central issu des comparables : **1,06x**.
- Sensibilité avec indices alternatifs : **0,71x**.
- Bêta actuellement utilisé dans le modèle : **1,15x**.
- Le bêta du modèle est donc prudent : il ajoute environ **0,50 point** au coût des fonds propres avec un ERP de 5,5%.
- Le bêta propre de Sidetrade contre le CAC 40 est **0,18x**, avec un R² de **0,44%** et une p-value de **0,504**. Il n'est pas statistiquement significatif et n'est utilisé que comme contrôle.

## Méthode

- Fenêtre de prix : 12 juillet 2024 au 10 juillet 2026.
- 105 cours hebdomadaires ajustés et 104 rendements logarithmiques.
- La semaine incomplète contenant le 15 juillet 2026 est volontairement exclue.
- Sidetrade est régressée contre le CAC 40 ; les comparables américains contre le S&P 500.
- Sensibilités : STOXX Europe 600 pour Sidetrade et Nasdaq Composite pour les comparables.
- Bêtas désendettés par la formule de Hamada, médiane des quatre comparables, puis réendettement avec D/(D+E)=20% et IS France=25,83%.

## Fiabilité

- Source homogène des historiques : API Yahoo Finance, cours ajustés.
- Contrôle Sidetrade : 10 séances rapprochées de la cote officielle Euronext.
- Contrôle des comparables : 36 séances rapprochées des historiques officiels Nasdaq.
- Résultat : **46 contrôles sur 46 réussis**, aucune semaine manquante.
- Structures de capital : données officielles SEC company facts et derniers 10-Q disponibles.

## Organisation du dossier

- `outputs/beta_sidetrade_20260715/` : classeur final.
- `raw_data/` : extractions quotidiennes, séries hebdomadaires, contrôles Euronext/Nasdaq, données SEC et manifestes horodatés.
- `audit/` : résultats de régression, structures de capital, tests de fiabilité, inspections et aperçus du classeur.
- `work/` : scripts reproductibles de collecte, calcul et génération du classeur.

## Rafraîchissement

Depuis le dossier `work`, exécuter dans cet ordre avec Node.js :

```powershell
node .\fetch_prices.mjs
node .\prepare_analysis.mjs
node .\build_workbook.mjs
```

Le premier script nécessite une connexion Internet. Avant toute présentation éloignée du 15 juillet 2026, rafraîchir les prix, les contrôles officiels et les données de structure de capital.
