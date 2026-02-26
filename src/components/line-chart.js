// Line Chart Component — SVG

import { svgEl, prepareSvg, FONT } from './svg-utils.js';

const COLORS = {
  navy: '#0A5383',
  text: '#0A5383',
  muted: '#5A7A8F',
  gridLine: '#E8EEF2',
  white: '#FFFFFF',
};

export function createLineChart(element, data, options = {}) {
  const {
    lineColor = COLORS.navy,
    lineWidth = 2.5,
    pointRadius = 4,
    paddingBottom = 28,
    paddingTop = 28,
    paddingSide = 24,
    valueFormatter = (v) => v.toString(),
  } = options;

  const { svg, w: drawWidth, h: drawHeight } = prepareSvg(element);

  const values = data.map((d) => d.value);
  const minValue = Math.min(...values) * 0.9;
  const maxValue = Math.max(...values) * 1.1;
  const range = maxValue - minValue || 1;

  const chartLeft = paddingSide;
  const chartRight = drawWidth - paddingSide;
  const chartWidth = chartRight - chartLeft;
  const chartTop = paddingTop;
  const chartBottom = drawHeight - paddingBottom;
  const chartHeight = chartBottom - chartTop;

  // Compute points
  const points = data.map((d, i) => ({
    x: chartLeft + (i / (data.length - 1)) * chartWidth,
    y: chartTop + (1 - (d.value - minValue) / range) * chartHeight,
    label: d.label,
    value: d.value,
  }));

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = chartTop + (chartHeight / 4) * i;
    svg.appendChild(svgEl('line', {
      x1: chartLeft, y1: y, x2: chartRight, y2: y,
      stroke: COLORS.gridLine, 'stroke-width': '0.5',
    }));
  }

  // Line path
  if (points.length > 1) {
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
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

  // Points and labels
  points.forEach((p, pi) => {
    // Open circle point
    const circle = svgEl('circle', {
      cx: p.x, cy: p.y, r: pointRadius,
      fill: COLORS.white,
      stroke: lineColor,
      'stroke-width': '2',
      class: 'anim-point',
    });
    circle.style.animationDelay = `${400 + pi * 80}ms`;
    svg.appendChild(circle);

    // Value above
    const val = svgEl('text', {
      x: p.x,
      y: p.y - pointRadius - 4,
      fill: COLORS.text,
      'font-size': '10',
      'font-weight': '700',
      'font-family': FONT,
      'text-anchor': 'middle',
    });
    val.textContent = valueFormatter(p.value);
    val.classList.add('anim-fade');
    val.style.animationDelay = `${500 + pi * 80}ms`;
    svg.appendChild(val);

    // X-axis label
    const label = svgEl('text', {
      x: p.x,
      y: chartBottom + 6,
      fill: COLORS.muted,
      'font-size': '10',
      'font-weight': '500',
      'font-family': FONT,
      'text-anchor': 'middle',
      'dominant-baseline': 'hanging',
    });
    label.textContent = p.label;
    svg.appendChild(label);
  });
}
