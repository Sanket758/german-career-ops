#!/usr/bin/env node

/**
 * test-digest.mjs — tests for the per-company daily digest writer.
 *
 * Usage:
 *   node scripts/test-digest.mjs
 */

import { buildDigest, buildDigestTsv } from '../scripts/lib/digest.mjs';

let fail = 0;
function check(ok, label, detail) {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  → ' + (detail ?? '')}`);
}

const JOBS = [
  {
    title: 'Senior ML Engineer (m/f/d)', url: 'https://boards.greenhouse.io/hive/jobs/1',
    company: 'HIVE', location: 'Berlin', date: '2026-10-19', provider: 'greenhouse',
  },
  {
    title: 'Software Developer Python', url: 'https://hive/jobs/2',
    company: 'HIVE', location: 'Berlin', date: '2026-10-15', provider: 'html',
  },
  {
    title: 'Data Engineer', url: 'https://acme/jobs/3',
    company: 'ACME', location: 'Remote', date: null, provider: 'html',
  },
];

const COMPANIES = [
  { name: 'HIVE', careers_url: 'https://www.hive.app/careers', status: 'ok', newCount: 2 },
  { name: 'ACME', careers_url: 'https://acme.com/careers', status: 'ok', newCount: 1 },
  { name: 'BrokenBoard', careers_url: 'https://broken.example/careers', status: 'error', error: 'HTTP 403', newCount: 0 },
  { name: 'EmptyBoard', careers_url: 'https://empty.example/careers', status: 'no_roles', newCount: 0 },
];

const md = buildDigest({ date: '2026-10-20', companies: COMPANIES, jobs: JOBS, windowDays: 7 });

check(md.includes('# Daily Scan — 2026-10-20'), 'digest has the date in the title', md.split('\n')[0]);
check(/\*\*Companies scanned:\*\*\s*4/.test(md), 'digest reports the company count', md.split('\n')[2]);
check(/\*\*New roles:\*\*\s*3/.test(md), 'digest reports the new role count', md.split('\n')[2]);
check(md.includes('7-day window'), 'digest states the window');
check(md.includes('## HIVE'), 'digest has a section for a company with new roles');
check(md.includes('Senior ML Engineer (m/f/d)'), 'digest lists the role title');
check(md.includes('2026-10-19'), 'digest shows the posted date');
check(md.includes('undated'), 'digest labels an undated role');
check(md.includes('https://boards.greenhouse.io/hive/jobs/1'), 'digest links the role');
check(md.includes('https://www.hive.app/careers'), 'digest links the career page');
check(md.includes('## All scanned companies'), 'digest has the all-companies appendix');
check(md.includes('BrokenBoard') && md.includes('EmptyBoard'), 'appendix lists zero-result and error companies');
check(md.includes('HTTP 403'), 'appendix shows the error message');
check(md.includes('## Errors'), 'digest has an errors section');

// dated roles before undated, newest first
const idxML = md.indexOf('Senior ML Engineer');
const idxDev = md.indexOf('Software Developer Python');
check(idxML > 0 && idxDev > idxML, 'newer role is listed before the older one', `${idxML} vs ${idxDev}`);

// TSV
const tsv = buildDigestTsv({ date: '2026-10-20', jobs: JOBS });
const lines = tsv.trim().split('\n');
check(lines[0] === 'date\tcompany\ttitle\tlocation\tposted\turl\tprovider', 'tsv header', lines[0]);
check(lines.length === 4, 'tsv has one row per job', `got ${lines.length}`);
const dated = lines.slice(1).filter(l => l.split('\t')[4] !== 'undated');
const undated = lines.slice(1).filter(l => l.split('\t')[4] === 'undated');
check(dated.length === 2 && undated.length === 1, 'tsv splits dated and undated', `dated ${dated.length} undated ${undated.length}`);
check(lines[1].includes('ACME') && lines[2].includes('HIVE'), 'tsv sorts by company, then title', lines[1]);
check(lines[2].includes('Senior ML Engineer'), 'tsv keeps the newest role first within a company', lines[2]);
check(tsv.includes('undated'), 'tsv marks undated rows');

// no jobs at all
const empty = buildDigest({ date: '2026-10-20', companies: [COMPANIES[2]], jobs: [], windowDays: 7 });
check(empty.includes('## All scanned companies'), 'empty digest still has the appendix');
check(!empty.includes('## HIVE'), 'empty digest has no company sections');

// a company with an error and no careers_url
const err = buildDigest({
  date: '2026-10-20',
  companies: [{ name: 'NoUrl', careers_url: '', status: 'error', error: 'no careers_url', newCount: 0 }],
  jobs: [], windowDays: 7,
});
check(err.includes('NoUrl'), 'company without a career page still appears in the appendix');

console.log(fail === 0 ? '\nAll cases pass' : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
