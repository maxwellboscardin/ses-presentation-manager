// Contract Snapshot — Single-Page Dashboard Template

import { createGaugeChart } from '../../components/gauge-chart.js';
import { createComboChart, createComboLegend } from '../../components/combo-chart.js';
import { initCardEditor } from '../../components/card-editor.js';

export async function renderStatSheet(container, dataUrl) {
  const res = await fetch(dataUrl);
  const data = await res.json();

  const viewport = document.createElement('div');
  viewport.className = 'stat-sheet-viewport';

  viewport.appendChild(buildPage(data));

  // Toolbar
  const toolbar = buildToolbar(() => replayAllAnimations(data));
  container.appendChild(toolbar);
  container.appendChild(viewport);

  // Auto-scale stat sheet to fit viewport
  function autoScale() {
    const contentW = 816 + 48;
    const contentH = 1056 + 48;
    const scale = Math.min(window.innerWidth / contentW, window.innerHeight / contentH, 1);
    viewport.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  autoScale();
  window.addEventListener('resize', autoScale);

  // Render charts after layout fully settles
  setTimeout(() => renderAllCharts(data), 50);

  initCardEditor();
}

// ─── Toolbar ──────────────────────────────────────────────────

function buildToolbar(onReplay) {
  const toolbar = document.createElement('div');
  toolbar.className = 'viewer-toolbar';

  const replayBtn = document.createElement('button');
  replayBtn.className = 'viewer-toolbar__btn';
  replayBtn.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
    Replay
  `;
  replayBtn.addEventListener('click', onReplay);
  toolbar.appendChild(replayBtn);

  return toolbar;
}

function replayAllAnimations(data) {
  renderAllCharts(data, null);
}

// ─── Page Assembly ────────────────────────────────────────────

export function buildPage(data) {
  const page = document.createElement('div');
  page.className = 'page';

  const inner = document.createElement('div');
  inner.className = 'page__inner';

  // Header
  inner.appendChild(buildHeader(data));

  // Content rows
  const content = document.createElement('div');
  content.className = 'stat-sheet-content';

  // Row 1: Capacity Utilization | Premium | Portfolio (thirds)
  content.appendChild(buildRow1(data));

  // Row 2: Underwriting Update (full width)
  // Row 3: Organizational Update (full width)
  content.appendChild(buildRow2UW(data));
  content.appendChild(buildRow3Org(data));

  // Row 4: Quotes & Binds | Renewal Retention (halves)
  content.appendChild(buildRow4(data));

  // Row 5: On the Horizon (full width)
  content.appendChild(buildRow5(data));

  inner.appendChild(content);

  // Logo
  const logo = document.createElement('img');
  logo.className = 'page-logo';
  logo.src = '../../assets/ses-logo.dark.png';
  logo.alt = 'SES Logo';
  inner.appendChild(logo);

  page.appendChild(inner);
  return page;
}

// ─── Header ───────────────────────────────────────────────────

function buildHeader(data) {
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-title">${data.contract} <span class="page-title__program">Snapshot</span></div>
  `;
  return header;
}

// ─── Row 1: Capacity | Premium | Portfolio (thirds) ──────────

function buildRow1(data) {
  const row = document.createElement('div');
  row.className = 'stat-row stat-row--thirds';

  // Capacity Utilization (gauge)
  const gaugeCard = document.createElement('div');
  gaugeCard.className = 'chart-container';
  gaugeCard.setAttribute('data-chart-type', 'gauge');
  gaugeCard.setAttribute('data-chart-src', JSON.stringify(data.capacityUtilization));
  gaugeCard.innerHTML = `
    <div class="section-header">Capacity Utilization</div>
    <div class="chart-container__body">
      <div class="chart-canvas-wrap"><canvas id="chart-gauge"></canvas></div>
    </div>
  `;
  row.appendChild(gaugeCard);

  // Premium KPI Stack
  const kpiStack = document.createElement('div');
  kpiStack.className = 'kpi-stack';
  kpiStack.innerHTML = `
    <div class="section-header">Premium</div>
    <div class="kpi-stack__body">
      <div class="kpi-stack__group">
        <div class="kpi-stack__group-label">CTD Premium</div>
        <div class="kpi-stack__group-values">
          ${data.ctdPremium.kpis.map((k) => `
            <span class="kpi-stack__value">${k.value}</span>
            ${k.change ? `<span class="growth-indicator growth-indicator--${k.direction}">${directionArrow(k.direction)}${k.change}</span>` : ''}
          `).join('<span class="kpi-stack__divider">|</span>')}
        </div>
      </div>
      <div class="kpi-stack__group">
        <div class="kpi-stack__group-label">In Force Premium</div>
        <div class="kpi-stack__group-values">
          ${data.inForcePremium.kpis.map((k) => `
            <span class="kpi-stack__value">${k.value}</span>
            ${k.change ? `<span class="growth-indicator growth-indicator--${k.direction}">${directionArrow(k.direction)}${k.change}</span>` : ''}
          `).join('<span class="kpi-stack__divider">|</span>')}
        </div>
      </div>
    </div>
  `;
  row.appendChild(kpiStack);

  // Icon KPIs
  const iconCard = document.createElement('div');
  iconCard.className = 'icon-kpi-card';
  iconCard.innerHTML = `
    <div class="section-header">Portfolio</div>
    <div class="icon-kpi-card__body">
      ${data.iconKpis.map((kpi) => `
        <div class="icon-kpi">
          <svg class="icon-kpi__icon" viewBox="0 0 24 24">${iconSvgPath(kpi.icon)}</svg>
          <div class="icon-kpi__text">
            <span class="icon-kpi__label">${kpi.label}</span>
            <div class="icon-kpi__row">
              <span class="icon-kpi__value">${kpi.value}</span>
              <span class="growth-indicator growth-indicator--${kpi.direction}">
                ${directionArrow(kpi.direction)}${kpi.change}
              </span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  row.appendChild(iconCard);

  return row;
}

// ─── Row 2: Underwriting Update (full width) ─────────────────

function buildRow2UW(data) {
  const row = document.createElement('div');
  row.className = 'stat-row stat-row--full';

  const uwPanel = document.createElement('div');
  uwPanel.className = 'observations-panel';
  uwPanel.innerHTML = `
    <div class="section-header">Underwriting Update</div>
    <div class="observations-panel__body">
      <ul>
        ${data.underwritingUpdate.observations.map((o) => `<li>${o}</li>`).join('')}
      </ul>
    </div>
  `;
  row.appendChild(uwPanel);

  return row;
}

// ─── Row 3: Organizational Update (full width) ───────────────

function buildRow3Org(data) {
  const row = document.createElement('div');
  row.className = 'stat-row stat-row--full';

  const orgPanel = document.createElement('div');
  orgPanel.className = 'observations-panel';
  orgPanel.innerHTML = `
    <div class="section-header">Organizational Update</div>
    <div class="observations-panel__body">
      <ul>
        ${data.organizationalUpdate.observations.map((o) => `<li>${o}</li>`).join('')}
      </ul>
    </div>
  `;
  row.appendChild(orgPanel);

  return row;
}

// ─── Row 4: Quotes & Binds | Renewal Retention (halves) ──────

function buildRow4(data) {
  const row = document.createElement('div');
  row.className = 'stat-row stat-row--halves';

  // Quotes & Binds (combo chart)
  const qbCard = document.createElement('div');
  qbCard.className = 'chart-container';
  qbCard.setAttribute('data-chart-type', 'combo');
  qbCard.setAttribute('data-chart-src', JSON.stringify(data.quotesBinds.data));
  qbCard.setAttribute('data-chart-legend', JSON.stringify(data.quotesBinds.legend));
  qbCard.innerHTML = `
    <div class="section-header">Submissions, Quotes & Binds</div>
    <div class="chart-container__body">
      <div class="chart-canvas-wrap"><canvas id="chart-quotes-binds"></canvas></div>
      <div id="legend-quotes-binds"></div>
    </div>
  `;
  row.appendChild(qbCard);

  // Renewal Retention (combo chart)
  const rrCard = document.createElement('div');
  rrCard.className = 'chart-container';
  rrCard.setAttribute('data-chart-type', 'combo');
  rrCard.setAttribute('data-chart-src', JSON.stringify(data.renewalRetention.data));
  rrCard.setAttribute('data-chart-legend', JSON.stringify(data.renewalRetention.legend));
  rrCard.innerHTML = `
    <div class="section-header">Renewal Retention</div>
    <div class="chart-container__body">
      <div class="chart-canvas-wrap"><canvas id="chart-renewal-retention"></canvas></div>
      <div id="legend-renewal-retention"></div>
    </div>
  `;
  row.appendChild(rrCard);

  return row;
}

// ─── Row 5: On the Horizon | AI Roadmap (halves) ─────────────

function buildRow5(data) {
  const row = document.createElement('div');
  row.className = 'stat-row stat-row--halves';

  const horizonPanel = document.createElement('div');
  horizonPanel.className = 'observations-panel';
  horizonPanel.innerHTML = `
    <div class="section-header">On the Horizon</div>
    <div class="observations-panel__body">
      <ul>
        ${data.onDeck.observations.map((o) => `<li>${o}</li>`).join('')}
      </ul>
    </div>
  `;
  row.appendChild(horizonPanel);

  const aiPanel = document.createElement('div');
  aiPanel.className = 'observations-panel';
  const aiObs = data.aiRoadmap ? data.aiRoadmap.observations : [];
  aiPanel.innerHTML = `
    <div class="section-header">AI Roadmap</div>
    <div class="observations-panel__body">
      <ul>
        ${aiObs.map((o) => `<li>${o}</li>`).join('')}
      </ul>
    </div>
  `;
  row.appendChild(aiPanel);

  return row;
}

// ─── Chart Rendering ──────────────────────────────────────────

export function renderAllCharts(data, root) {
  const el = root || document;

  // Gauge — Capacity Utilization
  const gaugeCanvas = el.querySelector('#chart-gauge');
  if (gaugeCanvas) {
    createGaugeChart(gaugeCanvas, data.capacityUtilization);
  }

  // Combo — Quotes & Binds
  const qbCanvas = el.querySelector('#chart-quotes-binds');
  if (qbCanvas) {
    const qbHas3Bars = data.quotesBinds.data[0].bars.length >= 3;
    createComboChart(qbCanvas, data.quotesBinds.data, {
      barColors: qbHas3Bars ? ['#0A5383', '#8FBAD2', '#E97121'] : ['#0A5383', '#8FBAD2'],
      lineColor: qbHas3Bars ? '#4CAF50' : '#E97121',
      lineValueFormatter: (v) => Math.round(v) + '%',
      showLineValues: true,
    });
    const legendContainer = el.querySelector('#legend-quotes-binds');
    if (legendContainer) {
      legendContainer.innerHTML = '';
      legendContainer.appendChild(createComboLegend(data.quotesBinds.legend));
    }
  }

  // Combo — Renewal Retention
  const rrCanvas = el.querySelector('#chart-renewal-retention');
  if (rrCanvas) {
    createComboChart(rrCanvas, data.renewalRetention.data, {
      lineValueFormatter: (v) => Math.round(v) + '%',
      showLineValues: true,
    });
    const legendContainer = el.querySelector('#legend-renewal-retention');
    if (legendContainer) {
      legendContainer.innerHTML = '';
      legendContainer.appendChild(createComboLegend(data.renewalRetention.legend));
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function directionArrow(direction) {
  if (direction === 'up') return '&#9650; ';
  if (direction === 'down') return '&#9660; ';
  return '';
}

function iconSvgPath(icon) {
  const icons = {
    'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    'building': '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  };
  return icons[icon] || '';
}
