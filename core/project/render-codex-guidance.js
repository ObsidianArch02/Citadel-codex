#!/usr/bin/env node

'use strict';

function renderList(items) {
  if (!Array.isArray(items) || items.length === 0) return '- (none)';
  return items.map((item) => `- ${item}`).join('\n');
}

function renderCodexGuidance(spec) {
  return [
    `# ${spec.project.name}`,
    '',
    spec.project.summary,
    '',
    '## Citadel Project Guidance',
    '',
    'This file is the Codex-facing projection of the canonical Citadel project spec.',
    'It is guidance only, not runtime configuration.',
    '',
    '## Guidance Boundary',
    '',
    '- `AGENTS.md` carries behavioural guidance for Codex agents.',
    '- Runtime config lives in `.codex/config.toml`.',
    '- Mutable runtime state lives in `.codex/state.json`.',
    '- Do not encode runtime hook policy or mutable counters in this file.',
    '',
    '## Conventions',
    '',
    renderList(spec.conventions),
    '',
    '## Workflows',
    '',
    renderList(spec.workflows),
    '',
    '## Constraints',
    '',
    renderList(spec.constraints),
    '',
    '## Handoff Summary',
    '',
    'When a task completes, prefer a concise handoff that states:',
    '',
    '- What changed',
    '- Key decisions',
    '- Remaining risks or next steps',
    '',
  ].join('\n');
}

module.exports = Object.freeze({
  renderCodexGuidance,
});
