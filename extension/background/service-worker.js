// Career-Ops Background Service Worker

const STORAGE_KEYS = {
  PROFILE: 'careerOpsProfile',
  CURRENT_JOB: 'currentJob',
  TRACKER: 'tracker',
  SETTINGS: 'settings'
};

// Default profile (synced with career-ops-main)
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
    german: 'B1'
  },
  targetRoles: [
    'AI/ML Engineer (Werkstudent)',
    'Computer Vision Engineer',
    'ML Engineer',
    'Robotics ML Engineer',
    'Python AI Developer',
    'MLOps',
    'Werkstudent AI',
    'Werkstudent Machine Learning'
  ],
  targetSkills: [
    'Python', 'PyTorch', 'TensorFlow', 'OpenCV', 'Computer Vision', 'ML', 'AI',
    'NLP', 'LLM', 'YOLO', 'ROS2', 'Gazebo', 'Docker', 'GCP', 'FastAPI', 'MLOps'
  ],
  targetComp: {
    werksudent: '€18-25/hr',
    fullTime: '€50K-65K'
  }
};

const DEFAULT_SETTINGS = {
  language: 'auto',
  cvVersion: 'werkstudent',
  autoDetect: true,
  notifications: true
};

// Initialize storage with defaults
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Career-Ops extension installed');
  
  // Set defaults
  await chrome.storage.local.set({
    [STORAGE_KEYS.PROFILE]: DEFAULT_PROFILE,
    [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
    [STORAGE_KEYS.TRACKER]: { applied: [], pending: [], responses: [] }
  });
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'getProfile':
      return await getProfile();
    
    case 'getSettings':
      return await getSettings();
    
    case 'saveJob':
      return await saveJob(message.job);
    
    case 'updateTracker':
      return await updateTracker(message.action, message.data);
    
    case 'openCareerOpsData':
      return await openCareerOpsData();
    
    case 'evaluateCurrentJob':
      return await triggerEvaluation();
    
    default:
      return { error: 'Unknown action' };
  }
}

async function getProfile() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.PROFILE, (result) => {
      resolve(result[STORAGE_KEYS.PROFILE] || DEFAULT_PROFILE);
    });
  });
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
      resolve(result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS);
    });
  });
}

async function saveJob(job) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [STORAGE_KEYS.CURRENT_JOB]: job
    }, () => {
      resolve({ success: true });
    });
  });
}

async function updateTracker(action, data) {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.TRACKER, (result) => {
      const tracker = result[STORAGE_KEYS.TRACKER] || { applied: [], pending: [], responses: [] };
      
      if (action === 'add') {
        if (!tracker.pending.find(j => j.url === data.job.url)) {
          tracker.pending.push(data.job);
        }
      } else if (action === 'apply') {
        const index = tracker.pending.findIndex(j => j.url === data.job.url);
        if (index > -1) {
          tracker.pending.splice(index, 1);
          tracker.applied.push({ ...data.job, appliedAt: new Date().toISOString() });
        }
      } else if (action === 'response') {
        const index = tracker.applied.findIndex(j => j.url === data.job.url);
        if (index > -1) {
          tracker.applied[index].response = data.response;
          tracker.responses.push({ ...tracker.applied[index], response: data.response });
        }
      }
      
      chrome.storage.local.set({ [STORAGE_KEYS.TRACKER]: tracker }, () => {
        resolve({ success: true, tracker });
      });
    });
  });
}

async function openCareerOpsData() {
  return new Promise((resolve) => {
    chrome.tabs.create({ url: 'https://github.com/sanket758/career-ops-main' }, () => {
      resolve({ success: true });
    });
  });
}

async function triggerEvaluation() {
  // This would trigger the popup to evaluate
  return new Promise((resolve) => {
    chrome.action.openPopup();
    resolve({ success: true });
  });
}

// Badge update for pending applications
async function updateBadge() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.TRACKER, (result) => {
      const tracker = result[STORAGE_KEYS.TRACKER] || { applied: [], pending: [], responses: [] };
      const pending = tracker.pending.length;
      
      if (pending > 0) {
        chrome.action.setBadgeText({ text: pending.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
      resolve({ success: true });
    });
  });
}

// Update badge on storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEYS.TRACKER]) {
    updateBadge();
  }
});