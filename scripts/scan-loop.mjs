#!/usr/bin/env node
/**
 * Continuous zero-token scan loop.
 *
 * Runs scan.mjs on a fixed interval. The scanner itself writes new matches to
 * data/pipeline.md and data/scan-history.tsv; this loop only schedules it.
 *
 * Usage:
 *   node scripts/scan-loop.mjs --interval-minutes=120
 *   node scripts/scan-loop.mjs --once
 */

import { spawn } from 'child_process';

const DEFAULT_INTERVAL_MINUTES = 180;

function parseArgs(argv) {
  let intervalMinutes = DEFAULT_INTERVAL_MINUTES;
  let once = false;

  for (const arg of argv) {
    if (arg === '--once') {
      once = true;
    } else if (arg.startsWith('--interval-minutes=')) {
      intervalMinutes = Number(arg.split('=')[1]);
    }
  }

  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 10) {
    throw new Error('Use --interval-minutes with a value of at least 10.');
  }

  return { intervalMinutes, once };
}

function timestamp() {
  return new Date().toISOString();
}

function runScan() {
  return new Promise((resolve) => {
    console.log(`[${timestamp()}] scan-loop: starting scan.mjs`);
    const child = spawn('node', ['scan.mjs'], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[${timestamp()}] scan-loop: scan completed`);
      } else {
        console.error(`[${timestamp()}] scan-loop: scan exited with code ${code}`);
      }
      resolve(code);
    });
  });
}

async function main() {
  const { intervalMinutes, once } = parseArgs(process.argv.slice(2));
  await runScan();
  if (once) return;

  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(`[${timestamp()}] scan-loop: next scan every ${intervalMinutes} minutes`);
  setInterval(runScan, intervalMs);
}

main().catch((err) => {
  console.error(`scan-loop failed: ${err.message}`);
  process.exit(1);
});
