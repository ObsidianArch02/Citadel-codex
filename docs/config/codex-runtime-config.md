# Codex Runtime Config

> last-updated: 2026-04-05

This document defines the Codex-native configuration boundary for Citadel.

## Sources Of Truth

| Artefact | Role | Ownership |
| --- | --- | --- |
| `.citadel/project.md` | Canonical project guidance spec | user-owned |
| `.codex/config.toml` | Codex runtime config | user-owned |
| `.codex/state.json` | Mutable Citadel state for Codex | Citadel-managed |
| `AGENTS.md` | Rendered Codex guidance | generated |
| `.codex/hooks.json` | Installed Codex hooks | generated |
| `.codex/agents/*.toml` | Projected Codex agent manifests | generated |
| `.agents/skills/*` | Projected Codex skill artefacts | generated |
| `.claude/harness.json` | Legacy compatibility fallback only | legacy |

## Responsibility Boundary

`.citadel/project.md` is guidance-only. It does not carry runtime policy, hook settings, projection policy, or mutable counters.

`.codex/config.toml` is the canonical runtime config for Codex. It owns:

- language、framework、packageManager
- typecheck and test commands
- verification lenses and quality rules
- protected file patterns
- feature toggles
- agent timeouts
- dependency patterns
- policy configuration
- pre-compact behaviour
- docs sync policy
- organisation manifest
- cost tracking policy
- agent model mapping

`.codex/state.json` owns mutable state that should not live in a hand-authored config file:

- trust counters
- consent preferences
- projected skill registry metadata

## Precedence Rules

1. Load defaults.
2. If `.claude/harness.json` exists, map recognised legacy fields into the runtime config and mutable state as a fallback layer.
3. If `.codex/config.toml` exists, it overrides the runtime fields from the legacy harness.
4. If `.codex/state.json` exists, it overrides the mutable fields from the legacy harness.

This means Codex-native files always win. The legacy harness only backfills missing fields.

## Conflict Rules

- Guidance never overrides runtime config.
- Generated artefacts never become sources of truth.
- If both `.codex/config.toml` and `.claude/harness.json` define the same runtime field, `.codex/config.toml` wins.
- If both `.codex/state.json` and `.claude/harness.json` define the same mutable field, `.codex/state.json` wins.
- Unknown legacy keys are surfaced as migration warnings instead of being silently dropped.

## Example `.codex/config.toml`

```toml
version = 1
language = "typescript"
framework = "nextjs"
packageManager = "pnpm"
protectedFiles = [".codex/config.toml", ".codex/state.json", "src/generated/**"]
dependencyPatterns = ["@/lib/**", "@/components/**"]

[typecheck]
command = "pnpm exec tsc --noEmit"
perFile = true

[test]
command = "pnpm test"
framework = "vitest"

[qualityRules]
builtIn = ["no-confirm-alert", "no-transition-all"]
custom = [{ pattern = "dangerouslySetInnerHTML", message = "require manual review" }]

[agentTimeouts]
command = 300
research = 1200

[policy]
scopeEnforcement = "warn"
auditLog = true
allowedOutOfScopeTools = []

[verification]
hot = ["programmatic", "structural", "performance"]
cold = ["performance", "accessibility", "adversarial", "contractual", "cross-reference"]
disabled = []

[preCompact]
handoffMode = "auto"

[docs]
auto = true
audiences = ["user", "org", "agents"]
exclude = ["docs/archive/**"]

[cost]
enabled = true
mode = "api"
thresholds = [5, 15, 30, 50]
checkIntervalMs = 180000
campaignBudgetAlerts = true
sessionEndSummary = true

[modelMapping]
opus = "gpt-5.4"
sonnet = "gpt-5.4-mini"
haiku = "gpt-5.4-mini"
```

## Migration Path

Use `node scripts/migrate-harness-to-codex-config.js --dry-run` to preview the migration from `.claude/harness.json`.

Use `node scripts/migrate-harness-to-codex-config.js` to write `.codex/config.toml` and `.codex/state.json`.
