import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRepository } from '../scripts/check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, 'test', 'fixtures');
const codes = result => result.errors.map(issue => issue.code);

test('the current plugin repository passes its self-check', async () => {
  const result = await checkRepository(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.deepEqual(result.errors, []);
});

test('reports package, manifest, and README version drift', async () => {
  const result = await checkRepository(path.join(fixtures, 'version-mismatch'));
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('VERSION_MISMATCH'));
  assert.ok(codes(result).includes('PACKAGE_VERSION_MISMATCH'));
  assert.ok(codes(result).includes('README_VERSION_MISMATCH'));
});

test('reports a missing skill directory referenced by plugin.json', async () => {
  const result = await checkRepository(path.join(fixtures, 'missing-skill'));
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('PLUGIN_SKILL_MISSING'));
});

test('rejects a skill file without YAML frontmatter delimiters', async () => {
  const result = await checkRepository(path.join(fixtures, 'invalid-frontmatter'));
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('SKILL_FRONTMATTER'));
});

test('rejects a skill path that escapes the repository root', async () => {
  const result = await checkRepository(path.join(fixtures, 'outside-skill'));
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('PLUGIN_SKILL_OUTSIDE_REPOSITORY'));
});
