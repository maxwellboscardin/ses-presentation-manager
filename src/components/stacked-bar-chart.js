// Stacked Bar Chart Component — SVG

import { svgEl, roundRectPath, roundRectTopPath, prepareSvg, FONT } from './svg-utils.js';

const DEFAULT_TIER_COLORS = [
  '#C5DCE8', // lightest blue
  '#8FBAD2',
  '#5A98B8',
  '#2E7BA0',
  '#0A5383', // darkest blue
];

export function createStackedBarChart(element, data, options = {}) {
  const {
    tierColors = DEFAULT_TIER_COLORS,
    paddingBottom = 28,
    paddingTop = 14,
    paddingSide = 16,
  } = options;

  const { svg, w: drawWidth, h: drawHeight } = prepareSvg(element);

  const maxTotal = Math.max(...data.map((d) => d.segments.reduce((a, b) => a + b, 0))) * 1.1;

  const chartLeft = paddingSide;
  const chartRight = drawWidth - paddingSide;
  const chartWidth = chartRight - chartLeft;
  const chartTop = paddingTop;
  const chartBottom = drawHeight - paddingBottom;
  const chartHeight = chartBottom - chartTop;

  const barCount = data.length;
  const gapWidth = Math.min(chartWidth * 0.12 / (barCount + 1), 10);
  const barWidth = (chartWidth - gapWidth * (barCount + 1)) / barCount;

  data.forEach((item, i) => {
    const x = chartLeft + gapWidth + i * (barWidth + gapWidth);
    let currentY = chartBottom;

    const colGroup = svgEl('g');
    colGroup.classList.add('anim-col-v');
    colGroup.style.transformOrigin = `${x + barWidth / 2}px ${chartBottom}px`;
    colGroup.style.animationDelay = `${i * 60}ms`;

    const lastVisibleIndex = item.segments.reduce((last, v, i) => v > 0 ? i : last, -1);

    item.segments.forEach((segValue, si) => {
      const segH = (segValue / maxTotal) * chartHeight;
      currentY -= segH;

      if (segH > 0) {
        // Only the topmost visible segment gets rounded top corners
        const isTop = si === lastVisibleIndex;
        const pathD = isTop
          ? roundRectTopPath(x, currentY, barWidth, segH, 3)
          : `M${x},${currentY} L${x + barWidth},${currentY} L${x + barWidth},${currentY + segH} L${x},${currentY + segH} Z`;
        if (pathD) {
          colGroup.appendChild(svgEl('path', {
            d: pathD,
            fill: tierColors[si % tierColors.length],
          }));
        }
      }
    });

    svg.appendChild(colGroup);

    // Column label
    const label = svgEl('text', {
      x: x + barWidth / 2,
      y: chartBottom + 6,
      fill: '#5A7A8F',
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

export function createChartLegend(tierLabels, tierColors = DEFAULT_TIER_COLORS) {
  const legend = document.createElement('div');
  legend.className = 'chart-legend';

  tierLabels.forEach((label, i) => {
    const item = document.createElement('div');
    item.className = 'chart-legend__item';

    const swatch = document.createElement('div');
    swatch.className = 'chart-legend__swatch';
    swatch.style.background = tierColors[i % tierColors.length];

    const text = document.createElement('span');
    text.textContent = label;

    item.appendChild(swatch);
    item.appendChild(text);
    legend.appendChild(item);
  });

  return legend;
}
