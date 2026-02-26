// Card Editor — Inline content editing overlay
// Click any card to expand it 1:1 scaled up, edit content, and update in place.

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

  // Clone at original natural size, then CSS-scale up
  const clone = originalCard.cloneNode(true);
  clone.style.width = cardW + 'px';
  clone.style.height = cardH + 'px';
  clone.style.position = 'absolute';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.transform = `scale(${scale})`;
  clone.style.transformOrigin = 'top left';
  clone.style.flex = 'none';
  clone.style.minHeight = '0';
  clone.style.boxShadow = 'none';

  panel.appendChild(clone);

  // Close button — on the panel (not scaled), top-right corner
  const closeBtn = document.createElement('button');
  closeBtn.className = 'card-editor-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', closeOverlay);
  panel.appendChild(closeBtn);

  // Edit button (only for editable card types, not charts)
  if (EDITABLE_TYPES.includes(cardType)) {
    const editBtn = document.createElement('button');
    editBtn.className = 'card-editor-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      if (editBtn.textContent === 'Edit') {
        enterEditMode(editBtn, clone, cardType);
      } else {
        exitEditMode(editBtn, clone, originalCard, cardType);
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

function enterEditMode(btn, clone, cardType) {
  btn.textContent = 'Done';

  switch (cardType) {
    case 'observations-panel': editObservations(clone); break;
    case 'kpi-stack': editKpiStack(clone); break;
    case 'icon-kpi-card': editIconKpi(clone); break;
    case 'kpi-row': editKpiRow(clone); break;
  }
}

function exitEditMode(btn, clone, originalCard, cardType) {
  btn.textContent = 'Edit';

  switch (cardType) {
    case 'observations-panel': applyObservations(clone, originalCard); break;
    case 'kpi-stack': applyKpiStack(clone, originalCard); break;
    case 'icon-kpi-card': applyIconKpi(clone, originalCard); break;
    case 'kpi-row': applyKpiRow(clone, originalCard); break;
  }
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

  clone.innerHTML = '';
  clone.appendChild(form);

  const first = form.querySelector('.card-editor-input');
  if (first) first.focus();
}

function applyKpiRow(clone, originalCard) {
  const edits = Array.from(clone.querySelectorAll('.card-editor-input')).map(input => ({
    index: parseInt(input.dataset.index),
    value: input.value,
  }));

  // Restore clone
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
