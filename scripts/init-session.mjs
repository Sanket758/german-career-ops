#!/usr/bin/env node
/**
 * Initialize or restore session state for Career-Ops Germany.
 *
 * Reads config/profile.yml, cv.md, and data/burn-list.tsv to generate
 * a compact session-state.json that agents can load in ~500 tokens
 * instead of re-reading all source files (~24k tokens).
 *
 * Usage:
 *   node scripts/init-session.mjs          # Create/refresh session
 *   node scripts/init-session.mjs --force  # Force recreation
 *   node scripts/init-session.mjs --check  # Check if session exists
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const SESSION_FILE = path.join(PROJECT_ROOT, 'data', 'session-state.json');
const PROFILE_FILE = path.join(PROJECT_ROOT, 'config', 'profile.yml');
const CV_FILE = path.join(PROJECT_ROOT, 'cv.md');
const BURN_LIST_FILE = path.join(PROJECT_ROOT, 'data', 'burn-list.tsv');
const APPS_FILE = path.join(PROJECT_ROOT, 'data', 'applications.md');
const KB_FILE = path.join(PROJECT_ROOT, 'data', 'knowledge-base.json');

/**
 * Parse a simple YAML file (handles basic key: value and nested structures).
 * @param {string} content - YAML file content.
 * @returns {object} Parsed object.
 */
function parseSimpleYaml(content) {
  const result = {};
  const lines = content.split('\n');
  let currentSection = null;
  let currentSubSection = null;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0 && trimmed.includes(':')) {
      // Top-level section
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      currentSection = key.trim();
      currentSubSection = null;
      if (value && !value.startsWith('#')) {
        result[currentSection] = value.replace(/^["']|["']$/g, '');
      } else {
        result[currentSection] = {};
      }
    } else if (indent === 2 && trimmed.includes(':') && currentSection) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      const cleanKey = key.trim();

      if (value && !value.startsWith('#')) {
        if (typeof result[currentSection] !== 'object') {
          result[currentSection] = {};
        }
        result[currentSection][cleanKey] = value.replace(/^["']|["']$/g, '');
        currentSubSection = cleanKey;
      } else {
        if (typeof result[currentSection] !== 'object') {
          result[currentSection] = {};
        }
        result[currentSection][cleanKey] = [];
        currentSubSection = cleanKey;
      }
    } else if (indent >= 4 && trimmed.startsWith('- ') && currentSection && currentSubSection) {
      const item = trimmed.slice(2).trim().replace(/^["']|["']$/g, '');
      const section = result[currentSection];
      if (section && Array.isArray(section[currentSubSection])) {
        section[currentSubSection].push(item);
      }
    }
  }

  return result;
}

/**
 * Load and parse burn list TSV.
 * @returns {string[]} Array of company names.
 */
function loadBurnList() {
  if (!fs.existsSync(BURN_LIST_FILE)) return [];

  return fs.readFileSync(BURN_LIST_FILE, 'utf8')
    .split('\n')
    .slice(1) // Skip header
    .map(line => line.split('\t')[0])
    .filter(Boolean);
}

/**
 * Count applications by status from applications.md.
 * @returns {object} Status counts and total.
 */
function countApplications() {
  if (!fs.existsSync(APPS_FILE)) {
    return { total: 0, by_status: {} };
  }

  const content = fs.readFileSync(APPS_FILE, 'utf8');
  const lines = content.split('\n');
  const counts = {};
  let total = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.includes('Company') || trimmed.includes('---')) {
      continue;
    }

    const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 6) {
      const status = parts[5].trim();
      if (status) {
        counts[status] = (counts[status] || 0) + 1;
        total++;
      }
    }
  }

  return { total, by_status: counts };
}

/**
 * Extract a summary from cv.md content.
 * @param {string} cvContent - Raw CV markdown.
 * @returns {object} CV summary object.
 */
function extractCVSummary(cvContent) {
  // Check if CV has actual content
  if (cvContent.includes('This file is populated during onboarding')) {
    return {
      populated: false,
      note: 'CV not yet populated — run onboarding first'
    };
  }

  const headings = [...cvContent.matchAll(/^#{1,3}\s+(.+)$/gm)]
    .map(m => m[1].trim())
    .slice(0, 12);
  const skillsSection = extractSection(cvContent, /skills|kenntnisse|technical/i);
  const experienceSection = extractSection(cvContent, /experience|berufserfahrung|work/i);
  const educationSection = extractSection(cvContent, /education|ausbildung/i);
  const coreSkills = extractKeywords(skillsSection || cvContent, [
    'Computer Vision', 'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow',
    'YOLOv5', 'YOLOv8', 'Detectron2', 'OpenCV', 'FastAPI', 'Docker', 'GCP',
    'Google Cloud', 'ROS2', 'Gazebo', 'ONNX', 'NLP', 'LLM', 'RAG', 'Terraform'
  ]);
  const companies = [...experienceSection.matchAll(/^#{3}\s+(.+?)\s+[—-]\s+/gm)]
    .map(m => m[1].trim())
    .filter(Boolean)
    .slice(0, 8);
  const thesisMatch = educationSection.match(/thesis[:\s-]+(.+)/i);

  return {
    populated: true,
    headings,
    years_experience: inferYearsExperience(experienceSection || cvContent),
    core_skills: coreSkills,
    companies,
    thesis: thesisMatch ? thesisMatch[1].trim() : ''
  };
}

function extractSection(content, headingPattern) {
  const lines = content.split('\n');
  let start = -1;
  let headingLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,3})\s+(.+)$/);
    if (match && headingPattern.test(match[2])) {
      headingLevel = match[1].length;
      start = i + 1;
      break;
    }
  }
  if (start === -1) return '';

  const section = [];
  for (let i = start; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,3})\s+/);
    if (match && match[1].length <= headingLevel) break;
    section.push(lines[i]);
  }
  return section.join('\n');
}

function extractKeywords(text, candidates) {
  const lower = text.toLowerCase();
  return candidates.filter(k => lower.includes(k.toLowerCase())).slice(0, 12);
}

function inferYearsExperience(content) {
  const years = [...content.matchAll(/\b(20\d{2})\b/g)].map(m => Number(m[1]));
  if (years.length === 0) return null;
  const earliest = Math.min(...years.filter(y => y <= new Date().getFullYear()));
  return Math.max(0, new Date().getFullYear() - earliest);
}

/**
 * Main session initialization function.
 */
function initSession(force = false) {
  // Check if session already exists
  if (fs.existsSync(SESSION_FILE) && !force) {
    const existing = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    console.log(`✅ Session already exists (ID: ${existing.session_id})`);
    console.log(`   Created: ${existing.created}`);
    console.log(`   Use --force to recreate.`);
    return existing;
  }

  console.log('🔄 Initializing session...');

  // Load profile
  let profile = {};
  if (fs.existsSync(PROFILE_FILE)) {
    const profileContent = fs.readFileSync(PROFILE_FILE, 'utf8');
    profile = parseSimpleYaml(profileContent);
    console.log('  ✓ Profile loaded');
  } else {
    console.log('  ⚠ Profile not found — using defaults');
  }

  // Load burn list
  const burnedCompanies = loadBurnList();
  console.log(`  ✓ Burn list loaded (${burnedCompanies.length} companies)`);

  // Load CV summary
  let cvSummary = { populated: false };
  if (fs.existsSync(CV_FILE)) {
    const cvContent = fs.readFileSync(CV_FILE, 'utf8');
    cvSummary = extractCVSummary(cvContent);
    console.log(`  ✓ CV loaded (populated: ${cvSummary.populated})`);
  }

  // Count applications
  const appStats = countApplications();
  console.log(`  ✓ Tracker loaded (${appStats.total} applications)`);

  // Load knowledge base version
  let kbVersion = null;
  if (fs.existsSync(KB_FILE)) {
    const kb = JSON.parse(fs.readFileSync(KB_FILE, 'utf8'));
    kbVersion = kb.version || '1.0';
    console.log(`  ✓ Knowledge base v${kbVersion} available`);
  }

  // Build session state
  const session = {
    session_id: new Date().toISOString().slice(0, 16).replace(/[-:T]/g, ''),
    created: new Date().toISOString(),
    initialized: true,
    knowledge_base_version: kbVersion,
    user: {
      name: profile.candidate?.full_name || profile.candidate?.name || '',
      location: profile.candidate?.location || 'Berlin',
      visa: profile.visa?.type || '§16b student residence permit',
      hours_per_week: parseInt(profile.visa?.hours_per_week) || 20,
      german_level: profile.languages?.german || 'A2.1',
      german_target: profile.languages?.german_target || 'B1',
      target_roles: profile.target_roles?.primary || [
        'Machine Learning Engineer (Werkstudent)',
        'Computer Vision Engineer (Werkstudent)',
        'Robotics AI Engineer (Werkstudent)',
        'Working Student AI/ML'
      ],
      burned_companies: burnedCompanies
    },
    cv_summary: cvSummary,
    stats: {
      last_scan: null,
      pending_applications: appStats.by_status['Applied'] || 0,
      total_evaluations: appStats.total,
      total_applications: appStats.by_status['Applied'] || 0,
      application_breakdown: appStats.by_status
    },
    recent_activity: []
  };

  session.sources = Object.fromEntries(
    [PROFILE_FILE, CV_FILE, BURN_LIST_FILE, APPS_FILE, KB_FILE]
      .filter(file => fs.existsSync(file))
      .map(file => [path.relative(PROJECT_ROOT, file), fs.statSync(file).mtime.toISOString()])
  );

  // Write session file
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  console.log(`\n✅ Session initialized: ${SESSION_FILE}`);
  console.log(`   Session ID: ${session.session_id}`);

  return session;
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--check')) {
  if (fs.existsSync(SESSION_FILE)) {
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    console.log(JSON.stringify({ exists: true, session_id: session.session_id }));
  } else {
    console.log(JSON.stringify({ exists: false }));
  }
} else {
  const force = args.includes('--force');
  initSession(force);
}
