import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePostedAge,
  parseLocation,
  parseCardText,
  parseJobId,
  canonicalJobUrl,
  cleanTitle,
  splitLines,
} from '../lib/parse.mjs';

const NOW = Date.parse('2026-10-20T12:00:00.000Z');

// ── posted age ────────────────────────────────────────────────────────────────

test('parsePostedAge reads "29 minutes ago" as a fraction of an hour', () => {
  const r = parsePostedAge('29 minutes ago', NOW);
  assert.equal(r.posted_age_hours, 0.483);
  assert.equal(r.posted_at, '2026-10-20T11:31:00.000Z');
  assert.equal(r.reposted, false);
});

test('parsePostedAge reads "3 hours ago"', () => {
  const r = parsePostedAge('3 hours ago', NOW);
  assert.equal(r.posted_age_hours, 3);
  assert.equal(r.posted_at, '2026-10-20T09:00:00.000Z');
});

test('parsePostedAge reads "17 hours ago"', () => {
  assert.equal(parsePostedAge('17 hours ago', NOW).posted_age_hours, 17);
});

test('parsePostedAge reads the "Posted " prefixed variant and keeps it raw', () => {
  const r = parsePostedAge('Posted 5 hours ago', NOW);
  assert.equal(r.posted_age_hours, 5);
  assert.equal(r.posted_raw, 'Posted 5 hours ago');
});

test('parsePostedAge reads "Just now" as zero', () => {
  const r = parsePostedAge('Just now', NOW);
  assert.equal(r.posted_age_hours, 0);
  assert.equal(r.posted_at, '2026-10-20T12:00:00.000Z');
});

test('parsePostedAge reads the German "vor 2 Tagen" as 48 hours', () => {
  const r = parsePostedAge('vor 2 Tagen', NOW);
  assert.equal(r.posted_age_hours, 48);
  assert.equal(r.posted_at, '2026-10-18T12:00:00.000Z');
});

test('parsePostedAge flags "Reposted" without inventing an age', () => {
  const r = parsePostedAge('Reposted', NOW);
  assert.equal(r.reposted, true);
  assert.equal(r.posted_age_hours, null);
  assert.equal(r.posted_at, null);
});

test('parsePostedAge returns nulls for text that is not an age', () => {
  const r = parsePostedAge('Actively reviewing applicants', NOW);
  assert.equal(r.posted_age_hours, null);
  assert.equal(r.posted_at, null);
  assert.equal(r.reposted, false);
});

test('parsePostedAge reads "1 day ago" as 24 hours', () => {
  assert.equal(parsePostedAge('1 day ago', NOW).posted_age_hours, 24);
});

// ── location ─────────────────────────────────────────────────────────────────

test('parseLocation reads "Berlin (Hybrid)"', () => {
  const r = parseLocation('Berlin (Hybrid)');
  assert.equal(r.city, 'Berlin');
  assert.equal(r.work_mode, 'hybrid');
  assert.equal(r.country, null);
});

test('parseLocation reads "Woltersdorf (On-site)"', () => {
  const r = parseLocation('Woltersdorf (On-site)');
  assert.equal(r.city, 'Woltersdorf');
  assert.equal(r.work_mode, 'onsite');
});

test('parseLocation reads "Berlin, Germany (On-site)"', () => {
  const r = parseLocation('Berlin, Germany (On-site)');
  assert.equal(r.city, 'Berlin');
  assert.equal(r.country, 'DE');
  assert.equal(r.work_mode, 'onsite');
});

test('parseLocation reads a bare "Remote"', () => {
  const r = parseLocation('Remote');
  assert.equal(r.work_mode, 'remote');
  assert.equal(r.city, null);
});

test('parseLocation reads "Germany (Remote)" as country-level remote', () => {
  const r = parseLocation('Germany (Remote)');
  assert.equal(r.country, 'DE');
  assert.equal(r.city, null);
  assert.equal(r.work_mode, 'remote');
});

test('parseLocation splits the legacy "city, country · age · applicants" line', () => {
  const r = parseLocation('Munich, Bavaria, Germany · 3 hours ago · 55 applicants');
  assert.equal(r.city, 'Munich');
  assert.equal(r.country, 'DE');
  assert.equal(r.work_mode, null);
});

test('parseLocation recognises a non-German country', () => {
  const r = parseLocation('Bangalore, India');
  assert.equal(r.country, 'IN');
});

test('parseLocation returns nulls for text that is not a location', () => {
  const r = parseLocation('Excelloit Consultancy Services');
  assert.equal(r.city, null);
  assert.equal(r.country, null);
  assert.equal(r.work_mode, null);
});

// ── job id + canonical url ───────────────────────────────────────────────────

test('parseJobId reads the id out of a componentkey', () => {
  assert.equal(parseJobId('job-card-component-ref-4471884046'), '4471884046');
});

test('parseJobId reads the id out of a /jobs/view/ href', () => {
  assert.equal(parseJobId('https://www.linkedin.com/jobs/view/4454388223/'), '4454388223');
});

test('parseJobId reads the id out of a slugged /jobs/view/ href', () => {
  assert.equal(parseJobId('/jobs/view/some-role-at-a-company-4454388223?x=1'), '4454388223');
});

test('parseJobId returns null when there is no id', () => {
  assert.equal(parseJobId('https://www.linkedin.com/company/acme/'), null);
});

test('canonicalJobUrl strips every tracking parameter', () => {
  const url =
    'https://www.linkedin.com/jobs/view/4454388223/?trackingId=wDIW%2B&refId=gVOz&eBP=CwEAA&alternateChannel=search&isJobSearch=false';
  assert.equal(canonicalJobUrl(url), 'https://www.linkedin.com/jobs/view/4454388223/');
});

// ── title ────────────────────────────────────────────────────────────────────

test('cleanTitle removes the "Verified job" suffix', () => {
  assert.equal(cleanTitle('Artificial Intelligence Engineer (Verified job)').title, 'Artificial Intelligence Engineer');
});

test('cleanTitle removes gender markers but keeps the display title', () => {
  const r = cleanTitle('Consultant Data Science & ML Engineering (m/w/d)');
  assert.equal(r.title, 'Consultant Data Science & ML Engineering (m/w/d)');
  assert.equal(r.title_norm, 'Consultant Data Science & ML Engineering');
});

test('cleanTitle collapses the whitespace a card layout leaves behind', () => {
  assert.equal(cleanTitle('  AI   Engineer  ').title, 'AI Engineer');
});

// ── card text ────────────────────────────────────────────────────────────────

test('splitLines drops empty lines and middot separators', () => {
  assert.deepEqual(splitLines('A\n\n  \n·\nB\n'), ['A', 'B']);
});

test('parseCardText reads the modern card layout', () => {
  const r = parseCardText([
    'Artificial Intelligence Engineer (Verified job)',
    'Artificial Intelligence Engineer',
    'Excelloit Consultancy Services',
    'Germany (Remote)',
    'Posted 19 hours ago',
    '19 hours ago',
    '·',
    'Be an early applicant',
    '·',
    'Easy Apply',
    '·',
    'Promoted',
  ]);
  assert.equal(r.title, 'Artificial Intelligence Engineer');
  assert.equal(r.company, 'Excelloit Consultancy Services');
  assert.equal(r.location_raw, 'Germany (Remote)');
  assert.equal(r.posted_raw, 'Posted 19 hours ago');
  assert.equal(r.easy_apply, true);
  assert.deepEqual(r.badges, ['Be an early applicant', 'Promoted']);
  assert.equal(r.already_applied, false);
});

test('parseCardText reads a card whose title is not duplicated', () => {
  const r = parseCardText([
    'Founding Engineer',
    'AI Futures',
    'Berlin, Germany (On-site)',
    '70K EUR/yr - 95K EUR/yr',
    'Posted 17 hours ago',
    '17 hours ago',
    '·',
    'Easy Apply',
  ]);
  assert.equal(r.title, 'Founding Engineer');
  assert.equal(r.company, 'AI Futures');
  assert.equal(r.location_raw, 'Berlin, Germany (On-site)');
  assert.equal(r.salary_raw, '70K EUR/yr - 95K EUR/yr');
  assert.equal(r.posted_raw, 'Posted 17 hours ago');
});

test('parseCardText joins a multi-line company and its legal form', () => {
  const r = parseCardText([
    'Pflegefachkraft (m/w/d)',
    'AlexA Pflege',
    'GmbH',
    'Berlin (Hybrid)',
    '·',
    'Easy Apply',
  ]);
  assert.equal(r.company, 'AlexA Pflege GmbH');
  assert.equal(r.title, 'Pflegefachkraft (m/w/d)');
  assert.equal(r.title_norm, 'Pflegefachkraft');
});

test('parseCardText never returns "GmbH" alone as the company', () => {
  const r = parseCardText(['Role', 'AlexA Pflege', 'GmbH', 'Berlin (Hybrid)']);
  assert.notEqual(r.company, 'GmbH');
  assert.equal(r.company, 'AlexA Pflege GmbH');
});

test('parseCardText keeps a two-word company as one company', () => {
  const r = parseCardText(['Role', 'Nexus- Business Management Consulting', 'Hamburg (Hybrid)']);
  assert.equal(r.company, 'Nexus- Business Management Consulting');
});

test('parseCardText sets already_applied for an "Applied now" card', () => {
  const r = parseCardText([
    'AI Engineer',
    'Some GmbH',
    'Berlin (Hybrid)',
    'Applied now',
    '·',
    'Easy Apply',
  ]);
  assert.equal(r.already_applied, true);
});

test('parseCardText reports a null company rather than guessing', () => {
  const r = parseCardText(['Role', 'Berlin (Hybrid)']);
  assert.equal(r.company, null);
});

test('parseCardText records the card meta lines as notes', () => {
  const r = parseCardText([
    'AI Engineer',
    'Some GmbH',
    'Berlin (Hybrid)',
    'Actively reviewing applicants',
    'Viewed',
    '·',
    'Easy Apply',
  ]);
  assert.ok(r.notes.includes('Actively reviewing applicants'));
  assert.ok(r.notes.includes('Viewed'));
});
