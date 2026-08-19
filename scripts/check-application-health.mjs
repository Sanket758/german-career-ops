#!/usr/bin/env node
/**
 * check-application-health.mjs — Check if job postings are still live and applyable
 * 
 * Usage:
 *   node check-application-health.mjs --url "https://..."
 *   node check-application-health.mjs --file data/pipeline.md
 *   node check-application-health.mjs --high-score
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PIPELINE_PATH = join(PROJECT_ROOT, 'data', 'pipeline.md');
const APPLICATIONS_PATH = join(PROJECT_ROOT, 'data', 'applications.md');

// Parse args
const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
const urlArg = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : PIPELINE_PATH;
const highScore = args.includes('--high-score');

if (help) {
  console.log(`
Application Health Checker — Verify job postings are still live

Usage:
  node check-application-health.mjs [options]

Options:
  --url URL         Check single URL
  --file FILE       Check URLs from pipeline file (default: data/pipeline.md)
  --high-score      Check only high-score (>=4.0) applications from applications.md
  --help            Show this help
`);
  process.exit(0);
}

// Fetch and check URL
async function checkURL(url) {
  const result = {
    url,
    accessible: false,
    status: 0,
    title: '',
    hasApplyButton: false,
    expired: false,
    error: null,
    contentLength: 0,
    location: '',
    company: ''
  };
  
  try {
    // Try API first for known ATS
    if (url.includes('greenhouse.io')) {
      const match = url.match(/greenhouse\.io\/(\w+)\/jobs\/(\d+)/);
      if (match) {
        const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${match[1]}/jobs/${match[2]}`;
        const res = await fetch(apiUrl);
        result.status = res.status;
        if (res.ok) {
          const data = await res.json();
          result.accessible = true;
          result.title = data.title || '';
          result.location = data.location?.name || '';
          result.company = data.metadata?.company || '';
          result.contentLength = (data.content || '').length;
          result.hasApplyButton = true; // API exists = applyable
          result.expired = false;
        } else if (res.status === 404) {
          result.expired = true;
          result.error = 'Job not found (404)';
        }
        return result;
      }
    }
    
    if (url.includes('lever.co')) {
      const match = url.match(/jobs\.lever\.co\/(\w+)\/([^/?#]+)/);
      if (match) {
        const apiUrl = `https://api.lever.co/v0/postings/${match[1]}/${match[2]}?mode=json`;
        const res = await fetch(apiUrl);
        result.status = res.status;
        if (res.ok) {
          const data = await res.json();
          result.accessible = true;
          result.title = data.text || '';
          result.location = data.categories?.location || '';
          result.company = match[1];
          result.contentLength = (data.description || '').length;
          result.hasApplyButton = true;
          result.expired = false;
        } else if (res.status === 404) {
          result.expired = true;
          result.error = 'Job not found (404)';
        }
        return result;
      }
    }
    
    if (url.includes('ashbyhq.com')) {
      const match = url.match(/jobs\.ashbyhq\.com\/(\w+)\/([^/?#]+)/);
      if (match) {
        // Ashby doesn't have public API, try direct fetch
        const res = await fetch(url, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareerOps/1.0)' },
          redirect: 'follow'
        });
        result.status = res.status;
        result.accessible = res.ok;
        result.contentLength = (await res.text()).length;
        
        if (res.ok) {
          const html = await res.text();
          // Check for expired indicators
          const expiredPatterns = [
            'no longer available',
            'position has been filled',
            'this job has expired',
            'job has been closed',
            'stelle wurde besetz',
            'nicht mehr verfügbar'
          ];
          result.expired = expiredPatterns.some(p => html.toLowerCase().includes(p));
          result.hasApplyButton = html.includes('apply') || html.includes('bewerben') || html.includes('submit');
          // Try to extract title
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch) result.title = titleMatch[1];
        }
        return result;
      }
    }
    
    // Generic fetch for other URLs
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareerOps/1.0)' },
      redirect: 'follow'
    });
    result.status = res.status;
    result.accessible = res.ok;
    
    if (res.ok) {
      const html = await res.text();
      result.contentLength = html.length;
      
      // Check for expired indicators
      const expiredPatterns = [
        'no longer available',
        'position has been filled',
        'this job has expired',
        'job has been closed',
        'stelle wurde besetz',
        'nicht mehr verfügbar',
        '404',
        'not found',
        'page not found'
      ];
      result.expired = expiredPatterns.some(p => html.toLowerCase().includes(p));
      result.hasApplyButton = html.includes('apply') || html.includes('bewerben') || html.includes('submit') || html.includes('application');
      
      // Try to extract title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) result.title = titleMatch[1];
    }
    
  } catch (err) {
    result.error = err.message;
    result.accessible = false;
  }
  
  return result;
}

// Extract URLs from pipeline.md
function extractPipelineURLs(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const urls = [];
  
  for (const line of content.split('\n')) {
    // Match both clean format: "- [ ] URL" and error format: "- [!] URL — Error: ..."
    const match = line.match(/^\s*-\s*\[\s*[! ]?\s*\]\s+(https?:\/\/\S+)/);
    if (match) {
      urls.push(match[1]);
    }
  }
  
  return urls;
}

// Extract high-score applications from applications.md
function extractHighScoreApps(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const apps = [];
  
  for (const line of content.split('\n')) {
    if (line.startsWith('| ') && !line.startsWith('| #') && !line.startsWith('|---')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 7) {
        const score = parts[5];
        if (score.startsWith('4.') || score.startsWith('5.')) {
          // Try to extract URL from report link
          const reportMatch = line.match(/\(reports\/([^)]+)\)/);
          if (reportMatch) {
            apps.push({
              score,
              company: parts[3],
              role: parts[4],
              report: reportMatch[1]
            });
          }
        }
      }
    }
  }
  
  return apps;
}

// Main
async function main() {
  let urls = [];
  
  if (urlArg) {
    urls = [urlArg];
  } else if (highScore) {
    const apps = extractHighScoreApps(APPLICATIONS_PATH);
    console.log(`Found ${apps.length} high-score applications`);
    for (const app of apps) {
      console.log(`  ${app.score} - ${app.company} - ${app.role} (${app.report})`);
    }
    // For now, just list them - would need to map back to original URLs
    return;
  } else {
    urls = extractPipelineURLs(fileArg);
    console.log(`Found ${urls.length} URLs in pipeline`);
  }
  
  console.log('\nChecking application health...\n');
  
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    process.stdout.write(`[${i+1}/${urls.length}] ${url}... `);
    
    const result = await checkURL(url);
    results.push(result);
    
    if (result.accessible && !result.expired) {
      console.log('✅ LIVE');
    } else if (result.expired) {
      console.log('❌ EXPIRED');
    } else {
      console.log(`❌ ${result.error || `HTTP ${result.status}`}`);
    }
    
    // Small delay to be respectful
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Summary
  const live = results.filter(r => r.accessible && !r.expired).length;
  const expired = results.filter(r => r.expired).length;
  const failed = results.filter(r => !r.accessible && !r.expired).length;
  
  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Live & Applyable: ${live}`);
  console.log(`  ❌ Expired/Filled: ${expired}`);
  console.log(`  ❌ Inaccessible: ${failed}`);
  
  // Show expired details
  if (expired > 0) {
    console.log(`\n⚠️  Expired/Dead postings:`);
    for (const r of results.filter(r => r.expired)) {
      console.log(`  - ${r.url}`);
      console.log(`    Title: ${r.title || 'Unknown'}`);
      console.log(`    Status: ${r.status}`);
    }
  }
  
  // Save results
  const reportPath = join(PROJECT_ROOT, 'data', 'health-check-report.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Full report saved to: ${reportPath}`);
}

main();