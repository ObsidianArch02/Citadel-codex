# Citadel Codex Native Compatibility Requirements By Step

更新时间：2026-04-05

## 目的

把 [`requirements.md`](/Users/sukhoina/Downloads/Citadel-codex/requirements.md) 重组为可直接分派给不同 agents 的工作分解文档。这里不重复原需求的论证，重点是：

- 先做什么，后做什么
- 哪些步骤必须串行
- 哪些步骤可以并行
- 每个步骤的输入、输出、主改动面、验收条件是什么

## 执行原则

- **先建立 Codex-native 配置面，再改 setup、projection、文档。**
- **不把 `AGENTS.md` 当成 runtime config 的替代品。**
- **不接受「文档先补齐，底层仍靠 `.claude/harness.json` 偷跑」这种伪完成。**
- **每个 step 都必须有可验证产物，不接受只有方向没有落地。**

## 推荐拆分方式

建议按三波推进，而不是把 11 个问题平均切给 11 个 agents。

### Wave 1：先解架构和配置面

1. Step 1：定义 Codex-native config schema 与 artefact 边界
2. Step 2：实现 config loader、migrator、reader contract

### Wave 2：在新配置面上改运行时与投影

3. Step 3：迁移 Codex runtime consumers，去掉对 `.claude/harness.json` 的核心依赖
4. Step 4：实现单入口 Codex setup
5. Step 5：重写 `setup` skill 为 runtime-aware
6. Step 6：补 Codex hook support matrix、degraded strategy、setup 可见性
7. Step 7：补 skill projection lifecycle
8. Step 8：修 agent projection fidelity 与 model mapping
9. Step 9：明确 `AGENTS.md` 职责边界并对齐 renderer

### Wave 3：最后收口分发、文档、测试

10. Step 10：整理 Codex-first distribution 与安装文档
11. Step 11：补 Codex-first e2e tests 与 CI gate

## 并行规则

- **Step 1、Step 2 必须优先完成。** 这是后续所有工作共同依赖的地基。
- **Step 3、Step 4、Step 6、Step 7、Step 8、Step 9 可以并行。** 但都依赖 Step 1、Step 2 输出的 schema、读取规则和迁移策略。
- **Step 5 依赖 Step 4。** 因为 `setup` skill 必须对应真实可执行的 Codex setup。
- **Step 10 依赖 Step 4、Step 6、Step 7、Step 8、Step 9 的最终 behaviour。**
- **Step 11 最后收口。** 否则测试会一边写一边被前面步骤打掉。

## Step List

---

## Step 1：定义 Codex-native config schema 与 artefact 边界

**目标**

建立 Codex runtime 的正式配置面，明确哪些信息属于 canonical spec，哪些属于 runtime config，哪些属于 generated artefacts，哪些属于 mutable state。

**为什么它必须最先做**

如果这一步不先定，后面的 setup、hooks、skills、agents、docs 都会继续围绕 `.claude/harness.json` 各自发明语义。

**输入**

- [`requirements.md`](/Users/sukhoina/Downloads/Citadel-codex/requirements.md)
- [`docs/architecture/runtime-contract.md`](/Users/sukhoina/Downloads/Citadel-codex/docs/architecture/runtime-contract.md)
- 现有 `.claude/harness.json` 语义使用点

**输出**

- 一份正式的 Codex-native config schema 文档
- 至少一个配置样例，例如 `.codex/config.toml`
- artefact responsibility matrix
- conflict resolution 规则

**主改动面**

- [`docs/architecture/runtime-contract.md`](/Users/sukhoina/Downloads/Citadel-codex/docs/architecture/runtime-contract.md)
- 新增 schema 文档，建议放在 `docs/architecture/` 或 `docs/config/`
- 可能新增 config fixture

**关键决策必须写清**

- `.citadel/project.md` 承载什么
- `AGENTS.md` 承载什么
- `.codex/config.toml` 承载什么
- `.codex/hooks.json`、`.codex/agents/*.toml`、`.agents/skills/*` 各自是 generated 还是 user-owned
- `.claude/harness.json` 在 Codex runtime 下是否只做 fallback

**验收**

- schema 覆盖 `requirements.md` 列出的关键字段
- 字段归属明确，没有重复来源
- 明确写出读取优先级与冲突规则
- 能回答「没有 `.claude/harness.json` 时，Codex 运行时从哪里读配置」

**推荐 agent 类型**

- architecture agent

**可直接给 agent 的 brief**

「定义 Citadel 的 Codex-native config schema、artefact boundary 和 precedence rules，目标是让 Codex runtime 不再把 `.claude/harness.json` 当作主配置源。」

---

## Step 2：实现 config loader、migrator、reader contract

**目标**

把 Step 1 的 schema 变成真实可消费的代码，不停留在文档层。

**输入**

- Step 1 的 schema 和 precedence rules
- 所有 `harness.json` 直接读取点

**输出**

- Codex config loader
- `harness.json -> Codex config` migrator
- shared reader API，供 hooks、runtime、setup、projection 调用
- backward compatibility 规则实现

**主改动面**

- `core/config/` 或等价新目录
- `scripts/` 下新增迁移与验证脚本
- 现有 runtime consumer 的公共读取入口

**必须覆盖的能力**

- 读取 `.codex/config.toml`
- 兼容旧 `.claude/harness.json`
- 明确 fallback 和 warning 行为
- dry-run 或 migration preview

**验收**

- 存在生成器、读取器、迁移器
- 所有新 consumer 不再手写 `path.join(PROJECT_ROOT, '.claude', 'harness.json')`
- 没有 `.claude/harness.json` 时也能读取完整 Codex config

**推荐 agent 类型**

- core runtime agent

**可直接给 agent 的 brief**

「实现 Codex config loader 与 harness migration pipeline，要求后续所有 Codex consumer 通过统一 reader 取配置，而不是各自直读 `.claude/harness.json`。」

---

## Step 3：迁移 Codex runtime consumers，去掉对 `.claude/harness.json` 的核心依赖

**目标**

把现有 hooks 和 runtime 逻辑真正迁到新配置面上。

**输入**

- Step 2 的 loader 与 reader contract

**输出**

- Codex runtime consumers 全部改为读新 config
- legacy fallback 只保留在 shared reader 层
- 运行时不再散落硬编码路径

**重点文件**

- [`hooks_src/harness-health-util.js`](/Users/sukhoina/Downloads/Citadel-codex/hooks_src/harness-health-util.js)
- [`hooks_src/post-edit.js`](/Users/sukhoina/Downloads/Citadel-codex/hooks_src/post-edit.js)
- [`hooks_src/protect-files.js`](/Users/sukhoina/Downloads/Citadel-codex/hooks_src/protect-files.js)
- [`hooks_src/quality-gate.js`](/Users/sukhoina/Downloads/Citadel-codex/hooks_src/quality-gate.js)
- [`hooks_src/circuit-breaker.js`](/Users/sukhoina/Downloads/Citadel-codex/hooks_src/circuit-breaker.js)
- 其他读取 `harness.json` 的 hooks

**实现要求**

- Codex runtime 主路径优先读 `.codex/config.toml`
- 旧配置只作为 fallback
- fallback 命中时要有明文说明，避免隐式依赖

**验收**

- Codex 项目删除 `.claude/harness.json` 后仍可运行核心 hooks
- `rg "harness\\.json" hooks_src runtimes core scripts` 的结果只剩迁移层、测试或明确兼容逻辑
- 关键 hooks 行为不回退

**推荐 agent 类型**

- hooks and runtime migration agent

**可直接给 agent 的 brief**

「把 Codex runtime 的所有核心 consumer 迁移到新 config reader 上，目标是 Codex 路径在没有 `.claude/harness.json` 的情况下照常工作。」

---

## Step 4：实现单入口 Codex setup

**目标**

把当前分散的 guidance、skills、agents、hooks 投影流程收敛成一个 Codex-first setup command。

**输入**

- Step 1、Step 2 的 config 定义与读取链路
- 当前分散脚本：
  - `scripts/bootstrap-project-guidance.js`
  - `scripts/generate-skill-projections.js`
  - `scripts/generate-agent-projections.js`
  - `scripts/install-hooks-codex.js`

**输出**

- 单一 Codex setup 入口
- dry-run 或 planned changes 输出
- idempotent re-run
- setup summary

**主改动面**

- `scripts/` 新 setup 脚本
- 可能新增 `surfaces/` 或统一 CLI 入口
- setup summary formatter

**必须支持的 installation modes**

- minimal skill-only
- standard project harness
- full project harness with hooks and agents

**验收**

- 一个命令完成 Codex 项目接入
- 重跑不破坏用户已有配置
- 能明确告诉用户哪些文件将被写入、覆盖、跳过、保留

**推荐 agent 类型**

- setup and CLI agent

**可直接给 agent 的 brief**

「实现单入口 Codex setup，把 guidance、skills、agents、hooks、config 初始化串成闭环，并提供 dry-run、summary、idempotent reapply。」

---

## Step 5：重写 `setup` skill 为 runtime-aware

**目标**

让 `skills/setup/SKILL.md` 不再默认把用户引到 Claude artefacts，而是根据 runtime 分支输出对应 setup 逻辑。

**输入**

- Step 4 的真实 setup command
- Step 1 的 artefact responsibility 定义

**输出**

- runtime-aware 的 `setup` skill
- `claude-code` 与 `codex` 分支清晰分离
- Codex 分支只描述 Codex artefacts 和命令

**主改动面**

- [`skills/setup/SKILL.md`](/Users/sukhoina/Downloads/Citadel-codex/skills/setup/SKILL.md)
- 可能需要更新与 skill 文档相关的测试

**必须修掉的现状**

- 不再要求先读 `.claude/harness.json`
- 不再把 `.claude/settings.json` 作为 Codex setup 的中心
- 不再让 Codex 用户通过 Claude `/do setup` 心智模型拼装流程

**验收**

- `setup` skill 明确区分 runtime
- Codex 分支中的读写目标全部对齐 `.codex/*`、`AGENTS.md`、`.citadel/project.md`
- 技术路径与 Step 4 的 setup command 一致

**推荐 agent 类型**

- skills and UX copy agent

**可直接给 agent 的 brief**

「重写 `skills/setup/SKILL.md`，让它对 `claude-code` 和 `codex` runtime 显式分支，且 Codex 分支只引用 Codex artefacts 与真实 setup command。」

---

## Step 6：补 Codex hook support matrix、degraded strategy、setup 可见性

**目标**

把目前「部分事件映射为 null」的现状显式化，并给 degraded path 一个可被用户理解的替代设计。

**输入**

- 当前 hook translation
- Step 4 setup summary 输出机制

**输出**

- hook capability matrix
- fully supported、degraded、unsupported 三分类
- degraded event 的替代方案
- setup 与文档中的可见提示

**主改动面**

- [`runtimes/codex/generators/install-hooks.js`](/Users/sukhoina/Downloads/Citadel-codex/runtimes/codex/generators/install-hooks.js)
- [`hooks_src/codex-adapter.js`](/Users/sukhoina/Downloads/Citadel-codex/hooks_src/codex-adapter.js)
- setup summary 输出
- 文档中的 capability table

**必须回答的问题**

- 哪些事件是 Codex fully supported
- 哪些只是 degraded
- degraded 情况下用户实际失去什么
- 是否存在替代 hook、轮询、summary、manual verification 等补偿设计

**验收**

- 每个 Citadel hook 都有 Codex 状态标注
- setup 输出会列出 skipped、degraded、unsupported 行为
- 关键缺失事件不是静默跳过

**推荐 agent 类型**

- hooks capability agent

**可直接给 agent 的 brief**

「梳理 Codex hook parity，给每个 hook 标 fully supported、degraded、unsupported，并把 degraded 或 skipped 状态显式暴露到 setup summary 和文档中。」

---

## Step 7：补 skill projection lifecycle

**目标**

让 skill projection 从「复制文件」升级为「有生命周期管理的 generated artefact」。

**输入**

- 现有 skill projection 逻辑
- Step 4 setup/reapply 入口

**输出**

- generated marker 或 manifest
- overwrite policy
- drift detection
- optional prune

**主改动面**

- [`scripts/generate-skill-projections.js`](/Users/sukhoina/Downloads/Citadel-codex/scripts/generate-skill-projections.js)
- [`runtimes/codex/generators/project-skills.js`](/Users/sukhoina/Downloads/Citadel-codex/runtimes/codex/generators/project-skills.js)
- [`core/skills/project-skill.js`](/Users/sukhoina/Downloads/Citadel-codex/core/skills/project-skill.js)

**必须定义**

- 哪些文件是 generated
- 哪些文件允许用户手工编辑
- 重新投影时什么会覆盖
- 源 skill 删除后怎样 prune

**验收**

- 支持 update、detect drift、optional prune
- 用户可以区分 generated artefact 与 hand-authored artefact
- 重投影行为可预测，不是盲覆盖

**推荐 agent 类型**

- projection lifecycle agent

**可直接给 agent 的 brief**

「为 Codex skill projection 增加 manifest、drift detection 和 optional prune，目标是把 project-projected skills 变成可维护 artefacts，而不是不可追踪的复制品。」

---

## Step 8：修 agent projection fidelity 与 model mapping

**目标**

解决 agent projection 的静默截断和硬编码模型映射问题。

**输入**

- 现有 agent projection 实现
- Step 1 中对 generated artefacts 的边界定义

**输出**

- 显式的 projection fidelity 策略
- 可配置的 model mapping
- instructions 超长时的安全处理方案

**主改动面**

- [`scripts/generate-agent-projections.js`](/Users/sukhoina/Downloads/Citadel-codex/scripts/generate-agent-projections.js)
- [`runtimes/codex/generators/project-agents.js`](/Users/sukhoina/Downloads/Citadel-codex/runtimes/codex/generators/project-agents.js)
- [`core/agents/project-agent.js`](/Users/sukhoina/Downloads/Citadel-codex/core/agents/project-agent.js)

**必须解决**

- 不再无提示地 4000 字符截断
- 模型映射不再写死
- projection metadata 能说明 agent 来源、映射策略、降级情况

**可选实现方向**

- include by reference
- split instructions
- richer metadata block
- projection warning output

**验收**

- 复杂 agent 不会被静默截断
- 模型映射有配置入口
- 复杂 agent 在 Codex 下保有可接受行为一致性

**推荐 agent 类型**

- agents projection agent

**可直接给 agent 的 brief**

「修复 Codex agent projection 的 instruction truncation 和 hard-coded model mapping，要求所有降级都有显式 metadata 和配置入口。」

---

## Step 9：明确 `AGENTS.md` 职责边界并对齐 renderer

**目标**

把 `AGENTS.md` 从「语义不完整但又承担过多期待」调整为一个职责清晰的 guidance artefact。

**输入**

- Step 1 的 artefact boundary
- 当前 `renderCodexGuidance` 输出

**输出**

- `AGENTS.md` responsibility 定义
- renderer 对应调整
- 与 `.citadel/project.md`、`.codex/config.toml` 的职责边界说明

**主改动面**

- [`core/project/render-codex-guidance.js`](/Users/sukhoina/Downloads/Citadel-codex/core/project/render-codex-guidance.js)
- [`core/project/bootstrap-project-guidance.js`](/Users/sukhoina/Downloads/Citadel-codex/core/project/bootstrap-project-guidance.js)
- 相关文档

**判断标准**

- 如果 `AGENTS.md` 只做 guidance，就不要继续塞 runtime config
- 如果决定扩展它的语义，就要同步扩 canonical spec 和 renderer，而不是靠隐式约定

**验收**

- 能清楚回答 `AGENTS.md` 负责什么、不负责什么
- Codex 不再同时依赖三套互相重叠的配置源
- guidance 与 runtime config 的边界稳定

**推荐 agent 类型**

- project guidance agent

**可直接给 agent 的 brief**

「重新定义 `AGENTS.md` 在 Codex runtime 中的职责边界，并调整 renderer 与 bootstrap 逻辑，消除它与 `.citadel/project.md`、`.claude/harness.json` 的重叠语义。」

---

## Step 10：整理 Codex-first distribution 与安装文档

**目标**

把用户真正看到的安装入口、模式说明、回滚说明统一到 Codex-first 叙事里。

**输入**

- Step 4 setup
- Step 6 hook capability table
- Step 7、Step 8、Step 9 的最终 behaviour

**输出**

- Codex 分发入口
- README、QUICKSTART、migration docs 的 Codex 安装章节
- installation modes 文档
- 覆盖风险、升级行为、回滚说明

**主改动面**

- [`README.md`](/Users/sukhoina/Downloads/Citadel-codex/README.md)
- [`QUICKSTART.md`](/Users/sukhoina/Downloads/Citadel-codex/QUICKSTART.md)
- [`docs/migrating.md`](/Users/sukhoina/Downloads/Citadel-codex/docs/migrating.md)
- 可能新增 `.codex-plugin/plugin.json` 或其他 Codex 分发 artefact

**必须直接回答用户的问题**

- 「我只要一个 skill 怎么装」
- 「我想完整接入项目怎么装」
- 「升级时哪些文件会被覆盖」
- 「哪些 hook 在 Codex 下是降级的」

**验收**

- 新用户只看 Codex 文档即可接入
- 不需要借道 Claude 安装流程
- distribution 路径明确，不再模糊地让用户自己拼脚本

**推荐 agent 类型**

- packaging and docs agent

**可直接给 agent 的 brief**

「把 Citadel 的安装、升级、分发文档重写成 Codex-first 版本，并让 installation modes、覆盖规则、降级能力和回滚路径都能被用户直接读懂。」

---

## Step 11：补 Codex-first e2e tests 与 CI gate

**目标**

把「看起来有适配代码」升级为「真实用户路径可验证」。

**输入**

- 前 10 步的最终行为

**输出**

- Codex onboarding e2e suite
- CI 中可见的 Codex compatibility gate
- fixture 或 sandbox cases

**至少覆盖的场景**

- fresh project bootstrap
- no `.claude/harness.json` path
- full project projection
- re-run idempotency
- upgrade over existing projected files
- hook merge with user-owned hooks
- guidance overwrite protection

**主改动面**

- `scripts/test-*`
- 可能新增 `integration-test` 场景
- CI workflow

**验收**

- 存在面向真实 Codex onboarding 的测试套件
- CI 中能明确看到 Codex compatibility pass 或 fail
- 任一关键路径回退时不会被现有低层测试掩盖

**推荐 agent 类型**

- test and CI agent

**可直接给 agent 的 brief**

「围绕真实 Codex onboarding 建一套 e2e tests 和 CI gate，重点证明系统在没有 `.claude/harness.json` 的情况下仍能完成完整接入与重复执行。」

## 建议的 agent 分工

如果你想尽量并行，推荐不是按文件切，而是按责任域切：

1. **Agent A：Config architecture**
   负责 Step 1、Step 2

2. **Agent B：Runtime migration**
   负责 Step 3、Step 6

3. **Agent C：Setup surface**
   负责 Step 4、Step 5

4. **Agent D：Projection lifecycle**
   负责 Step 7、Step 8、Step 9

5. **Agent E：Docs and packaging**
   负责 Step 10

6. **Agent F：Verification**
   负责 Step 11

## 最小里程碑

如果你不想一次拆太细，最小可执行里程碑只有四个：

1. **先把 Codex config 定义出来并能读。**
2. **再让 Codex runtime 在没有 `.claude/harness.json` 的情况下跑通。**
3. **再把 setup 收成一个命令。**
4. **最后补文档和 e2e。**

这四步做不完，后面的 projection polish 和 distribution polish 都只是表面优化。

## 不建议的拆法

- 不要先把 README、QUICKSTART 改漂亮，再回头补底层配置迁移。
- 不要把 `AGENTS.md` 扩成万能配置文件，除非你愿意同步重写 canonical spec、renderer 和 consumer。
- 不要把 hooks、skills、agents 三块分别改一半，然后继续让它们各自读自己的配置源。
- 不要让测试 agent 过早开工，否则最后大概率只是重写测试。

## 完成定义

只有当下面四件事同时成立，这份需求才算完成：

- **Codex 项目不依赖 `.claude/harness.json` 也能完整接入。**
- **setup、hooks、skills、agents、guidance 都有清晰的 Codex-native 路径。**
- **用户只看 Codex 文档就能安装、升级、判断覆盖风险。**
- **CI 能验证真实 Codex onboarding，而不是只验证适配器局部逻辑。**
