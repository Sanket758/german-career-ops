#!/usr/bin/env node

/**
 * test-role-filter.mjs — tests for the title / date / location filters.
 *
 * The title filter must select AI/Python/Software/ML developer roles and
 * reject logistics and marketing roles, including the near-misses where a
 * short keyword appears inside another word.
 *
 * Usage:
 *   node scripts/test-role-filter.mjs
 */

import { buildTitleFilter, buildDateWindow, buildLocationFilter } from '../scripts/lib/role-filter.mjs';

let fail = 0;
function check(ok, label, detail) {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  → ' + (detail ?? '')}`);
}

// The filter list as it stands in portals.yml after the 2026-10-20 change.
const POSITIVE = [
  'AI', 'ML', 'Machine Learning', 'Deep Learning', 'LLM', 'GenAI', 'Generative AI',
  'NLP', 'LLMOps', 'MLOps', 'Computer Vision', 'Vision', 'Perception', 'Object Detection',
  'Image', 'Robotics', 'ROS', 'ROS2', 'ROS 2', 'TurtleBot3', 'Autonomous', 'Edge',
  'Robotik', 'SLAM', 'Motion Planning', 'Manipulation', 'Python', 'Data Engineer',
  'Data Scientist', 'Agent', 'Agentic', 'RAG', 'Retrieval', 'KI', 'Künstliche Intelligenz',
  'KI Engineer', 'Software Engineer', 'Software Developer', 'Developer', 'Software',
];
const NEGATIVE = [
  '.NET', 'Java ', 'HTML', 'iOS', 'Android', 'PHP', 'Ruby', 'FPGA', 'ASIC', 'Blockchain', 'Web3',
  'Crypto', 'Salesforce Admin', 'SAP Consultant', 'SAP Basis', 'Oracle EBS', 'Mainframe',
  'COBOL', 'Product Manager', 'DevRel', 'Developer Advocate', 'Marketing', 'Sales',
  'Recruiter', 'Account Executive', 'Account Manager', 'Customer Success',
  'Solutions Consultant', 'Solutions Consulting', 'GTM', 'Talent Pool', 'Business Development',
  'Head of', 'Growth', 'Paid Social', 'SEO', 'Content', 'Partnerships',
  'Business Intelligence', 'General Ledger', 'Accountant', 'Kitchen', 'Shift Lead',
  'Maintenance', 'Supply Chain', 'Logistics', 'Logistik', 'Backend', 'Supervisor',
  'Mechanical Engineer', 'Systems Engineer', 'Safety', 'Frontend',
  'Werkstudent', 'Working Student', 'Praktikum', 'Internship', 'Intern ', 'Thesis',
  'Bachelor', 'Master Thesis', 'Hiwi', 'Student Assistant', 'Student Employee',
  'Part-time', 'Part Time', '20h', '15h', 'Seasonal', 'Apprentice', 'Azubi',
];

const tf = buildTitleFilter({ positive: POSITIVE, negative: NEGATIVE });

const TITLE_CASES = [
  ['Senior ML Engineer (m/f/d)', true, 'true positive'],
  ['AI Engineer — Berlin', true, 'true positive'],
  ['Machine Learning Engineer', true, 'true positive'],
  ['Senior Software Engineer – Retail AI', true, 'new: software'],
  ['Software Developer (Python)', true, 'new: software developer'],
  ['Python Developer', true, 'new: developer + python'],
  ['Entwickler (m/w/d) Python', true, 'German title'],
  ['KI Ingenieur (m/w/d)', true, 'German KI'],
  ['Agentic Platform Engineer', true, 'true positive'],
  ['Robotics Software Engineer', true, 'true positive'],
  ['Backend Developer', false, 'negative Backend wins'],
  ['Frontend Developer', false, 'negative Frontend'],
  ['Logistics Software Developer', false, 'negative Logistics wins'],
  ['Logistik Datenanalyst (m/w/d)', false, 'negative Logistik'],
  ['Supply Chain Data Analyst', false, 'negative Supply Chain'],
  ['Marketing Automation Engineer', false, 'negative Marketing'],
  ['Product Manager AI', false, 'negative Product Manager'],
  ['Werkstudent Machine Learning', false, 'part-time excluded'],
  ['AI Sales Manager', false, 'negative Sales'],
  ['Team Lead, Paid Search (All Genders)', false, 'REGRESSION: "Paid" must not match "ai"'],
  ['Senior Legal Counsel Banking Law', false, 'REGRESSION: "Banking" must not match "ki"'],
  ['Storage Engineer', false, 'REGRESSION: "Storage" must not match "rag"'],
  ['HTML Developer', false, 'REGRESSION: "HTML" must not match "ml"'],
  ['Detail-Oriented Analyst', false, 'REGRESSION: "detail" must not match "ai"'],
];
for (const [title, want, why] of TITLE_CASES) {
  const got = tf(title);
  check(got === want, `title ${want ? 'ACCEPT' : 'REJECT'} "${title}"`, `got ${got} (${why})`);
}

// ── date window ─────────────────────────────────────────────────────────
const NOW = new Date('2026-10-20T12:00:00Z');
const win = buildDateWindow(7, NOW);
const mk = (date) => ({ title: 'x', url: 'u', company: 'c', location: '', date, provider: 'p' });

const inWin = win(mk('2026-10-19'));
check(inWin.keep === true && inWin.reason === 'in_window' && inWin.ageDays === 1,
  'date: 1 day old is in window', JSON.stringify(inWin));
const edge = win(mk('2026-10-13'));
check(edge.keep === true && edge.ageDays === 7, 'date: exactly 7 days old is in window', JSON.stringify(edge));
const old = win(mk('2026-10-12'));
check(old.keep === false && old.reason === 'too_old' && old.ageDays === 8,
  'date: 8 days old is too old', JSON.stringify(old));
const undated = win(mk(null));
check(undated.keep === true && undated.reason === 'undated' && undated.ageDays === null,
  'date: undated is kept and labelled undated', JSON.stringify(undated));
const future = win(mk('2026-10-25'));
check(future.keep === true && future.reason === 'in_window', 'date: a future date is in window', JSON.stringify(future));
const und = win(mk(undefined));
check(und.keep === true && und.reason === 'undated', 'date: undefined is undated', JSON.stringify(und));

// ── location filter ─────────────────────────────────────────────────────
const lf = buildLocationFilter({ positive: ['Berlin', 'Remote', 'Germany', 'Deutschland'], negative: ['US', 'UK', 'United States'] });
check(lf('') === true, 'location: empty passes (review manually)');
check(lf('Berlin') === true, 'location: Berlin passes');
check(lf('Remote, US') === false, 'location: Remote US is rejected');
check(lf('Munich, Germany') === true, 'location: Germany passes');
check(lf('London, UK') === false, 'location: UK is rejected');

// ── the real portals.yml list must behave the same way ─────────────────
// The unit cases above pin the RULE; this pins the CONFIG, so the two
// cannot drift apart.
{
  const { readFileSync } = await import('fs');
  const { dirname, join } = await import('path');
  const { fileURLToPath } = await import('url');
  const yaml = (await import('js-yaml')).default;
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const cfg = yaml.load(readFileSync(join(root, 'portals.yml'), 'utf-8'));
  const live = buildTitleFilter(cfg.title_filter);
  check(live('Senior Software Engineer – Retail AI') === true, 'portals.yml accepts a Software Engineer role');
  check(live('Python Developer') === true, 'portals.yml accepts a Python Developer role');
  check(live('Logistics Software Developer') === false, 'portals.yml rejects a Logistics role');
  check(live('Logistik Software Developer') === false, 'portals.yml rejects a Logistik role');
  check(live('Marketing Automation Engineer') === false, 'portals.yml rejects a Marketing role');
  check(live('HTML Developer') === false, 'portals.yml rejects an HTML role');
  check(live('Backend Developer') === false, 'portals.yml rejects a Backend role');
}

console.log(fail === 0 ? '\nAll cases pass' : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
