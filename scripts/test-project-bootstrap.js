#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootstrapProjectGuidance } = require(path.join(__dirname, '..', 'core', 'project', 'bootstrap-project-guidance'));

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'citadel-project-bootstrap-'));

try {
  const first = bootstrapProjectGuidance({
    citadelRoot: path.join(__dirname, '..'),
    projectRoot: tmpRoot,
    projectName: 'Bootstrap Test',
    projectSummary: 'Bootstrap test summary.',
  });

  assert(first.specCreated, 'bootstrap should create a missing canonical spec');
  assert(fs.existsSync(path.join(tmpRoot, '.citadel', 'project.md')), 'bootstrap should create .citadel/project.md');
  assert(fs.existsSync(path.join(tmpRoot, 'AGENTS.md')), 'bootstrap should create AGENTS.md');

  fs.writeFileSync(path.join(tmpRoot, 'AGENTS.md'), 'custom codex guidance', 'utf8');
  const second = bootstrapProjectGuidance({
    citadelRoot: path.join(__dirname, '..'),
    projectRoot: tmpRoot,
  });

  assert(!second.specCreated, 'bootstrap should reuse existing canonical spec');
  assert(second.codex.skipped, 'bootstrap should not overwrite existing AGENTS.md without flag');
  assert.equal(fs.readFileSync(path.join(tmpRoot, 'AGENTS.md'), 'utf8'), 'custom codex guidance');

  const third = bootstrapProjectGuidance({
    citadelRoot: path.join(__dirname, '..'),
    projectRoot: tmpRoot,
    overwriteGuidance: true,
  });
  assert(third.codex.written, 'bootstrap should overwrite guidance when requested');
  assert(fs.readFileSync(path.join(tmpRoot, 'AGENTS.md'), 'utf8').includes('## Citadel Project Guidance'));

  console.log('project bootstrap tests passed');
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
