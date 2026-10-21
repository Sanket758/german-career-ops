#!/usr/bin/env node

/**
 * scan.mjs — career-page scanner.
 *
 * Visits every tracked company's career page, extracts the roles it lists,
 * keeps the ones that match the configured role filter and the posting-date
 * window, and writes:
 *
 *   data/daily-scans/<date>.md    per-company digest (the daily report)
 *   data/daily-scans/<date>.tsv   machine-readable rows
 *   data/pipeline.md              new roles appended to the evaluation inbox
 *   data/scan-history.tsv         every URL we have already seen
 *
 * Three ways of reading a board, cheapest first:
 *   1. ATS API  — greenhouse, ashby, lever, personio, recruitee,
 *                 smartrecruiters, bamboohr, workday, join.com, softgarden
 *   2. plain HTML fetch + anchor extraction
 *   3. Playwright render, for boards that need JavaScript
 *
 * Zero Claude API tokens — pure HTTP + JSON.
 *
 * Usage:
 *   node scan.mjs                     # scan everything
 *   node scan.mjs --dry-run           # preview, write nothing
 *   node scan.mjs --company Cohere    # one company
 *   node scan.mjs --days 3            # posting-date window (default 7)
 *   node scan.mjs --date 2026-10-20   # output file name
 *   node scan.mjs --no-browser        # never launch Playwright
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

import { detectProvider, fetchFromProvider } from './lib/ats-providers.mjs';
import { buildTitleFilter, buildDateWindow, buildLocationFilter, buildTitleLocationFilter } from './lib/role-filter.mjs';
import { planScan } from './lib/scan-plan.mjs';
import { buildDigest, buildDigestTsv } from './lib/digest.mjs';
import { extractJobsFromHtml, extractJobsWithBrowser, createBrowserSession } from './lib/html-jobs.mjs';

export { planScan };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTALS_PATH = join(ROOT, 'portals.yml');
const SCAN_HISTORY_PATH = join(ROOT, 'data', 'scan-history.tsv');
const PIPELINE_PATH = join(ROOT, 'data', 'pipeline.md');
const APPLICATIONS_PATH = join(ROOT, 'data', 'applications.md');
const DAILY_DIR = join(ROOT, 'data', 'daily-scans');

const CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 20_000;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// ── network ─────────────────────────────────────────────────────────────
async function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── dedup sources ───────────────────────────────────────────────────────
function loadSeenUrls() {
  const seen = new Set();

  if (existsSync(SCAN_HISTORY_PATH)) {
    const lines = readFileSync(SCAN_HISTORY_PATH, 'utf-8').split('\n');
    for (const line of lines.slice(1)) {
      const url = line.split('\t')[0];
      if (url) seen.add(url);
    }
  }

  if (existsSync(PIPELINE_PATH)) {
    const text = readFileSync(PIPELINE_PATH, 'utf-8');
    for (const match of text.matchAll(/- \[[ x]\] (https?:\/\/\S+)/g)) {
      seen.add(match[1]);
    }
  }

  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    for (const match of text.matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(match[0]);
    }
  }

  return seen;
}

function loadSeenCompanyRoles() {
  const seen = new Set();
  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    for (const match of text.matchAll(/\|[^|]+\|[^|]+\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g)) {
      const company = match[1].trim().toLowerCase();
      const role = match[2].trim().toLowerCase();
      if (company && role && company !== 'company') {
        seen.add(`${company}::${role}`);
      }
    }
  }
  return seen;
}

// ── writers ─────────────────────────────────────────────────────────────
function appendToPipeline(offers) {
  if (offers.length === 0) return;
  if (!existsSync(PIPELINE_PATH)) return;

  let text = readFileSync(PIPELINE_PATH, 'utf-8');
  const marker = '## Pendientes';
  const block = offers.map(o =>
    `- [ ] ${o.url} | ${o.company} | ${o.title}`
  ).join('\n') + '\n';

  const idx = text.indexOf(marker);
  if (idx === -1) {
    const procIdx = text.indexOf('## Procesadas');
    const insertAt = procIdx === -1 ? text.length : procIdx;
    text = text.slice(0, insertAt) + `\n${marker}\n\n` + block + '\n' + text.slice(insertAt);
  } else {
    const afterMarker = idx + marker.length;
    const nextSection = text.indexOf('\n## ', afterMarker);
    const insertAt = nextSection === -1 ? text.length : nextSection;
    text = text.slice(0, insertAt) + '\n' + block + text.slice(insertAt);
  }

  writeFileSync(PIPELINE_PATH, text, 'utf-8');
}

function appendToScanHistory(rows, date) {
  if (!rows.length) return;
  if (!existsSync(SCAN_HISTORY_PATH)) {
    writeFileSync(SCAN_HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n', 'utf-8');
  }
  const lines = rows.map(o =>
    `${o.url}\t${date}\t${o.source}\t${String(o.title).replace(/\t/g, ' ')}\t${String(o.company).replace(/\t/g, ' ')}\t${o.status}`
  ).join('\n') + '\n';
  appendFileSync(SCAN_HISTORY_PATH, lines, 'utf-8');
}

// ── per-company collection ──────────────────────────────────────────────
function providerFor(company) {
  // An explicit api: in portals.yml wins over detection.
  if (company.api && /greenhouse/i.test(company.api)) {
    const m = company.api.match(/boards\/([^/]+)\/jobs/);
    if (m) {
      return {
        type: 'greenhouse',
        url: `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs`,
        slug: m[1],
        host: 'boards-api.greenhouse.io',
      };
    }
  }
  return detectProvider(company.careers_url);
}

async function collectCompanyJobs(company, browserSession) {
  const url = company.careers_url;
  if (!url) {
    return { jobs: [], status: 'skipped', error: 'no careers_url', method: 'none' };
  }

  const provider = providerFor(company);
  if (provider) {
    try {
      const jobs = await fetchFromProvider(provider, company.name);
      // A provider that answered is authoritative: 0 jobs means the board is
      // empty, not that we should go looking elsewhere.
      return { jobs, status: 'ok', method: provider.type, error: '' };
    } catch (err) {
      // Board moved or blocked — fall through to the page itself.
      const providerError = err.message || String(err);
      const html = await tryHtml(url, company.name);
      if (html.jobs.length) return { ...html, method: 'html', note: providerError };
      const browser = browserSession
        ? await tryBrowser(url, company.name, browserSession)
        : { jobs: [] };
      if (browser.jobs.length) return { ...browser, method: 'browser', note: providerError };
      return { jobs: [], status: 'error', error: providerError, method: 'none' };
    }
  }

  const html = await tryHtml(url, company.name);
  if (html.jobs.length) return { ...html, status: 'ok', method: 'html', error: '' };

  if (browserSession) {
    const browser = await tryBrowser(url, company.name, browserSession);
    if (browser.jobs.length) return { ...browser, status: 'ok', method: 'browser', error: '' };
    if (browser.error) return { jobs: [], status: 'error', error: browser.error, method: 'none' };
  }

  return { jobs: [], status: 'no_roles', error: '', method: 'none' };
}

async function tryHtml(url, companyName) {
  try {
    const html = await fetchText(url);
    const jobs = extractJobsFromHtml(html, companyName, url);
    return { jobs, error: '' };
  } catch (err) {
    return { jobs: [], error: err.message || String(err) };
  }
}

async function tryBrowser(url, companyName, session) {
  try {
    const jobs = await extractJobsWithBrowser(url, companyName, session);
    return { jobs, error: '' };
  } catch (err) {
    return { jobs: [], error: err.message || String(err) };
  }
}

// ── main ────────────────────────────────────────────────────────────────
export async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noBrowser = args.includes('--no-browser');
  const companyFlag = args.indexOf('--company');
  const filterCompany = companyFlag !== -1 ? args[companyFlag + 1]?.toLowerCase() : null;
  const daysFlag = args.indexOf('--days');
  const days = daysFlag !== -1 ? Number(args[daysFlag + 1]) : 7;
  const dateFlag = args.indexOf('--date');
  const date = dateFlag !== -1 ? args[dateFlag + 1] : new Date().toISOString().slice(0, 10);

  if (!existsSync(PORTALS_PATH)) {
    console.error('Error: portals.yml not found.');
    process.exit(1);
  }

  const config = yaml.load(readFileSync(PORTALS_PATH, 'utf-8'));
  const allCompanies = (config.tracked_companies || []).filter(c => c && c.name);
  const titleFilter = buildTitleFilter(config.title_filter);
  const locationFilter = buildLocationFilter(config.location_filter);
  const titleLocationFilter = buildTitleLocationFilter(config.location_filter);
  const dateWindow = buildDateWindow(days, new Date(`${date}T12:00:00Z`));

  const targets = allCompanies
    .filter(c => c.enabled !== false)
    .filter(c => !filterCompany || c.name.toLowerCase().includes(filterCompany));

  console.log(`Scanning ${targets.length} companies (${allCompanies.length - targets.length} disabled/skipped)`);
  if (dryRun) console.log('(dry run — no files will be written)\n');

  const seenUrls = loadSeenUrls();
  const seenCompanyRoles = loadSeenCompanyRoles();

  // One browser for the whole run, used only for boards that need JS.
  let browserSession = null;
  if (!noBrowser) {
    try { browserSession = await createBrowserSession(); }
    catch (e) { console.log(`(browser unavailable: ${e.message} — HTML-only scan)`); }
  }

  const results = [];
  const accepted = [];
  const historyRows = [];
  const errors = [];
  let totalFound = 0;

  // API-backed companies go in parallel; the browser render is sequential.
  const apiTargets = [];
  const pageTargets = [];
  for (const c of targets) {
    (providerFor(c) ? apiTargets : pageTargets).push(c);
  }

  const processCompany = async (company) => {
    const res = await collectCompanyJobs(company, browserSession);
    totalFound += res.jobs.length;
    if (res.status === 'error') {
      errors.push({ company: company.name, error: res.error });
    }
    const plan = planScan({
      jobs: res.jobs,
      titleFilter, dateWindow, locationFilter, titleLocationFilter,
      seenUrls, seenCompanyRoles,
    });
    for (const job of plan.accepted) {
      accepted.push(job);
      historyRows.push({ url: job.url, title: job.title, company: job.company, source: res.method, status: 'added' });
    }
    for (const r of plan.rejected) {
      if (r.reason === 'too_old' && r.job.url) {
        historyRows.push({ url: r.job.url, title: r.job.title, company: r.job.company, source: res.method, status: 'skipped_old' });
      }
    }
    results.push({
      name: company.name,
      careers_url: company.careers_url || '',
      status: res.status,
      error: res.error || '',
      newCount: plan.accepted.length,
      method: res.method,
      seen: res.jobs.length,
    });
  };

  // Parallel pass: companies with an API provider.
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, apiTargets.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= apiTargets.length) return;
      await processCompany(apiTargets[idx]);
    }
  }));

  // Sequential pass: HTML and browser rendering.
  for (const company of pageTargets) {
    await processCompany(company);
  }

  if (browserSession) await browserSession.close();

  results.sort((a, b) => a.name.localeCompare(b.name));
  accepted.sort((a, b) => {
    const ad = a.date || '', bd = b.date || '';
    if (ad && bd) return bd.localeCompare(ad);
    if (ad) return -1;
    if (bd) return 1;
    return String(a.company).localeCompare(String(b.company)) || String(a.title).localeCompare(String(b.title));
  });

  // ── write ────────────────────────────────────────────────────────────
  if (!dryRun) {
    mkdirSync(DAILY_DIR, { recursive: true });
    writeFileSync(join(DAILY_DIR, `${date}.md`), buildDigest({ date, companies: results, jobs: accepted, windowDays: days }), 'utf-8');
    writeFileSync(join(DAILY_DIR, `${date}.tsv`), buildDigestTsv({ date, jobs: accepted }), 'utf-8');
    appendToPipeline(accepted);
    appendToScanHistory(historyRows, date);
  }

  // ── summary ──────────────────────────────────────────────────────────
  const withRoles = results.filter(r => r.newCount > 0);
  console.log(`\n${'━'.repeat(45)}`);
  console.log(`Portal Scan — ${date}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Companies scanned:     ${results.length}`);
  console.log(`Roles seen:            ${totalFound}`);
  console.log(`New matching roles:    ${accepted.length}`);
  console.log(`Companies with roles:  ${withRoles.length}`);
  console.log(`Errors:                ${errors.length}`);

  if (errors.length) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors.slice(0, 20)) console.log(`  ✗ ${e.company}: ${e.error}`);
    if (errors.length > 20) console.log(`  … and ${errors.length - 20} more`);
  }

  if (accepted.length) {
    console.log('\nNew roles:');
    for (const o of accepted.slice(0, 40)) {
      console.log(`  + ${o.company} | ${o.title} | ${o.location || 'N/A'} | ${o.date || 'undated'}`);
    }
    if (accepted.length > 40) console.log(`  … and ${accepted.length - 40} more`);
  }

  if (dryRun) {
    console.log('\n(dry run — run without --dry-run to save results)');
  } else {
    console.log(`\nDigest:   ${join('data', 'daily-scans', `${date}.md`)}`);
    console.log(`Rows:     ${join('data', 'daily-scans', `${date}.tsv`)}`);
    console.log(`Pipeline: ${PIPELINE_PATH}`);
  }
  console.log('\n→ Run /career-ops pipeline to evaluate new offers.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
