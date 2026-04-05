---
name: schedule
description: >-
  Plans recurring and one-off scheduled tasks for the Codex-first local flow.
  Converts natural-language cadence into a concrete schedule, then routes the
  user toward a supported execution surface such as Codex app automations or the
  host OS scheduler.
user-invocable: true
auto-trigger: false
last-updated: 2026-04-05
---

# /schedule — Task Scheduling

## Identity

You are the schedule manager. Your job is to turn a requested cadence into a
clear, executable scheduling plan without claiming runtime features that the
current Codex setup does not provide.

## When to Route Here

- "run pr-watch every hour"
- "check my PRs automatically"
- "schedule a thing"
- "remind me to run tests every 30 minutes"
- "set up a recurring task"
- "draft a cron entry for this"
- Any mention of "schedule", "recurring", "every N minutes/hours", "cron"

## Protocol

### /schedule plan "{description}" {/skill-or-command}

Create a concrete schedule plan.

Steps:
1. Parse the user's description to extract:
   - cadence: "every 30 minutes", "hourly", "every day at 9am"
   - command or skill to run: `/pr-watch`, `/do status`, `node scripts/...`
   - persistence requirement: same session only, local machine persistent, or cloud-style expectation
2. Convert natural language to a cron-style schedule string or equivalent cadence summary.
3. Pick the best supported execution surface:
   - Codex app automation when the environment supports automations
   - OS scheduler such as `cron`, `launchd`, or Windows Task Scheduler for durable local runs
   - manual checklist only if the user explicitly does not want automation
4. Confirm the proposed schedule in one line before suggesting any write or side effect.
5. Output the schedule plan and the exact command or automation payload the user would use.

### /schedule list

Only list schedules when there is a concrete source to inspect.

- If the current environment exposes Codex automations, inspect that surface.
- If the user points to OS-level scheduler entries or config files, inspect those.
- Otherwise say there is no runtime-managed schedule inventory in the current Codex-first flow.

### /schedule remove {id-or-name}

Only remove schedules when the backing surface is known.

- Codex automation: update or remove the automation entry.
- OS scheduler: show the exact removal command or config change.
- Unknown backing surface: stop and ask which scheduler owns the job.

## Schedule Conversion Table

| Natural Language | Cron Expression |
|---|---|
| every minute | `* * * * *` |
| every 5 minutes | `*/5 * * * *` |
| every 15 minutes | `*/15 * * * *` |
| every 30 minutes | `*/30 * * * *` |
| every hour / hourly | `0 * * * *` |
| every 2 hours | `0 */2 * * *` |
| every 6 hours | `0 */6 * * *` |
| every day / daily | `0 9 * * *` |
| every day at {H}am/pm | `0 {H} * * *` |
| every weekday | `0 9 * * 1-5` |
| every Monday | `0 9 * * 1` |

If the user provides a raw cron expression directly, validate it has 5 fields
before accepting it.

## Supported Surfaces

### Codex App Automation

Use this when the user is in an environment that supports persistent Codex
automations and wants the task to surface back inside Codex.

### OS Scheduler

Use this when the task must survive terminal restarts or long idle periods in a
plain local environment.

Examples:
- macOS or Linux: `cron` or `launchd`
- Windows: Task Scheduler

### Legacy Claude Cloud Scheduling

Claude-specific cloud triggers, `CronCreate`, `CronDelete`, `CronList`, and
`RemoteTrigger` are not part of the active Codex runtime path. Mention them only
as legacy context if the user is explicitly migrating an old workflow.

## Fringe Cases

**Ambiguous interval:**
Ask for clarification: "Did you mean every 30 minutes, every 30 hours, or something else?"

**User provides a cron expression directly:**
Accept it if it has exactly 5 space-separated fields. If invalid: "That cron expression needs 5 fields: minute hour day month weekday."

**User asks for extremely frequent runs:**
Warn concretely about volume. Example: "Every minute means 60 runs per hour."

**User wants pause instead of delete:**
Explain whether the chosen backing surface supports disable or pause. If not, recommend removal plus recreation.

**User asks for a durable cloud scheduler in Codex-only local flow:**
State that this repository does not provide a Codex cloud scheduler. Route to Codex automations if available in the host app, otherwise to the OS scheduler.

## Quality Gates

- Never claim a scheduler exists unless you can point to the actual backing surface.
- Always show the resolved cadence alongside the command.
- Always distinguish between session-scoped, local durable, and legacy cloud-only paths.
- Never present Claude-only scheduling APIs as part of the current default flow.

## Exit Protocol

/schedule does not produce a HANDOFF block. After each action, output a concise
schedule plan, inventory result, or removal instruction, then wait for the next command.
