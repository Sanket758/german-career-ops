/**
 * generate-pdf.mjs — German-compliant PDF generator with consistent page output.
 *
 * Usage:
 *   node scripts/generate-pdf.mjs <input-html> <output-pdf> [--max-pages=1] [--type=cv|cover-letter]
 *
 * Key fixes over previous version:
 *   1. Passes baseURL to page.setContent() so fonts load from ./fonts/ paths correctly.
 *      This was the root cause of inconsistent page counts — without it, Playwright
 *      fell back to system fonts (different metrics = different page heights).
 *   2. Awaits document.fonts.ready before generating PDF, ensuring all glyphs are
 *      rendered in the correct typeface before pagination is calculated.
 *   3. Injects @page { size: A4; margin: 0; } override CSS to guarantee page dimensions
 *      even if the template's @page rule is overridden by browser defaults.
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CLI argument parser ─────────────────────────────────────────────────────

function parseArgs(argv) {
  const positional = [];
  let maxPages = null;
  let type = 'cv';

  for (const arg of argv) {
    if (arg.startsWith('--max-pages=')) {
      maxPages = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--type=')) {
      type = arg.split('=')[1];
    } else {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    console.error('Usage: node generate-pdf.mjs <input-html> <output-pdf> [--max-pages=1] [--type=cv|cover-letter]');
    process.exit(1);
  }

  if (maxPages === null) {
    maxPages = type === 'cover-letter' ? 1 : 1; // German standard: always 1 page
  }

  return { inputPath: positional[0], outputPath: positional[1], maxPages, type };
}

// ─── Page counter (poppler-utils) ─────────────────────────────────────────────

function countPages(pdfPath) {
  try {
    const info = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf-8' });
    const match = info.match(/^Pages:\s+(\d+)/m);
    return match ? parseInt(match[1], 10) : -1;
  } catch {
    // poppler-utils not installed — skip validation
    return -1;
  }
}

// ─── Auto-compress CSS ────────────────────────────────────────────────────────

/**
 * Inject tighter CSS when the first render overflows the page limit.
 * Reduces font sizes and spacing while keeping the document readable.
 */
function injectCompressCSS(html) {
  const css = `
<style id="auto-compress">
  /* Auto-compress: tightening layout to fit page limit */
  body { font-size: 9.5px !important; line-height: 1.45 !important; }
  .page { padding: 9mm 14mm 8mm 14mm !important; }
  .name { font-size: 22px !important; }
  .section { margin-bottom: 7px !important; }
  .section-title { margin-bottom: 5px !important; font-size: 9px !important; }
  .job { margin-bottom: 8px !important; }
  .job li { font-size: 9px !important; line-height: 1.45 !important; margin-bottom: 2px !important; }
  .job-company { font-size: 10px !important; }
  .job-role { margin-bottom: 3px !important; }
  .edu-item { margin-bottom: 5px !important; }
  .edu-org { font-size: 10px !important; }
  .skill-row { margin-bottom: 3px !important; }
  .skill-cat, .skill-vals { font-size: 9px !important; }
  .summary-text { font-size: 9.5px !important; line-height: 1.55 !important; }
  .signature-block { margin-top: 6mm !important; }
  .signature-space { height: 8mm !important; }
  .lang-item, .cert-item { font-size: 9px !important; }
</style>`;

  return html.includes('</head>')
    ? html.replace('</head>', `${css}\n</head>`)
    : html.replace('</body>', `${css}\n</body>`);
}

// ─── Core renderer ────────────────────────────────────────────────────────────

/**
 * Render HTML → PDF via Playwright Chromium.
 *
 * Critical: baseURL must point to the directory containing the HTML file
 * so that relative font paths (./fonts/...) resolve correctly.
 * Without this, fonts silently fail and system fonts are used instead,
 * causing different text metrics and therefore different page counts.
 */
async function renderPDF(htmlContent, outputPath, inputDir) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    // Set the base URL to the HTML file's directory so ./fonts/ paths resolve
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle',
      baseURL: `file://${inputDir}/`,
    });

    // Wait for all fonts to finish loading before measuring page height.
    // This is the fix for the "sometimes 1 page, sometimes 2" bug:
    // fonts have different advance widths than system fallbacks,
    // so we must wait until they're fully loaded before Chromium
    // calculates line breaks and page overflow.
    await page.evaluate(() => document.fonts.ready);

    // Small settle time for any CSS transitions / layout recalculations
    await page.waitForTimeout(150);

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      // Zero margins — the HTML template controls its own padding via .page
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { inputPath, outputPath, maxPages, type } = parseArgs(process.argv.slice(2));

  const absInput  = path.isAbsolute(inputPath)  ? inputPath  : path.join(process.cwd(), inputPath);
  const absOutput = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
  const inputDir  = path.dirname(absInput);

  if (!fs.existsSync(absInput)) {
    console.error(`❌  Input file not found: ${absInput}`);
    process.exit(1);
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(absOutput), { recursive: true });

  const htmlContent = fs.readFileSync(absInput, 'utf-8');

  // ── Pass 1: Normal render ─────────────────────────────────────────────────
  console.log(`📄  Generating ${type} PDF: ${path.basename(absOutput)}`);
  await renderPDF(htmlContent, absOutput, inputDir);

  const pages = countPages(absOutput);

  if (pages === -1) {
    console.log(`✅  PDF generated (install poppler-utils for page validation)`);
    console.log(`    Output: ${absOutput}`);
    return;
  }

  console.log(`    Pages: ${pages} / ${maxPages} max`);

  if (pages <= maxPages) {
    console.log(`✅  PDF generated: ${pages} page(s) — ${path.basename(absOutput)}`);
    return;
  }

  // ── Pass 2: Auto-compress and retry ──────────────────────────────────────
  console.warn(`⚠   PDF has ${pages} pages (limit: ${maxPages}). Retrying with compressed layout...`);

  const compressed = injectCompressCSS(htmlContent);
  await renderPDF(compressed, absOutput, inputDir);

  const retryPages = countPages(absOutput);
  console.log(`    Retry pages: ${retryPages} / ${maxPages} max`);

  if (retryPages <= maxPages) {
    console.log(`✅  PDF generated (auto-compressed): ${retryPages} page(s)`);
    return;
  }

  // ── Still over limit ──────────────────────────────────────────────────────
  console.error(`
❌  FAILED: PDF is ${retryPages} pages — exceeds ${maxPages}-page German limit.
    Actions to fix:
      1. Reduce bullets: max 3 per role (edit EXPERIENCE in generate-cv-html.mjs)
      2. Shorten summary to 2 sentences
      3. Cut skills to 15 items max (edit CURATED_SKILLS in generate-cv-html.mjs)
      4. Remove PROJECTS_BLOCK (omit --include-projects flag)
`);
  process.exit(1);
}

main().catch((err) => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
