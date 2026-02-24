// Stacked Bar Chart Component

const DEFAULT_TIER_COLORS = [
  '#C5DCE8', // lightest blue
  '#8FBAD2',
  '#5A98B8',
  '#2E7BA0',
  '#0A5383', // darkest blue
];

export function createStackedBarChart(canvas, data, options = {}) {
  const {
    tierColors = DEFAULT_TIER_COLORS,
    tierLabels = [],
    animationDuration = 1400,
    paddingBottom = 28,
    paddingTop = 14,
    paddingSide = 16,
    valueFormatter = (v) => v.toLocaleString(),
  } = options;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const drawWidth = canvas.clientWidth;
  const drawHeight = canvas.clientHeight;
  canvas.width = drawWidth * dpr;
  canvas.height = drawHeight * dpr;
  ctx.scale(dpr, dpr);

  // data: [{ label: 'Q1', segments: [val1, val2, ...] }, ...]
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

    data.forEach((item, i) => {
      const x = chartLeft + gapWidth + i * (barWidth + gapWidth);
      let currentY = chartBottom;

      item.segments.forEach((segValue, si) => {
        const segH = (segValue / maxTotal) * chartHeight * eased;
        currentY -= segH;

        ctx.fillStyle = tierColors[si % tierColors.length];
        ctx.beginPath();

        // Round top corners only on the last (top) segment
        if (si === item.segments.length - 1 && segH > 0) {
          roundRectTop(ctx, x, currentY, barWidth, segH, 3);
        } else {
          ctx.rect(x, currentY, barWidth, segH);
        }
        ctx.fill();
      });

      // Column label
      ctx.fillStyle = '#5A7A8F';
      ctx.font = '500 10px Gilroy, Century Gothic, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label, x + barWidth / 2, chartBottom + 6);
    });

    if (progress < 1) requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
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
