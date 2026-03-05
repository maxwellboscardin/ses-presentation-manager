// Combo Chart Component — Grouped Bars + Line Overlay (SVG)

import { svgEl, roundRectPath, prepareSvg, FONT } from './svg-utils.js';

const COLORS = {
  navy: '#0A5383',
  navyLight: '#8FBAD2',
  orange: '#E97121',
  text: '#0A5383',
  muted: '#5A7A8F',
  gridLine: '#E8EEF2',
  white: '#FFFFFF',
};

/**
 * Creates a combo chart with grouped vertical bars and a line overlay.
 * @param {HTMLElement} element — canvas (first call) or svg (replay)
 * @param {Array<{label: string, bars: number[], line: number}>} data
 * @param {Object} options
 */
export function createComboChart(element, data, options = {}) {
  const {
    barColors = [COLORS.navy, COLORS.navyLight],
    lineColor = COLORS.orange,
    lineWidth = 2.5,
    pointRadius = 4,
    paddingBottom = 28,
    paddingTop = 28,
    paddingSide = 32,
    barValueFormatter = (v) => v.toString(),
    lineValueFormatter = (v) => v.toString(),
    yAxisFormatter = (v) => Math.round(v) + '%',
    showBarValues = false,
    showLineValues = true,
    showYAxis = true,
  } = options;

  const { svg, w: drawWidth, h: drawHeight } = prepareSvg(element);

  // Detect line-only mode (no bars in data)
  const hasBars = data[0].bars && data[0].bars.length > 0;
  const axisPadding = (!hasBars && showYAxis) ? 30 : 0;

  const chartLeft = paddingSide + axisPadding;
  const chartRight = drawWidth - paddingSide;
  const chartWidth = chartRight - chartLeft;
  const chartTop = paddingTop;
  const chartBottom = drawHeight - paddingBottom;
  const chartHeight = chartBottom - chartTop;

  // Line scale
  const allLineValues = data.map((d) => d.line).filter((v) => v != null);
  const rawMax = allLineValues.length > 0 ? Math.max(...allLineValues) : 100;
  const rawMin = allLineValues.length > 0 ? Math.min(...allLineValues) : 0;

  let maxLineValue, minLineValue;
  if (!hasBars) {
    // Line-only: use nice round axis bounds
    const range = rawMax - rawMin || 10;
    const padding = range * 0.15;
    minLineValue = Math.max(0, Math.floor((rawMin - padding) / 5) * 5);
    maxLineValue = Math.min(100, Math.ceil((rawMax + padding) / 5) * 5);
    if (maxLineValue === minLineValue) maxLineValue = minLineValue + 10;
  } else {
    maxLineValue = rawMax * 1.15;
    minLineValue = rawMin * 0.85;
  }
  const lineRange = maxLineValue - minLineValue || 1;

  // Grid lines
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const y = chartTop + (chartHeight / gridCount) * i;
    svg.appendChild(svgEl('line', {
      x1: chartLeft, y1: y, x2: chartRight, y2: y,
      stroke: COLORS.gridLine, 'stroke-width': '0.5',
    }));

    // Y-axis labels in line-only mode
    if (!hasBars && showYAxis) {
      const axisVal = maxLineValue - (i / gridCount) * (maxLineValue - minLineValue);
      const axisLabel = svgEl('text', {
        x: chartLeft - 6,
        y: y,
        fill: COLORS.muted,
        'font-size': '8',
        'font-weight': '500',
        'font-family': FONT,
        'text-anchor': 'end',
        'dominant-baseline': 'central',
      });
      axisLabel.textContent = yAxisFormatter(axisVal);
      svg.appendChild(axisLabel);
    }
  }

  const groupCount = data.length;

  if (hasBars) {
    // Bar layout
    const barsPerGroup = data[0].bars.length;
    const allBarValues = data.flatMap((d) => d.bars);
    const maxBarValue = Math.max(...allBarValues) * 1.2;
    const groupGap = chartWidth * 0.12 / (groupCount + 1);
    const groupWidth = (chartWidth - groupGap * (groupCount + 1)) / groupCount;
    const barGap = 2;
    const singleBarWidth = (groupWidth - barGap * (barsPerGroup - 1)) / barsPerGroup;

    // Bars
    data.forEach((item, gi) => {
      const groupX = chartLeft + groupGap + gi * (groupWidth + groupGap);

      item.bars.forEach((val, bi) => {
        const x = groupX + bi * (singleBarWidth + barGap);
        const barH = (val / maxBarValue) * chartHeight;
        const barY = chartBottom - barH;

        const pathD = roundRectPath(x, barY, singleBarWidth, barH, 3);
        if (pathD) {
          const bar = svgEl('path', {
            d: pathD,
            fill: barColors[bi % barColors.length],
            class: 'anim-bar-v',
          });
          bar.style.animationDelay = `${gi * 80}ms`;
          svg.appendChild(bar);
        }

        if (showBarValues) {
          const bv = svgEl('text', {
            x: x + singleBarWidth / 2,
            y: barY - 2,
            fill: COLORS.text,
            'font-size': '9',
            'font-weight': '700',
            'font-family': FONT,
            'text-anchor': 'middle',
          });
          bv.textContent = barValueFormatter(val);
          svg.appendChild(bv);
        }
      });

      // X-axis label
      const label = svgEl('text', {
        x: groupX + groupWidth / 2,
        y: chartBottom + 6,
        fill: COLORS.muted,
        'font-size': '9',
        'font-weight': '500',
        'font-family': FONT,
        'text-anchor': 'middle',
        'dominant-baseline': 'hanging',
      });
      label.textContent = item.label;
      svg.appendChild(label);
    });

    // Line points (bar mode — centered on groups)
    var linePoints = data.map((d, i) => {
      const groupX = chartLeft + groupGap + i * (groupWidth + groupGap);
      const cx = groupX + groupWidth / 2;
      const cy = chartTop + (1 - (d.line - minLineValue) / lineRange) * chartHeight;
      return { x: cx, y: cy, value: d.line };
    }).filter((p) => p.value != null);

  } else {
    // Line-only mode — evenly space points
    const pointSpacing = groupCount > 1 ? chartWidth / (groupCount - 1) : 0;

    data.forEach((item, i) => {
      const cx = groupCount > 1 ? chartLeft + i * pointSpacing : chartLeft + chartWidth / 2;
      // X-axis label
      const label = svgEl('text', {
        x: cx,
        y: chartBottom + 6,
        fill: COLORS.muted,
        'font-size': '9',
        'font-weight': '500',
        'font-family': FONT,
        'text-anchor': 'middle',
        'dominant-baseline': 'hanging',
      });
      label.textContent = item.label;
      svg.appendChild(label);
    });

    var linePoints = data.map((d, i) => {
      const cx = groupCount > 1 ? chartLeft + i * pointSpacing : chartLeft + chartWidth / 2;
      const cy = chartTop + (1 - (d.line - minLineValue) / lineRange) * chartHeight;
      return { x: cx, y: cy, value: d.line };
    }).filter((p) => p.value != null);
  }

  // Line path
  if (linePoints.length > 1) {
    const pathD = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const linePath = svgEl('path', {
      d: pathD,
      fill: 'none',
      stroke: lineColor,
      'stroke-width': lineWidth,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
      class: 'anim-line',
    });
    svg.appendChild(linePath);
    const len = linePath.getTotalLength();
    linePath.style.strokeDasharray = len;
    linePath.style.strokeDashoffset = len;
  }

  // Line points and values
  linePoints.forEach((p, pi) => {
    // Open circle
    const circle = svgEl('circle', {
      cx: p.x, cy: p.y, r: pointRadius,
      fill: COLORS.white,
      stroke: lineColor,
      'stroke-width': '2',
      class: 'anim-point',
    });
    circle.style.animationDelay = `${400 + pi * 80}ms`;
    svg.appendChild(circle);

    if (showLineValues) {
      const lv = svgEl('text', {
        x: p.x,
        y: p.y - pointRadius - 3,
        fill: lineColor,
        'font-size': '9',
        'font-weight': '700',
        'font-family': FONT,
        'text-anchor': 'middle',
      });
      lv.textContent = lineValueFormatter(p.value);
      lv.classList.add('anim-fade');
      lv.style.animationDelay = `${500 + pi * 80}ms`;
      svg.appendChild(lv);
    }
  });
}

/**
 * Creates a DOM legend for the combo chart.
 * @param {Array<{label: string, color: string, type: 'bar'|'line'}>} items
 */
export function createComboLegend(items) {
  const legend = document.createElement('div');
  legend.className = 'chart-legend';

  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'chart-legend__item';

    const swatch = document.createElement('div');
    swatch.className = 'chart-legend__swatch';
    swatch.style.background = item.color;
    if (item.type === 'line') {
      swatch.style.borderRadius = '50%';
      swatch.style.width = '10px';
      swatch.style.height = '10px';
      swatch.style.border = `2px solid ${item.color}`;
      swatch.style.background = '#fff';
    }

    const text = document.createElement('span');
    text.textContent = item.label;

    el.appendChild(swatch);
    el.appendChild(text);
    legend.appendChild(el);
  });

  return legend;
}
