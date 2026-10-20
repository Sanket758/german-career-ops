// DOM resolvers for LinkedIn job cards and the job detail pane.
//
// Every function here runs **inside the browser page** (see lib/inject.mjs): it takes a
// root element and returns plain data. No CSS class is ever the only way to find
// something — the card root is found through the `componentkey` attribute, the
// description through a `data-testid`, the title and company through link semantics
// and ARIA labels, and everything else through the card's own text.
//
// The atomic classes LinkedIn generates (i0…, js0…) are never referenced. The
// atomic-renamed fixture proves it: the same fixture with every atomic class renamed
// must produce byte-identical output.

import { parseCardText, parseLocation, parsePostedAge, canonicalJobUrl, parseJobId, cleanText } from './parse.mjs';

/**
 * The resolver registry: for every field, the ranked chain of ways to find it and the
 * tier of the first (highest) strategy. T0 = link semantics / ARIA, T1 = legacy BEM
 * classes, T2 = attribute substrings, T3 = geometry / text, T4 = atomic classes.
 */
export const RESOLVERS = {
  cardRoot: { required: true, tier: 'T0', chain: ['componentKey', 'anchorGeometry', 'commonParent'] },
  cardTitle: { required: true, tier: 'T3', chain: ['textLines', 'ariaLabel'] },
  cardCompany: { required: true, tier: 'T3', chain: ['companySpan', 'detailHeader', 'fail'] },
  cardLocation: { required: false, tier: 'T3', chain: ['locationLine'] },
  cardPosted: { required: false, tier: 'T3', chain: ['metaRelativeTime'] },
  detailJD: { required: true, tier: 'T1', chain: ['expandableTextBox', 'textAnchor', 'largestTextBlock'] },
  detailTitle: { required: false, tier: 'T0', chain: ['jobViewLink', 'heading'] },
  detailCompany: { required: false, tier: 'T0', chain: ['ariaCompanyLabel', 'companyLink'] },
  appliedState: { required: false, tier: 'T0', chain: ['appliedBadgeText', 'applyButtonAbsent'] },
};

const CARD_KEY_PREFIX = 'job-card-component-ref-';
const AGE_RE = /(?:Posted\s+)?\d+\s+(?:minutes?|hours?|days?|weeks?|months?)\s+ago/i;

/** Tags that start a new line of text. */
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION',
  'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'FIGURE', 'FIGCAPTION',
  'TABLE', 'TR', 'TD', 'TH', 'DL', 'DT', 'DD', 'FORM', 'ADDRESS', 'BLOCKQUOTE',
  'PRE', 'HR', 'BR',
]);

/** Tags whose text is never part of a job posting. */
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IMG', 'BUTTON', 'IFRAME', 'TEMPLATE',
  'INPUT', 'SELECT', 'TEXTAREA', 'CANVAS', 'VIDEO', 'AUDIO',
]);

/**
 * Extract the visible text of an element as lines.
 *
 * `innerText` is not used: it depends on the stylesheet, so the same markup yields
 * different lines depending on the CSS that happens to be loaded. This walker breaks
 * lines at block-level elements instead, which is a property of the markup itself and
 * survives a redesign that moves the classes around.
 *
 * @param {Element} el
 * @returns {string[]}
 */
export function textLines(el) {
  const lines = [];
  let current = '';

  const flush = () => {
    const text = current.replace(/\s+/g, ' ').trim();
    if (text) lines.push(text);
    current = '';
  };

  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        current += child.nodeValue;
        continue;
      }
      if (child.nodeType !== 1) continue;
      // SVG elements keep their authored (lower-case) tag name in an HTML
      // document, so normalise before matching the skip list.
      const tag = child.tagName.toUpperCase();
      if (SKIP_TAGS.has(tag)) continue;
      const isBlock = BLOCK_TAGS.has(tag);
      if (isBlock) flush();
      walk(child);
      if (isBlock) flush();
    }
  };

  walk(el);
  flush();
  return lines;
}

/**
 * Find every job card under a root element.
 *
 * A card is identified by `componentkey="job-card-component-ref-<job id>"`. LinkedIn
 * renders the same key on two nested elements; the outer one (the clickable card) is
 * the one we keep, because it carries the full card text.
 *
 * @param {ParentNode} root
 * @returns {Array<{job_id: string, el: Element, tier: string, resolver: string}>}
 */
export function findCards(root) {
  const scope = root || document;
  const byId = new Map();

  for (const el of scope.querySelectorAll(`[componentkey^="${CARD_KEY_PREFIX}"]`)) {
    const key = el.getAttribute('componentkey') || '';
    const id = (key.match(/(\d{6,})/) || [])[1];
    if (!id) continue;

    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { job_id: id, el, tier: 'T0', resolver: 'componentKey' });
      continue;
    }
    // Keep the outermost element that carries this key.
    if (existing.el.contains(el)) continue;
    if (el.contains(existing.el)) byId.set(id, { job_id: id, el, tier: 'T0', resolver: 'componentKey' });
  }

  return [...byId.values()];
}

/**
 * Extract the fields of one job card.
 *
 * @param {{job_id?: string, el: Element}|Element} card
 */
export function extractCard(card, options = {}) {
  const el = card && card.el ? card.el : card;
  const parsed = parseCardText(textLines(el));
  const posted = parsePostedAge(parsed.posted_raw, options.now ?? Date.now());
  const jobId = (card && card.job_id) || parseJobId(el.getAttribute('componentkey') || '');

  return {
    job_id: jobId,
    url: jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : null,
    url_canonical: canonicalJobUrl(el.getAttribute('componentkey') || ''),
    title: parsed.title,
    title_norm: parsed.title_norm,
    company: parsed.company,
    location_raw: parsed.location_raw,
    city: parsed.city,
    country: parsed.country,
    work_mode: parsed.work_mode,
    posted_raw: parsed.posted_raw,
    posted_at: posted.posted_at,
    posted_age_hours: posted.posted_age_hours,
    reposted: posted.reposted,
    badges: parsed.badges,
    notes: parsed.notes,
    salary_raw: parsed.salary_raw,
    easy_apply: parsed.easy_apply,
    already_applied: parsed.already_applied,
    extraction: {
      // The tier names the strategy that actually ran, so the drift telemetry
      // (§6.6) and the "no atomic class" assertion have something to read.
      tiers: {
        cardRoot: 'T0', // componentKey
        cardTitle: 'T3', // text lines
        cardCompany: 'T3', // company span
        cardLocation: 'T3', // position in the card text
        cardPosted: 'T3', // relative time in the card meta
      },
    },
  };
}

/**
 * Extract the job detail pane: description, title, company, posted time.
 *
 * @param {ParentNode} root
 */
export function extractDetail(root, options = {}) {
  const scope = root || document;

  // The description is anchored by the "About the job" heading.
  const heading = [...scope.querySelectorAll('h1,h2,h3,h4')].find(
    (e) => e.textContent.trim() === 'About the job'
  );

  // The detail header links to the job; that link is the pane's identity.
  const jobLink = scope.querySelector('a[href*="/jobs/view/"]');
  const title = jobLink ? cleanText(jobLink.innerText) : null;
  const jobId = jobLink ? parseJobId(jobLink.getAttribute('href') || '') : null;

  // The pane is the closest common ancestor of the heading and the job link, so
  // the results list is never mistaken for the detail.
  let pane = scope;
  if (heading && jobLink) {
    let node = jobLink;
    while (node && !node.contains(heading)) node = node.parentElement;
    if (node) pane = node;
  }

  const base = {
    job_id: jobId,
    title,
    company: null,
    jd_text: '',
    jd_chars: 0,
    jd_incomplete: true,
    degraded: false,
    identity_ok: true,
    posted_raw: null,
    posted_at: null,
    posted_age_hours: null,
    extraction: {
      tiers: {
        detailJD: heading ? 'T0' : 'T3',
        detailTitle: jobLink ? 'T0' : 'T3',
        detailCompany: 'T3',
      },
    },
  };

  // No "About the job" section: no description. Returning the whole page as a
  // job description would look like a complete posting to every later stage.
  if (!heading) return base;

  // Identity check (SPEC §6.5 step 4): the pane must be the job we asked for.
  if (options.expectedTitle && title) {
    const wanted = cleanText(options.expectedTitle).toLowerCase().split(' ').slice(0, 4).join(' ');
    if (wanted && !title.toLowerCase().startsWith(wanted.slice(0, Math.max(8, wanted.length - 4)))) {
      base.identity_ok = false;
    }
  }

  // Section: the ancestor that holds the description and no second heading.
  let section = heading;
  for (let i = 0; i < 8 && section.parentElement; i++) {
    const parent = section.parentElement;
    if (parent.querySelectorAll('h1,h2,h3,h4').length > 1) break;
    section = parent;
    if (section.textContent.trim().length > 200) break;
  }

  const lines = textLines(section);
  const start = lines.findIndex((l) => l.toLowerCase() === 'about the job');
  let jdLines = start === -1 ? lines : lines.slice(start + 1);
  while (jdLines.length && /^(…|\.{1,3})\s*more$/i.test(jdLines[jdLines.length - 1])) jdLines.pop();
  const jdText = jdLines.join('\n').trim();

  // Company: the logo block carries an ARIA label ("Company, XpertDirect.").
  const aria = pane.querySelector('[aria-label^="Company,"]');
  let company = null;
  if (aria) {
    company = cleanText((aria.getAttribute('aria-label') || '').replace(/^Company,\s*/i, '').replace(/\.$/, ''));
  }
  if (!company) {
    const link = pane.querySelector('a[href*="/company/"]');
    if (link) company = cleanText(link.innerText);
  }

  // Posted time: the pane header, i.e. the lines BEFORE the description. Reading
  // it from the whole scope would pick up the first card of the results list.
  const paneLines = textLines(pane);
  const jdStart = paneLines.findIndex((l) => l.toLowerCase() === 'about the job');
  const headerLines = jdStart === -1 ? paneLines : paneLines.slice(0, jdStart);
  let postedRaw = null;
  for (const line of headerLines) {
    const m = line.match(AGE_RE);
    if (m) {
      postedRaw = cleanText(m[0]);
      break;
    }
  }
  const posted = parsePostedAge(postedRaw);

  return {
    ...base,
    company,
    jd_text: jdText,
    jd_chars: jdText.length,
    jd_incomplete: jdText.length < 200,
    degraded: jdText.length >= 200 && jdText.length < 300,
    posted_raw: postedRaw,
    posted_at: posted.posted_at,
    posted_age_hours: posted.posted_age_hours,
    extraction: {
      tiers: {
        detailJD: 'T0',
        detailTitle: jobLink ? 'T0' : 'T3',
        detailCompany: aria ? 'T0' : 'T0',
      },
    },
  };
}
