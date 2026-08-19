#!/usr/bin/env node
/**
 * Shared German CV data parser and HTML renderer.
 * The output is deliberately curated so the Lebenslauf stays readable in two A4 pages.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const TEMPLATE_PATH = join(PROJECT_ROOT, 'templates', 'cv-template-german.html');
const CV_PATH = join(PROJECT_ROOT, 'cv.md');
const PROFILE_PATH = join(PROJECT_ROOT, 'config', 'profile.yml');
const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  'Jan.': '01', 'Feb.': '02', 'Mär.': '03', 'Apr.': '04', 'Mai': '05', 'Jun.': '06',
  'Jul.': '07', 'Aug.': '08', 'Sep.': '09', 'Okt.': '10', 'Nov.': '11', 'Dez.': '12',
};

const LABELS = {
  de: {
    summary: 'KURZPROFIL',
    experience: 'BERUFSERFAHRUNG',
    education: 'AUSBILDUNG',
    skills: 'TECHNISCHE KOMPETENZEN',
    projects: 'AUSGEWÄHLTE PROJEKTE',
    languages: 'SPRACHEN & ZERTIFIKATE',
    language: 'Sprachen',
    certifications: 'Zertifikate',
    today: 'Heute',
    photo: 'Foto',
    photoHint: 'Professionelles Bewerbungsfoto',
    visa: 'Uneingeschränkt vollzeitbeschäftigbar ab 28.08.2026 · kein Arbeitgeber-Sponsoring nötig',
  },
  en: {
    summary: 'PROFESSIONAL SUMMARY',
    experience: 'WORK EXPERIENCE',
    education: 'EDUCATION',
    skills: 'TECHNICAL SKILLS',
    projects: 'SELECTED PROJECTS',
    languages: 'LANGUAGES & CERTIFICATIONS',
    language: 'Languages',
    certifications: 'Certifications',
    today: 'Present',
    photo: 'Photo',
    photoHint: 'Professional application photo',
    visa: 'Full-time work authorization from 28 Aug 2026 · no employer sponsorship required',
  },
};

const GERMAN_HEADLINE = 'Computer-Vision-Ingenieur — MSc Künstliche Intelligenz in Berlin · ca. 4 Jahre Produktionserfahrung in CV/NLP · Masterarbeit zur Regalüberwachung im deutschen Einzelhandel';
const GERMAN_SUMMARY = 'AI/ML Engineer mit über 4 Jahren Erfahrung in der Entwicklung und dem produktiven Betrieb von Computer-Vision- und NLP-Systemen (Python, PyTorch, TensorFlow, Transformers). Erfahrung mit transformer-basierten LLMs (Mistral 7B) für NLU-gestützte Datenextraktion sowie mit GenAI-Prototypen auf Basis von FAISS-Embeddings und Prompt Engineering.';
const GERMAN_LOCATION = 'Berlin, Deutschland (deutschlandweit umzugsbereit)';

const GERMAN_EXPERIENCE = {
  'Generation iTrust e.V.': {
    role: 'Backend- und DevOps-Ingenieur (ehrenamtlich, KlimaNeustart-Klimainitiative)',
    bullets: [
      'Web-App „Bürger:innen-Dialog“ für Klimagespräche mit Express.js und MongoDB entwickelt; funktionsfähigen MVP innerhalb von zwei Wochen und stabile, produktiv eingesetzte Version bis 31.08.2025 ausgeliefert.',
      'DSGVO-Konformität durch getrennte Speicherung sowie Hashing und Verschlüsselung personenbezogener Daten (PII) sichergestellt.',
      'Full-Stack-Pipeline mit MongoDB, Frontend auf Vercel und Backend auf Render bereitgestellt sowie Tests nach dem Deployment und Performance-Tests durchgeführt.',
    ],
  },
  'Big Rattle Technologies PVT LTD': {
    role: 'Senior AI/ML-Ingenieur — Teamleiter AI Operations (innerhalb des ersten Jahres befördert)',
    bullets: [
      'Generative-AI-Prototyp für Werbekampagnen von Kellogg’s mit FAISS-Embeddings und Prompt Engineering entwickelt; Austausch kreativer Inhalte um 40% beschleunigt. Transformer-basiertes Mistral-7B-LLM für NLU-gestützte Extraktion aus 5+ regulatorischen Quellen integriert.',
      'Team von 4 Personen zur Entwicklung von YOLOv5- und Detectron2-Regalüberwachung für Colgate-Palmolive und Dabur geleitet: 95%+ Erkennungsgenauigkeit für 500+ SKUs und 60% weniger manuelle Audits.',
      'Inferenzlatenz durch Python-Multiprocessing über 4 GPU-beschleunigte Worker um 50% reduziert und dadurch Analysen nahezu in Echtzeit ermöglicht.',
    ],
  },
  'EAZR DIGIPAYMENTS PVT LTD': {
    role: 'Engineer für Künstliche Intelligenz / Maschinelles Lernen',
    bullets: [
      'OCR-Pipelines zur PAN-/Aadhaar-Verifizierung mit OpenCV entwickelt und die Verarbeitung auf wenige Sekunden reduziert; Video-KYC mit Liveness-Erkennung umgesetzt und Fehlerrate um 30% gesenkt.',
      'Kredit-Scoring-Engine mit Geräte-Metadaten sowie SMS-Klassifikator mit spaCy entwickelt; 92% Genauigkeit bei der Extraktion von Finanzentitäten erreicht.',
      'Verarbeitungsdurchsatz durch asynchronen Code mit FastAPI um 30% gesteigert und eine React-Native-App zur Datenerfassung erstellt.',
    ],
  },
  'Study League IT Solutions': {
    role: 'Python-Praktikant',
    bullets: [
      'Windows-Monitoring-App mit OAuth-2.0-Integration prototypisiert und geplante Skripte in einem agilen Team mit 3 Personen programmiert.',
    ],
  },
};

const GERMAN_EDUCATION = {
  'Berlin School of Business and Innovation (BSBI)': {
    degree: 'MSc Künstliche Intelligenz',
    details: ['Abschluss verliehen von der University for the Creative Arts'],
  },
  'Mumbai University': {
    degree: 'Bachelor of Engineering, Computertechnik',
    details: ['CGPA: 7,32/10 (entspricht der deutschen Note 2,3)'],
  },
};

const GERMAN_SKILLS = {
  'NLP/GenAI': { category: 'NLP/GenAI', items: 'Prompt Engineering, große Sprachmodelle (Mistral 7B), LangChain, Embeddings, RAG, Informationsabruf, spaCy' },
  'ML/DL': { category: 'ML/DL', items: 'PyTorch, TensorFlow, YOLOv5, YOLOv8, Detectron2, FAISS, ONNX, Modelloptimierung' },
  'Computer Vision': { category: 'Computer Vision', items: 'OpenCV, OCR, Objekterkennung, Segmentierung, Echtzeit-Inferenz, Edge-AI-Bereitstellung, TensorRT-/ONNX-Optimierung' },
  'MLOps/Cloud': { category: 'MLOps/Cloud', items: 'Docker, GCP (Cloud Run, Storage), AWS (Lambda, EC2, S3, API Gateway), Terraform, GitHub Actions, CI/CD, Vercel, Render' },
  'Agentic & Speech': { category: 'Agenten & Sprache', items: 'MCP-Server, Agenten-Harnesses/-Plugins (OpenCode, Claude Code), Spracherkennung (Whisper, faster-whisper), TTS (KittenTTS), VAD' },
  Robotics: { category: 'Robotik', items: 'ROS2 (Jazzy, Humble), Gazebo, Webots, MuJoCo, PyBullet, Nav2, LIDAR, SLAM/Navigations-Stack, Sensorfusion, autonome Systeme, URDF/Xacro, CAD (build123d/FreeCAD)' },
  'Web/API': { category: 'Web/API', items: 'FastAPI (asynchron), Flask, REST-APIs, Selenium, BeautifulSoup' },
  Languages: { category: 'Programmiersprachen', items: 'Python, C/C++, JavaScript' },
};

const GERMAN_PROJECTS = [
  {
    title: 'SKU-Erkennung für die Regalüberwachung in deutschen Supermärkten (MSc-Masterarbeit)',
    description: 'Regaldaten von Kaufland, Aldi, Lidl und Netto gesammelt und annotiert (2.268 Boxen, 148 SKUs). YOLOv8n erreichte mAP50 0,805. Exemplarbasierte Suche mit DINOv3 und MobileNetV2 erzielte 93,7% Top-1 und 96% One-Shot — 36,8 Prozentpunkte besser als CLIP Zero-Shot.',
  },
  {
    title: 'Kuh-Posenschätzung (YOLOv8, ROS2 Jazzy, Gazebo)',
    description: 'YOLOv8 auf einem eigenen Datensatz mit 26 Keypoints feinabgestimmt: 57,5% Verbesserung bei mAP50, 59,7% kleinere Modellgröße (9,29 MB) und 30 Hz Echtzeit-Inferenz mit ROS2.',
  },
];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripMarkdown(value = '') {
  return String(value)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function shorten(value, maxChars) {
  const text = stripMarkdown(value).replace(/\s+/g, ' ').trim();
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1).replace(/\s+\S*$/, '');
  return `${cut}…`;
}

function parseSections(markdown) {
  const sections = {};
  let current = '';
  const buffer = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (current) sections[current] = buffer.join('\n').trim();
      current = match[1].trim();
      buffer.length = 0;
    } else if (current) {
      buffer.push(line);
    }
  }
  if (current) sections[current] = buffer.join('\n').trim();
  return sections;
}

function splitSubsections(text = '') {
  const entries = [];
  let heading = '';
  const buffer = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^###\s+(.+)$/);
    if (match) {
      if (heading) entries.push({ heading, content: buffer.join('\n').trim() });
      heading = match[1].trim();
      buffer.length = 0;
    } else if (heading) {
      buffer.push(line);
    }
  }
  if (heading) entries.push({ heading, content: buffer.join('\n').trim() });
  return entries;
}

function parsePeriod(value = '') {
  const text = stripMarkdown(value).replace(/\s*\|\s*/g, ' | ');
  const periodText = text.includes('|') ? text.split('|').pop() : text;
  const dateParts = [];
  const datePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Jan\.|Feb\.|Mär\.|Apr\.|Mai|Jun\.|Jul\.|Aug\.|Sep\.|Okt\.|Nov\.|Dez\.)\s+\d{4}|\d{1,2}[./]\d{4}/g;
  let match;
  while ((match = datePattern.exec(periodText)) !== null) dateParts.push(match[0]);
  if (dateParts.length < 2) {
    const years = periodText.match(/\d{4}/g) || [];
    dateParts.push(...years);
  }
  if (dateParts.length < 2) return '';

  const formatPart = (part) => {
    const numeric = part.match(/^(\d{1,2})[./](\d{4})$/);
    if (numeric) return `${numeric[1].padStart(2, '0')}/${numeric[2]}`;
    const month = part.match(/^([A-Za-zÄÖÜäöü.]+)\s+(\d{4})$/);
    if (month && MONTHS[month[1]]) return `${MONTHS[month[1]]}/${month[2]}`;
    return month ? month[2] : part;
  };

  return `${formatPart(dateParts[0])} – ${formatPart(dateParts[1])}`;
}

function parseBullets(text = '') {
  return text.split('\n')
    .filter(line => /^\s*-\s+/.test(line))
    .map(line => stripMarkdown(line.replace(/^\s*-\s+/, '')))
    .filter(Boolean);
}

function localizeGermanLocation(location) {
  return location
    .replace('Berlin, Germany', 'Berlin, Deutschland')
    .replace('Mumbai, India', 'Mumbai, Indien')
    .replace('Thane, India', 'Thane, Indien');
}

function splitHeading(heading) {
  const parts = heading.split(/\s+[—–-]\s+/).map(part => part.trim());
  return { primary: parts[0] || '', secondary: parts.slice(1).join(' — ') };
}

function parseExperience(sections, maxBullets = 3) {
  return splitSubsections(sections['Work Experience'] || sections['Experience'] || '')
    .map(({ heading, content }) => {
      const { primary: company, secondary: location } = splitHeading(heading);
      const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
      const roleLine = lines.find(line => /^\*\*/.test(line));
      const role = roleLine ? stripMarkdown(roleLine) : '';
      const periodLine = lines.find(line => /\d{4}/.test(line) && !line.startsWith('-')) || '';
      const bullets = parseBullets(content).slice(0, maxBullets);
      return { company, location, role, period: parsePeriod(periodLine), bullets };
    })
    .filter(job => job.company && job.role && job.period);
}

function parseEducation(sections) {
  return splitSubsections(sections.Education || '')
    .map(({ heading, content }) => {
      const { primary: school, secondary: location } = splitHeading(heading);
      const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
      const degreeLine = lines.find(line => /^\*\*/.test(line)) || '';
      const degreeMatch = degreeLine.match(/^\*\*(.+?)\*\*/);
      const degree = degreeMatch ? stripMarkdown(degreeMatch[1]) : '';
      const period = parsePeriod(degreeLine) || parsePeriod(lines.find(line => /\d{4}/.test(line)) || '');
      const details = parseBullets(content).slice(0, 1).map(detail => shorten(detail, 280));
      return { school, location, degree, period, details };
    })
    .filter(entry => entry.school && entry.degree && entry.period);
}

function parseSkills(sections) {
  const skills = [];
  const regex = /^-\s*\*\*(.+?)\*\*\s*(.*)$/gm;
  const text = sections['Technical Skills'] || sections.Skills || '';
  let match;
  while ((match = regex.exec(text)) !== null) {
    const category = stripMarkdown(match[1]).replace(/:$/, '').trim();
    const items = stripMarkdown(match[2]).replace(/^:\s*/, '').trim();
    if (category && items) skills.push({ category, items });
  }
  return skills.slice(0, 8);
}

function parseProjects(sections) {
  const projects = [];
  const raw = sections['Academic Work'] || '';
  for (const line of raw.split('\n').filter(item => /^\s*-\s+/.test(item))) {
    const bullet = line.replace(/^\s*-\s+/, '').trim();
    const match = bullet.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
    projects.push({
      title: stripMarkdown(match?.[1] || 'Akademisches Projekt'),
      description: shorten(match?.[2] || bullet, 250),
    });
  }
  return projects.slice(0, 2);
}

function parseLanguagesAndCertifications(sections, profile, lang) {
  const raw = sections['Languages & Certifications'] || '';
  const lines = raw.split('\n').map(line => line.trim());
  const languageLine = lines.find(line => /^-\s*\*\*Languages(?::\*\*|\*\*:)\s*/i.test(line));
  const certificationLine = lines.find(line => /^-\s*\*\*Certifications(?::\*\*|\*\*:)\s*/i.test(line));
  const languages = [];
  if (profile.languages?.german) languages.push({ name: lang === 'de' ? 'Deutsch' : 'German', level: profile.languages.german });
  if (profile.languages?.english) languages.push({ name: lang === 'de' ? 'Englisch' : 'English', level: profile.languages.english });
  if (!languages.length && languageLine) {
    for (const value of languageLine.replace(/^-\s*\*\*Languages(?::\*\*|\*\*:)\s*/i, '').split(',')) {
      const [name, level = ''] = value.trim().split(/\s*\(([^)]+)\)/);
      languages.push({ name, level });
    }
  }
  const certifications = certificationLine
    ? certificationLine.replace(/^-\s*\*\*Certifications(?::\*\*|\*\*:)\s*/i, '').split(',').map(stripMarkdown).filter(Boolean).slice(0, 3)
    : [];
  return { languages, certifications };
}

function parseSummary(sections) {
  const raw = stripMarkdown(sections['Professional Summary'] || '');
  const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean);
  return shorten(sentences.slice(0, 2).join(' '), 520);
}

function renderPhoto(enabled, labels) {
  if (!enabled) return '';
  return `<div class="photo-box">${escapeHtml(labels.photo)}</div><div class="photo-hint">${escapeHtml(labels.photoHint)}<br>optional</div>`;
}

function renderExperience(jobs) {
  return jobs.map(job => `
    <article class="entry">
      <div class="entry-date">${escapeHtml(job.period)}</div>
      <div class="entry-content">
        <div class="entry-header">
          <div class="entry-role">${escapeHtml(job.role)}</div>
          <div class="entry-location">${escapeHtml(job.location)}</div>
        </div>
        <div class="entry-company">${escapeHtml(job.company)}</div>
        <ul class="entry-bullets">${job.bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>
      </div>
    </article>`).join('');
}

function renderEducation(entries) {
  return entries.map(entry => `
    <article class="entry">
      <div class="entry-date">${escapeHtml(entry.period)}</div>
      <div class="entry-content">
        <div class="entry-role">${escapeHtml(entry.degree)}</div>
        <div class="entry-company">${escapeHtml(entry.school)}</div>
        <div class="entry-location">${escapeHtml(entry.location)}</div>
        ${entry.details.length ? `<ul class="detail-list">${entry.details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>` : ''}
      </div>
    </article>`).join('');
}

function renderSkills(skills) {
  return skills.map(skill => `
    <div class="skill-row"><span class="skill-category">${escapeHtml(skill.category)}</span><span class="skill-items">${escapeHtml(skill.items)}</span></div>`).join('');
}

function renderProjects(projects) {
  return projects.map(project => `
    <article class="project"><div class="project-title">${escapeHtml(project.title)}</div><div class="project-description">${escapeHtml(project.description)}</div></article>`).join('');
}

function renderLanguages({ languages, certifications }, labels) {
  return `<div class="language-columns">
    <div><div class="subsection-label">${escapeHtml(labels.language)}</div>${languages.map(language => `<div class="language-item"><span>${escapeHtml(language.name)}</span><strong>${escapeHtml(language.level)}</strong></div>`).join('')}</div>
    <div><div class="subsection-label">${escapeHtml(labels.certifications)}</div>${certifications.map(certification => `<div class="certification-item">${escapeHtml(certification)}</div>`).join('')}</div>
  </div>`;
}

function replaceTokens(template, values) {
  let html = template;
  for (const [token, value] of Object.entries(values)) html = html.replaceAll(`{{${token}}}`, value ?? '');
  return html;
}

export function generateGermanCvHtml({ lang = 'de', photoEnabled = false, date = new Date() } = {}) {
  const labels = LABELS[lang] || LABELS.de;
  const profile = yaml.load(readFileSync(PROFILE_PATH, 'utf8'));
  const sections = parseSections(readFileSync(CV_PATH, 'utf8'));
  const candidate = profile.candidate || {};
  const languagesAndCertifications = parseLanguagesAndCertifications(sections, profile, lang);
  const dateStr = date.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const experience = parseExperience(sections).map(job => {
    if (lang !== 'de') return job;
    return { ...job, location: localizeGermanLocation(job.location), ...(GERMAN_EXPERIENCE[job.company] || {}) };
  });
  const education = parseEducation(sections).map(entry => {
    if (lang !== 'de') return entry;
    return { ...entry, location: localizeGermanLocation(entry.location), ...(GERMAN_EDUCATION[entry.school] || {}) };
  });
  const skills = parseSkills(sections).map(skill => {
    if (lang !== 'de' || !GERMAN_SKILLS[skill.category]) return skill;
    return GERMAN_SKILLS[skill.category];
  });
  const projects = lang === 'de' ? GERMAN_PROJECTS : parseProjects(sections);

  const values = {
    HTML_LANG: escapeHtml(lang),
    DOCUMENT_TITLE: escapeHtml(lang === 'de' ? 'Lebenslauf' : 'Curriculum Vitae'),
    FULL_NAME: escapeHtml(candidate.full_name),
    HEADLINE: escapeHtml(lang === 'de' ? GERMAN_HEADLINE : (profile.narrative?.headline || 'AI/ML Engineer')),
    LOCATION: escapeHtml(lang === 'de' ? GERMAN_LOCATION : candidate.location),
    EMAIL: escapeHtml(candidate.email),
    PHONE: escapeHtml(candidate.phone),
    LINKEDIN: escapeHtml(candidate.linkedin),
    GITHUB: escapeHtml(candidate.github),
    VISA_NOTE: escapeHtml(labels.visa),
    HEADER_PHOTO: renderPhoto(photoEnabled, labels),
    SECTION_SUMMARY: escapeHtml(labels.summary),
    SUMMARY: escapeHtml(lang === 'de' ? GERMAN_SUMMARY : parseSummary(sections)),
    SECTION_EXPERIENCE: escapeHtml(labels.experience),
    EXPERIENCE: renderExperience(experience),
    SECTION_EDUCATION: escapeHtml(labels.education),
    EDUCATION: renderEducation(education),
    SECTION_SKILLS: escapeHtml(labels.skills),
    SKILLS: renderSkills(skills),
    SECTION_PROJECTS: escapeHtml(labels.projects),
    PROJECTS: renderProjects(projects),
    SECTION_LANGUAGES: escapeHtml(labels.languages),
    LANGUAGES: renderLanguages(languagesAndCertifications, labels),
    LOCATION_DATE: `${escapeHtml(lang === 'de' ? GERMAN_LOCATION : candidate.location)}, ${lang === 'de' ? 'den' : ''} ${escapeHtml(dateStr)}`.trim(),
    FULL_NAME_FOOTER: escapeHtml(candidate.full_name),
  };

  const template = readFileSync(TEMPLATE_PATH, 'utf8');
  const html = replaceTokens(template, values);
  const unresolved = html.match(/\{\{[^}]+\}\}/g);
  if (unresolved) throw new Error(`Unresolved CV template tokens: ${unresolved.join(', ')}`);
  return html;
}

export const cvRequiredSections = {
  de: ['KURZPROFIL', 'BERUFSERFAHRUNG', 'AUSBILDUNG', 'TECHNISCHE KOMPETENZEN', 'AUSGEWÄHLTE PROJEKTE', 'SPRACHEN & ZERTIFIKATE'],
  en: ['PROFESSIONAL SUMMARY', 'WORK EXPERIENCE', 'EDUCATION', 'TECHNICAL SKILLS', 'SELECTED PROJECTS', 'LANGUAGES & CERTIFICATIONS'],
};
export const germanCvRequiredSections = cvRequiredSections.de;
