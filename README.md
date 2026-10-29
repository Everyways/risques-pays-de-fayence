# Risques — Pays de Fayence

Carte interactive des risques pour les 9 communes de la Communauté de communes du Pays de Fayence (Var) :
Bagnols-en-Forêt, Callian, Fayence, Mons, Montauroux, Saint-Paul-en-Forêt, Seillans, Tanneron, Tourrettes.

- **Obligations légales de débroussaillement (OLD)** : zonage informatif IGN (Géoplateforme, couche `DEBROUSSAILLEMENT`).
- **Feux de forêt** : périmètres PPR feux de forêt (Géorisques WMS).
- **Inondation** : PPR inondation, EAIP, remontées de nappes (Géorisques WMS).
- **Autres risques** : mouvements de terrain, cavités, retrait-gonflement des argiles, zonage sismique, radon (Géorisques WMS).
- **Fiche commune / vue globale** : tous les risques recensés (avec sous-types) et sinistres connus par année :
  arrêtés CatNat (API Géorisques v1, en direct) et incendies de forêt BDIFF (`data/incendies.json`).
- **Glossaire** des sigles (OLD, PPR, PPRIF, EAIP…), avec infobulle sur chaque sigle.

## Données BDIFF

BDIFF n'a pas d'API : l'extrait est stocké dans `data/incendies.json` :

```json
{ "source": "BDIFF", "extrait_le": "JJ/MM/AAAA", "periode": "2006-2025",
  "incendies": [{ "code_insee": "83133", "date": "2016-08-10", "surface_ha": 12.5 }] }
```

Site 100 % statique (HTML/JS + Leaflet), sans build. Lien direct vers une commune : `?commune=<code INSEE>`.

## Lancer en local

```bash
python3 -m http.server 8000
```

## Avertissement

Information indicative, sans valeur réglementaire. Seuls les documents officiels (arrêtés préfectoraux, PPR, PLU) font foi.
