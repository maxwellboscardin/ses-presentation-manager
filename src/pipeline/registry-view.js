/**
 * registry-view.js — Matrix browser for all data points × contracts.
 * Shows freshness dots, value previews, and click-to-inspect overlay.
 */

import { getFreshness, COLORS } from './freshness.js';
import { loadLastUpdated } from './pipeline-storage.js';

const CONTRACTS = [
  { id: '1258', shortLabel: '1258 LOC', contract: '../data/contracts/1258.json', stat: '../data/stat-sheets/1258.json', updates: null },
  { id: '1334-ceg', shortLabel: '1334 CEG', contract: '../data/contracts/1334-ceg.json', stat: '../data/stat-sheets/1334.json', updates: null },
  { id: '1334-ces', shortLabel: '1334 CES', contract: '../data/contracts/1334-ces.json', stat: '../data/stat-sheets/1334-ces.json', updates: '../data/updates/1334-ces.json' },
  { id: '1465', shortLabel: '1465 QBS', contract: '../data/contracts/1465.json', stat: '../data/stat-sheets/1465.json', updates: '../data/updates/1465-qbs.json' },
  { id: '1097', shortLabel: '1097 LOL', contract: '../data/contracts/1097.json', stat: '../data/stat-sheets/1097.json', updates: null },
  { id: '3757', shortLabel: '3757 GLR', contract: '../data/contracts/3757.json', stat: '../data/stat-sheets/3757.json', updates: null },
];

let registry = [];
let contractData = {};
let overlay = null;

/**
 * Render the registry view into the given container.
 */
export async function renderRegistryView(container) {
  container.innerHTML = '';

  // Load registry + contract data
  const [regResp] = await Promise.all([fetch('../data/data-registry.json')]);
  registry = await regResp.json();

  // Load all contract data in parallel
  await loadAllContractData();

  // Build the view
  const toolbar = buildToolbar();
  const summary = buildSummary();
  const legend = buildLegend();
  const matrix = buildMatrix();

  container.appendChild(toolbar);
  container.appendChild(summary);
  container.appendChild(legend);
  container.appendChild(matrix);
}

async function loadAllContractData() {
  const fetches = CONTRACTS.map(async c => {
    const results = {};
    const [contractResp, statResp] = await Promise.all([
      fetch(c.contract).then(r => r.json()).catch(() => null),
      fetch(c.stat).then(r => r.json()).catch(() => null),
    ]);
    results.contract = contractResp;
    results.stat = statResp;
    if (c.updates) {
      results.updates = await fetch(c.updates).then(r => r.json()).catch(() => null);
    }
    contractData[c.id] = results;
  });
  await Promise.all(fetches);
}

/** Resolve a dotted path on an object. */
function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

/** Get the actual value for a data point + contract. */
function getDataValue(dataPoint, contractId) {
  const data = contractData[contractId];
  if (!data) return undefined;

  const source = dataPoint.sourceFile;
  let root;
  if (source === 'contracts') root = data.contract;
  else if (source === 'stat-sheets') root = data.stat;
  else if (source === 'updates') root = data.updates;

  if (!root) return undefined;
  return resolvePath(root, dataPoint.jsonPath);
}

/** Format a value for short preview in a cell. */
function formatPreview(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty)';
    if (typeof value[0] === 'string') return value[0].slice(0, 30) + (value[0].length > 30 ? '...' : '');
    if (typeof value[0] === 'object') return `${value.length} items`;
    return `${value.length} items`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return `${keys.length} fields`;
  }
  return String(value);
}

/** Format a value for the detail overlay. */
function formatDetail(value) {
  if (value === undefined || value === null) return 'No data';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty array)';
    if (typeof value[0] === 'string') return value.map(v => `\u2022 ${v}`).join('\n');
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/** Get the effective lastUpdated date, merging localStorage overrides. */
function getLastUpdated(dataPoint, contractId) {
  const overrides = loadLastUpdated();
  if (overrides[dataPoint.id] && overrides[dataPoint.id][contractId]) {
    return overrides[dataPoint.id][contractId];
  }
  return dataPoint.lastUpdated?.[contractId] || null;
}

// ─── UI Builders ─────────────────────────────────────────────

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function buildToolbar() {
  const bar = el('div', 'dp-toolbar');

  const search = el('input', 'dp-search');
  search.type = 'text';
  search.placeholder = 'Search data points...';
  search.addEventListener('input', () => filterMatrix(search.value));
  bar.appendChild(search);

  const filters = ['All', 'Stale', 'Aging', 'Fresh'];
  filters.forEach(label => {
    const btn = el('button', 'dp-filter-btn', label);
    if (label === 'All') btn.classList.add('active');
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.dp-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterByFreshness(label.toLowerCase());
    });
    bar.appendChild(btn);
  });

  return bar;
}

function buildSummary() {
  const wrap = el('div', 'dp-summary');

  const total = registry.length;
  let fresh = 0, aging = 0, stale = 0;

  registry.forEach(dp => {
    dp.contracts.forEach(cid => {
      const date = getLastUpdated(dp, cid);
      const f = getFreshness(date, dp.staleDays);
      if (f.status === 'fresh') fresh++;
      else if (f.status === 'aging') aging++;
      else stale++;
    });
  });

  const totalCells = fresh + aging + stale;
  const cards = [
    { value: total, label: 'Data Points' },
    { value: CONTRACTS.length, label: 'Contracts' },
    { value: totalCells, label: 'Total Cells' },
    { value: fresh, label: 'Fresh' },
    { value: aging, label: 'Aging' },
    { value: stale, label: 'Stale' },
  ];

  cards.forEach(c => {
    const card = el('div', 'dp-summary__card');
    card.appendChild(el('div', 'dp-summary__card-value', String(c.value)));
    card.appendChild(el('div', 'dp-summary__card-label', c.label));
    wrap.appendChild(card);
  });

  return wrap;
}

function buildLegend() {
  const wrap = el('div', 'dp-legend');
  const items = [
    { color: COLORS.fresh, label: 'Fresh (\u226490 days)' },
    { color: COLORS.aging, label: 'Aging (90\u2013135 days)' },
    { color: COLORS.stale, label: 'Stale (>135 days)' },
    { color: COLORS.unknown, label: 'Unknown' },
  ];
  items.forEach(item => {
    const row = el('div', 'dp-legend__item');
    const dot = el('span', 'dp-legend__dot');
    dot.style.background = item.color;
    row.appendChild(dot);
    row.appendChild(el('span', '', item.label));
    wrap.appendChild(row);
  });
  return wrap;
}

function buildMatrix() {
  const table = el('table', 'dp-matrix');
  table.id = 'dp-matrix';

  // Header
  const thead = el('thead');
  const headerRow = el('tr');
  headerRow.appendChild(el('th', '', 'Data Point'));
  CONTRACTS.forEach(c => headerRow.appendChild(el('th', '', c.shortLabel)));
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body — grouped by category
  const tbody = el('tbody');
  let currentCategory = '';

  registry.forEach(dp => {
    // Category header
    if (dp.category !== currentCategory) {
      currentCategory = dp.category;
      const catRow = el('tr', 'dp-matrix__cat-row');
      catRow.dataset.category = currentCategory;
      const catCell = document.createElement('td');
      catCell.colSpan = CONTRACTS.length + 1;
      catCell.textContent = currentCategory;
      catRow.appendChild(catCell);
      tbody.appendChild(catRow);
    }

    const row = el('tr');
    row.dataset.dataPointId = dp.id;
    row.dataset.category = dp.category;
    row.dataset.label = dp.label.toLowerCase();

    // Label cell
    const labelCell = el('td', 'dp-matrix__label');
    labelCell.textContent = dp.label;
    if (dp.shared) {
      const sub = el('span', 'dp-matrix__label-sub', 'shared across all');
      labelCell.appendChild(sub);
    }
    row.appendChild(labelCell);

    // Contract cells
    CONTRACTS.forEach(c => {
      const td = el('td', 'dp-matrix__cell');
      const applicable = dp.contracts.includes(c.id);

      if (!applicable) {
        td.classList.add('dp-matrix__cell--na');
        const naSpan = el('span', 'dp-cell__na', '\u2014');
        td.appendChild(naSpan);
      } else {
        const date = getLastUpdated(dp, c.id);
        const freshness = getFreshness(date, dp.staleDays);
        const value = getDataValue(dp, c.id);
        const preview = formatPreview(value);

        const cell = el('div', 'dp-cell');

        const dot = el('span', `dp-cell__dot dp-cell__dot--${freshness.status}`);
        dot.title = `${freshness.label}${freshness.daysAgo !== null ? ` (${freshness.daysAgo}d ago)` : ''}`;
        cell.appendChild(dot);

        if (preview) {
          const prev = el('span', 'dp-cell__preview', preview);
          cell.appendChild(prev);
        }

        td.appendChild(cell);
        td.dataset.freshness = freshness.status;

        td.addEventListener('click', () => openOverlay(dp, c.id, value, freshness));
      }

      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table;
}

// ─── Filtering ───────────────────────────────────────────────

function filterMatrix(query) {
  const q = query.toLowerCase().trim();
  const tbody = document.querySelector('#dp-matrix tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr');
  const visibleCategories = new Set();

  rows.forEach(row => {
    if (row.classList.contains('dp-matrix__cat-row')) return; // handle below
    const label = row.dataset.label || '';
    const category = row.dataset.category || '';
    const visible = !q || label.includes(q) || category.toLowerCase().includes(q);
    row.style.display = visible ? '' : 'none';
    if (visible) visibleCategories.add(category);
  });

  // Show/hide category headers
  rows.forEach(row => {
    if (!row.classList.contains('dp-matrix__cat-row')) return;
    row.style.display = visibleCategories.has(row.dataset.category) ? '' : 'none';
  });
}

function filterByFreshness(status) {
  const tbody = document.querySelector('#dp-matrix tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr');
  const visibleCategories = new Set();

  rows.forEach(row => {
    if (row.classList.contains('dp-matrix__cat-row')) return;
    if (status === 'all') {
      row.style.display = '';
      visibleCategories.add(row.dataset.category);
      return;
    }

    const cells = row.querySelectorAll('.dp-matrix__cell:not(.dp-matrix__cell--na)');
    let hasMatch = false;
    cells.forEach(cell => {
      if (cell.dataset.freshness === status) hasMatch = true;
    });
    row.style.display = hasMatch ? '' : 'none';
    if (hasMatch) visibleCategories.add(row.dataset.category);
  });

  rows.forEach(row => {
    if (!row.classList.contains('dp-matrix__cat-row')) return;
    row.style.display = visibleCategories.has(row.dataset.category) ? '' : 'none';
  });
}

// ─── Detail Overlay ──────────────────────────────────────────

function openOverlay(dataPoint, contractId, value, freshness) {
  closeOverlay();

  const contractLabel = CONTRACTS.find(c => c.id === contractId)?.shortLabel || contractId;

  overlay = el('div', 'dp-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });

  const panel = el('div', 'dp-overlay__panel');

  // Close button
  const closeBtn = el('button', 'dp-overlay__close', '\u00d7');
  closeBtn.addEventListener('click', closeOverlay);
  panel.appendChild(closeBtn);

  // Title
  panel.appendChild(el('div', 'dp-overlay__title', dataPoint.label));
  panel.appendChild(el('div', 'dp-overlay__subtitle', `${contractLabel} \u2022 ${dataPoint.category}`));

  // Meta badges
  const meta = el('div', 'dp-overlay__meta');

  const freshBadge = el('span', 'dp-overlay__badge');
  const freshDot = el('span', 'dp-overlay__badge-dot');
  freshDot.style.background = freshness.color;
  freshBadge.appendChild(freshDot);
  freshBadge.appendChild(document.createTextNode(
    `${freshness.label}${freshness.daysAgo !== null ? ` \u2022 ${freshness.daysAgo}d ago` : ''}`
  ));
  meta.appendChild(freshBadge);

  meta.appendChild(el('span', 'dp-overlay__badge', dataPoint.dataType));
  meta.appendChild(el('span', 'dp-overlay__badge', dataPoint.sourceFile));
  if (dataPoint.shared) {
    meta.appendChild(el('span', 'dp-overlay__badge', 'Shared'));
  }
  panel.appendChild(meta);

  // Data value
  const dataSection = el('div', 'dp-overlay__data');
  dataSection.appendChild(el('div', 'dp-overlay__data-label', 'Current Value'));
  const valueEl = el('div', 'dp-overlay__data-value');

  const detail = formatDetail(value);
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    const ul = document.createElement('ul');
    value.forEach(v => {
      const li = document.createElement('li');
      li.textContent = v;
      ul.appendChild(li);
    });
    valueEl.appendChild(ul);
  } else {
    valueEl.textContent = detail;
  }

  dataSection.appendChild(valueEl);
  panel.appendChild(dataSection);

  // JSON path
  const pathEl = el('div', 'dp-overlay__path', `${dataPoint.sourceFile}/${contractId}.json \u2192 ${dataPoint.jsonPath}`);
  panel.appendChild(pathEl);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  // ESC to close
  document.addEventListener('keydown', handleOverlayEsc);
}

function closeOverlay() {
  if (overlay) {
    const el = overlay;
    el.classList.remove('visible');
    overlay = null;
    setTimeout(() => el.remove(), 200);
  }
  document.removeEventListener('keydown', handleOverlayEsc);
}

function handleOverlayEsc(e) {
  if (e.key === 'Escape') closeOverlay();
}

/**
 * Return freshness summary counts for the nav stats bar.
 */
export function getFreshnessCounts() {
  let fresh = 0, aging = 0, stale = 0;
  registry.forEach(dp => {
    dp.contracts.forEach(cid => {
      const date = getLastUpdated(dp, cid);
      const f = getFreshness(date, dp.staleDays);
      if (f.status === 'fresh') fresh++;
      else if (f.status === 'aging') aging++;
      else stale++;
    });
  });
  return { fresh, aging, stale };
}
