// Carte des risques du Pays de Fayence (CC Pays de Fayence, SIREN 200004802)
const EPCI = '200004802';
const GEORISQUES_API = 'https://georisques.gouv.fr/api/v1';
const GEORISQUES_WMS = 'https://georisques.gouv.fr/services';
const IGN_WMS = 'https://data.geopf.fr/wms-r/wms';

const COMMUNES = [
  { code: '83008', nom: 'Bagnols-en-Forêt', centre: [43.5328, 6.7089] },
  { code: '83029', nom: 'Callian', centre: [43.6069, 6.7601] },
  { code: '83055', nom: 'Fayence', centre: [43.6118, 6.6762] },
  { code: '83080', nom: 'Mons', centre: [43.7041, 6.7054] },
  { code: '83081', nom: 'Montauroux', centre: [43.5936, 6.7993] },
  { code: '83117', nom: 'Saint-Paul-en-Forêt', centre: [43.5681, 6.6822] },
  { code: '83124', nom: 'Seillans', centre: [43.6326, 6.6024] },
  { code: '83133', nom: 'Tanneron', centre: [43.5732, 6.8538] },
  { code: '83138', nom: 'Tourrettes', centre: [43.609, 6.7252] },
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
  BASOL: "Base des sites et sols pollués appelant une action des pouvoirs publics.",
  BRGM: "Bureau de recherches géologiques et minières, opérateur de Géorisques.",
  CatNat: "Catastrophe naturelle : état reconnu par arrêté interministériel publié au Journal officiel, ouvrant droit à indemnisation par les assurances.",
  DDRM: "Dossier départemental sur les risques majeurs, établi par le préfet.",
  DFCI: "Défense des forêts contre l'incendie : pistes, points d'eau et aménagements de lutte.",
  DICRIM: "Document d'information communal sur les risques majeurs, établi par le maire.",
  EAIP: "Enveloppe approchée des inondations potentielles : zone maximale qui pourrait être inondée par débordement de cours d'eau ou submersion.",
  EFFIS: "European Forest Fire Information System (Copernicus) : contours des surfaces brûlées détectées par satellite.",
  GASPAR: "Gestion assistée des procédures administratives relatives aux risques : base nationale des risques, PPR et arrêtés CatNat par commune.",
  IAL: "Information acquéreurs-locataires : état des risques obligatoire à joindre à toute vente ou location.",
  ICPE: "Installation classée pour la protection de l'environnement : usine ou activité pouvant présenter des dangers ou nuisances.",
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
  SIS: "Secteur d'information sur les sols : terrain où une pollution des sols est connue.",
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

const cadastre = L.tileLayer(
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS' +
  '&STYLE=PCI%20vecteur&FORMAT=image/png&TILEMATRIXSET=PM_0_19&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  { maxZoom: 19, attribution: attribIGN });

// Stations hydrométriques en service (Hub'Eau) ; hauteur lue à l'ouverture de la bulle
const STATIONS = [
  { code: 'Y551404001', nom: 'La Siagne à Callian [Ajustadoux]', pos: [43.6646, 6.7621], vigicrues: true },
  { code: 'Y551541001', nom: 'La Siagnole à Mons [Le Moulin]', pos: [43.6772, 6.7171] },
  { code: 'Y551601001', nom: 'La Siagne [source des Tuves] à Montauroux', pos: [43.6420, 6.7906] },
  { code: 'Y552000201', nom: 'Le Riou Blanc à Tourrettes [La Camandre]', pos: [43.6049, 6.7143] },
  { code: 'Y552000301', nom: '[Camiole] à Callian', pos: [43.6206, 6.7380] },
];
const stationsLayer = L.layerGroup(STATIONS.map(st =>
  L.circleMarker(st.pos, { radius: 7, color: '#fff', weight: 2, fillColor: '#1c7ed6', fillOpacity: 1 })
    .bindPopup(`<strong>${esc(st.nom)}</strong><br><span class="hint">Chargement…</span>`)
    .on('popupopen', e => hauteurStation(st, e.popup))));

// Dernière mesure : API Vigicrues pour les stations Vigicrues (hauteur + débit), Hub'Eau sinon ou en secours
async function mesuresVigicrues(code) {
  const url = grd => `https://www.vigicrues.gouv.fr/services/observations.json?CdStationHydro=${code}&FormatDate=iso${grd ? `&GrdSerie=${grd}` : ''}`;
  const [h, q] = await Promise.all([getJSON(url()), getJSON(url('Q')).catch(() => null)]);
  const obs = h.Serie.ObssHydro;
  const last = obs.at(-1);
  const veille = obs.find(o => new Date(o.DtObsHydro) >= new Date(new Date(last.DtObsHydro) - 864e5)) || obs[0];
  const debit = q?.Serie?.ObssHydro?.at(-1)?.ResObsHydro;
  return { hauteur: last.ResObsHydro, date: last.DtObsHydro, variation: last.ResObsHydro - veille.ResObsHydro, debit, source: 'Vigicrues' };
}
async function mesuresHubeau(code) {
  const j = await getJSON(`https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?code_entite=${code}&grandeur_hydro=H&size=1&sort=desc`);
  const o = j.data?.[0];
  return o && { hauteur: o.resultat_obs / 1000, date: o.date_obs, source: "Hub'Eau" };
}

async function hauteurStation(st, popup) {
  const lien = st.vigicrues
    ? `https://www.vigicrues.gouv.fr/station/${st.code}`
    : `https://www.hydro.eaufrance.fr/stationhydro/${st.code}/fiche`;
  const m2 = v => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  let info;
  try {
    const m = st.vigicrues ? await mesuresVigicrues(st.code).catch(() => mesuresHubeau(st.code)) : await mesuresHubeau(st.code);
    info = m
      ? `Hauteur : <strong>${m2(m.hauteur)} m</strong>` +
        (m.variation != null ? ` (${m.variation >= 0 ? '+' : ''}${m2(m.variation)} m sur 24 h)` : '') +
        (m.debit != null ? `<br>Débit : <strong>${m2(m.debit)} m³/s</strong>` : '') +
        `<br><small>${new Date(m.date).toLocaleString('fr-FR')} · ${m.source}</small>`
      : 'Pas de mesure récente.';
  } catch {
    info = 'Mesure indisponible.';
  }
  popup.setContent(`<strong>${esc(st.nom)}</strong><br>${info}<br><a href="${lien}" target="_blank" rel="noopener">${st.vigicrues ? 'Voir sur Vigicrues' : 'HydroPortail'}</a>`);
}

const attribEFFIS = '<a href="https://forest-fire.emergency.copernicus.eu">EFFIS</a>';
const effis = L.tileLayer.wms('https://maps.effis.emergency.copernicus.eu/effis', {
  layers: Array.from({ length: 10 }, (_, i) => `modis.ba.poly.${2016 + i}`).concat('modis.ba.poly.season').join(','),
  format: 'image/png', transparent: true, version: '1.1.1', opacity: 0.7, attribution: attribEFFIS,
});
const OPENDFCI_WMS = 'https://opendfci.fr/map/index.php/lizmap/service/?repository=public&project=0_dfci_public';
const attribDFCI = '<a href="https://opendfci.fr">OPEN DFCI</a>';

// Établissements sensibles (OpenStreetMap via Overpass), chargés à la première activation
const SENSIBLES = {
  ecole: { label: 'École', color: '#7048e8' },
  creche: { label: 'Crèche', color: '#ae3ec9' },
  sante: { label: 'Hôpital / clinique', color: '#e03131' },
  ehpad: { label: 'Maison de retraite', color: '#f08c00' },
};
const sensiblesLayer = L.layerGroup();
let sensiblesCharges = false;
sensiblesLayer.on('add', async () => {
  if (sensiblesCharges) return;
  sensiblesCharges = true;
  const bbox = '43.48,6.55,43.76,6.92';
  const q = `[out:json][timeout:25];(nwr["amenity"~"^(school|kindergarten|childcare|hospital|clinic)$"](${bbox});` +
    `nwr["social_facility"="nursing_home"](${bbox});nwr["amenity"="nursing_home"](${bbox}););out center tags;`;
  try {
    // Les serveurs Overpass sont parfois saturés : on essaie plusieurs instances
    let j;
    for (const srv of ['https://overpass-api.de', 'https://overpass.kumi.systems', 'https://overpass.private.coffee']) {
      j = await getJSON(`${srv}/api/interpreter?data=${encodeURIComponent(q)}`).catch(() => null);
      if (j) break;
    }
    if (!j) throw new Error('Overpass indisponible');
    for (const el of j.elements) {
      const t = el.tags || {};
      const type = t.amenity === 'school' ? 'ecole'
        : ['kindergarten', 'childcare'].includes(t.amenity) ? 'creche'
        : ['hospital', 'clinic'].includes(t.amenity) ? 'sante' : 'ehpad';
      const pos = el.type === 'node' ? [el.lat, el.lon] : el.center && [el.center.lat, el.center.lon];
      if (!pos) continue;
      L.circleMarker(pos, { radius: 6, color: '#fff', weight: 2, fillColor: SENSIBLES[type].color, fillOpacity: 1 })
        .bindPopup(`<strong>${esc(t.name || SENSIBLES[type].label)}</strong><br><small>${SENSIBLES[type].label} · OpenStreetMap</small>`)
        .addTo(sensiblesLayer);
    }
  } catch {
    sensiblesCharges = false;
    alert('Établissements sensibles indisponibles pour le moment (OpenStreetMap / Overpass).');
  }
});

const OVERLAYS = [
  { group: 'Fonds', id: 'cadastre', label: 'Parcelles cadastrales', note: 'Visible à partir du zoom 15', layer: cadastre },
  { group: 'Débroussaillement', id: 'old', label: 'Zonage OLD', note: 'Zonage informatif IGN', layer: wms(IGN_WMS, 'DEBROUSSAILLEMENT', attribIGN) },
  { group: 'Feux de forêt', id: 'supfeu', label: 'PPRIF (SUP)', note: 'Périmètres réglementaires', layer: wms(GEORISQUES_WMS, 'SUP_FEU', attribGR) },
  { group: 'Feux de forêt', id: 'brule', label: 'Surfaces brûlées 2016 – aujourd\'hui', note: 'Satellite EFFIS, feux d\'environ 30 ha et plus', layer: effis },
  { group: 'Feux de forêt', id: 'foret', label: 'Forêt et végétation (BD Forêt)', note: 'Type de peuplement forestier, IGN', layer: wms(IGN_WMS, 'LANDCOVER.FORESTINVENTORY.V2', attribIGN) },
  { group: 'Feux de forêt', id: 'dfci', label: 'Équipements DFCI', note: 'Pistes, points d\'eau, vigies (OPEN DFCI)',
    layer: wms(OPENDFCI_WMS, 'TRO_2017_Troncons_de_voies_categorisees_DFCI,EAU_2017_Bassins_ou_retenues_citernes_points_d_eau_naturel_DFCI,VIG_2017_Vigies_DFCI', attribDFCI) },
  { group: 'Feux de forêt', id: 'pprfeu', label: 'Communes avec PPRIF approuvé', layer: wms(GEORISQUES_WMS, 'PPRN_COMMUNE_FEU_APPROUV', attribGR) },
  { group: 'Inondation', id: 'supinond', label: 'PPRI (SUP)', note: 'Périmètres réglementaires', layer: wms(GEORISQUES_WMS, 'SUP_INOND', attribGR) },
  { group: 'Inondation', id: 'eaip', label: 'Enveloppes inondations potentielles (EAIP)', layer: wms(GEORISQUES_WMS, 'MASQ_EAIP', attribGR) },
  { group: 'Inondation', id: 'nappe', label: 'Remontées de nappes', layer: wms(GEORISQUES_WMS, 'REMNAPPE_FR', attribGR) },
  { group: 'Inondation', id: 'pprinond', label: 'Communes avec PPRI approuvé', layer: wms(GEORISQUES_WMS, 'PPRN_COMMUNE_RISQINOND_APPROUV', attribGR) },
  { group: 'Mouvements de terrain', id: 'mvt', label: 'Mouvements de terrain recensés', layer: wms(GEORISQUES_WMS, 'MVT_LOCALISE', attribGR) },
  { group: 'Mouvements de terrain', id: 'cavite', label: 'Cavités souterraines', layer: wms(GEORISQUES_WMS, 'CAVITE_LOCALISEE', attribGR) },
  { group: 'Mouvements de terrain', id: 'supmvt', label: 'PPRMT (SUP)', note: 'Périmètres réglementaires', layer: wms(GEORISQUES_WMS, 'SUP_MVT_TERRAIN', attribGR) },
  { group: 'Mouvements de terrain', id: 'argiles', label: 'Retrait-gonflement des argiles (RGA)', layer: wms(GEORISQUES_WMS, 'ALEARG', attribGR) },
  { group: 'Séisme et radon', id: 'seisme', label: 'Zonage sismique', layer: wms(GEORISQUES_WMS, 'risq_zonage_sismique', attribGR) },
  { group: 'Séisme et radon', id: 'radon', label: 'Potentiel radon', layer: wms(GEORISQUES_WMS, 'RADON', attribGR) },
  { group: 'Risques technologiques', id: 'gaz', label: 'Canalisations de gaz', layer: wms(GEORISQUES_WMS, 'C_GAZ', attribGR) },
  { group: 'Risques technologiques', id: 'icpe', label: 'Installations classées (ICPE)', note: 'Soumises à autorisation ou Seveso', layer: wms(GEORISQUES_WMS, 'INSTALLATIONS_CLASSEES_SIMPLIFIE', attribGR) },
  { group: 'Risques technologiques', id: 'sols', label: 'Sols pollués', note: 'SIS, sites BASOL, anciens sites industriels',
    layer: wms(GEORISQUES_WMS, 'SSP_CLASSIFICATION_SIS,SSP_INSTRUCTION,SSP_ETABLISSEMENT', attribGR) },
  { group: 'Enjeux', id: 'sensibles', label: 'Établissements sensibles', note: 'Écoles, crèches, santé, maisons de retraite (OpenStreetMap)', layer: sensiblesLayer },
  { group: 'Crues en temps réel', id: 'vigicrues', label: 'Vigilance crues (Vigicrues)', note: 'Couleur du tronçon de cours d\'eau surveillé',
    layer: wms('https://ogc.geo-ide.developpement-durable.gouv.fr/wxs?map=/opt/data/carto/geoide-catalogue/1.4/org_38174/8795eadb-cc82-424e-9e2a-48d296017d98.internet.map',
      'Troncons_SPCME', '<a href="https://www.vigicrues.gouv.fr">Vigicrues</a>') },
  { group: 'Crues en temps réel', id: 'stations', label: 'Stations de mesure', note: 'Hauteur et débit en direct (Vigicrues, Hub\'Eau)', layer: stationsLayer },
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
  o.checkbox = row.querySelector('input');
  if (o.on) o.layer.addTo(map);
}
function activer(id) {
  const o = OVERLAYS.find(o => o.id === id);
  if (!o.checkbox.checked) { o.checkbox.checked = true; o.layer.addTo(map); }
}
document.getElementById('opacity').addEventListener('input', e => {
  OVERLAYS.forEach(o => o.layer.setOpacity?.(+e.target.value));
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
        layer.on('click', () => selectCommune(f.properties.code, { zoom: false }));
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

function selectCommune(code, { zoom = true } = {}) {
  if (current && byCode[current]) byCode[current].setStyle(style(false));
  current = code || null;
  select.value = code || '';
  const url = new URL(location);
  code ? url.searchParams.set('commune', code) : url.searchParams.delete('commune');
  history.replaceState(null, '', url);

  if (code && byCode[code]) {
    byCode[code].setStyle(style(true)).bringToFront();
    if (zoom) map.fitBounds(byCode[code].getBounds(), { padding: [20, 20] });
  } else if (!code && communesLayer && zoom) {
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

// Sinistres : arrêtés CatNat (un même arrêté regroupe plusieurs communes) + incendies BDIFF
function buildEvents(codes, catnats, bdiff) {
  const events = [];
  const catnatParEvt = new Map();
  let catnatKo = 0;
  catnats.forEach((c, i) => {
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
  return { events, catnatKo };
}

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

  // Sinistres par année
  html += '<h3>Sinistres connus par année</h3>';
  const { events, catnatKo } = buildEvents(codes, results.map(([, c]) => c), bdiff);
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

  if (!global) {
    const c = COMMUNES.find(c => c.code === codes[0]);
    const dicrim = await getJSON(`${GEORISQUES_API}/gaspar/dicrim?code_insee=${c.code}`).then(j => j.data?.[0]?.annee_publication).catch(() => undefined);
    html += '<h3>Infos pratiques</h3><ul>';
    html += `<li>DICRIM : ${dicrim ? `publié en ${esc(dicrim)}, disponible en mairie ou sur le site de la commune` : dicrim === undefined ? 'information indisponible' : 'aucun DICRIM recensé'}.</li>`;
    html += `<li><a href="https://www.geoportail-urbanisme.gouv.fr/map/#tile=1&lon=${c.centre[1]}&lat=${c.centre[0]}&zoom=13" target="_blank" rel="noopener">PLU sur le Géoportail de l'urbanisme</a></li>`;
    html += '</ul>';
  }
  html += `<p><a href="https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi" target="_blank" rel="noopener">Rapport détaillé à une adresse sur Géorisques</a></p>`;
  if ((current || '') !== (global ? '' : codes[0])) return;
  fiche.innerHTML = html;
  annotate(fiche);
}

// Sinistres sur la carte : pastilles par commune et par type, filtrées par la frise
const EVT_TYPES = {
  feu: { label: 'Feux de forêt', color: '#d9480f', decalage: -0.012 },
  inond: { label: 'Inondations / coulées de boue', color: '#1c7ed6', decalage: 0.012 },
};
const evtLayer = L.layerGroup();
const evtState = { types: new Set(Object.keys(EVT_TYPES)), parCommune: null, de: 0, a: 0 };

async function initSinistres() {
  const [results, bdiff] = await Promise.all([Promise.all(ALL_CODES.map(loadCommune)), incendiesPromise]);
  evtState.parCommune = ALL_CODES.map((code, i) => ({ code, events: buildEvents([code], [results[i][1]], bdiff).events.filter(e => EVT_TYPES[e.type]) }));
  const annees = evtState.parCommune.flatMap(c => c.events.map(e => e.date.getFullYear()));
  if (!annees.length) {
    document.getElementById('frise').innerHTML = '<p class="hint">Aucun sinistre disponible.</p>';
    return;
  }
  const min = Math.min(...annees), max = Math.max(new Date().getFullYear(), ...annees);
  Object.assign(evtState, { min, max, de: min, a: max });
  for (const id of ['annee-de', 'annee-a']) {
    const input = document.getElementById(id);
    Object.assign(input, { min, max, value: id === 'annee-de' ? min : max });
    input.addEventListener('input', () => {
      const de = +document.getElementById('annee-de').value, a = +document.getElementById('annee-a').value;
      Object.assign(evtState, { de: Math.min(de, a), a: Math.max(de, a) });
      renderSinistres();
    });
  }
  renderSinistres();
}

function renderSinistres() {
  const { types, de, a, min, max } = evtState;
  if (!evtState.parCommune) return;
  const dansPeriode = e => types.has(e.type) && e.date.getFullYear() >= de && e.date.getFullYear() <= a;

  // Frise : barres empilées par année
  const parAnnee = {};
  for (const c of evtState.parCommune) for (const e of c.events) if (types.has(e.type)) {
    const y = e.date.getFullYear();
    (parAnnee[y] ??= { feu: 0, inond: 0 })[e.type]++;
  }
  const pic = Math.max(1, ...Object.values(parAnnee).map(v => v.feu + v.inond));
  let barres = '';
  for (let y = min; y <= max; y++) {
    const v = parAnnee[y] || { feu: 0, inond: 0 };
    const seg = t => v[t] ? `<i style="height:${(v[t] / pic) * 100}%;background:${EVT_TYPES[t].color}"></i>` : '';
    barres += `<div class="bar${y < de || y > a ? ' off' : ''}" title="${y} : ${v.feu} feu(x), ${v.inond} inondation(s)">${seg('inond')}${seg('feu')}</div>`;
  }
  document.getElementById('frise-barres').innerHTML = barres;
  document.getElementById('frise-label').textContent = de === a ? `${de}` : `${de} – ${a}`;

  // Pastilles
  evtLayer.clearLayers();
  for (const c of evtState.parCommune) {
    const commune = COMMUNES.find(x => x.code === c.code);
    for (const [type, t] of Object.entries(EVT_TYPES)) {
      const evts = c.events.filter(e => e.type === type && dansPeriode(e)).sort((x, y) => y.date - x.date);
      if (!evts.length) continue;
      const size = Math.round(22 + Math.min(18, Math.sqrt(evts.length) * 5));
      const icon = L.divIcon({
        className: '', iconSize: [size, size],
        html: `<div class="evt-pin" style="background:${t.color};width:${size}px;height:${size}px">${evts.length}</div>`,
      });
      L.marker([commune.centre[0], commune.centre[1] + t.decalage], { icon, title: `${commune.nom} – ${t.label}` })
        .bindPopup(`<strong>${esc(commune.nom)} — ${t.label}</strong><br><small>${de === a ? de : `${de}–${a}`} · ${evts.length} événement(s)</small>` +
          `<ul class="popup-list">${evts.map(e => `<li>${esc(e.titre)}<br><small>${esc(e.detail)}</small></li>`).join('')}</ul>`, { maxHeight: 260 })
        .addTo(evtLayer);
    }
  }
}

document.getElementById('evt-afficher').addEventListener('change', e => {
  e.target.checked ? evtLayer.addTo(map) : map.removeLayer(evtLayer);
  document.getElementById('frise').hidden = !e.target.checked;
});
document.querySelectorAll('[data-evt-type]').forEach(input => input.addEventListener('change', () => {
  input.checked ? evtState.types.add(input.dataset.evtType) : evtState.types.delete(input.dataset.evtType);
  renderSinistres();
}));
initSinistres();

// Recherche d'adresse (Géoplateforme IGN), limitée aux 9 communes
let adresseMarker = null;
const resultats = document.getElementById('adresse-resultats');
let rechercheTimer;
document.getElementById('adresse').addEventListener('input', e => {
  clearTimeout(rechercheTimer);
  const q = e.target.value.trim();
  if (q.length < 4) { resultats.innerHTML = ''; return; }
  rechercheTimer = setTimeout(async () => {
    try {
      const j = await getJSON(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(q)}&limit=15&lat=43.62&lon=6.72`);
      const ok = j.features.filter(f => ALL_CODES.includes(f.properties.citycode)).slice(0, 6);
      resultats.innerHTML = ok.length
        ? ok.map((f, i) => `<li><button type="button" data-i="${i}">${esc(f.properties.label)}</button></li>`).join('')
        : '<li class="hint">Aucune adresse trouvée dans le Pays de Fayence.</li>';
      resultats.querySelectorAll('button').forEach(b => b.addEventListener('click', () => allerA(ok[+b.dataset.i])));
    } catch {
      resultats.innerHTML = '<li class="error">Recherche indisponible.</li>';
    }
  }, 300);
});

function allerA(f) {
  const [lon, lat] = f.geometry.coordinates;
  resultats.innerHTML = '';
  document.getElementById('adresse').value = f.properties.label;
  selectCommune(f.properties.citycode);
  activer('cadastre');
  adresseMarker?.remove();
  adresseMarker = L.marker([lat, lon]).addTo(map)
    .bindPopup(`<strong>${esc(f.properties.label)}</strong><br><small>Activez les couches OLD, inondation… pour voir les zones qui concernent cette adresse.</small>`)
    .openPopup();
  map.setView([lat, lon], 17);
  ouvrirPanneau(false);
}

// Mobile : le panneau s'affiche en volet par-dessus la carte
const panel = document.getElementById('panel');
const toggle = document.getElementById('panel-toggle');
function ouvrirPanneau(ouvert) {
  panel.classList.toggle('open', ouvert);
  toggle.setAttribute('aria-expanded', ouvert);
  toggle.textContent = ouvert ? 'Carte' : 'Couches & infos';
}
toggle.addEventListener('click', () => ouvrirPanneau(!panel.classList.contains('open')));
document.getElementById('panel-close').addEventListener('click', () => ouvrirPanneau(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') ouvrirPanneau(false); });

const initial = new URLSearchParams(location.search).get('commune');
selectCommune(ALL_CODES.includes(initial) ? initial : '');
