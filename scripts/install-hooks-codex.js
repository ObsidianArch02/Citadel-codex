#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { installCodexHooks } = require('../runtimes/codex/generators/install-hooks');

const CITADEL_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  return {
    projectRoot: positional[0] ? path.resolve(positional[0]) : process.cwd(),
    json: argv.includes('--json'),
  };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const hooksTemplatePath = path.join(CITADEL_ROOT, 'hooks', 'hooks-template.json');
    const hooksTemplate = JSON.parse(fs.readFileSync(hooksTemplatePath, 'utf8'));
    const adapterScriptPath = path.join(CITADEL_ROOT, 'hooks_src', 'codex-adapter.js');
    const outputPath = path.join(args.projectRoot, '.codex', 'hooks.json');
    const existingHooks = fs.existsSync(outputPath)
      ? (JSON.parse(fs.readFileSync(outputPath, 'utf8')).hooks || {})
      : {};

    const result = installCodexHooks({
      hooksTemplate,
      adapterScriptPath,
      existingHooks,
      outputPath,
    });

    if (args.json) {
      console.log(JSON.stringify({
        outputPath,
        installed: result.installed.length,
        skipped: result.skipped.length,
        supportSummary: result.supportSummary,
        warnings: result.warnings,
      }, null, 2));
      return;
    }

    console.log(`Citadel Codex hooks installed to ${outputPath}`);
    console.log(`  ${result.installed.length} Citadel hooks translated for Codex`);
    if (result.skipped.length > 0) {
      console.log(`  ${result.skipped.length} hook mappings skipped due to missing Codex lifecycle equivalents`);
    }
    console.log(
      `  Support matrix: ${result.supportSummary.fullySupportedCount} fully supported, ` +
      `${result.supportSummary.degradedCount} degraded, ${result.supportSummary.unsupportedCount} unsupported`
    );
    if (result.supportSummary.degradedHooks.length > 0) {
      console.log(`  Degraded hooks: ${result.supportSummary.degradedHooks.join(', ')}`);
    }
    if (result.supportSummary.unsupportedHooks.length > 0) {
      console.log(`  Unsupported hooks: ${result.supportSummary.unsupportedHooks.join(', ')}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
