// Node-side helper: turn the scanner modules into a script the browser can run.
//
// The resolver logic has to execute inside the page (it walks the live DOM), but it
// must also be unit-testable offline. Both work because the modules are plain
// JavaScript with no runtime dependencies: we read their source, drop the ES module
// syntax, and concatenate them into one classic script that publishes the API on
// `globalThis.__linkedinScan`.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCES = ['parse.mjs', 'selectors.mjs'];

const EXPORTED = [
  'findCards',
  'extractCard',
  'extractDetail',
  'textLines',
  'RESOLVERS',
  'parseCardText',
  'parseLocation',
  'parsePostedAge',
  'canonicalJobUrl',
  'parseJobId',
  'cleanTitle',
  'splitLines',
];

/**
 * @returns {string} a classic script that defines globalThis.__linkedinScan
 */
export function scannerSource() {
  const parts = SOURCES.map((file) =>
    readFileSync(join(HERE, file), 'utf8')
      .replace(/^import\s+[^;]+;\s*$/gm, '')
      .replace(/^export\s+/gm, '')
  );
  return `${parts.join('\n')}\n;globalThis.__linkedinScan = { ${EXPORTED.join(', ')} };`;
}
