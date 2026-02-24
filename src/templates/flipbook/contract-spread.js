// Contract Flipbook — Two-Page Spread Template

import { createKpiBox, createKpiRow } from '../../components/kpi-box.js';
import { createHBarChart } from '../../components/h-bar-chart.js';
import { createVBarChart } from '../../components/v-bar-chart.js';
import { createStackedBarChart, createChartLegend } from '../../components/stacked-bar-chart.js';
import { createLineChart } from '../../components/line-chart.js';
import { createUSMap } from '../../components/us-map.js';

export async function renderContractSpread(container, dataUrl) {
  const res = await fetch(dataUrl);
  const data = await res.json();

  const flipbook = document.createElement('div');
  flipbook.className = 'flipbook';

  flipbook.appendChild(buildPage1(data));
  flipbook.appendChild(buildPage2(data));

  // Toolbar
  const toolbar = buildToolbar(() => replayAllAnimations(data));
  container.appendChild(toolbar);

  container.appendChild(flipbook);

  // Trigger chart rendering after DOM is ready
  requestAnimationFrame(() => {
    renderPage1Charts(data);
    renderPage2Charts(data);
  });
}

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
  // Re-render canvas charts only (they clear and restart)
  renderPage1CanvasCharts(data);
  renderPage2Charts(data);

  // Re-trigger map fade-in (don't recreate — just toggle opacity)
  const mapContainer = document.getElementById('chart-us-map');
  if (mapContainer) {
    const svg = mapContainer.querySelector('svg');
    if (svg) {
      svg.style.transition = 'none';
      svg.style.opacity = '0';
      requestAnimationFrame(() => {
        svg.style.transition = 'opacity 1.2s ease-out';
        svg.style.opacity = '1';
      });
    }
  }
}

// ─── PAGE 1: Portfolio Composition ──────────────────────────────

function buildPage1(data) {
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="page__inner">
      <div class="page-header">
        <div class="page-title">${data.title}</div>
        <span class="contract-badge">${data.contract}</span>
      </div>
      <div class="page-content">
        <div id="page1-kpis"></div>
        <div class="page-columns" style="flex: 0 0 auto;">
          <div class="page-column">
            <div class="chart-container">
              <div class="section-header">Top States by TIV</div>
              <div class="chart-container__body">
                <canvas id="chart-states-bar"></canvas>
              </div>
            </div>
          </div>
          <div class="page-column">
            <div id="page1-observations" style="flex:1;display:flex;flex-direction:column;"></div>
          </div>
        </div>
        <div class="chart-container" style="flex: 1;">
          <div class="section-header">TIV Concentration</div>
          <div class="chart-container__body">
            <div id="chart-us-map" style="width:100%;flex:1;min-height:0;display:flex;flex-direction:column;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // KPI Row
  const kpiContainer = page.querySelector('#page1-kpis');
  const p = data.portfolio;
  kpiContainer.appendChild(createKpiRow([
    { value: p.totalAnnualPremium, label: 'Total Annual Premium' },
    { value: p.tiv, label: 'TIV' },
    { value: p.avgRate, label: 'Avg. Rate' },
    { value: p.assets, label: 'Assets' },
    { value: p.accounts, label: 'Accounts' },
  ]));

  // Multi-Family observations
  if (data.multiFamily) {
    const obsContainer = page.querySelector('#page1-observations');
    const panel = document.createElement('div');
    panel.className = 'observations-panel';
    panel.innerHTML = `
      <div class="section-header">Multi-Family Program</div>
      <div class="observations-panel__body">
        <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
          ${createMiniKpi('Premium', data.multiFamily.totalAnnualPremium)}
          ${createMiniKpi('TIV', data.multiFamily.tiv)}
          ${createMiniKpi('Rate', data.multiFamily.avgRate)}
          ${createMiniKpi('Assets', data.multiFamily.assets)}
        </div>
        <ul>
          ${data.multiFamily.observations.map((o) => `<li>${o}</li>`).join('')}
        </ul>
      </div>
    `;
    obsContainer.appendChild(panel);
  }

  return page;
}

function createMiniKpi(label, value) {
  return `<span style="font-size:10px; font-weight:600; color:#0A5383;"><span style="font-weight:700;">${value}</span> ${label}</span>`;
}

// ─── PAGE 2: Performance Data ───────────────────────────────────

function buildPage2(data) {
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="page__inner">
      <div class="page-content">
        <div class="section-header">Deductibles & Average Rates</div>
        <div class="page-columns">
          <div class="page-column">
            <div class="chart-container">
              <div class="section-header">Deductible Distribution</div>
              <div class="chart-container__body">
                <div id="deductible-table-container"></div>
                <canvas id="chart-stacked-bar" style="margin-top: 4px;"></canvas>
                <div id="stacked-legend"></div>
              </div>
            </div>
          </div>
          <div class="page-column">
            <div class="chart-container">
              <div class="section-header">Average Rates</div>
              <div class="chart-container__body">
                <div id="rate-table-container"></div>
                <canvas id="chart-line" style="margin-top: 4px;"></canvas>
              </div>
            </div>
          </div>
        </div>
        <div class="section-header">Loss Experience</div>
        <div id="page2-loss-kpis"></div>
        <div class="page-columns">
          <div class="page-column">
            <div class="chart-container">
              <div class="section-header">Annual Loss Ratio</div>
              <div class="chart-container__body">
                <canvas id="chart-loss-ratio"></canvas>
              </div>
            </div>
          </div>
          <div class="page-column">
            <div class="chart-container">
              <div class="section-header">Top Loss Types (Incurred, $M)</div>
              <div class="chart-container__body">
                <canvas id="chart-loss-types"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
      <img class="page-logo" src="../../assets/ses-logo.dark.png" alt="SES Logo">
    </div>
  `;

  // Loss KPIs
  const lossKpiContainer = page.querySelector('#page2-loss-kpis');
  const l = data.lossExperience;
  lossKpiContainer.appendChild(createKpiRow([
    { value: l.earnedPremium5yr, label: 'Earned Premium (5yr)' },
    { value: l.incurredLosses5yr, label: 'Incurred Losses (5yr)' },
    { value: l.lossRatio5yr, label: 'Loss Ratio (5yr)' },
  ]));

  // Deductible table
  const dedTableContainer = page.querySelector('#deductible-table-container');
  dedTableContainer.appendChild(buildDeductibleTable(data.deductibles));

  // Rate table
  const rateTableContainer = page.querySelector('#rate-table-container');
  rateTableContainer.appendChild(buildRateTable(data.averageRates));

  // Stacked bar legend
  const legendContainer = page.querySelector('#stacked-legend');
  const tierLabels = data.deductibles.tiers.map((t) => t.label);
  legendContainer.appendChild(createChartLegend(tierLabels));

  return page;
}

// ─── Data Tables ────────────────────────────────────────────────

function buildDeductibleTable(ded) {
  const table = document.createElement('table');
  table.className = 'data-table';

  // Header
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Tier</th>
    ${ded.quarters.map((q) => `<th>${q}</th>`).join('')}
  </tr>`;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (const tier of ded.tiers) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${tier.label}</td>${tier.values.map((v) => `<td>${v}%</td>`).join('')}`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  return table;
}

function buildRateTable(rates) {
  const table = document.createElement('table');
  table.className = 'data-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Quarter</th>
    <th>Avg Rate</th>
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rates.tableQuarters.forEach((q, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${q}</td><td>${rates.tableRates[i].toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

// ─── Chart Rendering ────────────────────────────────────────────

function renderPage1CanvasCharts(data) {
  // Top States bar chart (canvas — safe to re-render)
  const statesCanvas = document.getElementById('chart-states-bar');
  if (statesCanvas) {
    const statesData = data.portfolio.topStatesByTiv.slice(0, 8).map((s) => ({
      label: s.state,
      value: s.tivMillions,
    }));
    createHBarChart(statesCanvas, statesData, {
      valueFormatter: (v) => `$${v.toFixed(1)}M`,
      labelWidth: 40,
      valueWidth: 60,
      barHeight: 22,
      barGap: 12,
    });
  }
}

function renderPage1Charts(data) {
  renderPage1CanvasCharts(data);

  // US SVG map — only created once on initial load
  const mapContainer = document.getElementById('chart-us-map');
  if (mapContainer) {
    const topStates = data.portfolio.topStatesByTiv.slice(0, 3).map((s) => s.state);
    createUSMap(mapContainer, data.portfolio.statesTivMap, {
      highlightStates: topStates,
    });
  }
}

function renderPage2Charts(data) {
  // Stacked bar chart — deductibles
  const stackedCanvas = document.getElementById('chart-stacked-bar');
  if (stackedCanvas) {
    const stackedData = data.deductibles.quarters.map((q, qi) => ({
      label: q.replace('20', "'"),
      segments: data.deductibles.tiers.map((t) => t.values[qi]),
    }));
    createStackedBarChart(stackedCanvas, stackedData, {
      tierColors: ['#C5DCE8', '#8FBAD2', '#5A98B8', '#2E7BA0', '#0A5383'],
    });
  }

  // Line chart — average rates
  const lineCanvas = document.getElementById('chart-line');
  if (lineCanvas) {
    const lineData = data.averageRates.chartQuarters.map((q, i) => ({
      label: q,
      value: data.averageRates.chartRates[i],
    }));
    createLineChart(lineCanvas, lineData, {
      valueFormatter: (v) => v.toFixed(2),
    });
  }

  // Vertical bar chart — annual loss ratio
  const lossRatioCanvas = document.getElementById('chart-loss-ratio');
  if (lossRatioCanvas) {
    const lossData = data.lossExperience.annualRatios.map((r) => ({
      label: r.year,
      value: r.ratio,
    }));
    createVBarChart(lossRatioCanvas, lossData, {
      valueFormatter: (v) => v + '%',
    });
  }

  // Horizontal bar chart — top loss types
  const lossTypesCanvas = document.getElementById('chart-loss-types');
  if (lossTypesCanvas) {
    const lossTypesData = data.lossExperience.topLossTypes.map((lt) => ({
      label: lt.type,
      value: lt.amountMillions,
      color: '#E97121',
    }));
    createHBarChart(lossTypesCanvas, lossTypesData, {
      barColor: '#E97121',
      valueFormatter: (v) => `$${v.toFixed(2)}M`,
      labelWidth: 90,
      valueWidth: 55,
      barHeight: 18,
      barGap: 10,
    });
  }
}
