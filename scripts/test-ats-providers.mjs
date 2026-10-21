#!/usr/bin/env node

/**
 * test-ats-providers.mjs — table-driven tests for the ATS provider adapters.
 *
 * No network by default. Every parser is exercised against an inline fixture
 * shaped like the real payload (each shape was captured from the live
 * endpoint on 2026-10-20).
 *
 * Usage:
 *   node scripts/test-ats-providers.mjs
 *   node scripts/test-ats-providers.mjs --live    # hits 3 real boards
 */

import { detectProvider, fetchFromProvider, parsePayload } from '../scripts/lib/ats-providers.mjs';

let fail = 0;
function check(ok, label, detail) {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  → ' + (detail ?? '')}`);
}

// ── 1. provider detection ───────────────────────────────────────────────
const DETECT_CASES = [
  ['https://job-boards.greenhouse.io/hive', 'greenhouse'],
  ['https://job-boards.eu.greenhouse.io/hive', 'greenhouse'],
  ['https://boards.greenhouse.io/refurbed', 'greenhouse'],
  ['https://jobs.ashbyhq.com/n8n', 'ashby'],
  ['https://jobs.lever.co/Packmatic', 'lever'],
  ['https://jobs.eu.lever.co/lovehoneygroup', 'lever'],
  ['https://mercanis.jobs.personio.de/', 'personio'],
  ['https://7learnings.jobs.personio.de/', 'personio'],
  ['https://beroe-inc.jobs.personio.com/?language=en', 'personio'],
  ['https://nomitri.recruitee.com/', 'recruitee'],
  ['https://careers.smartrecruiters.com/Flink3', 'smartrecruiters'],
  ['https://jobs.smartrecruiters.com/JobsForHumanity', 'smartrecruiters'],
  ['https://aklamio.bamboohr.com/careers', 'bamboohr'],
  ['https://misterspex.wd103.myworkdayjobs.com/de-DE/Mister_Spex_Careers', 'workday'],
  ['https://join.com/companies/mellohqcom', 'join'],
  ['https://apply.workable.com/exotec/', 'workable'],
  ['https://apply.workable.com/huggingface/', 'workable'],
  ['https://jobs.exail.com/en/annonces', 'digitalrecruiters'],
  ['https://jobs.exail.com/fr/annonces', 'digitalrecruiters'],
  ['https://jobs.exail.com/en/annonce/4245053-customer-support-engineer-fm-20354-hamburg', null],
  ['https://easymile.welcomekit.co/', 'welcomekit'],
  ['https://balyo.welcomekit.co/', 'welcomekit'],
  ['https://home24.career.softgarden.de/', 'softgarden'],
  ['https://wenglorsensoric.softgarden.io/de/vacancies', 'softgarden'],
  ['https://www.kittl.com/careers', null],
  ['https://lilt.com/careers', null],
  ['https://careers.forto.com/forto-jobs/', null],
];

for (const [url, want] of DETECT_CASES) {
  const p = detectProvider(url);
  const got = p ? p.type : null;
  check(got === want, `detectProvider(${url}) → ${want}`, `got ${got}`);
}

// endpoint derivation
const leverEu = detectProvider('https://jobs.eu.lever.co/lovehoneygroup');
check(leverEu && leverEu.url.startsWith('https://api.eu.lever.co/'),
  'EU lever board uses api.eu.lever.co', leverEu && leverEu.url);
const leverUs = detectProvider('https://jobs.lever.co/Packmatic');
check(leverUs && leverUs.url.startsWith('https://api.lever.co/'),
  'US lever board uses api.lever.co', leverUs && leverUs.url);
const personioDe = detectProvider('https://mercanis.jobs.personio.de/');
check(personioDe && personioDe.url === 'https://mercanis.jobs.personio.de/xml',
  'personio .de board → .de xml feed', personioDe && personioDe.url);
const personioCom = detectProvider('https://beroe-inc.jobs.personio.com/?language=en');
check(personioCom && personioCom.url === 'https://beroe-inc.jobs.personio.com/xml',
  'personio .com board → .com xml feed', personioCom && personioCom.url);
const sr = detectProvider('https://careers.smartrecruiters.com/Flink3');
check(sr && sr.url === 'https://api.smartrecruiters.com/v1/companies/Flink3/postings?limit=100',
  'smartrecruiters careers.* host → api.smartrecruiters.com', sr && sr.url);
const hr = detectProvider('https://aklamio.bamboohr.com/careers');
check(hr && hr.url === 'https://aklamio.bamboohr.com/careers/list',
  'bamboohr → /careers/list', hr && hr.url);
const gh = detectProvider('https://job-boards.eu.greenhouse.io/hive');
check(gh && gh.url === 'https://boards-api.greenhouse.io/v1/boards/hive/jobs',
  'greenhouse → boards-api', gh && gh.url);
const wo = detectProvider('https://apply.workable.com/exotec/');
check(wo && wo.url === 'https://apply.workable.com/api/v1/widget/accounts/exotec?details=true',
  'workable → widget API', wo && wo.url);
const woHf = detectProvider('https://apply.workable.com/huggingface/');
check(woHf && woHf.slug === 'huggingface',
  'workable tenant slug from the board path', woHf && woHf.slug);
const dr = detectProvider('https://jobs.exail.com/en/annonces');
check(dr && dr.domain === 'jobs.exail.com',
  'digitalrecruiters domain from the board host', dr && dr.domain);
check(dr && dr.locale === 'en',
  'digitalrecruiters locale from the board path', dr && dr.locale);
check(dr && dr.url.startsWith('https://api.digitalrecruiters.com/public/v1/careers-site/job-ads'),
  'digitalrecruiters → careers-site API', dr && dr.url);

// ── 2. parsers (offline fixtures) ───────────────────────────────────────
const FIX = {
  greenhouse: {
    jobs: [{
      absolute_url: 'https://job-boards.greenhouse.io/hive/jobs/1',
      location: { name: 'Berlin' },
      updated_at: '2026-10-15T04:07:51-04:00',
      first_published: '2026-10-01T10:00:00Z',
      title: 'Senior ML Engineer',
    }],
  },
  lever: [{
    text: 'Software Engineer',
    hostedUrl: 'https://jobs.lever.co/packmatic/abc',
    createdAt: 1760000000000,
    categories: { location: 'Berlin' },
  }],
  ashby: {
    jobs: [{
      title: 'AI Engineer',
      jobUrl: 'https://jobs.ashbyhq.com/n8n/abc',
      location: 'Berlin, Germany',
      publishedAt: '2026-10-18T10:00:00.000Z',
    }],
  },
  recruitee: {
    offers: [{
      id: 1234,
      title: 'Data Engineer',
      location: 'Berlin',
      created_at: '2026-10-17T08:00:00.000Z',
      url: 'https://nomitri.recruitee.com/1234',
    }],
  },
  smartrecruiters: {
    content: [{
      id: 744000154689480,
      name: 'Business Operations Analyst (m/f/d)',
      releasedDate: '2026-10-09T13:58:37.391Z',
      location: { fullLocation: 'Berlin, BE, Germany' },
      ref: 'https://api.smartrecruiters.com/v1/companies/Flink3/postings/744000154689480',
    }],
  },
  bamboohr: {
    result: [{
      id: '48',
      jobOpeningName: 'Financial Accountant / Bilanzbuchhalter',
      atsLocation: { city: 'Berlin', country: 'Germany' },
    }],
  },
  workday: {
    jobPostings: [{
      title: 'Assistant Store Manager in Wildau',
      externalPath: '/job/Wildau/Assistant_JR104554',
      postedOn: '2026-10-16T00:00:00Z',
    }],
  },
  workable: {
    jobs: [
      {
        title: 'Senior Solutions Engineer',
        shortlink: 'https://apply.workable.com/j/EF6552A1DD',
        url: 'https://apply.workable.com/j/EF6552A1DD',
        city: 'Munich',
        state: 'Bavaria',
        country: 'Germany',
        published_on: '2026-10-05',
        telecommuting: false,
        locations: [{ country: 'Germany', countryCode: 'DE', city: 'Munich', region: 'Bavaria', hidden: false }],
      },
      {
        title: 'Lead Solutions Engineer',
        shortlink: 'https://apply.workable.com/j/873B8BBE4A',
        city: '',
        state: '',
        country: 'France',
        published_on: '2026-10-01',
        telecommuting: true,
        locations: [{ country: 'France', countryCode: 'FR', city: '', region: null, hidden: false }],
      },
      {
        title: 'Open-Source Machine Learning Engineer - EMEA Remote',
        shortlink: 'https://apply.workable.com/j/HF0000001',
        city: 'Paris',
        state: 'Île-de-France',
        country: 'France',
        published_on: '2026-05-29',
        telecommuting: true,
        locations: [{ country: 'France', countryCode: 'FR', city: 'Paris', region: 'Île-de-France', hidden: true }],
      },
      {
        // Same EMEA role, but Workable left the authoring seat visible.
        title: 'Open-Source Machine Learning Engineer - EMEA Remote',
        shortlink: 'https://apply.workable.com/j/HF0000002',
        city: 'Paris',
        state: 'Île-de-France',
        country: 'France',
        published_on: '2026-05-29',
        telecommuting: true,
        locations: [{ country: 'France', countryCode: 'FR', city: 'Paris', region: 'Île-de-France', hidden: false }],
      },
    ],
  },
  digitalrecruiters: {
    count: 2,
    items: [
      {
        title: 'Customer Support Engineer - F/M',
        location: 'Hamburg',
        url: '4245053-customer-support-engineer-fm-20354-hamburg',
        contract: 'Permanent Contract',
        job: 'Customer Support',
      },
      {
        title: 'Référent IA & Algorithmie - UAS - H/F',
        location: 'La Garde',
        url: '4609969-referent-ia-algorithmie-uas-hf-83130-la-garde',
        contract: 'Permanent Contract',
        job: 'AI',
      },
    ],
  },
  welcomekit: `<div class='jobs-by-department-item'>
  <ul class='jobs-list'>
    <li class='jobs-list-item' data-department='25717' data-office='11413'>
      <a class="jobs-list-item-link" href="/jobs/embedded-software-engineer-cdi-toulouse-f-m_toulouse">
        <h3 class='jobs-list-item-title'> Embedded Software Engineer - CDI - Toulouse (F/M) </h3>
        <ul class='jobs-list-item-details'>
          <li class='jobs-list-item-contract-type'><i class='icon-secondary icon-briefcase'></i> Full-Time </li>
          <li class='jobs-list-item-office'><i class='icon-secondary icon-location'></i> Toulouse </li>
        </ul>
      </a>
    </li>
    <li class='jobs-list-item' data-department='25717' data-office='11413'>
      <a class="jobs-list-item-link" href="/jobs/robotics-software-engineer-berlin_berlin">
        <h3 class='jobs-list-item-title'> Robotics Software Engineer - Berlin </h3>
        <ul class='jobs-list-item-details'>
          <li class='jobs-list-item-contract-type'><i class='icon-secondary icon-briefcase'></i> Full-Time </li>
          <li class='jobs-list-item-office'><i class='icon-secondary icon-location'></i> Berlin </li>
        </ul>
      </a>
    </li>
  </ul>
</div>`,
};

function parseOne(type, payload, company) {
  const jobs = parsePayload(type, payload, company, 'https://example.com');
  return jobs[0] || null;
}

const ghJob = parseOne('greenhouse', FIX.greenhouse, 'HIVE');
check(ghJob && ghJob.title === 'Senior ML Engineer', 'greenhouse title', ghJob && ghJob.title);
check(ghJob && ghJob.location === 'Berlin', 'greenhouse location', ghJob && ghJob.location);
// first_published is preferred over updated_at: a role re-touched today but
// posted three weeks ago is not a NEW posting.
check(ghJob && ghJob.date === '2026-10-01', 'greenhouse date prefers first_published', ghJob && ghJob.date);
const ghNoFirst = parseOne('greenhouse', { jobs: [{ ...FIX.greenhouse.jobs[0], first_published: undefined }] }, 'HIVE');
check(ghNoFirst && ghNoFirst.date === '2026-10-15', 'greenhouse falls back to updated_at', ghNoFirst && ghNoFirst.date);
check(ghJob && ghJob.url.startsWith('https://'), 'greenhouse absolute url', ghJob && ghJob.url);
check(ghJob && ghJob.provider === 'greenhouse', 'greenhouse provider tag', ghJob && ghJob.provider);

const lvJob = parseOne('lever', FIX.lever, 'Packmatic');
check(lvJob && lvJob.title === 'Software Engineer', 'lever title', lvJob && lvJob.title);
check(lvJob && lvJob.location === 'Berlin', 'lever location', lvJob && lvJob.location);
check(lvJob && /^\d{4}-\d{2}-\d{2}$/.test(lvJob.date || ''), 'lever date is YYYY-MM-DD', lvJob && lvJob.date);

const asJob = parseOne('ashby', FIX.ashby, 'n8n');
check(asJob && asJob.title === 'AI Engineer', 'ashby title', asJob && asJob.title);
check(asJob && asJob.date === '2026-10-18', 'ashby date from publishedAt', asJob && asJob.date);

const rcJob = parseOne('recruitee', FIX.recruitee, 'Nomitri');
check(rcJob && rcJob.title === 'Data Engineer', 'recruitee title', rcJob && rcJob.title);
check(rcJob && rcJob.date === '2026-10-17', 'recruitee date from created_at', rcJob && rcJob.date);

const srJob = parseOne('smartrecruiters', FIX.smartrecruiters, 'Flink');
check(srJob && srJob.title === 'Business Operations Analyst (m/f/d)', 'smartrecruiters title', srJob && srJob.title);
check(srJob && srJob.date === '2026-10-09', 'smartrecruiters date from releasedDate', srJob && srJob.date);
check(srJob && srJob.url.includes('744000154689480'), 'smartrecruiters job url', srJob && srJob.url);

const bhJob = parseOne('bamboohr', FIX.bamboohr, 'Aklamio');
check(bhJob && bhJob.title === 'Financial Accountant / Bilanzbuchhalter', 'bamboohr title', bhJob && bhJob.title);
check(bhJob && bhJob.url.includes('/48/'), 'bamboohr job url', bhJob && bhJob.url);
check(bhJob && bhJob.date === null, 'bamboohr date is null (not provided)', bhJob && bhJob.date);

const wdJob = parseOne('workday', FIX.workday, 'Mister Spex');
check(wdJob && wdJob.title === 'Assistant Store Manager in Wildau', 'workday title', wdJob && wdJob.title);
check(wdJob && wdJob.url.startsWith('https://'), 'workday absolute url', wdJob && wdJob.url);

// workable — three location shapes that must not be confused
const woJobs = parsePayload('workable', FIX.workable, 'Exotec', 'https://apply.workable.com/api/v1/widget/accounts/exotec?details=true');
check(woJobs.length === 4, 'workable → 4 postings', `got ${woJobs.length}`);
check(woJobs[0] && woJobs[0].location === 'Munich, Bavaria, Germany',
  'workable on-site location keeps city/region/country', woJobs[0] && woJobs[0].location);
check(woJobs[0] && woJobs[0].date === '2026-10-05', 'workable date from published_on', woJobs[0] && woJobs[0].date);
check(woJobs[0] && woJobs[0].url === 'https://apply.workable.com/j/EF6552A1DD',
  'workable job url from shortlink', woJobs[0] && woJobs[0].url);
check(woJobs[0] && woJobs[0].provider === 'workable', 'workable provider tag', woJobs[0] && woJobs[0].provider);
// A country-scoped remote seat must keep its country, or a France-only remote
// role would read as plain "Remote" and slip past the location filter.
check(woJobs[1] && woJobs[1].location === 'France',
  'workable country-scoped remote keeps the country', woJobs[1] && woJobs[1].location);
// A genuinely open remote seat hides the placeholder location, or names its
// scope in the title — either way the location is "Remote", not the city the
// posting happens to be authored from.
check(woJobs[2] && woJobs[2].location === 'Remote',
  'workable open remote seat (hidden location) → "Remote"', woJobs[2] && woJobs[2].location);
check(woJobs[3] && woJobs[3].location === 'Remote',
  'workable open remote seat (scope word in title) → "Remote"', woJobs[3] && woJobs[3].location);

// digitalrecruiters — city-only locations, no dates
const drJobs = parsePayload('digitalrecruiters', FIX.digitalrecruiters, 'Exail',
  'https://api.digitalrecruiters.com/public/v1/careers-site/job-ads?domainName=jobs.exail.com',
  { domain: 'jobs.exail.com', locale: 'en' });
check(drJobs.length === 2, 'digitalrecruiters → 2 postings', `got ${drJobs.length}`);
check(drJobs[0] && drJobs[0].title === 'Customer Support Engineer - F/M',
  'digitalrecruiters title', drJobs[0] && drJobs[0].title);
check(drJobs[0] && drJobs[0].location === 'Hamburg',
  'digitalrecruiters location is the bare city', drJobs[0] && drJobs[0].location);
check(drJobs[0] && drJobs[0].url === 'https://jobs.exail.com/en/annonce/4245053-customer-support-engineer-fm-20354-hamburg',
  'digitalrecruiters job url from the slug + board locale', drJobs[0] && drJobs[0].url);
check(drJobs[0] && drJobs[0].date === null,
  'digitalrecruiters date is null (the list payload carries none)', drJobs[0] && drJobs[0].date);

// welcomekit — the office city is the point: without it a French role looks
// location-less and slips past the location filter.
const wkJobs = parsePayload('welcomekit', FIX.welcomekit, 'EasyMile',
  'https://easymile.welcomekit.co/', { url: 'https://easymile.welcomekit.co/' });
check(wkJobs.length === 2, 'welcomekit → 2 postings', `got ${wkJobs.length}`);
check(wkJobs[0] && wkJobs[0].title === 'Embedded Software Engineer - CDI - Toulouse (F/M)',
  'welcomekit title', wkJobs[0] && wkJobs[0].title);
check(wkJobs[0] && wkJobs[0].location === 'Toulouse',
  'welcomekit location is the office city', wkJobs[0] && wkJobs[0].location);
check(wkJobs[0] && wkJobs[0].url === 'https://easymile.welcomekit.co/jobs/embedded-software-engineer-cdi-toulouse-f-m_toulouse',
  'welcomekit job url is absolute', wkJobs[0] && wkJobs[0].url);
check(wkJobs[1] && wkJobs[1].location === 'Berlin',
  'welcomekit keeps a German office city', wkJobs[1] && wkJobs[1].location);
check(wkJobs[0] && wkJobs[0].date === null,
  'welcomekit date is null (the board carries none)', wkJobs[0] && wkJobs[0].date);

// personio XML
const PERSONIO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<workzag-jobs>
<position>
    <id>2720101</id>
    <subcompany>DM Technologies GmbH</subcompany>
    <office>Berlin</office>
    <department>Sales</department>
    <name>Account Executive - German Speaking</name>
</position>
<position>
    <id>2720102</id>
    <subcompany>Plato</subcompany>
    <office>Berlin</office>
    <department>Engineering</department>
    <name>Senior Python Engineer</name>
    <createdAt>2026-10-18T10:00:00+00:00</createdAt>
</position>
</workzag-jobs>`;
const pJobs = parsePayload('personio', PERSONIO_XML, 'Plato', 'https://platoapp.jobs.personio.de/xml');
check(pJobs.length === 2, 'personio xml → 2 positions', `got ${pJobs.length}`);
check(pJobs[1] && pJobs[1].title === 'Senior Python Engineer', 'personio title', pJobs[1] && pJobs[1].title);
check(pJobs[1] && pJobs[1].location === 'Berlin', 'personio office → location', pJobs[1] && pJobs[1].location);
check(pJobs[1] && pJobs[1].date === '2026-10-18', 'personio date from <createdAt>', pJobs[1] && pJobs[1].date);
check(pJobs[1] && pJobs[1].url.includes('2720102'), 'personio job url carries the id', pJobs[1] && pJobs[1].url);
check(pJobs[0] && pJobs[0].date === null, 'personio without <createdAt> → null date', pJobs[0] && pJobs[0].date);

// malformed payloads must not throw
for (const t of ['greenhouse', 'lever', 'ashby', 'recruitee', 'smartrecruiters', 'bamboohr', 'workday', 'personio', 'join', 'softgarden', 'workable', 'digitalrecruiters', 'welcomekit']) {
  let threw = null, out = null;
  try { out = parsePayload(t, { totally: 'wrong' }, 'X', 'https://example.com'); } catch (e) { threw = e.message; }
  check(threw === null && Array.isArray(out) && out.length === 0,
    `${t} parser survives a malformed payload`, threw || `returned ${JSON.stringify(out).slice(0, 60)}`);
}

// ── 3. live smoke test (opt-in) ─────────────────────────────────────────
if (process.argv.includes('--live')) {
  const live = [
    ['greenhouse', 'https://job-boards.greenhouse.io/hive', 'HIVE'],
    ['ashby', 'https://jobs.ashbyhq.com/n8n', 'n8n'],
    ['personio', 'https://mercanis.jobs.personio.de/', 'mercanis'],
  ];
  for (const [type, url, name] of live) {
    let jobs = [];
    try {
      const p = detectProvider(url);
      jobs = await fetchFromProvider(p, name);
    } catch (e) {
      check(false, `live ${type} (${name})`, e.message);
      continue;
    }
    check(jobs.length > 0, `live ${type} (${name}) returns roles`, `got ${jobs.length}`);
    if (jobs.length) {
      const dated = jobs.filter(j => j.date);
      console.log(`      sample: "${jobs[0].title}" | ${jobs[0].location || 'n/a'} | ${jobs[0].date || 'undated'} | ${jobs.length} roles, ${dated.length} dated`);
    }
  }
}

console.log(fail === 0 ? '\nAll cases pass' : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
