# Contributing to Citadel

Contributions are welcome. Issues, bug reports, new skills, and hook improvements all help.

## Reporting Issues

Open an issue on [GitHub](https://github.com/SethGammon/Citadel/issues). Include:

- What you expected to happen
- What actually happened
- Error messages (full text, not screenshots of text)
- Your OS, shell, and Node version

## Submitting Pull Requests

1. Fork the repo
2. Create a branch from `main` (e.g., `fix/issue-10-description` or `feat/new-skill`)
3. Make your changes
4. Run `node hooks_src/smoke-test.js` to verify hooks are healthy
5. Open a PR against `main`

**Branch protection is enabled.** All changes go through a PR. Direct pushes to main are blocked.

### What to watch out for

**Cross-platform compatibility.** Citadel runs on Windows, macOS, and Linux. Before submitting:

- Hook definitions live in `hooks/hooks-template.json` and are installed per-project via `scripts/install-hooks.js`
- The Claude installer is compatibility-aware by default; use `--hook-profile latest` in tests or fixtures when you need the full modern hook surface deterministically
- Do NOT hardcode `/bin/bash`, `/bin/sh`, or other Unix-only paths
- Do NOT assume forward-slash path separators in Node scripts (use `path.join()`)
- Test on your platform and note which platform you tested on in the PR

**Codex-first architecture.** Citadel projects runtime artefacts into each project. The canonical implementation lives in this repo; generated guidance, hooks, and state live in the target workspace.

- Hook scripts live in `hooks_src/` and are projected per-project via `scripts/install-hooks.js`
- The `init-project` SessionStart hook auto-scaffolds per-project state (`.planning/`, `.citadel/scripts/`)
- Per-project configuration lives in `.codex/config.toml` with `.claude/harness.json` retained only as a legacy fallback

## Adding a New Skill

Skills live in `skills/{name}/SKILL.md` (one directory per skill). Every skill needs:

```yaml
---
name: skill-name
description: >-
  One or two sentences explaining what the skill does.
user-invocable: true
auto-trigger: false
---
```

Follow the patterns in existing skills. Read 2-3 before writing your own.

Users can also create project-level custom skills in their project's projected skill directory under `.agents/skills/`.

## Adding a New Hook

Hooks live in `hooks_src/`. Before adding one:

1. Read `harness-health-util.js` for shared utilities (telemetry, config, validation)
2. Use `execFileSync` (not `execSync`) to avoid shell injection
3. Use `require('./harness-health-util')` for the project root path
4. Use `process.env.CITADEL_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd()` for the user's project root
5. Add your hook to `hooks/hooks-template.json` — `scripts/install-hooks.js` projects supported Codex events into `.codex/hooks.json`
6. If the hook depends on a Codex lifecycle limitation or degraded mapping, update `runtimes/codex/generators/install-hooks.js`
7. Run `node hooks_src/smoke-test.js` to make sure the smoke test picks it up

## Repository Structure

```
citadel/
  skills/               # Built-in skill definitions ({name}.md per skill)
  agents/               # Sub-agent definitions
  hooks/
    hooks-template.json # Canonical hook definitions
  hooks_src/            # Hook script implementations
  scripts/              # Utility scripts (synced to projects by init-project)
  .planning/
    _templates/         # Templates (copied to projects by init-project)
  docs/                 # Reference documentation
```

## Opt-in Hooks

Some hooks are not included in the default `hooks/hooks-template.json`. They are available in `hooks_src/` for users who want them:

- **`external-action-gate.js`** — Blocks git push, PR creation, issue comments, and other external actions until the user approves. Add it to your project's `.codex/hooks.json` if you want it enabled outside the generated default set:
  ```json
  {
    "hooks": {
      "PreToolUse": [{
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node '${CLAUDE_PLUGIN_ROOT}/hooks_src/external-action-gate.js'", "timeout": 5 }]
      }]
    }
  }
  ```

- **`issue-monitor.js`** — Checks for new GitHub issues on session start. Add it to `.codex/hooks.json` if you want it enabled:
  ```json
  {
    "hooks": {
      "SessionStart": [{
        "hooks": [{ "type": "command", "command": "node '${CLAUDE_PLUGIN_ROOT}/hooks_src/issue-monitor.js'", "timeout": 20 }]
      }]
    }
  }
  ```

> Legacy note: older projects may still contain `.claude/hooks/` or `.claude/harness.json`. Treat those as migration artefacts, not the current runtime surface.

## Code Style

- Node.js scripts use CommonJS (`require`), not ESM
- Keep hooks fast (under 5s for PreToolUse, under 30s for PostToolUse)
- Fail-closed for security hooks (exit 2 on error), fail-open for non-critical hooks (exit 0 on error)
- No external dependencies. Hooks use only Node built-ins.
