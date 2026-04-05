# Quickstart

From `git clone` to a working Codex-first Citadel workspace.

## TL;DR

```bash
git clone https://github.com/SethGammon/Citadel.git ~/Citadel
cd your-project && node ~/Citadel/scripts/setup-codex.js --mode full
```

Then open the project in Codex:
```
codex
```

Three commands. Clone, project the runtime artefacts, launch Codex.

---

## Prerequisites

- **Codex** -- the runtime Citadel now targets directly
- **[Node.js 18+](https://nodejs.org/)** -- required for hooks and scripts

## 1. Clone and project the Codex artefacts

```bash
git clone https://github.com/SethGammon/Citadel.git ~/Citadel
```

Then from **your project directory** (not the Citadel directory):

```bash
cd ~/your-project
node ~/Citadel/scripts/setup-codex.js --mode full
```

This writes Codex guidance to `AGENTS.md`, config to `.codex/config.toml`, mutable
state to `.codex/state.json`, hook projections to `.codex/hooks.json`, and scaffolds
the `.planning/` directory. It is idempotent and safe to re-run after Citadel updates.

## 2. Launch Codex

```bash
cd ~/your-project
codex
```

## 3. Try it

Then try a command:

```
/do review src/main.ts              # 5-pass code review
/do generate tests for utils        # Tests that actually run
/do why is the login slow           # Root cause analysis
/do refactor the auth module        # Safe multi-file refactoring
```

Or describe what you want in plain English -- the `/do` router picks the right tool:

```
/do fix the login bug
/do what's wrong with the API
/do build a caching layer
```

## 4. Scale up when ready

```
/marshal audit the codebase         # Multi-step, single session
/archon build the payment system    # Multi-session campaign
/fleet overhaul all three services  # Parallel agents, shared discovery
/improve citadel --n=5              # Autonomous quality loops
```

Or let `/do` escalate automatically -- it routes to orchestrators when the task requires it.

Create custom skills to capture patterns you keep repeating:
```
/create-skill
```

---

## Troubleshooting

**Hook not firing / "command not found" errors:**
Hooks require absolute paths. Re-run `node /path/to/Citadel/scripts/install-hooks.js`
from your project directory. This rewrites `.codex/hooks.json` with resolved paths.

**"[protect-files] Blocked" message:**
Citadel prevented an edit to a protected file. The message names the specific file and
the pattern that triggered the block. To allow the edit, remove the pattern from
`protectedFiles` in `.codex/config.toml`.

**"[Circuit Breaker] tool has failed N times" message:**
A tool failed repeatedly. This is Citadel suggesting you try a different approach, not
an error in Citadel itself. The message names the specific tool and shows the last error.
Read the suggestions and switch strategy.

**Campaign file in broken state:**
If a campaign file in `.planning/campaigns/` has corrupted YAML frontmatter or invalid
status, delete the file and restart the campaign. Campaign logs in `.planning/improvement-logs/`
and `.planning/telemetry/` are preserved independently.

**`setup-codex` fails or produces empty config:**
Ensure you are running from your project root, not the Citadel repo directory.
Setup needs to detect your project's language and framework from files like
`package.json`, `tsconfig.json`, or `Cargo.toml`.

**Daemon won't start / "No active campaign" error:**
The daemon attaches to an active campaign. Check `.planning/campaigns/` for a file
with `Status: active`. If none exists, start work first with `/improve`, `/archon`,
or `/fleet`, then attach the daemon.

**Daemon is paused (level-up-pending):**
An improve loop hit distribution saturation and needs human approval for the next
quality level. Review the proposals at `.planning/rubrics/{target}-proposals.md`,
edit the rubric with approved changes, and set the campaign status back to `active`.
The daemon's watchdog will detect the change and resume automatically.

---

## What's Next

- Add your project's conventions to `AGENTS.md` — the more specific, the better
- Run `/do --list` to see all 34 installed skills
- Drop a task in `.planning/intake/` and run `/autopilot` for hands-off execution
- [docs/SKILLS.md](docs/SKILLS.md) — full skills reference
- [docs/CAMPAIGNS.md](docs/CAMPAIGNS.md) — multi-session campaign docs
- [docs/migrating.md](docs/migrating.md) — migrating from copy-based install

---

## What Citadel scaffolds per-project

On first session start, the `init-project` hook creates:

```
your-project/
  .planning/              # Campaign state, fleet sessions, intake, telemetry
    _templates/           # Campaign and fleet templates (copied from plugin)
    campaigns/            # Active + completed campaigns
    fleet/                # Fleet session state + discovery briefs
    coordination/         # Multi-instance scope claims
    intake/               # Work items pending processing
    telemetry/            # Agent run + hook timing logs (JSONL, stays local)
  .citadel/
    scripts/              # Utility scripts synced into the project
    plugin-root.txt       # Pointer to the Citadel checkout that projected this state
  .codex/
    config.toml           # Runtime config
    state.json            # Mutable runtime state
    hooks.json            # Projected Codex hook surface
```

## Telemetry

The harness logs agent events, hook timing, and discovery compression to
`.planning/telemetry/` in JSONL format. Logs never leave your machine.

## Relationship to Superpowers

[Superpowers](https://github.com/obra/superpowers) teaches good methodology —
brainstorm before coding, write tests first, review before shipping. Citadel gives
it the infrastructure to execute that methodology at scale: campaign persistence,
fleet coordination, lifecycle hooks, and telemetry. They are complementary.
