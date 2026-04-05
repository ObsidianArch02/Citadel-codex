#!/usr/bin/env node

/**
 * cost-tracker.js -- PostToolUse hook (all tools)
 *
 * Real-time session cost monitoring. Uses Citadel telemetry to compute a
 * running estimated spend. Silent most of the time -- only outputs
 * a one-line summary when cost crosses a threshold.
 *
 * Design principles:
 *   - Never nag. Surfaces at meaningful thresholds, not every tool call.
 *   - Time-gated: checks at most once per CHECK_INTERVAL_MS (3 min default).
 *   - One line of output max. No walls of text.
 *   - Tracks burn rate ($/min over recent window) so users can spot runaway sessions.
 *   - Writes state to .planning/telemetry/cost-tracker-state.json for persistence.
 *
 * Thresholds (configurable via runtime config `cost` section, with legacy
 * fallback from policy.costTracker):
 *   $5, $15, $30, $50, $75, $100, $150, $200, $300, $500
 *
 * Output format:
 *   [cost] $27.43 this session (23 min, $1.19/min) -- next alert at $30
 *
 * Exit codes:
 *   0 = always (never blocks)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const health = require('./harness-health-util');

const PROJECT_ROOT = health.PROJECT_ROOT;
const TELEMETRY_DIR = path.join(PROJECT_ROOT, '.planning', 'telemetry');
const STATE_FILE = path.join(TELEMETRY_DIR, 'cost-tracker-state.json');

// Time gate: don't check more than once per interval
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

// Default thresholds in dollars
const DEFAULT_THRESHOLDS = [5, 15, 30, 50, 75, 100, 150, 200, 300, 500];

const CITADEL_UI = process.env.CITADEL_UI === 'true';

// ── State management ─────────────────────────────────────────────────────────

function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch { return null; }
}

function writeState(state) {
  try {
    if (!fs.existsSync(TELEMETRY_DIR)) {
      fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch { /* non-critical */ }
}

// ── Policy ───────────────────────────────────────────────────────────────────

function readPolicy() {
  try {
    const config = health.readConfig();
    // Support both new `cost` section and legacy `policy.costTracker`
    const ct = config?.cost || config?.policy?.costTracker || {};
    const mode = ct.mode || 'api';

    return {
      enabled: mode !== 'off' && ct.enabled !== false,
      mode, // 'api' | 'pro' | 'max' | 'off'
      thresholds: Array.isArray(ct.thresholds) ? ct.thresholds : DEFAULT_THRESHOLDS,
      checkIntervalMs: ct.checkIntervalMs || CHECK_INTERVAL_MS,
      campaignBudgetAlerts: ct.campaignBudgetAlerts !== false,
    };
  } catch {
    return {
      enabled: true, mode: 'api', thresholds: DEFAULT_THRESHOLDS,
      checkIntervalMs: CHECK_INTERVAL_MS, campaignBudgetAlerts: true,
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Check if the active campaign has a budget and whether we're near it.
 * Reads budget from campaign frontmatter, cumulative cost from session-costs.jsonl.
 * Returns a one-line alert string or null.
 */
function checkCampaignBudget(sessionCost) {
  try {
    const campaignsDir = path.join(PROJECT_ROOT, '.planning', 'campaigns');
    if (!fs.existsSync(campaignsDir)) return null;

    // Find active campaign with a budget
    const files = fs.readdirSync(campaignsDir).filter(f => f.endsWith('.md'));
    let slug = null;
    let budget = null;

    for (const f of files) {
      const content = fs.readFileSync(path.join(campaignsDir, f), 'utf8');
      if (!/^status:\s*active/mi.test(content)) continue;
      slug = f.replace(/\.md$/, '');
      const budgetMatch = content.match(/^budget:\s*(\d+(?:\.\d+)?)/mi);
      if (budgetMatch) budget = parseFloat(budgetMatch[1]);
      break;
    }

    if (!slug || !budget) return null;

    // Sum session costs for this campaign from session-costs.jsonl
    const costFile = path.join(TELEMETRY_DIR, 'session-costs.jsonl');
    if (!fs.existsSync(costFile)) return null;

    let campaignTotal = 0;
    const lines = fs.readFileSync(costFile, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.campaign_slug !== slug) continue;
        // Prefer real_cost > override_cost > estimated_cost
        campaignTotal += entry.real_cost ?? entry.override_cost ?? entry.estimated_cost ?? 0;
      } catch { continue; }
    }

    // Add current session cost (not yet written to JSONL)
    campaignTotal += sessionCost;

    const pct = Math.round((campaignTotal / budget) * 100);

    // Read state to check if we already alerted at this level
    const state = readState();
    const lastBudgetPct = state?.lastBudgetPct || 0;

    if (pct >= 100 && lastBudgetPct < 100) {
      return `[cost] Campaign "${slug}" budget exceeded: $${campaignTotal.toFixed(0)}/$${budget} (${pct}%)`;
    }
    if (pct >= 80 && lastBudgetPct < 80) {
      return `[cost] Campaign "${slug}": $${campaignTotal.toFixed(0)}/$${budget} budget (${pct}%)`;
    }

    return null;
  } catch { return null; }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      run();
    } catch {
      process.exit(0); // fail open
    }
  });
}

function run() {
  const policy = readPolicy();
  if (!policy.enabled) {
    process.exit(0);
  }

  const now = Date.now();
  const state = readState();

  // Time gate: skip if we checked recently
  if (state && state.lastCheckMs && (now - state.lastCheckMs) < policy.checkIntervalMs) {
    process.exit(0);
  }

  const snapshot = estimateCurrentSession();
  const sessionId = snapshot.sessionId;
  if (!sessionId) process.exit(0);

  const cost = snapshot.cost;
  const durationMin = snapshot.durationMin;
  const burnRate = snapshot.burnRate;
  const agentCount = snapshot.agentCount;

  // Find which threshold we've crossed
  const thresholds = policy.thresholds.sort((a, b) => a - b);
  let currentThresholdIndex = -1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (cost >= thresholds[i]) {
      currentThresholdIndex = i;
      break;
    }
  }

  // Check if we've crossed a NEW threshold since last check
  const lastIndex = (state && state.sessionId === sessionId)
    ? (state.lastThresholdIndex ?? -1)
    : -1;

  // Check campaign budget (informational only, never blocks)
  // Done before state write so checkCampaignBudget can read prior state
  let budgetAlert = null;
  if (policy.campaignBudgetAlerts) {
    budgetAlert = checkCampaignBudget(cost);
  }

  // Save state regardless (includes budget tracking)
  writeState({
    lastCheckMs: now,
    sessionId,
    lastThresholdIndex: currentThresholdIndex,
    lastBudgetPct: budgetAlert ? (budgetAlert.includes('exceeded') ? 100 : 80) : (state?.lastBudgetPct || 0),
    cost,
    durationMin,
    burnRate: Math.round(burnRate * 100) / 100,
    messages: null,
    subagents: agentCount,
  });

  // Determine what to output
  const crossedNewThreshold = currentThresholdIndex > lastIndex;

  if (!crossedNewThreshold && !budgetAlert) {
    process.exit(0);
  }

  // Format the notification based on mode
  const messages = [];

  if (crossedNewThreshold) {
    const nextThreshold = currentThresholdIndex + 1 < thresholds.length
      ? thresholds[currentThresholdIndex + 1]
      : null;

    const costStr = '$' + cost.toFixed(2);
    const rateStr = '$' + burnRate.toFixed(2) + '/min';
    const nextStr = nextThreshold ? ` | next alert at $${nextThreshold}` : '';

    messages.push(
      `[cost] ${costStr} est this session (${durationMin} min, ${rateStr}, ${agentCount} agents)${nextStr}`
    );

    health.logTiming('cost-tracker', 0, {
      event: 'threshold-crossed',
      cost,
      threshold: thresholds[currentThresholdIndex],
      durationMin,
      burnRate: Math.round(burnRate * 100) / 100,
    });
  }

  if (budgetAlert) {
    messages.push(budgetAlert);
  }

  const output = messages.join('\n');

  if (CITADEL_UI) {
    process.stdout.write(JSON.stringify({
      hook: 'cost-tracker',
      action: crossedNewThreshold ? 'threshold' : 'budget-alert',
      message: output,
      timestamp: new Date().toISOString(),
      data: {
        cost,
        durationMin,
        burnRate: Math.round(burnRate * 100) / 100,
        threshold: crossedNewThreshold ? thresholds[currentThresholdIndex] : null,
        messages: null,
        subagents: agentCount,
        budgetAlert: budgetAlert || null,
      },
    }));
  } else {
    process.stdout.write(output);
  }

  process.exit(0);
}

function estimateCurrentSession() {
  const now = Date.now();
  const agentRunsPath = path.join(TELEMETRY_DIR, 'agent-runs.jsonl');
  const sessionId = new Date(now).toISOString().slice(0, 16);
  let agentCount = 0;
  let sessionStartTime = null;

  if (fs.existsSync(agentRunsPath)) {
    const lines = fs.readFileSync(agentRunsPath, 'utf8').split('\n').filter(Boolean);
    const fourHoursAgo = new Date(now - 4 * 60 * 60 * 1000).toISOString();

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (!entry.timestamp || entry.timestamp < fourHoursAgo) break;
        if (entry.event === 'agent-start') agentCount++;
        if (!sessionStartTime && (entry.event === 'campaign-start' || entry.event === 'wave-start')) {
          sessionStartTime = entry.timestamp;
        }
      } catch { /* skip malformed lines */ }
    }
  }

  const startTime = sessionStartTime
    ? new Date(sessionStartTime)
    : new Date(now - 10 * 60 * 1000);
  const durationMin = Math.max(1, Math.round((now - startTime.getTime()) / 60000));
  const cost = Math.round((1.00 + (agentCount * 0.50) + (durationMin * 0.10)) * 100) / 100;
  const burnRate = durationMin > 0 ? cost / durationMin : 0;

  return {
    sessionId,
    agentCount,
    durationMin,
    cost,
    burnRate,
  };
}

main();
