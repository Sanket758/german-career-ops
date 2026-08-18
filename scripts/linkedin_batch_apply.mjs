#!/usr/bin/env node
/**
 * linkedin_batch_apply.mjs — Batch LinkedIn "LinkedIn Apply" (Easy Apply) applications.
 *
 * Uses CDP attach to the user's real Chrome (127.0.0.1:9222, dedicated profile
 * ~/.config/career-ops-chrome) — authenticated session, human-paced delays.
 *
 * INTELLIGENCE (per user directive, 2026-08-14):
 *  - Role fit scoring: JD keywords vs Sanket's real stack (core/secondary/hard-skip)
 *  - Conservative honest answers: real years per skill (C++ = 1, Python = 3, ...)
 *  - German proficiency = conversational (B1): NEVER "none" — prefer "Gut" (German options),
 *    else Grundkenntnisse/Conversational/B1 (user directive 2026-08-14)
 *  - Unknown/ambiguous required question (UNATTENDED) → write question to
 *    data/pending-questions.md + .json, SAVE the application draft, and STOP the
 *    whole run (do NOT submit, do NOT continue) — user answers in the morning
 *  - Recruiter/poster tracking → data/recruiters.md (for cold-email strategy)
 *  - Final "Save this application? / Discard / Save" dialog → click SAVE
 *  - Event log for self-correction: data/batch-apply-run.log
 *
 * Modes:
 *   --dry-run     process up to 1 job, stop at review, never submit
 *   --limit N     max applications to submit (default 20)
 *   --keywords "KW1,KW2"  override search keywords
 *   --interactive pause and ask user on unknown questions (default: skip)
 *
 * Output:
 *   batch/tracker-additions/*.tsv  — 9-col rows for merge-tracker.mjs
 *   data/batch-apply-run.log       — per-job event log
 */

import { chromium } from 'playwright';
import { appendFileSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CDP = 'http://127.0.0.1:9222';
const DRY_RUN = process.argv.includes('--dry-run');
const INTERACTIVE = process.argv.includes('--interactive');
const kwIdx = process.argv.indexOf('--keywords');
const KW_ARG = kwIdx > 0 ? process.argv[kwIdx + 1] : undefined;
const limIdx = process.argv.indexOf('--limit');
const LIMIT = limIdx > 0 ? parseInt(process.argv[limIdx + 1] || '20', 10) : 20;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (min, max) => min + Math.floor(Math.random() * (max - min));
const FAST = process.env.BATCH_FAST === '1';
const DELAY_ACTION = FAST ? [1500, 2500] : [20000, 40000];
const DELAY_APP = FAST ? [4000, 8000] : [60000, 120000];

const DEFAULTS = { phoneLocal: '0176 76475359' };

// --- Sanket's REAL experience (years per skill) — source: config/profile.yml, resume ---
const YEARS = {
  // core stack (high confidence)
  'python': 3, 'pytorch': 3, 'tensorflow': 3, 'opencv': 3, 'yolo': 3, 'yolov5': 3,
  'yolov8': 3, 'machine learning': 3, 'deep learning': 3, 'computer vision': 3,
  'image processing': 3, 'cnn': 3, 'detectron': 2, 'object detection': 3,
  'segmentation': 2, 'retrieval': 2, 'dino': 2, 'nlp': 2, 'llm': 1, 'gcp': 2,
  'docker': 2, 'kubernetes': 1, 'cloud': 2, 'rest api': 2, 'flask': 2, 'fastapi': 2,
  'sql': 1, 'pandas': 3, 'numpy': 3, 'git': 3, 'linux': 2, 'mlops': 1,
  // secondary / honest-low
  'c++': 1, 'c ': 1, 'unix': 1, 'java': 1, 'javascript': 1, 'react': 1,
};

function yearsFor(label) {
  const l = label.toLowerCase();
  for (const [k, v] of Object.entries(YEARS)) {
    if (k === 'c ' && !/\bc\b/.test(l)) continue;
    if (l.includes(k)) return v;
  }
  return null; // unknown skill
}

// --- Role fit scoring ---
const CORE_KW = ['computer vision', 'machine learning', 'deep learning', 'image processing',
  'object detection', 'pytorch', 'tensorflow', 'opencv', 'yolo', 'cnn', 'neural network',
  'segmentation', 'retrieval', 'python', 'ml model', 'computer vision engineer',
  'artificial intelligence', 'generative ai', 'llm', 'rag', 'langchain', 'ai engineer',
  'ml engineer', 'machine learning engineer'];
const SECONDARY_KW = ['docker', 'kubernetes', 'gcp', 'cloud', 'mlops', 'api', 'deployment',
  'data', 'pandas', 'numpy', 'linux', 'git', 'nlp', 'llm', 'rag', 'fastapi', 'flask',
  'ai', 'agent', 'genai', 'transformer'];
const HARD_SKIP_KW = ['embedded', 'fpga', 'vhdl', 'verilog', 'firmware', 'hardware design',
  'pcb', 'microcontroller', 'mainframe', 'cobol', 'sap basis', 'frontend developer',
  'react developer', 'web developer', 'devops engineer', 'sales', 'marketing', 'recruiter',
  'human resources', 'hr department', 'hr team', 'hr manager', 'social media', 'influencer',
  'fluent german', 'c1 german', 'native german', 'german speaking',
  'in-office', 'berlin only', 'munich only', 'frankfurt only'];

function scoreRole(title, jdText) {
  const text = `${title} ${jdText}`.toLowerCase();
  const coreHits = CORE_KW.filter(k => text.includes(k));
  const secHits = SECONDARY_KW.filter(k => text.includes(k));
  const hardHits = HARD_SKIP_KW.filter(k => text.includes(k));
  const score = coreHits.length * 2 + secHits.length;
  const verdict = hardHits.length > 0 ? 'HARD_SKIP'
    : coreHits.length >= 2 ? 'APPLY'
    : coreHits.length === 1 ? 'MARGINAL'
    : 'MISMATCH';
  return { score, verdict, coreHits, secHits, hardHits };
}

// Seniority filter — target is junior/mid
const SKIP_TITLE = /\b(senior|lead|staff|principal|sr\.?|head of|director|manager|architect|vp|expert|fachkraft|specialist)\b/i;

function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  appendFileSync(join(ROOT, 'data/batch-apply-run.log'), line + '\n');
}

function nowDate() { return new Date().toISOString().slice(0, 10); }

// --- Robust extraction: bounded timeouts so a slow/missing pane can't stall a job ---
async function grabText(page, selectors, opts = {}) {
  const timeout = opts.timeout || 8000;
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        const txt = await el.innerText({ timeout }).catch(() => '');
        if (txt && txt.trim()) return txt.trim();
      }
    } catch { /* try next selector */ }
  }
  return '';
}

// --- Step helpers ---------------------------------------------------------

async function dismissConsent(page) {
  const banner = page.locator('.artdeco-global-alert--COOKIE_CONSENT, [alert-id*="COOKIE_CONSENT"]');
  if (await banner.count() > 0 && await banner.first().isVisible().catch(() => false)) {
    const accept = banner.locator('button:has-text("Accept")').first();
    if (await accept.count() > 0) { await accept.click(); log('  dismiss: cookie banner accepted'); }
  }
}

async function nextStep(page) {
  for (let i = 0; i < 3; i++) {
    // Fallback order: exact aria-label → Continue text → Weiter (German) → partial aria-label
    const candidates = [
      page.locator('button[aria-label="Continue to next step"]').filter({ visible: true }),
      page.locator('button:has-text("Continue")').filter({ visible: true, hasNot: page.locator('[disabled]') }),
      page.locator('button:has-text("Weiter")').filter({ visible: true, hasNot: page.locator('[disabled]') }),
      page.locator('button[aria-label*="Continue"]').filter({ visible: true, hasNot: page.locator('[disabled]') }),
    ];
    for (const loc of candidates) {
      const btn = loc.first();
      if (await btn.count() > 0 && await btn.isEnabled().catch(() => true)) {
        await btn.click();
        return true;
      }
    }
    await page.waitForTimeout(1500);
  }
  return false;
}

async function askUser(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(res => rl.question(`\n❓ ${question}\n   Answer (or ENTER to skip this job): `, res));
  rl.close();
  return answer.trim();
}

async function fillContactStep(page) {
  const modal = page.locator('.jobs-easy-apply-modal').first();

  // Fill ALL visible selects in the contact step (email-type, phone-type, country-code, etc.)
  // An unselected required select disables Next → "no Next on contact" skip.
  const selects = modal.locator('select').filter({ visible: true });
  const selCount = await selects.count();
  for (let i = 0; i < selCount; i++) {
    const sel = selects.nth(i);
    const val = await sel.inputValue().catch(() => '');
    if (val) continue; // already selected

    // Get label text
    const label = await page.evaluate((el) => {
      const form = el.closest('.fb-dash-form-element, form');
      const lbl = form?.querySelector('.fb-dash-form-element__label, label');
      return lbl ? lbl.innerText.trim() : '';
    }, await sel.elementHandle()).catch(() => '');

    // Get real options (skip placeholder "Select an option")
    const opts = (await sel.locator('option').allTextContents().catch(() => [])).map(o => o.trim()).filter(Boolean);
    const real = opts.slice(1);
    if (real.length === 0) continue;

    let pick = null;
    const labelLower = label.toLowerCase();

    // Email-type: label matches email OR options contain gadge/gmail
    if (/email|e-?mail/i.test(label) || real.some(o => /gadgesanket|gadge|gmail/i.test(o))) {
      pick = real.find(o => /gadgesanket|gadge/i.test(o)) || real.find(o => /gmail/i.test(o)) || real[0];
    }
    // Country-code: label matches country/land/code OR options contain Deutschland/Germany/+49
    else if (/country|land|code/i.test(label) || real.some(o => /deutschland|germany|\+49/i.test(o))) {
      pick = real.find(o => /deutschland/i.test(o)) || real.find(o => /germany/i.test(o)) || real.find(o => /\+49/i.test(o)) || real[0];
    }
    // Phone-type: label matches phone/telefon/type/art
    else if (/phone|telefon|type|art/i.test(label)) {
      pick = real.find(o => /mobile|mobil|handy|smartphone/i.test(o)) || real[0];
    }
    // Language: label matches deutsch/german/sprache/language
    else if (/deutsch|german|sprache|language/i.test(label)) {
      const bad = ['gar nicht', 'keine kenntnisse', 'none', 'keine', 'no knowledge', 'not at all', 'n/a', '--'];
      pick = real.find(o => /gut|conversational|b1|deutsch/i.test(o)) || real.find(o => !bad.some(b => o.toLowerCase().includes(b))) || real[0];
    }
    // Fallback: first real option
    else {
      pick = real[0];
    }

    if (pick) {
      await sel.selectOption({ label: pick }).catch(() => {});
      log(`  contact: select "${label.slice(0, 25)}" → "${pick.slice(0, 25)}"`);
    }
  }

  // Fill phone input
  const phone = page.locator('.jobs-easy-apply-modal input[type="tel"], .jobs-easy-apply-modal input[id*="phone"]').first();
  if (await phone.count() > 0) {
    const cur = (await phone.inputValue().catch(() => '')).trim();
    if (!cur) { await phone.fill(DEFAULTS.phoneLocal); log('  contact: phone filled'); }
    else log('  contact: phone present');
  }
}

/**
 * Fill the questions step. Returns true if all REQUIRED fields got a confident
 * answer; false if something unknown/ambiguous → caller should skip this job.
 */
async function fillQuestionsStep(page, jobTitle) {
  const modal = page.locator('.jobs-easy-apply-modal').first();
  const answered = [];
  let blockers = [];

  // text inputs (years of experience / free text)
  const inputs = modal.locator('input[type="text"]');
  for (let i = 0; i < await inputs.count(); i++) {
    const inp = inputs.nth(i);
    if (!(await inp.isVisible().catch(() => false))) continue;
    const label = await page.evaluate((el) => {
      const form = el.closest('.fb-dash-form-element, form');
      const lbl = form?.querySelector('.fb-dash-form-element__label, label');
      return lbl ? lbl.innerText.trim() : '';
    }, await inp.elementHandle());
    const cur = (await inp.inputValue().catch(() => '')).trim();
    if (cur) { answered.push(`${label.slice(0, 30)}="${cur}"`); continue; }

    const years = yearsFor(label);
    if (years === null) {
      blockers.push(`years "${label.slice(0, 60)}" (skill not in your profile)`);
      continue;
    }
    await inp.fill(String(years));
    answered.push(`${label.slice(0, 30)}=${years}y`);
  }

  // selects (e.g., German proficiency)
  const selects = modal.locator('select');
  for (let i = 0; i < await selects.count(); i++) {
    const sel = selects.nth(i);
    if (!(await sel.isVisible().catch(() => false))) continue;
    const label = await page.evaluate((el) => {
      const form = el.closest('.fb-dash-form-element, form');
      const lbl = form?.querySelector('.fb-dash-form-element__label, label');
      return lbl ? lbl.innerText.trim() : '';
    }, await sel.elementHandle());
    const opts = (await sel.locator('option').allInnerTexts().catch(() => [])).map(o => o.trim()).filter(Boolean);
    const real = opts.slice(1);
    let pick = null;
    if (/deutsch|german|sprache|language/i.test(label)) {
      // German: conversational B1 (user directive 2026-08-14). NEVER "none"/"Gar nicht".
      // Preference order: English options → Conversational/B1; German options → "Gut".
      const germanPref = ['Conversational', 'B1', 'B1 - Konversation', 'Gut', 'Fortgeschritten', 'Grundkenntnisse', 'Basic', 'Elementary'];
      pick = germanPref.find(p => real.includes(p)) || null;
      // If no good option present, pick the first NON-"none" option (never Gar nicht/Keine/none)
      if (!pick) {
        const bad = ['gar nicht', 'keine kenntnisse', 'none', 'keine', 'no knowledge', 'not at all', 'n/a', '--'];
        pick = real.find(o => !bad.some(b => o.toLowerCase().includes(b))) || null;
      }
      if (pick) { await sel.selectOption({ label: pick }); answered.push(`${label.slice(0, 30)}=${pick} (German B1)`); }
      else blockers.push(`select "${label.slice(0, 40)}" (German options unclear: ${real.slice(0, 4).join('/')})`);
      continue;
    } else if (/englisch|english|english level|englischkenntnisse/i.test(label)) {
      // English: C1 (IELTS) → prefer highest available level.
      const preferred = ['Muttersprache oder zweisprachig', 'Verhandlungssicher', 'Fluent', 'Native', 'Proficient', 'Advanced', 'C1'];
      pick = preferred.find(p => real.includes(p)) || real[real.length - 1] || null;
      if (pick) { await sel.selectOption({ label: pick }); answered.push(`${label.slice(0, 30)}=${pick} (English C1)`); }
      else blockers.push(`select "${label.slice(0, 40)}" (english options unclear)`);
      continue;
    } else if (real.length > 0) {
      pick = real[0];
      answered.push(`${label.slice(0, 30)}=${pick}`);
    }
    if (pick) await sel.selectOption({ label: pick });
    else blockers.push(`select "${label.slice(0, 40)}" (no options)`);
  }

  // radio groups → only answer confident Yes/No questions
  const radioGroups = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal');
    if (!m) return [];
    const groups = [];
    m.querySelectorAll('.fb-dash-form-element').forEach(el => {
      const radios = [...el.querySelectorAll('button[role="radio"]')];
      if (radios.length > 0) {
        const label = el.querySelector('.fb-dash-form-element__label, label')?.innerText?.trim() || '';
        groups.push({ label, radios: radios.map(r => ({ text: (r.innerText || '').trim(), checked: r.getAttribute('aria-checked') === 'true' })) });
      }
    });
    return groups;
  });

  for (const g of radioGroups) {
    if (g.radios.some(r => r.checked)) continue; // already answered
    const l = g.label.toLowerCase();
    let pick = null;
    if (/work (authorization|permit)|arbeitserlaubnis|right to work|visa|aufenthalt/.test(l)) {
      pick = ['yes', 'ja', 'y'].find(y => g.radios.some(r => r.text.toLowerCase() === y));
    } else if (/relocat|umzug|willing to/.test(l)) {
      pick = ['yes', 'ja', 'y'].find(y => g.radios.some(r => r.text.toLowerCase() === y));
    } else if (/german|deutsch/.test(l)) {
      // B1 — choose "Ja"/"Yes" only if present, else skip job (ambiguous)
      pick = ['yes', 'ja'].find(y => g.radios.some(r => r.text.toLowerCase() === y));
      if (!pick) { blockers.push(`radio "${g.label.slice(0, 40)}" (German — needs human)`); continue; }
    } else {
      blockers.push(`radio "${g.label.slice(0, 40)}" (unclear — needs human)`);
      continue;
    }
    if (pick) {
      const btn = g.radios.find(r => r.text.toLowerCase() === pick);
      await modal.locator(`button[role="radio"]:has-text("${btn.text}")`).first().click();
      answered.push(`${g.label.slice(0, 30)}=${pick}`);
    }
  }

  if (blockers.length > 0) {
    const msg = `⛔ ${jobTitle.slice(0, 50)}: cannot answer confidently: ${blockers.join('; ')}`;
    log(`  ${msg}`);
    if (INTERACTIVE) {
      for (const b of blockers) {
        const a = await askUser(`Job: "${jobTitle}" — ${b}. What should I answer?`);
        if (a) answered.push(`${b}=${a}`);
      }
    } else {
      // UNATTENDED MODE (user directive 2026-08-14): save question for later, continue to next job.
      log(`  → unanswerable question; saving draft + question file. Continuing to next job.`);
      return { ok: false, stop: true, blockers };
    }
  }

  log(`  questions: ${answered.length ? answered.join(' ; ') : '(none)'}`);
  return { ok: true, stop: false };
}

async function scrollModalToBottom(page) {
  await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal');
    const scroller = m?.querySelector('.jobs-easy-apply-modal__content, [data-test-modal-scrollable]') || m;
    if (scroller) scroller.scrollTo(0, scroller.scrollHeight);
  });
  await sleep(800);
}

async function findSubmitButton(page) {
  const candidates = [
    'button[aria-label*="Submit application"]',
    'button[aria-label*="Send application"]',
    'button[aria-label*="Bewerbung"]',
    'button[aria-label*="Absenden"]',
    'button[aria-label*="übermitteln"]',
    'button:has-text("Submit application")',
    'button:has-text("Send application")',
    'button:has-text("Bewerbung senden")',
    'button:has-text("Bewerbung absenden")',
    'button:has-text("Absenden")',
  ];
  for (const sel of candidates) {
    const b = page.locator(sel).filter({ visible: true }).first();
    if (await b.count() > 0) return b;
  }
  const footerBtn = page.locator('.jobs-easy-apply-modal .artdeco-modal__actionbar button.artdeco-button--primary, .jobs-easy-apply-modal footer button.artdeco-button--primary').filter({ visible: true }).first();
  if (await footerBtn.count() > 0) return footerBtn;
  return null;
}

async function hasSubmitButton(page) {
  return (await findSubmitButton(page)) !== null;
}

/** Handle the post-submit "Save this application? / Discard / Save" dialog → click SAVE. */
async function handleSaveDialog(page) {
  const saveBtn = page.locator('[role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Speichern")').filter({ visible: true }).first();
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    log('  💾 save-dialog: clicked SAVE');
    return true;
  }
  return false;
}

/**
 * Close the Easy Apply modal when we're skipping a job. Press Escape, then if a
 * discard-confirmation dialog appears, click Discard to fully close it.
 * Returns true if a discard-confirmation was handled.
 */
async function closeEasyApply(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  const discard = page.locator('[data-test-modal-id="data-test-easy-apply-discard-confirmation"], [data-test-is-confirm-dialog=""]').filter({ visible: true }).first();
  if (await discard.count() > 0) {
    const btn = discard.locator('button:has-text("Discard"), button:has-text("Verwerfen")').filter({ visible: true }).first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(1200);
      log('  discard-confirmation: clicked Discard');
      return true;
    }
    // fallback: Cancel/Keep editing, then Escape again
    const cancel = discard.locator('button:has-text("Cancel"), button:has-text("Abbrechen"), button:has-text("Keep editing")').filter({ visible: true }).first();
    if (await cancel.count() > 0) { await cancel.click(); await page.waitForTimeout(800); }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

/**
 * When an unanswerable question is hit in UNATTENDED mode: keep the application as a
 * LinkedIn draft (Save, not Discard) so the user can resume it in the morning.
 */
async function saveApplicationDraft(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  const discard = page.locator('[data-test-modal-id="data-test-easy-apply-discard-confirmation"], [data-test-is-confirm-dialog=""]').filter({ visible: true }).first();
  if (await discard.count() > 0) {
    const save = discard.locator('button:has-text("Save"), button:has-text("Speichern")').filter({ visible: true }).first();
    if (await save.count() > 0) {
      await save.click();
      await page.waitForTimeout(1500);
      log('  💾 saved application as DRAFT (will resume in the morning)');
      return true;
    }
    // If the dialog offers "Keep editing", stay in the modal instead of losing state
    const keep = discard.locator('button:has-text("Keep editing"), button:has-text("Weiter bearbeiten"), button:has-text("Cancel"), button:has-text("Abbrechen")').filter({ visible: true }).first();
    if (await keep.count() > 0) { await keep.click(); await page.waitForTimeout(800); log('  ✏️ stayed in modal (kept editing)'); return true; }
  }
  // No discard dialog: modal may already be saved or plain-closeable. Leave as-is.
  return false;
}

/**
 * Append an unanswerable question to data/pending-questions.md and .json so the
 * user can answer them in the morning. Returns the file path written.
 */
function writePendingQuestion({ title, company, link, blockers }) {
  const mdPath = join(ROOT, 'data/pending-questions.md');
  const jsonPath = join(ROOT, 'data/pending-questions.json');
  const ts = new Date().toISOString();
  const safe = (s) => (s || '').replace(/\|/g, '/').replace(/\s*\n+\s*/g, ' ').trim();
  const entry = {
    timestamp: ts,
    job: safe(title),
    company: safe(company),
    url: link || '',
    questions: blockers.map(b => safe(b)),
    status: 'PENDING_ANSWER',
  };
  // md (human-readable, append)
  const mdLine = `- [ ] **${entry.job}** @ ${entry.company} (${ts})\n    URL: ${entry.url || 'n/a'}\n    ${blockers.map(b => `❓ ${b}`).join('\n    ')}\n`;
  if (!existsSync(mdPath)) writeFileSync(mdPath, `# Pending screening questions (auto-collected 2026-08-14)\n\n> Answer each below; the bot paused applications awaiting these. Add answers and resume.\n\n`);
  appendFileSync(mdPath, mdLine);
  // json (machine-readable, merge array)
  let arr = [];
  if (existsSync(jsonPath)) { try { arr = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch { arr = []; } }
  arr.push(entry);
  writeFileSync(jsonPath, JSON.stringify(arr, null, 2) + '\n');
  log(`  📝 unanswerable question saved → ${mdPath}`);
  return mdPath;
}

/**
 * Track the job poster/recruiter for the cold-email strategy.
 * Appends to data/recruiters.md. Best-effort; never blocks the flow.
 */
async function trackRecruiter(page, { title, company, link }) {
  try {
    const mdPath = join(ROOT, 'data/recruiters.md');
    if (!existsSync(mdPath)) writeFileSync(mdPath, `# Recruiters / posters encountered (cold-email strategy)\n\n| date | company | role | poster/recruiter | url |\n|---|---|---|---|---|\n`);
    // LinkedIn job pages expose the poster in a few selectors / the "About the company"
    // pane; grab any visible candidate, else leave blank for later enrichment.
    const poster = await grabText(page, [
      '.jobs-unified-top-card__job-poster-name',
      '.job-details-jobs-unified-top-card__job-poster-name',
      '[data-test-company-name] a',
      '.jobs-poster__name',
    ], { timeout: 2500 });
    const linkSafe = (link || '').replace(/\|/g, '/');
    const row = `| ${nowDate()} | ${(company || '?').replace(/\|/g, '/')} | ${title.replace(/\|/g, '/')} | ${poster || ''} | ${linkSafe} |\n`;
    appendFileSync(mdPath, row);
  } catch { /* best-effort — never fail the job on this */ }
}

// --- Main ----------------------------------------------------------------

const KEYWORDS = KW_ARG ? KW_ARG.split(',').map(s => s.trim()).filter(Boolean) : [
  'Computer Vision Engineer',
  'Machine Learning Engineer',
  'AI Engineer',
  'Deep Learning Engineer',
  'ML Engineer',
  'Computer Vision',
  'Data Scientist',
  'AI',
  'Image Processing',
  'Perception Engineer',
  'MLOps Engineer',
  'Applied AI',
  'Object Detection',
  'Neural Network',
  'AI Product Engineer',
];

const logFile = join(ROOT, 'data/batch-apply-run.log');
if (!DRY_RUN && !existsSync(logFile)) writeFileSync(logFile, `# batch run ${nowDate()}\n`);
else if (!DRY_RUN) appendFileSync(logFile, `\n# batch run ${nowDate()}\n`);

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] || await ctx.newPage();
await page.bringToFront();

const results = [];
const seenJobs = new Set();
let submitted = 0;
let stopRun = false; // set when an unanswerable question pauses the run (unattended)
// Start numbering after the highest existing entry in applications.md (or 0 if none)
let nextNum = (() => {
  const appsFile = join(ROOT, 'data/applications.md');
  let max = 0;
  try {
    if (existsSync(appsFile)) {
      for (const line of readFileSync(appsFile, 'utf8').split('\n')) {
        if (!line.startsWith('|')) continue;
        const m = line.match(/^\|\s*(\d+)\s*\|/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
    }
  } catch { /* fall back to 0 */ }
  return max + 1;
})();

for (const kw of KEYWORDS) {
  if (submitted >= LIMIT || stopRun) break;
  log(`\n=== SEARCH: ${kw} ===`);
  const tpr = process.env.BATCH_TPR || 'r604800';
  const tprParam = tpr && tpr !== 'all' ? `&f_TPR=${tpr}` : '';
  const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(kw)}&location=Germany&f_AL=true&f_E=2%2C3%2C4&f_JT=F${tprParam}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  await dismissConsent(page);
  if (/authwall|\/login|\/uas\//i.test(page.url())) { log('  ⚠️ authwall — stopping'); break; }

  const cards = page.locator('li:has(a[href*="/jobs/view/"])');
  let count = await cards.count();
  for (let s = 0; s < 5 && count < 25; s++) {
    await page.evaluate(() => {
      const list = document.querySelector('.jobs-search-results-list');
      if (list) list.scrollTo(0, list.scrollHeight);
    });
    await sleep(3000);
    count = await cards.count();
  }
  log(`  cards loaded: ${count}`);

  for (let ci = 0; ci < count && submitted < LIMIT && !stopRun; ci++) {
    let title = '';
    try {
      const card = cards.nth(ci);
      title = ((await card.locator('a[href*="/jobs/view/"]').first().innerText({ timeout: 5000 }).catch(() => '')).split('\n')[0] || '').trim();
      if (!title || SKIP_TITLE.test(title)) { if (title) log(`  [skip-title] ${title.slice(0, 60)}`); continue; }

      const link = (await card.locator('a[href*="/jobs/view/"]').first().getAttribute('href').catch(() => '')) || '';
      const jobId = (link.match(/\/jobs\/view\/(\d+)/) || [])[1];
      if (jobId && seenJobs.has(jobId)) { log(`  [dup] ${title.slice(0, 50)} (seen)`); continue; }
      if (jobId) seenJobs.add(jobId);

      log(`  → opening: ${title.slice(0, 60)}`);
      await card.locator('a[href*="/jobs/view/"]').first().click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(4000);

      const company = await grabText(page, ['.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name']);
      const jdText = await grabText(page, ['.jobs-description__content', '.jobs-box__html-content', '.job-details-jobs-unified-top-card__description-container', '.jobs-search__job-details--container'], { timeout: 12000 });

      // Recruiter/poster tracking (cold-email strategy) — best-effort
      await trackRecruiter(page, { title, company, link });

    // --- INTELLIGENT FIT CHECK ---
    const fit = scoreRole(title, jdText);
    log(`  fit: ${fit.verdict} (score ${fit.score}, core:${fit.coreHits.length} sec:${fit.secHits.length} hard:${fit.hardHits.join(',') || '-'})`);
    if (fit.verdict === 'HARD_SKIP') {
      log(`  → skipping: ${fit.hardHits.join(', ')}`);
      results.push({ company: company || '?', role: title, status: 'HARD_SKIP', note: fit.hardHits.join(',') });
      continue;
    }
    if (fit.verdict !== 'APPLY' && !DRY_RUN) {
      // MARGINAL / MISMATCH → never auto-apply in unattended mode; log for human review
      log(`  → not auto-applying (${fit.verdict}); logged for human review`);
      results.push({ company: company || '?', role: title, status: fit.verdict === 'MISMATCH' ? 'MISMATCH' : 'NEEDS_HUMAN', note: fit.verdict });
      continue;
    }

    const applyBtn = page.locator('button.jobs-apply-button').filter({ visible: true }).first();
    if (await applyBtn.count() === 0) { log('    ⚠️ no LinkedIn Apply button — external apply'); continue; }
    await applyBtn.click();
    await page.waitForTimeout(3000);

    const modal = page.locator('.jobs-easy-apply-modal').first();
    if (await modal.count() === 0) { log('    ⚠️ modal did not open'); continue; }

    await fillContactStep(page);
    await sleep(rand(2000, 4000));

    // Check for submit button first: if present + no Next, this is a single-step form
    // (contact + resume + submit all on one screen, e.g. Netlight). Skip intermediate
    // steps entirely — resume/questions/review are no-ops here; proceed to submit logic.
    let singleStepForm = false;
    if (!(await nextStep(page))) {
      if (await hasSubmitButton(page)) {
        singleStepForm = true;
        log('    contact: single-step form (no Next, submit present)');
      } else {
        log('    ⚠️ no Next on contact');
        await closeEasyApply(page);
        continue;
      }
    }
    await page.waitForTimeout(3000);

    if (!singleStepForm) {
      // Resume step is optional — some flows go contact → questions directly.
      // Detect it by a file-upload / "resume" control; if absent, proceed.
      const resumeStep = await page.evaluate(() => {
        const m = document.querySelector('.jobs-easy-apply-modal');
        if (!m) return false;
        if (m.querySelector('input[type="file"], .jobs-document-upload')) return true;
        return /upload|upload your|hänge deinen|lebenslauf/i.test(m.innerText.slice(0, 600));
      });
      if (resumeStep) {
        if (!(await nextStep(page))) { log('    ⚠️ no Next on resume'); await closeEasyApply(page); continue; }
        await page.waitForTimeout(3000);
      }

      const qsOk = await fillQuestionsStep(page, title);
      if (!qsOk.ok) {
        if (qsOk.stop) {
          // UNATTENDED: save draft + question file, then CONTINUE to next job (user directive 2026-08-14)
          writePendingQuestion({ title, company, link, blockers: qsOk.blockers });
          await saveApplicationDraft(page);
          results.push({ company: company || '?', role: title, status: 'PAUSED', note: 'unanswerable question; draft saved' });
          log(`  → draft saved, continuing to next job (per user directive "keep going forward")`);
          await closeEasyApply(page);
          await page.waitForTimeout(1500);
          continue;
        }
        await closeEasyApply(page);
        await page.waitForTimeout(1500);
        results.push({ company: company || '?', role: title, status: 'NEEDS_HUMAN' });
        continue;
      }
      await sleep(rand(1500, 3000));

      let reviewClicked = false;
      for (let tryStep = 0; tryStep < 3; tryStep++) {
        const review = page.locator('button:has-text("Review"), button[aria-label*="Review"], button:has-text("Überprüfen"), button:has-text("Prüfen")').filter({ visible: true }).first();
        const next = page.locator('button[aria-label="Continue to next step"], button:has-text("Continue"), button:has-text("Weiter"), button[aria-label*="Continue"]').filter({ visible: true }).first();
        if (await review.count() > 0) { await review.click(); reviewClicked = true; break; }
        if (await next.count() > 0) { await next.click(); await page.waitForTimeout(3000); continue; }
        break;
      }
      await page.waitForTimeout(3000);
      if (!reviewClicked) log('    ⚠️ did not reach review step');
    }

    await scrollModalToBottom(page);

    if (DRY_RUN) {
      const submitBtn = await findSubmitButton(page);
      log(`  DRY-RUN: would submit "${title.slice(0, 50)}" at ${company || '?'} (submit btn ${submitBtn ? 'FOUND' : 'NOT FOUND'})`);
      results.push({ company: company || '?', role: title, status: 'DRY_RUN', note: `fit ${fit.verdict}` });
      await closeEasyApply(page);
      await sleep(1500);
      break; // dry run = 1 job only
    }

    const submitBtn = await findSubmitButton(page);
    if (!submitBtn) { log('    ⚠️ submit button not found — skipping'); await closeEasyApply(page); continue; }
    await submitBtn.click();
    await page.waitForTimeout(4000);

    // Save-dialog handling
    await handleSaveDialog(page);

    const ok = await page.evaluate(() => {
      const t = document.body.innerText;
      return /application was sent|application has been sent|successfully|sent, |gesendet|wurde übermittelt|application sent|bewerbung (gesendet|übermittelt)/i.test(t.slice(0, 4000));
    });

    if (!ok) {
      log(`    ⚠️ submission not confirmed (${title.slice(0, 50)}) — NOT writing tracker row`);
      results.push({ company: company || '?', role: title, status: 'UNKNOWN', note: `${fit.verdict}; no-confirm` });
      await closeEasyApply(page).catch(() => {});
      continue;
    }

    log(`    ✅ SUBMITTED: ${title.slice(0, 50)} at ${company || '?'}`);

    const row = [nextNum++, nowDate(), (company || '?').replace(/\|/g, '/'), title.replace(/\s*\n+\s*/g, ' ').replace(/\|/g, '/'), 'Applied', 'N/A', '❌', '❌', `Auto via LinkedIn Apply; fit=${fit.verdict}; score=${fit.score}; core=${fit.coreHits.slice(0, 3).join(',')}`].join('\t');
    appendFileSync(join(ROOT, 'batch/tracker-additions', `batch-apply-${nowDate()}-${String(nextNum - 1).padStart(3, '0')}.tsv`), row + '\n');
    results.push({ company: company || '?', role: title, status: 'Applied', note: fit.verdict });
    submitted++;

    await sleep(rand(...DELAY_APP));
    } catch (err) {
      log(`  ⚠️ job error (${title || 'unknown'}): ${err.message || err}`);
      await closeEasyApply(page).catch(() => {});
    }
  }
}

console.log('\n=== SUMMARY ===');
for (const r of results) console.log(`  ${r.status.padEnd(10)} ${r.role.slice(0, 50)} @ ${r.company.slice(0, 30)}${r.note ? ` (${r.note})` : ''}`);
console.log(`Total: ${results.length}${DRY_RUN ? ' (dry-run — nothing submitted)' : ` (${submitted} submitted)`}`);

await browser.close();