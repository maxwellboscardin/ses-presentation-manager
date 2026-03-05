// Contract Presentation — Unified Flipbook with Navigation

import { buildPage1 as buildFlipbookPage1, buildPage2 as buildFlipbookPage2, renderPage1Charts as renderFlipbookPage1Charts, renderPage2Charts as renderFlipbookPage2Charts, buildMFPage1, buildMFPage2, renderMFPage1Charts } from '../flipbook/contract-spread.js';
import { buildPage as buildStatPage, renderAllCharts as renderStatCharts } from '../stat-sheet/contract-stat-sheet.js';
import { buildSqbPage, renderSqbCharts } from '../updates/contract-updates.js';
import { initCardEditor, replayAnimations } from '../../components/card-editor.js';

export async function renderPresentation(container, contractDataUrl, statSheetDataUrl, config = {}) {
  // Hide container until background images are preloaded
  container.style.opacity = '0';

  // Preload background images in parallel with data fetches
  const bgImages = ['../assets/bg-cover.png', '../assets/bg-left.png', '../assets/bg-right.png'];
  const preloads = bgImages.map(src => new Promise(resolve => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve; // don't block on failure
    img.src = src;
  }));

  // Fetch data files in parallel (cache-busting with timestamp)
  const ts = Date.now();
  const fetches = [
    fetch(`${contractDataUrl}?t=${ts}`, { cache: 'no-store' }),
    fetch(`${statSheetDataUrl}?t=${ts}`, { cache: 'no-store' })
  ];
  if (config.updatesDataUrl) fetches.push(fetch(`${config.updatesDataUrl}?t=${ts}`, { cache: 'no-store' }));
  if (config.sqbDataUrl) fetches.push(fetch(`${config.sqbDataUrl}?t=${ts}`, { cache: 'no-store' }));

  const [responses] = await Promise.all([Promise.all(fetches), ...preloads]);
  const contractData = await responses[0].json();
  const statData = await responses[1].json();

  // DEBUG: Log which files were loaded and their submissions data
  console.log('🔍 DEBUG: Loaded files:');
  console.log('  Contract URL:', contractDataUrl);
  console.log('  Stat Sheet URL:', statSheetDataUrl);
  console.log('  Stat Sheet Contract:', statData.contract);
  console.log('  Stat Sheet Title:', statData.title);
  if (statData.quotesBinds) {
    console.log('  Q1 Submissions:', statData.quotesBinds.data[0].bars[0]);
    console.log('  Has Footnote:', !!statData.quotesBinds.footnote);
    if (statData.quotesBinds.footnote) console.log('  Footnote:', statData.quotesBinds.footnote);
  }
  let updatesData = null;
  let sqbData = null;

  let ri = 2;
  if (config.updatesDataUrl) { updatesData = await responses[ri++].json(); }
  if (config.sqbDataUrl) { sqbData = await responses[ri++].json(); }

  // Allow overrides from config (e.g. for 1334 CEG vs CES)
  if (config.title) contractData.title = config.title;
  if (config.code) contractData.code = config.code;
  if (config.product) contractData.product = config.product;

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
  spread2Section.appendChild(buildFlipbookPage2(contractData, updatesData));

  const sections = [coverSection, spread1Section, spread2Section];

  // Chart render map: index → render function
  chartRenderers[1] = () => renderStatCharts(statData, spread1Section);
  chartRenderers[2] = () => {
    renderFlipbookPage1Charts(contractData, spread2Section);
    renderFlipbookPage2Charts(contractData, spread2Section, updatesData);
  };

  // ─── Conditional MF Composition spread ──────────────────────

  if (contractData.multiFamily) {
    const mfSpread = buildSection('spread');
    mfSpread.appendChild(buildMFPage1(contractData));
    mfSpread.appendChild(buildMFPage2(contractData));
    sections.push(mfSpread);

    chartRenderers[sections.length - 1] = () => {
      renderMFPage1Charts(contractData, mfSpread);
    };
  }

  // ─── Conditional extra spreads ────────────────────────────────

  if (sqbData) {
    // Portfolio contracts: standalone S/Q/B page
    const sqbSection = buildSection('single');
    sqbSection.appendChild(buildSqbPage(sqbData));
    sections.push(sqbSection);
    chartRenderers[sections.length - 1] = () => renderSqbCharts(sqbData, sqbSection);
  }

  // Back cover always last
  const backSection = buildSection('single');
  backSection.appendChild(buildBackCoverPage());
  sections.push(backSection);

  const chartsRendered = new Array(sections.length).fill(false);

  // Add all sections to container
  sections.forEach((s) => container.appendChild(s));

  // ─── Navigation controls ────────────────────────────────────

  const prevBtn = buildNavButton('prev');
  const nextBtn = buildNavButton('next');
  const homeBtn = buildHomeButton();
  container.appendChild(prevBtn);
  container.appendChild(nextBtn);
  container.appendChild(homeBtn);

  prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
  nextBtn.addEventListener('click', () => goTo(currentIndex + 1));
  homeBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (e.key === 'ArrowRight') goTo(currentIndex + 1);
  });

  // ─── Auto-scale per section ─────────────────────────────────

  function autoScale() {
    sections.forEach((section, i) => {
      const isSpread = section.classList.contains('pres-section--spread');
      const contentW = isSpread ? (816 * 2 + 48) : (816 + 48);
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
  }

  // ─── Initialize ─────────────────────────────────────────────

  goTo(0);
  initCardEditor({ readOnly: true });

  // Reveal now that backgrounds are loaded
  container.style.transition = 'opacity 0.3s';
  container.style.opacity = '1';
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
    <div class="cover-card">
      <img class="cover-page__logo" src="../assets/ses-logo.svg" alt="SES Risk Solutions">
      <div class="cover-page__contract">${data.contract}</div>
      <div class="cover-page__program">${data.title}</div>
      <div class="cover-page__subtitle">Contract Review</div>
    </div>
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

        <!-- Top section: Narrative left, KPIs right -->
        <div style="display: flex; gap: var(--gap-sm); flex: 3;">

          <!-- Who We Are -->
          <div class="observations-panel" style="flex: 3; background: var(--ses-white); border-radius: var(--radius); overflow: hidden; box-shadow: 0 1px 3px rgba(10,83,131,0.1); display: flex; flex-direction: column;">
            <div class="section-header" style="border-radius: 0;">Who We Are</div>
            <div class="observations-panel__body" style="padding: 14px 16px; font-size: 12px; color: var(--ses-text-muted); line-height: 1.6; flex: 1; display: flex; flex-direction: column; justify-content: center;">
              <p style="margin: 0 0 8px 0;">As a program manager, we differentiate ourselves with <strong style="color: var(--ses-text);">strong performance</strong>, made possible by our emphasis on <strong style="color: var(--ses-text);">risk management strategies</strong>, combining meaningful data, technology, and experience. Our <strong style="color: var(--ses-text);">proprietary policy administration system</strong> is API-enabled and offers web-based self-service. We pride ourselves in maintaining longstanding relationships with many of the industry's largest and most reputable brokers, wholesalers, and networks to distribute our program to their investor-clients.</p>
              <p style="margin: 0;">SES has a history of serving <strong style="color: var(--ses-text);">niche insurance markets</strong>. Our core programs are designed to insure properties held in trust and owned by real estate investors. In our REI program, we focus on <strong style="color: var(--ses-text);">innovation, risk management, and client solutions</strong> to serve the ever-changing market.</p>
            </div>
          </div>

          <!-- By the Numbers -->
          <div class="observations-panel" style="flex: 2; background: var(--ses-white); border-radius: var(--radius); overflow: hidden; box-shadow: 0 1px 3px rgba(10,83,131,0.1);">
            <div class="section-header" style="border-radius: 0;">By the Numbers</div>
            <div class="observations-panel__body" style="padding: 14px; display: flex; flex-direction: column; justify-content: space-evenly; flex: 1;">
              ${overviewStat('35+', 'Years in Business')}
              ${overviewStat('85K+', 'Properties Insured')}
              ${overviewStat('$181M', 'Annual GWP')}
              ${overviewStat('$15B', 'Total Insured Value')}
              ${overviewStat('21.4%', 'CAGR, Past 5 Years')}
              ${overviewStat('81.6%', 'Account Retention')}
              ${overviewStat('1K+', 'Agent Relationships')}
              ${overviewStat('8K+', 'Investor Clients')}
            </div>
          </div>

        </div>

        <!-- Core Competencies — full width text card -->
        <div class="observations-panel" style="flex: 2; background: var(--ses-white); border-radius: var(--radius); overflow: hidden; box-shadow: 0 1px 3px rgba(10,83,131,0.1); display: flex; flex-direction: column;">
          <div class="section-header" style="border-radius: 0;">Core Competencies</div>
          <div class="observations-panel__body" style="padding: 10px 16px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-size: 12px; color: var(--ses-text-muted); line-height: 1.45;">
              <p style="margin: 0 0 5px 0;"><strong style="color: var(--ses-text);">Data-Driven Underwriting:</strong> In-house actuarial team backed by Alliant Underwriting Solutions. Technical pricing model with loss trend analysis. AI/ML-powered risk scoring at zip-code level using aerial imagery and proximity signals. Precision CAT modeling via RMS outputs and construction modifiers.</p>
              <p style="margin: 0 0 5px 0;"><strong style="color: var(--ses-text);">Service & Technology:</strong> Tech-enabled, API-ready solutions with self-service platforms. Proprietary quoting and policy management systems (TIMS, QUBIE). PowerBI dashboards delivering live KPIs. Automated scoring, segmentation, and ML workflows.</p>
              <p style="margin: 0;"><strong style="color: var(--ses-text);">Distribution:</strong> Longstanding partnerships with top producers across multiple channels. No direct competition with brokers, wholesalers, and networks. Over 18,000 accounts generating nearly $360M in gross written premium.</p>
            </div>
          </div>
        </div>

        <!-- Product Segments — 2x2 grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: var(--gap-sm); flex: 5;">
          ${productSegmentCard('SFR Portfolio', [
            '<strong>Premium:</strong> $56M',
            '<strong>Stats:</strong> $1,100 avg premium, 51k assets, 1,758 accounts, 29 assets/account',
            '<strong>Scope:</strong> Core business supporting investors with 5+ properties, mid-size portfolios and property managers',
            '<strong>Strategy:</strong> Expand product offering and geographic spread to achieve performance targets. Establish and market a product designed for large accounts.',
          ])}
          ${productSegmentCard('Individual Asset', [
            '<strong>Premium:</strong> $12M',
            '<strong>Stats:</strong> $1,852 avg premium, 6,502 assets',
            '<strong>Scope:</strong> Provides automated, self-service UW platform for brokers and insureds',
            '<strong>Strategy:</strong> Focus on program reach including geographic expansion and eligibility tiers. Adapt user experience to improve retention. Tap into different distribution channels and create API connections to serve a wide range of customers.',
          ])}
          ${productSegmentCard('Multifamily Portfolio', [
            '<strong>Premium:</strong> $3.9M',
            '<strong>Stats:</strong> $5,000 avg premium, 770 assets, 179 accounts, avg. of 4 assets/account',
            '<strong>Scope:</strong> Supports MF portfolios between $1M and $30M',
            '<strong>Strategy:</strong> Still seeking solutions for large apartment complexes and higher risk locations.',
          ])}
          ${productSegmentCard('Roadmap to Continued Market Relevance', [
            'Large account and BTR solutions',
            'Expanded eligibility criteria for individual asset program',
            'General Liability coverage considerations (GSE compliant)',
            'Retrospective refunds for loss free/low loss results (property-only)',
            'Focus on targeted growth states and improved spread of risk',
            'Enhanced user experience across platforms',
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
      <div style="min-width: 56px; background: var(--ses-navy); color: #fff; padding: 3px 8px; border-radius: 5px; font-size: 12px; font-weight: 700; text-align: center;">${value}</div>
      <div style="font-size: 11px; font-weight: 600; color: var(--ses-text); text-transform: uppercase; letter-spacing: 0.3px;">${label}</div>
    </div>
  `;
}

function productSegmentCard(title, bullets) {
  return `
    <div class="observations-panel" style="background: var(--ses-white); border-radius: var(--radius); overflow: hidden; box-shadow: 0 1px 3px rgba(10,83,131,0.1); display: flex; flex-direction: column; min-height: 0;">
      <div class="section-header" style="border-radius: 0;">${title}</div>
      <div class="observations-panel__body" style="padding: 0;">
      <ul style="padding: 6px 12px 8px 24px; margin: 0; display: flex; flex-direction: column; gap: 2px; flex: 1;">
        ${bullets.map(b => `<li style="font-size: 14px; color: var(--ses-text-muted); line-height: 1.4;">${b}</li>`).join('')}
      </ul>
      </div>
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
  page.className = 'cover-page back-cover';
  page.innerHTML = `
    <div class="cover-card">
      <img class="cover-page__logo" src="../assets/ses-logo.svg" alt="SES Risk Solutions">
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

function buildHomeButton() {
  const btn = document.createElement('button');
  btn.className = 'pres-home';
  btn.title = 'Return to Home';
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
  return btn;
}

