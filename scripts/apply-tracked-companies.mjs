#!/usr/bin/env node

/**
 * apply-tracked-companies.mjs — wire the Berlin AI/retail research list into
 * portals.yml `tracked_companies`.
 *
 * The research output (research/berlin-ai-retail/berlin-ai-retail-companies.csv)
 * holds 155 Berlin companies whose careers_url was HTTP-verified. This script
 * appends the ones portals.yml does not already track.
 *
 * portals.yml is edited as TEXT, never re-serialised with js-yaml: the file
 * carries the user's hand-written comments and section banners, and a
 * round-trip through a YAML dumper would rewrite all of it.
 *
 * Idempotent: running it twice adds 0 rows the second time.
 *
 * Usage:
 *   node scripts/apply-tracked-companies.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTALS = join(ROOT, 'portals.yml');
// Canonical source: the COMMITTED research block. The CSV next to it is
// richer (evidence, HTTP status) but *.csv is gitignored in this repo, so
// relying on it would break the script on a fresh clone.
const BLOCK = join(ROOT, 'research', 'berlin-ai-retail', 'portals-block.yml');
const CSV = join(ROOT, 'research', 'berlin-ai-retail', 'berlin-ai-retail-companies.csv');
const TRACKED_KEY = 'tracked_companies:';

// ── CSV ─────────────────────────────────────────────────────────────────
function readCsv(path) {
  const text = readFileSync(path, 'utf-8').replace(/\r\n/g, '\n');
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (const ch of text) {
    if (inQ) {
      if (ch === '"') { inQ = false; cur += ch; continue; }
      cur += ch; continue;
    }
    if (ch === '"') { inQ = true; cur += ch; continue; }
    if (ch === ',') { row.push(cur); cur = ''; continue; }
    if (ch === '\n') { row.push(cur); cur = ''; rows.push(row); row = []; continue; }
    cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const unquote = (s) => s.replace(/^"|"$/g, '').replace(/""/g, '"');
  const header = (rows.shift() || []).map(unquote);
  return rows
    .filter(r => r.some(c => c !== ''))
    .map(cells => {
      const o = {};
      header.forEach((h, idx) => { o[h] = unquote(cells[idx] ?? ''); });
      return o;
    });
}

// ── name normalisation (comparison only) ───────────────────────────────
export function normalizeName(name) {
  let n = String(name).normalize('NFKD');
  n = n.replace(/[\u0300-\u036f]/g, '').toLowerCase();
  n = n.replace(/\([^)]*\)/g, ' ');
  n = n.replace(/\b(gmbh|mbh|ag|se|kg|ug|co|group|holding|ventures|technologies|technology|and|company|inc|ltd|ex)\b/g, ' ');
  n = n.replace(/[^a-z0-9]+/g, ' ');
  return n.trim().replace(/\s+/g, ' ');
}

// ── YAML scalar helpers ────────────────────────────────────────────────
function yamlString(value) {
  const s = String(value ?? '').replace(/"/g, "'").trim();
  if (s === '') return '""';
  const needsQuote = /^[\s>|*&!%@`?{}[\],#-]|[:#]\s|\s$|^(true|false|null|yes|no|on|off|~)$/i.test(s);
  return needsQuote ? `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : s;
}

// ── greenhouse detection ───────────────────────────────────────────────
function greenhouseApi(careersUrl) {
  const m = careersUrl.match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/i);
  if (!m) return null;
  return `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs`;
}

// ── entry builder ──────────────────────────────────────────────────────
export function buildEntry(row) {
  const name = String(row.company || '').trim();
  const careersUrl = String(row.careers_url || '').trim();
  const host = (() => {
    try { return new URL(careersUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();

  const berlin = (row.berlin_confirmed || '').toLowerCase();
  const berlinNote = berlin.startsWith('y') ? 'Berlin confirmed.'
    : berlin.startsWith('n') ? 'Berlin presence unconfirmed.'
    : 'Berlin presence to verify.';

  const notes = `${row.sector || 'Retail / inventory AI'}. ${row.kind || 'Berlin AI employer'}. ${berlinNote}`;
  const lines = [];
  lines.push(`  - name: ${yamlString(name)}`);
  lines.push(`    careers_url: ${careersUrl}`);
  const api = greenhouseApi(careersUrl);
  if (api) {
    lines.push(`    api: ${api}`);
  } else if (host) {
    lines.push('    scan_method: websearch');
    lines.push(`    scan_query: 'site:${host} ("AI" OR "Machine Learning" OR "Data" OR "Computer Vision" OR "Deep Learning")'`);
  }
  lines.push(`    notes: "${notes.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  lines.push('    priority: tier1');
  lines.push('    enabled: true');
  return lines.join('\n');
}

// ── insert position ────────────────────────────────────────────────────
// Append to the END of the tracked_companies list. The list runs from the
// `tracked_companies:` key until the next top-level key or EOF.
function findListEnd(lines) {
  const start = lines.findIndex(l => l === TRACKED_KEY);
  if (start === -1) throw new Error(`portals.yml has no "${TRACKED_KEY}" key`);
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z_][A-Za-z0-9_]*:/.test(lines[i])) return i;
  }
  return lines.length;
}

// ── stale-URL repair ───────────────────────────────────────────────────
// Some tracked companies were disabled because their ATS board died
// ("ATS board 404 ... re-derive careers_url"). The research re-derived a
// working URL for them. This step replaces the dead careers_url with the
// research URL and re-enables the entry.
//
// The repair is driven by the USER's own disable reason, not by a liveness
// probe of the old URL. That is deliberate: on 2026-10-20 jobs.lever.co
// served the identical soft-404 page for every board (live ones included),
// so probing it would "repair" healthy boards to worse URLs. We only
// replace a URL the user already declared dead, and we verify the
// REPLACEMENT is live.
const DEAD_REASON = /(404|dead|left this ats|no longer|closed|removed)/i;

// A board can answer HTTP 200 and still be a 404 page ("soft 404").
// The markers are deliberately PHRASES, not single words: careers.vinted.com
// embeds the i18n key "page_error_not_found" → "page not found" in its
// payload, which a naive word match reads as a dead board.
const SOFT_404_MARKERS = [
  "sorry, we couldn't find anything here",
  "sorry, we couldn't find anything",
  "the job posting you're looking for might have closed",
  'this position is no longer available',
  'this job is no longer available',
  'position has been filled',
  'this job has expired',
];

function isDeadByUserReason(blockText) {
  if (!/^\s*enabled:\s*false\s*$/m.test(blockText)) return false;
  const reason = blockText.match(/^\s*disabled_reason:\s*(.+)$/m);
  if (!reason) return false;
  return DEAD_REASON.test(reason[1]);
}

async function fetchSnippet(url, maxBytes = 400000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'GET', redirect: 'follow', signal: ac.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json,*/*',
      },
    });
    const body = await res.text();
    return { status: res.status, body: body.slice(0, maxBytes) };
  } catch {
    return { status: 0, body: '' };
  } finally {
    clearTimeout(timer);
  }
}

// Strip inline CSS and JS before looking for soft-404 text. Lever's 404 page
// is ~300 KB, of which ~295 KB is inline <style>; the human-readable
// "Sorry, we couldn't find anything here" sits at the very end of the
// document, past any naive byte budget.
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

async function isDead(url) {
  if (!url || !/^https?:/i.test(url)) return true;
  const { status, body } = await fetchSnippet(url);
  if (status < 200 || status >= 400) return true;
  const lower = visibleText(body).toLowerCase();
  return SOFT_404_MARKERS.some(m => lower.includes(m.toLowerCase()));
}

function repairEntryBlock(block, researchUrl) {
  let out = block;
  out = out.replace(/^(\s*)careers_url:.*$/m, `$1careers_url: ${researchUrl}`);
  out = out.replace(/^(\s*)enabled:\s*false\s*$/m, '$1enabled: true');
  out = out.replace(/^\s*disabled_reason:.*\n?/m, '');
  // The old api: line may point at the dead board — drop it.
  out = out.replace(/^\s*api:.*\n?/m, '');
  out = out.replace(/^(\s*)notes:.*$/m,
    `$1notes: "Careers URL re-derived 2026-10-20 (previous ATS board was dead)."`);
  return out;
}

async function repairStaleEntries(lines, rows, dryRun) {
  const byName = new Map(rows.map(r => [normalizeName(r.company), r]));
  const repaired = [];

  // index every tracked_companies block
  const blocks = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^  - name:\s*(.+)$/);
    if (m) {
      if (cur) cur.end = i;
      cur = { start: i, end: lines.length, name: m[1].trim() };
      blocks.push(cur);
    }
  }

  for (const b of blocks) {
    const key = normalizeName(b.name);
    const row = byName.get(key);
    if (!row || !row.careers_url) continue;
    const blockText = lines.slice(b.start, b.end).join('\n');
    const urlMatch = blockText.match(/^\s*careers_url:\s*(\S+)/m);
    if (!urlMatch) continue;
    if (urlMatch[1] === row.careers_url) continue;

    // Only touch a board the user already declared dead.
    if (!isDeadByUserReason(blockText)) continue;

    // The replacement must actually be live — otherwise leave the entry alone.
    if (await isDead(row.careers_url)) {
      console.log(`  SKIP ${b.name}: replacement ${row.careers_url} is not live either`);
      continue;
    }

    repaired.push({ name: b.name, old: urlMatch[1], next: row.careers_url });
    if (!dryRun) {
      const newBlock = repairEntryBlock(blockText, row.careers_url);
      lines.splice(b.start, b.end - b.start, ...newBlock.split('\n'));
      // Re-index after mutation and continue. The recursion's own repairs
      // must be merged with ours, not replace them.
      const rest = await repairStaleEntries(lines, rows, dryRun);
      return { lines: rest.lines, repaired: [...repaired, ...rest.repaired] };
    }
  }
  return { lines, repaired };
}

// ── source rows ────────────────────────────────────────────────────────
// Prefer the committed YAML block; fall back to the (gitignored) CSV so a
// local re-run still picks up the richest fields.
export function loadSourceRows() {
  if (existsSync(BLOCK)) {
    const block = yaml.load(readFileSync(BLOCK, 'utf-8')) || [];
    const rows = block
      .filter(e => e && e.name && e.careers_url)
      .map(e => ({
        company: e.name,
        careers_url: e.careers_url,
        sector: e.sector || 'Retail / inventory AI',
        kind: e.kind || 'Berlin AI employer',
        berlin_confirmed: e.berlin || 'unclear',
        website: e.website || '',
      }));
    if (rows.length) return rows;
  }
  if (existsSync(CSV)) {
    return readCsv(CSV)
      .filter(r => r.careers_url && String(r.careers_url).startsWith('http'))
      .map(r => ({
        company: r.company,
        careers_url: r.careers_url,
        sector: r.sector || 'Retail / inventory AI',
        kind: r.kind || 'Berlin AI employer',
        berlin_confirmed: r.berlin_confirmed || 'unclear',
        website: r.website || '',
      }));
  }
  throw new Error(`neither ${BLOCK} nor ${CSV} exists`);
}

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repair = process.argv.includes('--repair');

  if (!existsSync(PORTALS)) { console.error('Error: portals.yml not found.'); process.exit(1); }

  const text = readFileSync(PORTALS, 'utf-8');
  const cfg = yaml.load(text);
  const existing = (cfg.tracked_companies || []).filter(c => c && c.name);
  const existingNames = new Set(existing.map(c => normalizeName(c.name)));
  const existingUrls = new Set(existing.map(c => String(c.careers_url || '').replace(/\/+$/, '').toLowerCase()));

  const rows = loadSourceRows().filter(r => r.careers_url && String(r.careers_url).startsWith('http'));

  const added = [];
  const skippedExisting = [];
  const skippedUrl = [];
  for (const row of rows) {
    const key = normalizeName(row.company);
    if (!key) continue;
    if (existingNames.has(key)) { skippedExisting.push(row.company); continue; }
    const urlKey = String(row.careers_url).replace(/\/+$/, '').toLowerCase();
    if (existingUrls.has(urlKey)) { skippedUrl.push(row.company); continue; }
    existingNames.add(key);
    existingUrls.add(urlKey);
    added.push(row);
  }

  console.log(`research rows with careers_url: ${rows.length}`);
  console.log(`ADDED: ${added.length}`);
  console.log(`SKIPPED_EXISTING: ${skippedExisting.length}${skippedExisting.length ? '  (' + skippedExisting.slice(0, 8).join(', ') + ')' : ''}`);
  if (skippedUrl.length) console.log(`SKIPPED_DUPLICATE_URL: ${skippedUrl.length}  (${skippedUrl.slice(0, 8).join(', ')})`);

  let outText = text;
  if (added.length > 0 && !dryRun) {
    const block = added.map(buildEntry).join('\n') + '\n';
    const lines = text.split('\n');
    const end = findListEnd(lines);
    let insertAt = end;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;
    outText = [...lines.slice(0, insertAt), block.replace(/\n$/, ''), '', ...lines.slice(insertAt)].join('\n');
    writeFileSync(PORTALS, outText, 'utf-8');
    console.log(`wrote ${PORTALS}`);
  } else if (dryRun) {
    console.log('(dry run — portals.yml not written)');
  } else if (added.length === 0) {
    console.log('nothing to add — portals.yml unchanged');
  }

  if (repair) {
    const lines = outText.split('\n');
    const res = await repairStaleEntries(lines, rows, dryRun);
    console.log(`REPAIRED: ${res.repaired.length}`);
    for (const r of res.repaired) console.log(`  ${r.name}: ${r.old}  ->  ${r.next}`);
    if (res.repaired.length > 0 && !dryRun) {
      writeFileSync(PORTALS, res.lines.join('\n'), 'utf-8');
      console.log(`wrote ${PORTALS}`);
    } else if (dryRun) {
      console.log('(dry run — portals.yml not written)');
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (e) { console.error('Fatal:', e.message); process.exit(1); }
}
