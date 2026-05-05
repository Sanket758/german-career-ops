import { readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

function parseMarkdownSection(md, title) {
  const regex = new RegExp(`## ${title}\\n\\n([\\s\\S]+?)(?=\\n##|$)`, 'i');
  const match = md.match(regex);
  return match ? match[1].trim() : '';
}

function generateExperienceHtml(md) {
  const jobs = md.split(/^### /m).slice(1);
  return jobs.map(job => {
    const lines = job.split('\n').filter(l => l.trim().length > 0);
    const companyInfo = lines[0].trim();
    const [company, location] = companyInfo.split(' — ');
    
    // Find role and period
    let role = '';
    let period = '';
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].includes('**')) {
        role = lines[i].replace(/\*\*/g, '').trim();
        if (lines[i+1] && !lines[i+1].startsWith('-')) {
          period = lines[i+1].trim();
        }
        break;
      }
    }

    const bullets = job.match(/^- ([\s\S]+?)(?=\n- |\n\n|$)/gm) || [];
    
    return `
      <div class="job">
        <div class="job-header">
          <span class="job-company">${company}</span>
          <span class="job-period">${period}</span>
        </div>
        <div class="job-role">${role} | ${location || ''}</div>
        <ul>
          ${bullets.map(b => `<li>${b.replace(/^- /, '').trim()}</li>`).join('\n')}
        </ul>
      </div>
    `;
  }).join('\n');
}

function generateEducationHtml(md) {
  const items = md.split(/^### /m).slice(1);
  return items.map(item => {
    const lines = item.split('\n').filter(l => l.trim().length > 0);
    const orgInfo = lines[0].trim();
    const [org, location] = orgInfo.split(' — ');
    const degree = lines[1] ? lines[1].replace(/\*\*/g, '').trim() : '';
    const period = lines[2] ? lines[2].trim() : '';
    const details = lines.slice(3).join('\n').trim();
    
    return `
      <div class="edu-item">
        <div class="edu-header">
          <span class="edu-title">${degree}</span>
          <span class="edu-year">${period}</span>
        </div>
        <div class="edu-org">${org}</div>
        <div class="edu-desc">${location || ''} | ${details.replace(/^- /gm, '').replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }).join('\n');
}

function generateProjectsHtml(md) {
  const projects = md.split(/^### /m).slice(1);
  return projects.map(p => {
    const lines = p.split('\n').filter(l => l.trim().length > 0);
    const titleLine = lines[0].trim();
    const [title, tech] = titleLine.split('**').filter(s => s.trim().length > 0);
    const content = lines.slice(1).join('\n').trim();
    
    return `
      <div class="project">
        <span class="project-title">${title.replace(/\*\*/g, '').trim()}</span>
        <div class="project-desc">${content.replace(/^- /gm, '').replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }).join('\n');
}

async function run() {
  const profile = yaml.load(readFileSync(join(rootDir, 'config', 'profile.yml'), 'utf8'));
  const cvMd = readFileSync(join(rootDir, 'cv.md'), 'utf8');
  const template = readFileSync(join(rootDir, 'templates', 'cv-template.html'), 'utf8');

  const summary = parseMarkdownSection(cvMd, 'Professional Summary');
  const experience = generateExperienceHtml(parseMarkdownSection(cvMd, 'Work Experience'));
  const education = generateEducationHtml(parseMarkdownSection(cvMd, 'Education'));
  const projects = generateProjectsHtml(parseMarkdownSection(cvMd, 'Academic Work')); // Using Academic Work as requested/implied
  const technicalSkills = parseMarkdownSection(cvMd, 'Technical Skills');
  const certs = parseMarkdownSection(cvMd, 'Languages & Certifications');

  const photoPath = resolve(rootDir, 'data', 'Bewerbungsfoto.jpg');
  const photoUrl = `file://${photoPath}`;

  const placeholders = {
    '{{LANG}}': 'en',
    '{{PAGE_WIDTH}}': '210mm',
    '{{NAME}}': profile.candidate.full_name,
    '{{EMAIL}}': profile.candidate.email,
    '{{PHONE}}': profile.candidate.phone,
    '{{LINKEDIN_URL}}': `https://${profile.candidate.linkedin}`,
    '{{LINKEDIN_DISPLAY}}': profile.candidate.linkedin,
    '{{GITHUB_URL}}': `https://${profile.candidate.github}`,
    '{{GITHUB_DISPLAY}}': profile.candidate.github,
    '{{PERSONAL_DATA}}': `<span>DOB: ${profile.candidate.date_of_birth}</span> <span class="separator">|</span> <span>Nationality: ${profile.candidate.nationality}</span> <span class="separator">|</span> <span>Location: ${profile.candidate.location}</span>`,
    '{{PHOTO}}': `<img src="${photoUrl}" style="width: 35mm; height: 45mm; object-fit: cover;">`,
    '{{SECTION_SUMMARY}}': 'PROFESSIONAL SUMMARY',
    '{{SUMMARY_TEXT}}': summary.replace(/\n/g, '<br>'),
    '{{SECTION_COMPETENCIES}}': 'CORE COMPETENCIES',
    '{{COMPETENCIES}}': profile.narrative.superpowers.map(s => `<span class="competency-tag">${s}</span>`).join(' '),
    '{{SECTION_EXPERIENCE}}': 'WORK EXPERIENCE',
    '{{EXPERIENCE}}': experience,
    '{{SECTION_PROJECTS}}': 'KEY PROJECTS',
    '{{PROJECTS}}': projects,
    '{{SECTION_EDUCATION}}': 'EDUCATION',
    '{{EDUCATION}}': education,
    '{{SECTION_CERTIFICATIONS}}': 'LANGUAGES & CERTIFICATIONS',
    '{{CERTIFICATIONS}}': certs.split('\n').filter(c => c.trim().length > 0).map(c => `<div class="cert-item"><span class="cert-title">${c.replace(/^- /, '')}</span></div>`).join(''),
    '{{SECTION_SKILLS}}': 'TECHNICAL SKILLS',
    '{{SKILLS}}': technicalSkills.split('\n').filter(s => s.trim().length > 0).map(s => `<div class="skill-item">${s.replace(/^- /, '')}</div>`).join(''),
    '{{SIGNATURE_LOCATION}}': 'Berlin',
    '{{SIGNATURE_DATE}}': '30.04.2026'
  };

  let html = template;
  for (const [key, value] of Object.entries(placeholders)) {
    html = html.replace(new RegExp(key, 'g'), value);
  }

  const tempHtmlPath = join(rootDir, 'temp', 'cv-sanket-gadge-n26-photo.html');
  const outputPdfPath = join(rootDir, 'output', 'cv-sanket-gadge-n26-2026-04-30.pdf');

  writeFileSync(tempHtmlPath, html);
  console.log(`✅ HTML generated: ${tempHtmlPath}`);

  try {
    execSync(`node generate-pdf.mjs ${tempHtmlPath} ${outputPdfPath} --format=a4`);
    console.log(`✅ PDF generated: ${outputPdfPath}`);
  } catch (err) {
    console.error('❌ PDF generation failed:', err.message);
  }
}

run();
