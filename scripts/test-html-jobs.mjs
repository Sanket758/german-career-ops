#!/usr/bin/env node

/**
 * test-html-jobs.mjs — tests for the generic HTML job extractor.
 *
 * The extractor is the fallback for the ~87 career pages that expose no
 * public API. It reads anchors out of the page and keeps the ones that
 * look like job links.
 *
 * Usage:
 *   node scripts/test-html-jobs.mjs
 *   node scripts/test-html-jobs.mjs --live
 */

import { extractJobsFromHtml, extractJobsWithBrowser, titleFromSlug } from '../scripts/lib/html-jobs.mjs';

let fail = 0;
function check(ok, label, detail) {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  → ' + (detail ?? '')}`);
}

const BASE = 'https://example.com/careers';

// A — a plain careers page with one job link
const A = `<html><body>
  <nav><a href="/about">About</a><a href="/impressum">Impressum</a></nav>
  <ul>
    <li><a href="/jobs/senior-ml-engineer">Senior ML Engineer</a></li>
    <li><a href="/jobs/data-engineer-python">Data Engineer (Python)</a></li>
  </ul>
</body></html>`;
const aJobs = extractJobsFromHtml(A, 'ExampleCo', BASE);
check(aJobs.length === 2, 'A: two job links found', `got ${aJobs.length}`);
check(aJobs[0] && aJobs[0].title === 'Senior ML Engineer', 'A: title from anchor text', aJobs[0] && aJobs[0].title);
check(aJobs[0] && aJobs[0].url === 'https://example.com/jobs/senior-ml-engineer', 'A: absolute url', aJobs[0] && aJobs[0].url);
check(aJobs[0] && aJobs[0].company === 'ExampleCo', 'A: company carried through', aJobs[0] && aJobs[0].company);
check(aJobs[0] && aJobs[0].date === null, 'A: date is null for plain HTML', aJobs[0] && aJobs[0].date);
check(aJobs[0] && aJobs[0].provider === 'html', 'A: provider tag', aJobs[0] && aJobs[0].provider);
check(aJobs[1] && aJobs[1].title === 'Data Engineer (Python)', 'A: second title', aJobs[1] && aJobs[1].title);

// B — links that are NOT job links
const B = `<html><body>
  <a href="/careers">Careers</a>
  <a href="/jobs">Jobs</a>
  <a href="/impressum">Impressum</a>
  <a href="/privacy-policy">Privacy</a>
  <a href="/search?query=jobs">Search jobs</a>
  <a href="mailto:jobs@example.com">Contact</a>
</body></html>`;
check(extractJobsFromHtml(B, 'ExampleCo', BASE).length === 0,
  'B: navigation / search / mailto links are not job links',
  `got ${extractJobsFromHtml(B, 'ExampleCo', BASE).length}`);

// C — a job-looking href with empty anchor text
const C = `<html><body><a href="/jobs/12345"></a><a href="/jobs/99999">   </a></body></html>`;
check(extractJobsFromHtml(C, 'ExampleCo', BASE).length === 0,
  'C: empty anchor text yields no job', `got ${extractJobsFromHtml(C, 'ExampleCo', BASE).length}`);

// D — German page
const D = `<html><body><a href="/stellenangebote/entwickler-python-m-w-d">Entwickler Python (m/w/d)</a></body></html>`;
const dJobs = extractJobsFromHtml(D, 'ExampleCo', BASE);
check(dJobs.length === 1, 'D: German job link found', `got ${dJobs.length}`);
check(dJobs[0] && dJobs[0].title === 'Entwickler Python (m/w/d)', 'D: German title preserved', dJobs[0] && dJobs[0].title);
check(dJobs[0] && dJobs[0].url.includes('/stellenangebote/entwickler-python-m-w-d'), 'D: German url', dJobs[0] && dJobs[0].url);

// E — relative href
const E = `<html><body><a href="../job/68210131/Praktikant-Smarte-Loesungen">Praktikant (m/w/d)</a></body></html>`;
const eJobs = extractJobsFromHtml(E, 'ExampleCo', 'https://wenglorsensoric.softgarden.io/de/vacancies');
check(eJobs.length === 1, 'E: relative href resolved', `got ${eJobs.length}`);
check(eJobs[0] && eJobs[0].url.startsWith('https://wenglorsensoric.softgarden.io/'), 'E: absolute url from relative href', eJobs[0] && eJobs[0].url);

// F — over-long anchor text
const F = `<html><body><a href="/jobs/1">${'x'.repeat(200)}</a></body></html>`;
check(extractJobsFromHtml(F, 'ExampleCo', BASE).length === 0, 'F: 200-char anchor text rejected',
  `got ${extractJobsFromHtml(F, 'ExampleCo', BASE).length}`);

// G — hostile markup must not throw
const G = `<html><body><a href="/jobs/a?x=1&y=2">A & B</a>
<script>var s = "</a>";</script>
<a href='/jobs/single-quoted'>Single quoted</a>
<a href="/jobs/amp&amp;ersand">Amp &amp; ersand</a>
</body></html>`;
let threw = null, gJobs = null;
try { gJobs = extractJobsFromHtml(G, 'ExampleCo', BASE); } catch (e) { threw = e.message; }
check(threw === null && Array.isArray(gJobs), 'G: hostile markup does not throw', threw || 'not an array');
check(gJobs && gJobs.length >= 2, 'G: still finds the real job links', gJobs && `got ${gJobs.length}`);

// H — duplicate links to the same job collapse
const H = `<html><body>
  <a href="/jobs/one">One</a>
  <a href="/jobs/one#apply">One again</a>
  <a href="/jobs/two">Two</a>
</body></html>`;
const hJobs = extractJobsFromHtml(H, 'ExampleCo', BASE);
check(hJobs.length === 2, 'H: duplicate URLs collapse (hash ignored)', `got ${hJobs.length}`);

// I — generic anchor text falls back to the URL slug.
// Forto's board renders every link as "View Job"; the title only exists in
// the URL. Without this, Forto (and similar boards) yield useless titles.
const I = `<html><body>
  <a href="https://careers.forto.com/forto-jobs/market-intelligence-analyst-8847554b-267e-4c22-881e-fe0638b02ad3/">View Job</a>
  <a href="/jobs/operations-specialist-inbound-9daa12be-1543-468a-83f7-d3876cb52971/">View Job</a>
</body></html>`;
const iJobs = extractJobsFromHtml(I, 'Forto', 'https://careers.forto.com/forto-jobs/');
check(iJobs.length === 2, 'I: generic-text links still yield jobs', `got ${iJobs.length}`);
check(iJobs[0] && /market intelligence analyst/i.test(iJobs[0].title), 'I: title derived from slug', iJobs[0] && iJobs[0].title);
check(iJobs[0] && !/^[0-9a-f-]{36}$/i.test(iJobs[0].title), 'I: uuid stripped from title', iJobs[0] && iJobs[0].title);
check(iJobs[1] && /operations specialist inbound/i.test(iJobs[1].title), 'I: second slug title', iJobs[1] && iJobs[1].title);

// J — slug helper
check(titleFromSlug('senior-ml-engineer-berlin') === 'Senior Ml Engineer Berlin', 'J: slug → title');
check(titleFromSlug('view-job') === 'View Job', 'J: simple slug');

// K — empty / garbage input
check(extractJobsFromHtml('', 'X', BASE).length === 0, 'K: empty html → no jobs');
check(extractJobsFromHtml('<html></html>', 'X', BASE).length === 0, 'K: html without links → no jobs');

// ── live smoke test ─────────────────────────────────────────────────────
if (process.argv.includes('--live')) {
  const url = 'https://www.hive.app/careers';
  let jobs = [];
  try { jobs = await extractJobsWithBrowser(url, 'HIVE'); }
  catch (e) { check(false, 'live browser extraction', e.message); }
  check(jobs.length >= 1, 'live browser extraction finds roles', `got ${jobs.length}`);
  check(jobs.every(j => j.url.startsWith('http')), 'live: every url is absolute');
  check(jobs.every(j => j.title && j.title.length > 2), 'live: every job has a real title',
    JSON.stringify(jobs.slice(0, 2).map(j => j.title)));
  if (jobs.length) console.log(`      sample: "${jobs[0].title}" | ${jobs[0].url}`);
}

console.log(fail === 0 ? '\nAll cases pass' : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
