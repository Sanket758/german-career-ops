#!/usr/bin/env node

/**
 * test-title-filter.mjs — regression tests for scan.mjs buildTitleFilter()
 *
 * Why: portals.yml title_filter.positive contains short keywords (AI, ML, KI,
 * ROS, RAG, SEO). Plain substring matching made "P-ai-d Search", "B-anki-ng Law",
 * "Sto-rag-e" and "HTML" (-> "ml") pass as AI roles. buildTitleFilter now applies
 * word boundaries to short alphanumeric keywords; these cases lock that in.
 *
 * Usage:
 *   node scripts/test-title-filter.mjs
 *   (from repo root; also safe to run from scripts/ — path is resolved from this file)
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
// The filter lives in lib/role-filter.mjs since the scan-lib refactor — it
// used to be inline in scan.mjs, which is what this test used to regex out.
const SCAN_SRC = join(SCRIPTS_DIR, 'lib', 'role-filter.mjs');

// Extract buildTitleFilter from source — importing it would pull in the
// module's other exports, and the old inline version in scan.mjs is gone.
const src = readFileSync(SCAN_SRC, 'utf8');
const m = src.match(/function buildTitleFilter\(titleFilter\) \{[\s\S]*?\n\}/);
if (!m) {
  console.error('FAIL: could not extract buildTitleFilter from scripts/lib/role-filter.mjs');
  process.exit(1);
}
const buildTitleFilter = new Function(`${m[0]}; return buildTitleFilter;`)();

const tf = buildTitleFilter({
  positive: ['AI', 'ML', 'Machine Learning', 'Python', 'Data Engineer', 'Agent', 'Agentic', 'ROS', 'RAG', 'KI', 'GenAI', 'LLM', 'Robotics'],
  negative: ['Marketing', 'Sales', 'Product Manager', 'Paid Social', 'Working Student'],
});

const cases = [
  // [title, expected, why]
  ['Senior ML Engineer (f/m/d)', true, 'true positive'],
  ['AI Engineer — Berlin', true, 'true positive'],
  ['Machine Learning Engineer', true, 'true positive'],
  ['GenAI Product Engineer', true, 'GenAI explicit keyword'],
  ['Robotics Software Engineer', true, 'true positive'],
  ['Python Data Engineer', true, 'true positive'],
  ['KI Ingenieur (m/w/d)', true, 'German KI keyword'],
  ['Agentic Platform Engineer', true, 'true positive'],
  ['RAG Systems Engineer', true, 'true positive'],
  ['ROS 2 Developer', true, 'true positive (ROS with space+2)'],
  ['Team Lead, Paid Search (All Genders)', false, 'REGRESSION: "Paid" matched "ai"'],
  ['Senior Legal Counsel Banking Law', false, 'REGRESSION: "Banking" matched "ki"'],
  ['Storage Engineer', false, 'REGRESSION: "Storage" matched "rag"'],
  ['HTML Developer', false, 'REGRESSION: "HTML" matched "ml"'],
  ['Detail-Oriented Analyst', false, 'REGRESSION: "detail" matched "ai"'],
  ['Marketing Manager AI', false, 'negative must still win'],
  ['Working Student Machine Learning', false, 'CODE RED: part-time excluded'],
  ['AI Sales Manager', false, 'negative must still win'],
];

let fail = 0;
for (const [title, want, why] of cases) {
  const got = tf(title);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  want=${want} got=${got}  ${title}  (${why})`);
}
console.log(fail === 0 ? '\nAll cases pass' : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
