#!/usr/bin/env node

'use strict';

module.exports = Object.freeze({
  id: 'codex',
  displayName: 'Codex',
  capabilities: {
    guidance: { support: 'full', notes: 'Supports AGENTS.md and projected guidance files.' },
    skills: { support: 'partial', notes: 'Supports projected skill artifacts and implicit invocation metadata.' },
    agents: { support: 'partial', notes: 'Supports projected Codex-native agent manifests and subagents.' },
    hooks: { support: 'partial', notes: 'Requires an adapter layer and has fewer native lifecycle events.' },
    workspace: { support: 'full', notes: 'Standard file and shell workflow available.' },
    worktrees: { support: 'partial', notes: 'Citadel can manage worktrees externally; runtime does not provide this natively.' },
    approvals: { support: 'partial', notes: 'Approval model differs from Claude Code and needs adapter-aware policy handling.' },
    history: { support: 'partial', notes: 'Has native session persistence, but campaign state remains Citadel-owned.' },
    telemetry: { support: 'partial', notes: 'Citadel telemetry remains external to runtime-native history.' },
    mcp: { support: 'full', notes: 'Codex supports MCP integrations directly.' },
    surfaces: { support: 'partial', notes: 'Can support Citadel surfaces, but slash-command parity is not native.' },
  },
  degradations: [
    'reduced-hook-lifecycle',
    'adapter-required-for-hook-parity',
  ],
});
