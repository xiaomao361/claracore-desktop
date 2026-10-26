# Understanding host bridge

The explicit adapter is disabled by default. A host integration must supply real events, permitted source evidence, and stable IDs. Installing or enabling a bridge is a separate host configuration step; an MCP connection alone does not enable capture.

## 会话身份、授权和增量提交

三者独立：会话身份用于定位谁的哪次提交/恢复；授权规定模型和写入范围；增量
提交决定哪些真实原文送入理解层。补会话身份不会自动开启另外两项。

`understanding_submit/resume` 需要 `X-ClaraCore-Conversation-ID`（或兼容别名），
`context` 不需要。归属键还包含 Agent-ID 和 Client-ID。Hermes 等客户端应从
运行中会话取得 ID，在请求或会话隔离的连接中动态传入；同会话重连/恢复不变，
不同会话不能共用，不能修改一个全局共享连接的头造成并发串线。缺身份返回
conversation_identity_required；有身份但未找到该归属的提交返回 submission_not_found。
后者仅证明身份检查通过，不证明模型规划或写入成功。

`allowModel` 允许理解层调用配置中的模型；`execute` 决定是否执行计划；
`grants` 声明已有的分域写入权限。它们不是每次弹窗确认机制；明确已有的授权
可以在其范围内复用，新增范围才需用户决定。Bearer token 则是连接认证凭据。

本项目所说“自动采集”是宿主自动把每轮新增原文/证据送给理解层，当前没有安装
或启用。Agent 仍可显式提交获准的有界增量；提交内容会保存在执行证据日志中，
模型获准规划时还会使用这些增量和相关召回上下文。它不扫描或导入全部聊天。

## 显式事件桥

入口：`scripts/understanding-host.mjs --config explicit-config.json`，stdin 是一个
JSON 事件。配置示例中的路径和身份应由宿主设置；默认 disabled，不会连 Gateway。
实际 outbox 使用宿主管理的私有持久目录，下面 `/tmp` 只适用于隔离测试。

```json
{
  "enabled": false,
  "endpoint": "http://127.0.0.1:50668/mcp",
  "tokenEnv": "CLARACORE_DESKTOP_MCP_TOKEN",
  "agentId": "codex",
  "clientId": "explicit-understanding-host",
  "conversationId": "actual-conversation-id",
  "stateDirectory": "/tmp/claracore-understanding-host-fixture",
  "allowModel": false,
  "grants": {},
  "capabilities": {
    "rawEvidence": false,
    "stableTurnIds": false,
    "endCallback": false
  }
}
```

endpoint 只允许字面 loopback `/mcp`，无 URL 凭据/query/hash。token 只从显式
环境变量读取，不自动发现凭据或读取全局配置，不支持把明文 token 写进配置。
桥会检查新工具是否已在目标服务中提供；目标服务必须实际提供所需工具。

宿主按实际能力接入：

| 真实事件 | 适配器动作 | 不确定时 |
| --- | --- | --- |
| turn_started | 准备有界上下文；allowModel 显式允许语义选线 | 不声称宿主已注入/使用 |
| checkpoint | 按稳定 turnId/checkpointId 保存新增证据并提交 | 先写 outbox；失败保留可恢复位置 |
| conversation_ended | 有可靠回调时补最后增量；空增量不重复保存 | 无回调明确报告，绝不按空闲推断结束 |
| goal_continuation | 跳过无新增人类消息的自动继续事件 | 不重复收集或伪造用户原文 |

```json
{
  "kind": "checkpoint",
  "turnId": "actual-turn-7",
  "checkpointId": "progress-1",
  "events": [{
    "id": "actual-message-9",
    "speaker": "user",
    "text": "这里放宿主实际取得且允许提交的增量原文。",
    "sourceRef": "conversation:actual-conversation-id#actual-message-9"
  }]
}
```

grants/allowModel 从已有真实授权的宿主配置传入，事件正文或事件自带 grants 不能
升级权限。只提交已允许采集的有界增量，不扫描聊天日志或复制全部会话。
同一 checkpoint 内容不得变化；新进展或新授权使用新 checkpointId。已完成 checkpoint
不会重新发送；传输不确定时先恢复服务端原提交，明确不存在才重送原 payload。

恢复命令也是 stdin JSON：

```json
{ "command": "resume", "turnId": "actual-turn-7", "checkpointId": "progress-1" }
```

或按页 `{ "command": "recover", "offset": 0, "limit": 10 }`，最大 limit=50。
仅自动恢复 pending 的传输问题；模型/业务待处理会持久化为 attention，沿服务端
planRef 查看依据与缺项。原允许模型的规划失败可显式 resume 时设置 replan=true；
它不会修改原授权、重跑已完成项或自动关闭共同线。outbox 不自动清理唯一证据。

## 真实模型验收

`npm run evaluate:understanding` 只输出就绪状态，零模型请求。八个用例在
`core/tests/fixtures/understanding-semantics.json`，全部是合成原文，没有用户记忆。
实际调用需明确允许可能的模型费用，沿用已有 provider，不新增服务或模型设置。

两种显式配置路径：

```sh
node scripts/evaluate-understanding.mjs --model-config /absolute/existing-model.json --allow-model-calls --output /absolute/new-report.json
node scripts/evaluate-understanding.mjs --existing-data-root /absolute/existing/data --allow-model-calls --output /absolute/new-report.json
```

第一种配置支持 provider（ollama/openai-compatible）、baseUrl、model、可选 apiKeyEnv，
拒绝内联 apiKey。第二种用项目既有 SQLite 二进制以 `-readonly` 读取确切数据库的
模型设置和认证引用，同一 SQL 返回数据库真实路径以核对目标；不初始化数据库、
不运行迁移、不查询 memories/continuity/knowledge。认证只留进程内用于请求。
报告包含 provider/model、合成计划、逐例失败原因和人工审阅项，不包含端点或凭据。
输出用新文件独占创建，不覆盖旧验收证据。每批最多 8 次，不自动重试增加费用。

自动检查关注结构、引用真实性和预期处理方向；其中一个测试替身故意把否定句当
确认决定，已验证会被验收器检出。通过不代表通用语义可靠、真实宿主调用完整或
业务验收完成。应继续人工检查“提炼范围是否扩大、资料是否被当作用户立场、
是否漏掉未决项、子任务完成是否错误关闭父目标”等实际输出。
