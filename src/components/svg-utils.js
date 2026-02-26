// SVG Utilities — Shared helpers for SVG chart components

export const NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with attributes */
export function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

/** SVG path for a fully-rounded rectangle */
export function roundRectPath(x, y, w, h, r) {
  if (w <= 0 || h <= 0) return '';
  r = Math.min(r, w / 2, h / 2);
  return [
    `M${x + r},${y}`,
    `L${x + w - r},${y}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `L${x + w},${y + h - r}`,
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
    `L${x + r},${y + h}`,
    `A${r},${r} 0 0 1 ${x},${y + h - r}`,
    `L${x},${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    'Z',
  ].join(' ');
}

/** SVG path for a rectangle with only the top corners rounded */
export function roundRectTopPath(x, y, w, h, r) {
  if (w <= 0 || h <= 0) return '';
  r = Math.min(r, w / 2, h / 2);
  return [
    `M${x},${y + h}`,
    `L${x},${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    `L${x + w - r},${y}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `L${x + w},${y + h}`,
    'Z',
  ].join(' ');
}

/**
 * Prepare an SVG element for chart rendering.
 * Accepts a <canvas> (replaces it), existing <svg> (clears it),
 * or container <div> (appends new svg).
 * Returns { svg, w, h } where w/h are the logical drawing dimensions.
 */
export function prepareSvg(element) {
  let svg, w, h;

  if (element.tagName === 'CANVAS') {
    w = element.clientWidth;
    h = element.clientHeight;
    svg = document.createElementNS(NS, 'svg');
    if (element.id) svg.id = element.id;
    if (element.style.cssText) svg.style.cssText = element.style.cssText;
    element.replaceWith(svg);
  } else if (element.tagName.toLowerCase() === 'svg') {
    svg = element;
    const vb = svg.getAttribute('viewBox');
    if (vb) {
      const parts = vb.split(/\s+/);
      w = parseFloat(parts[2]);
      h = parseFloat(parts[3]);
    } else {
      w = svg.clientWidth;
      h = svg.clientHeight;
    }
    svg.innerHTML = '';
  } else {
    w = element.clientWidth;
    h = element.clientHeight;
    svg = document.createElementNS(NS, 'svg');
    element.appendChild(svg);
  }

  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.style.display = 'block';
  svg.style.overflow = 'visible';

  return { svg, w, h };
}

/** Standard font stack used across all charts */
export const FONT = 'Gilroy, Century Gothic, sans-serif';
