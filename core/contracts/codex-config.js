#!/usr/bin/env node

'use strict';

const { CITADEL_CONFIG_VERSION, createRuntimeConfigDefaults } = require('../config/defaults');

const CODEX_CONFIG_FIELDS = Object.freeze([
  'version',
  'language',
  'framework',
  'packageManager',
  'typecheck',
  'test',
  'qualityRules',
  'protectedFiles',
  'features',
  'agentTimeouts',
  'dependencyPatterns',
  'policy',
  'verification',
  'docs',
  'preCompact',
  'cost',
  'modelMapping',
  'organization',
]);

function createCodexConfigSkeleton() {
  return createRuntimeConfigDefaults();
}

function validateCodexConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return ['Codex config must be an object'];
  }
  if (config.version !== CITADEL_CONFIG_VERSION) {
    errors.push(`Unsupported Codex config version: ${config.version}`);
  }
  if (typeof config.language !== 'string') {
    errors.push('language must be a string');
  }
  if (config.framework !== null && config.framework !== undefined && typeof config.framework !== 'string') {
    errors.push('framework must be a string when provided');
  }
  if (typeof config.packageManager !== 'string') {
    errors.push('packageManager must be a string');
  }
  if (!config.typecheck || typeof config.typecheck !== 'object') {
    errors.push('typecheck must be an object');
  }
  if (!config.test || typeof config.test !== 'object') {
    errors.push('test must be an object');
  }
  if (!Array.isArray(config.protectedFiles)) {
    errors.push('protectedFiles must be an array');
  }
  if (!config.policy || typeof config.policy !== 'object') {
    errors.push('policy must be an object');
  }
  if (!config.verification || typeof config.verification !== 'object') {
    errors.push('verification must be an object');
  }
  if (!config.docs || typeof config.docs !== 'object') {
    errors.push('docs must be an object');
  }
  if (!config.preCompact || typeof config.preCompact !== 'object') {
    errors.push('preCompact must be an object');
  }
  if (!config.cost || typeof config.cost !== 'object') {
    errors.push('cost must be an object');
  }
  if (!config.modelMapping || typeof config.modelMapping !== 'object') {
    errors.push('modelMapping must be an object');
  }

  return errors;
}

module.exports = Object.freeze({
  CITADEL_CONFIG_VERSION,
  CODEX_CONFIG_FIELDS,
  createCodexConfigSkeleton,
  validateCodexConfig,
});
