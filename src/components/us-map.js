// US SVG Map Component — real state outlines colored by TIV intensity

const COLORS = {
  navy: '#0A5383',
  orange: '#E97121',
  stroke: '#0A5383',
};

// Blues gradient for TIV intensity (states WITH policies)
const INTENSITY_COLORS = [
  '#C5DCE8',
  '#8FBAD2',
  '#5A98B8',
  '#2E7BA0',
  '#0A5383',
];

// State name lookup for tooltips
const STATE_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',
  FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',
  IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
  ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',
  NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',
  NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',
  PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',
  TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};

export async function createUSMap(container, stateData, options = {}) {
  const {
    highlightStates = [],
    highlightColor = COLORS.orange,
    svgUrl = '../../assets/us-states.svg',
    valueFormatter = (v) => `$${v.toFixed(1)}M`,
  } = options;

  const highlightSet = new Set(highlightStates.map((s) => s.toUpperCase()));

  // Fetch SVG
  const res = await fetch(svgUrl);
  const svgText = await res.text();

  // Parse into DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');

  // Style SVG to fill container and center the map
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.display = 'block';
  svg.style.opacity = '0';
  svg.style.transition = 'opacity 1.2s ease-out';

  // Compute value range for color scaling
  const values = Object.values(stateData).filter((v) => v > 0);
  const maxValue = values.length > 0 ? Math.max(...values) : 1;

  // Dark blue stroke around every state
  svg.style.stroke = COLORS.stroke;
  svg.style.strokeWidth = '0.8';
  svg.style.strokeLinejoin = 'round';

  // Color each state path (skip AK/HI — non-continental)
  const SKIP_STATES = new Set(['AK', 'HI']);
  const paths = svg.querySelectorAll('path[id]');
  paths.forEach((path) => {
    const stateId = path.id.toUpperCase();

    if (SKIP_STATES.has(stateId)) {
      path.remove();
      return;
    }

    const value = stateData[stateId] || 0;

    // Color by TIV intensity
    if (!value || value <= 0) {
      path.style.fill = '#FFFFFF';
    } else {
      const ratio = value / maxValue;
      const idx = Math.min(
        Math.floor(ratio * (INTENSITY_COLORS.length - 1)),
        INTENSITY_COLORS.length - 1
      );
      path.style.fill = INTENSITY_COLORS[idx];
    }

    // Hover cursor
    path.style.cursor = 'pointer';
  });

  // Move growth target paths to end of SVG so their strokes render on top
  paths.forEach((path) => {
    const stateId = path.id.toUpperCase();
    if (highlightSet.has(stateId) && path.parentNode) {
      path.style.stroke = highlightColor;
      path.style.strokeWidth = '4';
      path.dataset.growthTarget = '1';
      path.parentNode.appendChild(path);
    }
  });

  // Re-query paths after removing AK/HI
  const visiblePaths = svg.querySelectorAll('path[id]');

  // Build wrapper for map + legend
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;position:relative;';

  // SVG container
  const svgWrap = document.createElement('div');
  svgWrap.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;';
  svgWrap.appendChild(svg);
  wrapper.appendChild(svgWrap);

  // Legend
  const legend = buildLegend(highlightColor);
  wrapper.appendChild(legend);

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position:absolute;pointer-events:none;opacity:0;
    background:#0A5383;color:#fff;padding:4px 10px;border-radius:4px;
    font-size:11px;font-weight:600;font-family:Gilroy,Century Gothic,sans-serif;
    white-space:nowrap;z-index:10;box-shadow:0 2px 6px rgba(0,0,0,0.2);
    transition:opacity 0.15s;
  `;
  wrapper.appendChild(tooltip);

  // Hover events
  visiblePaths.forEach((path) => {
    const stateId = path.id.toUpperCase();
    const value = stateData[stateId] || 0;
    if (value <= 0) return; // No tooltip for states without policies

    const name = STATE_NAMES[stateId] || stateId;
    const tivText = valueFormatter(value);

    path.setAttribute('data-tooltip', `${name}: ${tivText}`);

    path.addEventListener('mouseenter', (e) => {
      tooltip.textContent = `${name}: ${tivText}`;
      tooltip.style.opacity = '1';
      if (!path.dataset.growthTarget) {
        path.style.strokeWidth = '2';
      }
    });

    path.addEventListener('mousemove', (e) => {
      const rect = wrapper.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 28) + 'px';
    });

    path.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
      if (!path.dataset.growthTarget) {
        path.style.strokeWidth = '';
      }
    });
  });

  container.appendChild(wrapper);

  // Auto-crop viewBox to actual path bounds, then fade in
  requestAnimationFrame(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    visiblePaths.forEach((p) => {
      const b = p.getBBox();
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });
    const pad = 10;
    svg.setAttribute('viewBox',
      `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
    );
    svg.style.opacity = '1';
  });
}

function buildLegend(highlightColor) {
  const legend = document.createElement('div');
  legend.style.cssText = `
    display:flex;align-items:center;gap:12px;justify-content:center;
    padding:6px 0 2px;flex-shrink:0;font-size:10px;font-weight:600;
    font-family:Gilroy,Century Gothic,sans-serif;color:#5A7A8F;
  `;

  // Gradient bar
  const gradientColors = INTENSITY_COLORS.join(', ');
  legend.innerHTML = `
    <span>Low</span>
    <div style="display:flex;align-items:center;gap:6px;">
      <div style="width:120px;height:10px;border-radius:3px;
        background:linear-gradient(to right, ${gradientColors});
        border:1px solid #B8CDD9;"></div>
    </div>
    <span>High</span>
    <div style="width:1px;height:12px;background:#B8CDD9;margin:0 4px;"></div>
    <div style="display:flex;align-items:center;gap:4px;">
      <div style="width:10px;height:10px;border-radius:2px;border:3px solid ${highlightColor};background:transparent;"></div>
      <span>Growth Targets</span>
    </div>
  `;

  return legend;
}
