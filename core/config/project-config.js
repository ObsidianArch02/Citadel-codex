#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { createRuntimeConfigDefaults, mergeConfig } = require('./defaults');
const {
  migrateHarnessToCodex,
  readProjectRuntime,
  writeProjectRuntimeConfig,
} = require('./reader');
const { stringifyToml } = require('./toml');

const CODEX_CONFIG_TARGET = Object.freeze({
  dir: '.codex',
  file: 'config.toml',
});

function resolveCodexConfigPath(projectRoot) {
  return path.join(projectRoot, CODEX_CONFIG_TARGET.dir, CODEX_CONFIG_TARGET.file);
}

function resolveLegacyHarnessPath(projectRoot) {
  return path.join(projectRoot, '.claude', 'harness.json');
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeProtectedFiles(protectedFiles) {
  if (!Array.isArray(protectedFiles)) return protectedFiles;
  return protectedFiles.map((entry) => (entry === '.claude/harness.json' ? '.codex/config.toml' : entry));
}

function normalizeConfig(rawConfig = {}) {
  const normalized = mergeConfig(createRuntimeConfigDefaults(), rawConfig);
  normalized.protectedFiles = Array.from(new Set(normalizeProtectedFiles(normalized.protectedFiles || [])));
  return normalized;
}

function loadProjectConfig(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const runtime = readProjectRuntime(projectRoot);
  const warnings = runtime.diagnostics.map((entry) => entry.message);

  return {
    config: normalizeConfig(runtime.config),
    state: runtime.state,
    source: runtime.sources.runtime === 'codex-config'
      ? 'codex'
      : runtime.sources.runtime === 'legacy-harness'
        ? 'legacy-fallback'
        : 'defaults',
    codexPath: runtime.paths.codexConfigPath,
    statePath: runtime.paths.codexStatePath,
    legacyPath: runtime.paths.legacyHarnessPath,
    warnings,
  };
}

function stringifyProjectConfig(config) {
  const normalized = normalizeConfig(config);
  return stringifyToml(normalized, {
    preferredOrder: {
      root: [
        'version',
        'language',
        'framework',
        'packageManager',
        'protectedFiles',
        'dependencyPatterns',
        'typecheck',
        'test',
        'qualityRules',
        'features',
        'agentTimeouts',
        'policy',
        'verification',
        'docs',
        'preCompact',
        'cost',
        'modelMapping',
        'organization',
      ],
      typecheck: ['command', 'perFile'],
      test: ['command', 'framework'],
      qualityRules: ['builtIn', 'custom'],
      features: ['intakeScanner', 'telemetry'],
      agentTimeouts: ['command', 'skill', 'research', 'build'],
      policy: ['scopeEnforcement', 'auditLog', 'allowedOutOfScopeTools'],
      'policy.externalActions': ['protectedBranches', 'hard', 'soft'],
      verification: ['hot', 'cold', 'disabled'],
      docs: ['auto', 'audiences', 'exclude'],
      preCompact: ['handoffMode'],
      cost: ['enabled', 'mode', 'thresholds', 'checkIntervalMs', 'campaignBudgetAlerts', 'sessionEndSummary'],
      modelMapping: ['opus', 'sonnet', 'haiku'],
    },
  });
}

function writeProjectConfig(projectRoot, config) {
  const normalized = normalizeConfig(config);
  const filePath = writeProjectRuntimeConfig(projectRoot, normalized);
  return { filePath, toml: stringifyProjectConfig(normalized) };
}

function migrateLegacyHarness(options = {}) {
  const result = migrateHarnessToCodex({
    projectRoot: options.projectRoot || process.cwd(),
    dryRun: options.write === false,
    force: options.overwrite === true,
  });

  if (!result.migrated) {
    const reason = result.diagnostics[0]?.message || result.reason || 'Legacy harness migration failed.';
    throw new Error(reason);
  }

  const runtimeWrite = result.writes.find((entry) => entry.kind === 'runtime-config');
  const stateWrite = result.writes.find((entry) => entry.kind === 'mutable-state');
  return {
    config: normalizeConfig(result.runtimeConfig),
    state: result.mutableState,
    source: 'legacy-harness',
    codexPath: result.paths.codexConfigPath,
    statePath: result.paths.codexStatePath,
    legacyPath: result.paths.legacyHarnessPath,
    toml: runtimeWrite ? runtimeWrite.content : '',
    stateJson: stateWrite ? stateWrite.content : '',
    wrote: options.write !== false,
  };
}

module.exports = Object.freeze({
  CODEX_CONFIG_TARGET,
  loadProjectConfig,
  mergeConfig,
  migrateLegacyHarness,
  normalizeConfig,
  resolveCodexConfigPath,
  resolveLegacyHarnessPath,
  stringifyProjectConfig,
  writeProjectConfig,
});
