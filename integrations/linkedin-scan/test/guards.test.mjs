import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSource, scannerSource } from '../lib/inject.mjs';
import { findPersonalData, stripProfileLinks } from '../lib/sanitize.mjs';
import { renameAtomicClasses, ATOMIC_CLASS_RE } from '../lib/atomic.mjs';

// ── injection guards ─────────────────────────────────────────────────────────

test('scannerSource produces a classic script with no module syntax left', () => {
  const source = scannerSource();
  assert.ok(!/^\s*import\s/m.test(source), 'no import statement may survive');
  assert.ok(!/^\s*export\s/m.test(source), 'no export statement may survive');
  assert.ok(source.includes('globalThis.__linkedinScan'), 'the API must be published');
});

test('buildSource refuses a module that uses an unsupported export form', () => {
  assert.throws(
    () => buildSource(['export default function helper() { return 1; }']),
    /module syntax|does not parse/i
  );
});

test('buildSource refuses two modules that declare the same name', () => {
  assert.throws(
    () => buildSource(['const SHARED = 1;', 'const SHARED = 2;']),
    /already been declared|duplicate/i
  );
});

test('buildSource refuses source that does not parse', () => {
  assert.throws(() => buildSource(['function ( {']), /does not parse/i);
});

// ── sanitizer guards ─────────────────────────────────────────────────────────

test('findPersonalData spots an account e-mail and a profile link', () => {
  const html =
    '<a href="https://www.linkedin.com/in/sanket758/">Sanket Gadge</a><p>gadgesanket75@gmail.com</p>';
  const found = findPersonalData(html, { names: ['Sanket Gadge'], emails: ['gadgesanket75@gmail.com'] });
  assert.deepEqual(found.names, ['Sanket Gadge']);
  assert.deepEqual(found.emails, ['gadgesanket75@gmail.com']);
  assert.equal(found.profileHrefs.length, 1);
});

test('findPersonalData reports a clean document as clean', () => {
  const html = '<div><p>Computer Vision ML Engineer</p><p>XpertDirect</p></div>';
  const found = findPersonalData(html, { names: ['Sanket Gadge'], emails: ['a@b.com'] });
  assert.deepEqual(found.names, []);
  assert.deepEqual(found.emails, []);
  assert.deepEqual(found.profileHrefs, []);
});

test('stripProfileLinks removes profile links and keeps the rest', () => {
  const html =
    '<div><a href="https://www.linkedin.com/in/someone/">Someone</a><p>Job description</p></div>';
  const clean = stripProfileLinks(html);
  assert.ok(!clean.includes('/in/'));
  assert.ok(clean.includes('Job description'));
});

// ── atomic renamer ───────────────────────────────────────────────────────────

test('the renamer handles single-quoted and unquoted class attributes', () => {
  const html = "<div class='js0lk1 js0ax9'></div><span class=js0ify></span>";
  const renamed = renameAtomicClasses(html);
  assert.ok(!/js0/.test(renamed), 'every obfuscated class must be renamed');
  assert.ok(renamed.includes('rmap'));
});

test('the renamer leaves semantic class names alone', () => {
  const html = '<div class="jobs-description__content highcharts-container"></div>';
  assert.equal(renameAtomicClasses(html), html);
});

test('the atomic pattern matches the real classes and not the renamed ones', () => {
  assert.ok(ATOMIC_CLASS_RE.test('js0lk1'));
  assert.ok(ATOMIC_CLASS_RE.test('i0lax0'));
  assert.ok(!ATOMIC_CLASS_RE.test('rmap0000'));
  assert.ok(!ATOMIC_CLASS_RE.test('jobs-description__content'));
});
