# Desktop 协作数据与维护契约

2026-10-12。本文描述 0.8.4 Desktop 源码契约。公开版本仍为 0.8.1；源码、包、已安装应用和宿主行为分别保留证据。本轮不安装、不重启、不发布，当前交接入口见 [本地知识交接](HANDOFF_LOCAL_KNOWLEDGE.md)。

## 共同线回执

创建、激活、重命名、归档和恢复的回执只包含所操作的精确 lineId。归档后可能改变产品当前选择，但回执不附带全局当前线，避免把另一 Agent 的上下文送到调用者。显式 `shared_line_get(lineId)` 可读取归档线及其历史；写入仍要求 active。显式跨 Agent 选线的既有协作能力不在本轮改变。

## InnerLife 状态与明细

- `innerlife_status` 默认仍是无正文的 operational status；doctor 表示服务健康，work 表示待处理数量，二者不能互相代替。
- `detail=full` 或布尔 `true` 返回有界诊断目录，默认每类 10 项。可按 `section=sessions|inbox|digestRuns|shares` 单独读取，`limit` 最大 50、`offset` 支持翻页；`pages` 包含真实 total、hasMore 和 nextRead。
- 目录只保留预览和 detailRef，不重复加载整段 briefing、历史或模型输入。选定 `section` 和 `recordId` 才返回完整单条记录，并核对调用 Agent。单条记录仍受 Gateway 最终安全上限保护，超限必须显式失败。
- `innerlife_sessions(status=active|ended|all)` 支持状态过滤；非法状态明确失败。状态读取不关闭会话、不制造思想、不标记分享已使用。
- 待分享摘要目录默认 10 项、显式最多 50 项。候选阅读和实际分享仍是不同动作。

完整状态过去是多个正文集合的合并，在真实数据下超过 128 KiB Gateway 限制。本轮修改 Agent 契约；Desktop UI 使用的领域 snapshot 保持原有接口。

## 宿主生命周期

仓库维护 `scripts/codex-session-policy.mjs`，只识别 Codex home 下 `memories`、`memories_v2` 及子目录；路径规范化处理 macOS `/var` 与 `/private/var` 等现存路径别名。普通项目名称包含 memory 不会被排除。

`prepare-codex-session-policy.mjs` 只在指定暂存目录生成待审查的 hook 副本和策略副本。它要求已知 SessionStart 布局，对未知或已改造版本明确失败；不修改原 hook 或 settings，不安装。宿主操作方负责审查和安装，Desktop 包不会覆盖个人 `~/.codex` 配置。安装后 SessionStart 后台任务应记录 skipped / background_memory_job / sessionCreated=false，普通会话与 Stop 路径保持原逻辑。本轮仅隔离模拟，正在运行的宿主保持原版。

```sh
node scripts/prepare-codex-session-policy.mjs --hook "$HOME/.codex/hooks/claracore-desktop/hook.mjs" --output /tmp/claracore-hook-review
```

输出目录必须独立于原 hook 目录，已有输出不会覆盖。先审查差异并验证隔离后台 SessionStart；宿主安装需另有明确授权。此规则是启动分流，不推断历史任务结束。

已有 49 个后台 active 会话仍缺宿主结束凭据，保留原状态。处理它们需要精确 sessionId 对应的完成、中断或实际 Stop 记录；不能因时间久、查不到线程、进程消失或没有新消息就标为成功结束。没有新增定时清理或隐式生命周期扫描。

## 检索反馈

`gateway_auto_context.recallReceipt.decisionId` 指向此次 Memory Controller 账本事件；反馈指针仅在确有事件时出现。Controller 的 timeout 保持 timeout，不归入普通空召回。hostDelivery、used 和 outcome 默认仍为 unknown。

维护 full profile 提供 `memory_context_feedback`，日常 core manifest 仍为 35 工具、字节预算不超过原 18122：

- 记录：decisionId、feedbackType、evidenceExcerpt；可附 responseId、memoryIds。支持 delivered、used、ignored、wrong、corrected、outcome_unknown。
- 必须由同一 Agent、同一已识别客户端，以及一致的 conversation（包括无 conversation 的事件） 提交。反馈候选必须属于该事件；delivered/used 只允许已准备的 canary Memory，observe/abstain/timeout/error 不能冒充送达或使用。
- 相同事件、类型、响应、Memory 集合和证据的重复回执去重，含并发提交。delivered 与 used 是不同记录；used 不意味着任务成功。
- 检查：`action=inspect`、decisionId，默认 10 条，显式最多 50 条；支持 offset 和 nextRead。未收到反馈是 unknown，不自动填 used 或 ignored。

反馈是有证据的宿主/Agent 明确操作，不是后台记忆写入或自动打分。建立入口不证明真实使用效果提升；需要后来真实任务的实际使用回执。

## 知识来源与关系维护

Memory 和 Knowledge 的正文、来源与历史各有归属，保留 [产品边界](POSITIONING.md) 和 [投递契约](CONTEXT_DELIVERY.md)。此 Codex 宿主依然 Memory-only，没有启用 Knowledge 自动投递或任何决策模型。

实际发现事实变化时，先查原记录及链接：同一事实修正用 update；确认替代用新事实与 supersede；未决冲突用 contradicts。仅对本次使用确有解释价值的关系补来源与理由，不按链接比例批量连线、不把待分享意见升格为用户立场。收录、检索、投递、使用与结论成立分别保留证据。

## 验证

`npm run check` 纳入 `test:desktop-maintenance`。新回归在临时数据根验证双 Agent 回执隔离、归档历史、分页完整性、单条记录正文保留、读取无会话状态变更、非法过滤、跨 Agent 明细拒绝、反馈身份与证据边界、重复回执和 Controller timeout。原 Gateway、Memory Controller 与共同线回归继续适用。

仓库回归使用最小 hook fixture 和临时目录验证后台 SessionStart 跳过注册、普通 SessionStart 保留注册及 Stop 保持原路径。真实原 hook 的暂存副本另行隔离模拟，结果见 [0.8.4 说明](RELEASE_NOTES_V0.8.4.md)；没有向真实 Gateway 注册会话。视觉和交互验收独立，未运行 UI 自动化。
