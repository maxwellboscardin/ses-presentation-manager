import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const presentations = [
  '1258-presentation',
  '1334-ceg-presentation',
  '1334-ces-presentation',
  '1465-presentation',
  '1097-presentation',
  '3757-presentation'
];

async function generatePDFs() {
  // Create pdfs directory
  await mkdir(join(__dirname, 'pdfs'), { recursive: true });

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const name of presentations) {
    console.log(`Generating PDF for ${name}...`);

    const page = await browser.newPage();

    // Set viewport to match spread size (17" x 11" at 96 DPI)
    await page.setViewport({
      width: 1632,  // 17" wide (two 8.5" pages)
      height: 1056, // 11" tall
      deviceScaleFactor: 2 // Higher resolution for better quality
    });

    // Navigate to the presentation
    await page.goto(`http://localhost:8080/output/${name}.html`, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the total number of sections
    const sectionCount = await page.evaluate(() => {
      return document.querySelectorAll('.pres-section').length;
    });

    console.log(`  Found ${sectionCount} sections, navigating through each...`);

    // Navigate through each section to trigger chart rendering
    // Use arrow keys to navigate (triggers the presentation's built-in navigation)
    for (let i = 1; i < sectionCount; i++) {
      await page.keyboard.press('ArrowRight');
      // Wait for charts to render
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Go back to the start
    for (let i = 1; i < sectionCount; i++) {
      await page.keyboard.press('ArrowLeft');
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`  All sections rendered, preparing for PDF...`);

    // Now emulate print media
    await page.emulateMediaType('print');

    // Force all sections to be visible and stack properly for PDF
    await page.evaluate(() => {
      // Remove navigation elements
      document.querySelectorAll('.pres-nav, .pres-dots, .pres-label, .pres-home, .pres-replay, .viewer-toolbar').forEach(el => el.remove());

      // Remove box shadows and prevent card breaks for cleaner PDF
      const style = document.createElement('style');
      style.textContent = `
        .page, .card, .section-header, .kpi-box, .observations-panel,
        .cover-page, .cover-card { box-shadow: none !important; }
        .card, .observations-panel { page-break-inside: avoid !important; }
        svg, svg * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      `;
      document.head.appendChild(style);

      // Make all sections visible and stack them
      const sections = document.querySelectorAll('.pres-section');
      sections.forEach((section, index) => {
        // Reset positioning
        section.style.display = 'flex';
        section.style.position = 'relative';
        section.style.transform = 'none';
        section.style.top = 'auto';
        section.style.left = 'auto';
        section.style.marginBottom = '0';
        section.style.opacity = '1';
        section.style.visibility = 'visible';

        // Page break controls
        section.style.pageBreakAfter = 'always';
        section.style.pageBreakBefore = 'auto';
        section.style.pageBreakInside = 'avoid';

        // For spreads, keep pages side by side
        if (section.classList.contains('pres-section--spread')) {
          section.style.display = 'flex';
          section.style.flexDirection = 'row';

          // Prevent individual pages from breaking
          const pages = section.querySelectorAll('.page');
          pages.forEach(page => {
            page.style.pageBreakAfter = 'auto';
            page.style.pageBreakInside = 'avoid';
            page.style.boxShadow = 'none';
          });
        }
      });

      // Remove the last section's page break
      if (sections.length > 0) {
        sections[sections.length - 1].style.pageBreakAfter = 'auto';
      }

      // Reset body styles for printing
      document.body.style.overflow = 'visible';
      document.body.style.height = 'auto';
    });

    // Wait a bit for layout to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate PDF
    await page.pdf({
      path: join(__dirname, 'pdfs', `${name}.pdf`),
      format: 'Letter',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    });

    console.log(`  ✓ ${name}.pdf created`);
    await page.close();
  }

  await browser.close();
  console.log('\nAll PDFs generated successfully in ./pdfs/');
}

generatePDFs().catch(console.error);
