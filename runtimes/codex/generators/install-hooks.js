'use strict';

const {
  mergeHookMaps,
  quoteNodeCommand,
  readJson,
  writeJson,
} = require('../../../core/hooks/install');

const CODEX_EVENTS = new Set([
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'Stop',
]);

const EVENT_MAP = {
  SessionStart: 'SessionStart',
  PreToolUse: 'PreToolUse',
  PostToolUse: 'PostToolUse',
  PostToolUseFailure: null,
  PreCompact: null,
  PostCompact: null,
  Stop: 'Stop',
  StopFailure: null,
  SessionEnd: 'Stop',
  SubagentStop: null,
  TaskCreated: null,
  TaskCompleted: null,
  WorktreeCreate: null,
  WorktreeRemove: null,
};

function extractHookName(command) {
  const match = command.match(/hooks_src\/([^.]+)\.js/);
  return match ? match[1] : null;
}

function translateCodexHooks(hooksTemplate, adapterScriptPath) {
  const codexHooks = {};
  const warnings = [];
  const installed = [];
  const skipped = [];
  const adapterPath = adapterScriptPath.replace(/\\/g, '/');
  const adapterCmd = quoteNodeCommand(`node ${adapterPath}`);

  for (const [citadelEvent, entries] of Object.entries(hooksTemplate.hooks || {})) {
    const codexEvent = EVENT_MAP[citadelEvent];

    if (!codexEvent) {
      for (const entry of entries) {
        for (const hook of entry.hooks || []) {
          const name = extractHookName(hook.command);
          if (name) skipped.push({ hook: name, event: citadelEvent, reason: 'no Codex equivalent' });
        }
      }
      warnings.push(`${citadelEvent}: no Codex equivalent (${entries.length} hook(s) skipped)`);
      continue;
    }

    if (!codexHooks[codexEvent]) codexHooks[codexEvent] = [];

    for (const entry of entries) {
      if (!entry.hooks) continue;
      const codexEntry = {};
      if (entry.matcher) codexEntry.matcher = entry.matcher;

      codexEntry.hooks = [];
      for (const hook of entry.hooks) {
        const hookName = extractHookName(hook.command);
        if (!hookName) continue;

        codexEntry.hooks.push({
          type: 'command',
          command: `${adapterCmd} ${hookName}`,
          statusMessage: `Citadel: ${hookName}`,
          timeout: hook.timeout || 30,
        });
        installed.push({ hook: hookName, event: codexEvent });
      }

      if (codexEntry.hooks.length > 0) codexHooks[codexEvent].push(codexEntry);
    }
  }

  return { hooks: codexHooks, installed, skipped, warnings };
}

function installCodexHooks(options = {}) {
  const existingHooks = options.existingHooks || {};
  const translated = translateCodexHooks(options.hooksTemplate, options.adapterScriptPath);
  const mergedHooks = mergeHookMaps({
    existingHooks,
    generatedHooks: translated.hooks,
    preserveMarker: 'codex-adapter',
  });

  const filteredHooks = Object.fromEntries(
    Object.entries(mergedHooks).filter(([event]) => CODEX_EVENTS.has(event))
  );

  if (options.outputPath) {
    writeJson(options.outputPath, { hooks: filteredHooks });
  }

  return {
    ...translated,
    hooks: filteredHooks,
  };
}

module.exports = {
  CODEX_EVENTS,
  EVENT_MAP,
  extractHookName,
  installCodexHooks,
  translateCodexHooks,
};
