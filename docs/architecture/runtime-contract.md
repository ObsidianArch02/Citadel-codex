# Runtime Contract

> last-updated: 2026-04-05

This document defines the intended runtime-agnostic architecture boundary for
Citadel.

## Purpose

Citadel should be the system of record for orchestration, campaigns, telemetry,
skills, policy, and coordination.

Codex should be treated as the active runtime that projects Citadel
concepts into runtime-native guidance files, hooks, agents, and surfaces.

## Canonical Layers

Citadel should be organized into three layers:

1. `core/` — runtime-agnostic orchestration logic
2. `runtimes/` — runtime adapters and generators
3. `surfaces/` — CLI entrypoints and future
   MCP or desktop integrations

## Canonical Sources of Truth

- `skills/` — canonical skill definitions
- `agents/` — canonical agent role definitions
- `.citadel/project.*` — canonical project guidance spec
- `core/` — canonical runtime-independent logic

Generated runtime projections:

- `AGENTS.md`
- `.codex/hooks.json`
- `.codex/config.toml`
- `.codex/state.json`
- `.codex/agents/*.toml`
- `.agents/skills/*/agents/openai.yaml`

Canonical runtime config sources:

- `.citadel/project.md` — guidance only
- `.codex/config.toml` — Codex runtime config
- `.codex/state.json` — Codex mutable state
- `.claude/harness.json` — legacy fallback only

See [`docs/config/codex-runtime-config.md`](/Users/sukhoina/Downloads/Citadel-codex/docs/config/codex-runtime-config.md) for the field-level schema, precedence rules, and migration path.

## Runtime Contract Shape

Each runtime adapter should be representable as plain data with:

- `id`
- `displayName`
- `guidance`
- `events`
- `capabilities`

The initial reference implementation lives in:

- `core/contracts/runtime.js`
- `core/contracts/events.js`
- `core/contracts/capabilities.js`
- `core/contracts/project-spec.js`
- `core/contracts/skill-manifest.js`
- `core/contracts/agent-role.js`

## Normalized Event Vocabulary

Citadel should reason in canonical event IDs, regardless of runtime source:

- `session_start`
- `pre_tool`
- `post_tool`
- `post_tool_failure`
- `user_prompt`
- `stop`
- `stop_failure`
- `session_end`
- `pre_compact`
- `post_compact`
- `subagent_stop`
- `task_created`
- `task_completed`
- `worktree_create`
- `worktree_remove`

The Codex adapter is responsible for mapping native runtime events into this
shared vocabulary and declaring unsupported events explicitly.

## Capability Model

Each runtime should declare support levels for at least:

- `guidance`
- `skills`
- `agents`
- `hooks`
- `workspace`
- `worktrees`
- `approvals`
- `history`
- `telemetry`
- `mcp`
- `surfaces`

Support levels:

- `full`
- `partial`
- `none`

## Design Rule

If a behavior is runtime-specific, it belongs in `runtimes/`.

If a behavior is fundamental to Citadel itself, it belongs in `core/`.

If a behavior is only about how users invoke Citadel, it belongs in `surfaces/`.
