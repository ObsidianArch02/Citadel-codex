---
name: fresh-project
skill: setup
description: setup selects codex runtime and plans full project setup on a clean project
tags: [happy-path]
input: /setup
state: clean
skip-execute: true
assert-contains:
  - setup-codex
  - dry-run
  - full
assert-not-contains:
  - ENOENT
  - TypeError
  - SyntaxError
  - undefined
  - Cannot read
---

## What This Tests

A user runs `/setup` for the first time on a clean project. The skill should
route to the Codex setup surface and show planned changes.

## Expected Behavior

1. Detects runtime and chooses the Codex setup branch
2. Uses `node scripts/setup-codex.js --mode full --dry-run` as the first command
3. References Codex artefacts (`.codex/config.toml`, `.codex/state.json`, `AGENTS.md`)
4. Produces actionable output with mode and apply command
5. No crash or raw error output
