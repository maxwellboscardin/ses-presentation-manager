/**
 * collections.js — Collection definitions for the data pipeline.
 * Maps collection names to their constituent contracts.
 */

export const COLLECTIONS = {
  london: {
    label: 'London March 2026',
    contracts: ['1258', '1334-ceg', '1334-ces', '1465', '1097', '3757'],
    indexUrl: 'london-index.html',
  },
  zurich: {
    label: 'Zurich March 2026',
    contracts: ['zurich'],
    indexUrl: 'zurich-index.html',
  },
};

/** All contracts across all collections (master list). */
export const ALL_CONTRACTS = [
  { id: '1258', shortLabel: '1258 LOC', collection: 'london' },
  { id: '1334-ceg', shortLabel: '1334 CEG', collection: 'london' },
  { id: '1334-ces', shortLabel: '1334 CES', collection: 'london' },
  { id: '1465', shortLabel: '1465 QBS', collection: 'london' },
  { id: '1097', shortLabel: '1097 LOL', collection: 'london' },
  { id: '3757', shortLabel: '3757 GLR', collection: 'london' },
  { id: 'zurich', shortLabel: 'Zurich SFR', collection: 'zurich' },
];

/**
 * Get the active collection ID from the URL query params.
 * Falls back to null (show all) if not specified.
 */
export function getActiveCollection() {
  const params = new URLSearchParams(window.location.search);
  return params.get('collection') || null;
}

/**
 * Get contracts filtered by collection.
 * If collectionId is null, returns all contracts.
 */
export function getContractsForCollection(collectionId) {
  if (!collectionId) return ALL_CONTRACTS;
  const col = COLLECTIONS[collectionId];
  if (!col) return ALL_CONTRACTS;
  return ALL_CONTRACTS.filter(c => col.contracts.includes(c.id));
}
