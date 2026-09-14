# HTTP MCP 接入与 stdio 迁移

从 0.7.2 起，Desktop 只提供 Streamable HTTP MCP，保留
`2026-07-28` 和 `2025-06-18` 两个协议版本。stdio MCP 已移除。
CLI 保留为内部维护入口，不作为 Agent 的接入回退。

## 现有客户端

1. 保持 Desktop 运行，从「智能体接入」或「设置 → 通用 → Agent Gateway」
   取得实际 URL 与 Bearer token。默认 URL 是 `http://127.0.0.1:50668/mcp`；
   修改过端口时以设置为准。
2. 删除旧 MCP 连接的 command、args 和启动环境配置，换成客户端支持的
   Streamable HTTP 配置。不要把 HTTP 地址填进进程 command 字段。
3. 配置 `Authorization: Bearer <token>`、`X-ClaraCore-Agent-ID` 和
   `X-ClaraCore-Client-ID`。宿主可提供当前对话 ID 时，再发送
   `X-ClaraCore-Conversation-ID`；该字段不能代替 InnerLife 的 sessionId。
4. 重新连接，调用 `claracore_connection_test`，再调用
   `gateway_context(detail="brief")`。多线歧义时选择明确 lineId 再试。
5. 不支持 Streamable HTTP 的客户端需要升级或更换；旧 HTTP 协议兼容
   不等于保留 stdio 传输。不要自动重试写入或悄悄启动另一个数据库进程。

2026-09-09 本机只读配置检查：Codex 和 Claude 的 ClaraCore 连接均为 HTTP；
Hermes 配置未发现旧 Gateway 启动项。配置检查不等于每个宿主的实际接入验收。
本次没有修改客户端配置、重启客户端或替换运行中的应用。

## 内部 CLI

`core/cli.js` 保留数据检查、维护、导入导出及各领域操作。它直接调用产品运行层，
不依赖 HTTP 服务，适合维护和自动化验证，不在日常 Agent 接入邀请中提供。

在源码仓库中查看命令：

```sh
node core/cli.js --help
```

对日用数据操作时，显式指定 `CLARACORE_DESKTOP_USER_DATA_DIR`，其值是包含
`desktop-settings.json` 的用户数据目录，而不是数据库文件路径。自定义 dataRoot
仍由 Desktop 设置解析。维护写入遵循现有权限和备份要求，不直接改 SQLite。
打包后的 CLI 可通过 Electron 的 `ELECTRON_RUN_AS_NODE=1` 模式执行
`app.asar/core/cli.js`；这不是 MCP 服务。

## 兼容性边界

- 不改变记忆、线、InnerLife 的存储结构；没有为传输退役新增数据库迁移。
- 历史 Trace 中的 `stdio` 继续显示其真实来源，不回填成 HTTP。
- 旧 `--gateway` 启动参数会明确报错；旧 `mcp-server.js` 入口不再随包提供。
- HTTP 与 Desktop 共用主进程及产品数据库连接，不再扫描或终止兄弟 MCP 进程。
- SQLite CLI 是底层数据库兼容路径，与本页所述产品维护 CLI 不同，继续保留。

## 验证入口

`npm run check` 检查接入文案和错误状态；`npm run test:gateway` 覆盖新旧 HTTP、
完整工具契约、身份、背压、Shared Line 交接选线及歧义拒绝写入。
`npm run test:memoria:cli` 和 `npm run test:sqlite-concurrency` 保留维护入口与跨进程验证。
