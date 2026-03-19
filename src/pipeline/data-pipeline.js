/**
 * data-pipeline.js — Main orchestrator for the Data Pipeline.
 * Handles tab navigation, view switching, and initialization.
 */

import { renderRegistryView } from './registry-view.js';
import { renderIngestView } from './ingest-view.js';
import { renderRequestView } from './request-view.js';
import { renderSourceView } from './source-view.js';
import { getActiveCollection, COLLECTIONS } from './collections.js';

const TABS = [
  { id: 'registry', label: 'Registry', render: renderRegistryView },
  { id: 'ingest', label: 'Ingest', render: renderIngestView },
  { id: 'requests', label: 'Requests', render: renderRequestView },
  { id: 'sources', label: 'Sources', render: renderSourceView },
];

let activeTab = 'registry';
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

  await switchTab('registry', content);
}

function buildNav() {
  const nav = document.createElement('nav');
  nav.className = 'dp-nav';

  // Home link — goes to collection index if scoped, otherwise main index
  const home = document.createElement('a');
  home.className = 'dp-nav__btn';
  const col = activeCollection && COLLECTIONS[activeCollection];
  home.href = col ? col.indexUrl : 'index.html';
  home.textContent = col ? col.label : 'Home';
  nav.appendChild(home);

  // Editor link — pass collection param through
  const editor = document.createElement('a');
  editor.className = 'dp-nav__btn';
  editor.href = activeCollection ? `global-editor.html?collection=${activeCollection}` : 'global-editor.html';
  editor.textContent = 'Editor';
  nav.appendChild(editor);

  nav.appendChild(buildSep());

  // Pipeline title
  const title = document.createElement('span');
  title.className = 'dp-nav__btn';
  title.style.color = 'rgba(255,255,255,0.8)';
  title.style.cursor = 'default';
  title.textContent = 'Data Pipeline';
  nav.appendChild(title);

  nav.appendChild(buildSep());

  // Tab buttons
  const tabs = document.createElement('div');
  tabs.className = 'dp-nav__tabs';
  tabs.id = 'dp-tabs';

  TABS.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'dp-nav__tab';
    btn.textContent = tab.label;
    btn.dataset.tab = tab.id;
    if (tab.id === activeTab) btn.classList.add('active');
    btn.addEventListener('click', () => {
      const content = document.getElementById('dp-content');
      switchTab(tab.id, content);
    });
    tabs.appendChild(btn);
  });

  nav.appendChild(tabs);

  return nav;
}

function buildSep() {
  const sep = document.createElement('div');
  sep.className = 'dp-nav__sep';
  return sep;
}

async function switchTab(tabId, content) {
  activeTab = tabId;

  // Update active state
  document.querySelectorAll('#dp-tabs .dp-nav__tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Render view
  content.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px;">Loading...</div>';

  const tab = TABS.find(t => t.id === tabId);
  if (tab) {
    content.innerHTML = '';
    await tab.render(content, activeCollection);
  }
}
