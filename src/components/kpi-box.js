// KPI Box Component

export function createKpiBox(value, label, options = {}) {
  const box = document.createElement('div');
  box.className = 'kpi-box';
  if (options.fullWidth) box.style.width = '100%';

  const valueEl = document.createElement('div');
  valueEl.className = 'kpi-box__value';
  valueEl.textContent = value;

  const labelEl = document.createElement('div');
  labelEl.className = 'kpi-box__label';
  labelEl.textContent = label;

  box.appendChild(labelEl);
  box.appendChild(valueEl);

  return box;
}

export function createKpiRow(kpis, options = {}) {
  const row = document.createElement('div');
  row.className = 'kpi-row';

  if (options.label) {
    row.setAttribute('data-label', options.label);
  }

  for (const kpi of kpis) {
    row.appendChild(createKpiBox(kpi.value, kpi.label, kpi.options));
  }

  return row;
}
