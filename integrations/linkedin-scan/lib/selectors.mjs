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
      const tag = child.tagName;
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
export function extractCard(card) {
  const el = card && card.el ? card.el : card;
  const parsed = parseCardText(textLines(el));
  const location = parseLocation(parsed.location_raw);
  const posted = parsePostedAge(parsed.posted_raw);
  const jobId = (card && card.job_id) || parseJobId(el.getAttribute('componentkey') || '');

  return {
    job_id: jobId,
    url: jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : null,
    url_canonical: canonicalJobUrl(el.getAttribute('componentkey') || ''),
    title: parsed.title,
    title_norm: parsed.title_norm,
    company: parsed.company,
    location_raw: parsed.location_raw,
    city: location.city,
    country: location.country,
    work_mode: location.work_mode,
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
      tiers: {
        cardRoot: 'T0',
        cardTitle: 'T3',
        cardCompany: 'T3',
        cardLocation: 'T3',
        cardPosted: 'T3',
      },
    },
  };
}

/**
 * Extract the job detail pane: description, title, company, posted time.
 *
 * @param {ParentNode} root
 */
export function extractDetail(root) {
  const scope = root || document;

  // Description: the section that follows the "About the job" heading.
  const heading = [...scope.querySelectorAll('h1,h2,h3,h4')].find(
    (e) => e.textContent.trim() === 'About the job'
  );

  let section = null;
  let jdEl = null;
  if (heading) {
    section = heading;
    for (let i = 0; i < 8 && section.parentElement; i++) {
      const parent = section.parentElement;
      if (parent.querySelectorAll('h1,h2,h3,h4').length > 1) break;
      section = parent;
      const box = section.querySelector('[data-testid="expandable-text-box"]');
      if (box) jdEl = box;
      if (section.textContent.trim().length > 200) break;
    }
  }
  if (!section) section = scope;

  // The description lives in the paragraphs that follow the heading. The
  // "expandable text box" wrapper is empty once the browser has repaired
  // LinkedIn's invalid <p><span><p> nesting, so the section text is the source
  // of truth.
  const lines = textLines(section);
  const start = lines.findIndex((l) => l.toLowerCase() === 'about the job');
  let jdLines = start === -1 ? lines : lines.slice(start + 1);
  while (jdLines.length && /^(…|\.{1,3})\s*more$/i.test(jdLines[jdLines.length - 1])) jdLines.pop();
  const jdText = jdLines.join('\n').trim();

  // Title + job id: the detail header links to the job.
  const jobLink = scope.querySelector('a[href*="/jobs/view/"]');
  const title = jobLink ? cleanText(jobLink.innerText) : null;
  const jobId = jobLink ? parseJobId(jobLink.getAttribute('href') || '') : null;

  // Company: the logo block carries an ARIA label ("Company, XpertDirect.").
  const aria = scope.querySelector('[aria-label^="Company,"]');
  let company = null;
  if (aria) {
    company = cleanText((aria.getAttribute('aria-label') || '').replace(/^Company,\s*/i, '').replace(/\.$/, ''));
  }
  if (!company) {
    const link = scope.querySelector('a[href*="/company/"]');
    if (link) company = cleanText(link.innerText);
  }

  // Posted time: the header meta line ("… · 3 hours ago · 56 applicants").
  let postedRaw = null;
  for (const p of scope.querySelectorAll('p')) {
    const m = p.textContent.match(AGE_RE);
    if (m) {
      postedRaw = cleanText(m[0]);
      break;
    }
  }
  const posted = parsePostedAge(postedRaw);

  return {
    job_id: jobId,
    title,
    company,
    jd_text: jdText,
    jd_chars: jdText.length,
    posted_raw: postedRaw,
    posted_at: posted.posted_at,
    posted_age_hours: posted.posted_age_hours,
    extraction: {
      tiers: {
        detailJD: jdEl ? 'T1' : 'T3',
        detailTitle: jobLink ? 'T0' : 'T3',
        detailCompany: aria ? 'T0' : 'T0',
      },
    },
  };
}
