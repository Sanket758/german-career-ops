// Career-Ops Popup Logic

const STORAGE_KEYS = {
  PROFILE: 'careerOpsProfile',
  CURRENT_JOB: 'currentJob',
  TRACKER: 'tracker',
  SETTINGS: 'settings'
};

const DEFAULT_PROFILE = {
  fullName: 'Sanket Sadashiv Gadge',
  email: 'gadgesanket75@gmail.com',
  phone: '+49 17676475359',
  location: 'Berlin, Germany',
  linkedin: 'linkedin.com/in/sanket758',
  github: 'github.com/sanket758',
  visaStatus: '§16b AufenthG - 20h/week',
  language: {
    english: 'C1',
    german: 'A2.1'
  },
  targetRoles: [
    'AI/ML Engineer (Werkstudent)',
    'Computer Vision Engineer',
    'ML Engineer',
    'Robotics ML Engineer',
    'Python AI Developer',
    'MLOps',
    'Werkstudent AI',
    'Werkstudent Machine Learning',
    'Software Engineer AI'
  ],
  targetSkills: [
    'Python', 'PyTorch', 'TensorFlow', 'OpenCV', 'Computer Vision', 'ML', 'AI',
    'NLP', 'LLM', 'YOLO', 'ROS2', 'Gazebo', 'Docker', 'GCP', 'FastAPI', 'MLOps'
  ],
  targetComp: {
    werksudent: '€18-25/hr',
    fullTime: '€50K-65K'
  },
  preferences: {
    location: 'Berlin',
    remote: true,
    maxApplicants: 25,
    visaStatus: '§16b'
  }
};

const DEFAULT_SETTINGS = {
  language: 'auto', // 'auto', 'en', 'de'
  cvVersion: 'werksudent',
  autoDetect: true
};

// State
let currentJob = null;
let profile = null;
let settings = null;
let tracker = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadProfile();
  await loadTracker();
  await detectCurrentJob();
  attachEventListeners();
  updateTrackerStats();
});

function attachEventListeners() {
  document.getElementById('evaluateBtn').addEventListener('click', handleEvaluate);
  document.getElementById('generateCvBtn').addEventListener('click', handleGenerateCV);
  document.getElementById('generateCoverBtn').addEventListener('click', handleGenerateCover);
  document.getElementById('openTrackerBtn').addEventListener('click', openTracker);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('modalClose').addEventListener('click', closeModal);
}

async function loadSettings() {
  settings = await getStorage(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
}

async function loadProfile() {
  profile = await getStorage(STORAGE_KEYS.PROFILE) || DEFAULT_PROFILE;
}

async function loadTracker() {
  tracker = await getStorage(STORAGE_KEYS.TRACKER) || { applied: [], pending: [], responses: [] };
}

async function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result[keys] || null);
    });
  });
}

async function setStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

async function detectCurrentJob() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const url = tab.url;
    let jobData = null;

    // Detect platform and extract job data
    if (url.includes('linkedin.com/jobs')) {
      jobData = await extractFromLinkedIn();
    } else if (url.includes('stepstone.de')) {
      jobData = await extractFromStepstone();
    } else if (url.includes('xing.com/jobs')) {
      jobData = await extractFromXing();
    } else if (url.includes('jobs.de')) {
      jobData = await extractFromJobsDe();
    }

    if (jobData) {
      currentJob = jobData;
      document.getElementById('jobPreview').innerHTML = renderJobPreview(jobData);
      enableButtons();
    }
  } catch (error) {
    console.error('Error detecting job:', error);
  }
}

async function extractFromLinkedIn() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractJob' }, (response) => {
        if (response?.job) {
          resolve({
            ...response.job,
            platform: 'linkedin',
            url: tab.url
          });
        } else {
          resolve(null);
        }
      });
    });
  });
}

async function extractFromStepstone() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractJob' }, (response) => {
        if (response?.job) {
          resolve({
            ...response.job,
            platform: 'stepstone',
            url: tab.url
          });
        } else {
          resolve(null);
        }
      });
    });
  });
}

async function extractFromXing() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractJob' }, (response) => {
        if (response?.job) {
          resolve({
            ...response.job,
            platform: 'xing',
            url: tab.url
          });
        } else {
          resolve(null);
        }
      });
    });
  });
}

async function extractFromJobsDe() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractJob' }, (response) => {
        if (response?.job) {
          resolve({
            ...response.job,
            platform: 'jobs.de',
            url: tab.url
          });
        } else {
          resolve(null);
        }
      });
    });
  });
}

function renderJobPreview(job) {
  if (!job || !job.title) {
    return `
      <div class="empty-state">
        <p>No job detected on this page.</p>
        <p style="font-size: 11px; margin-top: 8px; color: #666;">
          <strong>LinkedIn:</strong> Click on a job to view details, then use extension.<br>
          <strong>Stepstone:</strong> Open a job listing.
        </p>
      </div>
    `;
  }
  return `
    <div class="job-info">
      <div class="job-title">${job.title || 'Unknown Title'}</div>
      <div class="job-company">${job.company || 'Unknown Company'}</div>
      <div class="job-location">${job.location || 'Unknown Location'}</div>
    </div>
  `;
}

function enableButtons() {
  document.getElementById('evaluateBtn').disabled = false;
  document.getElementById('generateCvBtn').disabled = false;
  document.getElementById('generateCoverBtn').disabled = false;
}

function updateTrackerStats() {
  document.getElementById('appliedCount').textContent = tracker.applied.length;
  document.getElementById('pendingCount').textContent = tracker.pending.length;
  document.getElementById('responseCount').textContent = tracker.responses.length;
}

async function handleEvaluate() {
  if (!currentJob) return;

  setStatus('loading', 'Evaluating...');

  const evaluation = evaluateJob(currentJob);

  showModal('Evaluation Result', renderEvaluation(evaluation));

  setStatus('ready', 'Done');
}

function evaluateJob(job) {
  const prof = profile || DEFAULT_PROFILE;
  const factors = { 
    visa: 0, 
    contract: 0, 
    salary: 0, 
    location: 0, 
    skills: 0, 
    urgency: 0,
    title: 0
  };
  
  let score = 0;
  const maxScore = 5;

  const titleLower = (job.title || '').toLowerCase();
  const locationLower = (job.location || '').toLowerCase();
  const descriptionLower = (job.description || '').toLowerCase();

  // 1. Visa Compliance & Student Status (Max: 1.5)
  if (titleLower.includes('nebentätigkeit') || titleLower.includes('hiwi') || descriptionLower.includes('studentische hilfskraft')) {
    factors.visa = 1.5;
  } else if (titleLower.includes('werkstudent') || titleLower.includes('working student') || descriptionLower.includes('werkstudent')) {
    factors.visa = 1.0;
  } else if (titleLower.includes('praktikum') || titleLower.includes('intern')) {
    factors.visa = 0.5;
  }

  // Penalty for full-time during semester
  if ((titleLower.includes('full-time') || titleLower.includes('vollzeit')) && 
      !(descriptionLower.includes('ferien') || descriptionLower.includes('semester break'))) {
    factors.visa -= 2.0;
  }
  
  // Prohibited: Freelance
  if (titleLower.includes('freelance') || titleLower.includes('freiberuflich') || descriptionLower.includes('freelance')) {
    factors.visa = -5.0; 
  }
  score += factors.visa;

  // 2. Title Match (Max: 1.0)
  const targetRoles = (prof.targetRoles || DEFAULT_PROFILE.targetRoles).map(r => r.toLowerCase());
  const titleMatch = targetRoles.some(role => titleLower.includes(role));
  if (titleMatch) {
    factors.title = 1.0;
  } else if (titleLower.includes('ml') || titleLower.includes('ai') || titleLower.includes('machine learning') || titleLower.includes('computer vision')) {
    factors.title = 0.7;
  }
  score += factors.title;

  // 3. Contract Type & Career Path (Max: 1.0)
  if (descriptionLower.includes('unbefristet') || descriptionLower.includes('permanent')) {
    factors.contract = 1.0;
  } else if (descriptionLower.includes('befristet') || descriptionLower.includes('fixed-term')) {
    factors.contract = 0.5;
  }
  if (descriptionLower.includes('übernahme') || descriptionLower.includes('permanent employment after')) {
    factors.contract += 0.3;
  }
  score += Math.min(1.0, factors.contract);

  // 4. Location & Remote (Max: 0.5)
  const targetLoc = (prof.preferences?.location || 'Berlin').toLowerCase();
  if (locationLower.includes(targetLoc)) {
    factors.location += 0.25;
  }
  if (job.remote || locationLower.includes('remote') || locationLower.includes('home office') || locationLower.includes('hybrid')) {
    factors.location += 0.25;
  }
  score += factors.location;

  // 5. Skills Match (Max: 1.0)
  const targetSkills = prof.targetSkills || DEFAULT_PROFILE.targetSkills;
  let skillsFound = 0;
  
  if (job.skills && job.skills.length > 0) {
    const jobSkillsLower = job.skills.map(s => s.toLowerCase());
    targetSkills.forEach(skill => {
      if (jobSkillsLower.some(js => js.includes(skill.toLowerCase()))) {
        skillsFound++;
      }
    });
  }
  
  if (skillsFound < 3 && job.description) {
    targetSkills.forEach(skill => {
      const regex = new RegExp('\\b' + skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (regex.test(descriptionLower)) {
        skillsFound++;
      }
    });
  }
  factors.skills = Math.min(1.0, (skillsFound / 5) * 1.0);
  score += factors.skills;

  // 6. Urgency & Salary (Max: 0.5)
  if (job.applicants) {
    const countMatch = job.applicants.match(/(\d+)/);
    if (countMatch && parseInt(countMatch[1]) < (prof.preferences?.maxApplicants || 25)) {
      factors.urgency += 0.25;
    }
  }
  if (job.salary) {
    factors.urgency += 0.25;
  }
  score += factors.urgency;

  score = Math.max(0, Math.min(score, maxScore));
  const recommendation = score >= 4.5 ? 'Apply Now' :
                     score >= 3.8 ? 'Strong Match' :
                     score >= 3.0 ? 'Consider' :
                     score >= 2.0 ? 'Maybe' : 'Skip';

  return { score, factors, recommendation, job };
}

function renderEvaluation(eval_) {
  const scoreClass = eval_.score >= 4.5 ? 'excellent' :
                    eval_.score >= 3.8 ? 'good' :
                    eval_.score >= 3.0 ? 'moderate' : 'poor';

  return `
    <div class="modal-score">
      <div class="score-circle ${scoreClass}">${eval_.score.toFixed(1)}</div>
      <div class="score-details">
        <div class="score-label">${eval_.recommendation}</div>
        <div class="score-recommendation">${eval_.job.title}</div>
      </div>
    </div>
    <div class="modal-section">
      <h4>German Market Score Breakdown</h4>
      <div class="score-breakdown-list" style="font-size: 13px; color: #333;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Visa Compliance (§16b):</span> <span>${eval_.factors.visa >= 0 ? '+' : ''}${eval_.factors.visa.toFixed(1)}/1.5</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Title Match:</span> <span>+${eval_.factors.title.toFixed(1)}/1.0</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Contract/Path:</span> <span>+${Math.min(1.0, eval_.factors.contract).toFixed(1)}/1.0</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Location/Remote:</span> <span>+${eval_.factors.location.toFixed(1)}/0.5</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Skills Match:</span> <span>+${eval_.factors.skills.toFixed(1)}/1.0</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Urgency/Salary:</span> <span>+${eval_.factors.urgency.toFixed(1)}/0.5</span>
        </div>
      </div>
    </div>
  `;
}

async function handleGenerateCV() {
  if (!currentJob) return;

  setStatus('loading', 'Generating CV...');

  const cv = generateCV(currentJob);
  const language = detectLanguage(currentJob.title || '');

  showModal('Generated CV', renderCV(cv, language));

  setStatus('ready', 'CV Ready');
}

function detectLanguage(text) {
  if (settings.language !== 'auto') return settings.language;

  // Check for German keywords
  const germanKeywords = ['(m/w/d)', '(f/m/d)', 'werkstudent', 'praktikum', 'teilzeit', 'vollzeit', 'mitarbeiter', 'ingenieur', 'entwickler'];
  const isGerman = germanKeywords.some(kw => text.toLowerCase().includes(kw));

  return isGerman ? 'de' : 'en';
}

function generateCV(job) {
  const language = detectLanguage(job.title || '');
  const isGerman = language === 'de';

  const cv = {
    language,
    version: settings.cvVersion,
    content: isGerman ? generateGermanCV(job) : generateEnglishCV(job)
  };

  return cv;
}

function generateEnglishCV(job) {
  return `
    <h1>Curriculum Vitae</h1>
    
    <div class="section">
      <div class="section-title">Personal Information</div>
      <div class="row"><div class="col-left">Name</div><div class="col-right">Sanket Sadashiv Gadge</div></div>
      <div class="row"><div class="col-left">Address</div><div class="col-right">Berlin, Germany</div></div>
      <div class="row"><div class="col-left">Phone</div><div class="col-right">+49 17676475359</div></div>
      <div class="row"><div class="col-left">Email</div><div class="col-right">gadgesanket75@gmail.com</div></div>
      <div class="row"><div class="col-left">LinkedIn</div><div class="col-right">linkedin.com/in/sanket758</div></div>
    </div>

    <div class="section">
      <div class="section-title">Profile</div>
      <div class="row">
        <div class="col-left"></div>
        <div class="col-right">
          AI/ML Engineer with 4+ years deploying production Computer Vision and NLP systems (Python, PyTorch, TensorFlow). Shipped object detection pipelines serving 500+ retail SKUs at 95%+ precision. Pursuing MSc in AI in Berlin with focus on ROS2 and Robotics.
        </div>
      </div>
    </div>

    <div class="section">
        <div class="section-title">Professional Experience</div>
        <div class="row">
            <div class="col-left">Oct 2021 – Sep 2024</div>
            <div class="col-right">
                <div class="bold">AI/ML Engineer, Big Rattle Technologies, Mumbai, India</div>
                <ul>
                    <li>Led team of 4 building YOLOv5/Detectron2 shelf-monitoring CV pipelines for Colgate-Palmolive and Dabur</li>
                    <li>Achieved 95%+ detection accuracy across 500+ SKUs, reduced manual audits by 60%</li>
                    <li>Reduced inference latency 50% via Python multiprocessing across 4 GPU workers</li>
                    <li>Deployed zero-downtime model serving on GCP Cloud Run via Terraform</li>
                </ul>
            </div>
        </div>
        <div class="row">
            <div class="col-left">Nov 2020 – Sep 2021</div>
            <div class="col-right">
                <div class="bold">AI/ML Engineer, EAZR Digipayments, Mumbai, India</div>
                <ul>
                    <li>Built OCR pipelines for PAN/Aadhaar verification (OpenCV)</li>
                    <li>Created credit scoring engine with spaCy achieving 92% accuracy</li>
                </ul>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Education</div>
        <div class="row">
            <div class="col-left">Feb 2025 – Aug 2026</div>
            <div class="col-right">
                <div class="bold">MSc Artificial Intelligence, Berlin School of Business and Innovation</div>
                <ul>
                    <li>Focus: Computer Vision, Robotics (ROS2), Deep Learning</li>
                    <li>Visa: §16b AufenthG (20h/week)</li>
                </ul>
            </div>
        </div>
        <div class="row">
            <div class="col-left">Aug 2017 – Sep 2020</div>
            <div class="col-right">
                <div class="bold">BSc Computer Science, Mumbai University</div>
                <ul>
                    <li>CGPA: 7.32/10</li>
                </ul>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Skills & Competencies</div>
        <div class="row">
            <div class="col-left">Computer Vision</div>
            <div class="col-right">YOLO, Detectron2, OpenCV, PyTorch, TensorFlow</div>
        </div>
        <div class="row">
            <div class="col-left">NLP / ML</div>
            <div class="col-right">spaCy, FAISS, LangChain, Mistral 7B, RAG</div>
        </div>
        <div class="row">
            <div class="col-left">Backend</div>
            <div class="col-right">FastAPI, Docker, GCP Cloud Run, Terraform</div>
        </div>
        <div class="row">
            <div class="col-left">Robotics</div>
            <div class="col-right">ROS2, Gazebo, LIDAR, Pose Estimation</div>
        </div>
        <div class="row">
            <div class="col-left">Languages</div>
            <div class="col-right">English (C1), German (A2.1)</div>
        </div>
    </div>
  `;
}

function generateGermanCV(job) {
  return `
    <h1>Lebenslauf</h1>
    
    <div class="section">
      <div class="section-title">Persönliche Daten</div>
      <div class="row"><div class="col-left">Name</div><div class="col-right">Sanket Sadashiv Gadge</div></div>
      <div class="row"><div class="col-left">Anschrift</div><div class="col-right">Berlin, Deutschland</div></div>
      <div class="row"><div class="col-left">Telefon</div><div class="col-right">+49 17676475359</div></div>
      <div class="row"><div class="col-left">E-Mail</div><div class="col-right">gadgesanket75@gmail.com</div></div>
      <div class="row"><div class="col-left">LinkedIn</div><div class="col-right">linkedin.com/in/sanket758</div></div>
    </div>

    <div class="section">
      <div class="section-title">Profil</div>
      <div class="row">
        <div class="col-left"></div>
        <div class="col-right">
          KI/ML-Engineer mit 4+ Jahren Erfahrung in der Entwicklung von Produktionssystemen für Computer Vision und NLP (Python, PyTorch, TensorFlow). Entwicklung von Objekterkennungspipelines für 500+ Retail SKUs mit 95%+ Präzision. Aktuell MSc AI in Berlin mit Fokus auf ROS2 und Robotik.
        </div>
      </div>
    </div>

    <div class="section">
        <div class="section-title">Praktische Erfahrung</div>
        <div class="row">
            <div class="col-left">Okt 2021 – Sep 2024</div>
            <div class="col-right">
                <div class="bold">AI/ML Engineer, Big Rattle Technologies, Mumbai, Indien</div>
                <ul>
                    <li>Leitung eines Teams von 4 bei der Entwicklung von YOLOv5/Detectron2 CV-Pipelines</li>
                    <li>95%+ Erkennungsgenauigkeit bei 500+ SKUs, 60% Reduzierung manueller Audits</li>
                    <li>50% Reduzierung der Inferenzlatenz via Python Multiprocessing</li>
                    <li>Zero-Downtime Deployment auf GCP Cloud Run via Terraform</li>
                </ul>
            </div>
        </div>
        <div class="row">
            <div class="col-left">Nov 2020 – Sep 2021</div>
            <div class="col-right">
                <div class="bold">AI/ML Engineer, EAZR Digipayments, Mumbai, Indien</div>
                <ul>
                    <li>OCR-Pipelines für PAN/Aadhaar Verifizierung (OpenCV)</li>
                    <li>Credit Scoring Engine mit spaCy: 92% Genauigkeit</li>
                </ul>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Schulbildung</div>
        <div class="row">
            <div class="col-left">Feb 2025 – Aug 2026</div>
            <div class="col-right">
                <div class="bold">MSc Artificial Intelligence, Berlin School of Business and Innovation</div>
                <ul>
                    <li>Schwerpunkte: Computer Vision, Robotik (ROS2), Deep Learning</li>
                    <li>Aufenthaltserlaubnis: §16b AufenthG (20h/Woche)</li>
                </ul>
            </div>
        </div>
        <div class="row">
            <div class="col-left">Aug 2017 – Sep 2020</div>
            <div class="col-right">
                <div class="bold">BSc Computer Science, Mumbai University</div>
                <ul>
                    <li>CGPA: 7.32/10</li>
                </ul>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Persönliche Fähigkeiten und Kompetenzen</div>
        <div class="row">
            <div class="col-left">Computer Vision</div>
            <div class="col-right">YOLO, Detectron2, OpenCV, PyTorch, TensorFlow</div>
        </div>
        <div class="row">
            <div class="col-left">NLP / ML</div>
            <div class="col-right">spaCy, FAISS, LangChain, Mistral 7B, RAG</div>
        </div>
        <div class="row">
            <div class="col-left">Backend</div>
            <div class="col-right">FastAPI, Docker, GCP Cloud Run, Terraform</div>
        </div>
        <div class="row">
            <div class="col-left">Robotik</div>
            <div class="col-right">ROS2, Gazebo, LIDAR, Pose Estimation</div>
        </div>
        <div class="row">
            <div class="col-left">Sprachkenntnisse</div>
            <div class="col-right">Englisch (C1), Deutsch (A2.1)</div>
        </div>
    </div>

    <div style="margin-top: 40px;">
        Berlin, den ${new Date().toLocaleDateString('de-DE')}
        <br><br><br>
        Sanket Gadge
    </div>
  `;
}

function renderCV(cv, language) {
  window.currentPrintPayload = cv.content;
  return `
    <div class="cv-preview" style="max-height: 400px; overflow-y: auto; background: #fff; padding: 15px; border: 1px solid #ccc; font-family: Arial, sans-serif; font-size: 11pt;">
      ${cv.content}
    </div>
    <button class="btn btn-primary copy-btn" onclick="triggerPdfDownload('Lebenslauf_Sanket_Gadge.pdf')">
      Download PDF
    </button>
  `;
}

async function handleGenerateCover() {
  if (!currentJob) return;

  setStatus('loading', 'Generating Cover Letter...');

  const cover = generateCoverLetter(currentJob);

  showModal('Cover Letter', renderCoverLetter(cover));

  setStatus('ready', 'Cover Ready');
}

function generateCoverLetter(job) {
  const language = detectLanguage(job.title || '');
  const isGerman = language === 'de';

  const cover = {
    language,
    content: isGerman ? generateGermanCover(job) : generateEnglishCover(job)
  };

  return cover;
}

function generateEnglishCover(job) {
  const date = new Date().toLocaleDateString('en-US');
  return `
      <div style="margin-top: 50px;">
        <div class="bold">Sanket Gadge</div>
        <div>Berlin, Germany</div>
        <div>gadgesanket75@gmail.com</div>
        <div>+49 17676475359</div>
      </div>
      
      <div style="margin-top: 50px; margin-bottom: 30px;">
        <div class="bold">${job.company || 'Company'}</div>
        <div>Hiring Team</div>
        <div>${job.location || 'Germany'}</div>
      </div>

      <div style="margin-bottom: 40px; text-align: right;">
        Berlin, ${date}
      </div>

      <div class="bold" style="margin-bottom: 20px;">Application for ${job.title || 'AI/ML Engineer'}</div>

      <p>Dear Hiring Manager,</p>

      <p>I am writing to apply for the ${job.title || 'AI/ML Engineer'} position at ${job.company || 'your company'}. With 4+ years developing production Computer Vision and NLP systems at scale, and hands-on experience with YOLO, Detectron2, PyTorch, and GCP deployment, I am confident that I can contribute from day one.</p>

      <p>In my role at Big Rattle Technologies, I led a team of 4 building shelf-monitoring CV pipelines that achieved 95%+ accuracy across 500+ SKUs for enterprise clients including Colgate-Palmolive and Dabur. I reduced inference latency by 50% via Python multiprocessing and deployed zero-downtime model serving on GCP Cloud Run.</p>

      <p>Currently pursuing MSc in AI at Berlin School of Business and Innovation, I am deepening my expertise in ROS2 and robotics. This enables me to bring both applied industry experience and modern academic approaches to your team.</p>

      <p>I hold a §16b residence permit, eligible for 20h/week as a working student. I am available for an interview to discuss how my background matches your needs.</p>

      <p style="margin-top: 40px;">Best regards,</p>
      
      <div style="margin-top: 40px;">Sanket Gadge</div>
  `;
}

function generateGermanCover(job) {
  const date = new Date().toLocaleDateString('de-DE');
  return `
      <div style="margin-top: 50px;">
        <div class="bold">Sanket Gadge</div>
        <div>Berlin, Deutschland</div>
        <div>gadgesanket75@gmail.com</div>
        <div>+49 17676475359</div>
      </div>
      
      <div style="margin-top: 50px; margin-bottom: 30px;">
        <div class="bold">${job.company || 'Unternehmen'}</div>
        <div>Personalabteilung</div>
        <div>${job.location || 'Deutschland'}</div>
      </div>

      <div style="margin-bottom: 40px; text-align: right;">
        Berlin, ${date}
      </div>

      <div class="bold" style="margin-bottom: 20px;">Bewerbung als ${job.title || 'AI/ML Engineer'}</div>

      <p>Sehr geehrte Damen und Herren,</p>

      <p>hiermit bewerbe ich mich um die Stelle als ${job.title || 'AI/ML Engineer'} bei ${job.company || 'Ihnen'}. Mit mehr als 4 Jahren Erfahrung in der Entwicklung von Produktionssystemen für Computer Vision und NLP und praktischer Erfahrung mit YOLO, Detectron2, PyTorch und GCP-Deployment bin ich überzeugt, dass ich vom ersten Tag an einen Beitrag leisten kann.</p>

      <p>Bei Big Rattle Technologies leitete ich ein Team von 4 Personen, das CV-Pipelines entwickelte, die eine Genauigkeit von über 95% bei mehr als 500 SKUs für Unternehmenskunden wie Colgate-Palmolive und Dabur erreichten. Ich reduzierte die Inferenzlatenz um 50% durch Python Multiprocessing und integrierte Cloud-Infrastruktur.</p>

      <p>Ich studiere derzeit MSc Artificial Intelligence an der Berlin School of Business and Innovation und vertiefe mein Wissen in ROS2 und Robotik. Dadurch bringe ich sowohl praktische Erfahrung aus der Industrie als auch aktuelles akademisches Wissen ein.</p>

      <p>Ich besitze eine Aufenthaltserlaubnis nach §16b, die mich zu 20h/Woche als Werkstudent berechtigt. Für ein Vorstellungsgespräch stehe ich jederzeit gerne zur Verfügung.</p>

      <p style="margin-top: 40px;">Mit freundlichen Grüßen,</p>
      
      <div style="margin-top: 40px;">Sanket Gadge</div>
  `;
}

function renderCoverLetter(cover) {
  window.currentPrintPayload = cover.content;
  return `
    <div class="cover-preview" style="max-height: 400px; overflow-y: auto; background: #fff; padding: 15px; border: 1px solid #ccc; font-family: Arial, sans-serif; font-size: 11pt;">
      ${cover.content}
    </div>
    <button class="btn btn-primary copy-btn" onclick="triggerPdfDownload('Anschreiben_Sanket_Gadge.pdf')">
      Download PDF
    </button>
  `;
}

function openTracker() {
  chrome.tabs.create({ url: 'data/applications.md' });
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function showModal(title, content) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = content;
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

function setStatus(state, text) {
  const status = document.getElementById('status');
  status.className = 'status ' + state;
  status.textContent = text;
}

// Global PDF Download function triggered by inline handlers
window.triggerPdfDownload = function(title) {
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { margin: 20mm; size: A4; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; line-height: 1.4; max-width: 800px; margin: 0 auto; -webkit-print-color-adjust: exact; }
          h1 { font-size: 24px; text-transform: uppercase; font-weight: normal; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 12pt; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 15px; text-transform: uppercase; }
          .row { display: flex; margin-bottom: 12px; page-break-inside: avoid; }
          .col-left { width: 160px; font-weight: normal; padding-right: 15px; }
          .col-right { flex: 1; }
          .bold { font-weight: bold; }
          ul { margin-top: 5px; margin-bottom: 0; padding-left: 20px; }
          li { margin-bottom: 5px; }
          p { margin-top: 0; margin-bottom: 12px; }
        </style>
      </head>
      <body onload="setTimeout(() => window.print(), 300);">
        ${window.currentPrintPayload}
      </body>
    </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url: url });
};