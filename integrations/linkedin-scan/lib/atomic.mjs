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

/**
 * Prefix for a renamed token. It must stay outside ATOMIC_CLASS_RE, so that
 * "no obfuscated class survived the rename" stays a meaningful assertion: the
 * pattern is 1-3 letters + "0" + alphanumerics, and four letters never match.
 */
export const RENAMED_PREFIX = 'rmap';

/**
 * Rename every obfuscated class token in an HTML string, deterministically.
 * The first token seen becomes renamed0000, the second renamed0001, and so on.
 *
 * Handles double-quoted, single-quoted and unquoted class attributes.
 *
 * @param {string} html
 * @returns {string}
 */
export function renameAtomicClasses(html) {
  const seen = new Map();
  const renameValue = (value) =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        if (!ATOMIC_CLASS_RE.test(token)) return token;
        if (!seen.has(token)) {
          seen.set(token, `${RENAMED_PREFIX}${String(seen.size).padStart(4, '0')}`);
        }
        return seen.get(token);
      })
      .join(' ');

  return String(html).replace(
    /class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    (match, doubleQuoted, singleQuoted, unquoted) => {
      const value = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
      const quote = doubleQuoted !== undefined ? '"' : singleQuoted !== undefined ? "'" : '';
      return `class=${quote}${renameValue(value)}${quote}`;
    }
  );
}
