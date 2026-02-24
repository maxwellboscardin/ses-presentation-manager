// Contract Presentation — Unified Flipbook with Navigation

import { buildPage1 as buildFlipbookPage1, buildPage2 as buildFlipbookPage2, renderPage1Charts as renderFlipbookPage1Charts, renderPage2Charts as renderFlipbookPage2Charts } from '../flipbook/contract-spread.js';
import { buildPage as buildStatPage, renderAllCharts as renderStatCharts } from '../stat-sheet/contract-stat-sheet.js';

export async function renderPresentation(container, contractDataUrl, statSheetDataUrl) {
  // Fetch both data files in parallel
  const [contractRes, statRes] = await Promise.all([
    fetch(contractDataUrl),
    fetch(statSheetDataUrl),
  ]);
  const contractData = await contractRes.json();
  const statData = await statRes.json();

  const sectionLabels = ['Cover', 'Stat Sheet', 'Portfolio', 'Back Cover'];
  const chartsRendered = [false, false, false, false];
  let currentIndex = 0;

  // ─── Build all 4 sections ───────────────────────────────────

  // Section 0: Cover (single)
  const coverSection = buildSection('single');
  coverSection.appendChild(buildCoverPage(contractData));

  // Section 1: Spread 1 — overview placeholder (left) + stat sheet (right)
  const spread1Section = buildSection('spread');
  spread1Section.appendChild(buildOverviewPage(contractData));
  spread1Section.appendChild(buildStatPage(statData));

  // Section 2: Spread 2 — existing flipbook pages
  const spread2Section = buildSection('spread');
  spread2Section.appendChild(buildFlipbookPage1(contractData));
  spread2Section.appendChild(buildFlipbookPage2(contractData));

  // Section 3: Back cover (single)
  const backSection = buildSection('single');
  backSection.appendChild(buildBackCoverPage());

  const sections = [coverSection, spread1Section, spread2Section, backSection];

  // Add all sections to container
  sections.forEach((s) => container.appendChild(s));

  // ─── Navigation controls ────────────────────────────────────

  const prevBtn = buildNavButton('prev');
  const nextBtn = buildNavButton('next');
  container.appendChild(prevBtn);
  container.appendChild(nextBtn);

  const dots = buildDots(sections.length);
  container.appendChild(dots);
  // Wire dot clicks to goTo
  dots.querySelectorAll('.pres-dot').forEach((dot, i) => {
    dot.addEventListener('click', () => goTo(i));
  });

  const label = document.createElement('div');
  label.className = 'pres-label';
  container.appendChild(label);

  prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
  nextBtn.addEventListener('click', () => goTo(currentIndex + 1));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (e.key === 'ArrowRight') goTo(currentIndex + 1);
  });

  // ─── Auto-scale per section ─────────────────────────────────

  function autoScale() {
    sections.forEach((section, i) => {
      const isSpread = section.classList.contains('pres-section--spread');
      const contentW = isSpread ? (816 * 2 + 2 + 48) : (816 + 48);
      const contentH = 1056 + 48;
      const scale = Math.min(window.innerWidth / contentW, window.innerHeight / contentH, 1);
      section.style.transform = `translate(-50%, -50%) scale(${scale})`;
    });
  }
  autoScale();
  window.addEventListener('resize', autoScale);

  // ─── Navigation logic ───────────────────────────────────────

  function goTo(index) {
    if (index < 0 || index >= sections.length) return;

    sections[currentIndex].classList.remove('active');
    currentIndex = index;
    sections[currentIndex].classList.add('active');

    // Render charts on first visit
    if (!chartsRendered[currentIndex]) {
      chartsRendered[currentIndex] = true;
      requestAnimationFrame(() => renderSectionCharts(currentIndex));
    }

    updateNav();
  }

  function renderSectionCharts(index) {
    if (index === 1) {
      // Spread 1: stat sheet is the right page
      renderStatCharts(statData, spread1Section);
    } else if (index === 2) {
      // Spread 2: flipbook pages
      renderFlipbookPage1Charts(contractData, spread2Section);
      renderFlipbookPage2Charts(contractData, spread2Section);
    }
  }

  function updateNav() {
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === sections.length - 1;

    // Update dots
    dots.querySelectorAll('.pres-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });

    // Update label
    label.textContent = sectionLabels[currentIndex];
  }

  // ─── Initialize ─────────────────────────────────────────────

  goTo(0);
}

// ─── Section Builder ──────────────────────────────────────────

function buildSection(type) {
  const section = document.createElement('div');
  section.className = `pres-section pres-section--${type === 'spread' ? 'spread' : 'single'}`;
  return section;
}

// ─── Cover Page ───────────────────────────────────────────────

function buildCoverPage(data) {
  const page = document.createElement('div');
  page.className = 'cover-page';
  page.innerHTML = `
    <img class="cover-page__logo" src="../assets/ses-logo.dark.png" alt="SES Risk Solutions">
    <div class="cover-page__title">${data.title}</div>
    <div class="cover-page__subtitle">Contract Portfolio Review</div>
    <div class="cover-page__badge">${data.contract}</div>
  `;
  return page;
}

// ─── Overview Placeholder (left page of Spread 1) ─────────────

function buildOverviewPage(data) {
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="page__inner">
      <div class="page-header">
        <div class="page-title">SES Overview</div>
      </div>
      <div class="page-content" style="align-items: center; justify-content: center;">
        <div style="text-align: center; color: var(--ses-text-muted); font-size: 16px; font-weight: 500;">
          Company overview content goes here
        </div>
      </div>
    </div>
  `;
  return page;
}

// ─── Back Cover Page ──────────────────────────────────────────

function buildBackCoverPage() {
  const page = document.createElement('div');
  page.className = 'cover-page';
  page.innerHTML = `
    <div class="back-cover-content">
      <img class="cover-page__logo" src="../assets/ses-logo.dark.png" alt="SES Risk Solutions">
      <div class="back-cover-content__text">Thank you</div>
    </div>
  `;
  return page;
}

// ─── Nav Buttons ──────────────────────────────────────────────

function buildNavButton(direction) {
  const btn = document.createElement('button');
  btn.className = `pres-nav pres-nav--${direction}`;
  if (direction === 'prev') {
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>`;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>`;
  }
  return btn;
}

// ─── Page Indicator Dots ──────────────────────────────────────

function buildDots(count) {
  const container = document.createElement('div');
  container.className = 'pres-dots';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('button');
    dot.className = 'pres-dot';
    container.appendChild(dot);
  }
  return container;
}
