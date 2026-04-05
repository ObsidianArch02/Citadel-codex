#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadProjectConfig,
  migrateLegacyHarness,
  stringifyProjectConfig,
  writeProjectConfig,
} = require(path.join(__dirname, '..', 'core', 'config', 'project-config'));
const { parseToml } = require(path.join(__dirname, '..', 'core', 'config', 'toml'));
const { validateCodexConfig } = require(path.join(__dirname, '..', 'core', 'contracts', 'codex-config'));

const codexRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'citadel-codex-config-'));
const legacyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'citadel-legacy-harness-'));

try {
  const written = writeProjectConfig(codexRoot, {
    version: 1,
    language: 'typescript',
    packageManager: 'pnpm',
    protectedFiles: ['.codex/config.toml', 'src/**'],
    typecheck: {
      command: 'pnpm exec tsc --noEmit',
      perFile: true,
    },
  });

  const parsed = parseToml(fs.readFileSync(written.filePath, 'utf8'));
  assert.equal(parsed.language, 'typescript', 'TOML parser should read strings');
  assert.equal(parsed.typecheck.perFile, true, 'TOML parser should read booleans');

  const loadedCodex = loadProjectConfig({ projectRoot: codexRoot });
  assert.equal(loadedCodex.source, 'codex', 'Codex config should win when present');
  assert.equal(loadedCodex.config.packageManager, 'pnpm', 'Codex config should preserve package manager');
  assert.deepEqual(loadedCodex.state.skillRegistry.registeredSkills, [], 'Runtime config should not inline mutable skill registry state');
  assert.deepEqual(validateCodexConfig(loadedCodex.config), [], 'Normalized Codex config should validate');

  fs.mkdirSync(path.join(legacyRoot, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(legacyRoot, '.claude', 'harness.json'), JSON.stringify({
    language: 'python',
    packageManager: 'pip',
    protectedFiles: ['.claude/harness.json', 'secrets/**'],
    trust: { sessions_completed: 7 },
  }, null, 2));

  const legacyLoaded = loadProjectConfig({ projectRoot: legacyRoot });
  assert.equal(legacyLoaded.source, 'legacy-fallback', 'Legacy harness should be used as fallback');
  assert.deepEqual(
    legacyLoaded.config.protectedFiles,
    ['.codex/config.toml', 'secrets/**'],
    'Legacy protectedFiles should normalise the config path'
  );
  assert.equal(legacyLoaded.state.trust.sessions_completed, 7, 'Legacy trust state should be mapped into mutable state');

  const migration = migrateLegacyHarness({ projectRoot: legacyRoot, write: true });
  assert(migration.toml.includes('language = "python"'), 'Migration should render TOML output');
  assert(fs.existsSync(path.join(legacyRoot, '.codex', 'config.toml')), 'Migration should write .codex/config.toml');
  assert(fs.existsSync(path.join(legacyRoot, '.codex', 'state.json')), 'Migration should write .codex/state.json');
  assert(migration.stateJson.includes('"sessions_completed": 7'), 'Migration should emit mutable state JSON');

  const roundTrip = parseToml(stringifyProjectConfig({
    language: 'go',
    packageManager: 'npm',
    modelMapping: { opus: 'gpt-5.5' },
  }));
  assert.equal(roundTrip.language, 'go', 'stringifyProjectConfig should emit parseable TOML');
  assert.equal(roundTrip.modelMapping.opus, 'gpt-5.5', 'Nested model mapping should round-trip through TOML');

  console.log('codex config tests passed');
} finally {
  fs.rmSync(codexRoot, { recursive: true, force: true });
  fs.rmSync(legacyRoot, { recursive: true, force: true });
}
