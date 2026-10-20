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

test('parsePostedAge reads the doubled copy LinkedIn renders', () => {
  // The live card puts the accessible copy and the sighted copy in one line:
  // "Posted 5 hours ago" + "5 hours ago" -> "Posted 5 hours ago5 hours ago".
  const r = parsePostedAge('Posted 5 hours ago5 hours ago', NOW);
  assert.equal(r.posted_age_hours, 5);
  assert.equal(r.posted_raw, 'Posted 5 hours ago');
});

test('parsePostedAge reads the doubled copy without the "Posted" prefix', () => {
  const r = parsePostedAge('19 hours ago19 hours ago', NOW);
  assert.equal(r.posted_age_hours, 19);
  assert.equal(r.posted_raw, '19 hours ago');
});

test('parsePostedAge reads the German minute and hour forms', () => {
  assert.equal(parsePostedAge('vor 3 Minuten', NOW).posted_age_hours, 0.05);
  assert.equal(parsePostedAge('vor 1 Stunde', NOW).posted_age_hours, 1);
  assert.equal(parsePostedAge('vor 2 Stunden', NOW).posted_age_hours, 2);
});

test('parsePostedAge reads "a minute ago"', () => {
  assert.equal(parsePostedAge('a minute ago', NOW).posted_age_hours, 0.017);
});

test('parsePostedAge still flags a repost that also carries an age', () => {
  const r = parsePostedAge('Reposted 3 days ago', NOW);
  assert.equal(r.reposted, true);
  assert.equal(r.posted_age_hours, 72);
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

test('parseLocation reads a country LinkedIn writes in parentheses', () => {
  const r = parseLocation('Remote (UK)');
  assert.equal(r.country, 'GB');
  assert.equal(r.work_mode, 'remote');
});

test('parseLocation reads the German work-mode words', () => {
  assert.equal(parseLocation('Berlin (Homeoffice)').work_mode, 'remote');
  assert.equal(parseLocation('Berlin (Vor Ort)').work_mode, 'onsite');
  assert.equal(parseLocation('Berlin (Präsenz)').work_mode, 'onsite');
});

test('parseLocation reads an unlisted European country', () => {
  const r = parseLocation('Tallinn, Estonia');
  assert.equal(r.country, 'EE');
  assert.equal(r.city, 'Tallinn');
});

test('parseLocation splits the legacy form on dashes as well as middots', () => {
  const r = parseLocation('Munich, Bavaria, Germany - 3 hours ago - 55 applicants');
  assert.equal(r.city, 'Munich');
  assert.equal(r.country, 'DE');
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

test('cleanTitle de-duplicates a short doubled title', () => {
  assert.equal(cleanTitle('HRHR').title, 'HR');
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

test('parseCardText never reports a bare legal form as the company', () => {
  // The name line is missing: "GmbH" alone is a partial company, not a company.
  assert.equal(parseCardText(['Role', 'GmbH', 'Berlin (Hybrid)']).company, null);
  assert.equal(parseCardText(['Role', 'AG', 'Berlin (Hybrid)']).company, null);
});

test('parseCardText keeps a company that mentions a country', () => {
  const r = parseCardText(['Role', 'Bosch, Germany', 'Berlin (Hybrid)']);
  assert.equal(r.company, 'Bosch, Germany');
  assert.equal(r.location_raw, 'Berlin (Hybrid)');
});

test('parseCardText takes the location from the position, not from a vocabulary', () => {
  const r = parseCardText(['Role', 'Acme', 'Tallinn, Estonia']);
  assert.equal(r.company, 'Acme');
  assert.equal(r.location_raw, 'Tallinn, Estonia');
});

test('parseCardText reads a German work-mode location', () => {
  const r = parseCardText(['Role', 'Acme', 'Berlin (Homeoffice)']);
  assert.equal(r.company, 'Acme');
  assert.equal(r.work_mode, 'remote');
});

test('parseCardText does not swallow card meta into the company', () => {
  const r = parseCardText(['Role', 'Acme GmbH', '1 connection works here']);
  assert.equal(r.company, 'Acme GmbH');
  assert.equal(r.location_raw, null);
});

test('parseCardText reads a promoted card whose teaser line leads the card', () => {
  const r = parseCardText([
    'Solutions Architect GenAI | €250K OTE | Fortune 100',
    'Katapult',
    'Munich (Hybrid)',
    '200K EUR/yr - 250K EUR/yr + Bonus, Stock, Stock options, Profit sharing',
    'Posted 20 hours ago',
    '20 hours ago',
    '·',
    'Be an early applicant',
    '·',
    'Easy Apply',
    '·',
    'Promoted',
  ]);
  assert.equal(r.title, 'Solutions Architect GenAI');
  assert.equal(r.company, 'Katapult');
  assert.equal(r.location_raw, 'Munich (Hybrid)');
  assert.equal(r.salary_raw, '200K EUR/yr - 250K EUR/yr + Bonus, Stock, Stock options, Profit sharing');
  assert.equal(r.posted_raw, 'Posted 20 hours ago');
  assert.equal(parsePostedAge(r.posted_raw, NOW).posted_age_hours, 20);
});

test('parseCardText treats "55 applicants" as meta, not content', () => {
  const r = parseCardText(['Role', 'Acme', 'Berlin (Hybrid)', '55 applicants']);
  assert.equal(r.company, 'Acme');
  assert.equal(r.location_raw, 'Berlin (Hybrid)');
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
