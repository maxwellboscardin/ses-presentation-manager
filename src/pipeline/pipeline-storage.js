/**
 * pipeline-storage.js — localStorage persistence layer for pipeline state.
 * Stores overrides, request state, and source documentation locally.
 * Original JSON files are never modified — overrides are merged at read time.
 */

const STORAGE_KEYS = {
  PIPELINE_STATE: 'ses-pipeline-state',
  DATA_OVERRIDES: 'ses-data-overrides',
  SOURCE_DOCS: 'ses-source-docs',
  LAST_UPDATED: 'ses-pipeline-last-updated',
};

export function loadPipelineState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PIPELINE_STATE);
    return raw ? JSON.parse(raw) : { requests: [], fulfillments: [] };
  } catch {
    return { requests: [], fulfillments: [] };
  }
}

export function savePipelineState(state) {
  localStorage.setItem(STORAGE_KEYS.PIPELINE_STATE, JSON.stringify(state));
}

export function loadDataOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DATA_OVERRIDES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveDataOverrides(overrides) {
  localStorage.setItem(STORAGE_KEYS.DATA_OVERRIDES, JSON.stringify(overrides));
}

export function loadSourceDocs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SOURCE_DOCS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSourceDocs(docs) {
  localStorage.setItem(STORAGE_KEYS.SOURCE_DOCS, JSON.stringify(docs));
}

/** Per-data-point last-updated timestamps (overrides the registry defaults). */
export function loadLastUpdated() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLastUpdated(timestamps) {
  localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, JSON.stringify(timestamps));
}

/** Mark a specific data point + contract as updated now. */
export function markUpdated(dataPointId, contractId) {
  const ts = loadLastUpdated();
  if (!ts[dataPointId]) ts[dataPointId] = {};
  ts[dataPointId][contractId] = new Date().toISOString().split('T')[0];
  saveLastUpdated(ts);
  return ts;
}

/** Clear all pipeline data from localStorage. */
export function clearAllPipelineData() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}
