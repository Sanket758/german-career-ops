/**
 * ats-providers.mjs — job-board adapters.
 *
 * Each provider turns a company's careers URL into a normalised job list:
 *   { title, url, company, location, date, provider }
 * `date` is 'YYYY-MM-DD' or null (the board gave no date).
 *
 * Every endpoint and field name here was verified against the live service
 * on 2026-10-20. Two of them are easy to get wrong:
 *   - Lever EU boards live on api.eu.lever.co, US boards on api.lever.co.
 *   - Personio serves its feed on the same TLD as the board (.de or .com).
 * Neither may be hardcoded.
 */

// ── helpers ─────────────────────────────────────────────────────────────
export function toISODate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    const ms = value > 1e11 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function pathOf(url) {
  try { return new URL(url).pathname; } catch { return ''; }
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function titleFromSlug(slug) {
  return decodeEntities(decodeURIComponent(slug))
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(raw) {
  return decodeEntities(String(raw || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// ── detection ───────────────────────────────────────────────────────────
export function detectProvider(careersUrl) {
  if (!careersUrl || !/^https?:/i.test(careersUrl)) return null;
  const host = hostOf(careersUrl);
  const path = pathOf(careersUrl);
  if (!host) return null;

  const mk = (type, url, slug, extra = {}) => ({ type, url, slug, host, ...extra });

  // Greenhouse
  let m = host.match(/^job-boards(?:\.eu)?\.greenhouse\.io$/);
  if (m) {
    const slug = path.split('/').filter(Boolean)[0];
    if (slug) return mk('greenhouse', `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, slug);
  }
  if (host === 'boards.greenhouse.io') {
    const slug = path.split('/').filter(Boolean)[0];
    if (slug) return mk('greenhouse', `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, slug);
  }

  // Ashby
  if (host === 'jobs.ashbyhq.com') {
    const slug = path.split('/').filter(Boolean)[0];
    if (slug) return mk('ashby', `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`, slug);
  }

  // Lever — the API host depends on the board's region.
  if (host === 'jobs.lever.co') {
    const slug = path.split('/').filter(Boolean)[0];
    if (slug) return mk('lever', `https://api.lever.co/v0/postings/${slug}`, slug);
  }
  if (host === 'jobs.eu.lever.co') {
    const slug = path.split('/').filter(Boolean)[0];
    if (slug) return mk('lever', `https://api.eu.lever.co/v0/postings/${slug}`, slug);
  }

  // Personio — XML feed on the board's own TLD.
  m = host.match(/^(.+)\.jobs\.personio\.(de|com)$/);
  if (m) {
    const slug = m[1], tld = m[2];
    return mk('personio', `https://${slug}.jobs.personio.${tld}/xml`, slug, { tld });
  }

  // Recruitee
  m = host.match(/^(.+)\.recruitee\.com$/);
  if (m) {
    const slug = m[1];
    return mk('recruitee', `https://${slug}.recruitee.com/api/offers/`, slug);
  }

  // SmartRecruiters — the board may sit on jobs.* or careers.*, the API never does.
  m = host.match(/^(?:jobs|careers)\.smartrecruiters\.com$/);
  if (m) {
    const slug = path.split('/').filter(Boolean)[0];
    if (slug) return mk('smartrecruiters', `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`, slug);
  }

  // BambooHR
  m = host.match(/^(.+)\.bamboohr\.com$/);
  if (m) {
    const slug = m[1];
    return mk('bamboohr', `https://${slug}.bamboohr.com/careers/list`, slug);
  }

  // Workday — https://{company}.{shard}.myworkdayjobs.com/{locale}/{site}
  if (host.endsWith('.myworkdayjobs.com')) {
    const parts = path.split('/').filter(Boolean);
    const company = host.split('.')[0];
    const site = parts[parts.length - 1];
    const locale = parts.length >= 2 ? parts[parts.length - 2] : 'en-US';
    if (company && site) {
      const base = `https://${host}/${locale}/${site}`;
      return mk('workday', `${base}/wday/cxs/${company}/${site}/jobs`, company, { base, site });
    }
  }

  // Workable — the board is a JS shell (no <a href> job links in the HTML),
  // so the HTML/browser path loses every posting. The widget endpoint returns
  // the same board as JSON: title, url, city/state/country, published_on.
  if (host === 'apply.workable.com') {
    const slug = path.split('/').filter(Boolean)[0];
    if (slug) return mk('workable', `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`, slug);
  }

  // DigitalRecruiters careers sites (jobs.exail.com, ...). The board is a JS
  // app: /en/annonces renders no job links in the HTML, so the list has to
  // come from the public JSON API. The board path always ends in /annonces.
  if (/\/annonces?\/?$/.test(path)) {
    const segs = path.split('/').filter(Boolean);
    const locale = segs.length > 1 ? segs[0] : 'en';
    // The board URL carries a short locale ("en"); the API wants the full one
    // ("en_GB") and rejects the short form.
    const apiLocale = { en: 'en_GB', fr: 'fr_FR', nl: 'nl_NL', de: 'de_DE', es: 'es_ES', it: 'it_IT' }[locale] || 'en_GB';
    return mk('digitalrecruiters',
      `https://api.digitalrecruiters.com/public/v1/careers-site/job-ads?domainName=${host}`,
      host, { domain: host, locale, apiLocale });
  }

  // WelcomeKit / Welcome to the Jungle company boards. The board is
  // server-rendered and each card carries its office city, which the generic
  // HTML extractor throws away — a board full of French roles would then look
  // location-less and slip past the location filter.
  if (host.endsWith('.welcomekit.co')) {
    const slug = path.split('/').filter(Boolean)[0] || host;
    return mk('welcomekit', careersUrl, slug);
  }

  // join.com
  if (host === 'join.com') {
    const slug = path.match(/^\/companies\/([^/]+)/)?.[1];
    if (slug) return mk('join', `https://join.com/companies/${slug}`, slug);
  }

  // Softgarden — HTML only, but it is a known board, so name it explicitly
  // rather than letting it fall through to the generic HTML path.
  if (/\.softgarden\.(io|de)$/.test(host)) {
    const url = /vacanc/i.test(path) ? careersUrl : `https://${host}/vacancies`;
    return mk('softgarden', url, host);
  }

  return null;
}

// ── parsers ─────────────────────────────────────────────────────────────
function parseGreenhouse(json, company) {
  const jobs = json?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.map(j => ({
    title: j.title || '',
    url: j.absolute_url || '',
    company,
    location: j.location?.name || '',
    date: toISODate(j.first_published || j.updated_at),
    provider: 'greenhouse',
  }));
}

function parseLever(json, company) {
  const list = Array.isArray(json) ? json : (json?.postings || []);
  if (!Array.isArray(list)) return [];
  return list.map(j => ({
    title: j.text || '',
    url: j.hostedUrl || j.applyUrl || '',
    company,
    location: j.categories?.location || '',
    date: toISODate(j.createdAt),
    provider: 'lever',
  }));
}

function parseAshby(json, company) {
  const jobs = json?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.map(j => ({
    title: j.title || '',
    url: j.jobUrl || j.jobUrl || (j.id ? `https://jobs.ashbyhq.com/${company}/${j.id}` : ''),
    company,
    location: j.location || '',
    date: toISODate(j.publishedAt),
    provider: 'ashby',
  }));
}

function parseRecruitee(json, company) {
  const offers = json?.offers;
  if (!Array.isArray(offers)) return [];
  return offers.map(j => ({
    title: j.title || j.name || '',
    url: j.url || j.career_url || '',
    company,
    location: j.location || j.city || '',
    date: toISODate(j.created_at || j.published_at),
    provider: 'recruitee',
  }));
}

/**
 * Workable.
 *
 * The widget payload carries one entry per posting with `locations[]`
 * (city / region / country, plus a `hidden` flag) and a `telecommuting`
 * boolean. Three location shapes have to be distinguished, because the
 * location string is what the location filter runs on:
 *
 *  - An on-site seat: "Munich, Bavaria, Germany".
 *  - A country-scoped remote seat ("Lead Solutions Engineer", seat France).
 *    It must keep the country, or a France-only remote role reads as a plain
 *    "Remote" and slips past the location filter.
 *  - An open remote seat ("… — EMEA Remote", seat authored in Paris). Workable
 *    hides the placeholder location for these, but not always — so the title's
 *    own scope word is the fallback signal.
 */
const WORKABLE_OPEN_SCOPE = /\b(emea|europe|european|global|worldwide|world-wide|anywhere|international|apac)\b/i;

function parseWorkable(json, company) {
  const jobs = json?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.map(j => {
    const locs = Array.isArray(j.locations) ? j.locations : [];
    const visible = locs.filter(l => l && !l.hidden);
    const use = visible.length ? visible : locs;
    const parts = [];
    for (const l of use) {
      for (const k of ['city', 'region', 'country']) {
        const v = l?.[k];
        if (v && !parts.includes(v)) parts.push(v);
      }
    }
    const allHidden = locs.length > 0 && visible.length === 0;
    const openRemote = allHidden || WORKABLE_OPEN_SCOPE.test(j.title || '');
    const location = j.telecommuting && openRemote ? 'Remote' : parts.join(', ');
    return {
      title: j.title || '',
      url: j.shortlink || j.url || '',
      company,
      location,
      date: toISODate(j.published_on || j.created_at),
      provider: 'workable',
    };
  }).filter(j => j.title);
}

/**
 * WelcomeKit (the board behind a Welcome to the Jungle company page).
 *
 * Each posting is a card: an anchor with the job URL, an <h3> with the title
 * and a list item with the office city. The city is the part that matters
 * here — it is what the location filter runs on, and it is the difference
 * between a Toulouse role being rejected and a Berlin role being kept.
 */
function parseWelcomeKit(html, company, provider) {
  if (typeof html !== 'string') return [];
  const base = provider?.url || '';
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*class="[^"]*jobs-list-item-link[^"]*"[^>]*\bhref\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const inner = m[2];
    let abs;
    try { abs = new URL(href, base).href; } catch { continue; }
    abs = abs.split('#')[0];
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);

    const titleMatch = inner.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const officeMatch = inner.match(/jobs-list-item-office[^>]*>([\s\S]*?)<\/li>/i);
    const title = titleMatch ? cleanText(decodeEntities(titleMatch[1])) : '';
    const location = officeMatch ? cleanText(decodeEntities(officeMatch[1].replace(/<[^>]+>/g, ' '))) : '';
    if (!title) continue;
    out.push({
      title,
      url: abs,
      company,
      location,
      date: null,
      provider: 'welcomekit',
    });
  }
  return out;
}

/**
 * DigitalRecruiters.
 *
 * The board lists a `location` that is a bare city ("Hamburg", "La Ciotat"),
 * with no country. That is enough for the location filter: German cities are
 * in the positive list, French ones are not — so a French role is dropped by
 * its own city name. The list payload carries no date, so these postings are
 * undated and the scan treats them as such.
 */
function parseDigitalRecruiters(json, company, provider) {
  const items = Array.isArray(json?.items) ? json.items : [];
  const domain = provider?.domain || provider?.slug || '';
  const locale = provider?.locale || 'en';
  return items.map(j => ({
    title: j.title || '',
    url: j.url ? `https://${domain}/${locale}/annonce/${j.url}` : '',
    company,
    location: j.location || '',
    date: null,
    provider: 'digitalrecruiters',
  })).filter(j => j.title && j.url);
}

function parseSmartRecruiters(json, company) {
  const content = json?.content;
  if (!Array.isArray(content)) return [];
  return content.map(j => ({
    title: j.name || '',
    url: j.ref || (j.id ? `https://jobs.smartrecruiters.com/${company}/${j.id}` : ''),
    company,
    location: j.location?.fullLocation || j.location?.city || '',
    date: toISODate(j.releasedDate),
    provider: 'smartrecruiters',
  }));
}

function parseBambooHR(json, company, provider) {
  const result = json?.result;
  if (!Array.isArray(result)) return [];
  const slug = provider?.slug || company;
  return result.map(j => ({
    title: j.jobOpeningName || '',
    url: j.jobOpeningShareUrl || `https://${slug}.bamboohr.com/careers/${j.id}/detail`,
    company,
    location: j.atsLocation?.city || j.location?.city || '',
    date: toISODate(j.datePosted),
    provider: 'bamboohr',
  }));
}

function parseWorkday(json, company, provider, baseUrl) {
  const postings = json?.jobPostings || json?.jobPostings;
  if (!Array.isArray(postings)) return [];
  const base = provider?.base || baseUrl || '';
  return postings.map(j => ({
    title: j.title || '',
    url: j.externalPath ? `${base}${j.externalPath}` : '',
    company,
    location: j.bulletFields?.find?.(b => b.title === 'Location')?.value || '',
    date: toISODate(j.postedOn),
    provider: 'workday',
  }));
}

function parsePersonioXml(xml, company, provider) {
  if (typeof xml !== 'string') return [];
  const positions = xml.split(/<position>/).slice(1);
  const slug = provider?.slug || company;
  const tld = provider?.tld || 'de';
  const base = `https://${slug}.jobs.personio.${tld}`;
  return positions.map(block => {
    const seg = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return m ? m[1].trim() : '';
    };
    const id = seg('id');
    // Personio names the field <createdAt> (ISO-8601 with an offset).
    // <created> appears on some older boards — accept both.
    const created = seg('createdAt') || seg('created');
    return {
      title: decodeEntities(seg('name')),
      url: id ? `${base}/job/${id}` : '',
      company,
      location: decodeEntities(seg('office')),
      date: toISODate(created),
      provider: 'personio',
    };
  }).filter(j => j.title);
}

// join.com embeds its job list as JSON inside the page.
export function extractJoinItems(html) {
  if (typeof html !== 'string') return [];
  const marker = '"jobs":{"items":';
  const at = html.indexOf(marker);
  if (at === -1) return [];
  const start = html.indexOf('[', at + marker.length);
  if (start === -1) return [];
  // Bracket-match, respecting strings and escapes.
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return [];
  try {
    const arr = JSON.parse(html.slice(start, end + 1));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function parseJoin(html, company, provider) {
  const items = extractJoinItems(html);
  const slug = provider?.slug || company;
  return items.map(j => ({
    title: j.title || '',
    url: j.idParam ? `https://join.com/companies/${slug}/jobs/${j.idParam}` : '',
    company,
    location: j.city?.cityName || j.location || '',
    date: toISODate(j.createdAt),
    provider: 'join',
  })).filter(j => j.title);
}

// Softgarden: anchors shaped ../job/{id}/{Title-slug}
function parseSoftgarden(html, company, provider) {
  if (typeof html !== 'string') return [];
  const base = provider?.url || '';
  const out = [];
  const seen = new Set();
  const re = /href="([^"]*\/job\/\d+\/([^"?#]+)[^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].replace(/&amp;/g, '&');
    let abs;
    try { abs = new URL(href, base).href; } catch { continue; }
    if (seen.has(abs)) continue;
    seen.add(abs);
    const slug = m[2];
    const title = titleFromSlug(slug)
      .replace(/\s*\(?m\/?w\/?d\)?\s*$/i, '')
      .replace(/\s*\d{2,}\s*$/, '')
      .trim();
    out.push({
      title,
      url: abs,
      company,
      location: '',
      date: null,
      provider: 'softgarden',
    });
  }
  return out;
}

// ── public parse entry point (pure) ──────────────────────────────────────
export function parsePayload(type, payload, companyName, baseUrl, provider) {
  try {
    switch (type) {
      case 'greenhouse': return parseGreenhouse(payload, companyName);
      case 'lever': return parseLever(payload, companyName);
      case 'ashby': return parseAshby(payload, companyName);
      case 'recruitee': return parseRecruitee(payload, companyName);
      case 'workable': return parseWorkable(payload, companyName);
      case 'digitalrecruiters': return parseDigitalRecruiters(payload, companyName, provider);
      case 'smartrecruiters': return parseSmartRecruiters(payload, companyName);
      case 'bamboohr': return parseBambooHR(payload, companyName, provider);
      case 'workday': return parseWorkday(payload, companyName, provider, baseUrl);
      case 'personio': return parsePersonioXml(payload, companyName, provider);
      case 'join': return parseJoin(payload, companyName, provider);
      case 'softgarden': return parseSoftgarden(payload, companyName, provider);
      case 'welcomekit': return parseWelcomeKit(payload, companyName, provider);
      default: return [];
    }
  } catch {
    return [];
  }
}

// ── network ─────────────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function get(url, timeoutMs = 20000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': UA, 'Accept': 'application/json, text/xml, text/html, */*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFromProvider(provider, companyName) {
  if (!provider) return [];

  if (provider.type === 'digitalrecruiters') {
    // The public careers-site API is POST-only. `limit` is honoured, `offset`
    // is not — a board larger than one page has to be walked with `page`.
    const perPage = 200;
    const jobs = [];
    const seen = new Set();
    for (let page = 1; page <= 5; page++) {
      const body = JSON.stringify({
        domainName: provider.domain,
        locale: provider.apiLocale || 'en_GB',
        limit: perPage,
        page,
      });
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 20000);
      let json;
      try {
        const res = await fetch(provider.url, {
          method: 'POST', signal: ac.signal,
          headers: { 'User-Agent': UA, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body,
        });
        if (!res.ok) break;
        json = await res.json();
      } catch { break; } finally { clearTimeout(timer); }
      const batch = parseDigitalRecruiters(json, companyName, provider);
      for (const j of batch) {
        if (seen.has(j.url)) continue;
        seen.add(j.url);
        jobs.push(j);
      }
      const total = json?.count ?? batch.length;
      if (!batch.length || jobs.length >= total) break;
    }
    return jobs;
  }

  if (provider.type === 'workday') {
    // Workday needs a POST body and pagination.
    const jobs = [];
    const limit = 20;
    for (let offset = 0; offset < 100; offset += limit) {
      const body = JSON.stringify({ appliedFacets: {}, limit, offset, searchText: '' });
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 20000);
      let json;
      try {
        const res = await fetch(provider.url, {
          method: 'POST', signal: ac.signal,
          headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
          body,
        });
        if (!res.ok) break;
        json = await res.json();
      } catch { break; } finally { clearTimeout(timer); }
      const page = parseWorkday(json, companyName, provider);
      jobs.push(...page);
      const total = json?.total ?? json?.jobPostings?.length ?? 0;
      if (!json?.jobPostings?.length || jobs.length >= Math.min(total, 100)) break;
    }
    return jobs;
  }

  const text = await get(provider.url);

  if (provider.type === 'personio' || provider.type === 'join' || provider.type === 'softgarden' || provider.type === 'welcomekit') {
    return parsePayload(provider.type, text, companyName, provider.url, provider);
  }

  let json;
  try { json = JSON.parse(text); } catch { return []; }
  return parsePayload(provider.type, json, companyName, provider.url, provider);
}
