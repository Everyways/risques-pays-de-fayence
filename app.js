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
  { group: 'Feux de forêt', id: 'supfeu', label: 'PPR feux de forêt (SUP)', note: 'Périmètres réglementaires', layer: wms(GEORISQUES_WMS, 'SUP_FEUP', attribGR) },
  { group: 'Feux de forêt', id: 'pprfeu', label: 'Communes avec PPRIF approuvé', layer: wms(GEORISQUES_WMS, 'PPRN_COMMUNE_FEU_APPROUV', attribGR) },
  { group: 'Inondation', id: 'supinond', label: 'PPR inondation (SUP)', note: 'Périmètres réglementaires', layer: wms(GEORISQUES_WMS, 'SUP_INONDP', attribGR) },
  { group: 'Inondation', id: 'eaip', label: 'Enveloppes inondations potentielles (EAIP)', layer: wms(GEORISQUES_WMS, 'MASQ_EAIP', attribGR) },
  { group: 'Inondation', id: 'nappe', label: 'Remontées de nappes', layer: wms(GEORISQUES_WMS, 'REMNAPPE_FR', attribGR) },
  { group: 'Inondation', id: 'pprinond', label: 'Communes avec PPRI approuvé', layer: wms(GEORISQUES_WMS, 'PPRN_COMMUNE_RISQINOND_APPROUV', attribGR) },
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

// Contours des communes
let communesLayer = null;
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
    map.fitBounds(communesLayer.getBounds());
    const initial = new URLSearchParams(location.search).get('commune');
    if (initial && byCode[initial]) selectCommune(initial);
  })
  .catch(() => console.warn('Contours des communes indisponibles'));

// Sélecteur
const select = document.getElementById('commune');
COMMUNES.forEach(c => select.insertAdjacentHTML('beforeend', `<option value="${c.code}">${c.nom}</option>`));
select.addEventListener('change', () => selectCommune(select.value));

let current = null;
function selectCommune(code) {
  if (current && byCode[current]) byCode[current].setStyle(style(false));
  current = code || null;
  select.value = code || '';
  const url = new URL(location);
  code ? url.searchParams.set('commune', code) : url.searchParams.delete('commune');
  history.replaceState(null, '', url);

  const fiche = document.getElementById('fiche');
  if (!code) {
    fiche.innerHTML = '<p class="hint">Choisissez une commune (liste ou clic sur la carte) pour afficher ses risques.</p>';
    if (communesLayer) map.fitBounds(communesLayer.getBounds());
    return;
  }
  if (byCode[code]) {
    byCode[code].setStyle(style(true)).bringToFront();
    map.fitBounds(byCode[code].getBounds(), { padding: [20, 20] });
  }
  renderFiche(code);
}

const getJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toDate = s => { const [d, m, y] = (s || '').split('/'); return new Date(+y, +m - 1, +d); };

async function renderFiche(code) {
  const commune = COMMUNES.find(c => c.code === code);
  const fiche = document.getElementById('fiche');
  fiche.innerHTML = `<h2>${commune.nom}</h2><p class="hint">Chargement des données Géorisques…</p>`;

  const [risques, catnat] = await Promise.allSettled([
    getJSON(`${GEORISQUES_API}/gaspar/risques?code_insee=${code}`),
    getJSON(`${GEORISQUES_API}/gaspar/catnat?code_insee=${code}&page_size=100`),
  ]);
  if (current !== code) return;

  let html = `<h2>${commune.nom}</h2><p class="hint">Code INSEE ${code}</p>`;

  html += '<h3>Risques recensés</h3>';
  if (risques.status === 'fulfilled') {
    const detail = risques.value.data?.[0]?.risques_detail || [];
    html += detail.length
      ? `<ul class="tags">${detail.filter(r => r.num_risque.length === 2).map(r => `<li>${esc(r.libelle_risque_long)}</li>`).join('')}</ul>`
      : '<p>Aucun risque recensé.</p>';
  } else {
    html += '<p class="error">Données indisponibles pour le moment.</p>';
  }

  html += '<h3>Arrêtés de catastrophe naturelle</h3>';
  if (catnat.status === 'fulfilled') {
    const rows = (catnat.value.data || [])
      .filter(a => /inond|feu|incend|coul/i.test(a.libelle_risque_jo))
      .sort((a, b) => toDate(b.date_debut_evt) - toDate(a.date_debut_evt));
    html += rows.length
      ? `<p class="hint">${rows.length} arrêté(s) inondation / feux</p><table><thead><tr><th>Événement</th><th>Type</th><th>JO</th></tr></thead><tbody>` +
        rows.map(a => `<tr><td>${esc(a.date_debut_evt)}</td><td>${esc(a.libelle_risque_jo)}</td><td>${esc(a.date_publication_jo)}</td></tr>`).join('') +
        '</tbody></table>'
      : '<p>Aucun arrêté inondation ou feux.</p>';
  } else {
    html += '<p class="error">Données indisponibles pour le moment.</p>';
  }

  html += `<p><a href="https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi" target="_blank" rel="noopener">Rapport détaillé à une adresse sur Géorisques</a></p>`;
  document.getElementById('fiche').innerHTML = html;
}
