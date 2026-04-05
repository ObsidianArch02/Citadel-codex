# Citadel 面向 Codex 原生兼容性的需求说明

更新时间：2026-04-05

## 目标

将 `SethGammon/Citadel` 从「带有 Codex 适配层、但仍以 Claude Code 为主入口的系统」调整为「可被视为 Codex 原生一等公民」的项目。

这里的「Codex 原生」至少应满足以下条件：

- Codex 用户不需要依赖 Claude Code 的插件安装模型来理解或使用 Citadel。
- Codex 项目接入存在明确、闭环、可重复的安装流程。
- Codex 运行时不再把 `.claude/harness.json` 作为核心配置依赖。
- Codex 侧有完整且一致的配置、guidance、skills、agents、hooks 投影逻辑。
- 文档、代码、测试、安装方式三者一致。

## 当前状态判断

当前仓库已经实现了明显的 Codex compatibility layer，但尚未完成 Codex productisation。

已经存在的内容：

- `runtimes/codex/` 运行时定义
- Codex hook translator
- Codex skill projection
- Codex agent projection
- Codex guidance projection 到 `AGENTS.md`

未完成的关键问题：

- 仓库分发与安装入口仍然是 Claude 插件
- Codex setup 流程没有闭环
- `harness.json` 的运行配置语义没有真正迁走
- 文档声称的部分 Codex artefact 尚无实现，例如 `.codex/config.toml`

## 已确认的问题清单

### 1. 分发形态仍然是 Claude 插件，不是 Codex 原生插件或 Codex 原生 skill 包

现状：

- 仓库里存在 `.claude-plugin/plugin.json` 与 `.claude-plugin/marketplace.json`
- 仓库中不存在 `.codex-plugin/plugin.json`
- `QUICKSTART.md` 与 `docs/migrating.md` 的安装说明仍然是 Claude Code 的 `/plugin marketplace add`、`/plugin install`

要求：

- 必须定义并实现一套 Codex-first 的分发形态。
- 必须明确该项目究竟要走哪条路径：
  - 作为 Codex plugin 分发
  - 作为可投影到项目目录的 Codex project harness 分发
  - 或将两者同时支持，但需文档明确区分
- 不允许继续只有 Claude 安装文档、再让用户手动拼 Codex 投影脚本。

验收标准：

- 仓库根目录存在清晰的 Codex 分发入口。
- `README.md` 与 `QUICKSTART.md` 中存在完整的 Codex 安装章节。
- 新用户仅通过 Codex 文档即可完成接入，不需要阅读 Claude 文档推断。

### 2. Codex 接入目前只是多段投影脚本，不是闭环 setup

现状：

- 当前 Codex 接入依赖至少四段分散逻辑：
  - `scripts/bootstrap-project-guidance.js`
  - `scripts/generate-skill-projections.js`
  - `scripts/generate-agent-projections.js`
  - `scripts/install-hooks-codex.js`
- 没有一个 Codex 专用 setup 把这些步骤串起来

要求：

- 必须提供单一 Codex setup 入口。
- setup 必须支持：
  - 初始化项目 canonical spec
  - 生成或更新 `AGENTS.md`
  - 投影 skills
  - 投影 agents
  - 安装 hooks
  - 输出接入摘要和后续校验信息
- setup 必须支持 dry-run 或至少提供 planned changes 输出。

验收标准：

- 一个命令即可完成 Codex 项目接入。
- 该命令具备幂等性。
- 重复执行不会无提示地破坏用户已有配置。

### 3. `skills/setup/SKILL.md` 仍然是 Claude 导向，未迁为 Codex-first

现状：

- `setup` skill 仍围绕 `.claude/harness.json`、`.claude/settings.json`、`/do setup`
- 其逻辑描述的是 Claude 插件初始化，而不是 Codex 项目初始化

要求：

- 必须重写 `setup` skill，使其支持 Codex-first 路径。
- Claude 与 Codex 的 setup 如需共存，必须显式区分 runtime 分支。
- Codex 分支不得再要求用户理解 `.claude/settings.json` 之类 Claude 专属 artefact。

验收标准：

- `setup` skill 明确区分 `claude-code` 与 `codex` runtime。
- 在 Codex runtime 下，setup 输出和写入目标全部与 Codex artefact 对齐。

### 4. `harness.json` 的 guidance 语义开始迁移，但运行配置语义没有迁移完成

现状：

- `.citadel/project.md` 已作为 canonical project spec 引入
- `AGENTS.md` 已从 canonical project spec 生成
- 但多个运行时逻辑仍直接读取 `PROJECT_ROOT/.claude/harness.json`

已确认直接依赖 `.claude/harness.json` 的典型逻辑包括：

- `hooks_src/harness-health-util.js`
- `hooks_src/post-edit.js`
- `hooks_src/protect-files.js`
- `hooks_src/quality-gate.js`
- `hooks_src/circuit-breaker.js`
- 多个 skill 文档仍显式要求读写 `.claude/harness.json`

要求：

- 必须将 `harness.json` 的运行配置语义迁移到 Codex 可消费的原生配置载体。
- 不允许 Codex runtime 的核心行为继续隐式依赖 `.claude/harness.json`。
- 如果短期内必须兼容旧文件，也必须满足：
  - 新配置为主
  - 旧配置仅作为 backward compatibility fallback
  - 读取顺序与冲突规则有明文定义

验收标准：

- Codex 项目在没有 `.claude/harness.json` 的情况下仍可完整运行。
- 所有 Codex hooks、agents、skills 所需配置都可从 Codex-native artefact 读取。
- `.claude/harness.json` 最多只作为迁移兼容层，而不是必需文件。

### 5. 缺少 `harness.json` 到 Codex-native config 的字段级映射

现状：

- `runtime-contract.md` 声称会生成 `.codex/config.toml`
- 代码中未找到对应生成器与明确消费链路
- 现有 `.citadel/project.md` 只承载很窄的 guidance 信息，无法覆盖 `harness.json` 的运行配置字段

需要迁移或重新设计的关键字段至少包括：

- `language`
- `framework`
- `packageManager`
- `typecheck.command`
- `typecheck.perFile`
- `test.command`
- `test.framework`
- `qualityRules`
- `protectedFiles`
- `features`
- `registeredSkills`
- `registeredSkillCount`
- `agentTimeouts`
- `dependencyPatterns`
- `policy`
- `verification`
- `docs`
- `trust`
- `preCompact`

要求：

- 必须定义 Codex-native 配置 schema。
- 必须明确哪些字段属于：
  - canonical project spec
  - runtime config
  - generated artefacts
  - telemetry 或 mutable state
- 必须提供 `harness.json -> new config` 的迁移策略。

验收标准：

- 存在 schema 文档与示例。
- 存在生成器、读取器、迁移器。
- Codex runtime 中不再出现零散的手写 `path.join(PROJECT_ROOT, '.claude', 'harness.json')` 读取逻辑。

### 6. Codex hook translation 是部分成功，不是完整 parity

现状：

- `runtimes/codex/generators/install-hooks.js` 明确将多个 Citadel event 映射为 `null`
- 仓库自己承认 Codex runtime 有 `reduced-hook-lifecycle` 与 `adapter-required-for-hook-parity`
- Codex hook 运行依赖 `hooks_src/codex-adapter.js` 做 envelope 和 legacy payload 转换

这意味着：

- 现有 Codex hook 体系本质上是兼容壳，而不是原生设计
- 部分 Claude 生命周期事件在 Codex 下没有等价实现

要求：

- 必须明确区分三类能力：
  - Codex fully supported
  - Codex degraded
  - Codex unsupported
- 对 degraded event 必须给出替代设计，而不是仅仅跳过。
- 对 unsupported event 必须在 setup 与文档中可见提示。

验收标准：

- 每个 Citadel hook 都有 Codex 状态标注。
- setup 输出会列出被降级或被跳过的行为。
- 对关键缺失事件存在替代实现或明确放弃说明。

### 7. Skill projection 可用，但覆盖语义粗糙，缺少 lifecycle 管理

现状：

- skill projection 将 canonical `SKILL.md` 复制到项目的 `.agents/skills/<name>/SKILL.md`
- 同时生成 `.agents/skills/<name>/agents/openai.yaml`
- 当前行为是直接覆盖同名投影文件
- 未发现对已删除 skill 的 prune 逻辑

要求：

- 必须定义 project-projected skill 的生命周期。
- 必须明确：
  - 哪些文件是 generated
  - 哪些可由用户手工修改
  - 重新投影时哪些会覆盖
  - 如何移除源仓库已删除的 skill
- 建议引入 generated marker 或 manifest，便于安全更新与 prune。

验收标准：

- skill projection 支持 update、detect drift、optional prune。
- 用户可区分 generated artefact 与 hand-authored artefact。

### 8. Agent projection 可用，但存在截断和模型映射的粗糙实现

现状：

- agent projection 会将 canonical agent 转成 `.codex/agents/*.toml`
- 指令体超过 4000 字符会被直接截断
- 模型映射为硬编码：
  - `opus -> gpt-5.4`
  - `sonnet -> gpt-5.4-mini`
  - `haiku -> gpt-5.4-mini`

要求：

- 必须重新评估 agent projection 的 fidelity。
- 不应默认静默截断 agent instructions。
- 模型映射必须可配置，而不是写死。
- 如有必要，应支持：
  - include by reference
  - split instructions
  - richer projection metadata

验收标准：

- 不再存在无提示的 4000 字符截断。
- agent projection 对模型映射有显式策略与配置入口。
- 复杂 agent 在 Codex 下仍可保持可接受的行为一致性。

### 9. `AGENTS.md` 目前承载的语义太窄，无法替代完整 project config

现状：

- `renderCodexGuidance` 只渲染：
  - project name
  - project summary
  - conventions
  - workflows
  - constraints
  - handoff summary

缺失的信息包括但不限于：

- typecheck policy
- test command
- protected files
- quality rules
- dependency anti-pattern guidance
- runtime-specific behavioural policies

要求：

- 必须明确 `AGENTS.md` 的职责边界。
- 若 `AGENTS.md` 仅做 guidance，则必须引入独立的 Codex runtime config。
- 若希望 `AGENTS.md` 承载更多语义，则需要扩展 canonical spec 与 renderer，而不是继续把关键配置留在 `.claude/harness.json`。

验收标准：

- Codex guidance 与 Codex runtime config 的职责边界清晰。
- 不再需要让 agent 同时理解 `.citadel/project.md`、`AGENTS.md`、`.claude/harness.json` 三套彼此重叠的配置源。

### 10. 当前 Codex 安装流程仍然要求用户做大量手工推断

现状：

- 要全面接入 Codex 项目，用户需要自己推断并顺序执行多个脚本
- 文档没有把这些步骤组织成正式支持的 Codex workflow

要求：

- 必须提供明确的 Codex installation modes，例如：
  - minimal skill-only
  - standard project harness
  - full project harness with hooks and agents
- 每种模式都要有输入、输出、覆盖风险与回滚说明。

验收标准：

- 文档可以直接回答：
  - 「我只要一个 skill 怎么装」
  - 「我想完整接入项目怎么装」
  - 「升级时哪些文件会被覆盖」

### 11. 测试应从「有适配代码」升级为「有 Codex 用户级可验证行为」

现状：

- 仓库已有 runtime-level 测试与 projection-level 测试
- 但缺少围绕真实 Codex onboarding 的 end-to-end user journey 测试

要求：

- 必须补充 Codex-first e2e tests，至少覆盖：
  - fresh project bootstrap
  - no `.claude/harness.json` path
  - full project projection
  - re-run idempotency
  - upgrade over existing projected files
  - hook merge with user-owned hooks
  - guidance overwrite protection

验收标准：

- 存在针对 Codex onboarding 的 test suite
- CI 中可明确看到 Codex compatibility pass 或 fail

## 推荐的重构方向

### Phase 1：先建立 Codex 真实配置面

必须先做：

- 设计并落地 `.codex/config.toml` 或等价配置文件
- 建立 `harness.json -> Codex config` 迁移器
- 改造所有 Codex hooks 与 Codex runtime consumers，优先读新配置

不建议跳过这一步直接修文档，因为那只是掩盖问题。

### Phase 2：完成 Codex setup 闭环

在配置面成立之后，再提供：

- 单命令 Codex setup
- 可选的 dry-run
- update 与 reapply
- setup summary

### Phase 3：再处理分发与文档

最后再统一：

- `README.md`
- `QUICKSTART.md`
- migration docs
- package layout
- optional Codex plugin manifest

## 非目标

以下事项不应被误认为本轮兼容性工作的核心目标：

- 让 Claude 版逻辑彻底消失
- 追求 Claude 与 Codex 完全相同的 lifecycle parity
- 在没有配置迁移的前提下，只靠 `AGENTS.md` 解决运行配置问题

## 建议交付物

另一个 agent 至少应产出以下内容：

1. Codex runtime config schema
2. `harness.json` 迁移方案与迁移脚本
3. Codex-first setup 命令
4. 更新后的 Codex 安装文档
5. 覆盖 compatibility gaps 的测试
6. 对现有 projection 逻辑的 overwrite、prune、drift 管理方案

## 最低验收条件

当以下条件同时成立时，才可认为「更好地兼容 Codex 原生」基本达标：

- 新建 Codex 项目时，不需要 `.claude/harness.json` 也能跑通完整接入
- setup、hooks、skills、agents、guidance 的写入逻辑都有明确的 Codex 路径
- 文档不再让 Codex 用户借道 Claude 安装流程
- 兼容层不再只是 adapter shell，而是有稳定配置面与用户级安装体验

## 参考证据

- `README.md`
  - https://github.com/SethGammon/Citadel/blob/main/README.md
- `QUICKSTART.md`
  - https://github.com/SethGammon/Citadel/blob/main/QUICKSTART.md
- `docs/migrating.md`
  - https://github.com/SethGammon/Citadel/blob/main/docs/migrating.md
- `docs/architecture/runtime-contract.md`
  - https://github.com/SethGammon/Citadel/blob/main/docs/architecture/runtime-contract.md
- `runtimes/codex/runtime.js`
  - https://github.com/SethGammon/Citadel/blob/main/runtimes/codex/runtime.js
- `scripts/install-hooks-codex.js`
  - https://github.com/SethGammon/Citadel/blob/main/scripts/install-hooks-codex.js
- `runtimes/codex/generators/install-hooks.js`
  - https://github.com/SethGammon/Citadel/blob/main/runtimes/codex/generators/install-hooks.js
- `hooks_src/codex-adapter.js`
  - https://github.com/SethGammon/Citadel/blob/main/hooks_src/codex-adapter.js
- `scripts/generate-skill-projections.js`
  - https://github.com/SethGammon/Citadel/blob/main/scripts/generate-skill-projections.js
- `runtimes/codex/generators/project-skills.js`
  - https://github.com/SethGammon/Citadel/blob/main/runtimes/codex/generators/project-skills.js
- `core/skills/project-skill.js`
  - https://github.com/SethGammon/Citadel/blob/main/core/skills/project-skill.js
- `scripts/generate-agent-projections.js`
  - https://github.com/SethGammon/Citadel/blob/main/scripts/generate-agent-projections.js
- `runtimes/codex/generators/project-agents.js`
  - https://github.com/SethGammon/Citadel/blob/main/runtimes/codex/generators/project-agents.js
- `core/agents/project-agent.js`
  - https://github.com/SethGammon/Citadel/blob/main/core/agents/project-agent.js
- `skills/setup/SKILL.md`
  - https://github.com/SethGammon/Citadel/blob/main/skills/setup/SKILL.md
- `core/project/bootstrap-project-guidance.js`
  - https://github.com/SethGammon/Citadel/blob/main/core/project/bootstrap-project-guidance.js
- `core/project/load-project-spec.js`
  - https://github.com/SethGammon/Citadel/blob/main/core/project/load-project-spec.js
- `core/project/render-codex-guidance.js`
  - https://github.com/SethGammon/Citadel/blob/main/core/project/render-codex-guidance.js
- `hooks_src/harness-health-util.js`
  - https://github.com/SethGammon/Citadel/blob/main/hooks_src/harness-health-util.js
- `hooks_src/post-edit.js`
  - https://github.com/SethGammon/Citadel/blob/main/hooks_src/post-edit.js
- `hooks_src/protect-files.js`
  - https://github.com/SethGammon/Citadel/blob/main/hooks_src/protect-files.js
- `hooks_src/quality-gate.js`
  - https://github.com/SethGammon/Citadel/blob/main/hooks_src/quality-gate.js
- `hooks_src/circuit-breaker.js`
  - https://github.com/SethGammon/Citadel/blob/main/hooks_src/circuit-breaker.js
