import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
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

test('CI actions use immutable commit pins and checkout does not persist credentials', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8');

  assert.match(workflow, /uses:\s*actions\/checkout@[a-f0-9]{40}\s+# actions\/checkout v\d/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /uses:\s*actions\/setup-node@[a-f0-9]{40}\s+# actions\/setup-node v\d/);
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

test('rejects a skill directory symlink that resolves outside the repository', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'release-checklist-symlink-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const project = path.join(temp, 'project');
  const outside = path.join(temp, 'external-skill');
  await cp(path.join(fixtures, 'version-mismatch'), project, { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(outside, 'SKILL.md'), '---\nname: external\ndescription: outside\n---\n');
  const skillDirectory = path.join(project, 'skills', 'release-readiness');
  await rm(skillDirectory, { recursive: true, force: true });
  try {
    await symlink(outside, skillDirectory, 'junction');
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip(`Creating a directory symlink is not permitted: ${error.code}`);
      return;
    }
    throw error;
  }

  const result = await checkRepository(project);
  assert.ok(codes(result).includes('PLUGIN_SKILL_OUTSIDE_REPOSITORY'));
});
