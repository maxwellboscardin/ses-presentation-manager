/**
 * request-view.js — Request pipeline UI (Phase 2 stub).
 * Will contain: request creation, status tracking, file drops, data parsing.
 */

export function renderRequestView(container) {
  container.innerHTML = '';

  const stub = document.createElement('div');
  stub.className = 'dp-stub';

  const icon = document.createElement('div');
  icon.className = 'dp-stub__icon';
  icon.textContent = '\ud83d\udce8';
  stub.appendChild(icon);

  const title = document.createElement('div');
  title.className = 'dp-stub__title';
  title.textContent = 'Request Pipeline';
  stub.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'dp-stub__desc';
  desc.textContent = 'Create batch data requests, assign to team members, track fulfillment status, and accept data via paste, CSV, XLSX, or image upload. Coming in Phase 2.';
  stub.appendChild(desc);

  container.appendChild(stub);
}
