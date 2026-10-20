// Text-level parsing for LinkedIn job cards.
//
// Everything in this module is pure: strings in, objects out. The DOM layer
// (lib/selectors.mjs) only has to hand over the card's text lines, so every rule
// here is unit-testable without a browser and without a class selector.
//
// The card layout changes often; the rules below follow LinkedIn's own vocabulary
// (titles, companies, locations, relative times, badges) rather than its CSS.

/** Relative-time vocabulary, English and German. */
const AGE_UNITS = {
  minute: 1 / 60,
  minutes: 1 / 60,
  min: 1 / 60,
  mins: 1 / 60,
  minuten: 1 / 60,
  hour: 1,
  hours: 1,
  hr: 1,
  hrs: 1,
  stunde: 1,
  stunden: 1,
  day: 24,
  days: 24,
  tag: 24,
  tage: 24,
  tagen: 24,
  woche: 24 * 7,
  wochen: 24 * 7,
  week: 24 * 7,
  weeks: 24 * 7,
  monat: 24 * 30,
  monate: 24 * 30,
  monaten: 24 * 30,
  month: 24 * 30,
  months: 24 * 30,
};

/**
 * Relative-time patterns. The English form ends in "ago" and is matched without
 * an end anchor, because LinkedIn renders the age twice inside one paragraph.
 */
const AGE_EN = /^(?:posted\s+)?(a|an|\d+)\s+(minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\s+ago/i;
const AGE_DE = /^vor\s+(\d+)\s+(minuten?|min|stunden?|stunde|tag|tage|tagen|woche|wochen|monat|monate|monaten)\b/i;

/** Countries we can name, mapped to ISO-2. */
const COUNTRIES = {
  germany: 'DE',
  deutschland: 'DE',
  'united states': 'US',
  usa: 'US',
  india: 'IN',
  uk: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  switzerland: 'CH',
  schweiz: 'CH',
  netherlands: 'NL',
  nederland: 'NL',
  luxembourg: 'LU',
  poland: 'PL',
  polen: 'PL',
  belgium: 'BE',
  belgien: 'BE',
  austria: 'AT',
  österreich: 'AT',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  estonia: 'EE',
  estland: 'EE',
  latvia: 'LV',
  lithuania: 'LT',
  greece: 'GR',
  czechia: 'CZ',
  'czech republic': 'CZ',
  croatia: 'HR',
  turkey: 'TR',
  israel: 'IL',
  singapore: 'SG',
  australia: 'AU',
  'new zealand': 'NZ',
  romania: 'RO',
  bulgaria: 'BG',
  slovakia: 'SK',
  slovenia: 'SI',
  serbia: 'RS',
  ukraine: 'UA',
  brazil: 'BR',
  mexico: 'MX',
  china: 'CN',
  japan: 'JP',
  'south korea': 'KR',
  vietnam: 'VN',
  thailand: 'TH',
  malaysia: 'MY',
  indonesia: 'ID',
  philippines: 'PH',
  nigeria: 'NG',
  kenya: 'KE',
  egypt: 'EG',
  morocco: 'MA',
  'south africa': 'ZA',
  argentina: 'AR',
  chile: 'CL',
  colombia: 'CO',
  peru: 'PE',
  canada: 'CA',
  ireland: 'IE',
  portugal: 'PT',
  sweden: 'SE',
  denmark: 'DK',
  norway: 'NO',
  finland: 'FI',
};

/**
 * Work-mode suffix in parentheses, or a bare work-mode word.
 * English and German, because the postings come in both languages.
 */
const WORK_MODE = [
  [/\(\s*remote\s*\)/i, 'remote'],
  [/\(\s*home-?office\s*\)/i, 'remote'],
  [/\(\s*hybrid\s*\)/i, 'hybrid'],
  [/\(\s*on-?site\s*\)/i, 'onsite'],
  [/\(\s*vor ort\s*\)/i, 'onsite'],
  [/\(\s*pr(?:ä|a)senz\s*\)/i, 'onsite'],
  [/^\s*remote\s*$/i, 'remote'],
  [/^\s*home-?office\s*$/i, 'remote'],
  [/^\s*hybrid\s*$/i, 'hybrid'],
  [/^\s*on-?site\s*$/i, 'onsite'],
];

/** Two-letter country codes LinkedIn writes in parentheses ("Remote (UK)"). */
const COUNTRY_CODES = {
  DE: 'DE',
  AT: 'AT',
  CH: 'CH',
  NL: 'NL',
  BE: 'BE',
  LU: 'LU',
  FR: 'FR',
  ES: 'ES',
  IT: 'IT',
  PL: 'PL',
  SE: 'SE',
  DK: 'DK',
  NO: 'NO',
  FI: 'FI',
  IE: 'IE',
  PT: 'PT',
  US: 'US',
  UK: 'GB',
  GB: 'GB',
  IN: 'IN',
  CA: 'CA',
  AU: 'AU',
  SG: 'SG',
  JP: 'JP',
  BR: 'BR',
  MX: 'MX',
  ZA: 'ZA',
  AE: 'AE',
  IL: 'IL',
  TR: 'TR',
  EE: 'EE',
  LV: 'LV',
  LT: 'LT',
};

/** Bare legal forms that belong to the company line above them. */
const LEGAL_FORM =
  /^(gmbh\s*&\s*co\.?\s*kg|mbh\s*&\s*co\.?\s*kg|gmbh|mbh|ag|kg|kgaa|ohg|ug|gbr|eg|se|spa|s\.?a\.?r\.?l|b\.?v\.?|n\.?v\.?|inc\.?|llc|l\.?l\.?c\.?|ltd\.?|limited|plc|pty|pte|kk)\.?$/i;

/**
 * Card meta that is a badge rather than content. Matched by pattern, because the
 * live card renders counts ("55 applicants", "1 connection works here") as well
 * as fixed labels.
 */
const BADGE_PATTERNS = [
  /^easy apply$/i,
  /^be an early applicant$/i,
  /^promoted$/i,
  /^applied$/i,
  /^applied now$/i,
  /^beworben$/i,
  /^hiring now$/i,
  /^new$/i,
  /^featured$/i,
  /^\d+ applicants?$/i,
  /^\d+ connections? works here$/i,
  /^\d+ connections?$/i,
  /^reposted$/i,
];

/** Card meta that is a note rather than a badge. */
const NOTE_LINES = new Set(['viewed', 'actively reviewing applicants']);


const SALARY_RE =
  /(?:\d[\d.,]*\s*k?\s*(?:eur|usd|chf|€|\$|£)|(?:eur|usd|chf|€|\$|£)\s*\d[\d.,]*\s*k?)/i;

/** Status markers LinkedIn appends to a title; not part of the role. */
const TITLE_STATUS_SUFFIXES = [
  /\s*\(\s*verified job\s*\)/i,
  /\s*\(\s*multiple locations\s*\)/i,
  /\s*\(\s*new\s*\)/i,
];

/** Gender tags; kept on the display title, stripped from the normalised one. */
const TITLE_GENDER_SUFFIXES = [
  /\s*\(\s*[a-z]\s*\/\s*[a-z](?:\s*\/\s*[a-z])?\s*\)/i,
  /\s*\(\s*all genders?\s*\)/i,
  /\s*\(\s*diverse genders?\s*\)/i,
];

/** Collapse whitespace and trim. */
export function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a card's text into clean lines.
 * Empty lines and the "·" separators LinkedIn uses between badges are dropped.
 */
export function splitLines(text) {
  return String(text ?? '')
    .split('\n')
    .map((l) => cleanText(l))
    .filter((l) => l.length > 0 && l !== '·' && l !== '•');
}

/**
 * Parse a relative posting time.
 * @returns {{posted_raw: string|null, posted_at: string|null, posted_age_hours: number|null, reposted: boolean}}
 */
export function parsePostedAge(raw, now = Date.now()) {
  const text = cleanText(raw);
  const empty = { posted_raw: text || null, posted_at: null, posted_age_hours: null, reposted: false };
  if (!text) return empty;

  const reposted = /^reposted\b/i.test(text) || /^vor \d+ tagen erneut/i.test(text);
  const nowMs = typeof now === 'number' ? now : Date.parse(now);

  // "Just now" / "Gerade eben"
  if (/^(just now|gerade eben|now)$/i.test(text)) {
    return {
      posted_raw: text,
      posted_at: new Date(nowMs).toISOString(),
      posted_age_hours: 0,
      reposted,
    };
  }

  // "Posted 5 hours ago" | "5 hours ago" | "vor 2 Tagen"
  //
  // The match is NOT anchored at the end of the line: LinkedIn renders the age
  // twice inside one paragraph (the accessible copy and the sighted copy), so
  // the real line reads "Posted 5 hours ago5 hours ago".
  const ageText = reposted ? text.replace(/^reposted\s+/i, '') : text;
  const m = ageText.match(AGE_EN) || ageText.match(AGE_DE);

  if (m) {
    const raw = m[1].toLowerCase();
    const count = /^(a|an|ein|eine)$/.test(raw) ? 1 : Number(raw);
    const unit = m[2].toLowerCase();
    const hours = AGE_UNITS[unit];
    if (hours === undefined || Number.isNaN(count)) {
      return reposted
        ? { posted_raw: text, posted_at: null, posted_age_hours: null, reposted: true }
        : empty;
    }
    const ageHours = count * hours;
    return {
      posted_raw: m[0].trim(),
      posted_at: new Date(nowMs - ageHours * 3600_000).toISOString(),
      posted_age_hours: Math.round(ageHours * 1000) / 1000,
      reposted,
    };
  }

  if (reposted) {
    return { posted_raw: text, posted_at: null, posted_age_hours: null, reposted: true };
  }

  return empty;
}

/**
 * Parse a location line into city / country / work mode.
 * @returns {{location_raw: string, city: string|null, country: string|null, work_mode: string|null}}
 */
export function parseLocation(raw) {
  const text = cleanText(raw);
  const result = { location_raw: text, city: null, country: null, work_mode: null };
  if (!text) return result;

  // Legacy layout: "Munich, Bavaria, Germany · 3 hours ago · 55 applicants".
  const head = text.split(/[·•]|\s+-\s+/)[0].trim();

  let body = head;

  // A country code in parentheses: "Remote (UK)".
  const code = body.match(/\(([A-Z]{2})\)\s*$/);
  if (code && COUNTRY_CODES[code[1]]) {
    result.country = COUNTRY_CODES[code[1]];
    body = body.replace(code[0], '').trim();
  }

  // Work mode: a parenthesised word ("Munich (Hybrid)") or a bare word ("Remote").
  let work = null;
  for (const [re, mode] of WORK_MODE) {
    if (re.test(body)) {
      work = mode;
      body = body.replace(re, '').trim();
      break;
    }
  }
  result.work_mode = work;

  const parts = body
    .split(',')
    .map((p) => cleanText(p))
    .filter(Boolean);

  const countryPart = parts.find((p) => COUNTRIES[p.toLowerCase()]);

  // Not a location at all: no work-mode marker and no country in sight.
  if (!work && !countryPart && !result.country) return result;

  if (countryPart) result.country = COUNTRIES[countryPart.toLowerCase()];

  const nonCountry = parts.filter((p) => !COUNTRIES[p.toLowerCase()]);
  if (nonCountry.length) result.city = nonCountry[0];

  return result;
}

/**
 * Clean a title: drop the "(Verified job)" status marker, and produce a
 * normalised form with the gender tag removed as well.
 *
 * LinkedIn renders the title twice inside one paragraph — once for assistive
 * technology (with a status marker) and once for sighted users. Depending on the
 * layout the two copies end up on one line ("Role (Verified job)Role") or on two.
 * Both are handled here, so the caller does not have to care.
 *
 * @returns {{title: string, title_norm: string}}
 */
export function cleanTitle(raw) {
  const display = cleanText(raw);
  // The de-duplication already removes a trailing status marker; the explicit
  // pass catches a marker that stands on its own.
  const title = cleanText(dedupeRepeatedTitle(display));
  const withoutStatus = TITLE_STATUS_SUFFIXES.reduce((acc, re) => acc.replace(re, ''), title);
  const norm = TITLE_GENDER_SUFFIXES.reduce((acc, re) => acc.replace(re, ''), withoutStatus);
  return { title: cleanText(withoutStatus), title_norm: cleanText(norm) };
}

/**
 * "Role (Verified job)Role" -> "Role"; "Role (Verified job)" -> "Role";
 * "RoleRole" -> "Role" (the same duplication without a status marker).
 */
function dedupeRepeatedTitle(text) {
  const m = text.match(/^(.*?)\s*\((?:verified job|new|multiple locations)\)\s*(.*)$/i);
  if (m) {
    const before = m[1].trim();
    const after = m[2].trim();
    if (!after) return before || text;
    if (after === before) return after;
    if (after.endsWith(before)) return after;
    if (before.endsWith(after)) return after;
    return before || text;
  }

  // No marker: LinkedIn still renders the title twice, so the whole string can be
  // two identical halves.
  if (text.length >= 4 && text.length % 2 === 0) {
    const half = text.length / 2;
    const a = text.slice(0, half);
    const b = text.slice(half);
    if (a === b) return a;
  }

  return text;
}

/**
 * Extract a job id from a componentkey or a /jobs/view/ href.
 * @returns {string|null}
 */
export function parseJobId(source) {
  const text = String(source ?? '');
  if (!text) return null;
  const fromKey = text.match(/job-card-component-ref-(\d{6,})/);
  if (fromKey) return fromKey[1];
  const fromHref = text.match(/\/jobs\/view\/(?:[^/?#]*-)?(\d{6,})/);
  if (fromHref) return fromHref[1];
  return null;
}

/**
 * Canonical job URL: id only, no tracking parameters.
 * @returns {string|null}
 */
export function canonicalJobUrl(source) {
  const id = parseJobId(source);
  return id ? `https://www.linkedin.com/jobs/view/${id}/` : null;
}

function isBadge(line) {
  return BADGE_PATTERNS.some((re) => re.test(line.trim()));
}

function isNote(line) {
  return NOTE_LINES.has(line.toLowerCase());
}

/**
 * Does this line read like a location rather than a company?
 * Only used for the single-line case; with two or more lines the location is
 * taken from its position, because the vocabulary of cities and countries is
 * endless.
 */
function looksLikeLocation(line) {
  const head = line.split(/[·•]|\s+-\s+/)[0].trim();
  for (const [re] of WORK_MODE) {
    if (re.test(head)) return true;
  }
  return head
    .split(',')
    .map((p) => cleanText(p))
    .some((p) => COUNTRIES[p.toLowerCase()]);
}

/**
 * Parse the text lines of a job card.
 *
 * @param {string[]} lines raw innerText lines
 * @returns {{
 *   title: string, title_norm: string, company: string|null, location_raw: string|null,
 *   posted_raw: string|null, badges: string[], notes: string[], salary_raw: string|null,
 *   easy_apply: boolean, already_applied: boolean
 * }}
 */
export function parseCardText(lines) {
  const all = (Array.isArray(lines) ? lines : splitLines(lines))
    .map((l) => cleanText(l))
    .filter((l) => l.length > 0 && l !== '·' && l !== '•');

  const badges = [];
  const notes = [];
  const content = [];
  const meta = [];
  let sawEasyApply = false;

  for (const line of all) {
    const lower = line.toLowerCase();
    if (isBadge(line)) {
      // "Easy Apply" is its own field on the record, not a badge.
      if (lower === 'easy apply') sawEasyApply = true;
      else if (!badges.includes(line)) badges.push(line);
      continue;
    }
    if (isNote(line)) {
      if (!notes.includes(line)) notes.push(line);
      continue;
    }
    // A promoted card can lead with a teaser line instead of the title:
    //   "Solutions Architect GenAI | €250K OTE | Fortune 100"
    // The title is the first segment; the rest is a label, not content.
    if (!content.length && line.includes(' | ') && /[€$£]|EUR|CHF|USD/i.test(line)) {
      const [head, ...tail] = line.split('|').map((s) => s.trim()).filter(Boolean);
      if (head) {
        content.push(head);
        for (const label of tail) if (!notes.includes(label)) notes.push(label);
        continue;
      }
    }
    if (parsePostedAge(line, 0).posted_age_hours !== null || SALARY_RE.test(line)) {
      meta.push(line);
      continue;
    }
    content.push(line);
  }

  const result = {
    title: '',
    title_norm: '',
    company: null,
    location_raw: null,
    city: null,
    country: null,
    work_mode: null,
    posted_raw: null,
    badges,
    notes,
    salary_raw: null,
    easy_apply: sawEasyApply,
    already_applied: badges.some((b) => /^(applied|applied now|beworben)$/i.test(b)),
  };

  if (!content.length) return result;

  // Title: first content line. LinkedIn repeats it when the job is "verified",
  // once with the marker and once in the accessible copy.
  const { title, title_norm } = cleanTitle(content[0]);
  result.title = title;
  result.title_norm = title_norm;

  let rest = content.slice(1);
  if (rest.length && cleanTitle(rest[0]).title_norm === title_norm) rest = rest.slice(1);

  // Layout: title, company (one or more lines), location, then meta.
  //
  // The location is taken from its POSITION, not from a vocabulary: LinkedIn
  // names cities and countries we have never heard of, and a vocabulary-driven
  // guess silently folds the location into the company.
  let companyLines = rest;
  let locationLine = null;

  if (rest.length >= 2) {
    const last = rest[rest.length - 1];
    if (LEGAL_FORM.test(last)) {
      // A bare legal form is the tail of a company, not a location.
      companyLines = rest;
    } else {
      companyLines = rest.slice(0, -1);
      locationLine = last;
    }
  } else if (rest.length === 1 && looksLikeLocation(rest[0])) {
    // One line that reads like a location: the card has no company line.
    companyLines = [];
    locationLine = rest[0];
  }

  result.location_raw = locationLine;
  if (locationLine) {
    const location = parseLocation(locationLine);
    result.city = location.city;
    result.country = location.country;
    result.work_mode = location.work_mode;
  }

  // Company: join the lines above the location, folding a bare legal form back
  // into the line it belongs to ("AlexA Pflege" + "GmbH").
  if (companyLines.length) {
    const merged = [...companyLines];
    for (let i = merged.length - 1; i > 0; i--) {
      if (LEGAL_FORM.test(merged[i])) {
        merged[i - 1] = `${merged[i - 1]} ${merged[i]}`;
        merged.splice(i, 1);
      }
    }
    // A company that is nothing but a legal form means the name line is
    // missing: report no company rather than a partial "GmbH".
    if (!(merged.length === 1 && LEGAL_FORM.test(merged[0]))) {
      result.company = cleanText(merged.join(' '));
    }
  }

  // Meta: posted time, salary. The raw value is the *matched* age, not the whole
  // line: LinkedIn renders the age twice inside one paragraph.
  const postedPrefixed = meta.find((l) => /^posted\s+/i.test(l));
  const postedAny = meta.find(
    (l) => parsePostedAge(l, 0).posted_age_hours !== null || /^reposted\b/i.test(l)
  );
  const postedLine = postedPrefixed || postedAny || null;
  result.posted_raw = postedLine ? parsePostedAge(postedLine, 0).posted_raw : null;

  const salary = meta.find((l) => SALARY_RE.test(l));
  if (salary) result.salary_raw = salary;

  return result;
}
