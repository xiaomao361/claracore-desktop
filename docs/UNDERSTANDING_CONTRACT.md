# 共同理解底层契约（understanding-v1）

2026-10-20 发布准备。当前源码版本 `1.0.0`，底层契约沿用 0.9.x 验证基线。
用户确认早期共同理解改版为 0.9.0，
会话接入修复后为 0.9.1，首页长标题布局修复为 0.9.2。此前测试包误沿用 0.8.4 元数据，保留为历史记录，不代表公开发布。
Gateway 组织显式读写，四模块保留原有业务数据所有权。
1.0 GUI 的实现和视觉边界见 [界面契约](design/V1_GUI.md)。

## 入口与责任

| 入口 | 行为 | 默认边界 |
| --- | --- | --- |
| `understanding_context` | 当前问题的共同线、记忆、知识和允许审阅的分享预览 | 有界读取，不建线、不激活；内在活动需显式 reviewShares |
| `understanding_submit` | 提交本轮证据增量，服务端规划四域处理并按授权执行 | 默认只规划；模型需 allowModel=true；执行需 execute=true |
| `understanding_resume` | 查看计划、逐项回执、恢复未完成操作 | 原始证据、授权、计划和调用者身份保持不变 |

三个入口均进入 core/full 清单。原分域工具继续支持深入读取与明确维护。
主实现位于 `core/gateway/understanding/`，没有新增第五个业务事实库。

读取 query 最多 1500 UTF-8 字节；共同线采用 resume 投影，记忆/知识各最多
3 项摘要并保留 detailRef，默认包上限 24 KiB。共同线候选默认 10 项，显式
lineLimit 可到 50，扩展目录上限 64 KiB。不指定 lineId 时默认返回归属候选；
allowModel=true 可由服务端语义匹配现有目标，歧义保留，不用全局 fallback，
不把唯一候选自动视为匹配，不建线或激活。普通问答可以无共同线。
知识默认 hybrid，复用已有本地 embedding 配置，也可显式 knowledgeMode=exact。
索引/模型失败显示 partial，未命中不证明资料不存在。记忆搜索按真实结果包读取，
旧记忆不声称本轮重新核实了用户确认。

规划前逐事件召回，不再拼接后截前 350 字。每条文本用 1200 UTF-8 字节窗口、
120 字节重叠覆盖全部正文，同时按知识 sourceRef 查找旧来源。相同对象摘要只
保存一次，各事件保留引用、逐窗口结果和未展开指针。规划召回包上限 64 KiB，
正文覆盖不等于穷尽语义去重。若已经找到的相关候选超过摘要配额，新建事实/知识
会返回 recall_candidates_need_review，不能静默忽略已知候选后写入。

InnerLife 默认不收集。显式 reviewShares 复用现有 timing；只有 approved/deferred
且建议 use 的候选才返回有界预览，pending/private 正文被挡住。词面 timing
不能替代交流语境审阅。选择、交付和实际使用分开记证，不自动标记后两者。

## 提交示例

```json
{
  "submissionId": "conversation-42-turn-7",
  "events": [{
    "id": "u7", "speaker": "user",
    "text": "我决定项目文档使用中文。",
    "sourceRef": "conversation:42#u7"
  }],
  "allowModel": true,
  "grants": { "memory": true },
  "execute": false
}
```

示例不代表用户授权保存这条示例事实。events 是有实际出处的增量，不是整段
聊天或分域分类。最多 12 条、合计 32 KiB、单条正文最多 6000 UTF-8 字节。
speaker 限 user/agent/source，sourceRef 必填；二者是调用方对证据的陈述，
并非系统独立认证的人类身份。grants 同样只陈述已经存在的真实权限。

服务端复用既有 `database.innerLifeGenerate` 的聊天配置做语义提取和路由，
不在 InnerLife 中保存或代写念头。只有 allowModel=true 才调用该配置，未允许时
零模型请求；不默认启用 Jev、新 provider 或付费服务。模型负责语义判断，Agent
负责提交真实变化；不存在依赖关键词的“用户确认”判定。

模型必须对每个事件的四域逐项给 planned/none/pending、理由和操作索引；
每个操作必须给原文引句、事件引用、确认状态和理由。服务端拒绝漏域、漏事件、
虚构引句、索引不一致和超预算输出。结构与引句存在性不能证明提炼语义正确。
模型不可用、输出无效、待补证据和确实无变化是不同结果，不能合并成正常成功。

## 计划与授权

执行日志先刷新完整临时文件，再替换目标；macOS/Linux 另外同步父目录。
Windows 不支持只读目录句柄的 fsync，因此不声明同等的目录断电持久性。
文件写入/刷新错误和受支持平台的目录同步错误继续传播，不能作为成功回执。

先持久化语义计划，再准备域预览/旧版本，再执行。planRef 指向有界完整计划，
含原文引句、出处和原始授权。默认回执只返回逐项状态、理由和对象指针。

| 操作 | 服务端限制 |
| --- | --- |
| memory | 用户确认状态、用户引句与 memory 授权；复用同事实；不自动覆盖或替代已有记忆 |
| knowledge | 来源、日期、归属一致；复用同来源/归属/正文；新文件经既有 intake 预览和提交 |
| position | 调用者精确选线或服务端明确语义匹配的精确 ID；未核实进展为 needs_review；省略 nextStep 保留旧值 |
| line_create | 可恢复目标、用户证据、continuity/createLine 授权；已有候选时必须语义判断为明确不同目标，并核对完整候选目录与版本 |
| line_archive | 精确选线、完成/明确终止的用户证据、archiveLine 授权；先存最终位置再归档 |
| material | 向既有 InnerLife inbox 登记材料或同计划已保存对象的稳定引用，不全文复制或代写念头 |

grants 支持 memory/knowledge/continuity/innerlife，以及 createLine、archiveLine、
overwriteConfirmed。已获授权的例行操作直接执行；缺授权只阻断依赖项。覆盖确认
位置继续受既有确认规则保护。新授权/证据应使用新 submissionId。

建线不取决于长短期。聊天结束只保存位置；等待、暂停、空闲、没有 nextStep
都不能独自证明目标完成。无选定线时，模型提供 lineSelection、完整候选 ID、
依据引句、理由与 clear/uncertain 判断。服务端核对目录完整性和归属；明确复用
可写对应 ID，明确新目标可按权限建线，不激活、不合并、不静默关闭长期线。
归档仍要求调用方明确给 lineId。候选超过 50 或多目标仍不明确时停相关写入；
模型判断期间和落库前目录变化会拒绝建线，包括 SQLite 域内候选成员竞争检查。

inbox 只持有版本化材料引用，不全文复制事实。现有 process/digest/explore 在
需要材料时读取最多 1600 UTF-8 字节正文，完整元数据加摘录控制在下游来源预算
内。只允许普通活跃记忆、该 Agent 归属共同线和选定知识目录中的精确锚点；
校验正文哈希与知识根指纹。禁止任意文件/URL 获取。资料变化、受限、跨归属或
缺失时，该 inbox 项继续 pending，其他可读项继续。旧引用缺少版本依据时返回
legacy_material_reference_needs_review，不凭空升级。读取回执不证明生成、
分享或实际使用；InnerLife 自主生成/审阅/分享机制保持独立。

## 恢复与持久化

`dataRoot/gateway-understanding/` 保存 0600 权限的执行日志，只记录显式提交的
有界增量、证据、计划与状态；它是恢复记录，不是另一事实权威。没有后台全量
收集或自动删除。日志原子替换并 fsync，锁不以时间过期冒充进程退出；明确死
进程锁可恢复，损坏或无法判定的锁需要检查。

去重键包含 agent/client/conversation 与 submissionId。相同 ID 改变内容会拒绝，
重试不重新规划。原始 allowModel 为 true 且尚无有效计划时，replan=true 可重试。
同身份调用 resume(execute=true) 恢复原计划；重试参数不能修改授权。

- 记忆通过目标内容与操作标记核对，写后断开不盲目再建。
- 知识使用稳定路径/kb_id，过期预览重建相同字节；已写文件必须匹配计划哈希。
  写入恢复但索引状态未知返回 partial，沿指针检查正文与索引，不再次追加。
- 共同线冻结旧位置，在 SQLite 域内 BEGIN IMMEDIATE 与内容约束后共同写入
  当前位置、历史和快照；竞争返回 conflict。归档前再次核对最终位置。
- InnerLife inbox 元数据保留稳定操作引用，恢复不重复登记。

## 宿主适配器与真实模型验收入口

`core/gateway/understanding/host.js` 与 `scripts/understanding-host.mjs` 提供显式
宿主事件桥，默认 disabled，不安装 hook、不读聊天日志或全局配置。实际宿主必须
提供真实原文事件与稳定 turn/checkpoint ID；checkpoint/turn_completed 都能增量
提交，不只依赖结束事件。来源文本不能给自己授权，权限只从明确配置传入。
没有 endCallback 则返回 end_callback_unavailable；结束事件不会归档目标。

宿主 outbox 保存有界原始增量和回执，发送前先持久化。重启后 recoverPending
按页恢复；先查同 submissionId 的服务端记录，明确不存在才重送原 payload。
写后丢回执不再创建记录，完成项不重复提交；同 turn/checkpoint 改内容会拒绝。
模型/授权/业务待处理项显示 attention，不能冒充 transport retry 或完整成功。
宿主拿到上下文不代表已经注入或使用，hostDelivery/used 仍需真实宿主证据。

事件桥接法与模型验收命令见 [宿主接入说明](UNDERSTANDING_HOST.md)。八个合成
用例覆盖确认、否定、Agent 推测、资料立场、歧义、新目标、结束聊天和长期目标。
默认运行 evaluate:understanding 只报告就绪，零模型调用；实际调用必须显式授权。
可显式指定现有模型配置，或用 sqlite3 -readonly 只读确切数据根的模型设置及认证
引用；同一次只读 SQL 核对实际数据库路径，不初始化/迁移数据库，不读业务记忆。
凭据只用于认证，不写入报告；每批最多八次调用，不自动重试增加费用。
报告的通过只说明这些结构与处理方向检查通过，措辞范围、遗漏和业务效果仍需审阅。

逐项回执区分 completed、unchanged、blocked、needs_review、failed、partial。
独立成功与未决项并存时总体 partial；状态未知不能当作尚未写入。
**不承诺 SQLite、Markdown、日志之间的原子事务。** 冲突或损坏不会自动覆盖
别人进展，需要先核对目标，再以新证据提交；原有维护工具仍可用于明确修正。

## 验证与未集成边界

`npm run test:understanding` 纳入 `npm run check`。临时真实 SQLite/Markdown
加替身模型覆盖：无共同线问答、已有线恢复、歧义拒写、短期创建至归档、长期线
保留、推测与确认、缺授权、无模型与无变化、完整性、重复提交、知识去重、预览
过期、部分失败、竞争写入、私有分享不泄露。子进程在记忆写入后退出，父进程
重开数据库恢复。Native SQLite 与 CLI 回退均通过。

HTTP 合约使用临时根、端口 0，结束后停止服务，覆盖认证 MCP、清单、统一入口、
重复调用、冲突错误与追踪正文省略。产品默认端口仍为 50668。

HCT-2026-09-08-01：失败/部分状态在回执中可见，模型不可用在写入前返回。
HCT-2026-09-08-02：来源、推测、用户事实分开；歧义拒写，旧位置竞争在覆盖前
拒绝。这是本轮检查证据，两项 trial 仍待真实工作复核。

新增回归覆盖逐事件尾部、真实记忆包形状、候选溢出拒写、三条 InnerLife 材料
消费路径、受限/跨归属/变更拒读、共同线语义路由、不同新目标与目录竞争、宿主
重启和发送前后失败、否定误判检测。本地回归模型部分使用替身，通过不证明
实际模型质量或真实宿主已经发出回调。原有 Native SQLite/CLI 与恢复测试继续保留。

另经用户明确授权完成现有 deepseek-v4-flash 的 8 次合成调用，自动检查 7/8
通过、1 次请求失败；逐例审阅识别两处正文/理由缺陷，已修正规划引导，但未再
调用模型复验。失败诊断已补本地回归，保留类别且不泄露 provider 正文。详见
[首批真实模型审阅](validation/2026-10-15-understanding-model-review.md)。

真实宿主安装/回调、真实对话完整性和 UI/业务验收仍未完成。Memory-only 自动
上下文不变；未安装或未调用新适配器时仍可能漏交增量。没有宿主/全局配置修改、
真实数据迁移、用户应用启动重启、安装、提交推送或发布。

此前 Lite .1/.2 包误沿用 0.8.4 版本元数据；.1 已由用户安装并完成只读检查，
.2 已完成包内隔离验证。随后按用户确认修正为 0.9.1，使用 .3 构建标识重新打包；
旧文件和回执保留历史值。Hermes 动态会话头修复属于客户端源码，仍需重启 Hermes。
用户随后提供首页长标题布局问题截图，当前已修复为 0.9.2 / .4 构建，视觉仍待用户复核。
详见 [0.9.2 说明](RELEASE_NOTES_V0.9.2.md)、[0.9.1 说明](RELEASE_NOTES_V0.9.1.md) 和 [本地包回执](validation/2026-10-15-understanding-lite-package.md)。
