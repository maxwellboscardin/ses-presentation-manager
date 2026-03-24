/**
 * data-api.js -- Client-side API wrappers for data_values persistence.
 * Talks to /api/data-values endpoints on the server.
 */

/**
 * Fetch all DB-persisted values, optionally filtered by collection.
 * Returns a map: { [dataPointId]: { [contractId]: { value, valueType, updatedAt } } }
 */
export async function fetchAllValues(collection) {
  const params = collection ? `?collection=${encodeURIComponent(collection)}` : '';
  const resp = await fetch(`/api/data-values${params}`);
  if (!resp.ok) return {};
  const { rows } = await resp.json();
  const map = {};
  for (const row of rows) {
    if (!map[row.data_point_id]) map[row.data_point_id] = {};
    map[row.data_point_id][row.contract_id] = {
      value: row.value,
      valueType: row.value_type,
      updatedAt: row.updated_at,
    };
  }
  return map;
}

/**
 * Upsert a single data value to the database.
 */
export async function upsertValue({ dataPointId, contractId, value, valueType, sourceIngestionId }) {
  const resp = await fetch('/api/data-values', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataPointId, contractId, value, valueType, sourceIngestionId }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save value');
  }
  return resp.json();
}

/**
 * Delete a DB-persisted value (revert to JSON source).
 */
export async function deleteValue(dataPointId, contractId) {
  const resp = await fetch(`/api/data-values/${encodeURIComponent(dataPointId)}/${encodeURIComponent(contractId)}`, {
    method: 'DELETE',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete value');
  }
  return resp.json();
}
