#!/usr/bin/env node

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseProjectSpec, validateProjectSpec } = require(path.join(__dirname, '..', 'core', 'project', 'load-project-spec'));
const { CODEX_GUIDANCE_TARGET, renderCodexGuidance } = require(path.join(__dirname, '..', 'runtimes', 'codex', 'guidance', 'render'));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  const templatePath = path.join(__dirname, '..', '.citadel', 'project.template.md');
  const template = fs.readFileSync(templatePath, 'utf8');
  const spec = parseProjectSpec(template);
  const errors = validateProjectSpec(spec);
  if (errors.length > 0) {
    fail(`Project template is invalid: ${errors.join('; ')}`);
  }

  const codex = renderCodexGuidance(spec);

  if (!codex.includes('## Citadel Project Guidance')) {
    fail('Codex guidance renderer must emit the Citadel Project Guidance section');
  }
  if (CODEX_GUIDANCE_TARGET.filePath !== 'AGENTS.md') {
    fail('Codex runtime guidance target must point to AGENTS.md');
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'citadel-project-guidance-'));
  const tempCitadel = path.join(tempRoot, '.citadel');
  fs.mkdirSync(tempCitadel, { recursive: true });
  fs.writeFileSync(path.join(tempCitadel, 'project.md'), template, 'utf8');
  fs.rmSync(tempRoot, { recursive: true, force: true });

  console.log('Project guidance tests pass.');
}

main();
