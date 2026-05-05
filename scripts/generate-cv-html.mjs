#!/usr/bin/env node
/**
 * generate-cv-html.mjs — The Missing Pipeline Piece
 *
 * Converts cv.md + config/profile.yml → filled temp/*.html
 * using templates/cv-template.html as the layout.
 *
 * This script is what the AI agent was doing manually — it is now
 * deterministic, repeatable, and produces consistent output.
 *
 * Usage:
 *   node generate-cv-html.mjs --company=TwinCloud
 *   node generate-cv-html.mjs --company=DataSpree --role="ML Engineer" --lang=de
 *   node generate-cv-html.mjs --company=Helsing --lang=de --include-projects
 *   node generate-cv-html.mjs --company=Startup --role="CV Engineer" --lang=en --output=temp/my-cv.html
 *
 * Flags:
 *   --company=NAME          Company name (used in output filename and for context)
 *   --role=TITLE            Target role title (optional, for summary tuning)
 *   --lang=de|en            Output language for section headers (default: de)
 *   --include-projects      Include AKADEMISCHE PROJEKTE section (for research/robotics roles)
 *   --max-bullets=N         Max bullets per job (default: 3, German standard)
 *   --output=PATH           Override output path (default: temp/cv-{company}-{date}.html)
 *   --photo=PATH            Path to photo image (default: data/Bewerbungsfoto.jpg)
 *
 * Output: temp/cv-{company}-YYYY-MM-DD.html
 *   → Ready to pipe into: node generate-pdf.mjs temp/cv-TwinCloud-2026-05-01.html output/cv-TwinCloud-2026-05-01.pdf
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { load as loadYaml } from 'js-yaml';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ─── Section label translations ─────────────────────────────────────────────

const LABELS = {
  de: {
    summary:    'BERUFLICHER SCHWERPUNKT',
    experience: 'BERUFSERFAHRUNG',
    education:  'AUSBILDUNG',
    skills:     'KENNTNISSE',
    langcert:   'SPRACHEN & ZERTIFIKATE',
    projects:   'AKADEMISCHE PROJEKTE',
    languages:  'Sprachen',
    certs:      'Zertifikate',
  },
  en: {
    summary:    'PROFESSIONAL SUMMARY',
    experience: 'WORK EXPERIENCE',
    education:  'EDUCATION',
    skills:     'SKILLS',
    langcert:   'LANGUAGES & CERTIFICATIONS',
    projects:   'ACADEMIC PROJECTS',
    languages:  'Languages',
    certs:      'Certifications',
  },
};

// ─── CLI argument parser ─────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    company: '',
    role: '',
    lang: 'de',
    includeProjects: false,
    maxBullets: 3,
    output: '',
    photo: '',
  };

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    const value = rest.join('=');

    switch (key) {
      case 'company':          args.company = value; break;
      case 'role':             args.role = value; break;
      case 'lang':             args.lang = value === 'en' ? 'en' : 'de'; break;
      case 'include-projects': args.includeProjects = true; break;
      case 'max-bullets':      args.maxBullets = parseInt(value, 10) || 3; break;
      case 'output':           args.output = value; break;
      case 'photo':            args.photo = value; break;
    }
  }

  if (!args.company) {
    console.error('❌  --company is required\n');
    console.error('Usage: node generate-cv-html.mjs --company=TwinCloud [--role="ML Engineer"] [--lang=de] [--include-projects]');
    process.exit(1);
  }

  return args;
}

// ─── Load profile.yml ────────────────────────────────────────────────────────

function loadProfile() {
  const p = path.resolve(__dirname, 'config/profile.yml');
  if (!fs.existsSync(p)) {
    console.error(`❌  config/profile.yml not found at ${p}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(p, 'utf-8');
  const parsed = loadYaml(raw);
  return parsed.candidate || {};
}

// ─── Load and parse cv.md sections ──────────────────────────────────────────

function loadCV() {
  const p = path.resolve(__dirname, 'cv.md');
  if (!fs.existsSync(p)) {
    console.error(`❌  cv.md not found at ${p}`);
    process.exit(1);
  }
  return fs.readFileSync(p, 'utf-8');
}

/**
 * Split cv.md into named sections by ## headings.
 * Returns a map of { sectionName: raw content string }
 */
function parseCVSections(md) {
  const sections = {};
  let currentSection = '_preamble';
  const lines = md.split('\n');
  const buffer = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (buffer.length > 0) {
        sections[currentSection] = buffer.join('\n').trim();
        buffer.length = 0;
      }
      currentSection = line.slice(3).trim();
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length > 0) {
    sections[currentSection] = buffer.join('\n').trim();
  }

  return sections;
}

/**
 * Parse a section containing ### subsections (jobs, schools, projects).
 * Returns array of { heading, content } objects.
 */
function parseSubsections(text) {
  const entries = [];
  let currentHeading = null;
  const buffer = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (currentHeading !== null) {
        entries.push({ heading: currentHeading, content: buffer.join('\n').trim() });
        buffer.length = 0;
      }
      currentHeading = line.slice(4).trim();
    } else {
      buffer.push(line);
    }
  }

  if (currentHeading !== null && buffer.length > 0) {
    entries.push({ heading: currentHeading, content: buffer.join('\n').trim() });
  }

  return entries;
}

/**
 * Extract bullet points from a markdown block.
 * Strips bold labels like "**Computer Vision:**" from bullet starts.
 */
function extractBullets(text) {
  return text.split('\n')
    .filter(l => l.trim().startsWith('- '))
    .map(l => l.trim().slice(2).replace(/^\*\*[^:]+:\*\*\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Extract metadata lines (non-bullet, non-blank) from a job/edu block.
 * Returns { role, period, location, desc }
 */
function extractJobMeta(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const nonBullets = lines.filter(l => !l.startsWith('-'));

  // Role is typically **bold** on first non-blank line
  const roleLine = nonBullets.find(l => l.startsWith('**'));
  const role = roleLine
    ? roleLine.replace(/\*\*/g, '').replace(/\|.*$/, '').trim()
    : nonBullets[0] || '';

  // Period: looks like "Oct 2021 - Sep 2024"
  const periodLine = nonBullets.find(l => /\d{4}/.test(l) && /-/.test(l));
  const period = periodLine ? periodLine.replace(/\*\*/g, '').trim() : '';

  // Location embedded in role line after |
  const locationMatch = (roleLine || '').match(/\|\s*(.+)$/);
  const location = locationMatch ? locationMatch[1].trim() : '';

  return { role, period, location };
}

// ─── HTML builders ───────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the EXPERIENCE HTML from cv.md Work Experience section.
 * Limits bullets to maxBullets per job (default 3 — German standard).
 */
function buildExperienceHTML(cvSections, maxBullets = 3) {
  const raw = cvSections['Work Experience'] || '';
  const jobs = parseSubsections(raw);
  let html = '';

  for (const job of jobs) {
    // Parse heading: "Company — Location"
    const headingParts = job.heading.split('—').map(s => s.trim());
    const company = escapeHtml(headingParts[0] || '');

    const meta = extractJobMeta(job.content);
    const bullets = extractBullets(job.content).slice(0, maxBullets);

    // Format period: convert "Oct 2021 - Sep 2024" → "10.2021 – 09.2024"
    const period = formatPeriod(meta.period);
    const roleDisplay = meta.location
      ? `${escapeHtml(meta.role)} | ${escapeHtml(meta.location)}`
      : escapeHtml(meta.role);

    const bulletHTML = bullets.map(b => `        <li>${escapeHtml(b)}</li>`).join('\n');

    html += `
    <div class="job">
      <div class="job-header">
        <div class="job-company">${company}</div>
        <div class="job-period">${period}</div>
      </div>
      <div class="job-role">${roleDisplay}</div>
      <ul>
${bulletHTML}
      </ul>
    </div>`;
  }

  return html.trim();
}

/**
 * Build the EDUCATION HTML from cv.md Education section.
 */
function buildEducationHTML(cvSections) {
  const raw = cvSections['Education'] || '';
  const entries = parseSubsections(raw);
  let html = '';

  for (const entry of entries) {
    // Heading: "School — Location"
    const headingParts = entry.heading.split('—').map(s => s.trim());
    const school = escapeHtml(headingParts[0] || '');

    const lines = entry.content.split('\n').map(l => l.trim()).filter(Boolean);
    const boldLine = lines.find(l => l.startsWith('**'));
    const degree = boldLine
      ? escapeHtml(boldLine.replace(/\*\*/g, '').trim())
      : '';

    const periodLine = lines.find(l => /\d{4}/.test(l) && /-/.test(l) && !l.startsWith('-'));
    const period = formatPeriod(periodLine || '');

    // Desc lines: bullet points or non-bold non-period lines
    const descBullets = extractBullets(entry.content).slice(0, 2);
    const desc = descBullets.length > 0
      ? descBullets.map(b => escapeHtml(b)).join(' · ')
      : '';

    html += `
    <div class="edu-item">
      <div class="edu-header">
        <div class="edu-org">${school}</div>
        <div class="edu-year">${period}</div>
      </div>
      <div class="edu-degree">${degree}</div>
      ${desc ? `<div class="edu-desc">${desc}</div>` : ''}
    </div>`;
  }

  return html.trim();
}

/**
 * Build the SKILLS HTML.
 * Curated to 5-6 categories, 4-5 items each (German standard: 15-20 total).
 *
 * Edit the CURATED_SKILLS map below to control exactly what appears.
 * This is intentionally hardcoded — it's a deliberate editorial choice,
 * not something that should be inferred from the full cv.md skills dump.
 */
function buildSkillsHTML() {
  // ── Edit this map for each application variant ───────────────────────────
  // Keep to 5-6 rows. Each row: max 5 items. Total items: 15-20 max.
  const CURATED_SKILLS = [
    { cat: 'ML / DL',         vals: 'PyTorch, TensorFlow, YOLOv5/v8, Detectron2, ONNX' },
    { cat: 'Computer Vision', vals: 'OpenCV, Object Detection, Segmentation, Edge Inference' },
    { cat: 'Robotik',         vals: 'ROS2 (Jazzy/Humble), Gazebo, LIDAR, Sensor Fusion' },
    { cat: 'Cloud / MLOps',   vals: 'GCP Cloud Run, Docker, Terraform, GitHub Actions' },
    { cat: 'Programmierung',  vals: 'Python (4+ J.), C/C++, FastAPI, JavaScript' },
    { cat: 'Daten',           vals: 'MongoDB, ETL Pipelines, Firebase, SQLite3' },
  ];
  // ─────────────────────────────────────────────────────────────────────────

  return CURATED_SKILLS
    .map(row => `
    <div class="skill-row">
      <span class="skill-cat">${escapeHtml(row.cat)}:</span>
      <span class="skill-vals">${escapeHtml(row.vals)}</span>
    </div>`)
    .join('');
}

/**
 * Build the LANGUAGES & CERTIFICATIONS HTML.
 */
function buildLangCertHTML(cvSections, lang = 'de') {
  const labels = LABELS[lang];
  const raw = cvSections['Languages & Certifications'] || '';
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  const langLine = lines.find(l => l.startsWith('- **Languages:**'));
  const certLine = lines.find(l => l.startsWith('- **Certifications:**'));

  const languages = langLine
    ? langLine.replace('- **Languages:**', '').trim().split(',').map(l => l.trim())
    : [];

  const certs = certLine
    ? certLine.replace('- **Certifications:**', '').trim().split(',').map(c => c.trim())
    : [];

  const langHTML = languages
    .map(l => `<div class="lang-item">${escapeHtml(l)}</div>`)
    .join('');

  const certHTML = certs
    .slice(0, 3) // max 3 certs to keep compact
    .map(c => `<div class="cert-item">${escapeHtml(c)}</div>`)
    .join('');

  return `
    <div class="lang-cert-grid">
      <div class="lang-col">
        <div class="subsection-label">${labels.languages}</div>
        ${langHTML}
      </div>
      <div class="cert-col">
        <div class="subsection-label">${labels.certs}</div>
        ${certHTML}
      </div>
    </div>`;
}

/**
 * Build the ACADEMIC PROJECTS HTML (optional section).
 */
function buildProjectsHTML(cvSections, lang = 'de') {
  const raw = cvSections['Academic Work'] || '';
  const bullets = extractBullets(raw).slice(0, 2); // top 2 projects only

  if (bullets.length === 0) return '';

  return bullets.map(b => {
    // Project bullet format: "**Title (Tech):** Description"
    const titleMatch = b.match(/^\*\*(.+?)\*\*:?\s*(.*)/);
    if (titleMatch) {
      return `
    <div class="project">
      <div class="project-title">${escapeHtml(titleMatch[1])}</div>
      <div class="project-desc">${escapeHtml(titleMatch[2])}</div>
    </div>`;
    }
    return `
    <div class="project">
      <div class="project-desc">${escapeHtml(b)}</div>
    </div>`;
  }).join('');
}

// ─── Period formatter ────────────────────────────────────────────────────────

/**
 * Convert English period strings to German MM.YYYY format.
 * "Oct 2021 - Sep 2024" → "10.2021 – 09.2024"
 * "Feb 2025 - Aug 2026" → "02.2025 – 08.2026"
 */
function formatPeriod(period) {
  if (!period) return '';

  const MONTHS = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };

  // Also handle German month abbreviations just in case
  const DE_MONTHS = {
    'Jan.': '01', 'Feb.': '02', 'Mär.': '03', 'Apr.': '04', 'Mai': '05', 'Jun.': '06',
    'Jul.': '07', 'Aug.': '08', 'Sep.': '09', 'Okt.': '10', 'Nov.': '11', 'Dez.': '12',
  };

  const convertPart = (part) => {
    const p = part.trim();
    // Already numeric format: 02.2025 or 2025
    if (/^\d{2}\.\d{4}$/.test(p)) return p;
    // English: "Oct 2021"
    const match = p.match(/^([A-Za-z]{3,4}\.?)\s+(\d{4})$/);
    if (match) {
      const m = MONTHS[match[1]] || DE_MONTHS[match[1]] || '??';
      return `${m}.${match[2]}`;
    }
    return p;
  };

  // Split on " - " or " – "
  const separator = period.includes('–') ? '–' : '-';
  const parts = period.split(/\s*[–-]\s*/);

  if (parts.length === 2) {
    return `${convertPart(parts[0])} – ${convertPart(parts[1])}`;
  }

  return period;
}

// ─── Photo handler ──────────────────────────────────────────────────────────

/**
 * Load photo as base64 data URL, or return placeholder HTML.
 * Using base64 inline ensures fonts+images always render correctly in Playwright,
 * regardless of file:// path resolution.
 */
function buildPhotoHTML(photoPath) {
  if (!photoPath) {
    photoPath = path.resolve(__dirname, 'data/Bewerbungsfoto.jpg');
  } else if (!path.isAbsolute(photoPath)) {
    photoPath = path.resolve(__dirname, photoPath);
  }

  if (fs.existsSync(photoPath)) {
    const ext = path.extname(photoPath).slice(1).toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    const data = fs.readFileSync(photoPath).toString('base64');
    return `<img src="data:${mime};base64,${data}" alt="Bewerbungsfoto">`;
  }

  // Placeholder — renders the dashed box from the template
  return `<div class="photo-placeholder">Bewerbungsfoto<br>35 × 45 mm</div>`;
}

// ─── Personal data builder ───────────────────────────────────────────────────

function buildPersonalData(profile, lang = 'de') {
  const dob = profile.date_of_birth || '';
  const pob = profile.place_of_birth || '';
  const nat = profile.nationality || '';

  if (lang === 'de') {
    const parts = [];
    if (dob) parts.push(`Geb.: ${dob}`);
    if (pob) parts.push(`in ${pob}`);
    if (nat) parts.push(`Staatsangehörigkeit: ${nat}`);
    return parts.map(p => `<span>${escapeHtml(p)}</span>`).join('<span class="sep"> | </span>');
  } else {
    const parts = [];
    if (dob) parts.push(`DOB: ${dob}`);
    if (pob) parts.push(`POB: ${pob}`);
    if (nat) parts.push(`Nationality: ${nat}`);
    return parts.map(p => `<span>${escapeHtml(p)}</span>`).join('<span class="sep"> | </span>');
  }
}

// ─── Visa badge builder ──────────────────────────────────────────────────────

function buildVisaStatus(profile, lang = 'de') {
  // Read from profile.yml location.visa_status or fallback
  const raw = fs.existsSync(path.resolve(__dirname, 'config/profile.yml'))
    ? (() => {
        const yaml = loadYaml(fs.readFileSync(path.resolve(__dirname, 'config/profile.yml'), 'utf-8'));
        return yaml?.location?.visa_status || '';
      })()
    : '';

  if (raw) return escapeHtml(raw);

  // Fallback
  return lang === 'de'
    ? '§16b AufenthG — 20h/Woche Werkstudent'
    : '§16b student permit — 20h/week eligible';
}

// ─── Summary builder ─────────────────────────────────────────────────────────

function buildSummary(cvSections) {
  const raw = cvSections['Professional Summary'] || '';
  // Take first 2 sentences of the summary (KISS principle)
  const sentences = raw.split(/(?<=[.!?])\s+/);
  const short = sentences.slice(0, 2).join(' ').trim();
  return escapeHtml(short);
}

function buildTechStack(lang = 'de') {
  // Curated tech stack for the summary line
  // Edit this per-application if needed
  const stack = 'Python, PyTorch, OpenCV, ROS2, Docker, FastAPI';
  return lang === 'de'
    ? `<strong>Technologien:</strong> ${escapeHtml(stack)}`
    : `<strong>Tech:</strong> ${escapeHtml(stack)}`;
}

// ─── Date formatter ──────────────────────────────────────────────────────────

function germanDate(date = new Date()) {
  const MONTHS_DE = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
  ];
  return `${date.getDate()}. ${MONTHS_DE[date.getMonth()]} ${date.getFullYear()}`;
}

// ─── Font path resolver ──────────────────────────────────────────────────────

/**
 * Resolve all ./fonts/ references to absolute file:// URLs.
 * This is the critical fix — Playwright's page.setContent() has no base URL
 * unless explicitly provided. By embedding absolute paths in the HTML,
 * fonts load reliably regardless of how the page is loaded.
 */
function resolveFontPaths(html, fontsDir) {
  return html.replace(
    /url\(['"']?\.\/fonts\//g,
    `url('file://${fontsDir.replace(/\\/g, '/')}/`
  );
}

// ─── Projects block ──────────────────────────────────────────────────────────

function buildProjectsBlock(cvSections, lang, includeProjects) {
  if (!includeProjects) return ''; // Remove the entire block

  const labels = LABELS[lang];
  const projectsHTML = buildProjectsHTML(cvSections, lang);

  if (!projectsHTML.trim()) return '';

  return `
  <div class="section avoid-break">
    <div class="section-title">${labels.projects}</div>
    ${projectsHTML}
  </div>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const labels = LABELS[args.lang];

  console.log(`\n📄 generate-cv-html.mjs`);
  console.log(`   Company:  ${args.company}`);
  console.log(`   Role:     ${args.role || '(not specified)'}`);
  console.log(`   Language: ${args.lang}`);
  console.log(`   Projects: ${args.includeProjects ? 'included' : 'excluded'}`);
  console.log(`   Bullets:  max ${args.maxBullets} per job\n`);

  // ── Load sources ────────────────────────────────────────────────────────
  const profile = loadProfile();
  const cvMarkdown = loadCV();
  const cvSections = parseCVSections(cvMarkdown);

  // ── Load template ────────────────────────────────────────────────────────
  const templatePath = path.resolve(__dirname, 'templates/cv-template.html');
  if (!fs.existsSync(templatePath)) {
    console.error(`❌  Template not found: ${templatePath}`);
    console.error(`    Expected at: templates/cv-template.html`);
    process.exit(1);
  }
  let html = fs.readFileSync(templatePath, 'utf-8');

  // ── Build content ────────────────────────────────────────────────────────
  const fontsDir = path.resolve(__dirname, 'fonts');

  const replacements = {
    '{{LANG}}':              args.lang,
    '{{NAME}}':              escapeHtml(profile.full_name || 'Name'),
    '{{EMAIL}}':             escapeHtml(profile.email || ''),
    '{{PHONE}}':             escapeHtml(profile.phone || ''),
    '{{LINKEDIN_URL}}':      `https://${profile.linkedin || ''}`,
    '{{LINKEDIN_DISPLAY}}':  escapeHtml(profile.linkedin || ''),
    '{{GITHUB_URL}}':        `https://${profile.github || ''}`,
    '{{GITHUB_DISPLAY}}':    escapeHtml(profile.github || ''),
    '{{PERSONAL_DATA}}':     buildPersonalData(profile, args.lang),
    '{{VISA_STATUS}}':       buildVisaStatus(profile, args.lang),
    '{{PHOTO}}':             buildPhotoHTML(args.photo || profile.photo_path || ''),

    '{{SECTION_SUMMARY}}':   labels.summary,
    '{{SUMMARY_TEXT}}':      buildSummary(cvSections),
    '{{SUMMARY_TECH}}':      buildTechStack(args.lang),

    '{{SECTION_EXPERIENCE}}': labels.experience,
    '{{EXPERIENCE}}':         buildExperienceHTML(cvSections, args.maxBullets),

    '{{SECTION_EDUCATION}}':  labels.education,
    '{{EDUCATION}}':          buildEducationHTML(cvSections),

    '{{SECTION_SKILLS}}':     labels.skills,
    '{{SKILLS}}':             buildSkillsHTML(),

    '{{SECTION_LANG_CERT}}':  labels.langcert,
    '{{LANG_CERT}}':          buildLangCertHTML(cvSections, args.lang),

    '{{PROJECTS_BLOCK}}':     buildProjectsBlock(cvSections, args.lang, args.includeProjects),

    '{{SIGNATURE_LOCATION}}': escapeHtml(profile.city || 'Berlin'),
    '{{SIGNATURE_DATE}}':     germanDate(),
  };

  // Apply all replacements
  for (const [placeholder, value] of Object.entries(replacements)) {
    html = html.replaceAll(placeholder, value);
  }

  // Resolve fonts to absolute file:// paths (critical for Playwright rendering)
  html = resolveFontPaths(html, fontsDir);

  // ── Determine output path ────────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  const slug = args.company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const defaultOutput = path.resolve(__dirname, `temp/cv-${slug}-${dateStr}.html`);
  const outputPath = args.output
    ? (path.isAbsolute(args.output) ? args.output : path.resolve(__dirname, args.output))
    : defaultOutput;

  // Ensure temp/ directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf-8');

  const relPath = path.relative(process.cwd(), outputPath);
  console.log(`✅  HTML written: ${relPath}`);
  console.log(`\n   Next step:`);
  console.log(`   node scripts/generate-pdf.mjs ${relPath} output/cv-${slug}-${dateStr}.pdf --max-pages=1 --type=cv`);
  console.log('');
}

main().catch((err) => {
  console.error('❌  Failed:', err.message);
  process.exit(1);
});
