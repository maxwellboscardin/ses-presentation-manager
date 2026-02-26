// Global Editor — Matrix view: rows = contracts, columns = pages
// Each row: cover | overview | stat sheet | flip p1 | flip p2 | [updates | sqb] | back cover

import { buildPage1 as buildFlipbookPage1, buildPage2 as buildFlipbookPage2, renderPage1Charts as renderFlipbookPage1Charts, renderPage2Charts as renderFlipbookPage2Charts } from '../flipbook/contract-spread.js';
import { buildPage as buildStatPage, renderAllCharts as renderStatCharts } from '../stat-sheet/contract-stat-sheet.js';
import { buildOverviewPage, buildCoverPage, buildBackCoverPage, buildBlankPage } from '../presentation/contract-presentation.js';
import { buildUpdatesPage, renderUpdatesCharts, buildSqbPage, renderSqbCharts } from '../updates/contract-updates.js';
import { initCardEditor, replayAnimations } from '../../components/card-editor.js';

const CONTRACTS = [
  { id: '1258', shortLabel: '1258 LOC/LOM', title: 'Portfolio + Multifamily', contract: '../data/contracts/1258.json', stat: '../data/stat-sheets/1258.json' },
  { id: '1334-ceg', shortLabel: '1334 CEG', title: 'Portfolio', contract: '../data/contracts/1334.json', stat: '../data/stat-sheets/1334.json' },
  { id: '1334-ces', shortLabel: '1334 CES', title: 'Individual Asset', contract: '../data/contracts/1334.json', stat: '../data/stat-sheets/1334.json', updates: '../data/updates/1334-ces.json' },
  { id: '1465', shortLabel: '1465 QBS', title: 'Individual Asset', contract: '../data/contracts/1465.json', stat: '../data/stat-sheets/1465.json', updates: '../data/updates/1465-qbs.json' },
  { id: '1097', shortLabel: '1097 LOL', title: 'Portfolio', contract: '../data/contracts/1097.json', stat: '../data/stat-sheets/1097.json' },
];

// Cross-reference: which presentations each card type appears on
const XREF = {
  cover: ['1258', '1334 CEG', '1334 CES', '1465', '1097'],
  overview: ['1258', '1334 CEG', '1334 CES', '1465', '1097'],
  statSheet: null,
  flipP1: null,
  flipP2: null,
  updates: ['1334 CES', '1465'],
  sqbPortfolio: ['1258', '1334 CEG', '1097'],
  backCover: ['1258', '1334 CEG', '1334 CES', '1465', '1097'],
};

// Columns: cover + overview + stat + flip1 + flip2 + updates/sqb + (TBD) + back = 8
const COL_LABELS = ['Cover', 'SES Overview', 'Stat Sheet', 'Portfolio P1', 'Portfolio P2', 'Updates / S/Q/B', 'TBD', 'Back Cover'];
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

  // Column headers
  const headerRow = document.createElement('div');
  headerRow.className = 'ge-row ge-row--header';
  headerRow.appendChild(makeEl('div', 'ge-row-label'));
  COL_LABELS.forEach(label => {
    const h = makeEl('div', 'ge-col-header');
    h.textContent = label;
    headerRow.appendChild(h);
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

    let updatesData = null;
    let sqbData = null;
    let ri = 2;
    if (entry.updates) updatesData = await responses[ri++].json();
    if (entry.sqb) sqbData = await responses[ri++].json();

    const row = document.createElement('div');
    row.className = 'ge-row';
    row.id = `ge-${entry.id}`;

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

    // Column 0: Cover
    addCell(row, buildCoverPage(contractData), xrefTag('cover', entry.shortLabel));

    // Column 1: Overview
    addCell(row, buildOverviewPage(contractData), xrefTag('overview', entry.shortLabel));

    // Column 2: Stat Sheet
    addCell(row, buildStatPage(statData), null);

    // Column 3: Flipbook P1
    addCell(row, buildFlipbookPage1(contractData), null);

    // Column 4: Flipbook P2
    addCell(row, buildFlipbookPage2(contractData), null);

    // Column 5: Updates (Individual Asset) or S/Q/B (Portfolio)
    if (updatesData) {
      addCell(row, buildUpdatesPage(updatesData), xrefTag('updates', entry.shortLabel));
    } else if (sqbData) {
      addCell(row, buildSqbPage(sqbData), xrefTag('sqbPortfolio', entry.shortLabel));
    } else {
      addEmptyCell(row);
    }

    // Column 6: Blank / TBD
    addCell(row, buildBlankPage(), null);

    // Column 7: Back Cover
    addCell(row, buildBackCoverPage(), xrefTag('backCover', entry.shortLabel));

    matrix.appendChild(row);
    sectionEls.push({ id: entry.id, el: row });

    // Render charts
    requestAnimationFrame(() => {
      renderStatCharts(statData, row);
      renderFlipbookPage1Charts(contractData, row);
      renderFlipbookPage2Charts(contractData, row);
      if (updatesData) {
        renderUpdatesCharts(updatesData, row);
      } else if (sqbData) {
        renderSqbCharts(sqbData, row);
      }
    });
  }

  function addCell(row, page, tag) {
    const cell = makeEl('div', 'ge-cell');
    cell.appendChild(page);
    if (tag) {
      const tagEl = makeEl('div', 'ge-xref');
      tagEl.textContent = tag;
      cell.appendChild(tagEl);
    }
    row.appendChild(cell);
    cells.push(cell);
  }

  function addEmptyCell(row) {
    const cell = makeEl('div', 'ge-cell ge-cell--empty');
    row.appendChild(cell);
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

    headerRow.querySelectorAll('.ge-col-header').forEach(h => {
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
  if (others.length === refs.length - 1 && refs.length >= 4) return `Shared: all ${refs.length}`;
  return `Also: ${others.join(', ')}`;
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
