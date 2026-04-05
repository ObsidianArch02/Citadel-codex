#!/usr/bin/env node

'use strict';

const RUNTIME_CONFIG_VERSION = 1;
const MUTABLE_STATE_VERSION = 1;
const CITADEL_CONFIG_VERSION = RUNTIME_CONFIG_VERSION;

const DEFAULT_EXTERNAL_ACTION_POLICY = Object.freeze({
  protectedBranches: ['main', 'master'],
  hard: [
    'gh pr merge',
    'gh pr close',
    'gh issue close',
    'gh issue delete',
    'gh release create',
    'gh repo fork',
    'gh api (mutating)',
    'git push --delete',
  ],
  soft: [
    'git push',
    'gh pr create',
    'gh pr comment/edit',
    'gh issue create/comment/edit',
  ],
});

const DEFAULT_COST_THRESHOLDS = Object.freeze([5, 15, 30, 50, 75, 100, 150, 200, 300, 500]);

const DEFAULT_COST_CONFIG = Object.freeze({
  enabled: true,
  mode: 'api',
  thresholds: [...DEFAULT_COST_THRESHOLDS],
  checkIntervalMs: 180000,
  campaignBudgetAlerts: true,
  sessionEndSummary: true,
});

const DEFAULT_TRUST = Object.freeze({
  sessions_completed: 0,
  campaigns_completed: 0,
  campaigns_reverted: 0,
  fleet_clean_merges: 0,
  improve_loops_accepted: 0,
  daemon_runs: 0,
  override: null,
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)]));
  }
  return value;
}

function mergeConfig(base, override) {
  if (override === undefined) return cloneValue(base);
  if (Array.isArray(base)) return Array.isArray(override) ? cloneValue(override) : cloneValue(base);
  if (isPlainObject(base)) {
    const overrideObject = isPlainObject(override) ? override : {};
    const result = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(overrideObject)]);
    for (const key of keys) {
      if (base[key] === undefined) result[key] = cloneValue(overrideObject[key]);
      else result[key] = mergeConfig(base[key], overrideObject[key]);
    }
    return result;
  }
  return cloneValue(override);
}

function createRuntimeConfigDefaults() {
  return {
    version: RUNTIME_CONFIG_VERSION,
    language: 'unknown',
    framework: null,
    packageManager: 'npm',
    typecheck: {
      command: null,
      perFile: false,
    },
    test: {
      command: null,
      framework: null,
    },
    qualityRules: {
      builtIn: ['no-confirm-alert', 'no-transition-all'],
      custom: [],
    },
    protectedFiles: ['.codex/config.toml', '.codex/state.json', '.claude/harness.json'],
    features: {
      intakeScanner: true,
      telemetry: true,
    },
    agentTimeouts: {
      command: 300,
      skill: 600,
      research: 900,
      build: 1800,
    },
    dependencyPatterns: [],
    policy: {
      scopeEnforcement: 'warn',
      auditLog: true,
      allowedOutOfScopeTools: [],
      externalActions: cloneValue(DEFAULT_EXTERNAL_ACTION_POLICY),
    },
    verification: {
      hot: ['programmatic', 'structural', 'performance'],
      cold: ['performance', 'accessibility', 'adversarial', 'contractual', 'cross-reference'],
      disabled: [],
    },
    docs: {
      auto: true,
      audiences: ['user', 'org', 'agents'],
      exclude: [],
    },
    preCompact: {
      handoffMode: 'auto',
    },
    cost: cloneValue(DEFAULT_COST_CONFIG),
    modelMapping: {
      opus: 'gpt-5.4',
      sonnet: 'gpt-5.4-mini',
      haiku: 'gpt-5.4-mini',
    },
    organization: null,
  };
}

function createMutableStateDefaults() {
  return {
    version: MUTABLE_STATE_VERSION,
    trust: cloneValue(DEFAULT_TRUST),
    consent: {},
    skillRegistry: {
      registeredSkills: [],
      registeredSkillCount: 0,
    },
  };
}

function createDefaultConfig() {
  const runtime = createRuntimeConfigDefaults();
  const state = createMutableStateDefaults();

  return {
    ...runtime,
    trust: state.trust,
    consent: state.consent,
    registeredSkills: state.skillRegistry.registeredSkills,
    registeredSkillCount: state.skillRegistry.registeredSkillCount,
  };
}

module.exports = Object.freeze({
  CITADEL_CONFIG_VERSION,
  DEFAULT_COST_CONFIG,
  DEFAULT_COST_THRESHOLDS,
  DEFAULT_EXTERNAL_ACTION_POLICY,
  DEFAULT_TRUST,
  MUTABLE_STATE_VERSION,
  RUNTIME_CONFIG_VERSION,
  cloneValue,
  createDefaultConfig,
  createMutableStateDefaults,
  createRuntimeConfigDefaults,
  isPlainObject,
  mergeConfig,
});
