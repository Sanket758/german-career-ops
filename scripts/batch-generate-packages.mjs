#!/usr/bin/env node
/**
 * batch-generate-packages.mjs — Generate application packages for all high-score evaluated roles
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const APPLICATIONS_PATH = join(PROJECT_ROOT, 'data', 'applications.md');

async function main() {
  // Parse applications.md for high-score evaluated entries
  const content = readFileSync(APPLICATIONS_PATH, 'utf-8');
  const apps = [];
  
  for (const line of content.split('\n')) {
    if (line.startsWith('| ') && !line.startsWith('| #') && !line.startsWith('|---')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 7) {
        const score = parts[5];
        const status = parts[6];
        const company = parts[3];
        const role = parts[4];
        
        if (score.startsWith('4.') && status === 'Evaluated') {
          // Extract URL from report
          const reportMatch = line.match(/\(reports\/([^)]+)\)/);
          if (reportMatch) {
            const reportFile = reportMatch[1];
            // Read report to get URL
            const reportPath = join(PROJECT_ROOT, 'reports', reportFile);
            try {
              const reportContent = readFileSync(reportPath, 'utf-8');
              const urlMatch = reportContent.match(/\*\*URL:\*\*\s*(https?:\/\/\S+)/);
              if (urlMatch) {
                apps.push({
                  score,
                  company,
                  role,
                  url: urlMatch[1],
                  report: reportFile
                });
              }
            } catch {}
          }
        }
      }
    }
  }
  
  console.log(`Found ${apps.length} high-score evaluated applications to package:\n`);
  
  for (const app of apps) {
    console.log(`  ${app.score} - ${app.company} - ${app.role}`);
    console.log(`    URL: ${app.url}`);
  }
  
  console.log('\nGenerating packages...\n');
  
  for (const app of apps) {
    console.log(`\n📦 ${app.company} — ${app.role}`);
    
    // Extract clean company name for output
    const companySlug = app.company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const args = [
      'scripts/generate-application-package.mjs',
      '--url', app.url,
      '--company', app.company,
      '--role', app.role,
      '--lang', 'de',
      '--output', `output/pkg-${companySlug}-2026-08-19.pdf`
    ];
    
    const child = spawn('node', args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    
    await new Promise((resolve, reject) => {
      child.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`Exit code ${code}`));
      });
      child.on('error', reject);
    });
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n✅ All packages generated!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});