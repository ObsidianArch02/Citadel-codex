#!/usr/bin/env node

/**
 * install-hooks.js — Resolves Citadel hook paths into a project's .claude/settings.json
 *
 * Why this exists:
 *   ${CLAUDE_PLUGIN_ROOT} in hooks.json doesn't expand in hook commands
 *   (anthropics/claude-code#24529). This script resolves the variable to an
 *   absolute path and writes working hooks into the project's settings.json.
 *
 * Usage:
 *   node /path/to/Citadel/scripts/install-hooks.js          # from project dir
 *   node /path/to/Citadel/scripts/install-hooks.js /project  # explicit project path
 */

'use strict';

const path = require('path');
const { installClaudeHooks } = require('../runtimes/claude-code/generators/install-hooks');

const CITADEL_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = process.argv[2] || process.env.CLAUDE_PROJECT_DIR || process.cwd();

function main() {
  try {
    const result = installClaudeHooks({ citadelRoot: CITADEL_ROOT, projectRoot: PROJECT_ROOT });
    console.log(`Citadel hooks installed to ${result.settingsPath}`);
    console.log(`  ${result.hookCount} Citadel hooks resolved (${result.citadelRoot})`);
    if (result.preservedCount > 0) {
      console.log(`  ${result.preservedCount} existing user hooks preserved`);
    }
    console.log('Hooks are ready. No restart needed.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error('Is this script inside a Citadel installation?');
    process.exit(1);
  }
}

main();
