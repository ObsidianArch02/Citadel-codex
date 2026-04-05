# Migrating from Legacy `.claude` Artefacts

> last-updated: 2026-03-28

If you previously ran Citadel in a Claude-first layout, follow these steps to move
the project onto the current Codex-first layout.

## 1. Back up your project config

These files are project-specific and should be kept or migrated:

```
.claude/harness.json          — legacy project config; migrates into `.codex/config.toml`
.planning/                    — campaign state, fleet sessions, telemetry
.claude/settings.local.json   — optional user hook overrides from old installs
```

## 2. Remove obsolete generated artefacts

```bash
# These are no longer the active runtime surface
rm -rf .claude/hooks/
rm -rf .claude/skills/
rm -rf .claude/agents/
rm -f .claude/settings.json
```

Keep `.claude/harness.json` until the migration is complete. Keep `.planning/`.

## 3. Project the Codex runtime artefacts

```bash
git clone https://github.com/SethGammon/Citadel.git
```

From your project root:

```bash
node /path/to/Citadel/scripts/setup-codex.js --mode full
```

This writes `AGENTS.md`, `.codex/config.toml`, `.codex/state.json`, and `.codex/hooks.json`.
Legacy `.claude/harness.json` is read only as a fallback source during migration.

## 4. Start a new Codex session

The `init-project` hook auto-scaffolds `.citadel/scripts/` and verifies your
`.planning/` directory on session start. Open the project in Codex after the setup run.
