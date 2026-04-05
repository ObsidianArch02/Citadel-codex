#!/usr/bin/env node

'use strict';

const path = require('path');
const codexRuntime = require(path.join(__dirname, '..', '..', 'runtimes', 'codex', 'runtime'));

const UNKNOWN_RUNTIME = Object.freeze({
  id: 'unknown',
  displayName: 'Unknown Runtime',
  capabilities: {},
  degradations: ['runtime-not-detected'],
});

const RUNTIME_REGISTRY = Object.freeze({
  codex: codexRuntime,
  unknown: UNKNOWN_RUNTIME,
});

function getRuntimeDefinition(runtimeId) {
  return RUNTIME_REGISTRY[runtimeId] || RUNTIME_REGISTRY.unknown;
}

function listRuntimeIds() {
  return Object.keys(RUNTIME_REGISTRY);
}

module.exports = Object.freeze({
  RUNTIME_REGISTRY,
  getRuntimeDefinition,
  listRuntimeIds,
});
