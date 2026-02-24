// Line Chart Component

const COLORS = {
  navy: '#0A5383',
  text: '#0A5383',
  muted: '#5A7A8F',
  gridLine: '#E8EEF2',
  white: '#FFFFFF',
};

export function createLineChart(canvas, data, options = {}) {
  const {
    lineColor = COLORS.navy,
    lineWidth = 2.5,
    pointRadius = 4,
    animationDuration = 1600,
    paddingBottom = 28,
    paddingTop = 28,
    paddingSide = 24,
    valueFormatter = (v) => v.toString(),
  } = options;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const drawWidth = canvas.clientWidth;
  const drawHeight = canvas.clientHeight;
  canvas.width = drawWidth * dpr;
  canvas.height = drawHeight * dpr;
  ctx.scale(dpr, dpr);

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

    // How many points to show based on animation progress
    const visibleCount = Math.floor(eased * points.length) + (eased >= 1 ? 0 : 1);
    const visiblePoints = points.slice(0, visibleCount);

    // Partially animated last point
    if (visibleCount < points.length && eased < 1) {
      const segProgress = (eased * points.length) % 1;
      const from = points[visibleCount - 1];
      const to = points[visibleCount];
      if (from && to) {
        visiblePoints[visiblePoints.length - 1] = {
          x: from.x + (to.x - from.x) * segProgress,
          y: from.y + (to.y - from.y) * segProgress,
          label: from.label,
          value: from.value,
        };
      }
    }

    // Draw line
    if (visiblePoints.length > 1) {
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
    }

    // Draw points and labels (only for fully reached points)
    const fullyReached = eased >= 1 ? points.length : Math.floor(eased * points.length);
    for (let i = 0; i < fullyReached; i++) {
      const p = points[i];

      // Open circle point
      ctx.beginPath();
      ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Value label above
      ctx.fillStyle = COLORS.text;
      ctx.font = '700 10px Gilroy, Century Gothic, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(valueFormatter(p.value), p.x, p.y - pointRadius - 4);

      // X-axis label
      ctx.fillStyle = COLORS.muted;
      ctx.font = '500 10px Gilroy, Century Gothic, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(p.label, p.x, chartBottom + 6);
    }

    if (progress < 1) requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}
