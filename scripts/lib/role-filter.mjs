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
    const lower = String(title || '').toLowerCase();
    const hasPositive = positive.length === 0 || positive.some(k => has(k, lower));
    const hasNegative = negative.some(k => has(k, lower));
    return hasPositive && !hasNegative;
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

  return (location) => {
    if (!location) return true;

    const lower = String(location).toLowerCase();

    // Check negatives FIRST. If it says "Remote, US", kill it based on "US"
    const hasNegative = negative.some(k => {
      // Use word boundaries for short acronyms like US, UK so we don't match 'dusseldorf'
      if (k.length <= 3) {
        return new RegExp(`\\b${k}\\b`).test(lower);
      }
      return lower.includes(k);
    });

    if (hasNegative) return false;

    // Then check positives.
    if (positive.length === 0) return true;
    return positive.some(k => lower.includes(k));
  };
}
