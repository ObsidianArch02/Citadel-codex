'use strict';

const path = require('path');

function resolveProjectRoot(projectRoot) {
  return projectRoot
    || process.env.CITADEL_PROJECT_DIR
    || process.env.CLAUDE_PROJECT_DIR
    || process.cwd();
}

function resolvePluginDataDir(projectRoot) {
  const root = resolveProjectRoot(projectRoot);
  return process.env.CITADEL_PLUGIN_DATA
    || process.env.CITADEL_RUNTIME_DATA
    || process.env.CLAUDE_PLUGIN_DATA
    || path.join(root, '.codex');
}

module.exports = Object.freeze({
  resolvePluginDataDir,
  resolveProjectRoot,
});
