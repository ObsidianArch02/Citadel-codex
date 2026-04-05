#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { CODEX_GUIDANCE_TARGET } = require('../../runtimes/codex/guidance/render');
const { ensureProjectSpec } = require('../project/bootstrap-project-guidance');
const { loadProjectSpec, resolveProjectSpecPath } = require('../project/load-project-spec');
const { projectCodexSkills } = require('../../runtimes/codex/generators/project-skills');
const { projectCodexAgents } = require('../../runtimes/codex/generators/project-agents');
const { installCodexHooks } = require('../../runtimes/codex/generators/install-hooks');
const { createRuntimeConfigDefaults, createMutableStateDefaults } = require('../config/defaults');
const {
  migrateHarnessToCodex,
  resolveProjectPaths,
  writeProjectMutableState,
  writeProjectRuntimeConfig,
} = require('../config/reader');

const SETUP_MODES = Object.freeze(['minimal', 'standard', 'full']);

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function createAction(id, status, detail = '', filePath = null, meta = {}) {
  return {
    id,
    status,
    detail,
    path: filePath,
    ...meta,
  };
}

function writeCodexGuidance(projectRoot, spec, options) {
  const targetPath = path.join(projectRoot, CODEX_GUIDANCE_TARGET.filePath);
  const exists = fs.existsSync(targetPath);
  const overwrite = options.overwriteGuidance === true;
  const dryRun = options.dryRun === true;

  if (exists && !overwrite) {
    return createAction(
      'guidance',
      'skipped',
      'AGENTS.md already exists and overwrite is disabled.',
      targetPath
    );
  }

  const isOverwrite = exists && overwrite;
  if (!dryRun) {
    ensureDirectory(path.dirname(targetPath));
    fs.writeFileSync(targetPath, CODEX_GUIDANCE_TARGET.render(spec), 'utf8');
  }

  const status = dryRun ? (isOverwrite ? 'planned-overwrite' : 'planned-write') : (isOverwrite ? 'overwritten' : 'written');
  const detail = isOverwrite
    ? 'AGENTS.md overwritten from canonical project spec.'
    : 'AGENTS.md generated from canonical project spec.';
  return createAction('guidance', status, detail, targetPath);
}

function ensureCodexConfig(projectRoot, options, summary) {
  const dryRun = options.dryRun === true;
  const paths = resolveProjectPaths(projectRoot);
  const hasConfig = fs.existsSync(paths.codexConfigPath);
  const hasState = fs.existsSync(paths.codexStatePath);
  const hasLegacy = fs.existsSync(paths.legacyHarnessPath);

  if (!hasConfig && hasLegacy) {
    const migration = migrateHarnessToCodex({
      projectRoot,
      dryRun,
      force: options.forceConfigMigration === true,
    });
    for (const diagnostic of migration.diagnostics || []) {
      summary.diagnostics.push(diagnostic);
    }
    if (!migration.migrated) {
      summary.actions.push(createAction(
        'config',
        'skipped',
        `Codex config migration skipped (${migration.reason}).`,
        paths.codexConfigPath
      ));
      return;
    }
    for (const write of migration.writes) {
      const actionId = write.kind === 'mutable-state' ? 'state' : 'config';
      const status = dryRun ? 'planned-write' : 'written';
      const detail = write.kind === 'mutable-state'
        ? 'Mutable state migrated from legacy harness.'
        : 'Runtime config migrated from legacy harness.';
      summary.actions.push(createAction(actionId, status, detail, write.path, { source: 'legacy-harness' }));
    }
    return;
  }

  if (!hasConfig) {
    const config = createRuntimeConfigDefaults();
    if (!dryRun) writeProjectRuntimeConfig(projectRoot, config);
    summary.actions.push(createAction(
      'config',
      dryRun ? 'planned-write' : 'written',
      'Initialised .codex/config.toml with Codex runtime defaults.',
      paths.codexConfigPath,
      { source: 'defaults' }
    ));
  } else {
    summary.actions.push(createAction(
      'config',
      'reused',
      'Reused existing .codex/config.toml.',
      paths.codexConfigPath
    ));
  }

  if (!hasState) {
    const state = createMutableStateDefaults();
    if (!dryRun) writeProjectMutableState(projectRoot, state);
    summary.actions.push(createAction(
      'state',
      dryRun ? 'planned-write' : 'written',
      'Initialised .codex/state.json for mutable setup state.',
      paths.codexStatePath,
      { source: 'defaults' }
    ));
  } else {
    summary.actions.push(createAction(
      'state',
      'reused',
      'Reused existing .codex/state.json.',
      paths.codexStatePath
    ));
  }
}

function installHooks(projectRoot, citadelRoot, options, summary) {
  const dryRun = options.dryRun === true;
  const hooksTemplatePath = path.join(citadelRoot, 'hooks', 'hooks-template.json');
  const hooksTemplate = JSON.parse(fs.readFileSync(hooksTemplatePath, 'utf8'));
  const adapterScriptPath = path.join(citadelRoot, 'hooks_src', 'codex-adapter.js');
  const outputPath = path.join(projectRoot, '.codex', 'hooks.json');
  const existed = fs.existsSync(outputPath);
  const existingHooks = existed
    ? (JSON.parse(fs.readFileSync(outputPath, 'utf8')).hooks || {})
    : {};

  const installOptions = {
    hooksTemplate,
    adapterScriptPath,
    existingHooks,
  };
  if (!dryRun) installOptions.outputPath = outputPath;

  const result = installCodexHooks(installOptions);
  const status = dryRun
    ? (existed ? 'planned-overwrite' : 'planned-write')
    : (existed ? 'overwritten' : 'written');

  summary.actions.push(createAction(
    'hooks',
    status,
    `Installed ${result.installed.length} mapped hooks; ${result.skipped.length} skipped mappings.`,
    outputPath
  ));
  summary.hooks = {
    installed: result.installed.length,
    skipped: result.skipped.length,
    warnings: result.warnings || [],
  };
}

function runCodexSetup(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const citadelRoot = options.citadelRoot || path.resolve(__dirname, '..', '..');
  const dryRun = options.dryRun === true;
  const mode = SETUP_MODES.includes(options.mode) ? options.mode : 'full';

  const summary = {
    projectRoot,
    citadelRoot,
    mode,
    dryRun,
    actions: [],
    diagnostics: [],
    hooks: null,
    projections: {
      skills: 0,
      agents: 0,
    },
  };

  let spec = null;

  if (mode !== 'minimal') {
    const specPath = resolveProjectSpecPath(projectRoot, options.specPath);
    const specExists = fs.existsSync(specPath);

    if (dryRun && !specExists) {
      summary.actions.push(createAction(
        'project-spec',
        'planned-write',
        'Would create canonical .citadel/project.md.',
        specPath
      ));
    } else {
      const ensured = ensureProjectSpec({
        ...options,
        projectRoot,
        citadelRoot,
      });
      spec = ensured.loaded.spec;
      summary.actions.push(createAction(
        'project-spec',
        ensured.created ? 'created' : 'reused',
        ensured.created
          ? 'Created canonical .citadel/project.md.'
          : 'Reused canonical .citadel/project.md.',
        ensured.specPath
      ));
      for (const error of ensured.loaded.errors || []) {
        summary.diagnostics.push({
          level: 'error',
          code: 'project-spec-invalid',
          message: error,
        });
      }
    }

    if (!spec && fs.existsSync(specPath)) {
      const loaded = loadProjectSpec(projectRoot, specPath);
      spec = loaded.spec;
      for (const error of loaded.errors || []) {
        summary.diagnostics.push({
          level: 'error',
          code: 'project-spec-invalid',
          message: error,
        });
      }
    }

    if (spec) {
      summary.actions.push(writeCodexGuidance(projectRoot, spec, options));
    } else {
      summary.actions.push(createAction(
        'guidance',
        'planned-write',
        'Would generate AGENTS.md from canonical project spec.',
        path.join(projectRoot, CODEX_GUIDANCE_TARGET.filePath)
      ));
    }

    ensureCodexConfig(projectRoot, options, summary);
  }

  const skillResults = projectCodexSkills({
    citadelRoot,
    projectRoot,
    dryRun,
  });
  summary.projections.skills = skillResults.length;
  summary.actions.push(createAction(
    'skills',
    dryRun ? 'planned-write' : 'written',
    `Projected ${skillResults.length} Codex skill artefacts.`,
    path.join(projectRoot, '.agents', 'skills')
  ));

  if (mode === 'full') {
    const agentResults = projectCodexAgents({
      citadelRoot,
      projectRoot,
      dryRun,
    });
    summary.projections.agents = agentResults.length;
    summary.actions.push(createAction(
      'agents',
      dryRun ? 'planned-write' : 'written',
      `Projected ${agentResults.length} Codex agent manifests.`,
      path.join(projectRoot, '.codex', 'agents')
    ));
    installHooks(projectRoot, citadelRoot, options, summary);
  }

  return summary;
}

module.exports = Object.freeze({
  SETUP_MODES,
  runCodexSetup,
});
