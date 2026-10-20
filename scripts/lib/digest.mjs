/**
 * digest.mjs — the per-company daily report.
 *
 * One markdown file per run, grouped by company, plus a machine-readable
 * TSV. The appendix lists EVERY scanned company with its status, so the
 * report shows coverage and not just the hits.
 */

const STATUS_LABEL = {
  ok: 'roles found',
  no_roles: 'no matching roles',
  error: 'error',
  skipped: 'skipped',
};

function esc(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

function sortJobs(jobs) {
  return [...jobs].sort((a, b) => {
    const ad = a.date || '';
    const bd = b.date || '';
    if (ad && bd) return bd.localeCompare(ad);
    if (ad) return -1;      // dated before undated
    if (bd) return 1;
    return String(a.title).localeCompare(String(b.title));
  });
}

/**
 * @param {{date:string, companies:Array<{name,careers_url,status,error?,newCount}>,
 *          jobs:Array, windowDays:number}} input
 * @returns {string} markdown
 */
export function buildDigest(input) {
  const { date, companies = [], jobs = [], windowDays = 7 } = input;
  const L = [];

  const byCompany = new Map();
  for (const j of jobs) {
    const k = j.company || 'Unknown';
    if (!byCompany.has(k)) byCompany.set(k, []);
    byCompany.get(k).push(j);
  }

  const errored = companies.filter(c => c.status === 'error');

  L.push(`# Daily Scan — ${date}`);
  L.push('');
  L.push(`**Companies scanned:** ${companies.length} · **New roles:** ${jobs.length} · **Errors:** ${errored.length}  `);
  L.push(`**Window:** 7-day window. Roles with no posting date are kept and marked \`undated\`.`);
  L.push('');

  if (jobs.length === 0) {
    L.push('No new matching roles today.');
    L.push('');
  }

  for (const [company, list] of byCompany) {
    const meta = companies.find(c => c.name === company);
    const careers = meta?.careers_url
      ? `[careers page](${meta.careers_url})`
      : '_no careers page_';
    L.push(`## ${company} — ${careers}`);
    L.push('');
    L.push('| Role | Location | Posted | Link |');
    L.push('|---|---|---|---|');
    for (const j of sortJobs(list)) {
      L.push(`| ${esc(j.title)} | ${esc(j.location) || '—'} | ${j.date || 'undated'} | [apply](${j.url}) |`);
    }
    L.push('');
  }

  L.push('## All scanned companies');
  L.push('');
  L.push('| Company | Careers page | New roles | Status |');
  L.push('|---|---|---|---|');
  for (const c of companies) {
    const link = c.careers_url ? `[careers](${c.careers_url})` : '—';
    const status = STATUS_LABEL[c.status] || c.status;
    const note = c.status === 'error' && c.error ? ` — ${esc(c.error)}` : '';
    L.push(`| ${esc(c.name)} | ${link} | ${c.newCount ?? 0} | ${esc(status)}${note} |`);
  }
  L.push('');

  if (errored.length) {
    L.push('## Errors');
    L.push('');
    for (const c of errored) {
      L.push(`- **${esc(c.name)}** — ${esc(c.error) || 'unknown error'}`);
    }
    L.push('');
  }

  return L.join('\n');
}

/**
 * @param {{date:string, jobs:Array}} input
 * @returns {string} TSV
 */
export function buildDigestTsv(input) {
  const { date, jobs = [] } = input;
  const rows = ['date\tcompany\ttitle\tlocation\tposted\turl\tprovider'];
  const sorted = sortJobs(jobs).map(j => ({
    ...j,
    posted: j.date || 'undated',
  }));
  // Sort by company, then title, but keep dated rows before undated ones.
  sorted.sort((a, b) => {
    const c = String(a.company).localeCompare(String(b.company));
    if (c !== 0) return c;
    const ad = a.date ? 0 : 1, bd = b.date ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return String(a.title).localeCompare(String(b.title));
  });
  for (const j of sorted) {
    rows.push([
      date,
      String(j.company ?? '').replace(/\t/g, ' '),
      String(j.title ?? '').replace(/\t/g, ' '),
      String(j.location ?? '').replace(/\t/g, ' '),
      j.posted,
      String(j.url ?? ''),
      String(j.provider ?? ''),
    ].join('\t'));
  }
  return rows.join('\n') + '\n';
}
