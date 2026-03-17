/**
 * ingest-view.js — AI-powered data ingestion UI.
 * Drop a screenshot/PDF/CSV or paste text → Claude extracts structured JSON.
 */

import { loadDataOverrides, saveDataOverrides, markUpdated } from './pipeline-storage.js';
import { getContractsForCollection } from './collections.js';

let CONTRACTS = [];

let registry = [];
let selectedDataPoint = null;
let selectedContract = null;
let lastResult = null;
let activeCollectionId = null;

// ─── Helpers ─────────────────────────────────────────────────

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function detectInputType(file) {
  if (!file) return 'text';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'text/csv' || file.name.endsWith('.csv')) return 'csv';
  return 'text';
}

// ─── Main Render ─────────────────────────────────────────────

export async function renderIngestView(container, collectionId) {
  container.innerHTML = '';
  activeCollectionId = collectionId;

  // Build contracts list based on collection filter
  CONTRACTS = getContractsForCollection(collectionId).map(c => ({
    id: c.id,
    shortLabel: c.shortLabel,
  }));

  // Load registry
  const resp = await fetch('../data/data-registry.json');
  registry = await resp.json();

  // Filter registry to only show data points relevant to this collection's contracts
  if (collectionId) {
    const contractIds = new Set(CONTRACTS.map(c => c.id));
    registry = registry.filter(dp => dp.contracts.some(cid => contractIds.has(cid)));
  }

  const layout = el('div', 'dp-ingest');

  // Left column: target selector + input
  const left = el('div', 'dp-ingest__left');
  left.appendChild(buildTargetSelector());
  left.appendChild(buildInputArea());
  layout.appendChild(left);

  // Right column: preview + history
  const right = el('div', 'dp-ingest__right');
  right.appendChild(buildPreviewPanel());
  right.appendChild(buildHistoryPanel());
  layout.appendChild(right);

  container.appendChild(layout);
}

// ─── Target Selector ─────────────────────────────────────────

function buildTargetSelector() {
  const section = el('div', 'dp-ingest__section');

  const heading = el('div', 'dp-ingest__heading', 'Target');
  section.appendChild(heading);

  // Data point select
  const dpLabel = el('label', 'dp-ingest__label', 'Data Point');
  const dpSelect = document.createElement('select');
  dpSelect.className = 'dp-ingest__select';
  dpSelect.id = 'ingest-dp-select';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Select a data point...';
  dpSelect.appendChild(defaultOpt);

  // Group by category
  let currentCat = '';
  registry.forEach(dp => {
    if (dp.category !== currentCat) {
      currentCat = dp.category;
      const group = document.createElement('optgroup');
      group.label = dp.category;
      registry.filter(d => d.category === currentCat).forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.label;
        group.appendChild(opt);
      });
      dpSelect.appendChild(group);
    }
  });

  dpSelect.addEventListener('change', () => {
    selectedDataPoint = registry.find(d => d.id === dpSelect.value) || null;
    updateContractOptions();
    updateExtractButton();
  });

  section.appendChild(dpLabel);
  section.appendChild(dpSelect);

  // Contract select
  const cLabel = el('label', 'dp-ingest__label', 'Contract');
  const cSelect = document.createElement('select');
  cSelect.className = 'dp-ingest__select';
  cSelect.id = 'ingest-contract-select';
  cSelect.disabled = true;

  const cDefault = document.createElement('option');
  cDefault.value = '';
  cDefault.textContent = 'Select a contract...';
  cSelect.appendChild(cDefault);

  cSelect.addEventListener('change', () => {
    selectedContract = cSelect.value || null;
    updateExtractButton();
  });

  section.appendChild(cLabel);
  section.appendChild(cSelect);

  return section;
}

function updateContractOptions() {
  const cSelect = document.getElementById('ingest-contract-select');
  if (!cSelect) return;

  // Clear existing options
  cSelect.innerHTML = '';
  const cDefault = document.createElement('option');
  cDefault.value = '';
  cDefault.textContent = 'Select a contract...';
  cSelect.appendChild(cDefault);

  if (!selectedDataPoint) {
    cSelect.disabled = true;
    selectedContract = null;
    return;
  }

  cSelect.disabled = false;
  selectedDataPoint.contracts.forEach(cid => {
    const c = CONTRACTS.find(ct => ct.id === cid);
    if (!c) return;
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.shortLabel;
    cSelect.appendChild(opt);
  });
}

// ─── Input Area ──────────────────────────────────────────────

function buildInputArea() {
  const section = el('div', 'dp-ingest__section');

  const heading = el('div', 'dp-ingest__heading', 'Input');
  section.appendChild(heading);

  // Dropzone
  const dropzone = el('div', 'dp-dropzone');
  dropzone.id = 'ingest-dropzone';

  const dropIcon = el('div', 'dp-dropzone__icon', '\u{1F4CE}');
  const dropText = el('div', 'dp-dropzone__text', 'Drop image, PDF, or CSV here');
  const dropSub = el('div', 'dp-dropzone__sub', 'or click to browse');

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,.pdf,.csv';
  fileInput.style.display = 'none';
  fileInput.id = 'ingest-file-input';

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
  });

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dp-dropzone--active');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dp-dropzone--active');
  });

  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dp-dropzone--active');
    if (e.dataTransfer.files[0]) handleFileSelected(e.dataTransfer.files[0]);
  });

  dropzone.appendChild(dropIcon);
  dropzone.appendChild(dropText);
  dropzone.appendChild(dropSub);
  dropzone.appendChild(fileInput);
  section.appendChild(dropzone);

  // File indicator
  const fileIndicator = el('div', 'dp-ingest__file-indicator');
  fileIndicator.id = 'ingest-file-indicator';
  fileIndicator.style.display = 'none';
  section.appendChild(fileIndicator);

  // Separator
  const sep = el('div', 'dp-ingest__or', 'or paste text below');
  section.appendChild(sep);

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.className = 'dp-ingest__textarea';
  textarea.id = 'ingest-textarea';
  textarea.placeholder = 'Paste data values, CSV rows, or text to extract from...';
  textarea.rows = 5;
  textarea.addEventListener('input', updateExtractButton);
  section.appendChild(textarea);

  // Extract button
  const btnRow = el('div', 'dp-ingest__btn-row');
  const extractBtn = el('button', 'dp-ingest__extract-btn', 'Extract with AI');
  extractBtn.id = 'ingest-extract-btn';
  extractBtn.disabled = true;
  extractBtn.addEventListener('click', handleExtract);
  btnRow.appendChild(extractBtn);
  section.appendChild(btnRow);

  return section;
}

let pendingFile = null;

function handleFileSelected(file) {
  pendingFile = file;
  const indicator = document.getElementById('ingest-file-indicator');
  if (indicator) {
    indicator.style.display = 'flex';
    indicator.innerHTML = '';

    const name = el('span', 'dp-ingest__file-name', file.name);
    const size = el('span', 'dp-ingest__file-size', `(${(file.size / 1024).toFixed(1)} KB)`);
    const clear = el('button', 'dp-ingest__file-clear', '\u00d7');
    clear.addEventListener('click', e => {
      e.stopPropagation();
      pendingFile = null;
      indicator.style.display = 'none';
      document.getElementById('ingest-file-input').value = '';
      updateExtractButton();
    });

    indicator.appendChild(name);
    indicator.appendChild(size);
    indicator.appendChild(clear);
  }
  updateExtractButton();
}

function updateExtractButton() {
  const btn = document.getElementById('ingest-extract-btn');
  if (!btn) return;

  const textarea = document.getElementById('ingest-textarea');
  const hasInput = pendingFile || (textarea && textarea.value.trim());
  const hasTarget = selectedDataPoint && selectedContract;

  btn.disabled = !(hasInput && hasTarget);
}

// ─── Extract Handler ─────────────────────────────────────────

async function handleExtract() {
  const btn = document.getElementById('ingest-extract-btn');
  const textarea = document.getElementById('ingest-textarea');

  btn.disabled = true;
  btn.textContent = 'Extracting...';

  // Show loading in preview
  showPreviewLoading();

  try {
    let input, inputType;

    if (pendingFile) {
      inputType = detectInputType(pendingFile);
      if (inputType === 'image') {
        input = await fileToBase64(pendingFile);
      } else {
        input = await pendingFile.text();
      }
    } else {
      input = textarea.value.trim();
      inputType = 'text';
    }

    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        inputType,
        dataPointSchema: selectedDataPoint,
        contractId: selectedContract,
        collection: activeCollectionId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      showPreviewError(result.error || 'Extraction failed');
      return;
    }

    lastResult = result;
    showPreviewResult(result);

    // Show DB save confirmation if server saved to database
    if (result.savedToDb) {
      const preview = document.getElementById('ingest-preview');
      if (preview) {
        const dbConfirm = el('div', 'dp-preview__applied', 'Saved to database');
        dbConfirm.style.background = 'rgba(76,175,80,0.12)';
        dbConfirm.style.color = '#4CAF50';
        preview.appendChild(dbConfirm);
      }
    }
  } catch (err) {
    showPreviewError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Extract with AI';
    updateExtractButton();
  }
}

// ─── Preview Panel ───────────────────────────────────────────

function buildPreviewPanel() {
  const section = el('div', 'dp-ingest__section dp-ingest__preview-section');

  const heading = el('div', 'dp-ingest__heading', 'Result');
  section.appendChild(heading);

  const preview = el('div', 'dp-preview');
  preview.id = 'ingest-preview';

  const empty = el('div', 'dp-preview__empty', 'Select a target, provide input, and click Extract to see results here.');
  preview.appendChild(empty);

  section.appendChild(preview);
  return section;
}

function showPreviewLoading() {
  const preview = document.getElementById('ingest-preview');
  if (!preview) return;
  preview.innerHTML = '';

  const spinner = el('div', 'dp-preview__loading');
  spinner.innerHTML = '<div class="dp-preview__spinner"></div><div>Extracting data...</div>';
  preview.appendChild(spinner);
}

function showPreviewError(message) {
  const preview = document.getElementById('ingest-preview');
  if (!preview) return;
  preview.innerHTML = '';

  const err = el('div', 'dp-preview__error', message);
  preview.appendChild(err);
}

function showPreviewResult(result) {
  const preview = document.getElementById('ingest-preview');
  if (!preview) return;
  preview.innerHTML = '';

  // Model badge + confidence
  const header = el('div', 'dp-preview__header');

  const modelBadge = el('span', `dp-model-badge dp-model-badge--${result.model}`, result.model);
  header.appendChild(modelBadge);

  const conf = el('span', 'dp-preview__confidence');
  const pct = Math.round(result.confidence * 100);
  const confClass = pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low';
  conf.innerHTML = `<span class="dp-preview__conf-label">Confidence</span><span class="dp-preview__conf-value dp-preview__conf-value--${confClass}">${pct}%</span>`;
  header.appendChild(conf);

  preview.appendChild(header);

  // Escalation path
  if (result.escalationPath && result.escalationPath.length > 1) {
    const path = el('div', 'dp-preview__escalation');
    const steps = result.escalationPath.map(s => {
      const conf = s.confidence != null ? `${Math.round(s.confidence * 100)}%` : 'err';
      return `${s.model} (${conf})`;
    });
    path.textContent = 'Escalation: ' + steps.join(' \u2192 ');
    preview.appendChild(path);
  }

  // Extracted data
  const dataSection = el('div', 'dp-preview__data');
  const dataLabel = el('div', 'dp-preview__data-label', 'Extracted Value');
  const dataValue = el('div', 'dp-preview__data-value');
  dataValue.textContent = typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : String(result.data);
  dataSection.appendChild(dataLabel);
  dataSection.appendChild(dataValue);
  preview.appendChild(dataSection);

  // Reasoning
  if (result.reasoning) {
    const reasoning = el('div', 'dp-preview__reasoning');
    const rLabel = el('div', 'dp-preview__data-label', 'Reasoning');
    const rValue = el('div', 'dp-preview__reasoning-text', result.reasoning);
    reasoning.appendChild(rLabel);
    reasoning.appendChild(rValue);
    preview.appendChild(reasoning);
  }

  // Apply button
  const applyRow = el('div', 'dp-ingest__btn-row');
  const applyBtn = el('button', 'dp-ingest__apply-btn', 'Apply to Registry');
  applyBtn.addEventListener('click', () => applyResult(result));
  applyRow.appendChild(applyBtn);
  preview.appendChild(applyRow);
}

function applyResult(result) {
  if (!selectedDataPoint || !selectedContract || result.data == null) return;

  // Save to localStorage overrides
  const overrides = loadDataOverrides();
  if (!overrides[selectedDataPoint.id]) overrides[selectedDataPoint.id] = {};
  overrides[selectedDataPoint.id][selectedContract] = result.data;
  saveDataOverrides(overrides);

  // Mark as updated now
  markUpdated(selectedDataPoint.id, selectedContract);

  // Show confirmation
  const preview = document.getElementById('ingest-preview');
  if (preview) {
    const confirm = el('div', 'dp-preview__applied', 'Applied! Value saved to local overrides.');
    preview.appendChild(confirm);
  }
}

// ─── History Panel ────────────────────────────────────────────

function buildHistoryPanel() {
  const section = el('div', 'dp-ingest__section');

  const header = el('div', 'dp-ingest__heading');
  header.textContent = 'Recent Ingestions';
  const refreshBtn = el('button', 'dp-ingest__history-refresh', 'Refresh');
  refreshBtn.style.cssText = 'margin-left:auto;background:none;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;font-family:inherit;';
  refreshBtn.addEventListener('click', loadHistory);
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.appendChild(refreshBtn);
  section.appendChild(header);

  const list = el('div', 'dp-ingest__history');
  list.id = 'ingest-history';
  list.style.cssText = 'max-height:240px;overflow-y:auto;font-size:12px;color:rgba(255,255,255,0.5);';
  list.textContent = 'Loading...';
  section.appendChild(list);

  // Load on mount
  setTimeout(loadHistory, 100);

  return section;
}

async function loadHistory() {
  const list = document.getElementById('ingest-history');
  if (!list) return;

  try {
    const url = activeCollectionId
      ? `/api/ingestions?collection=${encodeURIComponent(activeCollectionId)}`
      : '/api/ingestions';
    const resp = await fetch(url);
    const { rows, error } = await resp.json();

    if (error && (!rows || rows.length === 0)) {
      list.textContent = error === 'Database not configured' ? 'Database not connected' : error;
      return;
    }

    if (!rows || rows.length === 0) {
      list.textContent = 'No ingestions yet';
      return;
    }

    list.innerHTML = '';
    rows.slice(0, 20).forEach(row => {
      const item = el('div', 'dp-ingest__history-item');
      item.style.cssText = 'padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;align-items:baseline;';

      const time = el('span', '', new Date(row.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
      time.style.cssText = 'color:rgba(255,255,255,0.3);font-size:11px;white-space:nowrap;';
      item.appendChild(time);

      const dpLabel = el('span', '', row.data_point_id);
      dpLabel.style.cssText = 'color:rgba(255,255,255,0.7);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      item.appendChild(dpLabel);

      const contract = el('span', '', row.contract_id);
      contract.style.cssText = 'color:rgba(10,83,131,0.8);font-size:11px;';
      item.appendChild(contract);

      const conf = el('span', '', `${Math.round((row.confidence || 0) * 100)}%`);
      const confPct = Math.round((row.confidence || 0) * 100);
      conf.style.cssText = `color:${confPct >= 80 ? '#4CAF50' : confPct >= 60 ? '#FFC107' : '#f44336'};font-size:11px;font-weight:600;`;
      item.appendChild(conf);

      list.appendChild(item);
    });
  } catch {
    list.textContent = 'Failed to load history';
  }
}
