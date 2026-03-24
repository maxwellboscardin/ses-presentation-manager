/**
 * freshness.js — Staleness detection for data points.
 * Returns freshness status based on days since last update.
 *
 * Thresholds (configurable per data point via staleDays):
 *   fresh  = within staleDays
 *   aging  = within staleDays × 1.5
 *   stale  = beyond staleDays × 1.5
 *   unknown = no lastUpdated date
 */

const STATUS = {
  FRESH: 'fresh',
  AGING: 'aging',
  STALE: 'stale',
  UNKNOWN: 'unknown',
};

const COLORS = {
  fresh: '#3FAB5A',
  aging: '#E39622',
  stale: '#B01A12',
  unknown: '#8E8E93',
};

const LABELS = {
  fresh: 'Fresh',
  aging: 'Aging',
  stale: 'Stale',
  unknown: 'Unknown',
};

/**
 * Calculate freshness for a data point + contract.
 * @param {string|null} lastUpdatedDate — ISO date string or null
 * @param {number} staleDays — threshold in days (default 90)
 * @returns {{ status, color, label, daysAgo }}
 */
export function getFreshness(lastUpdatedDate, staleDays = 90) {
  if (!lastUpdatedDate) {
    return { status: STATUS.UNKNOWN, color: COLORS.unknown, label: LABELS.unknown, daysAgo: null };
  }

  const updated = new Date(lastUpdatedDate);
  const now = new Date();
  const diffMs = now - updated;
  const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let status;
  if (daysAgo <= staleDays) {
    status = STATUS.FRESH;
  } else if (daysAgo <= staleDays * 1.5) {
    status = STATUS.AGING;
  } else {
    status = STATUS.STALE;
  }

  return {
    status,
    color: COLORS[status],
    label: LABELS[status],
    daysAgo,
  };
}

/**
 * Get aggregate freshness across all contracts for a data point.
 * Returns the worst status found.
 */
export function getAggregateFreshness(lastUpdatedMap, staleDays = 90) {
  if (!lastUpdatedMap || Object.keys(lastUpdatedMap).length === 0) {
    return { status: STATUS.UNKNOWN, color: COLORS.unknown, label: LABELS.unknown };
  }

  const statuses = Object.values(lastUpdatedMap).map(date => getFreshness(date, staleDays));
  const priority = [STATUS.STALE, STATUS.AGING, STATUS.FRESH, STATUS.UNKNOWN];

  for (const p of priority) {
    if (statuses.some(s => s.status === p)) {
      return { status: p, color: COLORS[p], label: LABELS[p] };
    }
  }

  return { status: STATUS.UNKNOWN, color: COLORS.unknown, label: LABELS.unknown };
}

export { STATUS, COLORS, LABELS };
