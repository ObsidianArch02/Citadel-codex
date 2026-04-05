#!/usr/bin/env node

'use strict';

const path = require('path');
const { runCodexSetup, SETUP_MODES } = require(path.join(__dirname, '..', 'core', 'setup', 'codex-setup'));

function parseArgs(argv) {
  const args = {
    projectRoot: process.cwd(),
    mode: 'full',
    dryRun: false,
    overwriteGuidance: false,
    forceConfigMigration: false,
    projectName: null,
    projectSummary: null,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-root') args.projectRoot = path.resolve(argv[++index]);
    else if (arg === '--mode') args.mode = argv[++index];
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--overwrite-guidance') args.overwriteGuidance = true;
    else if (arg === '--force-config-migration') args.forceConfigMigration = true;
    else if (arg === '--project-name') args.projectName = argv[++index];
    else if (arg === '--project-summary') args.projectSummary = argv[++index];
    else if (arg === '--json') args.json = true;
  }

  return args;
}

function printSummary(summary) {
  console.log(`[setup] mode=${summary.mode} dryRun=${summary.dryRun ? 'true' : 'false'}`);
  for (const action of summary.actions) {
    const pathSuffix = action.path ? ` ${action.path}` : '';
    console.log(`[${action.status}] ${action.id}${pathSuffix}`);
    if (action.detail) console.log(`  ${action.detail}`);
  }
  if (summary.hooks) {
    console.log(`[hooks] installed=${summary.hooks.installed} skipped=${summary.hooks.skipped}`);
    for (const warning of summary.hooks.warnings || []) {
      console.log(`[hooks-warning] ${warning}`);
    }
  }
  if (summary.diagnostics.length > 0) {
    for (const diagnostic of summary.diagnostics) {
      console.log(`[${diagnostic.level}] ${diagnostic.message}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!SETUP_MODES.includes(args.mode)) {
    console.error(`Invalid mode "${args.mode}". Expected one of: ${SETUP_MODES.join(', ')}`);
    process.exit(1);
  }

  const summary = runCodexSetup({
    ...args,
    citadelRoot: path.resolve(__dirname, '..'),
  });

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  printSummary(summary);
}

main();
