#!/usr/bin/env node

'use strict';

const path = require('path');
const { projectCodexSkills } = require(path.join(__dirname, '..', 'runtimes', 'codex', 'generators', 'project-skills'));

const CITADEL_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  return {
    projectRoot: argv.find((arg, index) => argv[index - 1] === '--project-root')
      ? path.resolve(argv[argv.indexOf('--project-root') + 1])
      : process.cwd(),
    skillName: argv.find((arg, index) => argv[index - 1] === '--skill') || null,
    dryRun: argv.includes('--dry-run'),
    prune: argv.includes('--prune'),
    force: argv.includes('--force'),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = projectCodexSkills({
    citadelRoot: CITADEL_ROOT,
    projectRoot: args.projectRoot,
    skillName: args.skillName,
    dryRun: args.dryRun,
    prune: args.prune,
    force: args.force,
  });

  for (const result of results) {
    const verb = args.dryRun ? 'planned' : 'applied';
    const status = result.status || 'projected';
    console.log(`[${verb}] ${result.skillName} (${status})`);
    for (const warning of result.warnings || []) {
      console.log(`[warning] ${warning}`);
    }
  }

  if (results.manifest) {
    const manifestVerb = args.dryRun ? 'would update' : 'updated';
    console.log(`[${manifestVerb}] manifest ${results.manifest.path}`);
  }
}

main();
