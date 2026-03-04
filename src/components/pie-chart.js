// Pie Chart Component — SVG pie with bottom legend

import { svgEl, NS, FONT } from './svg-utils.js';

const COLORS = [
  '#0A5383',
  '#2E7BA0',
  '#5A98B8',
  '#8FBAD2',
  '#C5DCE8',
];

/**
 * Creates a pie chart centered in the container with a compact legend below.
 * @param {HTMLElement} element — canvas element (will be replaced with SVG)
 * @param {Array<{label: string, value: number}>} data — categories with percentages
 * @param {Object} options
 */
export function createPieChart(element, data, options = {}) {
  const {
    colors = COLORS,
    valueFormatter = (v) => v + '%',
  } = options;

  // Get physical size, normalize to 200-wide coordinate space
  const rawW = element.clientWidth || 200;
  const rawH = element.clientHeight || 150;
  const aspect = rawW / rawH;
  const VW = 200;
  const VH = VW / aspect;

  const svg = document.createElementNS(NS, 'svg');
  if (element.id) svg.id = element.id;
  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  svg.style.display = 'block';
  svg.style.width = '100%';
  svg.style.height = '100%';
  element.replaceWith(svg);

  // Assign colors to all items
  const allItems = data.map((d, i) => ({
    ...d,
    color: colors[i % colors.length],
  }));

  const slices = allItems.filter(d => d.value > 0);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return;

  // Layout: legend at bottom, pie fills remaining space centered
  const legendRowH = 16;
  const itemsPerRow = 2;
  const legendRows = Math.ceil(allItems.length / itemsPerRow);
  const legendTotalH = legendRows * legendRowH + 6;
  const pieAreaH = VH - legendTotalH;

  const cx = VW / 2;
  const cy = pieAreaH / 2;
  const radius = Math.min(VW / 2 - 8, pieAreaH / 2 - 4);

  // Draw slices
  let startAngle = -Math.PI / 2;

  slices.forEach((s) => {
    const fraction = s.value / total;
    const endAngle = startAngle + fraction * 2 * Math.PI;

    if (fraction >= 0.999) {
      svg.appendChild(svgEl('circle', { cx, cy, r: radius, fill: s.color }));
    } else {
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const largeArc = fraction > 0.5 ? 1 : 0;

      svg.appendChild(svgEl('path', {
        d: `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z`,
        fill: s.color,
      }));
    }

    startAngle = endAngle;
  });

  // Bottom legend — compact rows, all categories shown
  const fontSize = 12;
  const swatchSize = 8;
  const legendStartY = pieAreaH + 6;

  allItems.forEach((item, i) => {
    const row = Math.floor(i / itemsPerRow);
    const col = i % itemsPerRow;
    const colW = VW / itemsPerRow;
    const lx = col * colW + 4;
    const ly = legendStartY + row * legendRowH + legendRowH / 2;

    // Single text element with inline swatch character for perfect alignment
    const text = svgEl('text', {
      x: lx,
      y: ly,
      'font-family': FONT,
      'font-size': fontSize,
      'dominant-baseline': 'central',
    });
    // Swatch as unicode block character
    const swatchSpan = document.createElementNS(NS, 'tspan');
    swatchSpan.textContent = '\u25A0 ';
    swatchSpan.setAttribute('fill', item.color);
    swatchSpan.setAttribute('fill-opacity', item.value === 0 ? '0.35' : '1');
    text.appendChild(swatchSpan);
    // Label
    const labelSpan = document.createElementNS(NS, 'tspan');
    labelSpan.textContent = item.label + ' ';
    labelSpan.setAttribute('fill', item.value > 0 ? '#5A7A8F' : '#99AABB');
    labelSpan.setAttribute('font-weight', '400');
    text.appendChild(labelSpan);
    // Value
    const valSpan = document.createElementNS(NS, 'tspan');
    valSpan.textContent = valueFormatter(item.value);
    valSpan.setAttribute('fill', item.value > 0 ? '#0A5383' : '#99AABB');
    valSpan.setAttribute('font-weight', '700');
    text.appendChild(valSpan);
    svg.appendChild(text);
  });
}
