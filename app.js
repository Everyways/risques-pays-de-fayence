// Carte des risques du Pays de Fayence (CC Pays de Fayence, SIREN 200004802)
const EPCI = '200004802';
const GEORISQUES_API = 'https://georisques.gouv.fr/api/v1';
const GEORISQUES_WMS = 'https://georisques.gouv.fr/services';
const IGN_WMS = 'https://data.geopf.fr/wms-r/wms';

const COMMUNES = [
  { code: '83008', nom: 'Bagnols-en-Forêt' },
  { code: '83029', nom: 'Callian' },
  { code: '83055', nom: 'Fayence' },
  { code: '83080', nom: 'Mons' },
  { code: '83081', nom: 'Montauroux' },
  { code: '83117', nom: 'Saint-Paul-en-Forêt' },
  { code: '83124', nom: 'Seillans' },
  { code: '83133', nom: 'Tanneron' },
  { code: '83138', nom: 'Tourrettes' },
];
const ALL_CODES = COMMUNES.map(c => c.code);
const nomCommune = code => COMMUNES.find(c => c.code === code)?.nom || code;

const getJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const frDate = s => { const [d, m, y] = (s || '').split('/'); return new Date(+y, +m - 1, +d); };
const fmtDate = d => d.toLocaleDateString('fr-FR');
const fmtSurface = ha => ha >= 1 ? `${ha.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ha` : `${Math.round(ha * 10000).toLocaleString('fr-FR')} m²`;

// Glossaire : chaque sigle est aussi annoté (infobulle) partout dans le panneau
const GLOSSAIRE = {
  AZI: "Atlas des zones inondables : cartographie informative des zones inondées ou inondables.",
  BDIFF: "Base de données sur les incendies de forêt en France (ministère de l'Agriculture), recense les feux depuis 2006.",
  BRGM: "Bureau de recherches géologiques et minières, opérateur de Géorisques.",
  CatNat: "Catastrophe naturelle : état reconnu par arrêté interministériel publié au Journal officiel, ouvrant droit à indemnisation par les assurances.",
  DDRM: "Dossier départemental sur les risques majeurs, établi par le préfet.",
  DFCI: "Défense des forêts contre l'incendie : pistes, points d'eau et aménagements de lutte.",
  DICRIM: "Document d'information communal sur les risques majeurs, établi par le maire.",
  EAIP: "Enveloppe approchée des inondations potentielles : zone maximale qui pourrait être inondée par débordement de cours d'eau ou submersion.",
  GASPAR: "Gestion assistée des procédures administratives relatives aux risques : base nationale des risques, PPR et arrêtés CatNat par commune.",
  IAL: "Information acquéreurs-locataires : état des risques obligatoire à joindre à toute vente ou location.",
  IGN: "Institut national de l'information géographique et forestière.",
  INSEE: "Institut national de la statistique ; le code INSEE identifie chaque commune.",
  JO: "Journal officiel de la République française.",
  OLD: "Obligations légales de débroussaillement : débroussailler autour des constructions (50 m, voire 100 m) en zone exposée aux feux de forêt.",
  PCS: "Plan communal de sauvegarde : organisation de la commune en cas de crise.",
  PLU: "Plan local d'urbanisme.",
  PPR: "Plan de prévention des risques : document de l'État qui réglemente l'urbanisme dans les zones exposées.",
  PPRI: "Plan de prévention des risques inondation.",
  PPRIF: "Plan de prévention des risques incendies de forêt.",
  PPRMT: "Plan de prévention des risques mouvements de terrain.",
  PPRN: "Plan de prévention des risques naturels (inondation, feux, mouvements de terrain, séisme…).",
  RGA: "Retrait-gonflement des argiles : sols argileux qui se rétractent en sécheresse et gonflent à l'humidité, fissurant les bâtiments.",
  SUP: "Servitude d'utilité publique : contrainte d'urbanisme annexée au PLU (un PPR approuvé vaut SUP).",
  TRI: "Territoire à risque important d'inondation (directive inondation).",
};
const SIGLES = `\\b(${Object.keys(GLOSSAIRE).join('|')})\\b`;

function annotate(root) {
  const test = new RegExp(SIGLES);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement.closest('abbr, select, option, script, dt') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) if (test.test(walker.currentNode.data)) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const span = document.createElement('span');
    span.innerHTML = esc(node.data).replace(new RegExp(SIGLES, 'g'), m => `<abbr title="${esc(GLOSSAIRE[m])}">${m}</abbr>`);
    node.replaceWith(...span.childNodes);
  }
}

const map = L.map('map', { zoomControl: true }).setView([43.62, 6.72], 11);

const ignTile = (layer, format) =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}` +
  `&STYLE=normal&FORMAT=${format}&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;
const attribIGN = '&copy; <a href="https://www.ign.fr">IGN</a>';

const baseLayers = {
  'Plan IGN': L.tileLayer(ignTile('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', 'image/png'), { maxZoom: 19, attribution: attribIGN }),
  'Photo aérienne': L.tileLayer(ignTile('ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg'), { maxZoom: 19, attribution: attribIGN }),
  'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }),
};
baseLayers['Plan IGN'].addTo(map);
L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

const wms = (url, layers, attribution) => L.tileLayer.wms(url, {
  layers, format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.7, attribution,
});
const attribGR = '<a href="https://www.georisques.gouv.fr">Géorisques</a>';

const OVERLAYS = [
  { group: 'Débroussaillement', id: 'old', label: 'Zonage OLD', note: 'Zonage informatif IGN', layer: wms(IGN_WMS, 'DEBROUSSAILLEMENT', attribIGN), on: true },
  { group: 'Feux de forêt', id: 'supfeu', label: 'PPRIF (SUP)', note: 'Périmètres réglementaires', layer: wms(GEORISQUES_WMS, 'SUP_FEUP', attribGR) },
  { group: 'Feux de forêt', id: 'pprfeu', label: 'Communes avec PPRIF approuvé', layer: wms(GEORISQUES_WMS, 'PPRN_COMMUNE_FEU_APPROUV', attribGR) },
  { group: 'Inondation', id: 'supinond', label: 'PPRI (SUP)', note: 'Périmètres réglementaires', layer: wms(GEORISQUES_WMS, 'SUP_INONDP', attribGR) },
  { group: 'Inondation', id: 'eaip', label: 'Enveloppes inondations potentielles (EAIP)', layer: wms(GEORISQUES_WMS, 'MASQ_EAIP', attribGR) },
  { group: 'Inondation', id: 'nappe', label: 'Remontées de nappes', layer: wms(GEORISQUES_WMS, 'REMNAPPE_FR', attribGR) },
  { group: 'Inondation', id: 'pprinond', label: 'Communes avec PPRI approuvé', layer: wms(GEORISQUES_WMS, 'PPRN_COMMUNE_RISQINOND_APPROUV', attribGR) },
  { group: 'Mouvements de terrain', id: 'mvt', label: 'Mouvements de terrain recensés', layer: wms(GEORISQUES_WMS, 'MVT_LOCALISEE', attribGR) },
  { group: 'Mouvements de terrain', id: 'cavite', label: 'Cavités souterraines', layer: wms(GEORISQUES_WMS, 'CAVITE_LOCALISEE', attribGR) },
  { group: 'Mouvements de terrain', id: 'supmvt', label: 'PPRMT (SUP)', note: 'Périmètres réglementaires', layer: wms(GEORISQUES_WMS, 'SUP_MVT_TERRAIN', attribGR) },
  { group: 'Mouvements de terrain', id: 'argiles', label: 'Retrait-gonflement des argiles (RGA)', layer: wms(GEORISQUES_WMS, 'ALEARG', attribGR) },
  { group: 'Séisme et radon', id: 'seisme', label: 'Zonage sismique', layer: wms(GEORISQUES_WMS, 'risq_zonage_sismique', attribGR) },
  { group: 'Séisme et radon', id: 'radon', label: 'Potentiel radon', layer: wms(GEORISQUES_WMS, 'RADON', attribGR) },
];

// Panneau des couches
const list = document.getElementById('layer-list');
let lastGroup = null;
for (const o of OVERLAYS) {
  if (o.group !== lastGroup) {
    list.insertAdjacentHTML('beforeend', `<div class="layer-group">${o.group}</div>`);
    lastGroup = o.group;
  }
  const row = document.createElement('label');
  row.className = 'layer';
  row.innerHTML = `<input type="checkbox" ${o.on ? 'checked' : ''}><span>${o.label}${o.note ? `<small>${o.note}</small>` : ''}</span>`;
  row.querySelector('input').addEventListener('change', e => {
    e.target.checked ? o.layer.addTo(map) : map.removeLayer(o.layer);
    communesLayer && communesLayer.bringToFront();
  });
  list.appendChild(row);
  if (o.on) o.layer.addTo(map);
}
document.getElementById('opacity').addEventListener('input', e => {
  OVERLAYS.forEach(o => o.layer.setOpacity(+e.target.value));
});

// Glossaire
document.getElementById('glossaire-list').innerHTML = Object.entries(GLOSSAIRE)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
annotate(document.getElementById('panel'));

// Contours des communes
let communesLayer = null;
let current = null;
const byCode = {};
const style = selected => ({ color: selected ? '#b4441b' : '#333', weight: selected ? 3 : 1.5, fill: true, fillOpacity: 0 });

fetch(`https://geo.api.gouv.fr/communes?codeEpci=${EPCI}&format=geojson&geometry=contour`)
  .then(r => r.json())
  .then(geojson => {
    communesLayer = L.geoJSON(geojson, {
      style: () => style(false),
      onEachFeature: (f, layer) => {
        byCode[f.properties.code] = layer;
        layer.bindTooltip(f.properties.nom, { permanent: true, direction: 'center', className: 'commune-label' });
        layer.on('click', () => selectCommune(f.properties.code));
      },
    }).addTo(map);
    if (current && byCode[current]) {
      byCode[current].setStyle(style(true)).bringToFront();
      map.fitBounds(byCode[current].getBounds(), { padding: [20, 20] });
    } else {
      map.fitBounds(communesLayer.getBounds());
    }
  })
  .catch(() => console.warn('Contours des communes indisponibles'));

// Sélecteur
const select = document.getElementById('commune');
COMMUNES.forEach(c => select.insertAdjacentHTML('beforeend', `<option value="${c.code}">${c.nom}</option>`));
select.addEventListener('change', () => selectCommune(select.value));

function selectCommune(code) {
  if (current && byCode[current]) byCode[current].setStyle(style(false));
  current = code || null;
  select.value = code || '';
  const url = new URL(location);
  code ? url.searchParams.set('commune', code) : url.searchParams.delete('commune');
  history.replaceState(null, '', url);

  if (code && byCode[code]) {
    byCode[code].setStyle(style(true)).bringToFront();
    map.fitBounds(byCode[code].getBounds(), { padding: [20, 20] });
  } else if (!code && communesLayer) {
    map.fitBounds(communesLayer.getBounds());
  }
  renderFiche(code ? [code] : ALL_CODES);
}

// Données Géorisques, mises en cache par commune
const cache = {};
function loadCommune(code) {
  return cache[code] ??= Promise.allSettled([
    getJSON(`${GEORISQUES_API}/gaspar/risques?code_insee=${code}`).then(j => j.data?.[0]?.risques_detail || []),
    getJSON(`${GEORISQUES_API}/gaspar/catnat?code_insee=${code}&page_size=100`).then(j => j.data || []),
  ]);
}

// Incendies BDIFF : extrait statique (pas d'API), voir data/incendies.json
const incendiesPromise = getJSON('data/incendies.json').catch(() => null);

const categorie = libelle =>
  /feu|incend/i.test(libelle) ? 'feu'
  : /inond|coul|crue|submer/i.test(libelle) ? 'inond'
  : /s[ée]cheresse|argile/i.test(libelle) ? 'secheresse'
  : /mouvement|glissement|effondrement|[ée]boulement|chute/i.test(libelle) ? 'mvt'
  : 'autre';

async function renderFiche(codes) {
  const fiche = document.getElementById('fiche');
  const global = codes.length > 1;
  const titre = global ? 'Pays de Fayence — 9 communes' : nomCommune(codes[0]);
  fiche.innerHTML = `<h2>${esc(titre)}</h2><p class="hint">Chargement des données…</p>`;

  const [results, bdiff] = await Promise.all([Promise.all(codes.map(loadCommune)), incendiesPromise]);
  if ((current || '') !== (global ? '' : codes[0])) return;

  let html = `<h2>${esc(titre)}</h2>`;
  html += global ? '<p class="hint">Cliquez sur une commune pour sa fiche détaillée.</p>' : `<p class="hint">Code INSEE ${codes[0]}</p>`;

  // Risques recensés : risques principaux (code à 2 chiffres) et leurs sous-types
  html += '<h3>Risques recensés</h3>';
  const risques = new Map();
  let risquesKo = 0;
  results.forEach(([r], i) => {
    if (r.status !== 'fulfilled') return risquesKo++;
    for (const d of r.value) {
      const e = risques.get(d.num_risque) || { ...d, communes: [] };
      e.communes.push(codes[i]);
      risques.set(d.num_risque, e);
    }
  });
  if (risques.size) {
    const tri = [...risques.values()].sort((a, b) => a.num_risque.localeCompare(b.num_risque));
    html += '<ul class="tags">' + tri.map(r => {
      const sub = r.num_risque.length > 2;
      const nb = global ? ` (${r.communes.length})` : '';
      const title = global ? ` title="${esc(r.communes.map(nomCommune).join(', '))}"` : '';
      return `<li class="${sub ? 'sub' : ''}"${title}>${esc(r.libelle_risque_long)}${nb}</li>`;
    }).join('') + '</ul>';
    html += `<p class="hint">${global ? 'Entre parenthèses : nombre de communes concernées (survol pour le détail). ' : ''}Encadrés : sous-types de risque.</p>`;
  }
  if (risquesKo) html += `<p class="error">Données indisponibles pour ${risquesKo === codes.length ? 'le moment' : `${risquesKo} commune(s)`}.</p>`;
  else if (!risques.size) html += '<p>Aucun risque recensé.</p>';

  // Sinistres par année : arrêtés CatNat (un même arrêté regroupe plusieurs communes) + incendies BDIFF
  html += '<h3>Sinistres connus par année</h3>';
  const events = [];
  const catnatParEvt = new Map();
  let catnatKo = 0;
  results.forEach(([, c], i) => {
    if (c.status !== 'fulfilled') return catnatKo++;
    for (const a of c.value) {
      const key = `${a.libelle_risque_jo}|${a.date_debut_evt}|${a.date_fin_evt}`;
      let e = catnatParEvt.get(key);
      if (!e) {
        e = {
          date: frDate(a.date_debut_evt), type: categorie(a.libelle_risque_jo), communes: [],
          titre: `CatNat — ${a.libelle_risque_jo}`,
          detail: `Du ${a.date_debut_evt} au ${a.date_fin_evt} · arrêté publié au JO le ${a.date_publication_jo}`,
        };
        catnatParEvt.set(key, e);
        events.push(e);
      }
      e.communes.push(codes[i]);
    }
  });
  for (const f of (bdiff?.incendies || []).filter(f => codes.includes(f.code_insee))) {
    const date = new Date(f.date);
    const surface = f.surface_ha != null ? `${fmtSurface(+f.surface_ha)} parcourus` : 'surface non renseignée';
    events.push({
      date, type: 'feu', communes: [f.code_insee], surface: +f.surface_ha || 0,
      titre: 'Incendie de forêt (BDIFF)',
      detail: [`Le ${fmtDate(date)}`, surface, f.nature && `cause : ${f.nature.toLowerCase()}`].filter(Boolean).join(' · '),
    });
  }

  if (events.length) {
    html += `<div class="legend"><span><i style="background:#d9480f"></i>Feux</span><span><i style="background:#1c7ed6"></i>Inondation</span>` +
      `<span><i style="background:#c49a00"></i>Sécheresse</span><span><i style="background:#8d6e63"></i>Mouvement de terrain</span></div>`;
    const parAnnee = new Map();
    for (const e of events.sort((a, b) => b.date - a.date)) {
      const y = e.date.getFullYear();
      parAnnee.set(y, [...(parAnnee.get(y) || []), e]);
    }
    for (const [annee, evts] of parAnnee) {
      const ha = evts.reduce((s, e) => s + (e.surface || 0), 0);
      const resume = [`${evts.length} événement(s)`, ha ? `${fmtSurface(ha)} brûlés` : ''].filter(Boolean).join(' · ');
      html += `<div class="year">${annee}<span>${resume}</span></div><ul class="events">` + evts.map(e =>
        `<li class="${e.type}">${esc(e.titre)}<small>${esc(e.detail)}${global ? ` · ${esc(e.communes.map(nomCommune).join(', '))}` : ''}</small></li>`
      ).join('') + '</ul>';
    }
  } else if (!catnatKo) {
    html += '<p>Aucun sinistre recensé.</p>';
  }
  if (catnatKo) html += `<p class="error">Arrêtés CatNat indisponibles pour ${catnatKo === codes.length ? 'le moment' : `${catnatKo} commune(s)`}.</p>`;
  html += bdiff
    ? `<p class="hint">Incendies de forêt : BDIFF, années disponibles ${esc(bdiff.periode)} (extrait du ${esc(bdiff.extrait_le)}).</p>`
    : '<p class="hint">Les incendies de forêt BDIFF seront ajoutés prochainement.</p>';

  html += `<p><a href="https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi" target="_blank" rel="noopener">Rapport détaillé à une adresse sur Géorisques</a></p>`;
  fiche.innerHTML = html;
  annotate(fiche);
}

const initial = new URLSearchParams(location.search).get('commune');
selectCommune(ALL_CODES.includes(initial) ? initial : '');
