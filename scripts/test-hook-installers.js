#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { installCodexHooks, translateCodexHooks } = require('../runtimes/codex/generators/install-hooks');

function withTempDir(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'citadel-hook-install-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const citadelRoot = path.resolve(__dirname, '..');
const hooksTemplatePath = path.join(citadelRoot, 'hooks', 'hooks-template.json');
const hooksTemplate = JSON.parse(fs.readFileSync(hooksTemplatePath, 'utf8'));

const translated = translateCodexHooks(hooksTemplate, '/tmp/codex-adapter.js');
assert(translated.installed.length > 0, 'codex translation should install mapped hooks');
assert(translated.skipped.length > 0, 'codex translation should record unmapped hooks');
assert(translated.hooks.PreToolUse.some((entry) => entry.matcher === 'Edit'), 'codex translation should expand Edit matcher explicitly');
assert(translated.hooks.PreToolUse.some((entry) => entry.matcher === 'Write'), 'codex translation should expand Write matcher explicitly');
assert(!translated.hooks.PreToolUse.some((entry) => entry.matcher === 'Edit|Write'), 'codex translation should not leave pipe-delimited matchers');
assert(translated.supportMatrix, 'codex translation should emit a support matrix');
assert(translated.supportSummary, 'codex translation should emit support summary counts');
assert(translated.supportSummary.fullySupportedCount > 0, 'codex translation should include fully supported hooks');
assert(translated.supportSummary.unsupportedCount > 0, 'codex translation should include unsupported hooks');
assert(
  translated.supportMatrix.degraded.some((entry) => entry.event === 'SessionEnd' && entry.codexEvent === 'Stop'),
  'codex translation should mark SessionEnd as degraded mapping to Stop'
);
assert(
  translated.supportMatrix.unsupported.some((entry) => entry.event === 'PostCompact'),
  'codex translation should mark PostCompact as unsupported'
);

withTempDir((projectRoot) => {
  const outputPath = path.join(projectRoot, '.codex', 'hooks.json');
  const result = installCodexHooks({
    hooksTemplate,
    adapterScriptPath: '/tmp/codex-adapter.js',
    existingHooks: {
      PreToolUse: [
        {
          hooks: [{ type: 'command', command: 'node "/custom/user-hook.js"' }],
        },
      ],
    },
    outputPath,
  });

  const hooks = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert(result.hooks.PreToolUse.length >= 2, 'codex install should merge generated and user hooks');
  assert(hooks.hooks.PreToolUse.length >= 2, 'codex install should persist merged hooks');
  assert(result.supportSummary.degradedCount > 0, 'codex install result should expose degraded capabilities');
  assert(result.supportSummary.unsupportedCount > 0, 'codex install result should expose unsupported capabilities');
});

console.log('hook installer tests passed');
