// Semi-Circle Gauge Chart Component — SVG

import { svgEl, prepareSvg, FONT } from './svg-utils.js';

const COLORS = {
  navy: '#0A5383',
  navyLight: '#C5DCE8',
  text: '#0A5383',
  muted: '#5A7A8F',
  white: '#FFFFFF',
  needle: '#073D62',
};

export function createGaugeChart(element, { currentValue, maxValue, unit, label }, options = {}) {
  const {
    trackColor = COLORS.navyLight,
    fillColor = COLORS.navy,
    needleColor = COLORS.needle,
    trackWidth = 14,
  } = options;

  const { svg, w: drawWidth, h: drawHeight } = prepareSvg(element);

  // Gauge geometry — semi-circle centered with room for text below
  const centerX = drawWidth / 2;
  const maxR = Math.min(drawWidth / 2 - trackWidth - 4, drawHeight * 0.42);
  const gaugeRadius = Math.max(maxR, 40);
  const centerY = gaugeRadius + trackWidth / 2 + 8;

  const fraction = Math.min(currentValue / maxValue, 1);

  // Arc endpoints
  const startX = centerX - gaugeRadius;
  const endX = centerX + gaugeRadius;

  // Track — full semi-circle (top arc, clockwise: sweep=1)
  svg.appendChild(svgEl('path', {
    d: `M${startX},${centerY} A${gaugeRadius},${gaugeRadius} 0 0 1 ${endX},${centerY}`,
    fill: 'none',
    stroke: trackColor,
    'stroke-width': trackWidth,
    'stroke-linecap': 'round',
  }));

  // Filled arc
  if (fraction > 0.005) {
    const fillAngle = Math.PI + Math.PI * fraction;
    const fillEndX = centerX + Math.cos(fillAngle) * gaugeRadius;
    const fillEndY = centerY + Math.sin(fillAngle) * gaugeRadius;

    const fillArc = svgEl('path', {
      d: `M${startX},${centerY} A${gaugeRadius},${gaugeRadius} 0 0 1 ${fillEndX},${fillEndY}`,
      fill: 'none',
      stroke: fillColor,
      'stroke-width': trackWidth,
      'stroke-linecap': 'round',
      class: 'anim-gauge',
    });
    svg.appendChild(fillArc);
    const arcLen = fillArc.getTotalLength();
    fillArc.style.strokeDasharray = arcLen;
    fillArc.style.strokeDashoffset = arcLen;
  }

  // Needle
  const needleLen = gaugeRadius - trackWidth / 2 - 2;
  const needleAngle = Math.PI + Math.PI * fraction;
  const nx = centerX + Math.cos(needleAngle) * needleLen;
  const ny = centerY + Math.sin(needleAngle) * needleLen;

  const needle = svgEl('line', {
    x1: centerX, y1: centerY, x2: nx, y2: ny,
    stroke: needleColor,
    'stroke-width': '2',
    'stroke-linecap': 'round',
    class: 'anim-fade',
  });
  needle.style.animationDelay = '600ms';
  svg.appendChild(needle);

  // Pivot dot
  const pivot = svgEl('circle', {
    cx: centerX, cy: centerY, r: 4,
    fill: needleColor,
    class: 'anim-fade',
  });
  pivot.style.animationDelay = '600ms';
  svg.appendChild(pivot);

  // Text below gauge
  const textY = centerY + 12;

  const valueText = svgEl('text', {
    x: centerX,
    y: textY,
    fill: COLORS.text,
    'font-size': '20',
    'font-weight': '700',
    'font-family': FONT,
    'text-anchor': 'middle',
    'dominant-baseline': 'hanging',
  });
  valueText.textContent = `${currentValue}${unit}`;
  valueText.classList.add('anim-fade');
  valueText.style.animationDelay = '800ms';
  svg.appendChild(valueText);

  const subText = svgEl('text', {
    x: centerX,
    y: textY + 24,
    fill: COLORS.muted,
    'font-size': '11',
    'font-weight': '500',
    'font-family': FONT,
    'text-anchor': 'middle',
    'dominant-baseline': 'hanging',
  });
  subText.textContent = `of ${maxValue}${unit}`;
  subText.classList.add('anim-fade');
  subText.style.animationDelay = '900ms';
  svg.appendChild(subText);

  const labelText = svgEl('text', {
    x: centerX,
    y: textY + 40,
    fill: COLORS.muted,
    'font-size': '10',
    'font-weight': '600',
    'font-family': FONT,
    'text-anchor': 'middle',
    'dominant-baseline': 'hanging',
  });
  labelText.textContent = label;
  labelText.classList.add('anim-fade');
  labelText.style.animationDelay = '1000ms';
  svg.appendChild(labelText);
}
