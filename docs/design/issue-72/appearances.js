/* This study changes only preview URLs and labels; it never reads app storage. */
const appearanceThemes = window.pabloTabletAppearanceThemes || [];
if (appearanceThemes.length) {
const $ = selector => document.querySelector(selector);
const pageNames = { dashboard: 'Inicio', assistant: 'Asistente', calendar: 'Calendario', clock: 'Reloj', weather: 'Tiempo', notes: 'Notas', gallery: 'Galería', settings: 'Ajustes' };
const state = { theme: 'nordic', page: 'dashboard', orientation: 'landscape', language: 'es', mode: 'single', editing: false };
const query = new URLSearchParams(location.search);
if (appearanceThemes.some(theme => theme.id === query.get('theme'))) state.theme = query.get('theme');
if (Object.hasOwn(pageNames, query.get('page'))) state.page = query.get('page');
if (['landscape', 'portrait'].includes(query.get('orientation'))) state.orientation = query.get('orientation');
if (['es', 'en'].includes(query.get('language'))) state.language = query.get('language');
if (['single', 'all'].includes(query.get('mode'))) state.mode = query.get('mode');

function path(theme) {
  const suffix = state.editing && state.page === 'dashboard' ? '-edit' : '';
  return `assets/appearances/${theme}-${state.page}-${state.language}-${state.orientation}${suffix}.svg`;
}

for (const [index, theme] of appearanceThemes.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-choice';
  button.dataset.theme = theme.id;
  button.setAttribute('aria-pressed', 'false');
  const image = document.createElement('img');
  image.src = `assets/appearances/${theme.id}-dashboard-es-landscape.svg`;
  image.alt = '';
  image.width = 1280;
  image.height = 800;
  const title = document.createElement('strong');
  title.textContent = `${index + 1}. ${theme.name}`;
  const detail = document.createElement('small');
  detail.textContent = theme.concept;
  button.append(image, title, detail);
  button.addEventListener('click', () => { state.theme = theme.id; state.mode = 'single'; update(); });
  $('#theme-choices').append(button);

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'comparison-card';
  card.dataset.compareTheme = theme.id;
  const heading = document.createElement('strong');
  heading.textContent = `${index + 1}. ${theme.name} · ${theme.concept}`;
  const preview = document.createElement('img');
  preview.alt = `Propuesta ${theme.name}`;
  preview.loading = 'lazy';
  const description = document.createElement('span');
  description.className = 'comparison-description';
  description.textContent = theme.detail;
  card.append(heading, preview, description);
  card.addEventListener('click', () => { state.theme = theme.id; state.mode = 'single'; update(); });
  $('#comparison-grid').append(card);
}

function update() {
  const theme = appearanceThemes.find(item => item.id === state.theme);
  const portrait = state.orientation === 'portrait';
  if (state.page !== 'dashboard') state.editing = false;
  for (const key of ['page', 'orientation', 'language', 'mode']) $(`#${key}`).value = state[key];
  $('#editing').checked = state.editing;
  $('#editing').disabled = state.page !== 'dashboard';
  $('#single-view').hidden = state.mode !== 'single';
  $('#all-view').hidden = state.mode !== 'all';
  $('#theme-name').textContent = theme.name;
  $('#concept').textContent = theme.concept;
  for (const key of ['detail', 'benefit', 'risk']) $(`#${key}`).textContent = theme[key];
  const label = `${theme.name} · ${pageNames[state.page]} · ${portrait ? 'Vertical' : 'Horizontal'} · ${state.language.toUpperCase()}${state.editing ? ' · Edición' : ''}`;
  $('#preview').src = path(state.theme);
  $('#preview').width = portrait ? 800 : 1280;
  $('#preview').height = portrait ? 1200 : 800;
  $('#preview').alt = `Boceto ${label}. Datos ficticios, sin cambios en la aplicación.`;
  $('#open-svg').href = path(state.theme);
  $('#preview-frame').classList.toggle('portrait', portrait);
  $('#caption').textContent = `${label}. Propuesta visual: los controles del dibujo no ejecutan acciones.`;
  $('#geometry').textContent = state.page === 'dashboard'
    ? 'Los cuatro widgets mantienen sus posiciones y tamaños al cambiar de tema o activar la muestra de edición.'
    : 'Exploración de la zona visible. Se conservan los módulos; el boceto no sustituye el inventario completo de herramientas y estados.';
  document.querySelectorAll('[data-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === state.theme)));
  if (state.mode === 'all') document.querySelectorAll('[data-compare-theme]').forEach(card => {
    const image = card.querySelector('img');
    image.src = path(card.dataset.compareTheme);
    image.width = portrait ? 800 : 1280;
    image.height = portrait ? 1200 : 800;
    image.alt = `${card.querySelector('strong').textContent}, ${pageNames[state.page]}, ${portrait ? 'vertical' : 'horizontal'}, ${state.language.toUpperCase()}.`;
  });
}
for (const key of ['page', 'orientation', 'language', 'mode']) $(`#${key}`).addEventListener('change', event => { state[key] = event.target.value; update(); });
$('#editing').addEventListener('change', event => { state.editing = event.target.checked; update(); });
update();

}
