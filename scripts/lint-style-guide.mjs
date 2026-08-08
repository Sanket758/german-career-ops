#!/usr/bin/env node

/**
 * lint-style-guide.mjs — Automated Rule 5 content-quality gate.
 *
 * Implements RULE 5 of templates/writing-style-guide.md as an ACTUAL
 * executable check (Wiring Instructions §2), not just a prompt instruction:
 *   - Banned-phrase check   (Rule 2 + Rule 4 lists)
 *   - Number-traceability   (every numeral must appear VERBATIM in cv.md)
 *   - Date check            (letter header date == today, not stale)
 *   - Language check        (document language matches --jd-lang)
 *   - Version tag           (emit with --tag / verify presence)
 *
 * Usage:
 *   node scripts/lint-style-guide.mjs <file> [--cv=cv.md] [--jd-lang=en|de] [--tag] [--cv-html]
 *
 * Exit codes:
 *   0 = clean, 1 = violations found (each listed on stderr), 2 = usage error.
 *
 * Accepts markdown or HTML input. For HTML, tags/CSS/scripts/base64 blobs are
 * stripped before scanning so layout noise never pollutes the checks.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const STYLE_GUIDE_VERSION = '2026-08-08-v1';

// ─── Rule 2 + Rule 4 banned phrases (lowercase, substring match) ─────────────
// Source: templates/writing-style-guide.md — RULE 2 (vague quantification
// substitutes) and RULE 4 (generic/AI-detectable openers and filler).

const BANNED_PHRASES = [
  // Rule 2
  'significantly reduced',
  'significantly improved',
  'high accuracy',
  'great results',
  'helped improve',
  'contributed to improving',
  // Rule 4
  'i am writing to express',
  'i am excited to apply',
  'i would like to apply',
  'i wish to apply',
  'please find attached',
  'i am interested in',
];

// ─── Language markers (lowercase, space-delimited whole words) ───────────────

const GERMAN_WORDS = [
  'der', 'die', 'das', 'und', 'ich', 'nicht', 'mit', 'für', 'von', 'auf',
  'eine', 'einer', 'bin', 'habe', 'ist', 'sind', 'sehr', 'geehrte',
  'grüßen', 'bewerbung', 'lebenslauf', 'kenntnisse', 'erfahrung',
  'ausbildung', 'berufserfahrung', 'sprachen', 'zertifikate', 'diese',
];

const ENGLISH_WORDS = [
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'you',
  'your', 'applying', 'application', 'dear', 'regards', 'experience',
  'skills', 'role', 'professional', 'summary', 'education', 'would',
  'about', 'full-time', 'uptime', 'degree',
];

const NUMBER_RE = /\d+(?:[.,]\d+)*(?:%|pp)?/g;

const VERSION_TAG_RE = /style_guide_version\s*:\s*\S+/i;

// ─── HTML text extraction ────────────────────────────────────────────────────

function stripHtml(html) {
  let s = html;
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/data:[^"'\s;]+;base64,[A-Za-z0-9+/=\r\n]+/gi, ' [IMAGE] ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
       .replace(/&nbsp;/g, ' ');
  return s;
}

function looksLikeHtml(raw) {
  return /<!doctype\s+html/i.test(raw) ||
    /<html[\s>]/i.test(raw) ||
    (/<[a-z][\s\S]*>/i.test(raw) && /<\/[a-z]+>/i.test(raw));
}

// ─── Cover-letter meta header parsing (mirrors generate-cover-letter-pdf.mjs) ──

function splitMetaHeader(lines) {
  const meta = {};
  let bodyStartIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) { bodyStartIdx = i + 1; continue; }
    if (line === '' || line === '---') { bodyStartIdx = i + 1; continue; }
    const metaMatch = line.match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (metaMatch) {
      meta[metaMatch[1].trim()] = metaMatch[2].trim();
      bodyStartIdx = i + 1;
      continue;
    }
    break; // first non-meta line ends the header
  }
  return { meta, bodyStartIdx };
}

// ─── Checks ──────────────────────────────────────────────────────────────────

function checkBannedPhrases(text) {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => lower.includes(p));
}

function extractNumerals(text, cvHtmlMode = false) {
  // Exclude the version-tag line from scanning — its date digits are metadata,
  // not content, and would otherwise trip the verbatim check on re-lint.
  let cleaned = text.replace(VERSION_TAG_RE, ' ');
  if (cvHtmlMode) {
    // CV dates are format transforms of cv.md month-year ranges (e.g. 10.2021
    // vs "Oct 2021"). Strip DD.MM.YYYY then MM.YYYY tokens before extraction so
    // they never count as untraceable numerals. Order matters: the full-date
    // pass must run first, otherwise MM.YYYY matches the tail of DD.MM.YYYY.
    cleaned = cleaned
      .replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, ' ')
      .replace(/\b\d{1,2}\.\d{4}\b/g, ' ');
  }
  return cleaned.match(NUMBER_RE) || [];
}

/** Format-swapped alternates for numbers carrying group separators. */
function numericCandidates(n) {
  const candidates = [n];
  if (n.includes('.') && n.includes(',')) {
    // "45.934,20" (DE) and "45,934.20" (EN) are the same value — swap separators
    // and also emit a fully-stripped form for cross-format traceability.
    candidates.push(n.replace(/\./g, '§').replace(/,/g, '.').replace(/§/g, ','));
    candidates.push(n.replace(/[.,]/g, ''));
  }
  return candidates;
}

function checkNumbers(text, cvText, cvHtmlMode = false) {
  const numerals = [...new Set(extractNumerals(text, cvHtmlMode))];
  return numerals.filter((n) => {
    const candidates = cvHtmlMode ? numericCandidates(n) : [n];
    return !candidates.some((c) => {
      const bare = c.replace(/(%|pp)$/, '');
      return cvText.includes(c) || cvText.includes(bare);
    });
  });
}

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Returns null when no Date meta exists, else { stale, msg }. */
function checkDate(meta) {
  if (!meta.Date) return null;
  const m = meta.Date.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return { stale: true, msg: `Date "${meta.Date}" is not YYYY-MM-DD — cannot verify` };
  }
  const today = todayStr();
  const stale = m[0] !== today;
  return stale
    ? { stale, msg: `header date ${m[0]}, today is ${today}` }
    : { stale, msg: `Header date matches today (${m[0]})` };
}

function detectLanguage(text) {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ');
  const t = ` ${normalized} `;
  let de = 0;
  let en = 0;
  for (const w of GERMAN_WORDS) if (t.includes(` ${w} `)) de++;
  for (const w of ENGLISH_WORDS) if (t.includes(` ${w} `)) en++;
  de += (text.match(/[äöüßÄÖÜ]/g) || []).length; // umlauts are a strong DE signal
  if (de > en) return 'de';
  if (en > de) return 'en';
  return 'unknown';
}

function hasVersionTag(raw) {
  return VERSION_TAG_RE.test(raw);
}

function versionTagLine() {
  return `<!-- style_guide_version: ${STYLE_GUIDE_VERSION} -->`;
}

function usage() {
  console.error(
    'Usage: node scripts/lint-style-guide.mjs <file> [--cv=cv.md] [--jd-lang=en|de] [--tag] [--cv-html]\n' +
    '  --cv=PATH       source of truth for number traceability (default: cv.md)\n' +
    '  --jd-lang=LANG  enforce generated language matches the JD (en|de)\n' +
    '  --tag           append style_guide_version metadata tag to the file\n' +
    '  --cv-html       input is a generated CV (HTML): strip date tokens, add\n' +
    '                  config/profile.yml as secondary truth, allow DE/EN number\n' +
    '                  separator formats\n' +
    'Exit: 0 = clean, 1 = violations found, 2 = usage error'
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let cvPath = path.resolve(__dirname, '../cv.md');
  let jdLang = null;
  let doTag = false;
  let cvHtmlMode = false;
  const positional = [];

  for (const a of args) {
    if (a.startsWith('--cv=')) cvPath = path.resolve(process.cwd(), a.slice('--cv='.length));
    else if (a.startsWith('--jd-lang=')) jdLang = a.slice('--jd-lang='.length).toLowerCase();
    else if (a === '--tag') doTag = true;
    else if (a === '--cv-html') cvHtmlMode = true;
    else if (a.startsWith('--')) { usage(); process.exit(2); }
    else positional.push(a);
  }
  if (positional.length !== 1) { usage(); process.exit(2); }
  if (jdLang && !['en', 'de'].includes(jdLang)) { usage(); process.exit(2); }

  const filePath = path.resolve(process.cwd(), positional[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`❌  STYLE GATE ERROR: file not found: ${filePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(cvPath)) {
    console.error(`❌  STYLE GATE ERROR: cv.md not found at ${cvPath} (pass --cv=...)`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const isHtml = looksLikeHtml(raw);
  const text = isHtml ? stripHtml(raw) : raw;
  const lines = text.split('\n');
  const { meta, bodyStartIdx } = isHtml
    ? { meta: {}, bodyStartIdx: 0 }
    : splitMetaHeader(lines);
  const body = lines.slice(bodyStartIdx).join('\n');
  // Truth sources: cv.md always; config/profile.yml additionally in --cv-html
  // mode (legal/visa figures like the EU Blue Card salary threshold live there).
  let truthText = fs.readFileSync(cvPath, 'utf-8');
  if (cvHtmlMode) {
    const profilePath = path.resolve(__dirname, '../config/profile.yml');
    if (fs.existsSync(profilePath)) truthText += '\n' + fs.readFileSync(profilePath, 'utf-8');
  }
  const violations = [];

  const fileName = path.basename(filePath);
  console.log(`🔍  STYLE GATE: ${fileName} (${isHtml ? 'html' : 'markdown'}${cvHtmlMode ? ' · cv-html' : ''})`);

  const banned = checkBannedPhrases(body);
  if (banned.length) {
    for (const b of banned) {
      violations.push('banned phrase');
      console.error(`    ❌  BANNED PHRASE: "${b}"`);
    }
  } else {
    console.log(`    ✅  No banned phrases (${BANNED_PHRASES.length} patterns checked)`);
  }

  const missingNums = checkNumbers(body, truthText, cvHtmlMode);
  if (missingNums.length) {
    for (const n of missingNums) {
      violations.push('untraceable number');
      console.error(`    ❌  UNTRACEABLE NUMBER: "${n}" — not verbatim in ${path.basename(cvPath)}${cvHtmlMode ? ' (nor config/profile.yml)' : ''}`);
    }
  } else {
    console.log(`    ✅  All numerals trace verbatim to ${path.basename(cvPath)}`);
  }

  const dateCheck = checkDate(meta);
  if (dateCheck === null) {
    console.log('    ⏭️   No letter header date to verify');
  } else if (dateCheck.stale) {
    violations.push('stale header date');
    console.error(`    ❌  STALE DATE: ${dateCheck.msg}`);
  } else {
    console.log(`    ✅  ${dateCheck.msg}`);
  }

  const detected = detectLanguage(body);
  if (jdLang) {
    if (detected !== jdLang) {
      violations.push('language mismatch');
      console.error(`    ❌  LANGUAGE MISMATCH: detected ${detected.toUpperCase()}, expected ${jdLang.toUpperCase()} (--jd-lang=${jdLang})`);
    } else {
      console.log(`    ✅  Language ${detected.toUpperCase()} matches --jd-lang=${jdLang}`);
    }
  } else {
    console.log(`    ℹ️   Language detected: ${detected.toUpperCase()} (pass --jd-lang to enforce)`);
  }

  if (hasVersionTag(raw)) {
    const m = raw.match(VERSION_TAG_RE);
    console.log(`    ✅  Version tag present: ${m[0]}`);
  } else if (doTag) {
    fs.appendFileSync(filePath, `\n\n${versionTagLine()}\n`);
    console.log(`    ✅  Appended version tag: ${versionTagLine()}`);
  } else {
    console.log(`    ⚠️   No style_guide_version tag — add with --tag`);
  }

  if (violations.length) {
    console.error(`❌  STYLE GATE FAILED: ${fileName} (${violations.length} violation${violations.length > 1 ? 's' : ''})`);
    process.exit(1);
  }
  console.log(`✅  STYLE GATE PASSED: ${fileName}`);
  process.exit(0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) main();
