#!/usr/bin/env node
/**
 * generate-anschreiben.mjs — Generate German cover letter (Anschreiben) PDF
 * 
 * Usage:
 *   node generate-anschreiben.mjs --url "https://..." [--lang de|en] [--output output/anschreiben-company-YYYY-MM-DD.pdf]
 *   node generate-anschreiben.mjs --jd-file jd.txt --company "Company Name" --role "Role Title" [options]
 *   node generate-anschreiben.mjs --help
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const TEMPLATE_PATH = join(PROJECT_ROOT, 'templates', 'anschreiben-template.html');
const CV_PATH = join(PROJECT_ROOT, 'cv.md');
const PROFILE_PATH = join(PROJECT_ROOT, 'config', 'profile.yml');
const OUTPUT_DIR = join(PROJECT_ROOT, 'output');

// Parse args
const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
const urlArg = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
const jdFileArg = args.includes('--jd-file') ? args[args.indexOf('--jd-file') + 1] : null;
const companyArg = args.includes('--company') ? args[args.indexOf('--company') + 1] : null;
const roleArg = args.includes('--role') ? args[args.indexOf('--role') + 1] : null;
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'de';
const outputArg = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;

if (help || (!urlArg && !jdFileArg)) {
  console.log(`
Cover Letter Generator — German Anschreiben

Usage:
  node generate-anschreiben.mjs --url "JOB_URL" [options]
  node generate-anschreiben.mjs --jd-file jd.txt --company "Company" --role "Role" [options]

Options:
  --url URL         Job posting URL (fetches JD automatically)
  --jd-file FILE    Path to JD text file
  --company NAME    Company name (required with --jd-file)
  --role TITLE      Role title (required with --jd-file)
  --lang de|en      Language: de (German) or en (English) (default: de)
  --output PATH     Output PDF path (default: output/anschreiben-company-YYYY-MM-DD.pdf)
  --help            Show this help

Examples:
  node generate-anschreiben.mjs --url "https://jobs.lever.co/eternal/..."
  node generate-anschreiben.mjs --jd-file jd.txt --company "eternal.ag" --role "Computer Vision Engineer" --lang de
  node generate-anschreiben.mjs --url "https://..." --output output/anschreiben-sap-de.pdf
`);
  process.exit(0);
}

// Load profile
function loadProfile() {
  const content = readFileSync(PROFILE_PATH, 'utf-8');
  return yaml.load(content);
}

// Parse CV for proof points
function parseCV() {
  const content = readFileSync(CV_PATH, 'utf-8');
  const sections = {};
  let currentSection = '';
  let currentContent = [];
  
  for (const line of content.split('\n')) {
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = sectionMatch[1];
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  if (currentSection) {
    sections[currentSection] = currentContent.join('\n').trim();
  }
  
  return sections;
}

// Extract key proof points from CV
function extractProofPoints(sections) {
  const points = [];
  
  // Work experience achievements
  const expText = sections['Work Experience'] || '';
  const bulletRegex = /-\s*(.+)/g;
  let match;
  while ((match = bulletRegex.exec(expText)) !== null) {
    const bullet = match[1].trim();
    if (bullet.match(/\d+%|\d+\+|reduced|increased|achieved|led|shipped|built|deployed|improved/i)) {
      points.push(bullet);
    }
  }
  
  // Projects
  const projText = sections['Personal Projects'] || sections['Projects'] || '';
  const projRegex = /-\s*\*\*(.+?)\*\*:\s*(.+)/g;
  while ((match = projRegex.exec(projText)) !== null) {
    points.push(`${match[1]}: ${match[2]}`);
  }
  
  // Achievements
  const achText = sections['Achievements'] || '';
  const achRegex = /-\s*(.+)/g;
  while ((match = achRegex.exec(achText)) !== null) {
    points.push(match[1].trim());
  }
  
  return points.slice(0, 15); // Limit
}

// Fetch JD from URL (simplified - in production use browser)
async function fetchJD(url) {
  // For Greenhouse/Lever, try API first
  const greenhouseMatch = url.match(/greenhouse\.io\/(\w+)\/jobs\/(\d+)/);
  if (greenhouseMatch) {
    const [, company, jobId] = greenhouseMatch;
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`;
    try {
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        return {
          title: data.title || '',
          content: data.content || '',
          location: data.location?.name || '',
          company
        };
      }
    } catch {}
  }
  
  const leverMatch = url.match(/jobs\.lever\.co\/(\w+)\/([^/?#]+)/);
  if (leverMatch) {
    const [, company, jobId] = leverMatch;
    const apiUrl = `https://api.lever.co/v0/postings/${company}/${jobId}?mode=json`;
    try {
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        return {
          title: data.text || '',
          content: data.description || '',
          location: data.categories?.location || '',
          company
        };
      }
    } catch {}
  }
  
  // Fallback: return minimal info
  return { title: '', content: '', location: '', company: '' };
}

// Analyze JD for key requirements
function analyzeJD(jdText) {
  const requirements = {
    technical: [],
    languages: [],
    degree: false,
    experience: '',
    germanRequired: false,
    visaSponsorship: false,
    remote: false
  };
  
  const lower = jdText.toLowerCase();
  
  // Technical skills
  const techKeywords = ['python', 'pytorch', 'tensorflow', 'yaml', 'docker', 'kubernetes', 'gcp', 'aws', 'azure', 'ci/cd', 'fastapi', 'flask', 'react', 'vue', 'sql', 'postgres', 'mongodb', 'redis', 'kafka', 'terraform', 'git', 'linux', 'opencv', 'yolo', 'detectron', 'sam', 'dinov2', 'onnx', 'tensorrt', 'mlops', 'rag', 'langchain', 'llm', 'transformers', 'huggingface', 'ros2', 'gazebo', 'mujoco', 'webots', 'slan', 'navigation', 'manipulation'];
  for (const kw of techKeywords) {
    if (lower.includes(kw)) requirements.technical.push(kw);
  }
  
  // German requirement
  if (lower.includes('deutsch') || lower.includes('german') || lower.includes('c1') || lower.includes('b2') || lower.includes('fließend') || lower.includes('verhandlungssicher')) {
    requirements.germanRequired = true;
  }
  
  // Visa sponsorship
  if (lower.includes('visa') || lower.includes('sponsor') || lower.includes('work permit') || lower.includes('arbeitgeber') || lower.includes('blue card')) {
    requirements.visaSponsorship = true;
  }
  
  // Remote
  if (lower.includes('remote') || lower.includes('homeoffice') || lower.includes('home office')) {
    requirements.remote = true;
  }
  
  return requirements;
}

// Find matching proof points
function matchProofPoints(jdRequirements, proofPoints) {
  const matches = [];
  const used = new Set();
  
  for (const req of jdRequirements.technical) {
    for (let i = 0; i < proofPoints.length; i++) {
      if (used.has(i)) continue;
      const point = proofPoints[i].toLowerCase();
      if (point.includes(req) || req.includes(point.split(' ')[0])) {
        matches.push({ requirement: req, proof: proofPoints[i] });
        used.add(i);
        break;
      }
    }
  }
  
  return matches.slice(0, 5); // Top 5 matches
}

// Generate cover letter content
function generateContent(jd, jdAnalysis, matches, profile, candidate, lang, companyName) {
  const isGerman = lang === 'de';
  
  // Opening
  const openings = {
    de: `Mit großem Interesse habe ich Ihre Ausschreibung für die Position als ${jd.role} gelesen. ${jd.company} steht für mich für ${jd.company.toLowerCase().includes('ai') || jd.company.toLowerCase().includes('ml') ? 'exzellente angewandte KI-Forschung' : 'technische Innovation im deutschen Markt'} – genau das Umfeld, in dem ich meine Erfahrung in production Computer Vision und MLOps einbringen möchte.`,
    en: `I read your posting for the ${jd.role} position with great interest. ${jd.company} represents exactly the kind of technical innovation where I can contribute my production Computer Vision and MLOps experience.`
  };
  
  // Body paragraphs from matches
  const bodyParagraphs = [];
  if (matches.length > 0) {
    const matchText = matches.map(m => 
      isGerman 
        ? `Sie suchen ${m.requirement} – ich habe ${m.proof}.`
        : `You require ${m.requirement} – I have ${m.proof}.`
    ).join(' ');
    
    bodyParagraphs.push(isGerman 
      ? `Meine Erfahrung deckt zentrale Anforderungen Ihrer Stelle ab: ${matchText}`
      : `My experience covers key requirements of your role: ${matchText}`
    );
  }
  
  // Add thesis/project highlight
  const thesisPoints = {
    de: `Mein MSc-Thesis an der BSBI Berlin (SKU-Erkennung für deutsche Supermärkte – Kaufland, Aldi, Lidl, Netto) erreichte 93.7% Top-1-Retrieval-Accuracy mit DINOv3/MobileNetV2 – 36.8 Prozentpunkte besser als CLIP Zero-Shot. Dies ist direkte Domänenexpertise für deutsche Retail-CV-Anwendungen.`,
    en: `My MSc thesis at BSBI Berlin (SKU recognition for German supermarkets – Kaufland, Aldi, Lidl, Netto) achieved 93.7% top-1 retrieval accuracy with DINOv3/MobileNetV2 – 36.8pp better than CLIP zero-shot. This is direct domain expertise for German retail CV applications.`
  };
  bodyParagraphs.push(thesisPoints[lang]);
  
  // Production experience
  const prodPoints = {
    de: `Bei Big Rattle Technologies (Senior AI/ML Engineer, Team Lead) baute ich YOLOv5/Detectron2-Regalmonitoring für Colgate-Palmolive und Dabur: 500+ SKUs bei 95%+ Precision, 60% Audit-Reduktion. MLOps-Pipeline auf GCP Cloud Run (Terraform, Docker, FastAPI) mit Zero-Downtime-Deployment.`,
    en: `At Big Rattle Technologies (Senior AI/ML Engineer, Team Lead) I built YOLOv5/Detectron2 shelf monitoring for Colgate-Palmolive and Dabur: 500+ SKUs at 95%+ precision, 60% audit reduction. MLOps pipeline on GCP Cloud Run (Terraform, Docker, FastAPI) with zero-downtime deployment.`
  };
  const bodyText = bodyParagraphs.join('\n\n');
  
    // Visa text
    const visaTexts = {
    de: `Ich besitze einen deutschen MSc-Abschluss (BSBI/UCA) und bin ab dem 28.08.2026 uneingeschränkt vollzeitbeschäftigbar (§20 AufenthG Job-Sucher-Visum → §18g Aufenthaltserlaubnis, **kein Arbeitgeber-Sponsoring nötig**). Deutscher Hochschulabschluss = Blue-Card-tauglich zum reduzierten IT-Fachkräfte-Threshold (€45.934/Jahr, 2026). Ich stehe für Gespräche sofort zur Verfügung und kann ab September 2026 starten.`,
    en: `I hold a German MSc degree (BSBI/UCA) and am fully authorized for full-time work from 28 Aug 2026 (§20 job-seeker visa → §18g work permit, **no employer sponsorship required**). German degree = EU Blue Card eligible at reduced IT shortage threshold (€45,934/yr, 2026). Available for interviews immediately, can start September 2026.`
  };
  
  // Closing
  const closing = {
    de: `Über eine Einladung zu einem persönlichen Gespräch freue ich mich sehr, um Ihnen meine Motivation und fachliche Passung näher darzulegen.`,
    en: `I would welcome the opportunity to discuss my motivation and fit in a personal interview.`
  };
  
  // Greeting
  const greeting = isGerman ? 'Mit freundlichen Grüßen' : 'Sincerely';
  
  // Contact person detection
  let contactPerson = '';
  let contactTitle = '';
  let contactLastname = '';
  // Could enhance with company research
  
  return {
    opening: openings[lang],
    body_paragraphs: bodyText,
    visa_text: visaTexts[lang],
    closing_paragraph: closing[lang],
    closing_greeting: greeting,
    contact_person: contactPerson,
    contact_title: contactTitle,
    contact_lastname: contactLastname,
    attachments: [
      'Lebenslauf (tabellarisch)',
      'Zeugnisse (MSc, BEng, Arbeitszeugnisse)',
      'Projektportfolio (GitHub: github.com/sanket758)',
      'Sprachnachweise (IELTS C1, Deutsch B1)'
    ].join('<br>• '),
    recipient_content: `
    <div class="recipient-name">${contactPerson || 'Personalabteilung'}</div>
    <div class="recipient-company">${companyName}</div>
    <div class="recipient-line">${''}</div>
    <div class="recipient-line">${''}</div>
    ${'Deutschland' !== 'Deutschland' ? `<div class="recipient-line">Deutschland</div>` : ''}
  `.trim()
  };
}

// Render template
function renderTemplate(template, data) {
  let html = template;
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' || typeof value === 'number') {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    } else if (Array.isArray(value)) {
      const loopRegex = new RegExp(`\\{\\{#each\\s+${key}\\}\\}([\\s\\S]*?)\\{\\{/each\\}\\}`, 'g');
      html = html.replace(loopRegex, (_, inner) => {
        return value.map(item => {
          let itemHtml = inner;
          for (const [k, v] of Object.entries(item)) {
            itemHtml = itemHtml.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
          }
          return itemHtml;
        }).join('');
      });
    }
  }
  
  // Conditionals
  html = html.replace(/\{%\s*if\s+(\w+)\s*%}([\s\S]*?)\{%\s*endif\s*%}/g, (_, cond, content) => {
    return data[cond] ? content : '';
  });
  
  return html;
}

// Generate PDF
async function generatePDF(htmlPath, pdfPath) {
  const playwright = await import('playwright');
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' }
  });
  
  await browser.close();
}

// Main
async function main() {
  try {
    // Load profile and CV
    const profile = await loadProfile();
    const cvSections = parseCV();
    const proofPoints = extractProofPoints(cvSections);
    const candidate = profile.candidate;
    
    // Get JD
    let jd = { title: '', content: '', location: '', company: '' };
    let companyName = companyArg;
    let roleTitle = roleArg;
    
    if (urlArg) {
      console.log(`Fetching JD from: ${urlArg}`);
      const fetched = await fetchJD(urlArg);
      jd = { ...jd, ...fetched };
      if (!companyName) companyName = jd.company || 'Das Unternehmen';
      if (!roleTitle) roleTitle = jd.title || 'Die ausgeschriebene Position';
    } else if (jdFileArg) {
      const content = readFileSync(jdFileArg, 'utf-8');
      jd.content = content;
      if (!companyName || !roleTitle) {
        console.error('❌ --company and --role required with --jd-file');
        process.exit(1);
      }
    }
    
    jd.role = roleTitle;
    jd.company = companyName;
    
    // Analyze JD
    const jdAnalysis = analyzeJD(jd.content);
    const matches = matchProofPoints(jdAnalysis, proofPoints);
    
    // Generate content
    const today = new Date();
    const dateStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const dateISO = today.toISOString().slice(0, 10);
    
    const content = generateContent(jd, jdAnalysis, matches, profile, candidate, lang, companyName);
    
    // Build template data
    const data = {
      full_name: candidate.full_name,
      address_line1: candidate.location.split(',')[0].trim(),
      address_line2: candidate.location.split(',').slice(1).join(',').trim() || 'Deutschland',
      phone: candidate.phone,
      email: candidate.email,
      linkedin: candidate.linkedin,
      github: candidate.github,
      location: candidate.location.split(',')[0].trim(),
      date_today: dateStr,
      company_name: companyName,
      company_street: '', // Would need company research
      company_zip: '',
      company_city: '',
      company_country: 'Deutschland',
      role: roleTitle,
      ref_number: '',
      ...content,
    
    // Load and render template
    const template = readFileSync(TEMPLATE_PATH, 'utf-8');
    const html = renderTemplate(template, data);
    
    // Write HTML temp file
    const htmlPath = join(OUTPUT_DIR, 'anschreiben-temp.html');
    writeFileSync(htmlPath, html, 'utf-8');
    
    // Determine output path
    const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const outputPath = outputArg || join(OUTPUT_DIR, `anschreiben-${companySlug}-${dateISO}.pdf`);
    
    // Ensure output dir
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Generate PDF
    console.log(`Generating cover letter: ${outputPath}`);
    await generatePDF(htmlPath, outputPath);
    
    // Cleanup
    try { require('fs').unlinkSync(htmlPath); } catch {}
    
    console.log(`✅ Cover letter generated: ${outputPath}`);
    console.log(`\nJD Analysis:`);
    console.log(`  German required: ${jdAnalysis.germanRequired ? 'YES ⚠️' : 'No'}`);
    console.log(`  Visa sponsorship mentioned: ${jdAnalysis.visaSponsorship ? 'Yes' : 'No'}`);
    console.log(`  Remote: ${jdAnalysis.remote ? 'Yes' : 'No'}`);
    console.log(`  Key tech matches: ${matches.map(m => m.requirement).join(', ') || 'None found'}`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();