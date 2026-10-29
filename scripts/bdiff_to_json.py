#!/usr/bin/env python3
"""Convertit un ou plusieurs exports CSV BDIFF en data/incendies.json (communes du Pays de Fayence).

Usage : python3 scripts/bdiff_to_json.py Incendies.csv [autres.csv ...]
Les incendies déjà présents dans data/incendies.json sont conservés (fusion par année + numéro).
"""
import csv
import datetime
import json
import pathlib
import sys

COMMUNES = {'83008', '83029', '83055', '83080', '83081', '83117', '83124', '83133', '83138'}
SORTIE = pathlib.Path(__file__).resolve().parent.parent / 'data' / 'incendies.json'


def lire(chemin):
    with open(chemin, encoding='utf-8-sig', newline='') as f:
        lignes = f.read().splitlines()
    # Les premières lignes de l'export décrivent la sélection ; l'en-tête commence par « Année »
    debut = next(i for i, l in enumerate(lignes) if l.startswith('Année;'))
    for row in csv.DictReader(lignes[debut:], delimiter=';'):
        if row['Code INSEE'] not in COMMUNES:
            continue
        m2 = row['Surface parcourue (m2)']
        yield {
            'annee': int(row['Année']),
            'numero': row['Numéro'],
            'code_insee': row['Code INSEE'],
            'date': row['Date de première alerte'][:10],
            'surface_ha': round(float(m2) / 10000, 4) if m2 else None,
            'nature': row['Nature'] or None,
        }


incendies = {}
if SORTIE.exists():
    for f in json.loads(SORTIE.read_text())['incendies']:
        incendies[(f['annee'], f['numero'])] = f
for chemin in sys.argv[1:]:
    for f in lire(chemin):
        incendies[(f['annee'], f['numero'])] = f

liste = sorted(incendies.values(), key=lambda f: f['date'])
annees = sorted({f['annee'] for f in liste})
SORTIE.parent.mkdir(exist_ok=True)
SORTIE.write_text(json.dumps({
    'source': 'BDIFF – https://bdiff.agriculture.gouv.fr',
    'extrait_le': datetime.date.today().strftime('%d/%m/%Y'),
    'periode': '' if not annees else str(annees[0]) if len(annees) == 1 else f'{annees[0]}–{annees[-1]}',
    'annees': annees,
    'incendies': liste,
}, ensure_ascii=False, indent=1) + '\n')
print(f'{len(liste)} incendies, années {annees}')
