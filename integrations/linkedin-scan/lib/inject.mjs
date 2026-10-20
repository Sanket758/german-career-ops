// Node-side helper: turn the scanner modules into a script the browser can run.
//
// The resolver logic has to execute inside the page (it walks the live DOM), but it
// must also be unit-testable offline. Both work because the modules are plain
// JavaScript with no runtime dependencies: we read their source, drop the ES module
// syntax, and concatenate them into one classic script that publishes the API on
// `globalThis.__linkedinScan`.
//
// The concatenation is guarded: leftover module syntax, duplicate top-level names
// and source that does not parse are all hard errors, so a future module cannot
// break the scanner with a confusing failure at injection time.

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
 * Build the in-page script from module sources.
 *
 * @param {string[]} sources module sources, in order
 * @returns {string}
 */
export function buildSource(sources) {
  const parts = sources.map((source) =>
    String(source)
      .replace(/^import\s+[^;]+;\s*$/gm, '')
      .replace(/^export\s+/gm, '')
  );
  const source = `${parts.join('\n')}\n;globalThis.__linkedinScan = { ${EXPORTED.join(', ')} };`;

  if (/^\s*(?:import|export)\s/m.test(source)) {
    throw new Error(
      'inject: leftover module syntax — a module uses an unsupported import/export form'
    );
  }

  const names = [...source.matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map(
    (m) => m[1]
  );
  const duplicate = names.find((name, i) => names.indexOf(name) !== i);
  if (duplicate) {
    throw new Error(`inject: "${duplicate}" has already been declared — two modules share a name`);
  }

  try {
    new Function(source);
  } catch (error) {
    throw new Error(`inject: generated source does not parse: ${error.message}`);
  }

  return source;
}

/**
 * @returns {string} a classic script that defines globalThis.__linkedinScan
 */
export function scannerSource() {
  return buildSource(SOURCES.map((file) => readFileSync(join(HERE, file), 'utf8')));
}
