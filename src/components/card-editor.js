// Card Editor — Inline content editing overlay
// Click any card to expand it 1:1 scaled up, edit content, and update in place.

import { createUSMap } from './us-map.js';
import { createVBarChart } from './v-bar-chart.js';
import { createHBarChart } from './h-bar-chart.js';
import { createLineChart } from './line-chart.js';
import { createStackedBarChart, createChartLegend } from './stacked-bar-chart.js';
import { createComboChart, createComboLegend } from './combo-chart.js';
import { createGaugeChart } from './gauge-chart.js';

const CHART_EDITORS = {};

const CARD_SELECTORS = [
  '.observations-panel',
  '.kpi-stack',
  '.icon-kpi-card',
  '.chart-container',
  '.kpi-row',
];

const EDITABLE_TYPES = ['observations-panel', 'kpi-stack', 'icon-kpi-card', 'kpi-row'];

let activeOverlay = null;

const ANIM_SELECTOR = '.anim-bar-h, .anim-bar-v, .anim-col-v, .anim-line, .anim-gauge, .anim-point, .anim-fade';

export function replayAnimations(container) {
  const els = container.querySelectorAll(ANIM_SELECTOR);
  els.forEach(el => { el.style.animation = 'none'; });
  container.offsetHeight;
  els.forEach(el => { el.style.animation = ''; });
  animateKpiValues(container);
}

// ─── KPI Count-Up Animation ─────────────────────────────────────
const KPI_VALUE_SELECTOR = '.kpi-stack__value, .icon-kpi__value, .kpi-box__value';
const KPI_DURATION = 800; // ms — all values finish together

function animateKpiValues(container) {
  const els = container.querySelectorAll(KPI_VALUE_SELECTOR);
  if (!els.length) return;

  // Also animate growth indicators (the percentage changes)
  const growthEls = container.querySelectorAll('.growth-indicator');

  const targets = [];

  els.forEach(el => {
    const parsed = parseKpiText(el.textContent);
    if (parsed) {
      targets.push({ el, ...parsed, isGrowth: false });
      el.textContent = formatKpiValue(0, parsed);
    }
  });

  growthEls.forEach(el => {
    const parsed = parseGrowthText(el.textContent);
    if (parsed) {
      targets.push({ el, ...parsed, isGrowth: true });
      el.textContent = formatGrowthValue(0, parsed);
    }
  });

  if (!targets.length) return;

  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / KPI_DURATION, 1);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    targets.forEach(({ el, value, isGrowth, ...fmt }) => {
      const current = value * ease;
      el.textContent = isGrowth ? formatGrowthValue(current, fmt) : formatKpiValue(current, fmt);
    });
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function parseKpiText(text) {
  text = text.trim();
  const m = text.match(/^(\$?)([\d,.]+)\s*([KMBkmb%]?)$/);
  if (!m) return null;
  const prefix = m[1];
  const numStr = m[2].replace(/,/g, '');
  const value = parseFloat(numStr);
  if (isNaN(value)) return null;
  const suffix = m[3].toUpperCase();
  const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
  return { prefix, value, suffix, decimals };
}

function formatKpiValue(current, { prefix, suffix, decimals }) {
  const num = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString();
  return `${prefix}${num}${suffix}`;
}

function parseGrowthText(text) {
  text = text.trim();
  // textContent is like "▲ +12.3%" or "▼ -5.0%" — arrow char + sign + number + %
  const m = text.match(/^([▲▼]?\s*)([+-]?)([\d,.]+)(%?)$/);
  if (!m) return null;
  const arrow = m[1];
  const sign = m[2];
  const numStr = m[3].replace(/,/g, '');
  const value = parseFloat(numStr);
  if (isNaN(value)) return null;
  const pct = m[4];
  const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
  return { arrow, sign, value, pct, decimals };
}

function formatGrowthValue(current, { arrow, sign, pct, decimals }) {
  const num = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toString();
  return `${arrow}${sign}${num}${pct}`;
}

export function initCardEditor() {
  document.addEventListener('click', handleCardClick);
}

// ─── Click Handler ──────────────────────────────────────────────

function handleCardClick(e) {
  if (activeOverlay) return;
  if (e.target.closest('.card-editor-backdrop')) return;
  if (e.target.closest('.pres-nav, .pres-dots, .viewer-toolbar, .pres-label, .card-editor-close, .card-editor-btn')) return;

  let card = null;
  for (const sel of CARD_SELECTORS) {
    card = e.target.closest(sel);
    if (card) break;
  }
  if (!card) return;

  openOverlay(card);
}

// ─── Card Type Detection ────────────────────────────────────────

function getCardType(el) {
  if (el.classList.contains('observations-panel')) return 'observations-panel';
  if (el.classList.contains('kpi-stack')) return 'kpi-stack';
  if (el.classList.contains('icon-kpi-card')) return 'icon-kpi-card';
  if (el.classList.contains('chart-container')) return 'chart-container';
  if (el.classList.contains('kpi-row')) return 'kpi-row';
  return null;
}

// ─── Overlay Lifecycle ──────────────────────────────────────────

function openOverlay(originalCard) {
  const cardType = getCardType(originalCard);

  // Measure the card's natural layout dimensions (unaffected by parent CSS transforms)
  const cardW = originalCard.offsetWidth;
  const cardH = originalCard.offsetHeight;

  // Calculate scale to fill ~85% of viewport while preserving aspect ratio
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  // Larger cards fill more of the viewport; small cards expand moderately
  const maxDim = Math.max(cardW, cardH);
  const dynamicMax = 2.5 + Math.min(maxDim, 400) / 150;
  const scale = Math.min(vpW * 0.85 / cardW, vpH * 0.85 / cardH, dynamicMax);

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'card-editor-backdrop';

  // Panel — sized to the SCALED card dimensions so flexbox centering works
  const panel = document.createElement('div');
  panel.className = 'card-editor-panel';
  panel.style.width = Math.round(cardW * scale) + 'px';
  panel.style.height = Math.round(cardH * scale) + 'px';

  // Clone at original natural size, then zoom up (zoom renders SVG crisp, unlike transform: scale)
  const clone = originalCard.cloneNode(true);
  clone.style.width = cardW + 'px';
  clone.style.height = cardH + 'px';
  clone.style.position = 'absolute';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.zoom = scale;
  clone.style.flex = 'none';
  clone.style.minHeight = '0';
  clone.style.boxShadow = 'none';

  panel.appendChild(clone);

  // Re-init map hover tooltips on clone (cloneNode strips JS listeners)
  if (clone.querySelector('path[data-tooltip]')) {
    initClonedMapTooltips(panel);
  }

  // If no section-header exists but card has data-label, create one for the overlay
  let header = clone.querySelector('.section-header');
  const dataLabel = clone.getAttribute('data-label');
  if (!header && dataLabel) {
    header = document.createElement('div');
    header.className = 'section-header';
    header.textContent = dataLabel;
    header.style.borderRadius = '0';
    // Wrap existing children in a sub-row so kpi-boxes stay horizontal
    const subRow = document.createElement('div');
    subRow.style.cssText = 'display:flex;gap:var(--gap-sm);';
    while (clone.firstChild) subRow.appendChild(clone.firstChild);
    clone.appendChild(header);
    clone.appendChild(subRow);
    // Stack header + sub-row vertically, clip to card shape
    clone.style.overflow = 'hidden';
    clone.style.borderRadius = 'var(--radius)';
    clone.style.flexDirection = 'column';
    clone.style.background = '#fff';
    // Auto-size clone height to fit header + content, then update panel
    clone.style.height = 'auto';
    requestAnimationFrame(() => {
      const newH = clone.scrollHeight;
      clone.style.height = newH + 'px';
      panel.style.height = Math.round(newH * scale) + 'px';
    });
  }

  // Contract label — appended inside the section header (global editor only)
  const geRow = originalCard.closest('.ge-row');
  if (geRow) {
    const contractLabel = geRow.getAttribute('data-contract-label');
    if (contractLabel && header) {
      const tag = document.createElement('span');
      tag.className = 'card-editor-label';
      tag.textContent = contractLabel;
      header.appendChild(tag);
    }
  }

  // Close button — on the panel (not scaled), top-right corner
  const closeBtn = document.createElement('button');
  closeBtn.className = 'card-editor-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', closeOverlay);
  panel.appendChild(closeBtn);

  // Edit button — for editable card types and chart types with registered editors
  const chartType = clone.getAttribute('data-chart-type');
  const canEdit = EDITABLE_TYPES.includes(cardType) || (chartType && CHART_EDITORS[chartType]);
  if (canEdit) {
    const editBtn = document.createElement('button');
    editBtn.className = 'card-editor-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      if (editBtn.textContent === 'Edit') {
        enterEditMode(editBtn, clone, cardType, chartType, originalCard);
      } else {
        exitEditMode(editBtn, clone, originalCard, cardType, chartType);
      }
    });
    panel.appendChild(editBtn);
  }

  // Replay button — for any card containing chart animations
  if (clone.querySelector(ANIM_SELECTOR)) {
    const replayBtn = document.createElement('button');
    replayBtn.className = 'card-editor-replay';
    replayBtn.innerHTML = `<svg viewBox="0 0 16 16"><path d="M1.5 1.5v5h5"/><path d="M3.5 10.5a6 6 0 1 0 1.3-6.6L1.5 6.5"/></svg>`;
    replayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      replayAnimations(clone);
    });
    panel.appendChild(replayBtn);
  }

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  activeOverlay = backdrop;
  document.body.style.overflow = 'hidden';

  // Animate KPI values from zero
  animateKpiValues(clone);

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeOverlay();
  });

  // Capture-phase key handler blocks presentation nav while overlay is open
  document.addEventListener('keydown', overlayKeyHandler, true);
}

function overlayKeyHandler(e) {
  if (!activeOverlay) return;
  if (e.key === 'Escape') {
    closeOverlay();
    e.preventDefault();
    e.stopImmediatePropagation();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    // Block presentation arrow-key navigation while overlay is open
    e.stopImmediatePropagation();
  }
}

function closeOverlay() {
  if (!activeOverlay) return;
  activeOverlay.remove();
  activeOverlay = null;
  document.body.style.overflow = '';
  document.removeEventListener('keydown', overlayKeyHandler, true);
}

// ─── Edit / Done Toggle ─────────────────────────────────────────

function enterEditMode(btn, clone, cardType, chartType, originalCard) {
  btn.textContent = 'Done';

  // Save original dimensions and zoom for restore
  clone._savedWidth = clone.style.width;
  clone._savedHeight = clone.style.height;
  clone._savedZoom = clone.style.zoom;

  if (chartType && CHART_EDITORS[chartType]) {
    CHART_EDITORS[chartType].editForm(clone, originalCard);
    resizeOverlayForEdit(clone);
    return;
  }

  switch (cardType) {
    case 'observations-panel': editObservations(clone); break;
    case 'kpi-stack': editKpiStack(clone); break;
    case 'icon-kpi-card': editIconKpi(clone); break;
    case 'kpi-row': editKpiRow(clone); break;
  }

  resizeOverlayForEdit(clone);
}

function exitEditMode(btn, clone, originalCard, cardType, chartType) {
  btn.textContent = 'Edit';

  if (chartType && CHART_EDITORS[chartType]) {
    CHART_EDITORS[chartType].apply(clone, originalCard);
    restoreOverlaySize(clone);
    return;
  }

  switch (cardType) {
    case 'observations-panel': applyObservations(clone, originalCard); break;
    case 'kpi-stack': applyKpiStack(clone, originalCard); break;
    case 'icon-kpi-card': applyIconKpi(clone, originalCard); break;
    case 'kpi-row': applyKpiRow(clone, originalCard); break;
  }

  restoreOverlaySize(clone);
}

/**
 * After edit form is inserted, rescale the overlay so the form content fits.
 * For wide/short cards, reduces zoom so the edit form gets more vertical space.
 */
function resizeOverlayForEdit(clone) {
  const panel = clone.parentElement;

  // Let clone grow to natural content height
  clone.style.height = 'auto';

  requestAnimationFrame(() => {
    const contentH = clone.scrollHeight;
    const contentW = parseInt(clone.style.width);
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    // Recalculate scale to fit the new (wider, taller) content within 85% viewport
    const editScale = Math.min(vpW * 0.85 / contentW, vpH * 0.85 / contentH);

    clone.style.zoom = editScale;
    clone.style.height = contentH + 'px';
    clone.style.overflowY = '';

    panel.style.width = Math.round(contentW * editScale) + 'px';
    panel.style.height = Math.round(contentH * editScale) + 'px';
  });
}

/** Restore clone and panel to original dimensions after exiting edit mode. */
function restoreOverlaySize(clone) {
  const panel = clone.parentElement;
  const origZoom = clone._savedZoom;
  const origW = clone._savedWidth;
  const scale = parseFloat(origZoom) || 1;

  clone.style.zoom = origZoom;
  clone.style.overflowY = '';
  clone.style.width = origW;
  panel.style.width = Math.round(parseFloat(origW) * scale) + 'px';

  // Auto-size height to fit restored content (may differ from original if header was injected)
  clone.style.height = 'auto';
  requestAnimationFrame(() => {
    const h = clone.scrollHeight;
    clone.style.height = h + 'px';
    panel.style.height = Math.round(h * scale) + 'px';
  });
}

// ─── Observations Panel ─────────────────────────────────────────

function editObservations(clone) {
  const body = clone.querySelector('.observations-panel__body');
  if (!body) return;

  const ul = body.querySelector('ul');
  if (!ul) return;

  const items = Array.from(ul.querySelectorAll('li')).map(li => li.textContent);

  const textarea = document.createElement('textarea');
  textarea.className = 'card-editor-textarea';
  textarea.value = items.join('\n');

  // Replace only the <ul>, preserving any other content (e.g. mini-KPIs)
  ul.replaceWith(textarea);
  textarea.focus();
}

function applyObservations(clone, originalCard) {
  const body = clone.querySelector('.observations-panel__body');
  if (!body) return;

  const textarea = body.querySelector('.card-editor-textarea');
  if (!textarea) return;

  const lines = textarea.value.split('\n').filter(l => l.trim());

  const ul = document.createElement('ul');
  lines.forEach(line => {
    const li = document.createElement('li');
    li.textContent = line.trim();
    ul.appendChild(li);
  });

  // Update clone
  textarea.replaceWith(ul);

  // Update original
  const origUl = originalCard.querySelector('.observations-panel__body ul');
  if (origUl) {
    origUl.replaceWith(ul.cloneNode(true));
  }
}

// ─── KPI Stack ──────────────────────────────────────────────────

function editKpiStack(clone) {
  const body = clone.querySelector('.kpi-stack__body');
  if (!body) return;

  body._savedHTML = body.innerHTML;

  const groups = body.querySelectorAll('.kpi-stack__group');
  const form = document.createElement('div');
  form.className = 'card-editor-form';

  groups.forEach((group, gi) => {
    const label = group.querySelector('.kpi-stack__group-label');
    if (label) {
      const heading = document.createElement('div');
      heading.className = 'card-editor-form__heading';
      heading.textContent = label.textContent;
      form.appendChild(heading);
    }

    const values = group.querySelectorAll('.kpi-stack__value');
    values.forEach((val, vi) => {
      const field = document.createElement('div');
      field.className = 'card-editor-form__field';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'card-editor-input';
      input.value = val.textContent.trim();
      input.dataset.group = gi;
      input.dataset.index = vi;

      field.appendChild(input);
      form.appendChild(field);
    });
  });

  body.innerHTML = '';
  body.appendChild(form);

  const first = form.querySelector('.card-editor-input');
  if (first) first.focus();
}

function applyKpiStack(clone, originalCard) {
  const body = clone.querySelector('.kpi-stack__body');
  if (!body) return;

  // Collect edited values
  const edits = Array.from(body.querySelectorAll('.card-editor-input')).map(input => ({
    group: parseInt(input.dataset.group),
    index: parseInt(input.dataset.index),
    value: input.value,
  }));

  // Restore clone structure
  body.innerHTML = body._savedHTML;

  // Apply edits to clone
  const groups = body.querySelectorAll('.kpi-stack__group');
  edits.forEach(({ group, index, value }) => {
    const g = groups[group];
    if (g) {
      const vals = g.querySelectorAll('.kpi-stack__value');
      if (vals[index]) vals[index].textContent = value;
    }
  });

  // Apply edits to original
  const origGroups = originalCard.querySelectorAll('.kpi-stack__group');
  edits.forEach(({ group, index, value }) => {
    const g = origGroups[group];
    if (g) {
      const vals = g.querySelectorAll('.kpi-stack__value');
      if (vals[index]) vals[index].textContent = value;
    }
  });
}

// ─── Icon KPI Card ──────────────────────────────────────────────

function editIconKpi(clone) {
  const body = clone.querySelector('.icon-kpi-card__body');
  if (!body) return;

  body._savedHTML = body.innerHTML;

  const kpis = body.querySelectorAll('.icon-kpi');
  const form = document.createElement('div');
  form.className = 'card-editor-form';

  kpis.forEach((kpi, i) => {
    const label = kpi.querySelector('.icon-kpi__label');
    const value = kpi.querySelector('.icon-kpi__value');

    const heading = document.createElement('div');
    heading.className = 'card-editor-form__heading';
    heading.textContent = label ? label.textContent : `KPI ${i + 1}`;
    form.appendChild(heading);

    const field = document.createElement('div');
    field.className = 'card-editor-form__field';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'card-editor-input';
    input.value = value ? value.textContent.trim() : '';
    input.dataset.index = i;

    field.appendChild(input);
    form.appendChild(field);
  });

  body.innerHTML = '';
  body.appendChild(form);

  const first = form.querySelector('.card-editor-input');
  if (first) first.focus();
}

function applyIconKpi(clone, originalCard) {
  const body = clone.querySelector('.icon-kpi-card__body');
  if (!body) return;

  const edits = Array.from(body.querySelectorAll('.card-editor-input')).map(input => ({
    index: parseInt(input.dataset.index),
    value: input.value,
  }));

  // Restore clone
  body.innerHTML = body._savedHTML;

  // Update clone
  const kpis = body.querySelectorAll('.icon-kpi');
  edits.forEach(({ index, value }) => {
    const kpi = kpis[index];
    if (kpi) {
      const val = kpi.querySelector('.icon-kpi__value');
      if (val) val.textContent = value;
    }
  });

  // Update original
  const origKpis = originalCard.querySelectorAll('.icon-kpi');
  edits.forEach(({ index, value }) => {
    const kpi = origKpis[index];
    if (kpi) {
      const val = kpi.querySelector('.icon-kpi__value');
      if (val) val.textContent = value;
    }
  });
}

// ─── KPI Row (box row) ──────────────────────────────────────────

function editKpiRow(clone) {
  clone._savedHTML = clone.innerHTML;

  const boxes = clone.querySelectorAll('.kpi-box');
  const form = document.createElement('div');
  form.className = 'card-editor-form';

  boxes.forEach((box, i) => {
    const label = box.querySelector('.kpi-box__label');
    const value = box.querySelector('.kpi-box__value');

    const heading = document.createElement('div');
    heading.className = 'card-editor-form__heading';
    heading.textContent = label ? label.textContent : `Box ${i + 1}`;
    form.appendChild(heading);

    const field = document.createElement('div');
    field.className = 'card-editor-form__field';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'card-editor-input';
    input.value = value ? value.textContent.trim() : '';
    input.dataset.index = i;

    field.appendChild(input);
    form.appendChild(field);
  });

  // Preserve section-header (overlay-injected label) if present
  const header = clone.querySelector('.section-header');
  clone.innerHTML = '';
  // Switch to vertical layout for the edit form
  clone.style.flexDirection = 'column';
  clone.style.background = '#fff';
  if (header) clone.appendChild(header);
  clone.appendChild(form);

  const first = form.querySelector('.card-editor-input');
  if (first) first.focus();
}

function applyKpiRow(clone, originalCard) {
  const edits = Array.from(clone.querySelectorAll('.card-editor-input')).map(input => ({
    index: parseInt(input.dataset.index),
    value: input.value,
  }));

  // Restore clone — _savedHTML was captured after openOverlay injected
  // the header + sub-row wrapper, so it already has the correct structure
  clone.innerHTML = clone._savedHTML;

  // Update clone
  const boxes = clone.querySelectorAll('.kpi-box');
  edits.forEach(({ index, value }) => {
    const box = boxes[index];
    if (box) {
      const val = box.querySelector('.kpi-box__value');
      if (val) val.textContent = value;
    }
  });

  // Update original
  const origBoxes = originalCard.querySelectorAll('.kpi-box');
  edits.forEach(({ index, value }) => {
    const box = origBoxes[index];
    if (box) {
      const val = box.querySelector('.kpi-box__value');
      if (val) val.textContent = value;
    }
  });
}

// ─── Chart Editor: US Map ────────────────────────────────────────

CHART_EDITORS['us-map'] = {
  editForm(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;
    body._savedHTML = body.innerHTML;

    // Read current data from attributes (fallback to original if clone missing)
    const srcJson = clone.getAttribute('data-chart-src') || originalCard.getAttribute('data-chart-src');
    const stateData = srcJson ? JSON.parse(srcJson) : {};

    // Sort states by TIV descending
    const sorted = Object.entries(stateData)
      .map(([st, tiv]) => ({ state: st, tiv }))
      .sort((a, b) => b.tiv - a.tiv);

    // Build edit form
    const form = document.createElement('div');
    form.className = 'card-editor-form';
    form.style.overflow = 'auto';
    form.style.flex = '1';

    if (sorted.length) {
      const heading = document.createElement('div');
      heading.className = 'card-editor-form__heading';
      heading.textContent = 'Current State Data';
      form.appendChild(heading);
      form.appendChild(buildCurrentDataTable(
        ['State', 'TIV ($M)'],
        sorted.map(s => [s.state, s.tiv.toFixed(1)])
      ));
    }

    // Paste area
    const pasteHeading = document.createElement('div');
    pasteHeading.className = 'card-editor-form__heading';
    pasteHeading.textContent = 'Paste New Data';
    form.appendChild(pasteHeading);

    const textarea = document.createElement('textarea');
    textarea.className = 'card-editor-textarea';
    textarea.placeholder = 'TX\t677.6\nCA\t500.0\nFL\t320.5';
    textarea.style.minHeight = '60px';
    form.appendChild(textarea);

    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;line-height:1.4;margin-top:4px;';
    note.textContent = 'Paste state data as two columns: State Code [tab] TIV (in millions). One state per line. Comma-separated also accepted.';
    form.appendChild(note);

    // Growth Target States (universal — highlighted orange on map)
    const highlightJson = clone.getAttribute('data-chart-highlight') || originalCard.getAttribute('data-chart-highlight');
    const currentHighlight = highlightJson ? JSON.parse(highlightJson) : [];

    const growthHeading = document.createElement('div');
    growthHeading.className = 'card-editor-form__heading';
    growthHeading.textContent = 'Growth Target States';
    form.appendChild(growthHeading);

    const growthField = document.createElement('div');
    growthField.className = 'card-editor-form__field';
    const growthInput = document.createElement('input');
    growthInput.type = 'text';
    growthInput.className = 'card-editor-input';
    growthInput.id = 'growth-targets-input';
    growthInput.value = currentHighlight.join(', ');
    growthInput.placeholder = 'TX, FL, CA';
    growthField.appendChild(growthInput);
    form.appendChild(growthField);

    const growthNote = document.createElement('div');
    growthNote.style.cssText = 'font-size:9px;color:#666;line-height:1.4;margin-top:4px;';
    growthNote.textContent = 'Comma-separated state codes. These states are highlighted orange on all contract maps.';
    form.appendChild(growthNote);

    body.innerHTML = '';
    body.appendChild(form);
    textarea.focus();
  },

  apply(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;

    const textarea = body.querySelector('.card-editor-textarea');
    const pastedText = textarea ? textarea.value.trim() : '';

    // Read growth targets BEFORE restoring HTML (form gets destroyed)
    const growthInput = clone.querySelector('#growth-targets-input');
    const growthValue = growthInput ? growthInput.value.trim() : '';

    // Restore clone body
    if (body._savedHTML) {
      body.innerHTML = body._savedHTML;
    }

    if (!pastedText) return;

    // Parse pasted data: tab or comma separated
    const newData = {};
    const lines = pastedText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[\t,]+/);
      if (parts.length >= 2) {
        const state = parts[0].trim().toUpperCase();
        const tiv = parseFloat(parts[1].trim());
        if (state.length === 2 && !isNaN(tiv)) {
          newData[state] = tiv;
        }
      }
    }

    if (Object.keys(newData).length === 0) return;

    // Use growth targets from the manual input field (or fall back to top 3 by TIV)
    let topStates;
    if (growthValue) {
      topStates = growthValue.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    } else {
      topStates = Object.entries(newData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => e[0]);
    }

    // Re-render original map
    const origMap = originalCard.querySelector('#chart-us-map');
    if (origMap) {
      origMap.innerHTML = '';
      createUSMap(origMap, newData, { highlightStates: topStates });
    }

    // Update data attributes on original
    originalCard.setAttribute('data-chart-src', JSON.stringify(newData));
    originalCard.setAttribute('data-chart-highlight', JSON.stringify(topStates));
  },
};

// ─── Chart Editor: Vertical Bar ─────────────────────────────────

CHART_EDITORS['v-bar'] = {
  editForm(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;
    body._savedHTML = body.innerHTML;

    const srcJson = clone.getAttribute('data-chart-src') || originalCard.getAttribute('data-chart-src');
    const data = srcJson ? JSON.parse(srcJson) : [];
    const suffix = clone.getAttribute('data-chart-suffix') || '';

    const form = document.createElement('div');
    form.className = 'card-editor-form';
    form.style.overflow = 'auto';
    form.style.flex = '1';

    if (data.length) {
      const heading = document.createElement('div');
      heading.className = 'card-editor-form__heading';
      heading.textContent = 'Current Data';
      form.appendChild(heading);
      form.appendChild(buildCurrentDataTable(
        ['Label', 'Value'],
        data.map(d => [d.label, String(d.value)])
      ));
    }

    // Paste area
    const pasteHeading = document.createElement('div');
    pasteHeading.className = 'card-editor-form__heading';
    pasteHeading.textContent = 'Paste New Data';
    form.appendChild(pasteHeading);

    const textarea = document.createElement('textarea');
    textarea.className = 'card-editor-textarea';
    textarea.placeholder = '2021\t32\n2022\t41\n2023\t22';
    textarea.style.minHeight = '60px';
    form.appendChild(textarea);

    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;line-height:1.4;margin-top:4px;';
    note.textContent = 'Paste data as two columns: Label [tab] Value. One row per line. Comma-separated also accepted.';
    form.appendChild(note);

    body.innerHTML = '';
    body.appendChild(form);
    textarea.focus();
  },

  apply(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;

    const textarea = body.querySelector('.card-editor-textarea:not([readonly])');
    const pastedText = textarea ? textarea.value.trim() : '';

    if (body._savedHTML) {
      body.innerHTML = body._savedHTML;
    }

    if (!pastedText) return;

    const newData = [];
    const lines = pastedText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[\t,]+/);
      if (parts.length >= 2) {
        const label = parts[0].trim();
        const value = parseFloat(parts[1].trim());
        if (label && !isNaN(value)) {
          newData.push({ label, value });
        }
      }
    }

    if (newData.length === 0) return;

    const suffix = originalCard.getAttribute('data-chart-suffix') || '';
    const canvas = originalCard.querySelector('canvas');
    if (canvas) {
      createVBarChart(canvas, newData, {
        valueFormatter: (v) => v + suffix,
      });
    }

    originalCard.setAttribute('data-chart-src', JSON.stringify(newData));
  },
};

// ─── Chart Editor: Horizontal Bar ───────────────────────────────

CHART_EDITORS['h-bar'] = {
  editForm(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;
    body._savedHTML = body.innerHTML;

    const srcJson = clone.getAttribute('data-chart-src') || originalCard.getAttribute('data-chart-src');
    const data = srcJson ? JSON.parse(srcJson) : [];

    const form = document.createElement('div');
    form.className = 'card-editor-form';
    form.style.overflow = 'auto';
    form.style.flex = '1';

    if (data.length) {
      const heading = document.createElement('div');
      heading.className = 'card-editor-form__heading';
      heading.textContent = 'Current Data';
      form.appendChild(heading);
      form.appendChild(buildCurrentDataTable(
        ['Label', 'Value'],
        data.map(d => [d.label, String(d.value)])
      ));
    }

    const pasteHeading = document.createElement('div');
    pasteHeading.className = 'card-editor-form__heading';
    pasteHeading.textContent = 'Paste New Data';
    form.appendChild(pasteHeading);

    const textarea = document.createElement('textarea');
    textarea.className = 'card-editor-textarea';
    textarea.placeholder = 'Fire\t3.70\nWind/Hail\t2.54';
    textarea.style.minHeight = '60px';
    form.appendChild(textarea);

    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;line-height:1.4;margin-top:4px;';
    note.textContent = 'Paste data as two columns: Label [tab] Value. One row per line. Comma-separated also accepted.';
    form.appendChild(note);

    body.innerHTML = '';
    body.appendChild(form);
    textarea.focus();
  },

  apply(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;

    const textarea = body.querySelector('.card-editor-textarea:not([readonly])');
    const pastedText = textarea ? textarea.value.trim() : '';

    if (body._savedHTML) body.innerHTML = body._savedHTML;
    if (!pastedText) return;

    const newData = parseLabelValue(pastedText);
    if (newData.length === 0) return;

    const opts = getChartOptions(originalCard);
    opts.valueFormatter = buildFormatter(originalCard);
    const svg = originalCard.querySelector('svg') || originalCard.querySelector('canvas');
    if (svg) createHBarChart(svg, newData, opts);

    originalCard.setAttribute('data-chart-src', JSON.stringify(newData));
  },
};

// ─── Chart Editor: Line Chart ───────────────────────────────────

CHART_EDITORS['line'] = {
  editForm(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;
    body._savedHTML = body.innerHTML;

    const srcJson = clone.getAttribute('data-chart-src') || originalCard.getAttribute('data-chart-src');
    const data = srcJson ? JSON.parse(srcJson) : [];

    const form = document.createElement('div');
    form.className = 'card-editor-form';
    form.style.overflow = 'auto';
    form.style.flex = '1';

    if (data.length) {
      const heading = document.createElement('div');
      heading.className = 'card-editor-form__heading';
      heading.textContent = 'Current Data';
      form.appendChild(heading);
      form.appendChild(buildCurrentDataTable(
        ['Label', 'Value'],
        data.map(d => [d.label, String(d.value)])
      ));
    }

    const pasteHeading = document.createElement('div');
    pasteHeading.className = 'card-editor-form__heading';
    pasteHeading.textContent = 'Paste New Data';
    form.appendChild(pasteHeading);

    const textarea = document.createElement('textarea');
    textarea.className = 'card-editor-textarea';
    textarea.placeholder = 'Q1 \'25\t0.45\nQ2 \'25\t0.50';
    textarea.style.minHeight = '60px';
    form.appendChild(textarea);

    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;line-height:1.4;margin-top:4px;';
    note.textContent = 'Paste data as two columns: Label [tab] Value. One row per line. Comma-separated also accepted.';
    form.appendChild(note);

    body.innerHTML = '';
    body.appendChild(form);
    textarea.focus();
  },

  apply(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;

    const textarea = body.querySelector('.card-editor-textarea:not([readonly])');
    const pastedText = textarea ? textarea.value.trim() : '';

    if (body._savedHTML) body.innerHTML = body._savedHTML;
    if (!pastedText) return;

    const newData = parseLabelValue(pastedText);
    if (newData.length === 0) return;

    const formatter = buildFormatter(originalCard);
    const svg = originalCard.querySelector('svg') || originalCard.querySelector('canvas');
    if (svg) createLineChart(svg, newData, { valueFormatter: formatter });

    originalCard.setAttribute('data-chart-src', JSON.stringify(newData));
  },
};

// ─── Chart Editor: Stacked Bar ──────────────────────────────────

CHART_EDITORS['stacked-bar'] = {
  editForm(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;
    body._savedHTML = body.innerHTML;

    const srcJson = clone.getAttribute('data-chart-src') || originalCard.getAttribute('data-chart-src');
    const data = srcJson ? JSON.parse(srcJson) : [];
    const tiersJson = clone.getAttribute('data-chart-tiers') || originalCard.getAttribute('data-chart-tiers');
    const tiers = tiersJson ? JSON.parse(tiersJson) : [];

    const form = document.createElement('div');
    form.className = 'card-editor-form';
    form.style.overflow = 'auto';
    form.style.flex = '1';

    if (data.length) {
      const heading = document.createElement('div');
      heading.className = 'card-editor-form__heading';
      heading.textContent = 'Current Data';
      form.appendChild(heading);
      form.appendChild(buildCurrentDataTable(
        ['Quarter', ...tiers],
        data.map(d => [d.label, ...d.segments.map(String)])
      ));
    }

    const pasteHeading = document.createElement('div');
    pasteHeading.className = 'card-editor-form__heading';
    pasteHeading.textContent = 'Paste New Data';
    form.appendChild(pasteHeading);

    const textarea = document.createElement('textarea');
    textarea.className = 'card-editor-textarea';
    textarea.placeholder = "'24 Q2\t0\t9\t67\t24\t0";
    textarea.style.minHeight = '60px';
    form.appendChild(textarea);

    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;line-height:1.4;margin-top:4px;';
    note.textContent = 'Paste data as: Quarter [tab] Tier1% [tab] Tier2% ... One row per quarter. Tab or comma separated.';
    form.appendChild(note);

    body.innerHTML = '';
    body.appendChild(form);
    textarea.focus();
  },

  apply(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;

    const textarea = body.querySelector('.card-editor-textarea:not([readonly])');
    const pastedText = textarea ? textarea.value.trim() : '';

    if (body._savedHTML) body.innerHTML = body._savedHTML;
    if (!pastedText) return;

    const newData = [];
    for (const line of pastedText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[\t,]+/);
      if (parts.length >= 2) {
        const label = parts[0].trim();
        const segments = parts.slice(1).map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
        if (label && segments.length) newData.push({ label, segments });
      }
    }

    if (newData.length === 0) return;

    const tierColors = ['#C5DCE8', '#8FBAD2', '#5A98B8', '#2E7BA0', '#0A5383'];
    const svg = originalCard.querySelector('svg') || originalCard.querySelector('canvas');
    if (svg) createStackedBarChart(svg, newData, { tierColors });

    originalCard.setAttribute('data-chart-src', JSON.stringify(newData));
  },
};

// ─── Chart Editor: Combo (Grouped Bars + Line) ──────────────────

CHART_EDITORS['combo'] = {
  editForm(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;
    body._savedHTML = body.innerHTML;

    const srcJson = clone.getAttribute('data-chart-src') || originalCard.getAttribute('data-chart-src');
    const data = srcJson ? JSON.parse(srcJson) : [];
    const legendJson = clone.getAttribute('data-chart-legend') || originalCard.getAttribute('data-chart-legend');
    const legend = legendJson ? JSON.parse(legendJson) : [];

    const barLabels = legend.filter(l => l.type === 'bar').map(l => l.label);
    const lineLabel = (legend.find(l => l.type === 'line') || {}).label || 'Line';

    const form = document.createElement('div');
    form.className = 'card-editor-form';
    form.style.overflow = 'auto';
    form.style.flex = '1';

    if (data.length) {
      const heading = document.createElement('div');
      heading.className = 'card-editor-form__heading';
      heading.textContent = 'Current Data';
      form.appendChild(heading);
      form.appendChild(buildCurrentDataTable(
        ['Label', ...barLabels, lineLabel],
        data.map(d => [d.label, ...d.bars.map(String), String(d.line)])
      ));
    }

    const pasteHeading = document.createElement('div');
    pasteHeading.className = 'card-editor-form__heading';
    pasteHeading.textContent = 'Paste New Data';
    form.appendChild(pasteHeading);

    const textarea = document.createElement('textarea');
    textarea.className = 'card-editor-textarea';
    textarea.placeholder = "Q1 '25\t120\t45\t37.5";
    textarea.style.minHeight = '60px';
    form.appendChild(textarea);

    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:#666;line-height:1.4;margin-top:4px;';
    note.textContent = 'Paste data as: Label [tab] Bar1 [tab] Bar2 [tab] Line%. One row per period. Tab or comma separated.';
    form.appendChild(note);

    body.innerHTML = '';
    body.appendChild(form);
    textarea.focus();
  },

  apply(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;

    const textarea = body.querySelector('.card-editor-textarea:not([readonly])');
    const pastedText = textarea ? textarea.value.trim() : '';

    if (body._savedHTML) body.innerHTML = body._savedHTML;
    if (!pastedText) return;

    const newData = [];
    for (const line of pastedText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[\t,]+/);
      if (parts.length >= 3) {
        const label = parts[0].trim();
        const vals = parts.slice(1).map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
        if (label && vals.length >= 2) {
          const lineVal = vals.pop();
          newData.push({ label, bars: vals, line: lineVal });
        }
      }
    }

    if (newData.length === 0) return;

    // Derive chart options from legend config
    const legendJson = originalCard.getAttribute('data-chart-legend');
    const legendItems = legendJson ? JSON.parse(legendJson) : [];
    const barColors = legendItems.filter(l => l.type === 'bar').map(l => l.color);
    const lineItem = legendItems.find(l => l.type === 'line');
    const isSqb = barColors.length >= 3;

    const chartOpts = {
      showLineValues: !isSqb,
      showBarValues: false,
      lineValueFormatter: (v) => v.toFixed(1) + '%',
    };
    if (barColors.length) chartOpts.barColors = barColors;
    if (lineItem) chartOpts.lineColor = lineItem.color;
    if (isSqb) {
      chartOpts.paddingBottom = 28;
      chartOpts.paddingTop = 16;
      chartOpts.paddingSide = 20;
    }

    const canvas = originalCard.querySelector('canvas');
    if (canvas) {
      createComboChart(canvas, newData, chartOpts);
    }

    // Re-render legend from stored legend config
    if (legendItems.length) {
      const legendContainer = originalCard.querySelector('[id^="legend-"], .sqb-legend');
      if (legendContainer) {
        legendContainer.innerHTML = '';
        legendContainer.appendChild(createComboLegend(legendItems));
      }
    }

    originalCard.setAttribute('data-chart-src', JSON.stringify(newData));
  },
};

// ─── Chart Editor: Gauge ─────────────────────────────────────────

CHART_EDITORS['gauge'] = {
  editForm(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;
    body._savedHTML = body.innerHTML;

    const srcJson = clone.getAttribute('data-chart-src') || originalCard.getAttribute('data-chart-src');
    const data = srcJson ? JSON.parse(srcJson) : {};

    const form = document.createElement('div');
    form.className = 'card-editor-form';

    const fields = [
      { key: 'currentValue', label: 'Current Value', value: data.currentValue ?? '' },
      { key: 'maxValue', label: 'Max Value', value: data.maxValue ?? '' },
      { key: 'unit', label: 'Unit', value: data.unit ?? '' },
      { key: 'label', label: 'Label', value: data.label ?? '' },
    ];

    fields.forEach(({ key, label, value }) => {
      const heading = document.createElement('div');
      heading.className = 'card-editor-form__heading';
      heading.textContent = label;
      form.appendChild(heading);

      const field = document.createElement('div');
      field.className = 'card-editor-form__field';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'card-editor-input';
      input.value = value;
      input.dataset.key = key;
      field.appendChild(input);
      form.appendChild(field);
    });

    body.innerHTML = '';
    body.appendChild(form);

    const first = form.querySelector('.card-editor-input');
    if (first) first.focus();
  },

  apply(clone, originalCard) {
    const body = clone.querySelector('.chart-container__body');
    if (!body) return;

    const inputs = body.querySelectorAll('.card-editor-input');
    const newData = {};
    inputs.forEach(input => {
      const key = input.dataset.key;
      const val = input.value.trim();
      if (key === 'currentValue' || key === 'maxValue') {
        newData[key] = parseFloat(val) || 0;
      } else {
        newData[key] = val;
      }
    });

    if (body._savedHTML) body.innerHTML = body._savedHTML;

    if (newData.currentValue != null && newData.maxValue) {
      const canvas = originalCard.querySelector('canvas');
      if (canvas) {
        createGaugeChart(canvas, newData);
      }
      originalCard.setAttribute('data-chart-src', JSON.stringify(newData));
    }
  },
};

// ─── Chart Editor Helpers ───────────────────────────────────────

/**
 * Build an HTML table for the "Current Data" display in chart editors.
 * Copies into Excel as tab-separated cells natively.
 * @param {string[]} headers — column names
 * @param {string[][]} rows — array of row arrays (each cell as string)
 */
function buildCurrentDataTable(headers, rows) {
  const wrap = document.createElement('div');
  wrap.className = 'card-editor-table-wrap';

  const table = document.createElement('table');
  table.className = 'card-editor-table';

  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach(row => {
    const r = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      r.appendChild(td);
    });
    tbody.appendChild(r);
  });
  table.appendChild(tbody);

  wrap.appendChild(table);
  return wrap;
}

function parseLabelValue(text) {
  const data = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[\t,]+/);
    if (parts.length >= 2) {
      const label = parts[0].trim();
      const value = parseFloat(parts[1].trim());
      if (label && !isNaN(value)) data.push({ label, value });
    }
  }
  return data;
}

function buildFormatter(el) {
  const prefix = el.getAttribute('data-chart-prefix') || '';
  const suffix = el.getAttribute('data-chart-suffix') || '';
  const decStr = el.getAttribute('data-chart-decimals');
  const dec = decStr !== null ? parseInt(decStr) : null;
  return (v) => prefix + (dec !== null ? v.toFixed(dec) : v) + suffix;
}

function getChartOptions(el) {
  const str = el.getAttribute('data-chart-options');
  return str ? JSON.parse(str) : {};
}

// Tooltip hover for cloned map cards — lives on the panel (unscaled)
function initClonedMapTooltips(panel) {
  const tip = document.createElement('div');
  tip.style.cssText = `
    position:absolute;pointer-events:none;opacity:0;
    background:#0A5383;color:#fff;padding:8px 16px;border-radius:6px;
    font-size:22px;font-weight:600;font-family:Gilroy,Century Gothic,sans-serif;
    white-space:nowrap;z-index:20;box-shadow:0 2px 6px rgba(0,0,0,0.2);
    transition:opacity 0.15s;
  `;
  panel.style.position = 'relative';
  panel.appendChild(tip);

  panel.addEventListener('mouseover', (e) => {
    const path = e.target.closest('path[data-tooltip]');
    if (!path) return;
    tip.textContent = path.getAttribute('data-tooltip');
    tip.style.opacity = '1';
  });

  panel.addEventListener('mousemove', (e) => {
    const path = e.target.closest('path[data-tooltip]');
    if (!path) return;
    const rect = panel.getBoundingClientRect();
    tip.style.left = (e.clientX - rect.left + 12) + 'px';
    tip.style.top = (e.clientY - rect.top - 28) + 'px';
  });

  panel.addEventListener('mouseout', (e) => {
    const path = e.target.closest('path[data-tooltip]');
    if (!path) return;
    if (!path.contains(e.relatedTarget)) {
      tip.style.opacity = '0';
    }
  });
}
