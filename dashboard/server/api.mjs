#!/usr/bin/env node
/**
 * Career-Ops Germany Dashboard API Server.
 *
 * Provides REST endpoints to read/write career-ops data files,
 * trigger Gmail sync, and run portal scans.
 *
 * Usage:
 *   node dashboard/server/api.mjs
 *
 * Endpoints:
 *   GET  /api/applications    — Read applications tracker
 *   GET  /api/burn-list       — Read burn list
 *   GET  /api/pipeline        — Read pipeline inbox
 *   GET  /api/session         — Read session state
 *   GET  /api/knowledge-base  — Read knowledge base
 *   GET  /api/profile         — Read profile config
 *   GET  /api/scan-history    — Read scan history
 *   GET  /api/reports         — List evaluation reports
 *   POST /api/gmail-sync      — Trigger Gmail sync
 *   POST /api/scan            — Trigger portal scan
 *   POST /api/applications    — Add a new application
 *   PUT  /api/applications/:id — Update application status
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Data file paths
const DATA = {
  applications: path.join(PROJECT_ROOT, 'data', 'applications.md'),
  burnList: path.join(PROJECT_ROOT, 'data', 'burn-list.tsv'),
  pipeline: path.join(PROJECT_ROOT, 'data', 'pipeline.md'),
  session: path.join(PROJECT_ROOT, 'data', 'session-state.json'),
  knowledgeBase: path.join(PROJECT_ROOT, 'data', 'knowledge-base.json'),
  profile: path.join(PROJECT_ROOT, 'config', 'profile.yml'),
  scanHistory: path.join(PROJECT_ROOT, 'data', 'scan-history.tsv'),
  followUps: path.join(PROJECT_ROOT, 'data', 'follow-ups.md'),
  vocabHistory: path.join(PROJECT_ROOT, 'data', 'vocab-history.tsv'),
};

const app = express();
app.use(cors());
app.use(express.json());

// Serve static artifacts
app.use('/output', express.static(path.join(PROJECT_ROOT, 'output')));
app.use('/reports', express.static(path.join(PROJECT_ROOT, 'reports')));

// ──────────────────────────────────────
// Utility: Parse applications.md table
// ──────────────────────────────────────
/**
 * Parse the markdown table from applications.md into structured data.
 * @returns {Array<object>} Parsed application entries.
 */
function parseApplications() {
  if (!fs.existsSync(DATA.applications)) return [];

  const content = fs.readFileSync(DATA.applications, 'utf8');
  const lines = content.split('\n');
  const apps = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.includes('Company') || trimmed.includes('---')) {
      continue;
    }

    const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 6) {
      apps.push({
        id: parts[0] || '',
        date: parts[1] || '',
        company: parts[2] || '',
        role: parts[3] || '',
        score: parts[4] || '0.0/5',
        status: parts[5] || '',
        pdf: parts[6] || '',
        report: parts[7] || '',
        notes: parts[8] || '',
        job_url: extractFirstUrl(parts.slice(8).join(' ')),
      });
    }
  }

  return apps;
}

function extractFirstUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s|)]+/);
  return match ? match[0] : '';
}

/**
 * Parse burn-list.tsv into structured data.
 * @returns {Array<object>} Burn list entries.
 */
function parseBurnList() {
  if (!fs.existsSync(DATA.burnList)) return [];

  const content = fs.readFileSync(DATA.burnList, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  if (lines.length <= 1) return []; // Header only

  const headers = lines[0].split('\t');
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const parts = line.split('\t');
    const entry = {};
    headers.forEach((h, i) => {
      entry[h.trim()] = (parts[i] || '').trim();
    });
    return entry;
  });
}

/**
 * Parse pipeline.md for pending URLs.
 * @returns {Array<string>} Pending URLs.
 */
function parsePipeline() {
  if (!fs.existsSync(DATA.pipeline)) return [];

  const content = fs.readFileSync(DATA.pipeline, 'utf8');
  const urls = [];
  let inPending = false;

  for (const line of content.split('\n')) {
    if (line.includes('## Pending')) {
      inPending = true;
      continue;
    }
    if (inPending && line.startsWith('##')) {
      break;
    }
    if (inPending) {
      const trimmed = line.trim();
      if (trimmed.startsWith('http') || trimmed.startsWith('- http')) {
        urls.push(trimmed.replace(/^-\s*/, ''));
      }
    }
  }

  return urls;
}

/**
 * Parse a simple YAML file into key-value pairs.
 * @param {string} content - YAML content.
 * @returns {object} Parsed config.
 */
function parseYaml(content) {
  const result = {};
  const lines = content.split('\n');
  let section = null;
  let subsection = null;

  for (const line of lines) {
    if (line.trim().startsWith('#') || !line.trim()) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0 && trimmed.includes(':')) {
      const [key, ...rest] = trimmed.split(':');
      const val = rest.join(':').trim();
      section = key.trim();
      subsection = null;
      result[section] = val && !val.startsWith('#') ? val.replace(/^["']|["']$/g, '') : {};
    } else if (indent === 2 && trimmed.includes(':') && section) {
      const [key, ...rest] = trimmed.split(':');
      const val = rest.join(':').trim();
      const k = key.trim();
      if (typeof result[section] !== 'object') result[section] = {};
      if (val && !val.startsWith('#')) {
        result[section][k] = val.replace(/^["']|["']$/g, '');
      } else {
        result[section][k] = [];
        subsection = k;
      }
    } else if (indent >= 4 && trimmed.startsWith('- ') && section && subsection) {
      const item = trimmed.slice(2).trim();
      if (Array.isArray(result[section]?.[subsection])) {
        result[section][subsection].push(item);
      }
    }
  }
  return result;
}

/**
 * List evaluation reports from reports/ directory.
 * @returns {Array<object>} Report metadata.
 */
function listReports() {
  const reportsDir = path.join(PROJECT_ROOT, 'reports');
  if (!fs.existsSync(reportsDir)) return [];

  return fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const fullPath = path.join(reportsDir, f);
      // Skip broken symlinks
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        return null;
      }
      if (!stat) return null;
      return {
        filename: f,
        modified: stat.mtime.toISOString(),
        size: stat.size,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

// ──────────────────────────────────────
// API Routes
// ──────────────────────────────────────

app.get('/api/applications', (_req, res) => {
  res.json({ applications: parseApplications() });
});

app.get('/api/burn-list', (_req, res) => {
  res.json({ entries: parseBurnList() });
});

app.get('/api/pipeline', (_req, res) => {
  res.json({ urls: parsePipeline() });
});

app.get('/api/session', (_req, res) => {
  if (!fs.existsSync(DATA.session)) {
    return res.json({ initialized: false });
  }
  const session = JSON.parse(fs.readFileSync(DATA.session, 'utf8'));
  res.json(session);
});

app.get('/api/knowledge-base', (_req, res) => {
  if (!fs.existsSync(DATA.knowledgeBase)) {
    return res.status(404).json({ error: 'Knowledge base not found' });
  }
  const kb = JSON.parse(fs.readFileSync(DATA.knowledgeBase, 'utf8'));
  res.json(kb);
});

app.get('/api/profile', (_req, res) => {
  if (!fs.existsSync(DATA.profile)) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  const content = fs.readFileSync(DATA.profile, 'utf8');
  res.json(parseYaml(content));
});

app.get('/api/scan-history', (_req, res) => {
  if (!fs.existsSync(DATA.scanHistory)) {
    return res.json({ entries: [] });
  }
  const content = fs.readFileSync(DATA.scanHistory, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length <= 1) return res.json({ entries: [] });

  const headers = lines[0].split('\t');
  const entries = lines.slice(1).map(line => {
    const parts = line.split('\t');
    const entry = {};
    headers.forEach((h, i) => { entry[h.trim()] = (parts[i] || '').trim(); });
    return entry;
  });
  res.json({ entries });
});

app.get('/api/reports', (_req, res) => {
  res.json({ reports: listReports() });
});

// Aggregate stats endpoint for dashboard
app.get('/api/stats', (_req, res) => {
  const apps = parseApplications();
  const burnList = parseBurnList();
  const pipeline = parsePipeline();
  const reports = listReports();

  const statusCounts = {};
  for (const app of apps) {
    const s = app.status || 'Unknown';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  res.json({
    total_applications: apps.length,
    status_breakdown: statusCounts,
    burn_list_count: burnList.length,
    pipeline_count: pipeline.length,
    reports_count: reports.length,
    last_updated: new Date().toISOString(),
  });
});

// POST: Add new application
app.post('/api/applications', (req, res) => {
  const { company, role, date, score, status, notes } = req.body;
  if (!company || !role) {
    return res.status(400).json({ error: 'Company and role required' });
  }

  const apps = parseApplications();
  const maxId = apps.reduce((max, a) => Math.max(max, parseInt(a.id) || 0), 0);
  const newId = maxId + 1;
  const newDate = date || new Date().toISOString().slice(0, 10);
  const newLine = `| ${newId} | ${newDate} | ${company} | ${role} | ${score || '0.0/5'} | ${status || 'Evaluated'} | ❌ | N/A | ${notes || ''} |`;

  let content = fs.readFileSync(DATA.applications, 'utf8');
  content = content.trimEnd() + '\n' + newLine + '\n';
  fs.writeFileSync(DATA.applications, content);

  res.json({ success: true, id: newId });
});

// PUT: Update application status
app.put('/api/applications/:id', (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!fs.existsSync(DATA.applications)) {
    return res.status(404).json({ error: 'Tracker not found' });
  }

  let content = fs.readFileSync(DATA.applications, 'utf8');
  const lines = content.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('|') || trimmed.includes('Company') || trimmed.includes('---')) continue;

    const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
    if (parts[0] === id) {
      if (status) parts[5] = status;
      if (notes) parts[8] = notes;
      lines[i] = '| ' + parts.join(' | ') + ' |';
      found = true;
      break;
    }
  }

  if (!found) {
    return res.status(404).json({ error: `Application #${id} not found` });
  }

  fs.writeFileSync(DATA.applications, lines.join('\n'));
  res.json({ success: true });
});

// POST: Gmail sync
app.post('/api/gmail-sync', (_req, res) => {
  const script = path.join(PROJECT_ROOT, 'integrations', 'gmail_bridge.py');
  if (!fs.existsSync(script)) {
    return res.status(404).json({ error: 'Gmail bridge script not found' });
  }

  res.json({ status: 'started', message: 'Gmail sync initiated' });

  // Run async — results will be reflected in data files
  exec(`python3 "${script}"`, { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
    if (err) {
      console.error('Gmail sync error:', stderr);
    } else {
      console.log('Gmail sync output:', stdout);
    }
  });
});

let scanRunning = false;

// POST: Portal scan
app.post('/api/scan', (_req, res) => {
  if (scanRunning) {
    return res.status(409).json({
      status: 'running',
      message: 'A portal scan is already running.',
    });
  }

  scanRunning = true;
  exec('node scripts/scan.mjs', { cwd: PROJECT_ROOT, timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
    scanRunning = false;
    if (err) {
      console.error('Portal scan failed:', stderr || err.message);
      return;
    }
    console.log('Portal scan output:', stdout);
  });

  res.json({
    status: 'started',
    message: 'Portal scan started. New matches will appear in the pipeline when it finishes.',
  });
});

// POST: Init session
app.post('/api/init-session', (_req, res) => {
  const script = path.join(PROJECT_ROOT, 'scripts', 'init-session.mjs');

  exec(`node "${script}" --force`, { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr || err.message });
    }
    res.json({ success: true, output: stdout });
  });
});

// POST: Generate CV (DE + EN dual-language)
app.post('/api/generate-cv', (req, res) => {
  const { company, role, lang = 'both', includeProjects = false, maxBullets = 3 } = req.body;
  if (!company) {
    return res.status(400).json({ error: 'company is required' });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const results = [];
  const langs = lang === 'both' ? ['de', 'en'] : [lang];

  const generateOne = (l, cb) => {
    const htmlFile = path.join(PROJECT_ROOT, 'temp', `cv-${slug}-${l}-${dateStr}.html`);
    const pdfFile = path.join(PROJECT_ROOT, 'output', `cv-${slug}-${l}-${dateStr}.pdf`);

    const args = [
      path.join(PROJECT_ROOT, 'scripts', 'generate-cv-html.mjs'),
      `--company=${company}`,
      `--lang=${l}`,
      `--output=${htmlFile}`,
      `--max-bullets=${maxBullets}`,
    ];
    if (role) args.push(`--role=${role}`);
    if (includeProjects) args.push('--include-projects');

    exec(`node ${args.join(' ')}`, { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
      if (err) return cb(new Error(stderr || err.message));

      // Now generate PDF
      const pdfArgs = [
        path.join(PROJECT_ROOT, 'scripts', 'generate-pdf.mjs'),
        htmlFile,
        pdfFile,
        '--max-pages=1',
        '--type=cv',
      ];
      exec(`node ${pdfArgs.join(' ')}`, { cwd: PROJECT_ROOT }, (err2, _o, stderr2) => {
        if (err2) {
          // Still return HTML path so user can download
          results.push({ lang: l, html: htmlFile, pdf: null, error: stderr2 || err2.message });
        } else {
          results.push({ lang: l, html: htmlFile, pdf: pdfFile, filename: path.basename(pdfFile) });
        }
        cb(null);
      });
    });
  };

  const runAll = (remaining, done) => {
    if (remaining.length === 0) return done();
    generateOne(remaining[0], () => runAll(remaining.slice(1), done));
  };

  runAll(langs, () => {
    res.json({ success: true, results });
  });
});

// POST: Generate cover letter
app.post('/api/generate-cover-letter', (req, res) => {
  const { company, role, jobUrl, companySnippet, motivation, lang = 'de' } = req.body;
  if (!company) {
    return res.status(400).json({ error: 'company is required' });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Write a minimal cover letter MD skeleton to output/
  const mdPath = path.join(PROJECT_ROOT, 'output', `cover-letter-${slug}-${dateStr}.md`);
  const pdfPath = path.join(PROJECT_ROOT, 'output', `cover-letter-${slug}-${dateStr}.pdf`);

  const snippetBlock = companySnippet
    ? `\n**Company Context:**\n${companySnippet}\n`
    : '';

  const motivationBlock = motivation
    ? `\n${motivation}\n`
    : '';

  const mdContent = `# Cover Letter — ${company}
**Position:** ${role || 'Position'}
**Company:** ${company}
**Date:** ${dateStr}
---
${snippetBlock}
Dear Hiring Team,

I am writing to express my interest in the ${role || 'position'} at ${company}.
With my background in AI, Computer Vision, and Robotics, I believe I can bring immediate value to your team.
${motivationBlock}
Please refer to my attached CV for details on my experience.

Best regards,
Sanket Mundle
`;

  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, mdContent, 'utf-8');

  // Generate PDF
  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'generate-cover-letter-pdf.mjs');
  exec(`node "${scriptPath}" "${mdPath}" "${pdfPath}"`, { cwd: PROJECT_ROOT }, (err, _out, stderr) => {
    if (err) {
      return res.json({ success: true, md: mdPath, pdf: null, error: stderr || err.message, filename: path.basename(mdPath) });
    }
    res.json({ success: true, md: mdPath, pdf: pdfPath, filename: path.basename(pdfPath) });
  });
});

// GET: Quick company research (fetches About page text)
app.get('/api/company-research', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareerOpsBot/1.0)' },
    });
    clearTimeout(timeout);

    const html = await response.text();

    // Simple text extraction: strip tags, collapse whitespace
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    res.json({ success: true, text, url });
  } catch (err) {
    res.status(200).json({ success: false, error: err.message, text: '' });
  }
});

// GET: List output files (PDFs)
app.get('/api/output-files', (_req, res) => {
  const outputDir = path.join(PROJECT_ROOT, 'output');
  if (!fs.existsSync(outputDir)) return res.json({ files: [] });

  const files = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.pdf') || f.endsWith('.html') || f.endsWith('.md'))
    .map(f => {
      const fullPath = path.join(outputDir, f);
      let stat;
      try { stat = fs.statSync(fullPath); } catch { return null; }
      return { filename: f, modified: stat.mtime.toISOString(), size: stat.size, url: `/output/${f}` };
    })
    .filter(Boolean)
    .sort((a, b) => b.modified.localeCompare(a.modified));

  res.json({ files });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    project_root: PROJECT_ROOT,
    files_present: {
      applications: fs.existsSync(DATA.applications),
      burnList: fs.existsSync(DATA.burnList),
      session: fs.existsSync(DATA.session),
      knowledgeBase: fs.existsSync(DATA.knowledgeBase),
      profile: fs.existsSync(DATA.profile),
    }
  });
});

// Serve the built frontend SPA (must be after API routes)
const distDir = path.join(PROJECT_ROOT, 'dashboard', 'dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Career-Ops Dashboard running on http://localhost:${PORT}`);
  console.log(`   Project root: ${PROJECT_ROOT}`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /api/applications`);
  console.log(`     GET  /api/burn-list`);
  console.log(`     GET  /api/pipeline`);
  console.log(`     GET  /api/session`);
  console.log(`     GET  /api/profile`);
  console.log(`     GET  /api/stats`);
  console.log(`     GET  /api/reports`);
  console.log(`     POST /api/gmail-sync`);
  console.log(`     POST /api/scan`);
  console.log(`     POST /api/applications`);
  console.log(`     PUT  /api/applications/:id`);
  console.log('');
});
