# Desktop 协作数据与维护契约

更新：2026-10-22。本文保留自 0.8.4 起的维护契约与阶段记录；当前本地源码为 1.0.3，公开发布记录仍见 1.0.0。源码、包、已安装应用和宿主行为分别保留证据。当前交接入口见 [本地知识交接](HANDOFF_LOCAL_KNOWLEDGE.md)。

## 1.0.3 Memory 待处理审计

`counts.pendingEmbeddings` 统计 active 且非 restricted、embedding 状态为 pending 的记忆；完全无 embedding 记录仍是 missing，failed 和 stale 保持独立口径。仅有 pending 时维护状态为 `pending`，综合审计为 `needs_review`；其他修复问题优先为 `needs_repair`，全部完成才为 `ok`。pending 表示未完成，不证明任务卡死；不增加超时阈值。关闭 embedding provider 时保留 pending，不伪造失败。

凌晨维护及运行期间每 15 秒的处理原本就消费 pending 队列，不由审计状态决定是否启动。维护不重新入队已有 pending 或重置其时间戳；runtime 的 `after` 在实际批次处理后重读，明确显示部分完成、失败或全部完成。dryRun 不消费队列。Node/CLI 隔离回归覆盖这些路径，不调用真实模型。

## 1.0.1 候选池与有效开关

pending、deferred、approved 共用每 Agent 10 条、创建后 7 天有效的候选池。数据库写入触发器限制容量，既有 InnerLife 调度执行过期维护，候选只读投影在清理前也排除到期项。淘汰只改变候选状态，不删除正文；动作回执保存旧状态、旧原因、旧更新时间及退出原因。drafting、used 和历史 active 会话不因候选策略被清除。

每 Agent 的 daemon 选择为开关依据，profile 镜像该选择；012 升级迁移按已有 daemon 修复 profile，不改变既有运行/暂停选择。全局开关是独立运行门槛，关闭全局不会抹去各 Agent 选择；暂停某个 Agent 不再修改全局。自动后记认领遵守同一有效开关，暂停队列保留，已认领的工作可以完成；显式手动处理仍可执行。

用户已安装 1.0.1，日用库的 012 迁移与实际候选/开关结果已核对，见 [安装验证](validation/2026-10-21-v1.0.1-installed.md)。界面、下一次自然调度和长期运行仍待观察。下方 0.8.4 与宿主记录中的数量、版本和安装边界均是各自日期的快照。

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

### 2026-10-21 本机宿主修复

用户选择保留 InnerLife、修复运行和收尾。本机已安装后台 SessionStart 分流，以及会话结束回执修复；这是个人 Codex hook 的维护，不是 Desktop 包升级。InnerLife profile 与 daemon 保持启用，没有重启应用或操作 UI。

这次分页核对的 79 个历史 active 会话全部匹配本机 hook state 的后台任务目录：`memories` 56 个、`memories_v2` 23 个。现有宿主记录仍缺少精确结束凭据，因此保留状态和原数据；此数量是检查时的快照。待分享内容没有批量丢弃或标记已使用。

结束链路优先使用 payload 中的会话 ID；缺失时使用 `CODEX_THREAD_ID`，最后才兼容 transcript 路径。缺少本地映射时，普通会话利用服务端已有的 external-id 查询补交结束请求。后台任务未注册且没有旧映射时不补交；已有映射的后台任务仍可在真实 Stop 时正常结束。

MCP 的 `isError` 和缺少 result 均作为失败。只有收到 `session.status=ended` 回执才能清除本地映射；missing、错误和未确认回执均保留映射并记录可区分结果，供后续真实 Stop 再次处理。不增加后台重试或按年龄清理。

`scripts/prepare-codex-session-close.mjs` 在已经加入分流策略的已知 hook 上生成修复副本；未知布局、缺少策略或重复修复明确失败，不覆盖原文件。安装前核对差异并备份。本机原 hook、配置及状态备份位于 `~/.codex/backups/innerlife-repair-20261021-6w3fnamh/original/`，已逐字节核对，并从备份恢复 hook 副本核对。

```sh
node scripts/prepare-codex-session-close.mjs --hook /path/to/policy-enabled/hook.mjs --output /tmp/claracore-close-review
node scripts/check-codex-hook-lifecycle.mjs --hook /path/to/repaired/hook.mjs
```

独立检查使用真实 hook 的临时副本、临时状态目录与随机本机端口的模拟 Gateway，验证两个后台目录的开始/结束不调用 Gateway、普通开始/结束、宿主 ID 补全、错误或 missing 回执保留、再次结束与缺失映射补查。它不会向真实 Gateway 注册测试会话，也不改变个人配置。已安装 hook 的同组检查通过；真实后续宿主事件和长期运行效果仍待自然使用验证。

## 检索反馈

`gateway_auto_context.recallReceipt.decisionId` 指向此次 Memory Controller 账本事件；反馈指针仅在确有事件时出现。Controller 的 timeout 保持 timeout，不归入普通空召回。hostDelivery、used 和 outcome 默认仍为 unknown。

维护 full profile 提供 `memory_context_feedback`，当前源码的日常 core manifest 为 25 工具、工具数组预算为 14 KiB；core-compat 保留精简前 38 项目录（见 [分流与迁移契约](design/2026-10-22-mcp-tool-surface.md)）：

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


## MCP 维护能力整合（2026-10-22 源码）

完整现行目录为 83 项，16 个旧名称只保留过渡适配。Memory 的检查、合并建议、归档建议统一走
`memoria_maintenance_audit(section=maintenance/merge-suggestions/archive-suggestions)`；不传 section 保留综合审计。
诊断和执行分别保留；`maintenance_run`、`memoria_merge`、实际归档操作没有被合并为报告的隐式副作用。
InnerLife 诊断统一走 `innerlife_status(detail=full, section=doctor/daemon)`，这两个新读取分区不初始化 daemon。
旧诊断名字的历史初始化行为只在兼容层保留。模型调整/标签别名使用显式 action 的对象管理入口。
完整旧名映射和退出门槛见 [能力整合](design/2026-10-22-mcp-capability-consolidation.md)，退出前必须迁移已识别的个人 hooks；本轮不自动改个人配置。
