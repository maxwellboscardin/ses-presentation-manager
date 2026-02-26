// Horizontal Bar Chart Component — SVG

import { svgEl, roundRectPath, prepareSvg, FONT } from './svg-utils.js';

const COLORS = {
  navy: '#0A5383',
  orange: '#E97121',
  text: '#0A5383',
  muted: '#5A7A8F',
};

export function createHBarChart(element, data, options = {}) {
  const {
    barColor = COLORS.navy,
    labelColor = COLORS.text,
    valueFormatter = (v) => v.toLocaleString(),
    labelWidth = 80,
    valueWidth = 70,
  } = options;

  const { svg, w: drawWidth, h: drawHeight } = prepareSvg(element);

  const maxValue = Math.max(...data.map((d) => d.value));
  const chartLeft = labelWidth;
  const chartRight = drawWidth - valueWidth;
  const chartWidth = chartRight - chartLeft;

  // Auto-size bars to fill available height
  const paddingTop = 6;
  const paddingBottom = 6;
  const availableHeight = drawHeight - paddingTop - paddingBottom;
  const perItemSlot = availableHeight / data.length;
  const computedBarHeight = Math.min(perItemSlot * 0.65, 30);
  const naturalGap = perItemSlot - computedBarHeight;
  const computedBarGap = Math.min(naturalGap, computedBarHeight * 0.5);
  const totalUsed = computedBarHeight * data.length + computedBarGap * (data.length - 1);
  const startY = paddingTop + (availableHeight - totalUsed) / 2;

  data.forEach((item, i) => {
    const y = startY + i * (computedBarHeight + computedBarGap);
    const barW = (item.value / maxValue) * chartWidth;

    // Label
    const label = svgEl('text', {
      x: chartLeft - 8,
      y: y + computedBarHeight / 2,
      fill: labelColor,
      'font-size': '11',
      'font-weight': '600',
      'font-family': FONT,
      'text-anchor': 'end',
      'dominant-baseline': 'central',
    });
    label.textContent = item.label;
    svg.appendChild(label);

    // Bar
    const pathD = roundRectPath(chartLeft, y, barW, computedBarHeight, 3);
    if (pathD) {
      const bar = svgEl('path', {
        d: pathD,
        fill: item.color || barColor,
        class: 'anim-bar-h',
      });
      bar.style.animationDelay = `${i * 60}ms`;
      svg.appendChild(bar);
    }

    // Value
    const val = svgEl('text', {
      x: chartLeft + barW + 6,
      y: y + computedBarHeight / 2,
      fill: COLORS.muted,
      'font-size': '10',
      'font-weight': '500',
      'font-family': FONT,
      'text-anchor': 'start',
      'dominant-baseline': 'central',
    });
    val.textContent = valueFormatter(item.value);
    val.classList.add('anim-fade');
    val.style.animationDelay = `${i * 60 + 300}ms`;
    svg.appendChild(val);
  });
}
