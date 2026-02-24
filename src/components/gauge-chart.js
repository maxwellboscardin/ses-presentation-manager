// Semi-Circle Gauge Chart Component

const COLORS = {
  navy: '#0A5383',
  navyLight: '#C5DCE8',
  text: '#0A5383',
  muted: '#5A7A8F',
  white: '#FFFFFF',
  needle: '#073D62',
};

export function createGaugeChart(canvas, { currentValue, maxValue, unit, label }, options = {}) {
  const {
    trackColor = COLORS.navyLight,
    fillColor = COLORS.navy,
    needleColor = COLORS.needle,
    animationDuration = 1800,
    trackWidth = 14,
  } = options;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const drawWidth = canvas.clientWidth;
  const drawHeight = canvas.clientHeight;
  canvas.width = drawWidth * dpr;
  canvas.height = drawHeight * dpr;
  ctx.scale(dpr, dpr);

  // Gauge geometry — semi-circle centered with room for text below
  const centerX = drawWidth / 2;
  const maxR = Math.min(drawWidth / 2 - trackWidth - 4, drawHeight * 0.42);
  const gaugeRadius = Math.max(maxR, 40);
  const centerY = gaugeRadius + trackWidth / 2 + 8;

  const startAngle = Math.PI;       // 9 o'clock
  const endAngle = Math.PI * 2;     // 3 o'clock
  const fraction = Math.min(currentValue / maxValue, 1);

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

    const animatedFraction = fraction * eased;
    const fillAngle = startAngle + (endAngle - startAngle) * animatedFraction;

    // Track arc — full semi-circle, round caps
    ctx.beginPath();
    ctx.arc(centerX, centerY, gaugeRadius, startAngle, endAngle);
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = trackWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Filled arc
    if (animatedFraction > 0.005) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, gaugeRadius, startAngle, fillAngle);
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = trackWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Needle — from center out to the inner edge of the arc track
    const needleLen = gaugeRadius - trackWidth / 2 - 2;
    const nx = centerX + Math.cos(fillAngle) * needleLen;
    const ny = centerY + Math.sin(fillAngle) * needleLen;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = needleColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Pivot dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fillStyle = needleColor;
    ctx.fill();

    // Text below gauge
    const textY = centerY + 12;

    ctx.fillStyle = COLORS.text;
    ctx.font = '700 20px Gilroy, Century Gothic, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${currentValue}${unit}`, centerX, textY);

    ctx.fillStyle = COLORS.muted;
    ctx.font = '500 11px Gilroy, Century Gothic, sans-serif';
    ctx.fillText(`of ${maxValue}${unit}`, centerX, textY + 24);

    ctx.font = '600 10px Gilroy, Century Gothic, sans-serif';
    ctx.fillText(label, centerX, textY + 40);

    if (progress < 1) requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}
