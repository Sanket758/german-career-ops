// LinkedIn's obfuscated class names.
//
// The search UI tags its elements with generated classes (`i0lax0`, `js0lk1`, …) that
// carry no meaning and change with every deploy. The scanner must never depend on
// them, and the test suite proves it: the same fixture with every obfuscated class
// renamed has to produce byte-identical output.
//
// Pattern: one to three lowercase letters, a zero, then at least two more
// lower-case alphanumerics. "i0lax0" and "js0lk1" match; "renamed0000" does not.

export const ATOMIC_CLASS_RE = /^(?:[a-z]{1,3})0[a-z0-9]{2,}$/;

/** Prefix for a renamed token: deliberately outside ATOMIC_CLASS_RE. */
export const RENAMED_PREFIX = 'renamed';

/**
 * Rename every obfuscated class token in an HTML string, deterministically.
 * The first token seen becomes renamed0000, the second renamed0001, and so on.
 *
 * @param {string} html
 * @returns {string}
 */
export function renameAtomicClasses(html) {
  const seen = new Map();
  return String(html).replace(/class="([^"]*)"/g, (match, value) => {
    const tokens = value.split(/\s+/).filter(Boolean);
    const renamed = tokens.map((token) => {
      if (!ATOMIC_CLASS_RE.test(token)) return token;
      if (!seen.has(token)) {
        seen.set(token, `${RENAMED_PREFIX}${String(seen.size).padStart(4, '0')}`);
      }
      return seen.get(token);
    });
    return `class="${renamed.join(' ')}"`;
  });
}
