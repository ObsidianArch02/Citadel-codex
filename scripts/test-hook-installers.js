#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { installClaudeHooks } = require('../runtimes/claude-code/generators/install-hooks');
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

withTempDir((projectRoot) => {
  fs.mkdirSync(path.join(projectRoot, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.claude', 'settings.json'), JSON.stringify({
    permissions: { allow: ['Read'] },
    hooks: {
      PreToolUse: [
        {
          matcher: 'Read',
          hooks: [{ type: 'command', command: 'node "/custom/user-hook.js"' }],
        },
      ],
    },
  }, null, 2));

  const result = installClaudeHooks({ citadelRoot, hooksTemplatePath, projectRoot });
  const settings = JSON.parse(fs.readFileSync(result.settingsPath, 'utf8'));

  assert(settings.hooks.PreToolUse.length >= 2, 'claude install should merge generated and user hooks');
  assert.equal(settings.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB, '1', 'claude install should inject subprocess scrub env');
  assert.equal(settings.permissions.allow[0], 'Read', 'claude install should preserve non-hook settings');
});

const translated = translateCodexHooks(hooksTemplate, '/tmp/codex-adapter.js');
assert(translated.installed.length > 0, 'codex translation should install mapped hooks');
assert(translated.skipped.length > 0, 'codex translation should record unmapped hooks');

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
});

console.log('hook installer tests passed');
