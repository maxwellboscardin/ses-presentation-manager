// Brochure — Program Guide 2026
// Follows contract-presentation.js pattern: fetch JSON, build DOM sections, wire nav + auto-scale

const DATA_URL = '../data/brochure/program-guide-2026.json';

// ─── Detail Section Icons (navy stroke + orange accent on white bg) ─────

const ICONS = {
  eligible: `<svg viewBox="0 0 24 24" fill="none" stroke="#0A5383" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01" stroke="#E97121"/>
  </svg>`,
  ineligible: `<svg viewBox="0 0 24 24" fill="none" stroke="#0A5383" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15" stroke="#E97121"/>
    <line x1="9" y1="9" x2="15" y2="15" stroke="#E97121"/>
  </svg>`,
  coverage: `<svg viewBox="0 0 24 24" fill="none" stroke="#0A5383" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10" stroke="#E97121"/>
  </svg>`,
  policyFeatures: `<svg viewBox="0 0 24 24" fill="none" stroke="#0A5383" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12" stroke="#E97121"/>
    <line x1="9" y1="15" x2="15" y2="15" stroke="#E97121"/>
  </svg>`
};

// ─── Contact icons ───────────────────────────────────────────────────────

const CONTACT_ICONS = {
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="#0A5383" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>`,
  email: `<svg viewBox="0 0 24 24" fill="none" stroke="#0A5383" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>`,
  website: `<svg viewBox="0 0 24 24" fill="none" stroke="#0A5383" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`
};

// ─── Main Render Function ────────────────────────────────────────────────

export async function renderBrochure(container) {
  container.style.opacity = '0';

  // Preload background images
  const bgImages = ['../assets/bg-cover.png', '../assets/bg-left.png', '../assets/bg-right.png'];
  const preloads = bgImages.map(src => new Promise(resolve => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
  }));

  // Fetch data
  const ts = Date.now();
  const [response] = await Promise.all([
    fetch(`${DATA_URL}?t=${ts}`, { cache: 'no-store' }),
    ...preloads
  ]);
  const data = await response.json();

  let currentIndex = 0;

  // ─── Build Sections ──────────────────────────────────────

  // Section 0: Cover (single)
  const coverSection = buildSection('single');
  coverSection.appendChild(buildCoverPage(data));

  // Section 1: Spread - Intro (left) + Overview (right)
  const introSection = buildSection('spread');
  introSection.appendChild(buildIntroPage(data));
  introSection.appendChild(buildOverviewPage(data));

  // Sections 2-4: Product spreads
  const productSections = data.products.map(product => {
    const section = buildSection('spread');
    section.appendChild(buildProductIntroPage(product));
    section.appendChild(buildProductDetailPage(product));
    return section;
  });

  const sections = [coverSection, introSection, ...productSections];

  // Add all sections to container
  sections.forEach(s => container.appendChild(s));

  // ─── Navigation ────────────────────────────────────────────

  const prevBtn = buildNavButton('prev');
  const nextBtn = buildNavButton('next');
  container.appendChild(prevBtn);
  container.appendChild(nextBtn);

  // Download button
  container.appendChild(buildDownloadButton());

  prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
  nextBtn.addEventListener('click', () => goTo(currentIndex + 1));

  document.addEventListener('keydown', (e) => {
    if (!e.isTrusted) return;
    if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(currentIndex + 1); }
  });

  // ─── Auto-scale ─────────────────────────────────────────────

  function autoScale() {
    sections.forEach(section => {
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
    updateNav();
  }

  function updateNav() {
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === sections.length - 1;
  }

  // ─── Initialize ─────────────────────────────────────────────

  goTo(0);
  container.style.transition = 'opacity 0.3s';
  container.style.opacity = '1';
}

// ─── Section Builder ───────────────────────────────────────────────────

function buildSection(type) {
  const section = document.createElement('div');
  section.className = `pres-section pres-section--${type === 'spread' ? 'spread' : 'single'}`;
  return section;
}

// ─── Cover Page ────────────────────────────────────────────────────────

function buildCoverPage(data) {
  const page = document.createElement('div');
  page.className = 'cover-page brochure-cover';
  page.innerHTML = `
    <div class="cover-card">
      <img class="cover-page__logo" src="../assets/ses-logo.svg" alt="SES Risk Solutions">
      <div class="cover-page__contract">${data.title}</div>
      <div class="brochure-cover__subtitle">${data.subtitle}</div>
      <div class="brochure-cover__year">${data.year}</div>
    </div>
  `;
  return page;
}

// ─── Intro Page (left of spread 1) ────────────────────────────────────

function buildIntroPage(data) {
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="brochure-intro">
      <div class="brochure-intro__headline">${data.intro.headline}</div>
      <div class="brochure-intro__body">${data.intro.body}</div>
      <div class="brochure-intro__stats">
        ${data.intro.stats.map(s => `
          <div class="brochure-stat">
            <div class="brochure-stat__value">${s.value}</div>
            <div class="brochure-stat__label">${s.label}</div>
          </div>
        `).join('')}
      </div>
      <img class="brochure-intro__logo" src="../assets/ses-logo.svg" alt="SES">
    </div>
  `;
  return page;
}

// ─── Overview Page (right of spread 1) ─────────────────────────────────

function buildOverviewPage(data) {
  const ov = data.overview;
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="brochure-overview">
      <div class="brochure-overview__title">Program Overview</div>

      <p class="brochure-overview__description">${ov.description}</p>

      <div class="brochure-overview__section-label">Key Capabilities</div>
      <ul class="brochure-overview__highlights">
        ${ov.highlights.map(h => `<li>${h}</li>`).join('')}
      </ul>

      <div class="brochure-overview__section-label">Our Programs</div>
      <div class="brochure-overview__products">
        ${ov.products.map(p => `
          <div class="brochure-product-block">
            <div class="brochure-product-block__name">${p.name}</div>
            <div class="brochure-product-block__premium">${p.premium}</div>
            <div class="brochure-product-block__desc">${p.description}</div>
          </div>
        `).join('')}
      </div>

      <div class="brochure-contact">
        <div class="brochure-contact__item">
          ${CONTACT_ICONS.phone}
          <span>${ov.contact.phone}</span>
        </div>
        <div class="brochure-contact__item">
          ${CONTACT_ICONS.email}
          <span>${ov.contact.email}</span>
        </div>
        <div class="brochure-contact__item">
          ${CONTACT_ICONS.website}
          <span>${ov.contact.website}</span>
        </div>
      </div>
    </div>
  `;
  return page;
}

// ─── Product Intro Page (left of product spreads) ──────────────────────

function buildProductIntroPage(product) {
  const page = document.createElement('div');
  page.className = 'page';

  const qubieBadgeHTML = product.qubieBadge
    ? `<img class="brochure-product-intro__qubie" src="../assets/brochure/qubie-logo.png" alt="QUBIE">`
    : '';

  page.innerHTML = `
    <div class="brochure-product-intro">
      <div class="brochure-product-intro__badges">
        <span class="brochure-product-intro__badge">${product.badge}</span>
        ${qubieBadgeHTML}
      </div>
      <div class="brochure-product-intro__title">${product.name}</div>
      <div class="brochure-product-intro__desc">${product.description}</div>
      <img class="brochure-product-intro__logo" src="../assets/ses-logo.svg" alt="SES">
    </div>
  `;
  return page;
}

// ─── Product Detail Page (right of product spreads) ────────────────────

function buildProductDetailPage(product) {
  const page = document.createElement('div');
  page.className = 'page';

  const detailSections = [
    { key: 'eligible', label: 'Eligible Properties', icon: ICONS.eligible },
    { key: 'ineligible', label: 'Ineligible Properties', icon: ICONS.ineligible },
    { key: 'coverage', label: 'Coverage Highlights', icon: ICONS.coverage },
    { key: 'policyFeatures', label: 'Policy Features', icon: ICONS.policyFeatures }
  ];

  page.innerHTML = `
    <div class="brochure-product-detail">
      <div class="brochure-product-detail__title">${product.name} - Details</div>
      <div class="brochure-detail-grid">
        ${detailSections.map(s => `
          <div class="brochure-detail-section">
            <div class="brochure-detail-section__header">
              <div class="brochure-detail-section__icon">${s.icon}</div>
              <div class="brochure-detail-section__label">${s.label}</div>
            </div>
            <div class="brochure-detail-section__body">
              <ul>
                ${(product[s.key] || []).map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  return page;
}

// ─── Nav Buttons ───────────────────────────────────────────────────────

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

// ─── Download Button ───────────────────────────────────────────────────

function buildDownloadButton() {
  const btn = document.createElement('button');
  btn.className = 'brochure-download';
  btn.title = 'Print / Save as PDF';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    Save as PDF
  `;
  btn.addEventListener('click', () => window.print());
  return btn;
}
