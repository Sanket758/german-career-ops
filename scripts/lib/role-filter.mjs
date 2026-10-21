/**
 * role-filter.mjs — title, posting-date and location filters.
 *
 * `buildTitleFilter` is the single implementation of the title rule; it used
 * to live inside scan.mjs and is imported from there now.
 *
 * The title rule is "AI/Python/Software/ML developer roles, and nothing
 * logistics or marketing". The two lists live in portals.yml
 * (title_filter.positive / title_filter.negative).
 */

export function buildTitleFilter(titleFilter) {
  const positive = (titleFilter?.positive || []).map(k => k.toLowerCase());
  const negative = (titleFilter?.negative || []).map(k => k.toLowerCase());
  // Optional second signal: the title must ALSO name a hands-on role.
  // Without it, "Chief of Staff - Strategy & AI Enablement" matches on
  // "AI" and "Guest Experience Agent" matches on "Agent". With it, a title
  // has to be a developer / engineer / scientist posting.
  const role = (titleFilter?.role || []).map(k => k.toLowerCase());

  // Short alphanumeric keywords (AI, ML, KI, ROS, RAG, SEO...) must match as whole
  // words only. Plain substring matching turns "Paid Search" into an AI role ("pAId"),
  // "Banking Law" into a KI role, "Storage" into a RAG role and "HTML" into an ML role.
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = (k) =>
    k.length <= 3 && /^[a-z0-9]+$/.test(k)
      ? new RegExp(`(^|[^a-z0-9])${escapeRe(k)}([^a-z0-9]|$)`)
      : null;

  const has = (keyword, lower) => {
    const rx = matcher(keyword);
    return rx ? rx.test(lower) : lower.includes(keyword);
  };

  return (title) => {
    const lower = String(title || '').toLowerCase().trim();
    if (!lower) return false;
    // A job title is at least two words. Single-word entries on a career
    // page are category headings ("Developer", "Python"), not postings.
    if (lower.split(/\s+/).filter(Boolean).length < 2) return false;
    const hasPositive = positive.length === 0 || positive.some(k => has(k, lower));
    const hasRole = role.length === 0 || role.some(k => has(k, lower));
    const hasNegative = negative.some(k => has(k, lower));
    return hasPositive && hasRole && !hasNegative;
  };
}

/**
 * Posting-date window.
 *
 * A job dated inside the window is kept. A job with no date is KEPT and
 * labelled 'undated' — most plain career pages carry no date, and dropping
 * them would lose the majority of the listings. A job older than the window
 * is dropped.
 *
 * @returns {(job) => { keep: boolean, reason: 'in_window'|'undated'|'too_old', ageDays: number|null }}
 */
export function buildDateWindow(days, now = new Date()) {
  const windowMs = days * 86400000;
  return (job) => {
    const raw = job?.date;
    if (!raw) return { keep: true, reason: 'undated', ageDays: null };
    const t = Date.parse(String(raw).length <= 10 ? `${raw}T00:00:00Z` : String(raw));
    if (Number.isNaN(t)) return { keep: true, reason: 'undated', ageDays: null };
    const ageDays = Math.floor((now.getTime() - t) / 86400000);
    if (ageDays < 0) return { keep: true, reason: 'in_window', ageDays };
    if (ageDays > days) return { keep: false, reason: 'too_old', ageDays };
    return { keep: true, reason: 'in_window', ageDays };
  };
}

/**
 * Location filter. Negatives are checked first (so "Remote, US" dies on
 * "US"), then positives. An empty location passes — many boards omit it and
 * the role is still worth a human look.
 */
export function buildLocationFilter(locationFilter) {
  const positive = (locationFilter?.positive || []).map(k => k.toLowerCase());
  const negative = (locationFilter?.negative || []).map(k => k.toLowerCase());

  const hit = (k, lower) => {
    // Use word boundaries for short acronyms like US, UK so we don't match 'dusseldorf'
    if (k.length <= 3) {
      return new RegExp(`\\b${k}\\b`).test(lower);
    }
    return lower.includes(k);
  };

  const filter = (location) => {
    if (!location) return true;

    const lower = String(location).toLowerCase();

    // Check negatives FIRST. If it says "Remote, US", kill it based on "US"
    if (negative.some(k => hit(k, lower))) return false;

    // Then check positives.
    if (positive.length === 0) return true;
    return positive.some(k => lower.includes(k));
  };

  filter.negatives = negative;
  filter.hit = hit;
  return filter;
}

/**
 * Location check for the TITLE.
 *
 * Some boards put the location in the job title and leave the location
 * field empty — Retool posts "Data Scientist San Francisco, United States"
 * with no location field at all, and Wolt posts "Senior Software Engineer
 * Engineering Full-time Helsinki, Finland". Without this, a US role passes
 * the location filter and lands in a Germany-only digest.
 *
 * A title that names BOTH a disallowed place and an allowed one is kept:
 * Wolt's "Full-time Tallinn, Estonia Helsinki, Finland Berlin, Germany
 * Stockholm, Sweden" is a role that is open in Berlin.
 */
export function buildTitleLocationFilter(locationFilter) {
  const negative = (locationFilter?.negative || []).map(k => k.toLowerCase());
  // "Remote" and "Regional" are not places — a title saying "Remote" must
  // not rescue one that also says "APAC".
  const allowedPlaces = (locationFilter?.positive || [])
    .map(k => k.toLowerCase())
    .filter(k => k !== 'remote' && k !== 'regional');

  const hit = (k, lower) => {
    if (k.length <= 3) return new RegExp(`\\b${k}\\b`).test(lower);
    return lower.includes(k);
  };

  return (title) => {
    if (!title) return true;
    const lower = String(title).toLowerCase();
    const hasBadPlace = negative.some(k => hit(k, lower));
    if (!hasBadPlace) return true;
    // A bad place alongside an allowed one: the role is open there too.
    return allowedPlaces.some(k => lower.includes(k));
  };
}
