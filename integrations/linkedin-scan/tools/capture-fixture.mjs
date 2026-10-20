// Capture a sanitized LinkedIn search-results fixture.
//
//   node integrations/linkedin-scan/tools/capture-fixture.mjs [--out <path>] [--url <url>]
//
// Only two subtrees are saved: the results list and the selected job's detail pane.
// Everything else (nav, profile, scripts, images, inline styles) is dropped, and the
// write is refused outright if anything personal survives the sanitizing.
//
// The atomic-renamed twin is generated from the same capture: every obfuscated class
// token (i0…, js0…) is renamed deterministically. The scanner must produce byte-identical
// output from both — that is the guardrail against a class-based dependency.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { renameAtomicClasses } from '../lib/atomic.mjs';
import { findPersonalData, isClean, stripProfileLinks } from '../lib/sanitize.mjs';

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const URL_ = argOf(
  '--url',
  'https://www.linkedin.com/jobs/search-results/?keywords=AI%20ML&location=Berlin&geoId=101282230&distance=80&f_AL=true&f_E=2%2C3%2C4&f_JT=F&f_TPR=r86400'
);
const OUT = resolve(argOf('--out', 'integrations/linkedin-scan/fixtures/search-results.html'));
const CDP = argOf('--cdp', 'http://127.0.0.1:9222');
const WAIT_MS = Number(argOf('--wait', 12000));

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(WAIT_MS);

const url = page.url();
if (/\/login|\/uas\/|authwall/i.test(url)) {
  console.error('NOT_AUTHENTICATED', url);
  await browser.close();
  process.exit(2);
}

const panes = await page.evaluate(() => {
  const cards = new Map();
  for (const el of document.querySelectorAll('[componentkey^="job-card-component-ref-"]')) {
    const id = el.getAttribute('componentkey').match(/(\d{6,})/)?.[1];
    if (id && !cards.has(id)) cards.set(id, el);
  }
  const list = [...cards.values()];
  if (!list.length) return { ok: false };

  // The list root: the smallest ancestor that still contains every card. The
  // smallest one is the one without the page chrome around it.
  let listRoot = null;
  for (let node = list[0].parentElement; node; node = node.parentElement) {
    if (!list.every((c) => node.contains(c))) continue;
    if (!listRoot || node.textContent.length < listRoot.textContent.length) listRoot = node;
  }
  if (!listRoot) return { ok: false };

  // The detail pane: the last ancestor of the "About the job" heading that does
  // not also contain the results list.
  const heading = [...document.querySelectorAll('h1,h2,h3,h4')].find(
    (e) => e.textContent.trim() === 'About the job'
  );
  let detailRoot = null;
  if (heading) {
    detailRoot = heading.parentElement;
    for (let i = 0; i < 10 && detailRoot.parentElement; i++) {
      const parent = detailRoot.parentElement;
      if (parent.querySelector('[componentkey^="job-card-component-ref-"]')) break;
      detailRoot = parent;
    }
  }

  // Who is the account holder? Their name and e-mail must never be committed.
  const names = new Set();
  const emails = new Set();
  for (const a of document.querySelectorAll('a[href*="/in/"]')) {
    const label = (a.getAttribute('aria-label') || a.innerText || '').trim();
    if (label && label.length > 2) names.add(label);
  }
  for (const m of document.body.innerText.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) {
    emails.add(m[0]);
  }

  // The page chrome that the search pane drags in: the global footer links and
  // the job-alert promo. None of it belongs to a job card.
  const CHROME_TEXT = [
    'privacy & terms', 'accessibility', 'help center', 'ad choices', 'advertising',
    'business services', 'get the linkedin app', 'linkedin corporation',
    'get job alerts for this search', 'sign in', 'join now', 'cookie policy',
    'user agreement', 'privacy policy', 'language',
  ];

  const strip = (root) => {
    if (!root) return '';
    const clone = root.cloneNode(true);
    clone
      .querySelectorAll('script,style,noscript,img,svg,link,iframe,button,a[href*="/in/"]')
      .forEach((el) => el.remove());
    clone.querySelectorAll('p').forEach((el) => {
      const text = el.textContent.trim().toLowerCase();
      if (text && CHROME_TEXT.includes(text)) el.remove();
    });
    clone.querySelectorAll('a[href*="n_nav"], a[href*="trk="]').forEach((el) => el.remove());
    clone
      .querySelectorAll('*')
      .forEach((el) => {
        for (const attr of [...el.attributes]) {
          if (attr.name === 'style' || attr.name.startsWith('on')) el.removeAttribute(attr.name);
        }
      });
    return clone.outerHTML;
  };

  return {
    ok: true,
    cards: list.length,
    listHtml: strip(listRoot),
    detailHtml: strip(detailRoot),
    listRootTag: listRoot.tagName,
    listRootIsBody: listRoot === document.body || listRoot === document.documentElement,
    names: [...names],
    emails: [...emails],
  };
});

await page.close();
await browser.close();

if (!panes.ok) {
  console.error('NO_CARDS: the results list did not render');
  process.exit(3);
}

if (panes.listRootIsBody) {
  console.error('REFUSING: the results list resolved to <body> — the capture would include page chrome');
  process.exit(4);
}

const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>LinkedIn job search fixture</title>
</head>
<body>
<!-- Captured ${new Date().toISOString()} from ${URL_} — sanitized: no nav, no profile, no scripts, no images. -->
<div id="search-results">
${panes.listHtml}
</div>
<div id="job-detail">
${panes.detailHtml}
</div>
</body>
</html>
`;

const stripped = stripProfileLinks(doc);
const found = findPersonalData(stripped, { names: panes.names, emails: panes.emails });
if (!isClean(found)) {
  console.error('REFUSING: personal data survived the sanitizer — no file written');
  console.error('  names:', found.names);
  console.error('  emails:', found.emails);
  console.error('  profile links:', found.profileHrefs.slice(0, 5));
  process.exit(5);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, stripped);
const renamed = renameAtomicClasses(stripped);
const renamedOut = OUT.replace(/\.html$/, '.atomic-renamed.html');
writeFileSync(renamedOut, renamed);

console.log('CARDS:', panes.cards);
console.log('LIST ROOT:', panes.listRootTag);
console.log('WROTE:', OUT, stripped.length, 'bytes');
console.log('WROTE:', renamedOut, renamed.length, 'bytes');
