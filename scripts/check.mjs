#!/usr/bin/env node
// Repository self-check for GhosTnever-lkm/release-checklist.
// No external dependencies. Node.js >= 20 (tested on 24).

import { readFile, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

/**
 * @typedef {Object} Issue
 * @property {string} code
 * @property {string} message
 */

/**
 * @typedef {Object} CheckResult
 * @property {string} root
 * @property {Issue[]} errors
 * @property {Issue[]} warnings
 * @property {boolean} ok
 */

const REQUIRED_FRONTMATTER_FIELDS = ['name', 'description'];

/** Read a file as UTF-8, throw a friendly error if missing. */
async function readText(file, label) {
  try {
    return await readFile(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error(`Missing file: ${label} (${file})`);
    }
    throw err;
  }
}

/** Parse JSON with a descriptive error. */
function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON in ${label}: ${err.message}`);
  }
}

/** Extract the version string from README.md (badge or plain mention). */
function extractReadmeVersion(readme) {
  // Priority 1: shield/badge URL like .../v1.0.1-... or version-1.0.1-
  const badge = readme.match(/version[-/]v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i);
  if (badge) return badge[1];
  // Priority 2: explicit "version: 1.0.1" or "Version 1.0.1"
  const explicit = readme.match(/\bversion\b[^\n\d]{0,20}(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i);
  if (explicit) return explicit[1];
  // Priority 3: plain semver appearing at all
  const plain = readme.match(/\b(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\b/);
  if (plain) return plain[1];
  return null;
}

/**
 * Minimal YAML frontmatter parser. Supports only the subset actually
 * needed: top-level scalar `key: value` pairs. Nested structures are
 * ignored. Returns { data, raw } or throws on missing/invalid block.
 */
function parseFrontmatter(markdown, label) {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    throw new Error(`${label}: missing YAML frontmatter (must start with '---')`);
  }
  const lines = normalized.split('\n');
  const closingLine = lines.findIndex((line, index) => index > 0 && /^---[ \t]*$/.test(line));
  if (closingLine === -1) {
    throw new Error(`${label}: unterminated YAML frontmatter`);
  }
  const raw = lines.slice(1, closingLine).join('\n');
  const data = {};
  for (const line of raw.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!m) continue; // skip nested / list items
    const [, key, valueRaw] = m;
    let value = valueRaw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, raw };
}

async function checkExists(root, relPath, errors, { required = true } = {}) {
  const abs = path.join(root, relPath);
  if (!existsSync(abs)) {
    if (required) errors.push({ code: 'MISSING_FILE', message: `Missing required file: ${relPath}` });
    return false;
  }
  return true;
}

/**
 * Main checker.
 * @param {string} root Absolute or relative path to repository root.
 * @returns {Promise<CheckResult>}
 */
export async function checkRepository(root = process.cwd()) {
  const absRoot = path.resolve(root);
  let realRoot = absRoot;
  try {
    realRoot = await realpath(absRoot);
  } catch {
    // Preserve the existing missing-file diagnostics when the root does not exist.
  }
  /** @type {Issue[]} */ const errors = [];
  /** @type {Issue[]} */ const warnings = [];

  // 1. Required top-level files
  for (const rel of ['VERSION', 'package.json', '.codex-plugin/plugin.json', '.agents/plugins/marketplace.json', 'README.md', 'CHANGELOG.md', 'LICENSE']) {
    await checkExists(absRoot, rel, errors);
  }

  // 2. VERSION
  let version = null;
  const versionPath = path.join(absRoot, 'VERSION');
  if (existsSync(versionPath)) {
    const raw = (await readText(versionPath, 'VERSION')).trim();
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(raw)) {
      errors.push({ code: 'VERSION_FORMAT', message: `VERSION must be a single semver string, got: ${JSON.stringify(raw)}` });
    } else {
      version = raw;
    }
  }

  // 2. package.json
  let packageJson = null;
  const packagePath = path.join(absRoot, 'package.json');
  if (existsSync(packagePath)) {
    try {
      packageJson = parseJson(await readText(packagePath, 'package.json'), 'package.json');
    } catch (err) {
      errors.push({ code: 'PACKAGE_JSON', message: err.message });
    }
  }
  if (packageJson) {
    if (packageJson.name !== 'release-checklist') {
      errors.push({ code: 'PACKAGE_NAME', message: `package.json name must be "release-checklist", got: ${JSON.stringify(packageJson.name)}` });
    }
    if (typeof packageJson.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(packageJson.version)) {
      errors.push({ code: 'PACKAGE_VERSION_FORMAT', message: `package.json version must be semver string, got: ${JSON.stringify(packageJson.version)}` });
    } else if (version && packageJson.version !== version) {
      errors.push({ code: 'PACKAGE_VERSION_MISMATCH', message: `package.json version (${packageJson.version}) != VERSION (${version})` });
    }
  }

  // 3. plugin.json
  let manifest = null;
  const manifestPath = path.join(absRoot, '.codex-plugin/plugin.json');
  if (existsSync(manifestPath)) {
    try {
      manifest = parseJson(await readText(manifestPath, '.codex-plugin/plugin.json'), '.codex-plugin/plugin.json');
    } catch (err) {
      errors.push({ code: 'PLUGIN_JSON', message: err.message });
    }
  }
  if (manifest) {
    if (manifest.name !== 'release-checklist') {
      errors.push({ code: 'PLUGIN_NAME', message: `plugin.json name must be "release-checklist", got: ${JSON.stringify(manifest.name)}` });
    }
    if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version)) {
      errors.push({ code: 'PLUGIN_VERSION_FORMAT', message: `plugin.json version must be semver string, got: ${JSON.stringify(manifest.version)}` });
    } else if (version && manifest.version !== version) {
      errors.push({ code: 'VERSION_MISMATCH', message: `plugin.json version (${manifest.version}) != VERSION (${version})` });
    }
    if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
      errors.push({ code: 'PLUGIN_SKILLS', message: 'plugin.json skills must be a non-empty array' });
    } else {
      for (const skillPath of manifest.skills) {
        if (typeof skillPath !== 'string' || skillPath.length === 0) {
          errors.push({ code: 'PLUGIN_SKILL_ENTRY', message: `plugin.json skills entry must be a non-empty string, got: ${JSON.stringify(skillPath)}` });
          continue;
        }
        // Keep plugin skill references inside the repository.
        const abs = path.resolve(absRoot, skillPath);
        const relative = path.relative(absRoot, abs);
        if (path.isAbsolute(skillPath) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
          errors.push({ code: 'PLUGIN_SKILL_OUTSIDE_REPOSITORY', message: `plugin.json skill path must stay inside the repository: ${skillPath}` });
          continue;
        }
        if (!existsSync(abs)) {
          errors.push({ code: 'PLUGIN_SKILL_MISSING', message: `plugin.json skill path does not exist: ${skillPath}` });
          continue;
        }
        const skillMd = path.join(abs, 'SKILL.md');
        if (!existsSync(skillMd)) {
          errors.push({ code: 'PLUGIN_SKILL_NO_SKILL_MD', message: `skill directory has no SKILL.md: ${skillPath}` });
          continue;
        }
        // Lexical containment above does not detect a symlinked skill directory or file.
        try {
          const [realSkill, realSkillMd] = await Promise.all([realpath(abs), realpath(skillMd)]);
          const isInsideRepository = target => {
            const relative = path.relative(realRoot, target);
            return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
          };
          if (!isInsideRepository(realSkill) || !isInsideRepository(realSkillMd)) {
            errors.push({ code: 'PLUGIN_SKILL_OUTSIDE_REPOSITORY', message: `plugin.json skill path must stay inside the repository: ${skillPath}` });
            continue;
          }
        } catch (err) {
          errors.push({ code: 'PLUGIN_SKILL_PATH_RESOLVE', message: `Could not resolve plugin skill path ${skillPath}: ${err?.code ?? err?.message ?? err}` });
          continue;
        }
        let text;
        try {
          text = await readText(skillMd, `${skillPath}/SKILL.md`);
        } catch (err) {
          errors.push({ code: 'PLUGIN_SKILL_READ', message: err.message });
          continue;
        }
        let fm;
        try {
          fm = parseFrontmatter(text, `${skillPath}/SKILL.md`);
        } catch (err) {
          errors.push({ code: 'SKILL_FRONTMATTER', message: err.message });
          continue;
        }
        for (const field of REQUIRED_FRONTMATTER_FIELDS) {
          const v = fm.data[field];
          if (typeof v !== 'string' || v.trim() === '') {
            errors.push({ code: 'SKILL_FRONTMATTER_FIELD', message: `${skillPath}/SKILL.md frontmatter missing required field: ${field}` });
          }
        }
      }
    }
  }

  // 4. marketplace.json
  const marketplacePath = path.join(absRoot, '.agents/plugins/marketplace.json');
  if (existsSync(marketplacePath)) {
    let marketplace = null;
    try {
      marketplace = parseJson(await readText(marketplacePath, '.agents/plugins/marketplace.json'), '.agents/plugins/marketplace.json');
    } catch (err) {
      errors.push({ code: 'MARKETPLACE_JSON', message: err.message });
    }
    if (marketplace) {
      const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : null;
      if (!plugins) {
        errors.push({ code: 'MARKETPLACE_PLUGINS', message: 'marketplace.json must contain a "plugins" array' });
      } else {
        const matches = plugins.filter((p) => p && p.name === 'release-checklist');
        if (matches.length !== 1) {
          errors.push({ code: 'MARKETPLACE_PLUGIN_COUNT', message: `marketplace.json must contain exactly one plugin named "release-checklist", found: ${matches.length}` });
        }
        for (const p of matches) {
          const src = p.source && typeof p.source === 'object' ? p.source.path : undefined;
          if (typeof src !== 'string') {
            errors.push({ code: 'MARKETPLACE_SOURCE', message: 'marketplace plugin source.path must be a string' });
            continue;
          }
          // Accept "./" exactly (or "" after normalization) as repo root.
          const normalized = src.replace(/^\.\//, '').replace(/\/+$/, '');
          if (normalized !== '') {
            errors.push({ code: 'MARKETPLACE_SOURCE_PATH', message: `marketplace source.path must point to repository root ("./" or "."), got: ${JSON.stringify(src)}` });
            continue;
          }
          const abs = path.resolve(absRoot, src);
          if (!existsSync(abs)) {
            errors.push({ code: 'MARKETPLACE_SOURCE_MISSING', message: `marketplace source.path does not exist: ${src}` });
          }
          // Relative path check
          if (path.isAbsolute(src)) {
            errors.push({ code: 'MARKETPLACE_SOURCE_ABSOLUTE', message: `marketplace source.path must be relative, got: ${src}` });
          }
        }
      }
    }
  }

  // 5. README version consistency
  const readmePath = path.join(absRoot, 'README.md');
  if (existsSync(readmePath) && version) {
    const readme = await readText(readmePath, 'README.md');
    const readmeVersion = extractReadmeVersion(readme);
    if (readmeVersion === null) {
      warnings.push({ code: 'README_VERSION_MISSING', message: 'README.md does not mention a version; add a badge or "version: X.Y.Z"' });
    } else if (readmeVersion !== version) {
      errors.push({ code: 'README_VERSION_MISMATCH', message: `README version (${readmeVersion}) != VERSION (${version})` });
    }
  }

  // 6. LICENSE / CHANGELOG presence is already covered above (required files).

  return {
    root: absRoot,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}

/** Format a CheckResult for humans. */
export function formatResult(result) {
  const lines = [];
  lines.push(`Repository: ${result.root}`);
  if (result.ok) {
    lines.push('OK — all checks passed.');
  } else {
    lines.push(`FAILED — ${result.errors.length} error(s), ${result.warnings.length} warning(s).`);
  }
  for (const w of result.warnings) lines.push(`  warn [${w.code}] ${w.message}`);
  for (const e of result.errors) lines.push(`  error [${e.code}] ${e.message}`);
  return lines.join('\n');
}

async function main() {
  try {
    const result = await checkRepository(process.cwd());
    const text = formatResult(result);
    if (result.ok) {
      console.log(text);
      process.exit(0);
    } else {
      console.error(text);
      process.exit(1);
    }
  } catch (err) {
    console.error(`checker crashed: ${err && err.stack ? err.stack : err}`);
    process.exit(2);
  }
}

// Run only when invoked directly.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
