import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function generateTestCV() {
  const templatePath = join(__dirname, 'templates', 'cv-template.html');
  let html = readFileSync(templatePath, 'utf-8');

  // Basic replacements for test
  const placeholders = {
    '{{LANG}}': 'en',
    '{{PAGE_WIDTH}}': '210mm',
    '{{NAME}}': 'Sanket Sadashiv Gadge',
    '{{EMAIL}}': 'gadgesanket75@gmail.com',
    '{{PHONE}}': '+49 17676475359',
    '{{LINKEDIN_URL}}': 'https://linkedin.com/in/sanket758',
    '{{LINKEDIN_DISPLAY}}': 'linkedin.com/in/sanket758',
    '{{GITHUB_URL}}': 'https://github.com/sanket758',
    '{{GITHUB_DISPLAY}}': 'github.com/sanket758',
    '{{PERSONAL_DATA}}': '<span>Geburtsdatum: 02.09.1998</span> <span class="separator">|</span> <span>Geburtsort: Thane, Indien</span> <span class="separator">|</span> <span>Nationalität: Indisch</span> <span class="separator">|</span> <span>Visum: §16b AufenthG (20h/Woche)</span>',
    '{{PHOTO}}': '<div style="font-size: 8px; text-align: center; color: #777;">[FOTO]<br>Professionelles<br>Bewerbungsfoto<br>35mm &times; 45mm</div>',
    '{{SECTION_SUMMARY}}': 'PROFESSIONAL SUMMARY',
    '{{SUMMARY_TEXT}}': 'AI/ML Engineer with 4+ years in production Computer Vision and NLP. Shipped object detection pipelines serving 500+ SKUs at 95%+ precision. Pursuing MSc in AI in Berlin with focus on ROS2 and Robotics.',
    '{{SECTION_COMPETENCIES}}': 'CORE COMPETENCIES',
    '{{COMPETENCIES}}': '<span class="competency-tag">Computer Vision</span> <span class="competency-tag">Deep Learning</span> <span class="competency-tag">ROS2</span> <span class="competency-tag">Python</span>',
    '{{SECTION_EXPERIENCE}}': 'BERUFSERFAHRUNG',
    '{{EXPERIENCE}}': `
      <div class="job">
        <div class="job-header">
          <span class="job-company">Big Rattle Technologies PVT LTD</span>
          <span class="job-period">10.2021 &ndash; 09.2024</span>
        </div>
        <div class="job-role">AI / Machine Learning Engineer | Mumbai, Indien</div>
        <ul>
          <li>Directed a team of 4 to architect YOLOv5 & Detectron2 shelf-monitoring systems for retail clients, achieving 95%+ detection accuracy across 500+ SKUs.</li>
          <li>Reduced inference latency 50% via Python multiprocessing across 4 GPU-accelerated workers.</li>
          <li>Deployed scalable, zero-downtime model serving on GCP Cloud Run via Terraform managed Docker containers.</li>
        </ul>
      </div>
      <div class="job">
        <div class="job-header">
          <span class="job-company">EAZR DIGIPAYMENTS PVT LTD</span>
          <span class="job-period">11.2020 &ndash; 09.2021</span>
        </div>
        <div class="job-role">AI / Machine Learning Engineer | Mumbai, Indien</div>
        <ul>
          <li>Constructed OCR pipelines for identity verification (OpenCV) and implemented video-KYC liveness detection, reducing processing time to seconds.</li>
          <li>Created a credit scoring engine using multi-class SMS classifier (spaCy) reaching 92% accuracy.</li>
        </ul>
      </div>
    `,
    '{{SECTION_PROJECTS}}': 'AKADEMISCHE PROJEKTE',
    '{{PROJECTS}}': `
      <div class="project">
        <span class="project-title">Cow Pose Estimation (YOLOv8, ROS2, Gazebo)</span>
        <div class="project-desc">Fine-tuned YOLO-pose on custom dataset; 57.5% mAP50 improvement, 30 Hz real-time ROS2 inference pipeline.</div>
      </div>
    `,
    '{{SECTION_EDUCATION}}': 'AUSBILDUNG',
    '{{EDUCATION}}': `
      <div class="edu-item">
        <div class="edu-header">
          <span class="edu-title">MSc Artificial Intelligence</span>
          <span class="edu-year">02.2025 &ndash; 08.2026</span>
        </div>
        <div class="edu-org">Berlin School of Business and Innovation</div>
        <div class="edu-desc">Berlin, Deutschland | Currently in dissertation phase</div>
      </div>
    `,
    '{{SECTION_CERTIFICATIONS}}': 'ZERTIFIKATE',
    '{{CERTIFICATIONS}}': '<div class="cert-item"><span class="cert-title">Deep Learning Specialization</span> <span class="cert-org">Coursera</span></div>',
    '{{SECTION_SKILLS}}': 'KENNTNISSE',
    '{{SKILLS}}': '<div class="skill-item"><span class="skill-category">Languages:</span> Python, C++, JavaScript</div>',
    '{{SIGNATURE_LOCATION}}': 'Berlin',
    '{{SIGNATURE_DATE}}': new Date().toLocaleDateString('de-DE')
  };

  for (const [key, value] of Object.entries(placeholders)) {
    html = html.replace(new RegExp(key, 'g'), value);
  }

  const tempHtmlPath = join(__dirname, 'temp-test-cv.html');
  const outputPdfPath = join(__dirname, 'output', 'test-cv-german-standard.pdf');
  
  writeFileSync(tempHtmlPath, html);
  console.log('Test HTML generated. Now converting to PDF...');

  try {
    execSync(`node generate-pdf.mjs ${tempHtmlPath} ${outputPdfPath} --format=a4`);
    console.log('✅ Test PDF generated: ' + outputPdfPath);
  } catch (err) {
    console.error('❌ PDF generation failed:', err.message);
  }
}

generateTestCV();
