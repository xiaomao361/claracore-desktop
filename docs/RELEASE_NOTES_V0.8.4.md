# 0.8.4 — 协作回执与有界诊断

2026-10-12。本地工程版本，公开发行仍为 0.8.1；本轮不安装、不重启、不发布 GitHub Release。包含 0.8.3 通用决策配置和本轮协作契约修复。

## 行为变化

- Shared Line 的 rename/archive/restore 回执返回所操作的精确目标线，避免目标非当前线时夹带其他 Agent 的当前上下文。显式归档历史可读，写入仍要求 active；创建、激活和 handoff 等相同模式入口已核对。
- Gateway `innerlife_status(detail=full)` 改为分区分页目录，默认每类 10 条、显式最多 50 条、真实 total/offset/nextRead。`detailRef` 返回完整单条并校验 caller Agent；既有 `innerlife_session_get` 同样补齐校验。UI/领域 full snapshot 保持原接口，超出最终 128 KiB 上限的显式读取仍明确失败。
- `innerlife_sessions` 支持 active/ended/all 过滤；非法页码、状态与混用明细/目录参数明确失败。待分享目录统一默认 10 条、最多 50 条，full 读取也支持 offset；SQL 摘要不加载完整 Inbox 或 shares 正文。读取不结束会话或标记分享。
- `recallReceipt` 传递已知 Memory decisionId 和 feedbackRef，Controller timeout 保持 timeout；外层超时尚未拿到事件时不编造 ID。full-profile `memory_context_feedback` 可记录和分页检查明确反馈，不改 Memory。核对 Agent、客户端、conversation 和候选；delivered/used 只允许成功准备的 canary 内容。相同回执含并发提交去重，未反馈仍为 unknown。
- 日常 core manifest 保持 35 个工具，序列化 18115 字节，不超过原 18122 预算；反馈工具只列于 full profile。没有扩大自动投递。
- 仓库新增 Codex 后台目录生命周期策略与离线准备脚本，只生成可审查的暂存副本。后台目录匹配精确子路径，支持现存路径别名；普通会话及 Stop 保持。未安装或替换个人宿主配置，未结束缺少终止证据的历史 active 会话。

Jev 与 Knowledge 日常自动投递保持关闭，当前 Codex 为 Memory-only；Desktop 1.0 UI 方向仍暂停。配置与用户数据没有本轮迁移或维护回滚。

## 验证与边界

隔离验证已通过 `npm run check`、Gateway/Memory Controller 回归，维护回归覆盖 Node SQLite 与 CLI SQLite 后端、双 Agent 回执隔离、归档历史、真实计数与分页、完整明细、非法参数、读取无状态变化、SQL 摘要、反馈身份/候选/证据边界、并发去重和 timeout。

宿主原 hook 的暂存副本在临时状态目录模拟后台 SessionStart：跳过注册、未调用 MCP、未创建会话状态；原 hook SHA-256 保持 `2b8672d9e3b41867f747b5eb18939966235f3bfda301d747cc3e6b73ab480794`。仓库 fixture 另验证普通 SessionStart 与 Stop；不能据此声称已安装宿主生效。

HCT-2026-09-08-01/02：失败与未知不变成成功；摘要/明细和反馈的语义以明确契约及边界回归核对。检查捕获了 shares 旧默认/预算和 macOS 路径别名漏判并修正；试行标准仍不证明长期可靠性。

真实模型连接、用户窗口交互、宿主实际安装和真实使用效果尚待验证。源码/隔离回归/包验证与这些验收分开。

配置与操作见 [维护契约](DESKTOP_MAINTENANCE.md)、[通用决策模型](DECISION_MODELS.md) 和 [当前交接](HANDOFF_LOCAL_KNOWLEDGE.md)。

## 本地 Lite 包

- macOS Apple Silicon（arm64），未签名、未公证。
- 路径：`/Volumes/E61/claracore/builds/claracore-desktop/dist-lite/ClaraCore-Desktop-0.8.4-lite-arm64.dmg`
- 大小：127620931 bytes。
- SHA-256：`8c7a474f03519c69cfe8cdcb33cf98a2fcbacff47706a32583c05606d1a72785`。
- `npm run test:package:lite`、`hdiutil verify` 通过；包内版本 0.8.4、buildFlavor=lite，377 个源码文件与打包工作区逐字节一致（package.json 按 builder 元数据单独核验）。
- 该包取代撤回归档里的同名 0.8.3 工程测试包；10 月 9 日的原 0.8.3 包保持不变。

本轮工程和文档提交至 `codex/v0.8.0-local-knowledge`，未合并 main、打 tag 或发布 Release。私人本地材料仍留在工作区，不纳入提交。
