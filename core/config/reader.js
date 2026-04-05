#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const {
  createMutableStateDefaults,
  createRuntimeConfigDefaults,
  mergeConfig,
} = require('./defaults');
const {
  findUnmappedHarnessKeys,
  mapLegacyHarnessToMutableState,
  mapLegacyHarnessToRuntimeConfig,
} = require('./legacy-harness');
const { parseToml, stringifyToml } = require('./toml');

function resolveProjectPaths(projectRoot = process.cwd()) {
  return {
    projectRoot,
    codexConfigPath: path.join(projectRoot, '.codex', 'config.toml'),
    codexStatePath: path.join(projectRoot, '.codex', 'state.json'),
    legacyHarnessPath: path.join(projectRoot, '.claude', 'harness.json'),
  };
}

function ensureParentDirectory(filePath) {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readTomlIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return parseToml(fs.readFileSync(filePath, 'utf8'));
}

function loadRawProjectConfig(projectRoot = process.cwd()) {
  const paths = resolveProjectPaths(projectRoot);
  const diagnostics = [];
  let legacyHarness = null;

  const codexConfig = readTomlIfExists(paths.codexConfigPath);
  const codexState = readJsonIfExists(paths.codexStatePath);

  if (fs.existsSync(paths.legacyHarnessPath)) {
    try {
      legacyHarness = JSON.parse(fs.readFileSync(paths.legacyHarnessPath, 'utf8'));
    } catch (error) {
      diagnostics.push({
        level: 'error',
        code: 'legacy-harness-invalid',
        message: `Could not parse legacy harness config: ${error.message}`,
      });
    }
  }

  return {
    paths,
    codexConfig,
    codexState,
    legacyHarness,
    diagnostics,
  };
}

function readProjectRuntime(projectRoot = process.cwd()) {
  const raw = loadRawProjectConfig(projectRoot);
  const diagnostics = [...raw.diagnostics];
  const runtimeDefaults = createRuntimeConfigDefaults();
  const stateDefaults = createMutableStateDefaults();

  let config = runtimeDefaults;
  let state = stateDefaults;
  let runtimeSource = 'defaults';
  let stateSource = 'defaults';

  if (raw.legacyHarness) {
    config = mergeConfig(config, mapLegacyHarnessToRuntimeConfig(raw.legacyHarness));
    state = mergeConfig(state, mapLegacyHarnessToMutableState(raw.legacyHarness));
    runtimeSource = 'legacy-harness';
    stateSource = 'legacy-harness';

    const unmappedKeys = findUnmappedHarnessKeys(raw.legacyHarness);
    if (unmappedKeys.length > 0) {
      diagnostics.push({
        level: 'warn',
        code: 'legacy-harness-unmapped-keys',
        message: `Legacy harness contains unmapped keys: ${unmappedKeys.join(', ')}`,
      });
    }
  }

  if (raw.codexConfig) {
    config = mergeConfig(config, raw.codexConfig);
    runtimeSource = 'codex-config';
  }

  if (raw.codexState) {
    state = mergeConfig(state, raw.codexState);
    stateSource = 'codex-state';
  }

  if (!raw.codexConfig && raw.legacyHarness) {
    diagnostics.push({
      level: 'warn',
      code: 'legacy-harness-fallback',
      message: 'Using .claude/harness.json as a compatibility fallback because .codex/config.toml is missing.',
    });
  } else if (raw.codexConfig && raw.legacyHarness) {
    diagnostics.push({
      level: 'info',
      code: 'legacy-harness-backfill',
      message: 'Loaded .codex/config.toml and backfilled missing fields from .claude/harness.json where needed.',
    });
  }

  return {
    projectRoot: raw.paths.projectRoot,
    paths: raw.paths,
    config,
    state,
    diagnostics,
    sources: {
      runtime: runtimeSource,
      state: stateSource,
    },
  };
}

function writeProjectRuntimeConfig(projectRoot, config) {
  const paths = resolveProjectPaths(projectRoot);
  ensureParentDirectory(paths.codexConfigPath);
  fs.writeFileSync(paths.codexConfigPath, stringifyToml(config), 'utf8');
  return paths.codexConfigPath;
}

function writeProjectMutableState(projectRoot, state) {
  const paths = resolveProjectPaths(projectRoot);
  ensureParentDirectory(paths.codexStatePath);
  fs.writeFileSync(paths.codexStatePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return paths.codexStatePath;
}

function updateProjectMutableState(projectRoot, updater) {
  const current = readProjectRuntime(projectRoot);
  const nextState = updater(current.state);
  writeProjectMutableState(projectRoot, nextState);
  return nextState;
}

function migrateHarnessToCodex(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const dryRun = options.dryRun === true;
  const force = options.force === true;
  const current = loadRawProjectConfig(projectRoot);

  if (!current.legacyHarness) {
    return {
      projectRoot,
      paths: current.paths,
      migrated: false,
      reason: 'legacy-harness-missing',
      writes: [],
      diagnostics: [{
        level: 'info',
        code: 'legacy-harness-missing',
        message: 'No .claude/harness.json file found. Nothing to migrate.',
      }],
    };
  }

  if (!force && fs.existsSync(current.paths.codexConfigPath)) {
    return {
      projectRoot,
      paths: current.paths,
      migrated: false,
      reason: 'codex-config-exists',
      writes: [],
      diagnostics: [{
        level: 'warn',
        code: 'codex-config-exists',
        message: '.codex/config.toml already exists. Re-run with --force to overwrite it from legacy harness data.',
      }],
    };
  }

  const runtimeConfig = mergeConfig(
    createRuntimeConfigDefaults(),
    mapLegacyHarnessToRuntimeConfig(current.legacyHarness)
  );
  const mutableState = mergeConfig(
    createMutableStateDefaults(),
    mapLegacyHarnessToMutableState(current.legacyHarness)
  );

  const writes = [
    {
      path: current.paths.codexConfigPath,
      kind: 'runtime-config',
      content: stringifyToml(runtimeConfig),
    },
    {
      path: current.paths.codexStatePath,
      kind: 'mutable-state',
      content: JSON.stringify(mutableState, null, 2) + '\n',
    },
  ];

  if (!dryRun) {
    for (const write of writes) {
      ensureParentDirectory(write.path);
      fs.writeFileSync(write.path, write.content, 'utf8');
    }
  }

  const diagnostics = [];
  const unmappedKeys = findUnmappedHarnessKeys(current.legacyHarness);
  if (unmappedKeys.length > 0) {
    diagnostics.push({
      level: 'warn',
      code: 'legacy-harness-unmapped-keys',
      message: `Legacy harness contains unmapped keys: ${unmappedKeys.join(', ')}`,
    });
  }

  return {
    projectRoot,
    paths: current.paths,
    migrated: true,
    reason: dryRun ? 'dry-run' : 'written',
    writes,
    diagnostics,
  };
}

module.exports = Object.freeze({
  loadRawProjectConfig,
  migrateHarnessToCodex,
  readProjectRuntime,
  resolveProjectPaths,
  updateProjectMutableState,
  writeProjectMutableState,
  writeProjectRuntimeConfig,
});
