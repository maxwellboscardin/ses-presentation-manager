/**
 * registry-view.js -- Card-based data point browser.
 * Each data point is a card showing contract values as pills.
 * Click to expand: see full values + inline ingest panel.
 * DB values (data_values table) overlay JSON source values.
 */

import { getFreshness, COLORS } from './freshness.js';
import { getContractsForCollection } from './collections.js';
import { fetchAllValues } from './data-api.js';
import { buildInlineIngestPanel } from './ingest-view.js';

const ALL_CONTRACT_FILES = {
  '1258':     { contract: '../data/contracts/1258.json',     stat: '../data/stat-sheets/1258.json',     updates: null },
  '1334-ceg': { contract: '../data/contracts/1334-ceg.json', stat: '../data/stat-sheets/1334.json',     updates: null },
  '1334-ces': { contract: '../data/contracts/1334-ces.json', stat: '../data/stat-sheets/1334-ces.json', updates: '../data/updates/1334-ces.json' },
  '1465':     { contract: '../data/contracts/1465.json',     stat: '../data/stat-sheets/1465.json',     updates: '../data/updates/1465-qbs.json' },
  '1097':     { contract: '../data/contracts/1097.json',     stat: '../data/stat-sheets/1097.json',     updates: null },
  '3757':     { contract: '../data/contracts/3757.json',     stat: '../data/stat-sheets/3757.json',     updates: null },
  'zurich':   { contract: '../data/contracts/zurich.json',   stat: '../data/stat-sheets/zurich.json',   updates: null },
};

let CONTRACTS = [];
let registry = [];
let contractData = {};
let dbValues = {};
let expandedCardId = null;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Render the unified registry view.
 */
export async function renderRegistryView(container, collectionId) {
  container.innerHTML = '';

  const colContracts = getContractsForCollection(collectionId);
  CONTRACTS = colContracts.map(c => ({
    id: c.id,
    shortLabel: c.shortLabel,
    ...(ALL_CONTRACT_FILES[c.id] || {
      contract: `../data/contracts/${c.id}.json`,
      stat: `../data/stat-sheets/${c.id}.json`,
      updates: null,
    }),
  }));

  // Load registry + contract data + DB values in parallel
  const [regResp, dbVals] = await Promise.all([
    fetch('../data/data-registry.json').then(r => r.json()),
    fetchAllValues(collectionId).catch(() => ({})),
  ]);
  registry = regResp;
  dbValues = dbVals;

  // Filter registry by collection
  if (collectionId) {
    const contractIds = new Set(CONTRACTS.map(c => c.id));
    registry = registry.filter(dp => dp.contracts.some(cid => contractIds.has(cid)));
  }

  await loadAllContractData();

  // Build UI
  const summary = buildSummary();
  const toolbar = buildToolbar();
  const legend = buildLegend();
  const cards = buildCardList();

  container.appendChild(summary);
  container.appendChild(toolbar);
  container.appendChild(legend);
  container.appendChild(cards);
}

async function loadAllContractData() {
  const fetches = CONTRACTS.map(async c => {
    const [contractResp, statResp] = await Promise.all([
      fetch(c.contract).then(r => r.json()).catch(() => null),
      fetch(c.stat).then(r => r.json()).catch(() => null),
    ]);
    const results = { contract: contractResp, stat: statResp };
    if (c.updates) {
      results.updates = await fetch(c.updates).then(r => r.json()).catch(() => null);
    }
    contractData[c.id] = results;
  });
  await Promise.all(fetches);
}

function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

/** Get value: DB override > JSON source */
function getDataValue(dataPoint, contractId) {
  // DB value takes priority
  if (dbValues[dataPoint.id]?.[contractId]) {
    return { value: dbValues[dataPoint.id][contractId].value, source: 'db' };
  }
  // Fall back to JSON
  const data = contractData[contractId];
  if (!data) return { value: undefined, source: 'json' };
  const srcFile = dataPoint.sourceFile;
  let root;
  if (srcFile === 'contracts') root = data.contract;
  else if (srcFile === 'stat-sheets') root = data.stat;
  else if (srcFile === 'updates') root = data.updates;
  if (!root) return { value: undefined, source: 'json' };
  return { value: resolvePath(root, dataPoint.jsonPath), source: 'json' };
}

function getLastUpdated(dataPoint, contractId) {
  if (dbValues[dataPoint.id]?.[contractId]?.updatedAt) {
    return dbValues[dataPoint.id][contractId].updatedAt.split('T')[0];
  }
  return dataPoint.lastUpdated?.[contractId] || null;
}

function formatPreview(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.length > 30 ? value.slice(0, 30) + '...' : value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length === 0 ? '(empty)' : `${value.length} items`;
  if (typeof value === 'object') return `${Object.keys(value).length} fields`;
  return String(value);
}

function formatDetail(value) {
  if (value === undefined || value === null) return 'No data';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty array)';
    if (typeof value[0] === 'string') return value;
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

// ─── UI Builders ─────────────────────────────────────────────

function buildSummary() {
  const wrap = el('div', 'dp-summary');
  const total = registry.length;
  let fresh = 0, aging = 0, stale = 0;

  registry.forEach(dp => {
    dp.contracts.forEach(cid => {
      if (!CONTRACTS.find(c => c.id === cid)) return;
      const date = getLastUpdated(dp, cid);
      const f = getFreshness(date, dp.staleDays);
      if (f.status === 'fresh') fresh++;
      else if (f.status === 'aging') aging++;
      else stale++;
    });
  });

  const totalCells = fresh + aging + stale;
  const dbCount = Object.values(dbValues).reduce((sum, dpMap) => sum + Object.keys(dpMap).length, 0);

  const cards = [
    { value: total, label: 'Data Points' },
    { value: CONTRACTS.length, label: 'Contracts' },
    { value: totalCells, label: 'Total Cells' },
    { value: fresh, label: 'Fresh' },
    { value: aging, label: 'Aging' },
    { value: stale, label: 'Stale' },
    { value: dbCount, label: 'DB Values' },
  ];

  cards.forEach(c => {
    const card = el('div', 'dp-summary__card');
    card.appendChild(el('div', 'dp-summary__card-value', String(c.value)));
    card.appendChild(el('div', 'dp-summary__card-label', c.label));
    wrap.appendChild(card);
  });

  return wrap;
}

function buildToolbar() {
  const bar = el('div', 'dp-toolbar');

  const search = el('input', 'dp-search');
  search.type = 'text';
  search.placeholder = 'Search data points...';
  search.addEventListener('input', () => filterCards(search.value, getActiveFilter()));
  search.id = 'dp-search';
  bar.appendChild(search);

  const filters = ['All', 'Stale', 'Aging', 'Fresh'];
  filters.forEach(label => {
    const btn = el('button', 'dp-filter-btn', label);
    btn.dataset.filter = label.toLowerCase();
    if (label === 'All') btn.classList.add('active');
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.dp-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const searchVal = document.getElementById('dp-search')?.value || '';
      filterCards(searchVal, label.toLowerCase());
    });
    bar.appendChild(btn);
  });

  return bar;
}

function getActiveFilter() {
  const active = document.querySelector('.dp-filter-btn.active');
  return active?.dataset.filter || 'all';
}

function buildLegend() {
  const wrap = el('div', 'dp-legend');
  const items = [
    { color: COLORS.fresh, label: 'Fresh (<=90 days)' },
    { color: COLORS.aging, label: 'Aging (90-135 days)' },
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

function buildCardList() {
  const container = el('div', 'dp-cards');
  container.id = 'dp-cards';

  let currentCategory = '';

  registry.forEach(dp => {
    if (dp.category !== currentCategory) {
      currentCategory = dp.category;
      const header = el('div', 'dp-cat-header', currentCategory);
      header.dataset.category = currentCategory;
      container.appendChild(header);
    }

    const card = buildCard(dp);
    container.appendChild(card);
  });

  return container;
}

function buildCard(dp) {
  const card = el('div', 'dp-card');
  card.dataset.dataPointId = dp.id;
  card.dataset.category = dp.category;
  card.dataset.label = dp.label.toLowerCase();

  // Header row (always visible)
  const header = el('div', 'dp-card__header');

  // Name
  const name = el('div', 'dp-card__name');
  name.textContent = dp.label;
  if (dp.shared) {
    name.appendChild(el('span', 'dp-card__name-sub', 'shared across all'));
  }
  header.appendChild(name);

  // Category tag
  header.appendChild(el('span', 'dp-card__cat', dp.category));

  // Contract pills with freshness
  const pills = el('div', 'dp-card__pills');
  CONTRACTS.forEach(c => {
    const applicable = dp.contracts.includes(c.id);
    if (!applicable) return;

    const pill = el('span', 'dp-card__pill');
    const date = getLastUpdated(dp, c.id);
    const freshness = getFreshness(date, dp.staleDays);
    const { value } = getDataValue(dp, c.id);
    const preview = formatPreview(value);

    const dot = el('span', `dp-fresh-dot dp-fresh-dot--${freshness.status}`);
    pill.appendChild(dot);
    pill.appendChild(el('span', 'dp-card__pill-label', c.shortLabel));
    if (preview) {
      pill.appendChild(el('span', 'dp-card__pill-val', preview));
    }
    pill.dataset.freshness = freshness.status;
    pills.appendChild(pill);
  });
  header.appendChild(pills);

  // Chevron
  header.appendChild(el('span', 'dp-card__chevron', '\u203A'));

  // Click to expand
  header.addEventListener('click', () => toggleCard(dp, card));

  card.appendChild(header);

  // Body (hidden until expanded)
  const body = el('div', 'dp-card__body');
  body.id = `dp-card-body-${dp.id}`;
  card.appendChild(body);

  // Track freshness for filtering
  const statuses = new Set();
  CONTRACTS.forEach(c => {
    if (!dp.contracts.includes(c.id)) return;
    const date = getLastUpdated(dp, c.id);
    statuses.add(getFreshness(date, dp.staleDays).status);
  });
  card.dataset.freshness = [...statuses].join(',');

  return card;
}

function toggleCard(dp, card) {
  const wasExpanded = card.classList.contains('dp-card--expanded');

  // Collapse any previously expanded card
  if (expandedCardId && expandedCardId !== dp.id) {
    const prev = document.querySelector(`.dp-card[data-data-point-id="${expandedCardId}"]`);
    if (prev) {
      prev.classList.remove('dp-card--expanded');
      const prevBody = prev.querySelector('.dp-card__body');
      if (prevBody) prevBody.innerHTML = '';
    }
  }

  if (wasExpanded) {
    card.classList.remove('dp-card--expanded');
    card.querySelector('.dp-card__body').innerHTML = '';
    expandedCardId = null;
  } else {
    card.classList.add('dp-card--expanded');
    expandedCardId = dp.id;
    renderCardBody(dp, card.querySelector('.dp-card__body'));
  }
}

function renderCardBody(dp, body) {
  body.innerHTML = '';

  // Contract value detail rows
  const values = el('div', 'dp-card__values');

  CONTRACTS.forEach(c => {
    const applicable = dp.contracts.includes(c.id);
    if (!applicable) {
      const row = el('div', 'dp-val-row dp-val-row--na');
      row.appendChild(el('span', 'dp-val-row__contract', c.shortLabel));
      row.appendChild(el('span', '', 'N/A'));
      values.appendChild(row);
      return;
    }

    const row = el('div', 'dp-val-row');
    row.appendChild(el('span', 'dp-val-row__contract', c.shortLabel));

    const { value, source } = getDataValue(dp, c.id);
    const detail = formatDetail(value);

    const valueEl = el('div', 'dp-val-row__value');
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      const ul = document.createElement('ul');
      value.forEach(v => {
        const li = document.createElement('li');
        li.textContent = v;
        ul.appendChild(li);
      });
      valueEl.appendChild(ul);
    } else {
      valueEl.textContent = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
    }
    row.appendChild(valueEl);

    // Meta: freshness pill + source badge
    const meta = el('div', 'dp-val-row__meta');
    const date = getLastUpdated(dp, c.id);
    const freshness = getFreshness(date, dp.staleDays);
    const pill = el('span', `dp-fresh-pill dp-fresh-pill--${freshness.status}`);
    pill.textContent = `${freshness.label}${freshness.daysAgo !== null ? ` (${freshness.daysAgo}d)` : ''}`;
    meta.appendChild(pill);

    const srcBadge = el('span', `dp-source-badge${source === 'db' ? ' dp-source-badge--db' : ''}`);
    srcBadge.textContent = source === 'db' ? 'DB' : 'JSON';
    meta.appendChild(srcBadge);
    row.appendChild(meta);

    values.appendChild(row);
  });

  body.appendChild(values);

  // JSON path info
  const path = el('div', 'dp-val-row__path');
  path.textContent = `${dp.sourceFile}/*.json -> ${dp.jsonPath}`;
  body.appendChild(path);

  // Inline ingest panel
  const applicableContracts = CONTRACTS.filter(c => dp.contracts.includes(c.id));
  const ingestPanel = buildInlineIngestPanel(dp, applicableContracts, async (contractId, extractedValue, ingestionResult) => {
    // On apply: refresh this card
    if (dbValues[dp.id] === undefined) dbValues[dp.id] = {};
    dbValues[dp.id][contractId] = {
      value: extractedValue,
      valueType: 'ai-extracted',
      updatedAt: new Date().toISOString(),
    };
    renderCardBody(dp, body);
    // Refresh the pill in the header
    refreshCardHeader(dp);
  });
  body.appendChild(ingestPanel);
}

function refreshCardHeader(dp) {
  const card = document.querySelector(`.dp-card[data-data-point-id="${dp.id}"]`);
  if (!card) return;
  const pills = card.querySelector('.dp-card__pills');
  if (!pills) return;
  pills.innerHTML = '';

  CONTRACTS.forEach(c => {
    if (!dp.contracts.includes(c.id)) return;
    const pill = el('span', 'dp-card__pill');
    const date = getLastUpdated(dp, c.id);
    const freshness = getFreshness(date, dp.staleDays);
    const { value } = getDataValue(dp, c.id);
    const preview = formatPreview(value);
    pill.appendChild(el('span', `dp-fresh-dot dp-fresh-dot--${freshness.status}`));
    pill.appendChild(el('span', 'dp-card__pill-label', c.shortLabel));
    if (preview) pill.appendChild(el('span', 'dp-card__pill-val', preview));
    pill.dataset.freshness = freshness.status;
    pills.appendChild(pill);
  });
}

// ─── Filtering ───────────────────────────────────────────────

function filterCards(query, statusFilter) {
  const q = query.toLowerCase().trim();
  const container = document.getElementById('dp-cards');
  if (!container) return;

  const cards = container.querySelectorAll('.dp-card');
  const catHeaders = container.querySelectorAll('.dp-cat-header');
  const visibleCategories = new Set();

  cards.forEach(card => {
    const label = card.dataset.label || '';
    const category = card.dataset.category || '';
    const freshness = card.dataset.freshness || '';

    const matchesQuery = !q || label.includes(q) || category.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || freshness.split(',').includes(statusFilter);

    const visible = matchesQuery && matchesStatus;
    card.style.display = visible ? '' : 'none';
    if (visible) visibleCategories.add(category);
  });

  catHeaders.forEach(h => {
    h.style.display = visibleCategories.has(h.dataset.category) ? '' : 'none';
  });
}
