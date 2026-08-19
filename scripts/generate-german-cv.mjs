#!/usr/bin/env node
/**
 * Generate a deterministic German tabellarischer Lebenslauf PDF.
 *
 * Usage:
 *   node scripts/generate-german-cv.mjs [--photo] [--lang de|en] [--output PATH]
 */

import { mkdirSync, readFileSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { chromium } from 'playwright';
import { cvRequiredSections, generateGermanCvHtml } from './german-cv-renderer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(PROJECT_ROOT, 'output');

const args = process.argv.slice(2);
const photoEnabled = args.includes('--photo');
const langIndex = args.indexOf('--lang');
const lang = langIndex >= 0 && args[langIndex + 1] === 'en' ? 'en' : 'de';
const outputIndex = args.indexOf('--output');
const outputArg = outputIndex >= 0 ? args[outputIndex + 1] : null;

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
German CV Generator — deterministic tabellarischer Lebenslauf PDF

Usage:
  node scripts/generate-german-cv.mjs [options]

Options:
  --photo           Include the deliberately labelled photo placeholder
  --lang de|en      Output language (default: de)
  --output PATH     Output PDF path (default: output/cv-sanket-YYYY-MM-DD.pdf)
`);
  process.exit(0);
}

function outputPath() {
  if (outputArg) return isAbsolute(outputArg) ? outputArg : join(PROJECT_ROOT, outputArg);
  return join(OUTPUT_DIR, `cv-sanket-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function pdfInfo(pdfPath) {
  return execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
}

function pdfText(pdfPath) {
  return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
}

function assertPdfQuality(pdfPath, html, metrics) {
  const info = pdfInfo(pdfPath);
  const pageMatch = info.match(/^Pages:\s+(\d+)/m);
  const pages = pageMatch ? Number(pageMatch[1]) : -1;
  if (pages < 1 || pages > 2) throw new Error(`PDF page gate failed: ${pages} pages (maximum is 2)`);

  const text = pdfText(pdfPath);
  const unresolved = [...new Set([
    ...(html.match(/\{\{[^}]+\}\}/g) || []),
    ...(html.match(/\{%[^%]+%\}/g) || []),
    ...(text.match(/\{\{[^}]+\}\}/g) || []),
  ])];
  if (unresolved.length) throw new Error(`Unresolved placeholder gate failed: ${unresolved.join(', ')}`);

  const forbidden = ['undefined', 'null', '**', 'Kein Foto', 'Bewerbungsfoto'];
  if (!photoEnabled) {
    const leaked = forbidden.filter(marker => text.includes(marker));
    if (leaked.length) throw new Error(`Content gate failed; leaked markers: ${leaked.join(', ')}`);
  } else if (text.includes('Kein Foto')) {
    throw new Error('Photo gate failed: disabled-photo copy is present while photo mode is enabled');
  }

  const missingSections = (cvRequiredSections[lang] || cvRequiredSections.de)
    .filter(section => !text.includes(section));
  if (missingSections.length) throw new Error(`Required section gate failed: ${missingSections.join(', ')}`);

  const languageLeakMarkers = lang === 'de'
    ? ['PROFESSIONAL SUMMARY', 'WORK EXPERIENCE', 'TECHNICAL SKILLS', 'SELECTED PROJECTS', 'Built the', 'Developed a', 'Ensured GDPR', 'Led a team', 'Constructed OCR', 'Boosted processing', 'Fine-tuned YOLOv8', 'Berlin, Germany', 'Mumbai, India', 'Thane, India']
    : ['KURZPROFIL', 'BERUFSERFAHRUNG', 'AUSBILDUNG', 'TECHNISCHE KOMPETENZEN', 'AUSGEWÄHLTE PROJEKTE', 'Uneingeschränkt vollzeitbeschäftigbar', 'deutschlandweit umzugsbereit'];
  const languageLeaks = languageLeakMarkers.filter(marker => text.includes(marker));
  if (languageLeaks.length) throw new Error(`Language purity gate failed for ${lang}: ${languageLeaks.join(', ')}`);
  if (!text.includes('Sanket Sadashiv Gadge')) throw new Error('Identity gate failed: candidate name is missing');
  if (!text.includes('07/2025 – 08/2025') || !text.includes('10/2021 – 09/2024')) {
    throw new Error('Date gate failed: parsed employment periods are missing or malformed');
  }
  if (text.includes('Heute')) throw new Error('Date gate failed: ended roles were incorrectly rendered as Heute');
  if (!metrics.fontsReady) throw new Error('Font gate failed: document.fonts.ready did not resolve');
  if (metrics.overflowing.length) throw new Error(`Geometry gate failed: ${metrics.overflowing.join(', ')}`);

  const fonts = execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' });
  if (!/LiberationSans|Arial|Helvetica|Space ?Grotesk|DM ?Sans/i.test(fonts)) {
    throw new Error(`Embedded font gate failed; expected an embedded sans-serif font. Found:\n${fonts}`);
  }

  console.log(`QA passed: ${pages} page(s), ${metrics.sections} populated sections, fonts embedded, no unresolved placeholders, no overflow.`);
}

async function renderPdf(html, pdfPath) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);

    const metrics = await page.evaluate(() => {
      const pxPerMm = 96 / 25.4;
      const pageElement = document.querySelector('.page');
      const requiredSections = [...document.querySelectorAll('.section')];
      const overflowing = [];
      for (const element of document.querySelectorAll('.page, .header, .section, .entry, .project, .footer')) {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) overflowing.push(`${element.className || element.tagName}:empty`);
        if (rect.right > 210 * pxPerMm + 1) overflowing.push(`${element.className || element.tagName}:right-overflow`);
      }
      for (const section of requiredSections) {
        const content = [...section.children].slice(1).map(child => child.textContent.trim()).join('');
        if (!content) overflowing.push(`${section.querySelector('.section-title')?.textContent || 'section'}:empty-content`);
      }
      return {
        fontsReady: document.fonts.status === 'loaded',
        sections: requiredSections.length,
        bodyHeightMm: document.body.scrollHeight / pxPerMm,
        pageWidthMm: pageElement ? pageElement.getBoundingClientRect().width / pxPerMm : 0,
        overflowing,
      };
    });

    mkdirSync(dirname(pdfPath), { recursive: true });
    await page.pdf({
      path: pdfPath,
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return metrics;
  } finally {
    await browser.close();
  }
}

async function main() {
  const pdfPath = outputPath();
  mkdirSync(dirname(pdfPath), { recursive: true });
  const html = generateGermanCvHtml({ lang, photoEnabled });
  const metrics = await renderPdf(html, pdfPath);
  assertPdfQuality(pdfPath, html, metrics);
  console.log(`Generated: ${pdfPath}`);
  console.log(`Layout: A4 width ${metrics.pageWidthMm.toFixed(1)}mm · document flow ${metrics.bodyHeightMm.toFixed(1)}mm`);
}

main().catch(error => {
  console.error(`❌ German CV generation failed: ${error.message}`);
  process.exit(1);
});
