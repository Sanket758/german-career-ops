#!/usr/bin/env node

/**
 * test-scan-orchestration.mjs — tests for the scan decision logic.
 *
 * planScan() is the pure part of the scanner: given the roles found on a
 * career page and the filters, it decides what is kept and why the rest
 * was dropped. It must be importable without running a scan.
 *
 * Usage:
 *   node scripts/test-scan-orchestration.mjs
 */

import { planScan } from '../scripts/lib/scan-plan.mjs';

let fail = 0;
function check(ok, label, detail) {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  → ' + (detail ?? '')}`);
}

const NOW = new Date('2026-10-20T12:00:00Z');
const titleFilter = (t) => {
  const lower = t.toLowerCase();
  const has = (k) => (k.length <= 3 ? new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`).test(lower) : lower.includes(k));
  return (['ai', 'ml', 'python', 'software engineer', 'developer'].some(has))
    && !['marketing', 'logistics', 'supply chain', 'backend'].some(has);
};
const dateWindow = (days) => (job) => {
  if (!job.date) return { keep: true, reason: 'undated', ageDays: null };
  const ageDays = Math.floor((NOW.getTime() - Date.parse(job.date)) / 86400000);
  if (ageDays > days) return { keep: false, reason: 'too_old', ageDays };
  return { keep: true, reason: 'in_window', ageDays };
};
const locationFilter = (loc) => !loc || !/\b(US|UK)\b/.test(loc);
const titleLocationFilter = (t) => !/\b(United States|India|Spain|France)\b/i.test(t);

// Each case gets its OWN filters and seen-sets. planScan mutates the seen
// sets as it accepts rows, so a shared set would leak state between cases.
const mkBase = () => ({
  titleFilter,
  dateWindow: dateWindow(7),
  locationFilter,
  titleLocationFilter,
  seenUrls: new Set(),
  seenCompanyRoles: new Set(),
});

const job = (over = {}) => ({
  title: 'Senior ML Engineer', url: 'https://x/jobs/1', company: 'X',
  location: 'Berlin', date: '2026-10-19', provider: 'greenhouse', ...over,
});

// 1. in-window, on-target → accepted
{
  const r = planScan({ ...mkBase(), jobs: [job()] });
  check(r.accepted.length === 1, 'in-window on-target role is accepted', `got ${r.accepted.length}`);
  check(r.rejected.length === 0, 'nothing rejected', `got ${r.rejected.length}`);
}

// 2. too old
{
  const r = planScan({ ...mkBase(), jobs: [job({ date: '2026-09-01' })] });
  check(r.accepted.length === 0, 'role outside the window is rejected');
  check(r.rejected[0]?.reason === 'too_old', 'rejection reason is too_old', r.rejected[0]?.reason);
}

// 3. undated is kept
{
  const r = planScan({ ...mkBase(), jobs: [job({ date: null })] });
  check(r.accepted.length === 1, 'undated role is accepted');
  check(r.accepted[0]?.dateReason === 'undated', 'accepted role records dateReason=undated', r.accepted[0]?.dateReason);
}

// 4. title negative
{
  const r = planScan({ ...mkBase(), jobs: [job({ title: 'Logistics Software Developer' })] });
  check(r.accepted.length === 0, 'logistics role is rejected');
  check(r.rejected[0]?.reason === 'title', 'rejection reason is title', r.rejected[0]?.reason);
}

// 5. marketing role
{
  const r = planScan({ ...mkBase(), jobs: [job({ title: 'Marketing Automation Engineer' })] });
  check(r.accepted.length === 0, 'marketing role is rejected');
  check(r.rejected[0]?.reason === 'title', 'rejection reason is title', r.rejected[0]?.reason);
}

// 6. location rejected
{
  const r = planScan({ ...mkBase(), jobs: [job({ location: 'Remote, US' })] });
  check(r.accepted.length === 0, 'role outside the location filter is rejected');
  check(r.rejected[0]?.reason === 'location', 'rejection reason is location', r.rejected[0]?.reason);
}

// 7. already seen
{
  const r = planScan({ ...mkBase(), jobs: [job()], seenUrls: new Set(['https://x/jobs/1']) });
  check(r.accepted.length === 0, 'already-seen URL is rejected');
  check(r.rejected[0]?.reason === 'dup', 'rejection reason is dup', r.rejected[0]?.reason);
}

// 7b. a US role whose board leaves the location field empty
{
  const r = planScan({ ...mkBase(), jobs: [job({ location: '', title: 'Senior ML Engineer San Francisco, United States' })] });
  check(r.accepted.length === 0, 'US role with an empty location field is rejected');
  check(r.rejected[0]?.reason === 'location', 'rejection reason is location', r.rejected[0]?.reason);
}

// 8. same company+role already evaluated
{
  const r = planScan({ ...mkBase(), jobs: [job({ url: 'https://x/jobs/99' })], seenCompanyRoles: new Set(['x::senior ml engineer']) });
  check(r.accepted.length === 0, 'already-evaluated company+role is rejected');
  check(r.rejected[0]?.reason === 'dup', 'rejection reason is dup', r.rejected[0]?.reason);
}

// 9. duplicate URL inside the same batch → one accepted
{
  const r = planScan({ ...mkBase(), jobs: [job(), job()] });
  check(r.accepted.length === 1, 'duplicate URL inside one batch collapses to one', `got ${r.accepted.length}`);
  check(r.rejected.length === 1, 'the second copy is rejected', `got ${r.rejected.length}`);
}

// 10. ordering: dated newest-first, undated last
{
  const r = planScan({
    ...mkBase(),
    jobs: [
      job({ url: 'u1', title: 'Old ML Engineer', date: '2026-10-14' }),
      job({ url: 'u2', title: 'Undated ML Engineer', date: null }),
      job({ url: 'u3', title: 'New ML Engineer', date: '2026-10-19' }),
      job({ url: 'u4', title: 'Mid ML Engineer', date: '2026-10-17' }),
    ],
  });
  const titles = r.accepted.map(j => j.title);
  check(JSON.stringify(titles) === JSON.stringify(['New ML Engineer', 'Mid ML Engineer', 'Old ML Engineer', 'Undated ML Engineer']),
    'accepted roles are ordered newest-first with undated last', JSON.stringify(titles));
}

// 11. accepted role carries its date reason
{
  const r = planScan({ ...mkBase(), jobs: [job()] });
  check(r.accepted[0]?.dateReason === 'in_window', 'in-window role records dateReason=in_window', r.accepted[0]?.dateReason);
}

// 12. an empty batch is fine
{
  const r = planScan({ ...mkBase(), jobs: [] });
  check(r.accepted.length === 0 && r.rejected.length === 0, 'empty batch yields nothing');
}

// 13. a job with no title is rejected
{
  const r = planScan({ ...mkBase(), jobs: [job({ title: '' })] });
  check(r.accepted.length === 0, 'role with an empty title is rejected');
  check(r.rejected[0]?.reason === 'title', 'rejection reason is title', r.rejected[0]?.reason);
}

console.log(fail === 0 ? '\nAll cases pass' : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
