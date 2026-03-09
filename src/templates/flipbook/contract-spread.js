// Contract Flipbook — Two-Page Spread Template

import { createKpiBox, createKpiRow } from '../../components/kpi-box.js';
import { createHBarChart } from '../../components/h-bar-chart.js';
import { createVBarChart } from '../../components/v-bar-chart.js';
import { createStackedBarChart, createChartLegend } from '../../components/stacked-bar-chart.js';
import { createLineChart } from '../../components/line-chart.js';
import { createComboChart } from '../../components/combo-chart.js';
import { createPieChart } from '../../components/pie-chart.js';
import { createUSMap } from '../../components/us-map.js';
import { initCardEditor } from '../../components/card-editor.js';

export async function renderContractSpread(container, dataUrl) {
  const res = await fetch(`${dataUrl}?t=${Date.now()}`, { cache: 'no-store' });
  const data = await res.json();

  const flipbook = document.createElement('div');
  flipbook.className = 'flipbook';

  flipbook.appendChild(buildPage1(data));
  flipbook.appendChild(buildPage2(data));

  // Toolbar
  const toolbar = buildToolbar(() => replayAllAnimations(data));
  container.appendChild(toolbar);

  container.appendChild(flipbook);

  // Auto-scale flipbook to fit viewport
  function autoScale() {
    const contentW = 816 * 2 + 48; // two pages + padding
    const contentH = 1056 + 48;
    const scale = Math.min(window.innerWidth / contentW, window.innerHeight / contentH, 1);
    flipbook.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  autoScale();
  window.addEventListener('resize', autoScale);

  // Trigger chart rendering after DOM is ready
  requestAnimationFrame(() => {
    renderPage1Charts(data);
    renderPage2Charts(data);
  });

  initCardEditor();
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
  renderPage1CanvasCharts(data, null);
  renderPage2Charts(data, null);

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

export function buildPage1(data) {
  // Pre-compute chart data for embedding as attributes
  // Replace single quotes with &#39; so they don't break single-quoted HTML attributes
  const esc = (s) => s.replace(/'/g, '&#39;');
  const mapSrc = esc(JSON.stringify(data.portfolio.statesTivMap));
  const mapHighlight = esc(JSON.stringify(data.growthTargets || data.portfolio.topStatesByTiv.slice(0, 3).map((s) => s.state)));
  const statesBarData = esc(JSON.stringify(data.portfolio.topStatesByTiv.slice(0, 8).map((s) => ({label: s.state, value: s.tivMillions}))));

  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="page__inner">
      <div class="page-header">
        <div class="page-title">${data.contract} <span class="page-title__program">${[data.code, data.product, 'Composition'].filter(Boolean).join(' ')}</span></div>
      </div>
      <div class="page-content">
        <div id="page1-kpis"></div>
        <div class="page-columns" style="flex: 0 0 auto;">
          <div class="page-column">
            <div class="chart-container" data-chart-type="h-bar" data-chart-src='${statesBarData}' data-chart-prefix="$" data-chart-suffix="M" data-chart-decimals="1" data-chart-options='{"labelWidth":40,"valueWidth":60,"barHeight":22,"barGap":12}'>
              <div class="section-header">Top States by TIV</div>
              <div class="chart-container__body">
                <canvas id="chart-states-bar"></canvas>
              </div>
            </div>
          </div>
          <div class="page-column">
            <div class="observations-panel" style="flex:1;display:flex;flex-direction:column;">
              <div class="section-header">Observations</div>
              <div class="observations-panel__body" id="page1-observations">
              </div>
            </div>
          </div>
        </div>
        <div class="chart-container" data-chart-type="us-map" data-chart-src='${mapSrc}' data-chart-highlight='${mapHighlight}' style="flex: 1;">
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
  ], { label: 'Portfolio Summary' }));

  // Observations
  const obsBody = page.querySelector('#page1-observations');
  if (p.observations && p.observations.length > 0) {
    obsBody.innerHTML = `<ul>${p.observations.map((o) => `<li>${o}</li>`).join('')}</ul>`;
  }

  return page;
}

// ─── MF PAGE 1 (left): KPIs + Map ───────────────────────────────

export function buildMFPage1(data) {
  const mf = data.multiFamily;
  const esc = (s) => s.replace(/'/g, '&#39;');
  const mfMapSrc = esc(JSON.stringify(mf.statesTivMap || {}));
  const mfMapHighlight = esc(JSON.stringify(data.growthTargets || (mf.topStatesByTiv || []).slice(0, 3).map((s) => s.state)));

  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="page__inner">
      <div class="page-header">
        <div class="page-title">${data.contract} <span class="page-title__program">${[mf.code, mf.product, 'Composition'].filter(Boolean).join(' ')}</span></div>
      </div>
      <div class="page-content">
        <div id="mf-kpis"></div>
        <div class="chart-container" data-chart-type="us-map" data-chart-src='${mfMapSrc}' data-chart-highlight='${mfMapHighlight}' style="flex: 1;">
          <div class="section-header">TIV Concentration</div>
          <div class="chart-container__body">
            <div id="mf-chart-us-map" style="width:100%;flex:1;min-height:0;display:flex;flex-direction:column;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // KPI Row
  const kpiContainer = page.querySelector('#mf-kpis');
  kpiContainer.appendChild(createKpiRow([
    { value: mf.totalAnnualPremium, label: 'Premium' },
    { value: mf.tiv, label: 'TIV' },
    { value: mf.avgRate, label: 'Avg. Rate' },
    { value: mf.assets, label: 'Assets' },
    { value: mf.accounts, label: 'Accounts' },
  ], { label: 'Multifamily Summary' }));

  return page;
}

// ─── MF PAGE 2 (right): Top States + Observations ──────────────

export function buildMFPage2(data) {
  const mf = data.multiFamily;
  const esc = (s) => s.replace(/'/g, '&#39;');
  const mfBarData = esc(JSON.stringify((mf.topStatesByTiv || []).slice(0, 8).map((s) => ({label: s.state, value: s.tivMillions}))));

  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="page__inner">
      <div class="page-header">
        <div class="page-title">${data.contract} <span class="page-title__program">${[mf.code, mf.product, 'Composition'].filter(Boolean).join(' ')}</span></div>
      </div>
      <div class="page-content">
        <div class="chart-container" data-chart-type="h-bar" data-chart-src='${mfBarData}' data-chart-prefix="$" data-chart-suffix="M" data-chart-decimals="1" data-chart-options='{"labelWidth":40,"valueWidth":60}' style="flex: 1; display: flex; flex-direction: column;">
          <div class="section-header">Top States by TIV</div>
          <div class="chart-container__body" style="flex: 1;">
            <canvas id="mf-chart-states-bar"></canvas>
          </div>
        </div>
        <div class="observations-panel" style="flex:1;display:flex;flex-direction:column;">
          <div class="section-header">Observations</div>
          <div class="observations-panel__body" id="mf-observations" style="font-size: 22px; line-height: 2; padding: 24px 28px; display: flex; flex-direction: column; justify-content: center; flex: 1;">
          </div>
        </div>
      </div>
    </div>
  `;

  // Observations
  const obsBody = page.querySelector('#mf-observations');
  if (mf.observations && mf.observations.length > 0) {
    obsBody.innerHTML = `<ul>${mf.observations.map((o) => `<li>${o}</li>`).join('')}</ul>`;
  }

  return page;
}

export function renderMFPage1Charts(data, root) {
  const el = root || document;
  const mf = data.multiFamily;

  // Top States bar chart
  const statesCanvas = el.querySelector('#mf-chart-states-bar');
  if (statesCanvas && mf.topStatesByTiv) {
    const statesData = mf.topStatesByTiv.slice(0, 8).map((s) => ({
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

  // US SVG map
  const mapContainer = el.querySelector('#mf-chart-us-map');
  if (mapContainer && mf.statesTivMap) {
    const topStates = data.growthTargets || (mf.topStatesByTiv || []).slice(0, 3).map((s) => s.state);
    createUSMap(mapContainer, mf.statesTivMap, {
      highlightStates: topStates,
    });
  }
}

// ─── PAGE 2: Performance Data ───────────────────────────────────

export function buildPage2(data, updatesData = null) {
  // Pre-compute chart data for embedding as attributes
  const lossRatioData = data.lossExperience.annualRatios.map((r) => ({
    label: r.year,
    value: r.ratio,
  }));

  const esc = (s) => s.replace(/'/g, '&#39;');

  const stackedData = esc(JSON.stringify(data.deductibles.quarters.map((q, qi) => ({
    label: q.replace('20', "'"),
    segments: data.deductibles.tiers.map((t) => t.values[qi]),
  }))));
  const tierLabels = esc(JSON.stringify(data.deductibles.tiers.map((t) => t.label)));

  const lineData = esc(JSON.stringify(data.averageRates.chartQuarters.map((q, i) => ({
    label: q, value: data.averageRates.chartRates[i],
  }))));

  // Sort loss types by amount in descending order
  const sortedLossTypes = [...data.lossExperience.topLossTypes].sort((a, b) => b.amountMillions - a.amountMillions);
  const lossTypesData = esc(JSON.stringify(sortedLossTypes.map((lt) => ({
    label: lt.type, value: lt.amountMillions,
  }))));

  const riskScoreData = esc(JSON.stringify(data.propertyRiskScore ? data.propertyRiskScore.data : []));

  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="page__inner">
      <div class="page-header">
        <div class="page-title">${data.contract} <span class="page-title__program">${[data.code, data.product, 'Performance'].filter(Boolean).join(' ')}</span></div>
      </div>
      <div class="page-content">
        <div class="page-columns">
          <div class="page-column">
            <div class="chart-container" data-chart-type="stacked-bar" data-chart-src='${stackedData}' data-chart-tiers='${tierLabels}'>
              <div class="section-header">Deductible Distribution</div>
              <div class="chart-container__body">
                <div id="deductible-table-container"></div>
                <canvas id="chart-stacked-bar" style="margin-top: 4px;"></canvas>
                <div id="stacked-legend"></div>
              </div>
            </div>
          </div>
          <div class="page-column">
            <div class="chart-container" data-chart-type="line" data-chart-src='${lineData}' data-chart-decimals="2">
              <div class="section-header">Average Rates</div>
              <div class="chart-container__body">
                <div id="rate-table-container"></div>
                <canvas id="chart-line" style="margin-top: 4px;"></canvas>
              </div>
            </div>
          </div>
        </div>
        <div id="page2-loss-kpis"></div>
        ${updatesData && updatesData.riskScores ? `
        <div class="page-columns" style="flex: 0 0 auto;">
          <div class="page-column" style="flex: 1; display: flex; flex-direction: column;">
            <div class="chart-container" data-chart-type="v-bar" data-chart-suffix="%" data-chart-src='${JSON.stringify(lossRatioData)}' style="flex: 1; display: flex; flex-direction: column;">
              <div class="section-header">Annual Loss Ratio</div>
              <div class="chart-container__body" style="flex: 1;">
                <canvas id="chart-loss-ratio"></canvas>
              </div>
            </div>
          </div>
          <div class="page-column" style="flex: 1; display: flex; flex-direction: column;">
            <div class="chart-container" data-chart-type="h-bar" data-chart-src='${lossTypesData}' data-chart-prefix="$" data-chart-suffix="M" data-chart-decimals="2" data-chart-options='{"barColor":"#E97121","labelWidth":90,"valueWidth":55,"barHeight":18,"barGap":10}' style="flex: 1; display: flex; flex-direction: column;">
              <div class="section-header">Top Loss Types (Incurred, $M)</div>
              <div class="chart-container__body" style="flex: 1;">
                <canvas id="chart-loss-types"></canvas>
              </div>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: var(--gap-sm); flex: 1;">
          <div class="chart-container" data-risk="property" style="flex: 1; display: flex; flex-direction: column;">
            <div class="section-header" style="font-size: 9px; white-space: nowrap;">${updatesData.riskScores.property.title}</div>
            <div class="chart-container__body" style="flex: 1;">
              <canvas class="risk-chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-container" data-risk="windHail" style="flex: 1; display: flex; flex-direction: column;">
            <div class="section-header" style="font-size: 9px; white-space: nowrap;">${updatesData.riskScores.windHail.title}</div>
            <div class="chart-container__body" style="flex: 1;">
              <canvas class="risk-chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-container" data-risk="crime" style="flex: 1; display: flex; flex-direction: column;">
            <div class="section-header" style="font-size: 9px; white-space: nowrap;">${updatesData.riskScores.crime.title}</div>
            <div class="chart-container__body" style="flex: 1;">
              <canvas class="risk-chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-container" data-risk="wildfire" style="flex: 1; display: flex; flex-direction: column;">
            <div class="section-header" style="font-size: 9px; white-space: nowrap;">${updatesData.riskScores.wildfire.title}</div>
            <div class="chart-container__body" style="flex: 1;">
              <canvas class="risk-chart-canvas"></canvas>
            </div>
          </div>
        </div>
        ` : data.carrierClaimCount ? `
        <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: var(--gap-sm); flex: 1;">
          <div class="chart-container" data-chart-type="v-bar" data-chart-suffix="%" data-chart-src='${JSON.stringify(lossRatioData)}' style="display: flex; flex-direction: column;">
            <div class="section-header">Annual Loss Ratio</div>
            <div class="chart-container__body" style="flex: 1;">
              <canvas id="chart-loss-ratio"></canvas>
            </div>
          </div>
          <div class="chart-container" data-chart-type="h-bar" data-chart-src='${lossTypesData}' data-chart-prefix="$" data-chart-suffix="M" data-chart-decimals="2" data-chart-options='{"barColor":"#E97121","labelWidth":90,"valueWidth":55,"barHeight":18,"barGap":10}' style="display: flex; flex-direction: column;">
            <div class="section-header">Top Loss Types (Incurred, $M)</div>
            <div class="chart-container__body" style="flex: 1;">
              <canvas id="chart-loss-types"></canvas>
            </div>
          </div>
          <div class="chart-container" data-chart-type="combo" data-chart-src='${esc(JSON.stringify(data.carrierClaimCount.data))}' style="display: flex; flex-direction: column;">
            <div class="section-header">Carrier Claim Count</div>
            <div class="chart-container__body" style="flex: 1;">
              <canvas id="chart-claim-count"></canvas>
            </div>
          </div>
          <div class="chart-container" data-chart-type="h-bar" data-chart-src='${riskScoreData}' data-chart-suffix="%" data-chart-options='{"labelWidth":30,"valueWidth":45}' style="display: flex; flex-direction: column;">
            <div class="section-header">Property Risk Score</div>
            <div class="chart-container__body" style="flex: 1;">
              <canvas id="chart-risk-score"></canvas>
            </div>
          </div>
        </div>
        ` : `
        <div class="page-columns" style="flex: 1;">
          <div class="page-column" style="flex: 1; display: flex; flex-direction: column;">
            <div class="chart-container" data-chart-type="v-bar" data-chart-suffix="%" data-chart-src='${JSON.stringify(lossRatioData)}' style="flex: 1; display: flex; flex-direction: column;">
              <div class="section-header">Annual Loss Ratio</div>
              <div class="chart-container__body" style="flex: 1;">
                <canvas id="chart-loss-ratio"></canvas>
              </div>
            </div>
          </div>
          <div class="page-column" style="flex: 1; display: flex; flex-direction: column; gap: var(--gap-sm);">
            <div class="chart-container" data-chart-type="h-bar" data-chart-src='${lossTypesData}' data-chart-prefix="$" data-chart-suffix="M" data-chart-decimals="2" data-chart-options='{"barColor":"#E97121","labelWidth":90,"valueWidth":55,"barHeight":18,"barGap":10}' style="flex: 1; display: flex; flex-direction: column;">
              <div class="section-header">Top Loss Types (Incurred, $M)</div>
              <div class="chart-container__body" style="flex: 1;">
                <canvas id="chart-loss-types"></canvas>
              </div>
            </div>
            <div class="chart-container" data-chart-type="h-bar" data-chart-src='${riskScoreData}' data-chart-suffix="%" data-chart-options='{"labelWidth":30,"valueWidth":45}' style="flex: 1; display: flex; flex-direction: column;">
              <div class="section-header">Property Risk Score</div>
              <div class="chart-container__body" style="flex: 1;">
                <canvas id="chart-risk-score"></canvas>
              </div>
            </div>
          </div>
        </div>`}
      </div>
    </div>
  `;

  // Loss KPIs
  const lossKpiContainer = page.querySelector('#page2-loss-kpis');
  const l = data.lossExperience;
  lossKpiContainer.appendChild(createKpiRow([
    { value: l.earnedPremium5yr, label: 'Earned Premium (5yr)' },
    { value: l.incurredLosses5yr, label: 'Incurred Losses (5yr)' },
    { value: l.lossRatio5yr, label: 'Loss Ratio (5yr)' },
  ], { label: 'Loss Experience' }));

  // Deductible table
  const dedTableContainer = page.querySelector('#deductible-table-container');
  dedTableContainer.appendChild(buildDeductibleTable(data.deductibles));

  // Rate table
  const rateTableContainer = page.querySelector('#rate-table-container');
  rateTableContainer.appendChild(buildRateTable(data.averageRates));

  // Stacked bar legend
  const legendContainer = page.querySelector('#stacked-legend');
  const legendTierLabels = data.deductibles.tiers.map((t) => t.label);
  legendContainer.appendChild(createChartLegend(legendTierLabels));

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

function renderPage1CanvasCharts(data, root) {
  const el = root || document;
  // Top States bar chart (canvas — safe to re-render)
  const statesCanvas = el.querySelector('#chart-states-bar');
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

export function renderPage1Charts(data, root) {
  const el = root || document;
  renderPage1CanvasCharts(data, root);

  // US SVG map — only created once on initial load
  const mapContainer = el.querySelector('#chart-us-map');
  if (mapContainer) {
    const topStates = data.growthTargets || data.portfolio.topStatesByTiv.slice(0, 3).map((s) => s.state);
    createUSMap(mapContainer, data.portfolio.statesTivMap, {
      highlightStates: topStates,
    });
  }
}

export function renderPage2Charts(data, root, updatesData = null) {
  const el = root || document;
  // Stacked bar chart — deductibles
  const stackedCanvas = el.querySelector('#chart-stacked-bar');
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
  const lineCanvas = el.querySelector('#chart-line');
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
  const lossRatioCanvas = el.querySelector('#chart-loss-ratio');
  if (lossRatioCanvas) {
    const lossData = data.lossExperience.annualRatios.map((r) => ({
      label: r.year,
      value: r.ratio,
    }));
    createVBarChart(lossRatioCanvas, lossData, {
      valueFormatter: (v) => v + '%',
    });
  }

  // Horizontal bar chart — top loss types (sorted descending by amount)
  const lossTypesCanvas = el.querySelector('#chart-loss-types');
  if (lossTypesCanvas) {
    const lossTypesData = [...data.lossExperience.topLossTypes]
      .sort((a, b) => b.amountMillions - a.amountMillions)
      .map((lt) => ({
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

  // Combo line — Carrier Claim Count (1258 LOC only)
  if (data.carrierClaimCount) {
    const ccCanvas = el.querySelector('#chart-claim-count');
    if (ccCanvas) {
      createComboChart(ccCanvas, data.carrierClaimCount.data, {
        lineValueFormatter: (v) => Math.round(v).toString(),
        showLineValues: true,
        showYAxis: false,
      });
    }
  }

  // H-bar — Property Risk Score (portfolio layout only)
  if (data.propertyRiskScore) {
    const riskCanvas = el.querySelector('#chart-risk-score');
    if (riskCanvas) {
      createHBarChart(riskCanvas, data.propertyRiskScore.data, {
        valueFormatter: (v) => v + '%',
        labelWidth: 30,
        valueWidth: 45,
      });
    }
  }

  // Risk score pie charts (individual asset layout)
  if (updatesData && updatesData.riskScores) {
    ['property', 'windHail', 'crime', 'wildfire'].forEach(key => {
      const container = el.querySelector(`[data-risk="${key}"]`);
      if (!container) return;
      const canvas = container.querySelector('.risk-chart-canvas');
      if (!canvas) return;
      const rs = updatesData.riskScores[key];
      const chartData = rs.categories.map((cat, ci) => ({
        label: cat,
        value: rs.values[ci],
      }));
      // Reverse colors so best category (last) gets darkest navy
      const pieColors = ['#C5DCE8', '#8FBAD2', '#5A98B8', '#2E7BA0', '#0A5383'];
      createPieChart(canvas, chartData, { colors: pieColors });
    });
  }
}
