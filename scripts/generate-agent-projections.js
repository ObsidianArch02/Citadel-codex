#!/usr/bin/env node

'use strict';

const path = require('path');
const { projectCodexAgents } = require(path.join(__dirname, '..', 'runtimes', 'codex', 'generators', 'project-agents'));

const CITADEL_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const modelMapping = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--map') continue;
    const pair = argv[index + 1] || '';
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    const from = pair.slice(0, separator).trim();
    const to = pair.slice(separator + 1).trim();
    if (from && to) modelMapping[from] = to;
  }

  return {
    projectRoot: argv.find((arg, index) => argv[index - 1] === '--project-root')
      ? path.resolve(argv[argv.indexOf('--project-root') + 1])
      : process.cwd(),
    agentName: argv.find((arg, index) => argv[index - 1] === '--agent') || null,
    dryRun: argv.includes('--dry-run'),
    modelMapping,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = projectCodexAgents({
    citadelRoot: CITADEL_ROOT,
    projectRoot: args.projectRoot,
    agentName: args.agentName,
    dryRun: args.dryRun,
    modelMapping: args.modelMapping,
  });

  for (const result of results) {
    const verb = args.dryRun ? 'planned' : 'applied';
    const agent = result.parsedAgent.frontmatter.name || result.parsedAgent.name;
    console.log(`[${verb}] ${agent} (${result.projection.instructionChars} chars)`);
  }
}

main();
