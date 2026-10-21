/**
 * scan-plan.mjs — the pure decision step of the scanner.
 *
 * Given the roles found on one career page and the configured filters,
 * decide what is kept and record why everything else was dropped. No I/O,
 * no side effects: the same input always gives the same output.
 *
 * Rejection reasons: 'title' | 'location' | 'too_old' | 'dup'
 */

function titleKey(company, title) {
  return `${String(company || '').trim().toLowerCase()}::${String(title || '').trim().toLowerCase()}`;
}

/**
 * @param {{
 *   jobs: Array,
 *   titleFilter: (t: string) => boolean,
 *   dateWindow: (job: object) => { keep: boolean, reason: string, ageDays: number|null },
 *   locationFilter: (loc: string) => boolean,
 *   seenUrls: Set<string>,
 *   seenCompanyRoles: Set<string>,
 * }} input
 * @returns {{ accepted: Array, rejected: Array<{job, reason}> }}
 */
export function planScan(input) {
  const {
    jobs = [],
    titleFilter,
    dateWindow,
    locationFilter,
    titleLocationFilter,
    seenUrls = new Set(),
    seenCompanyRoles = new Set(),
  } = input;

  const accepted = [];
  const rejected = [];

  for (const job of jobs) {
    if (!job || !job.title || !String(job.title).trim()) {
      rejected.push({ job, reason: 'title' });
      continue;
    }

    if (!titleFilter(job.title)) {
      rejected.push({ job, reason: 'title' });
      continue;
    }

    if (!locationFilter(job.location)) {
      rejected.push({ job, reason: 'location' });
      continue;
    }

    // Boards that put the location in the title and leave the location
    // field empty would otherwise smuggle a US role past the filter.
    if (titleLocationFilter && !titleLocationFilter(job.title)) {
      rejected.push({ job, reason: 'location' });
      continue;
    }

    const win = dateWindow(job);
    if (!win.keep) {
      rejected.push({ job, reason: win.reason === 'too_old' ? 'too_old' : 'title' });
      continue;
    }

    const url = String(job.url || '');
    const key = titleKey(job.company, job.title);
    if ((url && seenUrls.has(url)) || seenCompanyRoles.has(key)) {
      rejected.push({ job, reason: 'dup' });
      continue;
    }

    // Claim it now so the same URL twice in one batch yields one row.
    if (url) seenUrls.add(url);
    seenCompanyRoles.add(key);

    accepted.push({ ...job, dateReason: win.reason, ageDays: win.ageDays });
  }

  // Newest first; undated roles last.
  accepted.sort((a, b) => {
    const ad = a.date || '';
    const bd = b.date || '';
    if (ad && bd) return bd.localeCompare(ad);
    if (ad) return -1;
    if (bd) return 1;
    return String(a.title).localeCompare(String(b.title));
  });

  return { accepted, rejected };
}
