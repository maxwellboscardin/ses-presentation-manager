/**
 * source-view.js — Source documentation UI (Phase 3 stub).
 * Will contain: per-data-point source documentation, coverage tracking.
 */

export function renderSourceView(container) {
  container.innerHTML = '';

  const stub = document.createElement('div');
  stub.className = 'dp-stub';

  const icon = document.createElement('div');
  icon.className = 'dp-stub__icon';
  icon.textContent = '\ud83d\udcda';
  stub.appendChild(icon);

  const title = document.createElement('div');
  title.className = 'dp-stub__title';
  title.textContent = 'Source Documentation';
  stub.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'dp-stub__desc';
  desc.textContent = 'Document where each data point comes from — PowerBI, TIMS, Excel, manual calculations. Track coverage as Sean and Sahitya teach the system. Coming in Phase 3.';
  stub.appendChild(desc);

  container.appendChild(stub);
}
