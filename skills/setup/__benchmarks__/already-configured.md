---
name: already-configured
skill: setup
description: setup detects existing codex setup artefacts and avoids silent overwrite
tags: [fringe]
input: /setup
state: with-campaign
assert-contains:
  - setup-codex
  - skipped
assert-not-contains:
  - ENOENT
  - TypeError
  - SyntaxError
  - undefined
  - Cannot read
---

## What This Tests

A user runs `/setup` on a project that already has a campaign (implying prior setup).
The skill must detect the existing configuration and either confirm the current config
or ask before overwriting, rather than blindly re-running setup.

## Expected Behavior

1. Detects existing Codex configuration (`.codex/config.toml` or `AGENTS.md`)
2. Informs the user that configuration already exists
3. Keeps existing guidance unless overwrite is explicitly requested
4. Does not silently overwrite existing setup
5. No crash or raw error output
