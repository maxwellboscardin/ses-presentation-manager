// Horizontal Bar Chart Component

const COLORS = {
  navy: '#0A5383',
  orange: '#E97121',
  text: '#0A5383',
  muted: '#5A7A8F',
  gridLine: '#E0E8EE',
};

export function createHBarChart(canvas, data, options = {}) {
  const {
    barColor = COLORS.navy,
    labelColor = COLORS.text,
    valueFormatter = (v) => v.toLocaleString(),
    animationDuration = 1400,
    barHeight = 18,
    barGap = 8,
    labelWidth = 80,
    valueWidth = 70,
  } = options;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const drawWidth = canvas.clientWidth;
  const drawHeight = canvas.clientHeight;
  canvas.width = drawWidth * dpr;
  canvas.height = drawHeight * dpr;
  ctx.scale(dpr, dpr);

  const maxValue = Math.max(...data.map((d) => d.value));
  const chartLeft = labelWidth;
  const chartRight = drawWidth - valueWidth;
  const chartWidth = chartRight - chartLeft;

  // Auto-size bars to fill available canvas proportionally
  const paddingTop = 6;
  const paddingBottom = 6;
  const availableHeight = drawHeight - paddingTop - paddingBottom;
  const perItemSlot = availableHeight / data.length;
  // Bars take ~65% of their slot, capped at a tasteful max
  const computedBarHeight = Math.min(perItemSlot * 0.65, 30);
  // Gap is capped to prevent enormous spacing
  const naturalGap = perItemSlot - computedBarHeight;
  const computedBarGap = Math.min(naturalGap, computedBarHeight * 0.5);
  const totalUsed = computedBarHeight * data.length + computedBarGap * (data.length - 1);
  const startY = paddingTop + (availableHeight - totalUsed) / 2;

  let progress = 0;
  const startTime = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function draw(now) {
    const elapsed = now - startTime;
    progress = Math.min(elapsed / animationDuration, 1);
    const eased = easeOutCubic(progress);

    ctx.clearRect(0, 0, drawWidth, drawHeight);

    data.forEach((item, i) => {
      const y = startY + i * (computedBarHeight + computedBarGap);
      const barW = (item.value / maxValue) * chartWidth * eased;

      // Label
      ctx.fillStyle = labelColor;
      ctx.font = '600 11px Gilroy, Century Gothic, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, chartLeft - 8, y + computedBarHeight / 2);

      // Bar
      ctx.fillStyle = item.color || barColor;
      ctx.beginPath();
      roundRect(ctx, chartLeft, y, barW, computedBarHeight, 3);
      ctx.fill();

      // Value label
      if (eased > 0.3) {
        ctx.fillStyle = COLORS.muted;
        ctx.font = '500 10px Gilroy, Century Gothic, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(valueFormatter(item.value), chartLeft + barW + 6, y + computedBarHeight / 2);
      }
    });

    if (progress < 1) requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 0) w = 0;
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
