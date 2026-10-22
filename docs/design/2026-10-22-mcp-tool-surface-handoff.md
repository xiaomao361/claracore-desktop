# MCP 工具目录精简：实施计划与新会话交接

日期：2026-10-22（Asia/Shanghai）
状态：原交接已实施，并随 1.0.3 Lite 安装；实时目录已核对，后续进入用户持续试用。见[收口记录](../validation/2026-10-22-v1.0.3-closeout.md)。下方权限与基线保留为交接时历史。
源会话：`01a15d48-1e45-7622-9da1-8d1f98e136ad`
Shared Line：`line_mviz8d9n_st1sngvx`（MCP 日常工具目录精简与兼容迁移）

## 目标与授权

用户反馈 Claude 认为 MCP 工具过多，要求列出计划并交给新 session 整体处理。
在本 Desktop 仓库完成默认目录精简、兼容处理、文档和非 UI 自动验证。
保留 Memory、Continuity、InnerLife、Knowledge 的完整日常工作流。
默认目录争取约 20～25 个工具，但不为凑数牺牲闭环、清楚的参数或错误语义。

本次交接只新增计划，不实施代码或修改客户端配置。新会话可按计划推进工程，
无需为常规可逆实现选择重复询问。提交推送、版本升级、打包发布、日用应用替换或重启，
不在这次计划交接的执行范围；后续按用户明确安排处理。UI 操作仍由用户负责。

## 已核实基线

- 仓库：`/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`。
- remote：`git@github.com:xiaomao361/claracore-desktop.git`。
- 当前分支：`codex/v0.8.0-local-knowledge`；交接时 HEAD：`3736ae9331fc0f3ecf000b8e33f2074d97b13d55`。
- 本会话对已运行的 1.0.1 Gateway 执行只读 initialize/tools/list：默认 core 38 个，full 97 个。
- 紧凑 JSON `{tools:[...]}` 的 UTF-8 字节数：core 21,260，full 53,697。
  这是 schema 序列化大小，不是 Claude 的 token 计费或模型实际加载量。
- Claude `~/.claude.json` 配置 ClaraCore HTTP 和 Figma；ClaraCore 未指定 full。
  默认服务实测 38，尚未直接取得 Claude 当前会话所有服务的实际加载目录。
- Claude 本地 2026-08-05 项目记录写过“80+”；不能将旧记录当作当前会话实测。
- 目录 profile 当前只控制 tools/list 展示；handler 仍能按工具名调用，不能描述成权限隔离。

| 能力 | full | core |
| --- | ---: | ---: |
| Memory（memoria_*） | 37 | 10 |
| InnerLife | 28 | 7 |
| Shared Line | 15 | 8 |
| Gateway/系统/身份 | 8 | 5 |
| Knowledge | 4 | 4 |
| Memory Controller | 2 | 1 |
| Understanding | 3 | 3 |
| 合计 | 97 | 38 |

## 已有未提交工作必须保留

工作区包含本会话已完成但未提交的 1.0.1 InnerLife 修复、migration 012、候选池治理、
测试、版本和发布验证文档。`CLAUDE.md` 为原有未跟踪文件，保留，不吸收进本次变更。
新会话先重新读取 git status/diff，记录自身修改前基线；不要 reset/clean/stash 全工作区，
不要从 HEAD 重建而漏掉这些未提交改动，也不要将既有修改全部视为自己产生。

此前用户已安装 Lite 1.0.1；实际安装与迁移验证记录见：

- `docs/RELEASE_NOTES_V1.0.1.md`
- `docs/validation/2026-10-21-v1.0.1-lite-package.md`
- `docs/validation/2026-10-21-v1.0.1-installed.md`

本任务不重新清理历史 InnerLife 会话。79 个旧 Codex active 会话此前缺少精确宿主结束证据，
不能借目录优化批量结束。既有候选池每 Agent 最多 10 条、7 天过期及 daemon 语义应保持。
相关长期线 `line_mvhry6tu_faf8oy3i` 仍有效，不因完成 MCP 子目标而归档。

## 实施顺序

### 1. 盘点依赖，形成可审阅分流表

从 canonical definitions 生成全目录，每项注明：默认日常、专项、维护、宿主调用，以及替代/发现路径。
核对 Claude/Codex 实际配置、hook、Agent Guide、复制配置与现有测试；秘密只在进程内使用。
区分服务提供目录、客户端连接配置、客户端实际加载目录；最后一层拿不到就明确标为未验证。
不要为补齐这一层操作 Claude UI，或改变现有用户会话。

关键入口：

- `core/gateway/tool-definitions.js`、`core/gateway/tool-definitions/`
- `core/gateway/tool-profiles.js`、`core/gateway/tools.js`
- `core/gateway/tool-handlers/`、`electron/http-agent-gateway.js`
- `core/gateway/docs.js`、`docs/AGENT_MCP_PLAYBOOK.md`、`docs/MULTI_AGENT_CLIENTS.md`
- `core/tests/context-budget-smoke.js`、`core/tests/agent-setup-contract-smoke.js`
- `core/tests/streamable-http-gateway-smoke.js`、`core/tests/modern-mcp-http-smoke.js`
- `scripts/context-budget-baseline.js`
- Codex 宿主 hook：`/Users/zhouwei/.codex/hooks/claracore-desktop/hook.mjs`；本轮先只读。
  Claude hook 路径要从实际配置确认，不要根据目录名猜测。

### 2. 精简默认展示，保留接口与兼容路径

优先使用现有 profile 机制，避免新增全能 dispatcher 或大量细分 profile。
先形成一份精简 manifest；迁移策略需明确旧 core、full、未传/非法 profile 各返回什么。
可在现有 core 内收敛并提供显式兼容目录，或以一个可选日常 profile 过渡；
根据第一步发现的调用依赖选择最少必要方案，写入实现说明，无需把常规选择交回用户。
不依赖客户端一定支持运行中刷新 tools/list；任何按需路径必须在实际协议/客户端条件下可用。

建议分流方向（不是已确认的逐工具删除清单）：

- 默认保留：检索与完整读取、创建与修正、事实替代、必要关联读写、工作线续接、
  Knowledge 阅读和入库预览/确认、分享判断与反馈、最少必要系统说明。
- 专项：结构化记录、正式交接、跨领域 Understanding；提供明确入口和发现方式。
- 维护：导入导出、合并清理、标签别名、索引重建、身份治理、daemon 控制与深度诊断；
  默认目录移出后继续通过现有维护能力或完整目录访问，不为本任务扩建管理 UI。
- 宿主：会话开始/结束、宿主固定上下文调用。核实 hook 已覆盖才从模型目录移出；
  为无 hook 客户端保留可发现的手工接入方式，避免“一刀切”破坏生命周期。

上下文入口先厘清宿主自动召回、Agent 主动检索、跨领域理解的差异，再收敛默认路径。
`gateway_auto_context` 的 Codex 每用户回合调用契约仍须满足。
移出目录不改变授权边界；不顺便新增权限系统，也不把删除/恢复等操作合成无约束万能写接口。

### 3. 同步客户端契约和文档

同步 setup、连接诊断、配置示例、Agent Guide、静态说明与 profile 名称/默认值。
修复文档中仍写“v0.8.0 分支 35 个”的过时说明，避免仅修一个入口。
日用客户端配置先只读；提供可检查的迁移配置/步骤。源码验证与日用部署分别报告。
宿主调用契约如需改动，先准备可审阅适配和隔离验证，不直接替换个人 hooks。

### 4. 用完整任务闭环验证

使用临时 data/userData 根、测试实例和随机端口；结束后清理验证进程，不干扰 50668 日用服务。
工程涉及默认、fallback 或错误处理时，按 AGENTS 读取并应用失败状态保真检查；
涉及数据语义/转换重构时，读取业务口径一致性检查的对应 trial。

验收至少覆盖：

1. 默认、显式完整、兼容和非法 profile 的 HTTP 返回与诊断一致；完整接口可继续调用。
2. 只使用默认目录能完成查旧事实→读详情→修正/替代→核对结果。
3. 工作线能发现→选择→读取→更新→继续；多线歧义保持显式，不误写其他线。
4. Knowledge 搜索/阅读→预览→提交→回读；冲突、部分写入和重试状态不被抹平。
5. 分享判断→实际投递证据→反馈；读取不等于投递，不因精简自动标 used。
6. 宿主开始/收尾、失败重试及无 hook 接入有完整路径；合成数据验证，不结束真实历史会话。
7. 专项和维护能力有可执行的发现与访问路径；无需偷偷恢复 full 才能完成默认任务。
8. 比较精简前后工具数、schema 字节数、重复入口；保留语义充分性和缺失能力解释。

先运行受影响的现有 contract/HTTP/budget 测试与必要新增回归，再运行 `git diff --check`、
`npm run check`。不要为了数量目标放宽预算或把协议测试改成只断言更少工具。
测试通过后，UI/客户端真实加载/安装运行等尚未发生的层次保持待验，不能宣称生效。

### 5. 交付和后续边界

交付：实际目录分流表、代码和兼容迁移说明、前后量化对比、自动验证结果、明确待验项。
更新本 Shared Line 并读回。代码验证完成后按用户后续指令处理提交、版本、Lite 包和安装验收；
本任务不沿用上一轮的打包/部署指令去自动发布新的 MCP 改版。

## 新会话第一步

读本文件和最近项目 AGENTS；核对真实仓库、分支、dirty diff 后，先完成第 1 步盘点，
随后按小闭环持续实现至工程验证完成。父会话交接后停止代码操作，不与新会话并行编辑。
源会话历史只作按需证据；无需全量重读之前 InnerLife 修复过程。


## 2026-10-22 承接结果

承接会话：`01a161a4-f411-7182-8e6a-fad55ecded6e`。已在原 dirty 工作区完成实现，
未提交/推送，HEAD 仍为 `3736ae9331fc0f3ecf000b8e33f2074d97b13d55`。

- 默认 `core`：25 项，紧凑 `{tools:[...]}` 13,663 字节；相对 38 项/21,260 字节减少 34.2%/35.7%。
- 新增显式 `core-compat`：精确保留旧 core 38 项、顺序、描述与 schema；`full` 仍 97 项/53,697 字节，完整接口保留。
- 真实 Claude/Codex hook 均按名 POST 工具；不需要更换个人 hooks。保留 `gateway_auto_context` 每用户回合契约及无 hook 手工会话开始/结束。
- 专项从 `gateway_docs(section=diagnostics)` 发现，配置 `core-compat`/`full` 后重连获取 schema；不依赖客户端热刷新。
- 启动文案统一为连接测试后 `shared_line_get`，多线歧义显式选 lineId。
- 完整分流表/客户端依据/迁移片段：[实施契约](2026-10-22-mcp-tool-surface.md)。
- 命令、回归结果与待验边界：[工程验证](../validation/2026-10-22-mcp-tool-surface.md)。

原有 1.0.1 InnerLife、migration 012、候选治理、文档和 CLAUDE.md 未丢弃；
未结束真实历史会话，未改变个人配置、版本、日用 app 或 50668 服务。后续仅在用户明确安排后
处理提交/发布/安装及真实客户端目录验收；本次不自动延伸执行。


## 完整能力整合的后续结果

用户随后明确要求整理完整 97 项能力本身，已在上一阶段基础上实施六组整合。
当前 full 为 83 项/50,496 B，默认 core 25 项/13,663 B、core-compat 38 项/21,260 B 不变。
16 个旧名称从现行目录退役为可调用薄适配；81 个旧名称保留，加两个新的对象管理接口。
这不是物理删除全部旧入口，也不意味着 83 已被证明最优。旧名称退出仍受实际客户端迁移证据约束。
逐项 97 项映射、语义差异和退出门槛见 [完整能力整合](2026-10-22-mcp-capability-consolidation.md)，
工程证据见 [后续验证](../validation/2026-10-22-mcp-capability-consolidation.md)。
本次仍未提交/推送、改版本、发布、安装或改动日用 app/个人 hooks；79 旧 active 会话未触碰。
