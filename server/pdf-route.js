import { Router } from 'express';
import puppeteer from 'puppeteer';
import archiver from 'archiver';
import { execSync } from 'child_process';
import { INTERNAL_SECRET } from './auth.js';

const router = Router();

const COLLECTIONS = {
  london: [
    '1258-presentation',
    '1334-ceg-presentation',
    '1334-ces-presentation',
    '1465-presentation',
    '1097-presentation',
    '3757-presentation',
  ],
  zurich: [
    'zurich-presentation',
  ],
};

// Simple mutex to prevent concurrent generation
let generating = false;

function getChromiumPath() {
  // 1. Explicit env var
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log(`[PDF] Using PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // 2. System chromium (nix, apt, etc.)
  for (const cmd of ['chromium', 'chromium-browser', 'google-chrome-stable']) {
    try {
      const path = execSync(`which ${cmd}`, { encoding: 'utf8' }).trim();
      console.log(`[PDF] Found system browser: ${path}`);
      return path;
    } catch { /* not found */ }
  }
  // 3. Let Puppeteer use its bundled Chromium (local dev)
  console.log('[PDF] No system browser found, using Puppeteer bundled Chromium');
  return undefined;
}

router.get('/:collection', async (req, res) => {
  const { collection } = req.params;
  const presentations = COLLECTIONS[collection];

  if (!presentations) {
    return res.status(404).json({ error: `Unknown collection: ${collection}` });
  }

  if (generating) {
    return res.status(429).json({ error: 'PDF generation already in progress. Please wait.' });
  }

  generating = true;
  let browser;

  try {
    const PORT = process.env.PORT || 8080;
    const executablePath = getChromiumPath();

    console.log(`[PDF] Starting generation for ${collection} (${presentations.length} presentations)`);
    if (executablePath) console.log(`[PDF] Using Chromium at: ${executablePath}`);

    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const pdfBuffers = [];

    for (const name of presentations) {
      console.log(`[PDF] Rendering ${name}...`);
      const page = await browser.newPage();

      // Set internal auth header to bypass login
      await page.setExtraHTTPHeaders({
        'X-PDF-Internal': INTERNAL_SECRET,
      });

      // Set viewport to match spread size (17" x 11" at 96 DPI)
      await page.setViewport({
        width: 1632,
        height: 1056,
        deviceScaleFactor: 2,
      });

      await page.goto(`http://localhost:${PORT}/output/${name}.html`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });

      // Wait for initial render
      await new Promise(r => setTimeout(r, 2000));

      // Get total sections and navigate through each to trigger chart rendering
      const sectionCount = await page.evaluate(() =>
        document.querySelectorAll('.pres-section').length
      );
      console.log(`[PDF]   ${sectionCount} sections, navigating to render charts...`);

      for (let i = 1; i < sectionCount; i++) {
        await page.keyboard.press('ArrowRight');
        await new Promise(r => setTimeout(r, 1500));
      }

      // Navigate back to start
      for (let i = 1; i < sectionCount; i++) {
        await page.keyboard.press('ArrowLeft');
        await new Promise(r => setTimeout(r, 100));
      }

      // Switch to print media
      await page.emulateMediaType('print');

      // Inject print styles: remove nav, show all sections, center singles
      await page.evaluate(() => {
        // Remove navigation elements
        document.querySelectorAll(
          '.pres-nav, .pres-dots, .pres-label, .pres-home, .pres-replay, .viewer-toolbar'
        ).forEach(el => el.remove());

        // Add print cleanup styles
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
        sections.forEach(section => {
          section.style.display = 'flex';
          section.style.position = 'relative';
          section.style.transform = 'none';
          section.style.top = 'auto';
          section.style.left = 'auto';
          section.style.marginBottom = '0';
          section.style.opacity = '1';
          section.style.visibility = 'visible';
          section.style.pageBreakAfter = 'always';
          section.style.pageBreakBefore = 'auto';
          section.style.pageBreakInside = 'avoid';

          if (section.classList.contains('pres-section--spread')) {
            // Spreads: two pages side by side, fills 17"
            section.style.flexDirection = 'row';
            section.querySelectorAll('.page').forEach(pg => {
              pg.style.pageBreakAfter = 'auto';
              pg.style.pageBreakInside = 'avoid';
              pg.style.boxShadow = 'none';
            });
          } else {
            // Singles (covers): center the single page on the 17" canvas
            section.style.justifyContent = 'center';
          }
        });

        // Remove last page break
        if (sections.length > 0) {
          sections[sections.length - 1].style.pageBreakAfter = 'auto';
        }

        // Reset body for printing
        document.body.style.overflow = 'visible';
        document.body.style.height = 'auto';
      });

      // Wait for layout to settle
      await new Promise(r => setTimeout(r, 2000));

      // Generate PDF buffer (17" x 11" tabloid)
      const pdfBuffer = await page.pdf({
        width: '17in',
        height: '11in',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      pdfBuffers.push({ name: `${name}.pdf`, buffer: pdfBuffer });
      console.log(`[PDF]   Done: ${name}.pdf`);
      await page.close();
    }

    await browser.close();
    browser = null;

    // Stream zip response
    console.log(`[PDF] Zipping ${pdfBuffers.length} PDFs...`);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${collection}-presentations.zip"`,
    });

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    for (const { name, buffer } of pdfBuffers) {
      archive.append(buffer, { name });
    }

    await archive.finalize();
    console.log(`[PDF] Complete: ${collection}-presentations.zip`);
  } catch (err) {
    console.error('[PDF] Error:', err);
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  } finally {
    generating = false;
  }
});

// Diagnostic endpoint
router.get('/', (_req, res) => {
  const chromiumPath = getChromiumPath();
  res.json({
    chromiumPath: chromiumPath || 'puppeteer-bundled',
    collections: Object.keys(COLLECTIONS),
    generating,
  });
});

export default router;
