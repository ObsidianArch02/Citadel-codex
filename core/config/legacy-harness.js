#!/usr/bin/env node

'use strict';

const { isPlainObject } = require('./defaults');

const RUNTIME_FIELDS = Object.freeze([
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
  'preCompact',
  'docs',
  'organization',
  'cost',
  'modelMapping',
]);

const STATE_FIELDS = Object.freeze([
  'trust',
  'consent',
]);

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]));
  }
  return value;
}

function pickFields(source, fieldNames) {
  const result = {};
  for (const field of fieldNames) {
    if (source[field] !== undefined) result[field] = clone(source[field]);
  }
  return result;
}

function mapLegacyHarnessToRuntimeConfig(harness = {}) {
  const mapped = pickFields(harness, RUNTIME_FIELDS);
  if (!mapped.cost && isPlainObject(harness.policy) && isPlainObject(harness.policy.costTracker)) {
    mapped.cost = clone(harness.policy.costTracker);
  }
  return mapped;
}

function mapLegacyHarnessToMutableState(harness = {}) {
  const mapped = pickFields(harness, STATE_FIELDS);
  const skillRegistry = {};

  if (Array.isArray(harness.registeredSkills)) {
    skillRegistry.registeredSkills = clone(harness.registeredSkills);
  }
  if (typeof harness.registeredSkillCount === 'number') {
    skillRegistry.registeredSkillCount = harness.registeredSkillCount;
  }
  if (Object.keys(skillRegistry).length > 0) {
    mapped.skillRegistry = skillRegistry;
  }

  return mapped;
}

function findUnmappedHarnessKeys(harness = {}) {
  const mappedKeys = new Set([...RUNTIME_FIELDS, ...STATE_FIELDS, 'registeredSkills', 'registeredSkillCount']);
  return Object.keys(harness).filter((key) => !mappedKeys.has(key));
}

module.exports = Object.freeze({
  RUNTIME_FIELDS,
  STATE_FIELDS,
  findUnmappedHarnessKeys,
  mapLegacyHarnessToMutableState,
  mapLegacyHarnessToRuntimeConfig,
});
