/**
 * generate-pdf.mjs — German-compliant PDF generator with consistent page output.
 *
 * Usage:
 *   node scripts/generate-pdf.mjs <input-html> <output-pdf> [--max-pages=1] [--type=cv|cover-letter] [--photo=PATH|none|default]
 *
 * Key fixes over previous version:
 *   1. Passes baseURL to page.setContent() so fonts load from ./fonts/ paths correctly.
 *      This was the root cause of inconsistent page counts — without it, Playwright
 *      fell back to system fonts (different metrics = different page heights).
 *   2. Awaits document.fonts.ready before generating PDF, ensuring all glyphs are
 *      rendered in the correct typeface before pagination is calculated.
 *   3. Injects @page { size: A4; margin: 0; } override CSS to guarantee page dimensions
 *      even if the template's @page rule is overridden by browser defaults.
 *
 * Photo policy (vault decision 2026-08-06, active):
 *   - DEFAULT = photo OFF. Tech CV targets (SAP, carbonmaker/carbmee, eternal.ag,
 *     quantum.systems) are generated WITHOUT a photo. No photo is injected unless
 *     explicitly opted in.
 *   - Opt in with --photo=PATH (or --photo=default for data/Bewerbungsfoto.jpg) when
 *     generating for Mittelstand / financial targets that expect a photo. The photo
 *     asset data/Bewerbungsfoto.jpg is retained for that use.
 *   - --photo=none explicitly forces photo OFF (same as default).
 *   - A rendered PDF that still contains a photo placeholder string ("Bewerbungsfoto",
 *     "35 × 45", etc.) FAILS the build via the placeholder gate — it must never ship.
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { execFileSync, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PHOTO = path.resolve(__dirname, '../data/Bewerbungsfoto.jpg');

// ─── CLI argument parser ─────────────────────────────────────────────────────

function parseArgs(argv) {
  const positional = [];
  let maxPages = null;
  let type = 'cv';
  let photo = 'none'; // policy default: photo OFF for tech CVs

  for (const arg of argv) {
    if (arg.startsWith('--max-pages=')) {
      maxPages = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--type=')) {
      type = arg.split('=')[1];
    } else if (arg.startsWith('--photo=')) {
      photo = arg.split('=')[1];
    } else {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    console.error('Usage: generate-pdf.mjs <input-html> <output-pdf> [--max-pages=1] [--type=cv|cover-letter] [--photo=PATH|none|default]');
    console.error('  Photo policy (2026-08-06): OFF by default for tech CVs. Opt in with --photo=PATH');
    console.error('  or --photo=default (uses data/Bewerbungsfoto.jpg) for Mittelstand/financial targets.');
    process.exit(1);
  }

  if (maxPages === null) {
    maxPages = type === 'cover-letter' ? 1 : 1; // German standard: always 1 page
  }

  return { inputPath: positional[0], outputPath: positional[1], photoPath: photo, maxPages, type };
}

// ─── Photo injection ─────────────────────────────────────────────────────────

/**
 * Resolve the --photo= flag to an absolute path, or null when photo is OFF.
 * 'none' or omitted → null (photo OFF). 'default' → data/Bewerbungsfoto.jpg.
 */
function resolvePhotoPath(photoPathArg) {
  if (!photoPathArg || photoPathArg === 'none') return null;
  if (photoPathArg === 'default') return DEFAULT_PHOTO;
  return path.isAbsolute(photoPathArg) ? photoPathArg : path.resolve(process.cwd(), photoPathArg);
}

/**
 * Replace the .photo-placeholder div (if any) with a base64-embedded photo <img>.
 *
 * Returns { html, warnings }. When photoPath is null (policy OFF) the HTML is
 * returned unchanged — if it still contains a placeholder, the downstream
 * placeholder gate will fail the build rather than ship a leaked placeholder.
 * Never throws on a missing photo — it logs a warning and returns the HTML
 * unchanged so the placeholder (or empty photo box) is surfaced to the caller.
 */
function injectPhoto(html, photoPath) {
  const warnings = [];
  const hasPlaceholder = /class="photo-placeholder"/.test(html);

  if (!photoPath) {
    if (hasPlaceholder) {
      warnings.push('photo policy OFF — .photo-placeholder remains in HTML (gate will fail if it renders)');
    }
    return { html, warnings };
  }

  if (!fs.existsSync(photoPath)) {
    warnings.push(`photo not found: ${photoPath}${hasPlaceholder ? ' (placeholder will remain)' : ''}`);
    console.warn(`⚠   Photo not found at ${photoPath}${hasPlaceholder ? ' — placeholder will show' : ''}`);
    return { html, warnings };
  }

  const ext = path.extname(photoPath).slice(1).toLowerCase();
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] || 'image/jpeg';
  const data = fs.readFileSync(photoPath).toString('base64');
  const imgTag = `<img src="data:${mime};base64,${data}" alt="Bewerbungsfoto">`;

  if (hasPlaceholder) {
    const newHtml = html.replace(/<div class="photo-placeholder">[\s\S]*?<\/div>/g, imgTag);
    console.log(`📷  Injected photo: ${path.basename(photoPath)} (replaced placeholder)`);
    return { html: newHtml, warnings };
  }

  // No placeholder marker in the markup — inject the <img into the first .photo-box if one exists.
  if (/<div class="photo-box">/.test(html)) {
    const newHtml = html.replace(/<div class="photo-box">/, `<div class="photo-box">${imgTag}`);
    warnings.push('no .photo-placeholder marker found — injected <img> into first .photo-box');
    console.log(`📷  Injected photo: ${path.basename(photoPath)} (no placeholder marker — fell back to .photo-box)`);
    return { html: newHtml, warnings };
  }

  // No photo-box and no placeholder — nothing to attach to.
  warnings.push('no .photo-box or .photo-placeholder found in HTML — photo not injected');
  return { html, warnings };
}

// ─── Page counter (poppler-utils) ─────────────────────────────────────────────

function countPages(pdfPath) {
  try {
    const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf-8' });
    const match = info.match(/^Pages:\s+(\d+)/m);
    return match ? parseInt(match[1], 10) : -1;
  } catch {
    // poppler-utils not installed — skip validation
    return -1;
  }
}

// ─── Placeholder verification (poppler-utils) ────────────────────────────────

const PLACEHOLDER_MARKERS = ['Bewerbungsfoto', 'Professionelles Bewerbungsfoto', '[Foto]', '35 × 45', '35mm'];

/**
 * Placeholder gate: extract the rendered PDF text and FAIL the build (non-zero
 * exit) if any photo-placeholder string survived into the final PDF. The gate
 * is a hard stop, not a warning — a CV with "Bewerbungsfoto" or "35 × 45"
 * placeholder text must never ship.
 *
 * Returns the list of offending markers (empty = clean). Exits(1) on hits.
 */
function assertNoPlaceholder(pdfPath) {
  try {
    const text = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf-8' });
    const hits = PLACEHOLDER_MARKERS.filter((m) => text.includes(m));
    if (hits.length) {
      console.error(`❌  PLACEHOLDER GATE FAILED: ${path.basename(pdfPath)} still contains: ${hits.join(', ')}`);
      console.error(`    A photo placeholder leaked into the rendered PDF. Fix the HTML, or`);
      console.error(`    opt in deliberately with --photo=PATH (or --photo=default) if a photo is intended.`);
      return hits;
    }
    console.log(`    ✅  No photo placeholder text leaked into the PDF.`);
  } catch {
    // pdftotext unavailable — skip the gate
    console.warn(`    ⚠️  pdftotext unavailable — placeholder gate skipped.`);
  }
  return [];
}

// ─── Rule 5 style gate (Wiring Instructions §3 — same place as PDF generation) ──

const LINT_STYLE_GUIDE_PATH = path.resolve(__dirname, 'lint-style-guide.mjs');
const CV_TRUTH_PATH = path.resolve(__dirname, '../cv.md');

/**
 * Run the executable Rule 5 style gate (lint-style-guide.mjs) on a generated
 * CV HTML before it renders. Aborts the build (throws) when the gate exits
 * non-zero, so a CV with banned phrases, untraceable numbers, or a language
 * mismatch never ships as a PDF.
 *
 * Runs in --cv-html mode: German date tokens (10.2021 / 09.2024) are excluded
 * from numeral extraction, config/profile.yml is added as secondary truth for
 * legal/visa figures, and DE/EN number separator formats are interchangeable.
 *
 * @param {string} htmlPath - Absolute path to the generated CV .html file.
 */
function runStyleGate(htmlPath) {
  try {
    execFileSync(
      process.execPath,
      [LINT_STYLE_GUIDE_PATH, htmlPath, `--cv=${CV_TRUTH_PATH}`, '--cv-html'],
      { stdio: 'inherit' }
    );
  } catch {
    throw new Error(
      `❌  STYLE GATE FAILED: ${path.basename(htmlPath)} — fix the violations above before rendering the PDF.`
    );
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
  const { inputPath, outputPath, photoPath, maxPages, type } = parseArgs(process.argv.slice(2));

  const absInput  = path.isAbsolute(inputPath)  ? inputPath  : path.join(process.cwd(), inputPath);
  const absOutput = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
  const inputDir  = path.dirname(absInput);

  if (!fs.existsSync(absInput)) {
    console.error(`❌  Input file not found: ${absInput}`);
    process.exit(1);
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(absOutput), { recursive: true });

  let htmlContent = fs.readFileSync(absInput, 'utf-8');

  // ── Rule 5 style gate: verify the generated CV HTML before rendering ──────
  // Hard stop, not a warning — a CV that fails the style guide must never
  // reach a PDF. Runs once here, covering all downstream render paths.
  runStyleGate(absInput);

  // ── Photo injection (policy-aware; default OFF for tech CVs) ─────────────
  const photo = resolvePhotoPath(photoPath);
  const { html: htmlWithPhoto, warnings: photoWarnings } = injectPhoto(htmlContent, photo);
  htmlContent = htmlWithPhoto;

  // ── Pass 1: Normal render ─────────────────────────────────────────────────
  console.log(`📄  Generating ${type} PDF: ${path.basename(absOutput)}`);
  await renderPDF(htmlContent, absOutput, inputDir);

  const pages = countPages(absOutput);

  if (pages === -1) {
    console.log(`✅  PDF generated (install poppler-utils for page validation)`);
    console.log(`    Output: ${absOutput}`);
    if (photoWarnings.length) console.warn(`    ⚠  ${photoWarnings.join(' | ')}`);
    // Gate still runs when poppler is present (pdfinfo may fail for other reasons).
    if (assertNoPlaceholder(absOutput).length) process.exit(1);
    return;
  }

  console.log(`    Pages: ${pages} / ${maxPages} max`);

  if (pages <= maxPages) {
    console.log(`✅  PDF generated: ${pages} page(s) — ${path.basename(absOutput)}`);
    if (photoWarnings.length) console.warn(`⚠️  ${photoWarnings.join(' | ')}`);
    if (assertNoPlaceholder(absOutput).length) process.exit(1);
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
    if (photoWarnings.length) console.warn(`⚠️  ${photoWarnings.join(' | ')}`);
    if (assertNoPlaceholder(absOutput).length) process.exit(1);
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
