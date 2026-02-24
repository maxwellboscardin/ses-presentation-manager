// Vertical Bar Chart Component

const COLORS = {
  navy: '#0A5383',
  text: '#0A5383',
  muted: '#5A7A8F',
  gridLine: '#E8EEF2',
};

export function createVBarChart(canvas, data, options = {}) {
  const {
    barColor = COLORS.navy,
    labelColor = COLORS.text,
    valueFormatter = (v) => v + '%',
    animationDuration = 1400,
    paddingBottom = 28,
    paddingTop = 24,
    paddingSide = 16,
  } = options;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const drawWidth = canvas.clientWidth;
  const drawHeight = canvas.clientHeight;
  canvas.width = drawWidth * dpr;
  canvas.height = drawHeight * dpr;
  ctx.scale(dpr, dpr);

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
  const barWidth = (chartWidth - gapWidth * totalGap) / barCount;

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

    data.forEach((item, i) => {
      const x = chartLeft + gapWidth + i * (barWidth + gapWidth);
      const barH = (item.value / maxValue) * chartHeight * eased;
      const barY = chartBottom - barH;

      // Bar
      ctx.fillStyle = item.color || barColor;
      ctx.beginPath();
      roundRectTop(ctx, x, barY, barWidth, barH, 3);
      ctx.fill();

      // Value above bar
      if (eased > 0.3) {
        ctx.fillStyle = COLORS.text;
        ctx.font = '700 11px Gilroy, Century Gothic, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(valueFormatter(item.value), x + barWidth / 2, barY - 4);
      }

      // Label below
      ctx.fillStyle = COLORS.muted;
      ctx.font = '500 10px Gilroy, Century Gothic, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label, x + barWidth / 2, chartBottom + 6);
    });

    if (progress < 1) requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
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
