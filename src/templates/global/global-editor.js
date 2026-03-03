// Global Editor — Matrix view: rows = contracts, columns = pages
// Each row: cover | overview | snapshot | composition | performance | [updates | sqb] | back cover

import { buildPage1 as buildFlipbookPage1, buildPage2 as buildFlipbookPage2, renderPage1Charts as renderFlipbookPage1Charts, renderPage2Charts as renderFlipbookPage2Charts, buildMFPage1, renderMFPage1Charts } from '../flipbook/contract-spread.js';
import { buildPage as buildStatPage, renderAllCharts as renderStatCharts } from '../stat-sheet/contract-stat-sheet.js';
import { buildOverviewPage, buildCoverPage, buildBackCoverPage, buildBlankPage } from '../presentation/contract-presentation.js';
import { buildUpdatesPage, renderUpdatesCharts, buildSqbPage, renderSqbCharts } from '../updates/contract-updates.js';
import { initCardEditor, replayAnimations } from '../../components/card-editor.js';

// Maps _updated keys from JSON to card header text(s) in the rendered pages
const UPDATED_KEY_TO_HEADERS = {
  statesTivMap: ['TIV Concentration', 'Top States by TIV'],
  topStatesByTiv: ['Top States by TIV'],
  portfolio: ['Portfolio Summary', 'TIV Concentration', 'Top States by TIV'],
  portfolioKpis: ['Portfolio Summary'],
  multiFamily: ['Multifamily Summary', 'Top States by TIV', 'TIV Concentration'],
  deductibles: ['Deductibles & Average Rates', 'Deductible Distribution'],
  averageRates: ['Average Rates'],
  lossExperience: ['Loss Experience', 'Annual Loss Ratio', 'Top Loss Types (Incurred, $M)'],
  propertyRiskScore: ['Property Risk Score'],
};

const CONTRACTS = [
  { id: '1258', shortLabel: '1258 LOC/LOM', code: 'LOC', product: 'Portfolio', title: 'Portfolio + Multifamily', contract: '../data/contracts/1258.json', stat: '../data/stat-sheets/1258.json' },
  { id: '1334-ceg', shortLabel: '1334 CEG', code: 'CEG', product: 'Portfolio', title: 'Portfolio', contract: '../data/contracts/1334-ceg.json', stat: '../data/stat-sheets/1334.json' },
  { id: '1334-ces', shortLabel: '1334 CES', code: 'CES', product: 'Individual Asset', title: 'Individual Asset', contract: '../data/contracts/1334-ces.json', stat: '../data/stat-sheets/1334.json', updates: '../data/updates/1334-ces.json' },
  { id: '1465', shortLabel: '1465 QBS', code: 'QBS', product: 'Individual Asset', title: 'Individual Asset', contract: '../data/contracts/1465.json', stat: '../data/stat-sheets/1465.json', updates: '../data/updates/1465-qbs.json' },
  { id: '1097', shortLabel: '1097 LOL', code: 'LOL', product: 'Portfolio', title: 'Portfolio', contract: '../data/contracts/1097.json', stat: '../data/stat-sheets/1097.json' },
];

// Cross-reference: which presentations each card type appears on
const XREF = {
  cover: ['1258 LOC/LOM', '1334 CEG', '1334 CES', '1465 QBS', '1097 LOL'],
  overview: ['1258 LOC/LOM', '1334 CEG', '1334 CES', '1465 QBS', '1097 LOL'],
  statSheet: null,
  flipP1: null,
  flipP2: null,
  updates: null,
  sqbPortfolio: ['1258 LOC/LOM', '1334 CEG', '1097 LOL'],
  backCover: ['1258 LOC/LOM', '1334 CEG', '1334 CES', '1465 QBS', '1097 LOL'],
};

const PAGE_W = 816;
const PAGE_H = 1056;
const ZOOM_LEVELS = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 1];
const DEFAULT_ZOOM_INDEX = 3;

export async function renderGlobalEditor(root) {
  let zoomIndex = DEFAULT_ZOOM_INDEX;
  const cells = [];

  const nav = buildNav(() => zoomIndex, setZoom);
  root.appendChild(nav);

  const viewport = document.createElement('div');
  viewport.className = 'ge-viewport';
  root.appendChild(viewport);

  const matrix = document.createElement('div');
  matrix.className = 'ge-matrix';
  viewport.appendChild(matrix);

  // Column headers — grouped by spread
  const SPREAD_GROUPS = [
    ['Cover'],
    ['SES Overview', 'Snapshot'],
    ['Composition', 'Performance'],
    ['Updates / S/Q/B', 'MF Composition'],
    ['Back Cover'],
  ];
  const headerRow = document.createElement('div');
  headerRow.className = 'ge-row ge-row--header';
  headerRow.appendChild(makeEl('div', 'ge-row-label'));
  SPREAD_GROUPS.forEach(group => {
    const spread = makeEl('div', 'ge-spread');
    group.forEach(label => {
      const h = makeEl('div', 'ge-col-header');
      h.textContent = label;
      spread.appendChild(h);
    });
    headerRow.appendChild(spread);
  });
  matrix.appendChild(headerRow);

  const sectionEls = [];

  for (const entry of CONTRACTS) {
    // Fetch all data in parallel
    const fetches = [fetch(entry.contract), fetch(entry.stat)];
    if (entry.updates) fetches.push(fetch(entry.updates));
    if (entry.sqb) fetches.push(fetch(entry.sqb));

    const responses = await Promise.all(fetches);
    const contractData = await responses[0].json();
    const statData = await responses[1].json();
    contractData.title = entry.title;
    contractData.code = entry.code;
    contractData.product = entry.product;

    let updatesData = null;
    let sqbData = null;
    let ri = 2;
    if (entry.updates) updatesData = await responses[ri++].json();
    if (entry.sqb) sqbData = await responses[ri++].json();

    const row = document.createElement('div');
    row.className = 'ge-row';
    row.id = `ge-${entry.id}`;
    row.setAttribute('data-contract-label', `${entry.shortLabel} ${entry.title}`);

    // Row label
    const label = makeEl('div', 'ge-row-label');
    const labelText = makeEl('div', 'ge-row-label__text');
    labelText.textContent = entry.shortLabel;
    label.appendChild(labelText);
    const replayBtn = makeEl('button', 'ge-replay');
    replayBtn.innerHTML = `<svg viewBox="0 0 16 16"><path d="M1.5 1.5v5h5"/><path d="M3.5 10.5a6 6 0 1 0 1.3-6.6L1.5 6.5"/></svg>`;
    replayBtn.addEventListener('click', () => replayAnimations(row));
    label.appendChild(replayBtn);
    row.appendChild(label);

    // Column 0: Cover (single)
    const coverSpread = makeEl('div', 'ge-spread');
    addCell(coverSpread, buildCoverPage(contractData), xrefTag('cover', entry.shortLabel));
    row.appendChild(coverSpread);

    // Spread 1: Overview (left) + Snapshot (right)
    const spread1 = makeEl('div', 'ge-spread');
    addCell(spread1, buildOverviewPage(contractData), xrefTag('overview', entry.shortLabel));
    const statPage = buildStatPage(statData);
    tagSharedCards(statPage, entry.shortLabel);
    addCell(spread1, statPage, null, 'right');
    row.appendChild(spread1);

    // Spread 2: Composition (left) + Performance (right)
    const spread2 = makeEl('div', 'ge-spread');
    addCell(spread2, buildFlipbookPage1(contractData), null);
    addCell(spread2, buildFlipbookPage2(contractData), null, 'right');
    row.appendChild(spread2);

    // Spread 3: Updates/SQB (left) + MF Composition (right, 1258 only)
    const spread3 = makeEl('div', 'ge-spread');
    if (updatesData) {
      addCell(spread3, buildUpdatesPage(updatesData), xrefTag('updates', entry.shortLabel));
    } else if (sqbData) {
      addCell(spread3, buildSqbPage(sqbData), xrefTag('sqbPortfolio', entry.shortLabel));
    } else {
      addEmptyCell(spread3);
    }
    if (contractData.multiFamily) {
      addCell(spread3, buildMFPage1(contractData), null, 'right');
    } else {
      addEmptyCell(spread3);
    }
    row.appendChild(spread3);

    // Back Cover (single)
    const backSpread = makeEl('div', 'ge-spread');
    addCell(backSpread, buildBackCoverPage(), xrefTag('backCover', entry.shortLabel));
    row.appendChild(backSpread);

    matrix.appendChild(row);
    sectionEls.push({ id: entry.id, el: row });

    // Render charts
    requestAnimationFrame(() => {
      renderStatCharts(statData, row);
      renderFlipbookPage1Charts(contractData, row);
      renderFlipbookPage2Charts(contractData, row);
      if (contractData.multiFamily) {
        renderMFPage1Charts(contractData, row);
      }
      if (updatesData) {
        renderUpdatesCharts(updatesData, row);
      } else if (sqbData) {
        renderSqbCharts(sqbData, row);
      }
    });

    // Stamp red dots on updated cards
    stampUpdatedDots(row, contractData._updated);
  }

  function addCell(parent, page, tag, position) {
    const cell = makeEl('div', 'ge-cell');
    if (position === 'right' && page.classList.contains('page')) {
      page.classList.add('page--right');
    }
    cell.appendChild(page);
    if (tag) {
      const tagEl = makeEl('div', 'ge-xref');
      tagEl.textContent = tag;
      cell.appendChild(tagEl);
    }
    parent.appendChild(cell);
    cells.push(cell);
  }

  function addEmptyCell(parent) {
    const cell = makeEl('div', 'ge-cell ge-cell--empty');
    parent.appendChild(cell);
    cells.push(cell);
  }

  // ─── Zoom ──────────────────────────────────────────────────

  function setZoom(newIndex) {
    zoomIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, newIndex));
    const scale = ZOOM_LEVELS[zoomIndex];
    const scaledW = Math.round(PAGE_W * scale);
    const scaledH = Math.round(PAGE_H * scale);

    cells.forEach(cell => {
      cell.style.width = scaledW + 'px';
      cell.style.height = scaledH + 'px';
      const page = cell.firstChild;
      if (page && !cell.classList.contains('ge-cell--empty')) {
        page.style.transform = `scale(${scale})`;
        page.style.transformOrigin = 'top left';
      }
    });

    document.querySelectorAll('.ge-col-header').forEach(h => {
      h.style.width = scaledW + 'px';
    });

    nav.querySelector('.ge-zoom__label').textContent = `${Math.round(scale * 100)}%`;
  }

  let zoomDelta = 0;
  const ZOOM_THRESHOLD = 30;
  viewport.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoomDelta += e.deltaY;
      if (Math.abs(zoomDelta) >= ZOOM_THRESHOLD) {
        setZoom(zoomIndex + (zoomDelta < 0 ? 1 : -1));
        zoomDelta = 0;
      }
    }
  }, { passive: false });

  setZoom(zoomIndex);
  setupScrollSpy(sectionEls, viewport);
  initCardEditor();
}

// ─── Cross-reference tag builder ──────────────────────────────

function xrefTag(cardType, currentLabel) {
  const refs = XREF[cardType];
  if (!refs) return null; // unique per-contract, no tag needed
  const others = refs.filter(r => r !== currentLabel.split(' ').slice(0, 2).join(' '));
  if (others.length === 0) return null;
  return `Also: ${others.join(', ')}`;
}

// ─── Card-level shared pills ─────────────────────────────────

const PRODUCT_LINE_GROUPS = [
  ['1334 CEG', '1097 LOL'],     // Portfolio
  ['1334 CES', '1465 QBS'],     // Individual Asset / QUBIE
  // 1258 LOC/LOM has its own version — not in any group
];

const SHARED_CARDS = [
  { match: '.section-header', text: 'On the Horizon', shares: 'all' },
  { match: '.section-header', text: 'AI Roadmap', shares: 'all' },
  { match: '.section-header', text: 'Underwriting Update', shares: 'all' },
  { match: '.section-header', text: 'Organizational Update', shares: 'all' },
];

function tagSharedCards(page, currentLabel) {
  SHARED_CARDS.forEach(({ match, text, shares }) => {
    let others;
    if (shares === 'all') {
      others = CONTRACTS.map(c => c.shortLabel).filter(l => l !== currentLabel);
    } else if (shares === 'productLine') {
      const group = PRODUCT_LINE_GROUPS.find(g => g.includes(currentLabel));
      if (!group) return; // 1258 is alone, no pill
      others = group.filter(l => l !== currentLabel);
    }

    if (!others || others.length === 0) return;
    const tag = `Also: ${others.join(', ')}`;

    const headers = page.querySelectorAll(match);
    headers.forEach(header => {
      if (header.textContent.trim() === text) {
        const card = header.closest('.observations-panel, .chart-container, .kpi-stack, .icon-kpi-card');
        if (card) {
          card.style.position = 'relative';
          const pill = makeEl('span', 'ge-card-pill');
          pill.textContent = tag;
          card.appendChild(pill);
        }
      }
    });
  });
}

// ─── Updated dots ─────────────────────────────────────────────

function stampUpdatedDots(row, updatedKeys) {
  if (!updatedKeys || updatedKeys.length === 0) return;
  const headerTexts = new Set();
  updatedKeys.forEach(key => {
    const headers = UPDATED_KEY_TO_HEADERS[key];
    if (headers) headers.forEach(h => headerTexts.add(h));
  });
  if (headerTexts.size === 0) return;

  const allHeaders = row.querySelectorAll('.section-header');
  allHeaders.forEach(header => {
    if (headerTexts.has(header.textContent.trim())) {
      const card = header.closest('.observations-panel, .chart-container, .kpi-stack, .icon-kpi-card, .kpi-row');
      if (card) {
        card.style.position = 'relative';
        const dot = makeEl('div', 'ge-updated-dot');
        card.appendChild(dot);
      }
    }
  });

  // KPI rows use data-label instead of .section-header
  const kpiRows = row.querySelectorAll('.kpi-row[data-label]');
  kpiRows.forEach(kpiRow => {
    if (headerTexts.has(kpiRow.getAttribute('data-label'))) {
      kpiRow.style.position = 'relative';
      const dot = makeEl('div', 'ge-updated-dot');
      kpiRow.appendChild(dot);
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────

function makeEl(tag, className) {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

function buildNav(getZoomIndex, setZoom) {
  const nav = makeEl('nav', 'ge-nav');

  const home = document.createElement('a');
  home.className = 'ge-nav__btn';
  home.href = 'index.html';
  home.textContent = 'Home';
  nav.appendChild(home);
  nav.appendChild(buildSep());

  const tabs = makeEl('div', 'ge-nav__tabs');
  CONTRACTS.forEach(entry => {
    const tab = makeEl('button', 'ge-nav__tab');
    tab.textContent = entry.shortLabel;
    tab.dataset.target = entry.id;
    tab.addEventListener('click', () => {
      const target = document.getElementById(`ge-${entry.id}`);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
    tabs.appendChild(tab);
  });
  nav.appendChild(tabs);
  nav.appendChild(buildSep());

  const zoom = makeEl('div', 'ge-zoom');
  const zoomOut = makeEl('button', 'ge-nav__btn');
  zoomOut.textContent = '\u2212';
  zoomOut.addEventListener('click', () => setZoom(getZoomIndex() - 1));
  zoom.appendChild(zoomOut);
  const zoomLabel = makeEl('span', 'ge-zoom__label');
  zoom.appendChild(zoomLabel);
  const zoomIn = makeEl('button', 'ge-nav__btn');
  zoomIn.textContent = '+';
  zoomIn.addEventListener('click', () => setZoom(getZoomIndex() + 1));
  zoom.appendChild(zoomIn);
  nav.appendChild(zoom);

  return nav;
}

function buildSep() {
  return makeEl('div', 'ge-nav__sep');
}

function setupScrollSpy(sectionEls, viewport) {
  const tabs = document.querySelectorAll('.ge-nav__tab');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id.replace('ge-', '');
        tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.target === id));
      }
    });
  }, { root: viewport, rootMargin: '0px 0px -70% 0px', threshold: 0 });
  sectionEls.forEach(({ el }) => observer.observe(el));
}
