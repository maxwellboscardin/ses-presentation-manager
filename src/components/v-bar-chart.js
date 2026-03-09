// Vertical Bar Chart Component — SVG

import { svgEl, roundRectPath, prepareSvg, FONT } from './svg-utils.js';

const COLORS = {
  navy: '#0A5383',
  text: '#0A5383',
  muted: '#5A7A8F',
  gridLine: '#E8EEF2',
};

export function createVBarChart(element, data, options = {}) {
  const {
    barColor = COLORS.navy,
    valueFormatter = (v) => v + '%',
    paddingBottom = 28,
    paddingTop = 24,
    paddingSide = 16,
  } = options;

  const { svg, w: drawWidth, h: drawHeight } = prepareSvg(element);

  const maxValue = Math.max(...data.map((d) => d.value)) * 1.2;
  const chartLeft = paddingSide;
  const chartRight = drawWidth - paddingSide;
  const chartWidth = chartRight - chartLeft;
  const chartTop = paddingTop;
  const chartBottom = drawHeight - paddingBottom;
  const chartHeight = chartBottom - chartTop;

  const barCount = data.length;
  const totalGap = barCount + 1;
  const gapWidth = Math.min(chartWidth * 0.15 / totalGap, 12);
  let barWidth = (chartWidth - gapWidth * totalGap) / barCount;
  // Cap bar width for single-bar charts so they don't stretch full width
  if (barCount === 1) barWidth = Math.min(barWidth, chartWidth * 0.2);

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = chartTop + (chartHeight / 4) * i;
    svg.appendChild(svgEl('line', {
      x1: chartLeft, y1: y, x2: chartRight, y2: y,
      stroke: COLORS.gridLine, 'stroke-width': '0.5',
    }));
  }

  data.forEach((item, i) => {
    const x = barCount === 1
      ? chartLeft + (chartWidth - barWidth) / 2
      : chartLeft + gapWidth + i * (barWidth + gapWidth);
    const barH = (item.value / maxValue) * chartHeight;
    const barY = chartBottom - barH;

    // Bar
    const pathD = roundRectPath(x, barY, barWidth, barH, 3);
    if (pathD) {
      const bar = svgEl('path', {
        d: pathD,
        fill: item.color || barColor,
        class: 'anim-bar-v',
      });
      bar.style.animationDelay = `${i * 60}ms`;
      svg.appendChild(bar);
    }

    // Value above bar
    const val = svgEl('text', {
      x: x + barWidth / 2,
      y: barY - 4,
      fill: COLORS.text,
      'font-size': '11',
      'font-weight': '700',
      'font-family': FONT,
      'text-anchor': 'middle',
    });
    val.textContent = valueFormatter(item.value);
    val.classList.add('anim-fade');
    val.style.animationDelay = `${i * 60 + 300}ms`;
    svg.appendChild(val);

    // Label below
    const label = svgEl('text', {
      x: x + barWidth / 2,
      y: chartBottom + 6,
      fill: COLORS.muted,
      'font-size': '10',
      'font-weight': '500',
      'font-family': FONT,
      'text-anchor': 'middle',
      'dominant-baseline': 'hanging',
    });
    label.textContent = item.label;
    svg.appendChild(label);
  });
}
