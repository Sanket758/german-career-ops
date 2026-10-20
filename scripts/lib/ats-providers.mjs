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
      case 'smartrecruiters': return parseSmartRecruiters(payload, companyName);
      case 'bamboohr': return parseBambooHR(payload, companyName, provider);
      case 'workday': return parseWorkday(payload, companyName, provider, baseUrl);
      case 'personio': return parsePersonioXml(payload, companyName, provider);
      case 'join': return parseJoin(payload, companyName, provider);
      case 'softgarden': return parseSoftgarden(payload, companyName, provider);
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
  const text = await get(provider.url);

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

  if (provider.type === 'personio' || provider.type === 'join' || provider.type === 'softgarden') {
    return parsePayload(provider.type, text, companyName, provider.url, provider);
  }

  let json;
  try { json = JSON.parse(text); } catch { return []; }
  return parsePayload(provider.type, json, companyName, provider.url, provider);
}
