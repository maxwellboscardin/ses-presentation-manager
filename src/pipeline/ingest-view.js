/**
 * ingest-view.js -- Inline AI extraction panel.
 * Exports buildInlineIngestPanel() for embedding inside expanded cards.
 * Handles file drop, text paste, AI extraction, and Apply -> DB save.
 */

import { upsertValue } from './data-api.js';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
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

/**
 * Build an inline ingest panel for a given data point.
 * @param {Object} dataPoint - The data point schema from the registry
 * @param {Array} contracts - Applicable contracts [{id, shortLabel}]
 * @param {Function} onApply - Callback(contractId, extractedValue, result) called after successful DB save
 * @returns {HTMLElement} The panel DOM element
 */
export function buildInlineIngestPanel(dataPoint, contracts, onApply) {
  const panel = el('div', 'dp-ingest-panel');
  panel.appendChild(el('div', 'dp-ingest-panel__title', 'AI Extract'));

  let selectedContract = contracts.length === 1 ? contracts[0].id : null;
  let pendingFile = null;
  let lastResult = null;

  // Contract selector (if multiple)
  if (contracts.length > 1) {
    const row = el('div', 'dp-ingest-panel__contract-row');
    contracts.forEach(c => {
      const btn = el('button', 'dp-ingest-panel__contract-btn', c.shortLabel);
      if (c.id === selectedContract) btn.classList.add('active');
      btn.addEventListener('click', () => {
        selectedContract = c.id;
        row.querySelectorAll('.dp-ingest-panel__contract-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateBtn();
      });
      row.appendChild(btn);
    });
    panel.appendChild(row);
  }

  // Drop zone
  const dropzone = el('div', 'dp-dropzone');
  const dropIcon = el('div', 'dp-dropzone__icon', '\uD83D\uDCCE');
  const dropText = el('div', 'dp-dropzone__text', 'Drop image, PDF, or CSV');
  const dropSub = el('div', 'dp-dropzone__sub', 'or click to browse');

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,.pdf,.csv';
  fileInput.style.display = 'none';

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dp-dropzone--active'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dp-dropzone--active'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dp-dropzone--active');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  dropzone.appendChild(dropIcon);
  dropzone.appendChild(dropText);
  dropzone.appendChild(dropSub);
  dropzone.appendChild(fileInput);
  panel.appendChild(dropzone);

  // File indicator
  const fileIndicator = el('div', 'dp-file-indicator');
  fileIndicator.style.display = 'none';
  panel.appendChild(fileIndicator);

  // Or separator
  panel.appendChild(el('div', 'dp-ingest-panel__or', 'or paste text below'));

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.className = 'dp-ingest-panel__textarea';
  textarea.placeholder = 'Paste data values, CSV rows, or text...';
  textarea.rows = 3;
  textarea.addEventListener('input', updateBtn);
  panel.appendChild(textarea);

  // Button row
  const btnRow = el('div', 'dp-ingest-panel__btn-row');
  const extractBtn = el('button', 'dp-btn-extract', 'Extract with AI');
  extractBtn.disabled = true;
  extractBtn.addEventListener('click', handleExtract);
  btnRow.appendChild(extractBtn);
  panel.appendChild(btnRow);

  // Result area
  const resultArea = el('div');
  resultArea.id = `ingest-result-${dataPoint.id}`;
  panel.appendChild(resultArea);

  function handleFile(file) {
    pendingFile = file;
    fileIndicator.style.display = 'flex';
    fileIndicator.innerHTML = '';
    fileIndicator.appendChild(el('span', 'dp-file-indicator__name', file.name));
    fileIndicator.appendChild(el('span', 'dp-file-indicator__size', `(${(file.size / 1024).toFixed(1)} KB)`));
    const clear = el('button', 'dp-file-indicator__clear', '\u00d7');
    clear.addEventListener('click', e => {
      e.stopPropagation();
      pendingFile = null;
      fileIndicator.style.display = 'none';
      fileInput.value = '';
      updateBtn();
    });
    fileIndicator.appendChild(clear);
    updateBtn();
  }

  function updateBtn() {
    const hasInput = pendingFile || textarea.value.trim();
    const hasTarget = selectedContract;
    extractBtn.disabled = !(hasInput && hasTarget);
  }

  async function handleExtract() {
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting...';
    resultArea.innerHTML = '';

    const loading = el('div', 'dp-loading');
    loading.innerHTML = '<div class="dp-spinner"></div><div>Extracting data...</div>';
    resultArea.appendChild(loading);

    try {
      let input, inputType;
      if (pendingFile) {
        inputType = detectInputType(pendingFile);
        input = inputType === 'image' ? await fileToBase64(pendingFile) : await pendingFile.text();
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
          dataPointSchema: dataPoint,
          contractId: selectedContract,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        resultArea.innerHTML = '';
        resultArea.appendChild(el('div', 'dp-error', result.error || 'Extraction failed'));
        return;
      }

      lastResult = result;
      showResult(result);
    } catch (err) {
      resultArea.innerHTML = '';
      resultArea.appendChild(el('div', 'dp-error', err.message));
    } finally {
      extractBtn.disabled = false;
      extractBtn.textContent = 'Extract with AI';
      updateBtn();
    }
  }

  function showResult(result) {
    resultArea.innerHTML = '';

    const wrap = el('div', 'dp-extract-result');

    // Header: model badge + confidence
    const header = el('div', 'dp-extract-result__header');
    header.appendChild(el('span', `dp-model-badge dp-model-badge--${result.model}`, result.model));

    const conf = el('span', 'dp-extract-result__conf');
    const pct = Math.round(result.confidence * 100);
    const confClass = pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low';
    conf.appendChild(el('span', 'dp-extract-result__conf-label', 'Confidence'));
    conf.appendChild(el('span', `dp-extract-result__conf-value dp-conf--${confClass}`, `${pct}%`));
    header.appendChild(conf);
    wrap.appendChild(header);

    // Escalation path
    if (result.escalationPath?.length > 1) {
      const path = el('div', 'dp-extract-result__escalation');
      const steps = result.escalationPath.map(s => {
        const c = s.confidence != null ? `${Math.round(s.confidence * 100)}%` : 'err';
        return `${s.model} (${c})`;
      });
      path.textContent = 'Escalation: ' + steps.join(' -> ');
      wrap.appendChild(path);
    }

    // Extracted value
    const valueEl = el('div', 'dp-extract-result__value');
    valueEl.textContent = typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : String(result.data);
    wrap.appendChild(valueEl);

    // Reasoning
    if (result.reasoning) {
      wrap.appendChild(el('div', 'dp-extract-result__reasoning', result.reasoning));
    }

    // Apply button
    const applyRow = el('div', 'dp-ingest-panel__btn-row');
    const applyBtn = el('button', 'dp-btn-apply', 'Apply to Registry');
    applyBtn.addEventListener('click', () => applyValue(result, applyBtn));
    applyRow.appendChild(applyBtn);
    wrap.appendChild(applyRow);

    resultArea.appendChild(wrap);
  }

  async function applyValue(result, btn) {
    if (!selectedContract || result.data == null) return;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      await upsertValue({
        dataPointId: dataPoint.id,
        contractId: selectedContract,
        value: result.data,
        valueType: 'ai-extracted',
      });

      // Show success
      const success = el('div', 'dp-success', 'Saved to database');
      resultArea.appendChild(success);

      // Notify parent
      if (onApply) onApply(selectedContract, result.data, result);
    } catch (err) {
      const errEl = el('div', 'dp-error', `Save failed: ${err.message}`);
      resultArea.appendChild(errEl);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply to Registry';
    }
  }

  return panel;
}
