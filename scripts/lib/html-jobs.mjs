/**
 * html-jobs.mjs — generic career-page job extraction.
 *
 * This is the fallback for career pages that expose no public API (~87 of
 * the tracked Berlin AI/retail companies). It reads anchors out of the HTML
 * and keeps the ones that look like links to a job posting.
 *
 * Two behaviours the naive version gets wrong:
 *
 *  - `/careers` and `/jobs` are section links, not job links. A job link
 *    needs at least one path segment after the keyword.
 *  - Some boards render every posting link with generic text ("View Job",
 *    "Apply", "Details") and put the real title only in the URL slug. Forto's
 *    board does exactly this. When the anchor text is generic the title is
 *    derived from the slug, with any trailing UUID removed.
 */

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const JOB_HREF = /(job|jobs|karriere|career|stellenangebot|stellenanzeige|vacanc|position|opening|stelle)/i;

// Anchor text that carries no information about the role.
const GENERIC_TEXT = new Set([
  'view job', 'view jobs', 'apply', 'apply now', 'apply now »', 'more', 'more info',
  'more information', 'details', 'detail', 'job', 'jobs', 'read more', 'learn more',
  'show job', 'view details', 'zur stelle', 'ansehen', 'bewerben', 'jetzt bewerben',
  'here', 'open', 'open position', 'position', 'stelle', 'anzeigen', 'details ansehen',
]);

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const LONG_HEX_RE = /[0-9a-f]{16,}/i;

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Turn a URL slug into a readable title: "senior-ml-engineer" → "Senior Ml Engineer". */
export function titleFromSlug(slug) {
  let s = decodeEntities(decodeURIComponent(String(slug || '')));
  s = s.replace(UUID_RE, ' ').replace(LONG_HEX_RE, ' ');
  s = s.replace(/\.(html?|php|aspx?)$/i, ' ');
  s = s.replace(/[-_+]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function cleanText(raw) {
  return decodeEntities(String(raw || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Is this href a link to a specific job posting rather than a section? */
function isJobHref(href) {
  if (!href) return false;
  if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return false;
  let path;
  try {
    const u = new URL(href, 'https://placeholder.invalid');
    path = u.pathname;
  } catch { return false; }
  if (!JOB_HREF.test(path)) return false;
  // A job link carries a slug AFTER the keyword: /jobs/senior-ml-engineer.
  // /careers and /jobs on their own are section links.
  const segments = path.split('/').filter(Boolean);
  const idx = segments.findIndex(s => JOB_HREF.test(s));
  if (idx === -1) return false;
  return idx < segments.length - 1;
}

/**
 * Extract job links from an HTML string.
 * @returns {Array<{title,url,company,location,date,provider}>}
 */
export function extractJobsFromHtml(html, companyName, baseUrl) {
  if (typeof html !== 'string' || !html) return [];
  const out = [];
  const seen = new Set();

  // Match <a ... href="...">inner</a> — inner may contain nested tags.
  const re = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!isJobHref(href)) continue;

    let abs;
    try { abs = new URL(href, baseUrl).href; } catch { continue; }
    abs = abs.split('#')[0];
    if (!abs || seen.has(abs)) continue;

    const text = cleanText(m[4] ?? '');
    let title = text;
    if (!title || title.length < 3 || title.length > 160 || GENERIC_TEXT.has(text.toLowerCase())) {
      // Generic or unusable anchor text — fall back to the URL slug.
      let slug = '';
      try { slug = decodeURIComponent(new URL(abs).pathname.split('/').filter(Boolean).pop() || ''); }
      catch { slug = ''; }
      title = titleFromSlug(slug);
      // A slug that is only an id ("12345") is not a title. Reject it rather
      // than reporting the id as the role.
      if (!/[a-zA-Z]/.test(title)) title = '';
    }
    if (!title || title.length < 3 || title.length > 160) continue;

    seen.add(abs);
    out.push({
      title,
      url: abs,
      company: companyName,
      location: '',
      date: null,
      provider: 'html',
    });
  }
  return out;
}

// ── browser session ─────────────────────────────────────────────────────
/**
 * One browser for the whole run. Launching a browser per company would
 * thrash the machine across ~90 pages; a single instance with one page at a
 * time is both faster and gentler.
 */
export async function createBrowserSession() {
  const { chromium } = await import('playwright');
  let browser = null;
  let page = null;

  async function ensure() {
    if (browser && browser.isConnected()) return;
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({
      userAgent: UA,
      viewport: { width: 1440, height: 1000 },
    });
  }

  return {
    async fetchPage(url) {
      await ensure();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      return page.content();
    },
    async close() {
      try { if (browser) await browser.close(); } catch { /* already gone */ }
      browser = null; page = null;
    },
  };
}

/**
 * One-shot browser extraction: opens its own session and closes it.
 * Convenient for a single page; the scanner should use createBrowserSession()
 * and reuse it.
 */
export async function extractJobsWithBrowser(careersUrl, companyName, session) {
  const own = !session;
  const s = session || await createBrowserSession();
  try {
    const html = await s.fetchPage(careersUrl);
    return extractJobsFromHtml(html, companyName, careersUrl);
  } catch {
    return [];
  } finally {
    if (own) await s.close();
  }
}
