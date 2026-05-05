# Career-Ops Browser Extension

A Chrome extension that integrates Career-Ops directly into LinkedIn, Stepstone, XING, and other job portals.

## Features

- **Auto-detect job postings** on LinkedIn, Stepstone, XING, Jobs.de
- **Evaluate against your profile** with scoring (1-5)
- **Generate tailored CVs** (English + German)
- **Generate cover letters** 
- **Application tracker** with badge notifications
- **Floating action button** for quick evaluation

## Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

## Supported Platforms

| Platform | URL Patterns | Detection |
|----------|-------------|-----------|
| LinkedIn | `linkedin.com/jobs/*` | ✅ |
| Stepstone | `*.stepstone.de/*` | ✅ |
| XING | `xing.com/jobs/*` | ✅ |
| Jobs.de | `jobs.de/jobs/*` | ✅ |

## Usage

### On a Job Page
1. Navigate to any job posting on supported platforms
2. Click the Career-Ops icon (⚡) in the extension popup
3. Or use the floating button on the page
4. View evaluation score and recommendations

### Generate Documents
1. Click **Generate CV** for a tailored resume
2. Click **Cover Letter** for a personalized cover letter
3. Copy to clipboard and paste into application form

### Language Support
- Jobs in German: Generates German CV (`Werkstudent DE`)
- Jobs in English: Generates English CV

## Files

```
extension/
├── manifest.json          # Extension config (MV3)
├── popup/
│   ├── popup.html       # Main popup UI
│   ├── popup.css        # Styling
│   └── popup.js        # Logic
├── content/
│   ├── content.js      # Page extraction
│   └── content.css     # Injected styles
├── background/
│   └── service-worker.js # Background logic
├── options/
│   ├── options.html   # Settings page
│   ├── options.css    # Styling
│   └── options.js    # Logic
└── icons/              # Extension icons (add your own)
```

## Adding Icons

For the extension to look professional, add these icons:
- `icons/icon16.png` - 16x16
- `icons/icon48.png` - 48x48  
- `icons/icon128.png` - 128x128

You can generate these from a logo using an online tool.

## Configuration

Edit your profile in the extension options:
1. Click the extension icon
2. Click **Settings**
3. Update your details, target roles, and preferences

Your settings are stored locally in Chrome's extension storage.

## Integration with career-ops-main

The extension works alongside your main career-ops project:
- `data/applications.md` - Full application tracker
- `data/pipeline.md` - Pending URLs
- `reports/` - Evaluation reports
- `cv.md` - Full CV

Use the main OpenCode CLI for bulk operations and detailed reports.