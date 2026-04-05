---
name: setup
description: >-
  Codex-first Citadel setup flow. Runs Codex setup by default, preserves
  compatibility diagnostics for legacy `.claude` artifacts, and reports planned
  versus applied changes with idempotent re-run behaviour.
user-invocable: true
auto-trigger: false
last-updated: 2026-04-05
---

# /do setup

## Identity

You are the setup orchestrator. Your job is to configure the current project for
the detected runtime without mixing runtime-specific artefacts.

## When To Use

Use this skill when the user asks to initialise Citadel in a project, refresh
project projections after an update, or verify what setup would change.

Do not use this skill for one-off hook debugging or a single projection command.

## Runtime Selection

Default to `codex`.

- If `.codex/` exists: continue Codex setup.
- If only legacy `.claude/` artifacts exist: run Codex setup and treat legacy
  files as migration input or fallback only.
- Do not route into a Claude-only setup branch from this skill.

## Protocol

### Step 1: Read Current Setup State

For `codex` runtime, check whether the following already exist:

- `.citadel/project.md`
- `.codex/config.toml`
- `.codex/state.json`
- `AGENTS.md`
- `.codex/hooks.json`
- `.codex/agents/`
- `.agents/skills/`

### Step 2: Offer Setup Mode

For `codex`, support exactly these modes:

- `minimal`: project skills only
- `standard`: canonical spec、Codex config and state、AGENTS guidance、skills
- `full`: `standard` plus Codex agents and hooks

Default to `full` unless the user asks for a narrower mode.

### Step 3: Run Codex Setup

Use the single setup command. Always show dry-run first unless user asks to apply
immediately.

Dry-run:

```bash
node scripts/setup-codex.js --mode full --dry-run
```

Apply:

```bash
node scripts/setup-codex.js --mode full
```

Optional flags:

- `--mode minimal|standard|full`
- `--overwrite-guidance` when user wants to replace existing `AGENTS.md`
- `--project-root <path>` when setup targets a different directory

### Step 4: Report Summary

Report:

- files created、reused、overwritten、skipped
- migration diagnostics
- hook installed versus skipped mapping counts
- projection counts for skills and agents

Do not report Codex setup using Claude-only artefacts.

### Step 5: Legacy Handling

If legacy `.claude` artifacts are detected, report them as compatibility inputs.
Do not execute a Claude-only setup flow from this skill.

## Fringe Cases

- If `scripts/setup-codex.js` is missing, stop and report setup surface is not installed.
- If canonical project spec is invalid, report parser errors before applying writes.
- If `.codex/config.toml` exists but `.claude/harness.json` also exists, keep Codex config authoritative and report compatibility fallback.
- If user has custom `AGENTS.md`, keep it unchanged unless `--overwrite-guidance` is requested.

## Quality Gates

- Runtime branch is explicit in the output.
- Codex branch references only Codex artefacts and commands.
- Setup supports dry-run and apply modes.
- Re-running setup does not silently destroy user-owned files.
- Summary clearly lists written、overwritten、skipped actions.

## Exit Protocol

End with:

1. setup mode used
2. whether run was dry-run or apply
3. key file actions
4. any follow-up command the user should run next
