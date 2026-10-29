# Risques — Pays de Fayence

Carte interactive des risques pour les 9 communes de la Communauté de communes du Pays de Fayence (Var) :
Bagnols-en-Forêt, Callian, Fayence, Mons, Montauroux, Saint-Paul-en-Forêt, Seillans, Tanneron, Tourrettes.

- **Obligations légales de débroussaillement (OLD)** : zonage informatif IGN (Géoplateforme, couche `DEBROUSSAILLEMENT`).
- **Feux de forêt** : périmètres PPR feux de forêt (Géorisques WMS).
- **Inondation** : PPR inondation, EAIP, remontées de nappes (Géorisques WMS).
- **Autres risques** : mouvements de terrain, cavités, retrait-gonflement des argiles, zonage sismique, radon (Géorisques WMS).
- **Fiche commune / vue globale** : tous les risques recensés (avec sous-types) et sinistres connus par année :
  arrêtés CatNat (API Géorisques v1, en direct) et incendies de forêt BDIFF (`data/incendies.json`).
- **Feux** : surfaces brûlées par satellite (EFFIS, 2016 à aujourd'hui), forêt et végétation (BD Forêt IGN), équipements DFCI (OPEN DFCI).
- **Risques technologiques** : canalisations de gaz, installations classées, sols pollués (Géorisques).
- **Enjeux** : établissements sensibles (écoles, crèches, santé, maisons de retraite) depuis OpenStreetMap.
- **Sinistres sur la carte** : pastilles par commune (feux, inondations / coulées de boue) avec frise annuelle pour filtrer la période.
- **Recherche d'adresse** (géocodage IGN) avec parcelles cadastrales.
- **Crues en temps réel** : vigilance Vigicrues (tronçons PACA) et stations de mesure (API Vigicrues, Hub'Eau).
- **Infos pratiques** : DICRIM, PLU, numéros d'urgence, bons réflexes, liens danger feux (préfecture du Var, Météo des forêts, feuxdeforet.fr).
- **Glossaire** des sigles (OLD, PPR, PPRIF, EAIP…), avec infobulle sur chaque sigle.

## Données BDIFF

BDIFF n'a pas d'API : un extrait est stocké dans `data/incendies.json`.
Pour l'enrichir, exporter le CSV depuis https://bdiff.agriculture.gouv.fr/incendies (type de feu « F », période voulue), puis :

```bash
python3 scripts/bdiff_to_json.py Incendies.csv
```

Seules les 9 communes sont conservées ; les incendies déjà présents sont fusionnés (année + numéro).

## Lancer en local

```bash
python3 -m http.server 8000
```

## Avertissement

Information indicative, sans valeur réglementaire. Seuls les documents officiels (arrêtés préfectoraux, PPR, PLU) font foi.
