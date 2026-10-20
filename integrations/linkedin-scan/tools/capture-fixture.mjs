// Capture a sanitized LinkedIn search-results fixture.
//
//   node integrations/linkedin-scan/tools/capture-fixture.mjs [--out <path>] [--url <url>]
//
// Only two subtrees are saved: the results list and the selected job's detail pane.
// Everything else (nav, profile, scripts, images, inline styles) is dropped, so the
// fixture carries no personal data and stays small enough to commit.
//
// The atomic-renamed twin is generated from the same capture: every obfuscated class
// token (i0…, js0…) is renamed deterministically. The scanner must produce byte-identical
// output from both — that is the guardrail against a class-based dependency.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { renameAtomicClasses } from '../lib/atomic.mjs';

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

/** Obfuscated LinkedIn class tokens: i0lax0, js0lk1, … (letters, then 0, then alnum). */
const ATOMIC_CLASS_RE = /^(?:[a-z]{1,3})0[a-z0-9]{2,}$/;

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

  // Common ancestor that still contains every card.
  let listRoot = list[0].parentElement;
  while (listRoot && list.every((c) => listRoot.contains(c)) === false) {
    listRoot = listRoot.parentElement;
  }
  // Fall back to the ancestor that contains the most cards.
  if (!listRoot || !list.every((c) => listRoot.contains(c))) {
    const counts = new Map();
    for (const c of list) {
      let n = c.parentElement;
      while (n) {
        counts.set(n, (counts.get(n) || 0) + 1);
        n = n.parentElement;
      }
    }
    listRoot = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  const heading = [...document.querySelectorAll('h1,h2,h3,h4')].find(
    (e) => e.textContent.trim() === 'About the job'
  );
  let detailRoot = null;
  if (heading) {
    // Climb to the detail pane root: the last ancestor that does not also
    // contain the results list.
    detailRoot = heading.parentElement;
    for (let i = 0; i < 10 && detailRoot.parentElement; i++) {
      const parent = detailRoot.parentElement;
      if (parent.querySelector('[componentkey^="job-card-component-ref-"]')) break;
      detailRoot = parent;
    }
  }

  const strip = (root) => {
    if (!root) return '';
    const clone = root.cloneNode(true);
    clone
      .querySelectorAll('script,style,noscript,img,svg,link,iframe,button')
      .forEach((el) => el.remove());
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
    jdChars: detailRoot ? detailRoot.innerText.length : 0,
  };
});

await page.close();
await browser.close();

if (!panes.ok) {
  console.error('NO_CARDS: the results list did not render');
  process.exit(3);
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

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, doc);
const renamed = renameAtomicClasses(doc);
const renamedOut = OUT.replace(/\.html$/, '.atomic-renamed.html');
writeFileSync(renamedOut, renamed);

console.log('CARDS:', panes.cards);
console.log('JD_CHARS:', panes.jdChars);
console.log('WROTE:', OUT, doc.length, 'bytes');
console.log('WROTE:', renamedOut, renamed.length, 'bytes');
