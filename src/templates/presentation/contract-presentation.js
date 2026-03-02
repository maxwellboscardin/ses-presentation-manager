// Contract Presentation — Unified Flipbook with Navigation

import { buildPage1 as buildFlipbookPage1, buildPage2 as buildFlipbookPage2, renderPage1Charts as renderFlipbookPage1Charts, renderPage2Charts as renderFlipbookPage2Charts, buildMFPage1, renderMFPage1Charts } from '../flipbook/contract-spread.js';
import { buildPage as buildStatPage, renderAllCharts as renderStatCharts } from '../stat-sheet/contract-stat-sheet.js';
import { buildUpdatesPage, renderUpdatesCharts, buildSqbPage, renderSqbCharts } from '../updates/contract-updates.js';
import { initCardEditor, replayAnimations } from '../../components/card-editor.js';

export async function renderPresentation(container, contractDataUrl, statSheetDataUrl, config = {}) {
  // Fetch data files in parallel
  const fetches = [fetch(contractDataUrl), fetch(statSheetDataUrl)];
  if (config.updatesDataUrl) fetches.push(fetch(config.updatesDataUrl));
  if (config.sqbDataUrl) fetches.push(fetch(config.sqbDataUrl));

  const responses = await Promise.all(fetches);
  const contractData = await responses[0].json();
  const statData = await responses[1].json();
  let updatesData = null;
  let sqbData = null;

  let ri = 2;
  if (config.updatesDataUrl) { updatesData = await responses[ri++].json(); }
  if (config.sqbDataUrl) { sqbData = await responses[ri++].json(); }

  // Allow overrides from config (e.g. for 1334 CEG vs CES)
  if (config.title) contractData.title = config.title;
  if (config.code) contractData.code = config.code;
  if (config.product) contractData.product = config.product;

  const sectionLabels = ['Cover', 'Snapshot', 'Composition'];
  const chartRenderers = [];
  let currentIndex = 0;

  // ─── Build core sections ──────────────────────────────────────

  // Section 0: Cover (single)
  const coverSection = buildSection('single');
  coverSection.appendChild(buildCoverPage(contractData));

  // Section 1: Spread 1 — overview (left) + snapshot (right)
  const spread1Section = buildSection('spread');
  spread1Section.appendChild(buildOverviewPage(contractData));
  spread1Section.appendChild(buildStatPage(statData));

  // Section 2: Spread 2 — existing flipbook pages
  const spread2Section = buildSection('spread');
  spread2Section.appendChild(buildFlipbookPage1(contractData));
  spread2Section.appendChild(buildFlipbookPage2(contractData));

  const sections = [coverSection, spread1Section, spread2Section];

  // Chart render map: index → render function
  chartRenderers[1] = () => renderStatCharts(statData, spread1Section);
  chartRenderers[2] = () => {
    renderFlipbookPage1Charts(contractData, spread2Section);
    renderFlipbookPage2Charts(contractData, spread2Section);
  };

  // ─── Conditional MF Composition spread ──────────────────────

  if (contractData.multiFamily) {
    const mfSpread = buildSection('spread');
    mfSpread.appendChild(buildMFPage1(contractData));
    mfSpread.appendChild(buildBlankPage());
    sections.push(mfSpread);
    sectionLabels.push('MF Composition');
    chartRenderers[sections.length - 1] = () => {
      renderMFPage1Charts(contractData, mfSpread);
    };
  }

  // ─── Conditional extra spreads ────────────────────────────────

  if (updatesData) {
    // Individual Asset: risk scores + S/Q/B on one page, blank right page
    const updatesSpread = buildSection('spread');
    updatesSpread.appendChild(buildUpdatesPage(updatesData));
    updatesSpread.appendChild(buildBlankPage());
    sections.push(updatesSpread);
    sectionLabels.push('Updates');
    chartRenderers[sections.length - 1] = () => {
      renderUpdatesCharts(updatesData, updatesSpread);
    };
  } else if (sqbData) {
    // Portfolio contracts: standalone S/Q/B page
    const sqbSection = buildSection('single');
    sqbSection.appendChild(buildSqbPage(sqbData));
    sections.push(sqbSection);
    sectionLabels.push('S/Q/B Trends');
    chartRenderers[sections.length - 1] = () => renderSqbCharts(sqbData, sqbSection);
  }

  // Back cover always last
  const backSection = buildSection('single');
  backSection.appendChild(buildBackCoverPage());
  sections.push(backSection);
  sectionLabels.push('Back Cover');

  const chartsRendered = new Array(sections.length).fill(false);

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

  const replayBtn = document.createElement('button');
  replayBtn.className = 'pres-replay';
  replayBtn.innerHTML = `<svg viewBox="0 0 16 16"><path d="M1.5 1.5v5h5"/><path d="M3.5 10.5a6 6 0 1 0 1.3-6.6L1.5 6.5"/></svg>`;
  replayBtn.addEventListener('click', () => replayAnimations(sections[currentIndex]));
  container.appendChild(replayBtn);

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
    if (chartRenderers[index]) chartRenderers[index]();
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
  initCardEditor();
}

// ─── Section Builder ──────────────────────────────────────────

function buildSection(type) {
  const section = document.createElement('div');
  section.className = `pres-section pres-section--${type === 'spread' ? 'spread' : 'single'}`;
  return section;
}

// ─── Cover Page ───────────────────────────────────────────────

export function buildCoverPage(data) {
  const page = document.createElement('div');
  page.className = 'cover-page';
  page.innerHTML = `
    <img class="cover-page__logo" src="../assets/ses-logo.dark.png" alt="SES Risk Solutions">
    <div class="cover-page__contract">${data.contract}</div>
    <div class="cover-page__program">${data.title}</div>
    <div class="cover-page__subtitle">Contract Portfolio Review</div>
  `;
  return page;
}

// ─── Overview Page (left page of Spread 1) ─────────────────────

export function buildOverviewPage(data) {
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="page__inner">
      <div class="page-header">
        <div class="page-title">SES Overview</div>
      </div>
      <div class="page-content">

        <!-- Top section: KPIs left, narrative right -->
        <div style="display: flex; gap: var(--gap-sm);">

          <!-- Strength in Numbers -->
          <div style="flex: 2; background: var(--ses-white); border-radius: var(--radius); overflow: hidden; box-shadow: 0 1px 3px rgba(10,83,131,0.1);">
            <div class="section-header" style="border-radius: 0;">Strength in Numbers</div>
            <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;">
              ${overviewStat('35+', 'Years in Business')}
              ${overviewStat('85K+', 'Properties Insured')}
              ${overviewStat('$181M', 'Annual GWP')}
              ${overviewStat('$15B', 'Total Insured Value')}
              ${overviewStat('18.2%', 'CAGR, Past 5 Years')}
              ${overviewStat('82.4%', 'Account Retention')}
              ${overviewStat('1K+', 'Agent Relationships')}
              ${overviewStat('8K+', 'Investor Clients')}
            </div>
          </div>

          <!-- Narrative -->
          <div style="flex: 3; display: flex; flex-direction: column; gap: var(--gap-sm);">
            <div style="background: var(--ses-white); border-radius: var(--radius); overflow: hidden; box-shadow: 0 1px 3px rgba(10,83,131,0.1); flex: 1; display: flex; flex-direction: column;">
              <div class="section-header" style="border-radius: 0;">Who We Are</div>
              <div style="padding: 14px 16px; font-size: 12px; color: var(--ses-text-muted); line-height: 1.65; flex: 1;">
                <p style="margin: 0 0 10px 0;">SES is the <strong style="color: var(--ses-text);">largest Master Trust Insurance Program Administrator</strong> in the US and a leading specialist in residential real estate investor insurance. A division of <strong style="color: var(--ses-text);">Alliant Underwriting Solutions</strong>, one of the nation's top 10 MGAs.</p>
                <p style="margin: 0 0 10px 0;">We differentiate ourselves with <strong style="color: var(--ses-text);">strong performance</strong>, combining meaningful data, technology, and experience. Our <strong style="color: var(--ses-text);">proprietary policy administration system</strong> is API-enabled and offers web-based self-service. We maintain longstanding relationships with the industry's largest and most reputable brokers, wholesalers, and networks.</p>
                <p style="margin: 0;">Our commitment to <strong style="color: var(--ses-text);">adapting and refining our program in partnership with carriers, agents, and clients</strong> has led to favorable trends in combined ratios, loss experience, and overall program performance.</p>
              </div>
            </div>
          </div>

        </div>

        <!-- Core Competencies — horizontal rows -->
        <div class="section-header">Core Competencies</div>
        <div style="display: flex; flex-direction: column; gap: var(--gap-sm); flex: 1;">
          ${competencyRow('Data-Driven Underwriting', [
            'In-house actuarial team backed by Alliant Underwriting Solutions',
            'Technical Pricing Model: loss trend analysis and target loss ratio to monitor rate adequacy',
            'Advanced Risk Models: AI/ML-powered scoring at the zip-code level using aerial imagery, community data, and proximity signals',
            'Precision CAT Model: RMS outputs + construction modifiers drive state/county-level CAT loss loads',
            'Powered by Cognalytics MultiRate, Python & SQL workflows, and third-party data (ISO, Attom, TransUnion, Betterview, Cape Analytics)',
          ])}
          ${competencyRow('Service & Technology', [
            'Tech-enabled, API-ready solutions with user-friendly self-service platforms',
            'Proprietary quoting and policy management systems (TIMS, QUBIE)',
            'PowerBI dashboards delivering live KPIs to underwriting, pricing, and strategy teams',
            'Automated scoring, segmentation, and machine learning workflows',
          ])}
          ${competencyRow('Distribution', [
            'Longstanding partnerships with top producers across multiple channels',
            'No direct competition with our brokers, wholesalers, and networks',
            'Over 18,000 accounts generating nearly $360M in gross written premium',
            'Multiple product development channels serving investors from 1 to 5,000+ properties',
          ])}
        </div>

      </div>
    </div>
  `;
  return page;
}

function overviewStat(value, label) {
  return `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="min-width: 64px; background: var(--ses-navy); color: #fff; padding: 5px 10px; border-radius: 6px; font-size: 14px; font-weight: 700; text-align: center;">${value}</div>
      <div style="font-size: 12px; font-weight: 600; color: var(--ses-text); text-transform: uppercase; letter-spacing: 0.3px;">${label}</div>
    </div>
  `;
}

function competencyRow(title, bullets) {
  return `
    <div style="flex: 1; display: flex; gap: var(--gap-sm); background: var(--ses-white); border-radius: var(--radius); overflow: hidden; box-shadow: 0 1px 3px rgba(10,83,131,0.1); min-height: 0;">
      <div style="width: 180px; background: var(--ses-navy); display: flex; align-items: center; justify-content: center; padding: 12px 16px; flex-shrink: 0;">
        <div style="color: #fff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; line-height: 1.3;">${title}</div>
      </div>
      <ul style="padding: 10px 16px 10px 28px; margin: 0; display: flex; flex-direction: column; justify-content: center; gap: 5px; flex: 1;">
        ${bullets.map(b => `<li style="font-size: 11.5px; color: var(--ses-text-muted); line-height: 1.45;">${b}</li>`).join('')}
      </ul>
    </div>
  `;
}

// ─── Back Cover Page ──────────────────────────────────────────

export function buildBlankPage() {
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `<div class="page__inner"></div>`;
  return page;
}

export function buildBackCoverPage() {
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
