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

const SUPPORT_LEVELS = Object.freeze({
  FULL: 'fully-supported',
  DEGRADED: 'degraded',
  UNSUPPORTED: 'unsupported',
});

function extractHookName(command) {
  const match = command.match(/hooks_src\/([^.]+)\.js/);
  return match ? match[1] : null;
}

function getEventSupport(citadelEvent, codexEvent) {
  if (!codexEvent) {
    return {
      level: SUPPORT_LEVELS.UNSUPPORTED,
      reason: `No Codex lifecycle equivalent for ${citadelEvent}.`,
    };
  }
  if (codexEvent !== citadelEvent) {
    return {
      level: SUPPORT_LEVELS.DEGRADED,
      reason: `${citadelEvent} maps to ${codexEvent} in Codex.`,
    };
  }
  return {
    level: SUPPORT_LEVELS.FULL,
    reason: 'Direct lifecycle mapping.',
  };
}

function expandPipeMatcherEntries(entry) {
  if (!entry || typeof entry !== 'object') return [];
  if (!entry.matcher || typeof entry.matcher !== 'string' || !entry.matcher.includes('|')) {
    return [entry];
  }

  const matchers = entry.matcher
    .split('|')
    .map((matcher) => matcher.trim())
    .filter(Boolean);

  if (matchers.length <= 1) return [entry];
  return matchers.map((matcher) => ({ ...entry, matcher }));
}

function createSupportSummary(supportMatrix) {
  const fullySupported = supportMatrix.fullySupported || [];
  const degraded = supportMatrix.degraded || [];
  const unsupported = supportMatrix.unsupported || [];
  const uniqueEvents = (items) => [...new Set(items.map((item) => item.event))].sort();
  const uniqueHooks = (items) => [...new Set(items.map((item) => item.hook))].sort();

  return {
    fullySupportedCount: fullySupported.length,
    degradedCount: degraded.length,
    unsupportedCount: unsupported.length,
    fullySupportedEvents: uniqueEvents(fullySupported),
    degradedEvents: uniqueEvents(degraded),
    unsupportedEvents: uniqueEvents(unsupported),
    degradedHooks: uniqueHooks(degraded),
    unsupportedHooks: uniqueHooks(unsupported),
  };
}

function translateCodexHooks(hooksTemplate, adapterScriptPath) {
  const codexHooks = {};
  const warnings = [];
  const installed = [];
  const skipped = [];
  const supportMatrix = {
    fullySupported: [],
    degraded: [],
    unsupported: [],
  };
  const adapterPath = adapterScriptPath.replace(/\\/g, '/');
  const adapterCmd = quoteNodeCommand(`node ${adapterPath}`);

  for (const [citadelEvent, entries] of Object.entries(hooksTemplate.hooks || {})) {
    const codexEvent = EVENT_MAP[citadelEvent];
    const support = getEventSupport(citadelEvent, codexEvent);

    if (!codexEvent) {
      for (const entry of entries) {
        for (const hook of entry.hooks || []) {
          const name = extractHookName(hook.command);
          if (name) {
            skipped.push({ hook: name, event: citadelEvent, reason: 'no Codex equivalent' });
            supportMatrix.unsupported.push({
              hook: name,
              event: citadelEvent,
              codexEvent: null,
              reason: support.reason,
            });
          }
        }
      }
      warnings.push(`${citadelEvent}: no Codex equivalent (${entries.length} hook(s) skipped)`);
      continue;
    }

    if (support.level === SUPPORT_LEVELS.DEGRADED) {
      warnings.push(`${citadelEvent}: mapped to ${codexEvent} (degraded parity)`);
    }

    if (!codexHooks[codexEvent]) codexHooks[codexEvent] = [];

    for (const entry of entries) {
      for (const expandedEntry of expandPipeMatcherEntries(entry)) {
        if (!expandedEntry.hooks) continue;

        const codexEntry = {};
        if (expandedEntry.matcher) codexEntry.matcher = expandedEntry.matcher;

        codexEntry.hooks = [];
        for (const hook of expandedEntry.hooks) {
          const hookName = extractHookName(hook.command);
          if (!hookName) continue;

          codexEntry.hooks.push({
            type: 'command',
            command: `${adapterCmd} ${hookName}`,
            statusMessage: `Citadel: ${hookName}`,
            timeout: hook.timeout || 30,
          });
          installed.push({ hook: hookName, event: codexEvent });
          if (support.level === SUPPORT_LEVELS.FULL) {
            supportMatrix.fullySupported.push({
              hook: hookName,
              event: citadelEvent,
              codexEvent,
              reason: support.reason,
            });
          } else {
            supportMatrix.degraded.push({
              hook: hookName,
              event: citadelEvent,
              codexEvent,
              reason: support.reason,
            });
          }
        }

        if (codexEntry.hooks.length > 0) codexHooks[codexEvent].push(codexEntry);
      }
    }
  }

  return {
    hooks: codexHooks,
    installed,
    skipped,
    warnings,
    supportMatrix,
    supportSummary: createSupportSummary(supportMatrix),
  };
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
  SUPPORT_LEVELS,
  createSupportSummary,
  expandPipeMatcherEntries,
  extractHookName,
  getEventSupport,
  installCodexHooks,
  translateCodexHooks,
};
