// Career-Ops Options Page Logic

const STORAGE_KEYS = {
  PROFILE: 'careerOpsProfile',
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
    german: 'B1'
  },
  targetRoles: [
    'AI/ML Engineer (Werkstudent)',
    'Computer Vision Engineer',
    'ML Engineer',
    'Robotics ML Engineer',
    'Python AI Developer',
    'MLOps'
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

// State
let profile = null;
let settings = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadProfile();
  renderTargetRoles();
  attachEventListeners();
});

function attachEventListeners() {
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('resetBtn').addEventListener('click', resetSettings);
  document.getElementById('openMainBtn').addEventListener('click', openMain);
  document.getElementById('newRole').addEventListener('keypress', handleNewRole);
}

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
      settings = result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
      
      // Populate form
      document.getElementById('language').value = settings.language;
      document.getElementById('cvVersion').value = settings.cvVersion;
      document.getElementById('autoDetect').checked = settings.autoDetect;
      document.getElementById('notifications').checked = settings.notifications;
      
      resolve();
    });
  });
}

async function loadProfile() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.PROFILE, (result) => {
      profile = result[STORAGE_KEYS.PROFILE] || DEFAULT_PROFILE;
      
      // Populate form
      document.getElementById('fullName').value = profile.fullName || '';
      document.getElementById('email').value = profile.email || '';
      document.getElementById('phone').value = profile.phone || '';
      document.getElementById('location').value = profile.location || '';
      document.getElementById('linkedin').value = profile.linkedin || '';
      document.getElementById('github').value = profile.github || '';
      document.getElementById('visaStatus').value = profile.visaStatus || '';
      
      resolve();
    });
  });
}

function renderTargetRoles() {
  const container = document.getElementById('targetRoles');
  container.innerHTML = '';
  
  profile.targetRoles.forEach((role, index) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `
      ${role}
      <button class="remove" data-index="${index}">×</button>
    `;
    tag.querySelector('.remove').addEventListener('click', () => removeRole(index));
    container.appendChild(tag);
  });
}

function handleNewRole(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = e.target;
    const role = input.value.trim();
    
    if (role && !profile.targetRoles.includes(role)) {
      profile.targetRoles.push(role);
      renderTargetRoles();
    }
    
    input.value = '';
  }
}

function removeRole(index) {
  profile.targetRoles.splice(index, 1);
  renderTargetRoles();
}

async function saveSettings() {
  // Gather profile data
  profile = profile || {};
  profile.fullName = document.getElementById('fullName').value;
  profile.email = document.getElementById('email').value;
  profile.phone = document.getElementById('phone').value;
  profile.location = document.getElementById('location').value;
  profile.linkedin = document.getElementById('linkedin').value;
  profile.github = document.getElementById('github').value;
  profile.visaStatus = document.getElementById('visaStatus').value;
  
  // Gather settings
  settings = settings || {};
  settings.language = document.getElementById('language').value;
  settings.cvVersion = document.getElementById('cvVersion').value;
  settings.autoDetect = document.getElementById('autoDetect').checked;
  settings.notifications = document.getElementById('notifications').checked;
  
  // Save to storage
  await chrome.storage.local.set({
    [STORAGE_KEYS.PROFILE]: profile,
    [STORAGE_KEYS.SETTINGS]: settings
  });
  
  showNotification('Settings saved!', 'success');
}

async function resetSettings() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.PROFILE]: DEFAULT_PROFILE,
    [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
  });
  
  // Reload page
  window.location.reload();
}

function openMain() {
  chrome.tabs.create({ url: 'https://github.com/sanket758/career-ops-main' });
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#4caf50' : '#2196f3'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Add slideIn animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(style);