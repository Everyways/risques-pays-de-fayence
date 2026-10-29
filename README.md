# Risques — Pays de Fayence

Carte interactive des risques pour les 9 communes de la Communauté de communes du Pays de Fayence (Var) :
Bagnols-en-Forêt, Callian, Fayence, Mons, Montauroux, Saint-Paul-en-Forêt, Seillans, Tanneron, Tourrettes.

- **Obligations légales de débroussaillement (OLD)** : zonage informatif IGN (Géoplateforme, couche `DEBROUSSAILLEMENT`).
- **Feux de forêt** : périmètres PPR feux de forêt (Géorisques WMS).
- **Inondation** : PPR inondation, EAIP, remontées de nappes (Géorisques WMS).
- **Fiche commune** : risques recensés et arrêtés CatNat (API Géorisques v1), chargés en direct.

Site 100 % statique (HTML/JS + Leaflet), sans build. Lien direct vers une commune : `?commune=<code INSEE>`.

## Lancer en local

```bash
python3 -m http.server 8000
```

## Avertissement

Information indicative, sans valeur réglementaire. Seuls les documents officiels (arrêtés préfectoraux, PPR, PLU) font foi.
