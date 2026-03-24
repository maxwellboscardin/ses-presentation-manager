/**
 * data-pipeline.js -- Main orchestrator for the Data Pipeline.
 * Single unified view: header + summary stats + filter bar + card list.
 * No tabs -- registry and ingest are merged into card-based UI.
 */

import { renderRegistryView } from './registry-view.js';
import { getActiveCollection, COLLECTIONS } from './collections.js';

let activeCollection = null;

export async function renderDataPipeline(root) {
  root.innerHTML = '';
  root.className = 'dp-app';

  activeCollection = getActiveCollection();

  const nav = buildNav();
  const content = document.createElement('div');
  content.className = 'dp-content';
  content.id = 'dp-content';

  root.appendChild(nav);
  root.appendChild(content);

  await renderRegistryView(content, activeCollection);
}

function buildNav() {
  const nav = document.createElement('nav');
  nav.className = 'dp-nav';

  // Home link
  const home = document.createElement('a');
  home.className = 'dp-nav__btn';
  const col = activeCollection && COLLECTIONS[activeCollection];
  home.href = col ? col.indexUrl : 'index.html';
  home.textContent = col ? col.label : 'Home';
  nav.appendChild(home);

  // Editor link
  const editor = document.createElement('a');
  editor.className = 'dp-nav__btn';
  editor.href = activeCollection ? `global-editor.html?collection=${activeCollection}` : 'global-editor.html';
  editor.textContent = 'Editor';
  nav.appendChild(editor);

  nav.appendChild(buildSep());

  // Title
  const title = document.createElement('span');
  title.className = 'dp-nav__title';
  title.textContent = 'Data Pipeline';
  nav.appendChild(title);

  // Right side: collection picker
  const right = document.createElement('div');
  right.className = 'dp-nav__right';

  const picker = document.createElement('select');
  picker.className = 'dp-collection-picker';
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'All Collections';
  picker.appendChild(allOpt);

  Object.entries(COLLECTIONS).forEach(([id, col]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = col.label;
    if (id === activeCollection) opt.selected = true;
    picker.appendChild(opt);
  });

  picker.addEventListener('change', () => {
    const val = picker.value;
    const url = new URL(window.location);
    if (val) url.searchParams.set('collection', val);
    else url.searchParams.delete('collection');
    window.location.href = url.toString();
  });

  right.appendChild(picker);
  nav.appendChild(right);

  return nav;
}

function buildSep() {
  const sep = document.createElement('div');
  sep.className = 'dp-nav__sep';
  return sep;
}
