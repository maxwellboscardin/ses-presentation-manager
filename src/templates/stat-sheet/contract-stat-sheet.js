// Contract Stat Sheet — Single-Page Dashboard Template

import { createLineChart } from '../../components/line-chart.js';
import { createHBarChart } from '../../components/h-bar-chart.js';
import { createVBarChart } from '../../components/v-bar-chart.js';
import { createGaugeChart } from '../../components/gauge-chart.js';
import { createComboChart, createComboLegend } from '../../components/combo-chart.js';

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

  // Row 1: Program Update (60%) | Capacity Utilization (40%)
  content.appendChild(buildRow1(data));

  // Row 2: Avg Rates | CTD/IF Premium KPIs | Icon KPIs (thirds)
  content.appendChild(buildRow2(data));

  // Row 3: UW Update (60%) | Property Risk Score (40%)
  content.appendChild(buildRow3(data));

  // Row 4: Quotes & Binds | Renewal Retention | Loss History (thirds)
  content.appendChild(buildRow4(data));

  // Row 5: Org Update | On Deck (halves)
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
    <div class="page-title">${data.title} &mdash; ${data.contract}</div>
  `;
  return header;
}

// ─── Row 1: Program Update + Gauge ───────────────────────────

function buildRow1(data) {
  const row = document.createElement('div');
  row.className = 'stat-row stat-row--60-40';

  // Program Update (observations panel)
  const obsPanel = document.createElement('div');
  obsPanel.className = 'observations-panel';
  obsPanel.innerHTML = `
    <div class="section-header">Program Update</div>
    <div class="observations-panel__body">
      <ul>
        ${data.programUpdate.observations.map((o) => `<li>${o}</li>`).join('')}
      </ul>
    </div>
  `;
  row.appendChild(obsPanel);

  // Capacity Utilization (gauge)
  const gaugeCard = document.createElement('div');
  gaugeCard.className = 'chart-container';
  gaugeCard.innerHTML = `
    <div class="section-header">Capacity Utilization</div>
    <div class="chart-container__body">
      <div class="chart-canvas-wrap"><canvas id="chart-gauge"></canvas></div>
    </div>
  `;
  row.appendChild(gaugeCard);

  return row;
}

// ─── Row 2: Avg Rates + KPIs + Icon KPIs ────────────────────

function buildRow2(data) {
  const row = document.createElement('div');
  row.className = 'stat-row stat-row--thirds';

  // Average Rates (line chart + ITV badge)
  const ratesCard = document.createElement('div');
  ratesCard.className = 'chart-container';
  ratesCard.innerHTML = `
    <div class="section-header">Average Rates</div>
    <div class="chart-container__body">
      <div class="chart-canvas-wrap"><canvas id="chart-avg-rates"></canvas></div>
      <div class="itv-badge" style="align-self: center;">
        ${data.itvBadge.value}
        <span class="growth-indicator growth-indicator--${data.itvBadge.direction}">
          ${directionArrow(data.itvBadge.direction)}${data.itvBadge.change}
        </span>
        <span class="itv-badge__label">${data.itvBadge.label}</span>
      </div>
    </div>
  `;
  row.appendChild(ratesCard);

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

  // Icon KPIs — stacked layout: icon | label above, value + growth below
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

// ─── Row 3: UW Update + Property Risk Score ──────────────────

function buildRow3(data) {
  const row = document.createElement('div');
  row.className = 'stat-row stat-row--60-40';

  // UW Update
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

  // Property Risk Score (h-bar)
  const riskCard = document.createElement('div');
  riskCard.className = 'chart-container';
  riskCard.innerHTML = `
    <div class="section-header">Property Risk Score</div>
    <div class="chart-container__body">
      <div class="chart-canvas-wrap"><canvas id="chart-risk-score"></canvas></div>
    </div>
  `;
  row.appendChild(riskCard);

  return row;
}

// ─── Row 4: Quotes & Binds + Renewal Retention + Loss History ─

function buildRow4(data) {
  const row = document.createElement('div');
  row.className = 'stat-row stat-row--thirds';

  // Quotes & Binds (combo chart)
  const qbCard = document.createElement('div');
  qbCard.className = 'chart-container';
  qbCard.innerHTML = `
    <div class="section-header">Quotes & Binds</div>
    <div class="chart-container__body">
      <div class="chart-canvas-wrap"><canvas id="chart-quotes-binds"></canvas></div>
      <div id="legend-quotes-binds"></div>
    </div>
  `;
  row.appendChild(qbCard);

  // Renewal Retention (combo chart)
  const rrCard = document.createElement('div');
  rrCard.className = 'chart-container';
  rrCard.innerHTML = `
    <div class="section-header">Renewal Retention</div>
    <div class="chart-container__body">
      <div class="chart-canvas-wrap"><canvas id="chart-renewal-retention"></canvas></div>
      <div id="legend-renewal-retention"></div>
    </div>
  `;
  row.appendChild(rrCard);

  // Loss History (v-bar chart)
  const lossCard = document.createElement('div');
  lossCard.className = 'chart-container';
  lossCard.innerHTML = `
    <div class="section-header">Loss History</div>
    <div class="chart-container__body">
      <div class="chart-canvas-wrap"><canvas id="chart-loss-history"></canvas></div>
    </div>
  `;
  row.appendChild(lossCard);

  return row;
}

// ─── Row 5: Org Update + On Deck ─────────────────────────────

function buildRow5(data) {
  const row = document.createElement('div');
  row.className = 'stat-row stat-row--halves';

  // Org Update
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

  // On Deck
  const deckPanel = document.createElement('div');
  deckPanel.className = 'observations-panel';
  deckPanel.innerHTML = `
    <div class="section-header">On Deck</div>
    <div class="observations-panel__body">
      <ul>
        ${data.onDeck.observations.map((o) => `<li>${o}</li>`).join('')}
      </ul>
    </div>
  `;
  row.appendChild(deckPanel);

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

  // Line chart — Average Rates
  const ratesCanvas = el.querySelector('#chart-avg-rates');
  if (ratesCanvas) {
    createLineChart(ratesCanvas, data.averageRates.chartData, {
      valueFormatter: (v) => v.toFixed(2),
    });
  }

  // H-bar — Property Risk Score
  const riskCanvas = el.querySelector('#chart-risk-score');
  if (riskCanvas) {
    createHBarChart(riskCanvas, data.propertyRiskScore.data, {
      valueFormatter: (v) => v + '%',
      labelWidth: 30,
      valueWidth: 45,
    });
  }

  // Combo — Quotes & Binds
  const qbCanvas = el.querySelector('#chart-quotes-binds');
  if (qbCanvas) {
    createComboChart(qbCanvas, data.quotesBinds.data, {
      lineValueFormatter: (v) => v.toFixed(1) + '%',
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
      lineValueFormatter: (v) => v.toFixed(1) + '%',
      showLineValues: true,
    });
    const legendContainer = el.querySelector('#legend-renewal-retention');
    if (legendContainer) {
      legendContainer.innerHTML = '';
      legendContainer.appendChild(createComboLegend(data.renewalRetention.legend));
    }
  }

  // V-bar — Loss History
  const lossCanvas = el.querySelector('#chart-loss-history');
  if (lossCanvas) {
    createVBarChart(lossCanvas, data.lossHistory.data, {
      valueFormatter: (v) => v + '%',
    });
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
