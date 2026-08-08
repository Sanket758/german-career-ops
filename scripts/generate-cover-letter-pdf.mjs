#!/usr/bin/env node

/**
 * generate-cover-letter-pdf.mjs — Markdown Cover Letter → PDF via Playwright
 *
 * Converts career-ops cover letter .md files into professional PDFs
 * using the same design system as the CV (Space Grotesk + DM Sans,
 * teal/purple gradient header).
 *
 * Usage:
 *   node generate-cover-letter-pdf.mjs <input.md> [output.pdf] [--format=a4|letter]
 *   node generate-cover-letter-pdf.mjs output/cover-letter-helsing.md
 *   node generate-cover-letter-pdf.mjs output/cover-letter-helsing.md output/helsing.pdf
 *   node generate-cover-letter-pdf.mjs --all          # Convert ALL .md cover letters in output/
 *
 * If output.pdf is omitted, replaces .md with .pdf in the same directory.
 *
 * Requires: playwright installed (npm install / uv pip install playwright)
 */

import { chromium } from 'playwright';
import { resolve, dirname, basename, join } from 'path';
import { readFile, writeFile, readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { load as loadYaml } from 'js-yaml';
import { execFileSync } from 'child_process';
import { STYLE_GUIDE_VERSION } from './lint-style-guide.mjs';

const __dirname = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Config: Read candidate contact info from profile.yml
// ---------------------------------------------------------------------------

/**
 * Load candidate contact details from config/profile.yml.
 *
 * @returns {object} Candidate contact info with fallback defaults.
 */
async function loadProfile() {
  const profilePath = resolve(__dirname, 'config/profile.yml');
  try {
    const raw = await readFile(profilePath, 'utf-8');
    const parsed = loadYaml(raw);
    const c = parsed?.candidate || {};
    return {
      name: c.full_name || 'Candidate Name',
      email: c.email || '',
      phone: c.phone || '',
      location: c.location || '',
      street_address: c.street_address || '',
      postal_code: c.postal_code || '',
      city: c.city || '',
      date_of_birth: c.date_of_birth || '',
      place_of_birth: c.place_of_birth || '',
      nationality: c.nationality || '',
      linkedin: c.linkedin || '',
      github: c.github || '',
      portfolio: c.portfolio_url || '',
    };
  } catch {
    console.warn('⚠️  Could not read config/profile.yml — using defaults');
    return {
      name: 'Candidate Name',
      email: '',
      phone: '',
      location: '',
      street_address: '',
      postal_code: '',
      city: '',
      date_of_birth: '',
      place_of_birth: '',
      nationality: '',
      linkedin: '',
      github: '',
      portfolio: '',
    };
  }
}

// ---------------------------------------------------------------------------
// Markdown → HTML conversion (lightweight, no external deps)
// ---------------------------------------------------------------------------

/**
 * Parse the YAML-like metadata header from a cover letter markdown.
 *
 * Extracts lines like "**Position:** AI Engineer" or "**Date:** 2026-04-14"
 * from the top of the document (before the body text begins).
 *
 * @param {string[]} lines - Array of markdown lines.
 * @returns {{ meta: object, bodyStartIdx: number }}
 */
function parseMetaHeader(lines) {
  const meta = {};
  let bodyStartIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip the H1 title (# Cover Letter — ...)
    if (line.startsWith('# ')) {
      bodyStartIdx = i + 1;
      continue;
    }

    // Skip blank lines and horizontal rules at the top
    if (line === '' || line === '---') {
      bodyStartIdx = i + 1;
      continue;
    }

    // Match metadata: **Label:** Value
    const metaMatch = line.match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (metaMatch) {
      meta[metaMatch[1].trim()] = metaMatch[2].trim();
      bodyStartIdx = i + 1;
      continue;
    }

    // Once we hit non-meta content, stop
    break;
  }

  // Skip any trailing blank lines / --- after meta
  while (bodyStartIdx < lines.length) {
    const l = lines[bodyStartIdx].trim();
    if (l === '' || l === '---') {
      bodyStartIdx++;
    } else {
      break;
    }
  }

  return { meta, bodyStartIdx };
}

/**
 * Convert a block of markdown text to simple HTML.
 *
 * Handles: paragraphs, bold, italic, inline code, links,
 * unordered/ordered lists, and H2/H3 headings.
 *
 * @param {string} markdown - Raw markdown body text.
 * @returns {string} HTML string.
 */
function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  const htmlParts = [];
  let inList = false;
  let listType = '';
  let paragraphBuffer = [];

  /**
   * Flush accumulated paragraph lines into an HTML <p> tag.
   */
  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join(' ');
      htmlParts.push(`<p>${inlineFormat(text)}</p>`);
      paragraphBuffer = [];
    }
  }

  /**
   * Close an open list tag if one is active.
   */
  function closeList() {
    if (inList) {
      htmlParts.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
      listType = '';
    }
  }

  /**
   * Apply inline markdown formatting (bold, italic, code, links).
   *
   * @param {string} text - Raw inline text.
   * @returns {string} HTML-formatted text.
   */
  function inlineFormat(text) {
    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Bold: **text** or __text__
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic: *text* or _text_
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // Inline code: `text`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    return text;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank line = end of paragraph
    if (trimmed === '') {
      flushParagraph();
      closeList();
      continue;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushParagraph();
      closeList();
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      closeList();
      htmlParts.push(`<h3>${inlineFormat(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      closeList();
      htmlParts.push(`<h2>${inlineFormat(trimmed.slice(3))}</h2>`);
      continue;
    }

    // Unordered list items
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)/);
    if (ulMatch) {
      flushParagraph();
      if (!inList || listType !== 'ul') {
        closeList();
        htmlParts.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      htmlParts.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list items
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      flushParagraph();
      if (!inList || listType !== 'ol') {
        closeList();
        htmlParts.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      htmlParts.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    // Regular text → accumulate for paragraph
    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  closeList();

  return htmlParts.join('\n');
}

// ---------------------------------------------------------------------------
// ATS normalization (reused from generate-pdf.mjs)
// ---------------------------------------------------------------------------

/**
 * Normalize text for ATS compatibility by converting problematic Unicode.
 *
 * @param {string} html - Raw HTML string.
 * @returns {{ html: string, replacements: object }}
 */
function normalizeTextForATS(html) {
  const replacements = {};
  const bump = (key, n) => { replacements[key] = (replacements[key] || 0) + n; };

  let out = html;
  out = out.replace(/\u2014/g, () => { bump('em-dash', 1); return '-'; });
  out = out.replace(/\u2013/g, () => { bump('en-dash', 1); return '-'; });
  out = out.replace(/[\u201C\u201D\u201E\u201F]/g, () => { bump('smart-double-quote', 1); return '"'; });
  out = out.replace(/[\u2018\u2019\u201A\u201B]/g, () => { bump('smart-single-quote', 1); return "'"; });
  out = out.replace(/\u2026/g, () => { bump('ellipsis', 1); return '...'; });
  out = out.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, () => { bump('zero-width', 1); return ''; });
  out = out.replace(/\u00A0/g, () => { bump('nbsp', 1); return ' '; });

  return { html: out, replacements };
}

// ---------------------------------------------------------------------------
// Rule 5 style gate (Wiring Instructions §3 — same place as PDF generation)
// ---------------------------------------------------------------------------

/**
 * Run the executable style gate (lint-style-guide.mjs) on a cover letter.
 *
 * Aborts the conversion (throws) when the gate exits non-zero, so a letter
 * that violates RULE 2 / RULE 4, uses untraceable numbers, or carries a stale
 * header date never reaches the PDF.
 *
 * @param {string} mdPath - Absolute path to the cover letter .md file.
 */
function runStyleGate(mdPath) {
  const lintPath = resolve(__dirname, 'scripts/lint-style-guide.mjs');
  const cvPath = resolve(__dirname, 'cv.md');
  try {
    execFileSync(
      process.execPath,
      [lintPath, mdPath, `--cv=${cvPath}`],
      { stdio: 'inherit' }
    );
  } catch {
    throw new Error(
      `❌  STYLE GATE FAILED: ${basename(mdPath)} — fix the violations above before generating the PDF.`
    );
  }
}

/**
 * Stamp the letter with the style-guide version it was validated against.
 *
 * Appends an HTML-comment metadata tag when absent (idempotent). The gate
 * recognizes this tag and excludes it from numeral scanning.
 *
 * @param {string} mdPath - Absolute path to the cover letter .md file.
 */
async function ensureStyleTag(mdPath) {
  const raw = await readFile(mdPath, 'utf-8');
  if (/style_guide_version\s*:\s*\S+/i.test(raw)) return;
  const tagged = `${raw.trimEnd()}\n\n<!-- style_guide_version: ${STYLE_GUIDE_VERSION} -->\n`;
  await writeFile(mdPath, tagged);
}

// ---------------------------------------------------------------------------
// Core: Convert a single .md file → .pdf
// ---------------------------------------------------------------------------

/**
 * Convert a markdown cover letter to a professional PDF.
 *
 * @param {string} inputPath - Absolute path to the .md file.
 * @param {string} outputPath - Absolute path for the output .pdf file.
 * @param {string} format - Page format: 'a4' or 'letter'.
 * @returns {Promise<{ outputPath: string, pageCount: number, size: number }>}
 */
async function convertOne(inputPath, outputPath, format = 'a4') {
  const profile = await loadProfile();
  const templatePath = resolve(__dirname, 'templates/cover-letter-template.html');

  if (!existsSync(templatePath)) {
    console.error('❌ Template not found:', templatePath);
    process.exit(1);
  }

  // Read markdown
  const md = await readFile(inputPath, 'utf-8');

  // Rule 5 style gate (Wiring Instructions §3 — same place as PDF generation):
  // abort before rendering if the letter violates the style guide, then stamp
  // the style-guide version it was validated against.
  runStyleGate(inputPath);
  await ensureStyleTag(inputPath);

  const lines = md.split('\n');

  // Parse header metadata and body
  const { meta, bodyStartIdx } = parseMetaHeader(lines);
  let bodyMd = lines.slice(bodyStartIdx).join('\n');
  // Strip a trailing signature block that duplicates the template's own closing
  // (salutation + name line). The template renders CLOSING_LINE + NAME as the
  // single signature, so the body must end at the last content paragraph.
  bodyMd = bodyMd.replace(
    /\n*(?:Best regards|Mit freundlichen Grüßen|Kind regards,)[^\n]*\n+(?:[A-Z][a-z]+ ){1,3}[A-Z][a-z]+\s*$/,
    ''
  );
  const bodyHtml = markdownToHtml(bodyMd);

  // Build meta rows HTML
  const metaKeys = ['Position', 'Company', 'Location', 'Date', 'Application',
                     'Purpose', 'Method', 'Subject', 'When'];
  let metaRowsHtml = '';
  for (const key of metaKeys) {
    if (meta[key]) {
      metaRowsHtml += `<div class="meta-row"><span class="meta-label">${key}:</span> <span>${meta[key]}</span></div>\n`;
    }
  }

  // Detect signature block — look for "Best regards" or similar at end
  // We keep it inside the body HTML as-is; the template's signature slot
  // is for the structured contact footer only.
  const signatureHtml = `
    <p>Best regards,</p>
    <div class="name">${profile.name}</div>
    <div class="contact-links">${[profile.email, profile.phone, profile.linkedin, profile.github].filter(Boolean).join(' | ')}</div>
  `;

  // Load template and fill placeholders
  let html = await readFile(templatePath, 'utf-8');
  html = html.replace(/\{\{NAME\}\}/g, profile.name);
  html = html.replace(/\{\{EMAIL\}\}/g, profile.email);
  html = html.replace(/\{\{PHONE\}\}/g, profile.phone);
  html = html.replace(/\{\{LOCATION\}\}/g, profile.location);
  html = html.replace(/\{\{STREET_ADDRESS\}\}/g, profile.street_address);
  html = html.replace(/\{\{POSTAL_CODE\}\}/g, profile.postal_code);
  html = html.replace(/\{\{CITY\}\}/g, profile.city);
  html = html.replace(/\{\{DOB\}\}/g, profile.date_of_birth);
  html = html.replace(/\{\{POB\}\}/g, profile.place_of_birth);
  html = html.replace(/\{\{NATIONALITY\}\}/g, profile.nationality);
  html = html.replace(/\{\{LINKEDIN\}\}/g, profile.linkedin);
  html = html.replace(/\{\{GITHUB\}\}/g, profile.github);
  html = html.replace(/\{\{LANG\}\}/g, 'en');
  html = html.replace('{{META_ROWS}}', metaRowsHtml);
  html = html.replace(/\{\{BODY\}\}/g, () => bodyHtml);
  html = html.replace('{{SIGNATURE}}', ''); // Signature is already in body text

  // Add SIGNATURE placeholders for the template footer if needed
  const today = new Date().toLocaleDateString('de-DE');
  html = html.replace(/\{\{SIGNATURE_DATE\}\}/g, today);
  html = html.replace(/\{\{SIGNATURE_LOCATION\}\}/g, profile.city || 'Berlin');

  // Fill letter-specific placeholders (company block, subject, salutation, closing, enclosures)
  html = html.replace(/\{\{COMPANY_NAME\}\}/g, meta.Company || '');
  html = html.replace(/\{\{CONTACT_PERSON\}\}/g, meta['Contact Person'] || '');
  html = html.replace(/\{\{COMPANY_ADDRESS\}\}/g, meta['Company Address'] || '');
  html = html.replace(/\{\{SUBJECT\}\}/g, meta.Subject || '');
  html = html.replace(/\{\{SALUTATION\}\}/g, 'Dear Hiring Manager,');
  html = html.replace(/\{\{CLOSING_LINE\}\}/g, 'Best regards,');
  html = html.replace(/\{\{ANLAGEN\}\}/g, 'Lebenslauf');


  // Resolve font paths to absolute file:// URLs
  const fontsDir = resolve(__dirname, 'fonts');
  html = html.replace(
    /url\(['"]?\.\/fonts\//g,
    `url('file://${fontsDir}/`
  );
  html = html.replace(
    /file:\/\/([^'")\s]+)\.(woff2?)['"]?\)/g,
    `file://$1.$2')`
  );

  // ATS normalization
  const normalized = normalizeTextForATS(html);
  html = normalized.html;
  const totalReplacements = Object.values(normalized.replacements).reduce((a, b) => a + b, 0);
  if (totalReplacements > 0) {
    const breakdown = Object.entries(normalized.replacements).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`  🧹 ATS normalization: ${totalReplacements} replacements (${breakdown})`);
  }

  const first = await renderCoverLetterPdf(html, inputPath, outputPath, format);
  if (first.pageCount <= 1) {
    console.log(`  ✅ ${basename(outputPath)} (${first.pageCount} page, ${(first.size / 1024).toFixed(1)} KB)`);
    return { outputPath, pageCount: first.pageCount, size: first.size };
  }

  console.warn(`  ⚠️  ${basename(outputPath)} rendered as ${first.pageCount} pages. Retrying with one-page compression...`);
  const compressed = injectOnePageCoverLetterCSS(html);
  const second = await renderCoverLetterPdf(compressed, inputPath, outputPath, format);
  if (second.pageCount <= 1) {
    console.log(`  ✅ ${basename(outputPath)} (${second.pageCount} page, auto-compressed, ${(second.size / 1024).toFixed(1)} KB)`);
    return { outputPath, pageCount: second.pageCount, size: second.size };
  }

  throw new Error(
    `Cover letter is ${second.pageCount} pages after compression. Limit is 1 page; shorten the letter before applying.`
  );
}

async function renderCoverLetterPdf(html, inputPath, outputPath, format) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle',
      baseURL: `file://${dirname(inputPath)}/`,
    });

    // Wait for fonts
    await page.evaluate(() => document.fonts.ready);

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: format,
      printBackground: true,
      margin: {
        top: '0.7in',
        right: '0.7in',
        bottom: '0.7in',
        left: '0.7in',
      },
      preferCSSPageSize: false,
    });

    await writeFile(outputPath, pdfBuffer);

    return {
      pageCount: countPdfPages(outputPath, pdfBuffer),
      size: pdfBuffer.length,
    };
  } finally {
    await browser.close();
  }
}

function countPdfPages(outputPath, pdfBuffer) {
  try {
    const info = execFileSync('pdfinfo', [outputPath], { encoding: 'utf-8' });
    const match = info.match(/^Pages:\s+(\d+)/m);
    if (match) return parseInt(match[1], 10);
  } catch {
    // Keep validation active even when poppler-utils is unavailable.
  }

  const pdfString = pdfBuffer.toString('latin1');
  return (pdfString.match(/\/Type\s*\/Page\b(?!s)/g) || []).length || 1;
}

function injectOnePageCoverLetterCSS(html) {
  const css = `
<style>
  body { font-size: 10.2px !important; line-height: 1.5 !important; }
  .sender-block { margin-bottom: 10mm !important; }
  .sender-name { font-size: 13px !important; margin-bottom: 3px !important; }
  .sender-details { font-size: 9px !important; line-height: 1.4 !important; }
  .date-line { margin-bottom: 8mm !important; }
  .recipient-block { margin-bottom: 7mm !important; }
  .subject-line { font-size: 11px !important; margin-bottom: 6mm !important; }
  .salutation { margin-bottom: 4mm !important; }
  .body-text p { font-size: 10.2px !important; line-height: 1.5 !important; margin-bottom: 3.5mm !important; }
  .closing { margin-top: 5mm !important; }
  .signature-space { height: 9mm !important; }
  .anlagen { margin-top: 6mm !important; padding-top: 4mm !important; }
</style>`;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${css}\n</head>`);
  }
  return `${css}\n${html}`;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  let format = 'a4';
  const positional = [];
  let allMode = false;

  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      format = arg.split('=')[1].toLowerCase();
    } else if (arg === '--all') {
      allMode = true;
    } else {
      positional.push(arg);
    }
  }

  // Validate format
  if (!['a4', 'letter'].includes(format)) {
    console.error(`❌ Invalid format "${format}". Use: a4, letter`);
    process.exit(1);
  }

  // --all mode: convert every cover-letter-*.md in output/
  if (allMode) {
    const outputDir = resolve(__dirname, 'output');
    if (!existsSync(outputDir)) {
      console.error('❌ output/ directory not found');
      process.exit(1);
    }

    const files = await readdir(outputDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    if (mdFiles.length === 0) {
      console.log('📭 No .md files found in output/');
      return;
    }

    console.log(`📄 Converting ${mdFiles.length} markdown file(s) to PDF...\n`);
    let converted = 0;
    let skipped = 0;

    for (const f of mdFiles) {
      const mdPath = resolve(outputDir, f);
      const pdfPath = mdPath.replace(/\.md$/, '.pdf');

      // Check if PDF already exists and is newer than .md
      if (existsSync(pdfPath)) {
        const { statSync } = await import('fs');
        const mdStat = statSync(mdPath);
        const pdfStat = statSync(pdfPath);
        if (pdfStat.mtimeMs > mdStat.mtimeMs) {
          console.log(`  ⏭️  ${f} (PDF is up-to-date)`);
          skipped++;
          continue;
        }
      }

      try {
        await convertOne(mdPath, pdfPath, format);
        converted++;
      } catch (err) {
        console.error(`  ❌ ${f}: ${err.message}`);
      }
    }

    console.log(`\n📊 Done: ${converted} converted, ${skipped} skipped (up-to-date)`);
    return;
  }

  // Single file mode
  if (positional.length === 0) {
    console.log(`
📄 generate-cover-letter-pdf.mjs — Markdown Cover Letter → PDF

Usage:
  node generate-cover-letter-pdf.mjs <input.md> [output.pdf] [--format=a4|letter]
  node generate-cover-letter-pdf.mjs --all          # Convert ALL .md in output/

Examples:
  node generate-cover-letter-pdf.mjs output/cover-letter-helsing.md
  node generate-cover-letter-pdf.mjs output/cover-letter-helsing.md ~/Desktop/helsing.pdf
  node generate-cover-letter-pdf.mjs --all --format=letter
    `);
    process.exit(0);
  }

  const inputPath = resolve(positional[0]);
  if (!existsSync(inputPath)) {
    console.error(`❌ File not found: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = positional[1]
    ? resolve(positional[1])
    : inputPath.replace(/\.md$/, '.pdf');

  console.log(`📄 Input:  ${basename(inputPath)}`);
  console.log(`📁 Output: ${basename(outputPath)}`);
  console.log(`📏 Format: ${format.toUpperCase()}\n`);

  await convertOne(inputPath, outputPath, format);
}

main().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
