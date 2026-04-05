#!/usr/bin/env node

'use strict';

const path = require('path');
const { migrateHarnessToCodex } = require(path.join(__dirname, '..', 'core', 'config', 'reader'));

function parseArgs(argv) {
  const args = {
    projectRoot: process.cwd(),
    dryRun: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-root') args.projectRoot = path.resolve(argv[++index]);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = migrateHarnessToCodex(args);

  for (const diagnostic of result.diagnostics || []) {
    console.log(`[${diagnostic.level}] ${diagnostic.message}`);
  }

  if (!result.migrated) {
    console.log(`[status] skipped (${result.reason})`);
    return;
  }

  const verb = args.dryRun ? 'would write' : 'wrote';
  for (const write of result.writes) {
    console.log(`[${verb}] ${write.kind} ${write.path}`);
  }
}

main();
