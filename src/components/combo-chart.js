// Combo Chart Component — Grouped Bars + Line Overlay

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
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{label: string, bars: number[], line: number}>} data
 * @param {Object} options
 */
export function createComboChart(canvas, data, options = {}) {
  const {
    barColors = [COLORS.navy, COLORS.navyLight],
    lineColor = COLORS.orange,
    lineWidth = 2.5,
    pointRadius = 4,
    animationDuration = 1600,
    paddingBottom = 28,
    paddingTop = 28,
    paddingSide = 32,
    barValueFormatter = (v) => v.toString(),
    lineValueFormatter = (v) => v.toString(),
    showBarValues = false,
    showLineValues = true,
  } = options;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const drawWidth = canvas.clientWidth;
  const drawHeight = canvas.clientHeight;
  canvas.width = drawWidth * dpr;
  canvas.height = drawHeight * dpr;
  ctx.scale(dpr, dpr);

  const chartLeft = paddingSide;
  const chartRight = drawWidth - paddingSide;
  const chartWidth = chartRight - chartLeft;
  const chartTop = paddingTop;
  const chartBottom = drawHeight - paddingBottom;
  const chartHeight = chartBottom - chartTop;

  // Determine scales
  const allBarValues = data.flatMap((d) => d.bars);
  const maxBarValue = Math.max(...allBarValues) * 1.2;

  const allLineValues = data.map((d) => d.line).filter((v) => v != null);
  const maxLineValue = allLineValues.length > 0 ? Math.max(...allLineValues) * 1.15 : 1;
  const minLineValue = allLineValues.length > 0 ? Math.min(...allLineValues) * 0.85 : 0;
  const lineRange = maxLineValue - minLineValue || 1;

  // Bar layout
  const groupCount = data.length;
  const barsPerGroup = data[0].bars.length;
  const groupGap = chartWidth * 0.12 / (groupCount + 1);
  const groupWidth = (chartWidth - groupGap * (groupCount + 1)) / groupCount;
  const barGap = 2;
  const singleBarWidth = (groupWidth - barGap * (barsPerGroup - 1)) / barsPerGroup;

  // Compute line points (centered on each group)
  const linePoints = data.map((d, i) => {
    const groupX = chartLeft + groupGap + i * (groupWidth + groupGap);
    const cx = groupX + groupWidth / 2;
    const cy = chartTop + (1 - (d.line - minLineValue) / lineRange) * chartHeight;
    return { x: cx, y: cy, value: d.line };
  }).filter((p) => p.value != null);

  let startTime = null;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function draw(now) {
    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / animationDuration, 1);
    const eased = easeOutCubic(progress);

    ctx.clearRect(0, 0, drawWidth, drawHeight);

    // Grid lines
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = chartTop + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
    }

    // Draw bars
    data.forEach((item, gi) => {
      const groupX = chartLeft + groupGap + gi * (groupWidth + groupGap);

      item.bars.forEach((val, bi) => {
        const x = groupX + bi * (singleBarWidth + barGap);
        const barH = (val / maxBarValue) * chartHeight * eased;
        const barY = chartBottom - barH;

        ctx.fillStyle = barColors[bi % barColors.length];
        ctx.beginPath();
        roundRectTop(ctx, x, barY, singleBarWidth, barH, 3);
        ctx.fill();

        if (showBarValues && eased > 0.3) {
          ctx.fillStyle = COLORS.text;
          ctx.font = '700 9px Gilroy, Century Gothic, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(barValueFormatter(val), x + singleBarWidth / 2, barY - 2);
        }
      });

      // X-axis label
      ctx.fillStyle = COLORS.muted;
      ctx.font = '500 9px Gilroy, Century Gothic, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label, groupX + groupWidth / 2, chartBottom + 6);
    });

    // Draw line (progressive reveal)
    if (linePoints.length > 1) {
      const visibleCount = Math.floor(eased * linePoints.length) + (eased >= 1 ? 0 : 1);
      const visiblePoints = linePoints.slice(0, visibleCount);

      // Interpolate partial last point
      if (visibleCount < linePoints.length && eased < 1) {
        const segProgress = (eased * linePoints.length) % 1;
        const from = linePoints[visibleCount - 1];
        const to = linePoints[visibleCount];
        if (from && to) {
          visiblePoints[visiblePoints.length - 1] = {
            x: from.x + (to.x - from.x) * segProgress,
            y: from.y + (to.y - from.y) * segProgress,
            value: from.value,
          };
        }
      }

      // Line path
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
      for (let i = 1; i < visiblePoints.length; i++) {
        ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
      }
      ctx.stroke();

      // Points and values (fully reached only)
      const fullyReached = eased >= 1 ? linePoints.length : Math.floor(eased * linePoints.length);
      for (let i = 0; i < fullyReached; i++) {
        const p = linePoints[i];

        // Open circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.white;
        ctx.fill();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Value above
        if (showLineValues) {
          ctx.fillStyle = lineColor;
          ctx.font = '700 9px Gilroy, Century Gothic, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(lineValueFormatter(p.value), p.x, p.y - pointRadius - 3);
        }
      }
    }

    if (progress < 1) requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
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

function roundRectTop(ctx, x, y, w, h, r) {
  if (h < 0) h = 0;
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
