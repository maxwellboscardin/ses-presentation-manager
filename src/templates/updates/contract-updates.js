// Contract Updates — Risk Scores + S/Q/B Trends (single page)

import { createHBarChart } from '../../components/h-bar-chart.js';
import { createComboChart, createComboLegend } from '../../components/combo-chart.js';

// ─── Combined Updates Page: Risk Scores (top) + S/Q/B (bottom) ─

export function buildUpdatesPage(data) {
  const page = document.createElement('div');
  page.className = 'page';

  const periodNote = data.sqbTrends && data.sqbTrends.period ? ` (${data.sqbTrends.period})` : '';

  page.innerHTML = `
    <div class="page__inner">
      <div class="page-header">
        <div class="page-title">${data.contract} <span class="page-title__program">${data.program} Updates</span></div>
      </div>
      <div class="page-content">
        <!-- Risk Scores 2x2 grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-sm);">
          <div class="chart-container" data-risk="property">
            <div class="section-header">${data.riskScores.property.title}</div>
            <div class="chart-container__body">
              <canvas class="risk-chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-container" data-risk="windHail">
            <div class="section-header">${data.riskScores.windHail.title}</div>
            <div class="chart-container__body">
              <canvas class="risk-chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-container" data-risk="crime">
            <div class="section-header">${data.riskScores.crime.title}</div>
            <div class="chart-container__body">
              <canvas class="risk-chart-canvas"></canvas>
            </div>
          </div>
          <div class="chart-container" data-risk="wildfire">
            <div class="section-header">${data.riskScores.wildfire.title}</div>
            <div class="chart-container__body">
              <canvas class="risk-chart-canvas"></canvas>
            </div>
          </div>
        </div>
        <!-- S/Q/B Trends -->
        <div class="chart-container sqb-chart-container" data-chart-type="combo" style="flex: 1;">
          <div class="section-header">Submissions, Quotes, Binds${periodNote}</div>
          <div class="chart-container__body">
            <canvas class="sqb-chart-canvas"></canvas>
          </div>
          <div class="sqb-legend"></div>
        </div>
      </div>
    </div>
  `;
  return page;
}

export function renderUpdatesCharts(data, root) {
  const scope = root || document;

  // Risk score h-bar charts
  const riskKeys = ['property', 'windHail', 'crime', 'wildfire'];
  riskKeys.forEach(key => {
    const container = scope.querySelector(`[data-risk="${key}"]`);
    if (!container) return;
    const canvas = container.querySelector('.risk-chart-canvas');
    if (!canvas) return;
    const rs = data.riskScores[key];
    const chartData = rs.categories.map((cat, ci) => ({
      label: cat,
      value: rs.values[ci],
    }));
    createHBarChart(canvas, chartData, {
      valueFormatter: v => v + '%',
      labelWidth: 55,
      valueWidth: 40,
    });
  });

  // S/Q/B combo chart
  renderSqbChart(data, scope);
}

// ─── Standalone S/Q/B Page (for Portfolio contracts) ──────────

export function buildSqbPage(data) {
  const page = document.createElement('div');
  page.className = 'page';

  const title = data.contract
    ? `${data.contract} <span class="page-title__program">Submission / Quote / Bind Trends</span>`
    : `<span class="page-title__program">Submission / Quote / Bind Trends</span>`;

  const periodNote = data.sqbTrends && data.sqbTrends.period ? ` (${data.sqbTrends.period})` : '';

  page.innerHTML = `
    <div class="page__inner">
      <div class="page-header">
        <div class="page-title">${title}</div>
      </div>
      <div class="page-content">
        <div class="chart-container sqb-chart-container" data-chart-type="combo" style="flex: 1;">
          <div class="section-header">Submissions, Quotes, Binds${periodNote}</div>
          <div class="chart-container__body">
            <canvas class="sqb-chart-canvas"></canvas>
          </div>
          <div class="sqb-legend"></div>
        </div>
        <div class="sqb-data-table"></div>
      </div>
    </div>
  `;
  return page;
}

export function renderSqbCharts(data, root) {
  const scope = root || document;
  renderSqbChart(data, scope);

  // Data table (only for standalone page with real data)
  const tableContainer = scope.querySelector('.sqb-data-table');
  if (tableContainer && tableContainer.children.length === 0 && data.sqbTrends.submissions.some(v => v > 0)) {
    tableContainer.appendChild(buildSqbTable(data.sqbTrends));
  }
}

// ─── Shared S/Q/B rendering ───────────────────────────────────

function renderSqbChart(data, scope) {
  const el = scope.querySelector('.sqb-chart-canvas');
  if (!el) return;

  const sqb = data.sqbTrends;
  const comboData = sqb.months.map((month, i) => {
    const bindRatio = sqb.submissions[i] > 0
      ? (sqb.binds[i] / sqb.submissions[i]) * 100
      : 0;
    return {
      label: month,
      bars: [sqb.submissions[i], sqb.quotes[i], sqb.binds[i]],
      line: bindRatio,
    };
  });

  const sqbLegendItems = [
    { label: 'Submissions', color: '#0A5383', type: 'bar' },
    { label: 'Quotes', color: '#8FBAD2', type: 'bar' },
    { label: 'Binds', color: '#E97121', type: 'bar' },
    { label: 'Bind Ratio', color: '#6BAF4A', type: 'line' },
  ];

  createComboChart(el, comboData, {
    barColors: ['#0A5383', '#8FBAD2', '#E97121'],
    lineColor: '#6BAF4A',
    showBarValues: false,
    showLineValues: false,
    paddingBottom: 28,
    paddingTop: 16,
    paddingSide: 20,
  });

  // Store data on the chart container for the card editor
  const chartContainer = scope.querySelector('.sqb-chart-container');
  if (chartContainer) {
    chartContainer.setAttribute('data-chart-src', JSON.stringify(comboData));
    chartContainer.setAttribute('data-chart-legend', JSON.stringify(sqbLegendItems));
  }

  const legendContainer = scope.querySelector('.sqb-legend');
  if (legendContainer && legendContainer.children.length === 0) {
    legendContainer.appendChild(createComboLegend(sqbLegendItems));
  }
}

function buildSqbTable(sqb) {
  const table = document.createElement('div');
  table.style.cssText = 'background: var(--ses-white); border-radius: var(--radius); overflow: hidden; box-shadow: 0 1px 3px rgba(10,83,131,0.1);';

  const rows = [
    { label: 'Submissions', values: sqb.submissions, color: '#0A5383' },
    { label: 'Quotes', values: sqb.quotes, color: '#8FBAD2' },
    { label: 'Binds', values: sqb.binds, color: '#E97121' },
  ];

  let html = '<table style="width: 100%; border-collapse: collapse; font-size: 9px; font-family: var(--font-family);">';
  html += '<thead><tr><th style="text-align: left; padding: 6px 8px; color: var(--ses-text-muted); font-weight: 600;"></th>';
  sqb.months.forEach(m => {
    html += `<th style="text-align: right; padding: 6px 4px; color: var(--ses-text-muted); font-weight: 600;">${m}</th>`;
  });
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += `<tr><td style="padding: 4px 8px; font-weight: 600; color: ${row.color}; white-space: nowrap;">${row.label}</td>`;
    row.values.forEach(v => {
      html += `<td style="text-align: right; padding: 4px 4px; color: var(--ses-text);">${v.toLocaleString()}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  table.innerHTML = html;
  return table;
}
