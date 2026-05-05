// Career-Ops Content Script
// Extracts job data from various job portals

(function() {
  'use strict';

  const PLATFORMS = {
    linkedin: {
      host: 'linkedin.com',
      paths: ['/jobs/']
    },
    stepstone: {
      host: 'stepstone.de',
      paths: ['/jobs/', '/stellen/']
    },
    xing: {
      host: 'xing.com',
      paths: ['/jobs/']
    },
    jobsde: {
      host: 'jobs.de',
      paths: ['/jobs/']
    },
    volkswagengroup: {
      host: 'jobs.volkswagen-group.com',
      paths: ['/cariad/', '/volkswagen/', '/porsche/', '/audi/']
    }
  };

  const DEFAULT_PROFILE = {
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
    preferences: {
      location: 'Berlin',
      remote: true,
      maxApplicants: 25,
      visaStatus: '§16b'
    }
  };

  let currentProfile = null;
  let lastEvaluatedJobTitle = null;
  let lastEvaluatedCompany = null;
  let lastEvaluatedScore = null;

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractJob') {
      const job = extractCurrentJob();
      sendResponse({ job });
    }
    return true;
  });

  function extractCurrentJob() {
    const url = window.location.href;

    if (url.includes('linkedin.com/jobs')) {
      return extractLinkedInJob();
    } else if (url.includes('stepstone.de')) {
      return extractStepstoneJob();
    } else if (url.includes('xing.com/jobs')) {
      return extractXingJob();
    } else if (url.includes('jobs.de')) {
      return extractJobsDeJob();
    } else if (url.includes('jobs.volkswagen-group.com')) {
      return extractVolkswagenGroupJob();
    }

    return null;
  }

  const LINKEDIN_SELECTORS = {
    title: [
      'h1.job-details-jobs-unified-top-card__job-title',
      'h2.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title',
      'h1.t-24.t-bold',
      '.job-details-jobs-unified-top-card__job-title',
      '[data-testid="job-detail-title"]',
      '.jobs-details__job-title'
    ],
    company: [
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
      '[data-testid="job-detail-company"]',
      '.job-details__company-name',
      '.jobs-details__company'
    ],
    location: [
      '.job-details-jobs-unified-top-card__primary-description-container .tvm__text:first-child',
      '.jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__primary-description .tvm__text',
      '.job-details-jobs-unified-top-card__workplace-type',
      '[data-testid="job-detail-location"]',
      '.job-details__location'
    ],
    workType: [
      '.job-details-jobs-unified-top-card__workplace-type',
      '.jobs-unified-top-card__workplace-type',
      '.ui-label--accent-3'
    ],
    employmentType: [
      '.job-details-jobs-unified-top-card__job-insight span',
      '.jobs-unified-top-card__job-insight .ui-label'
    ],
    description: [
      '#job-details',
      '.jobs-description__content .jobs-description-content__text',
      '.jobs-description',
      '.jobs-description__content',
      '.job-details-skill-match-status-bar__content'
    ],
    skills: [
      '.job-details-how-you-match__skills-item',
      '.jobs-pref-match-cards__items li',
      '.job-details-skill-match-status-bar__type'
    ],
    applicants: [
      '.jobs-unified-top-card__applicant-count',
      '.job-details-jobs-unified-top-card__applicant-count',
      'span.tvm__text--positive',
      '.jobs-details__applicant-count'
    ],
    salary: [
      '.job-details-jobs-unified-top-card__salary-info',
      '.compensation__salary',
      'span[data-tracking-control-name*="salary"]'
    ]
  };

  const STEPSTONE_SELECTORS = {
    title: ['h1[data-at="header-job-title"]', 'h1.js-position-title', 'h1', '[data-testid="job-title"]'],
    company: ['span[data-at="header-company-name"]', '.at-listing__list-icons_company-name', '[data-testid="company-name"]', '.job-header__company'],
    location: ['span[data-at="header-job-location"]', 'li[data-at="job-location"]', '[data-testid="location"]', '.job-header__location'],
    workType: ['span[data-at="header-employment-type"]', '[data-testid="employment-type"]'],
    description: ['div[data-at="jobad-description"]', '.at-section-text-description', '[data-testid="job-description"]', '.job-description__content']
  };

  function extractField(selectors) {
    if (!selectors) return null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    return null;
  }

  // LinkedIn Job Extraction
  function extractLinkedInJob() {
    const job = {
      title: extractField(LINKEDIN_SELECTORS.title) || '',
      company: extractField(LINKEDIN_SELECTORS.company) || '',
      location: extractField(LINKEDIN_SELECTORS.location) || '',
      description: extractField(LINKEDIN_SELECTORS.description) || '',
      workType: extractField(LINKEDIN_SELECTORS.workType) || '',
      employmentType: extractField(LINKEDIN_SELECTORS.employmentType) || '',
      applicants: extractField(LINKEDIN_SELECTORS.applicants) || '',
      salary: extractField(LINKEDIN_SELECTORS.salary) || '',
      url: window.location.href,
      jobId: new URLSearchParams(window.location.search).get('currentJobId') || '',
      skills: []
    };

    // Extract skills
    const skillElements = document.querySelectorAll(LINKEDIN_SELECTORS.skills[0]);
    if (skillElements.length > 0) {
      job.skills = Array.from(skillElements).map(e => e.textContent.trim());
    }

    // Map workType/employmentType to normalized fields for scoring
    job.remote = job.workType.toLowerCase().includes('remote') || 
                 job.location.toLowerCase().includes('remote') ||
                 job.workType.toLowerCase().includes('hybrid') ||
                 job.location.toLowerCase().includes('hybrid');
    
    const typeText = (job.employmentType + ' ' + job.title).toLowerCase();
    if (typeText.includes('full-time') || typeText.includes('vollzeit')) {
      job.type = 'full-time';
    } else if (typeText.includes('part-time') || typeText.includes('teilzeit')) {
      job.type = 'part-time';
    } else if (typeText.includes('intern') || typeText.includes('praktikum') || typeText.includes('student')) {
      job.type = 'intern';
    }

    console.log('[Career-Ops] LinkedIn extracted:', job);
    return job;
  }

  // Stepstone Job Extraction
  function extractStepstoneJob() {
    const job = {
      title: extractField(STEPSTONE_SELECTORS.title) || '',
      company: extractField(STEPSTONE_SELECTORS.company) || '',
      location: extractField(STEPSTONE_SELECTORS.location) || '',
      description: extractField(STEPSTONE_SELECTORS.description) || '',
      workType: extractField(STEPSTONE_SELECTORS.workType) || '',
      url: window.location.href,
      remote: false
    };

    job.remote = job.workType.toLowerCase().includes('remote') || 
                 job.location.toLowerCase().includes('remote') ||
                 job.description.toLowerCase().includes('home office');

    console.log('[Career-Ops] Stepstone extracted:', job);
    return job;
  }

  // XING Job Extraction
  function extractXingJob() {
    const job = {
      title: '',
      company: '',
      location: '',
      description: '',
      type: '',
      remote: false
    };

    try {
      // Title
      const titleEl = document.querySelector('h1, .job-header h2, [data-testid="job-title"]');
      job.title = titleEl?.textContent?.trim() || '';

      // Company
      const companyEl = document.querySelector('.employer-name, .job-header__company, [data-testid="company"]');
      job.company = companyEl?.textContent?.trim() || '';

      // Location
      const locationEl = document.querySelector('.job-location, .job-header__location, [data-testid="location"]');
      job.location = locationEl?.textContent?.trim() || '';

      // Description
      const descEl = document.querySelector('.job-description, .description-content');
      job.description = descEl?.textContent?.trim() || '';

      job.remote = job.location?.toLowerCase().includes('remote');
    } catch (error) {
      console.error('Career-Ops: Error extracting XING job', error);
    }

    return job;
  }

  // jobs.de Extraction
  function extractJobsDeJob() {
    const job = {
      title: '',
      company: '',
      location: '',
      description: '',
      type: '',
      remote: false
    };

    try {
      // Title
      const titleEl = document.querySelector('h1, .job-title, .job-header__title');
      job.title = titleEl?.textContent?.trim() || '';

      // Company
      const companyEl = document.querySelector('.company-name, .employer-name, .job-header__employer');
      job.company = companyEl?.textContent?.trim() || '';

      // Location
      const locationEl = document.querySelector('.job-location, .location, .meta-info__location');
      job.location = locationEl?.textContent?.trim() || '';

      // Description
      const descEl = document.querySelector('.job-description, .description__content');
      job.description = descEl?.textContent?.trim() || '';

      job.remote = job.location?.toLowerCase().includes('remote');
    } catch (error) {
      console.error('Career-Ops: Error extracting jobs.de job', error);
    }

    return job;
  }

  // Volkswagen Group Jobs Extraction
  function extractVolkswagenGroupJob() {
    const job = {
      title: '',
      company: '',
      location: '',
      description: '',
      type: '',
      remote: false
    };

    try {
      const pageText = document.body.innerText || '';
      const lines = pageText.split('\n').map(l => l.trim()).filter(l => l);

      // Title - usually near top after search section
      for (const line of lines) {
        if (line.includes('Internship') || line.includes('Working Student') || line.includes('Werkstudent')) {
          if (line.length > 20 && line.length < 200) {
            job.title = line;
            break;
          }
        }
      }

      // Fallback: look for h1
      if (!job.title) {
        const h1 = document.querySelector('h1');
        job.title = h1?.textContent?.trim() || '';
      }

      // Company from text
      const companyMatch = pageText.match(/Company:\s*([A-Z][a-zA-Z]+(?:\s+[A-Z]+)?)/);
      job.company = companyMatch?.[1]?.trim() || 'CARIAD SE';

      // Location - extract from text
      const locMatch = pageText.match(/Location:\s*([\w\s]+,?\s*[A-Z]{2},?\s*\d{5})/);
      job.location = locMatch?.[1]?.trim() || '';

      if (!job.location) {
        const ingolstadtMatch = pageText.match(/Ingolstadt|Stuttgart|Berlin|Munich/g);
        const deMatch = pageText.match(/DE/);
        if (ingolstadtMatch) {
          job.location = ingolstadtMatch[0] + (deMatch ? ', DE' : '');
        }
      }

      // Type (Working Model)
      if (pageText.includes('Full-time')) {
        job.type = 'full-time';
      } else if (pageText.includes('Part-time')) {
        job.type = 'part-time';
      }

      // Remote
      job.remote = pageText.includes('Remote') || pageText.includes('remote') || pageText.includes('Home Office');

      // Description - extract main content (skip headers/footers)
      const descStart = pageText.indexOf('YOUR TEAM');
      const descEnd = pageText.indexOf('Job ID:');
      if (descStart > 0 && descEnd > descStart) {
        job.description = pageText.substring(descStart, descEnd).trim();
      } else {
        // Extract from "WHAT YOU WILL DO" to "WHO YOU ARE"
        const whatStart = pageText.indexOf('WHAT YOU WILL DO');
        const whoStart = pageText.indexOf('WHO YOU ARE');
        if (whatStart > 0 && whoStart > whatStart) {
          job.description = pageText.substring(whatStart, whoStart).trim();
        }
      }

    } catch (error) {
      console.error('Career-Ops: Error extracting VW Group job', error);
    }

    return job;
  }

  async function getProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get('careerOpsProfile', (result) => {
        resolve(result.careerOpsProfile || DEFAULT_PROFILE);
      });
    });
  }

  function evaluateJob(job, profile) {
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

    // Penalty for full-time during semester unless specified as break/ferien
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
    // Bonus for conversion potential
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
    
    // Check extracted skills
    if (job.skills && job.skills.length > 0) {
      const jobSkillsLower = job.skills.map(s => s.toLowerCase());
      targetSkills.forEach(skill => {
        if (jobSkillsLower.some(js => js.includes(skill.toLowerCase()))) {
          skillsFound++;
        }
      });
    }
    
    // Check description
    if (skillsFound < 3) {
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

    console.log('[Career-Ops] Evaluation:', { score, factors, job, prof });
    return { score, factors, recommendation, job };
  }

  // Add floating button to page for quick actions
  function injectFloatingButton(initialScore = null, displayString = '🔍 Scanning...') {
    let button = document.getElementById('career-ops-fab');
    if (!button) {
      button = document.createElement('div');
      button.id = 'career-ops-fab';
      button.style.cssText = `
        position: fixed;
        bottom: 90px;
        right: 20px;
        z-index: 999999;
        cursor: grab;
        touch-action: none;
      `;
      document.body.appendChild(button);

      // --- Dragging logic start ---
      let isDragging = false;
      let hasDragged = false;
      let startX, startY, initialX, initialY;

      button.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return; // Only left click
        isDragging = true;
        hasDragged = false;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = button.getBoundingClientRect();
        button.style.bottom = 'auto';
        button.style.right = 'auto';
        button.style.left = rect.left + 'px';
        button.style.top = rect.top + 'px';
        
        initialX = rect.left;
        initialY = rect.top;
        
        document.body.style.userSelect = 'none';
        button.style.cursor = 'grabbing';
        button.setPointerCapture(e.pointerId);
      });

      button.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasDragged = true;
        }
        
        button.style.left = (initialX + dx) + 'px';
        button.style.top = (initialY + dy) + 'px';
      });

      button.addEventListener('pointerup', (e) => {
        if (isDragging) {
          isDragging = false;
          document.body.style.userSelect = '';
          button.style.cursor = 'grab';
          button.releasePointerCapture(e.pointerId);
          setTimeout(() => { hasDragged = false; }, 50);
        }
      });
      
      button.addEventListener('pointercancel', (e) => {
        if (isDragging) {
          isDragging = false;
          document.body.style.userSelect = '';
          button.style.cursor = 'grab';
          button.releasePointerCapture(e.pointerId);
          setTimeout(() => { hasDragged = false; }, 50);
        }
      });

      button.checkDragged = () => hasDragged;
      
      button.addEventListener('click', (e) => {
        if (button.checkDragged && button.checkDragged()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        chrome.runtime.sendMessage({ action: 'evaluateCurrentJob' });
      });
      // --- Dragging logic end ---
    }

    let bgColor = '#2563eb'; // blue
    if (initialScore !== null) {
      bgColor = initialScore >= 4.5 ? '#10b981' : // emerald-500
                initialScore >= 4.0 ? '#3b82f6' : // blue-500
                initialScore >= 3.5 ? '#f59e0b' : // amber-500
                                      '#ef4444';  // red-500
    }

    button.innerHTML = `
      <div style="
        background: ${bgColor};
        color: white;
        padding: 0 20px;
        height: 48px;
        border-radius: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-weight: 700;
        font-size: 15px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: transform 0.1s, box-shadow 0.1s;
        white-space: nowrap;
      "
      onmouseover="if(!this.checkDragged()) { this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.4)'; }"
      onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.3)';"
      >
        ${displayString}
      </div>
    `;
  }

  async function updateFloatingScore() {
    const job = extractCurrentJob();
    if (!job || !job.title) {
        if (lastEvaluatedJobTitle !== null) {
           lastEvaluatedJobTitle = null;
           lastEvaluatedCompany = null;
           lastEvaluatedScore = null;
           injectFloatingButton(null, "⚡ Select JD");
        }
        return; 
    }

    if (!currentProfile) {
      currentProfile = await getProfile();
    }

    const evaluation = evaluateJob(job, currentProfile);
    
    if (job.title === lastEvaluatedJobTitle && 
        job.company === lastEvaluatedCompany && 
        evaluation.score === lastEvaluatedScore) {
      return; 
    }

    lastEvaluatedJobTitle = job.title;
    lastEvaluatedCompany = job.company;
    lastEvaluatedScore = evaluation.score;
    
    injectFloatingButton(evaluation.score, `Score: ${evaluation.score.toFixed(1)}/5`);
  }

  // Inject floating button on job pages
  function maybeInjectButton() {
    const url = window.location.href;
    const platforms = [
      'linkedin.com/jobs',
      'stepstone.de',
      'xing.com/jobs',
      'jobs.de',
      'jobs.volkswagen-group.com'
    ];

    if (platforms.some(p => url.includes(p))) {
      // Initial injection
      injectFloatingButton(null, "⚡ Scanning...");
      
      // Reactive update using MutationObserver
      let timeout = null;
      const observer = new MutationObserver((mutations) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          updateFloatingScore();
        }, 500); // 500ms debounce
      });

      // Target specific containers if possible, otherwise body
      const target = document.querySelector('.jobs-search__job-details--wrapper, #job-details, main') || document.body;
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true
      });

      // Also keep a slow interval as fallback for some SPA transitions
      setInterval(() => {
        updateFloatingScore();
      }, 3000);
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeInjectButton);
  } else {
    maybeInjectButton();
  }

})();