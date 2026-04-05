#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runCodexSetup } = require(path.join(__dirname, '..', 'core', 'setup', 'codex-setup'));

const CITADEL_ROOT = path.join(__dirname, '..');

function withTempDir(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'citadel-codex-setup-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

withTempDir((projectRoot) => {
  const summary = runCodexSetup({
    projectRoot,
    citadelRoot: CITADEL_ROOT,
    mode: 'full',
    dryRun: true,
  });

  assert(summary.actions.some((action) => action.id === 'project-spec' && action.status === 'planned-write'));
  assert(summary.actions.some((action) => action.id === 'guidance' && action.status === 'planned-write'));
  assert(summary.actions.some((action) => action.id === 'config' && action.status === 'planned-write'));
  assert(summary.actions.some((action) => action.id === 'hooks' && action.status.startsWith('planned')));
  assert(!fs.existsSync(path.join(projectRoot, '.citadel', 'project.md')), 'dry-run must not write .citadel/project.md');
  assert(!fs.existsSync(path.join(projectRoot, '.codex', 'config.toml')), 'dry-run must not write .codex/config.toml');
});

withTempDir((projectRoot) => {
  const summary = runCodexSetup({
    projectRoot,
    citadelRoot: CITADEL_ROOT,
    mode: 'full',
  });

  assert(summary.actions.some((action) => action.id === 'project-spec' && action.status === 'created'));
  assert(fs.existsSync(path.join(projectRoot, '.citadel', 'project.md')));
  assert(fs.existsSync(path.join(projectRoot, 'AGENTS.md')));
  assert(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml')));
  assert(fs.existsSync(path.join(projectRoot, '.codex', 'state.json')));
  assert(fs.existsSync(path.join(projectRoot, '.codex', 'hooks.json')));
  assert(fs.existsSync(path.join(projectRoot, '.codex', 'agents')));
  assert(fs.existsSync(path.join(projectRoot, '.agents', 'skills')));
  assert(summary.projections.skills > 0);
  assert(summary.projections.agents > 0);
});

withTempDir((projectRoot) => {
  runCodexSetup({
    projectRoot,
    citadelRoot: CITADEL_ROOT,
    mode: 'standard',
  });

  fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), 'custom guidance', 'utf8');
  const second = runCodexSetup({
    projectRoot,
    citadelRoot: CITADEL_ROOT,
    mode: 'standard',
  });
  assert(second.actions.some((action) => action.id === 'guidance' && action.status === 'skipped'));
  assert.equal(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8'), 'custom guidance');

  runCodexSetup({
    projectRoot,
    citadelRoot: CITADEL_ROOT,
    mode: 'standard',
    overwriteGuidance: true,
  });
  assert.notEqual(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8'), 'custom guidance');
});

withTempDir((projectRoot) => {
  fs.mkdirSync(path.join(projectRoot, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.claude', 'harness.json'), JSON.stringify({
    language: 'python',
    packageManager: 'pip',
    trust: {
      sessions_completed: 11,
    },
  }, null, 2));

  const summary = runCodexSetup({
    projectRoot,
    citadelRoot: CITADEL_ROOT,
    mode: 'standard',
  });

  assert(summary.actions.some((action) => action.id === 'config' && action.source === 'legacy-harness'));
  assert(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml')));
  assert(fs.existsSync(path.join(projectRoot, '.codex', 'state.json')));
  const state = JSON.parse(fs.readFileSync(path.join(projectRoot, '.codex', 'state.json'), 'utf8'));
  assert.equal(state.trust.sessions_completed, 11);
});

withTempDir((projectRoot) => {
  runCodexSetup({
    projectRoot,
    citadelRoot: CITADEL_ROOT,
    mode: 'minimal',
  });

  assert(fs.existsSync(path.join(projectRoot, '.agents', 'skills')));
  assert(!fs.existsSync(path.join(projectRoot, '.codex', 'config.toml')));
  assert(!fs.existsSync(path.join(projectRoot, 'AGENTS.md')));
});

console.log('codex setup tests passed');
