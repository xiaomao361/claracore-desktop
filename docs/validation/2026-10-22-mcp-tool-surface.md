# MCP 工具目录精简工程验证

本文件保留第一阶段目录精简的历史验证；后续现行 full 已整合为 83 项，见 [完整能力整合验证](2026-10-22-mcp-capability-consolidation.md)。

日期：2026-10-22（Asia/Shanghai）。验证层：源码与隔离 HTTP/数据库/文件流程；未安装、未部署、未进行宿主 UI 操作。

仓库 `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`，分支 `codex/v0.8.0-local-knowledge`，
HEAD `3736ae9331fc0f3ecf000b8e33f2074d97b13d55`（本次未提交）。实现和全量分流见
[目录契约](../design/2026-10-22-mcp-tool-surface.md)，原计划见
[交接文档](../design/2026-10-22-mcp-tool-surface-handoff.md)。

## 目录与兼容

| 项目 | 精简前 | 当前源码 | 证明 |
| --- | ---: | ---: | --- |
| 默认 core 工具 | 38 | 25 | legacy/modern HTTP tools/list、默认流程断言 |
| 紧凑 `{tools:[...]}` UTF-8 字节 | 21,260 | 13,663 | 同一序列化方式；减少 35.7% |
| core-compat 工具/字节 | — | 38 / 21,260 | 原目录 names + SHA-256 基线，含顺序、描述与 shaped schema |
| full 工具/字节 | 97 / 53,697 | 97 / 53,697 | 返回 canonical definitions，逐对象相等 |

工具数组（不含 `{tools:...}` 包装）为 13,653 字节；默认预算 14 KiB/25 项。
字节数不是模型实际加载量或计费 token。存量接口、完整参数与领域权限边界不变。

## 已通过检查

以下最终运行均退出 0。所有运行时验证使用临时根与随机本机端口；测试 Gateway 在 finally 中停止。

| 命令 | 覆盖的证据 |
| --- | --- |
| `git diff --check` | 工作区 diff 无空白错误 |
| `npm run check` | 语法、SQL/IPC 边界、架构、接入契约、预算、默认工作流、自动上下文、Understanding、Knowledge、维护和候选池；包含内存 DOM 测试，无宿主 UI |
| `npm run test:gateway` | Memory/Shared Line/full 接口、正式 handoff 路由、Streamable HTTP setup、legacy/modern 协议与背压 |
| `node core/tests/phase5-innerlife-smoke.js` | 会话、drafting/pending、分享判断/反馈、daemon 等既有 InnerLife 回归，无真实模型调用 |
| `node scripts/check-codex-hook-lifecycle.mjs --hook /Users/zhouwei/.codex/hooks/claracore-desktop/hook.mjs` | 实际 hook 的临时副本，模拟 HTTP、临时配置/状态；后台任务隔离、普通开始/结束、失败/missing 保留、重试、external id 补查 |

默认工作流测试 `core/tests/mcp-tool-surface-smoke.js` 纳入 `test:context-budget` 和 `check`：

- 每个日常调用都核对工具及输入字段确实在默认目录中；不使用隐藏参数或临时恢复 full 完成日常任务。
- Memory：搜索 → 读详情 → 同事实修正 → 新事实创建 → supersede → 当前搜索与旧详情核对；关联读取/写入可用。
- Shared Line：创建两条线 → 列表发现 → 歧义拒绝读取/无目标写入 → 精确选择 → 更新 → 回读；另一条线未误写，归档及 Agent state 可达。
- InnerLife：无 hook 手工开始/结束、同 external id/结束重试、缺失会话 bestEffort 的 missing 状态；真实宿主历史会话未触碰。
- 分享：合成 afterthought 完成后 share_check，读取仍是 pending；缺投递证据的 used 被拒绝，提供模拟响应证据后才 used。模拟投递不证明真人已读。
- 自动上下文：保留 gateway_auto_context；observe 回合明确 abstain/null，不另行伪造召回。
- HTTP 默认、显式 core/core-compat/full、非法值、大小写、查询参数及 header 优先级与 connection_test.toolProfile 一致。
- 隐藏 pending_shares/status 等仍可按名调用，未知工具仍失败。modern 路径同样可调用移出目录的固定 hook 工具。
- 默认 gateway_docs 可发现专项访问路径；专项 Understanding HTTP 测试显式选 core-compat 并完成 context/submit/resume。维护 full 回归仍调用原接口。

`core/tests/knowledge-gateway-http-smoke.js` 同样逐次断言只使用默认已展示工具及参数，覆盖：

- 预览 → 提交 → 读取/精确搜索回查；正文不落到 Gateway trace。
- 预览后并发修改触发 conflict/isError，外部正文不被覆盖。
- 注入结构索引写失败：Markdown 已保存但返回 partial/isError，write 与 index 状态可区分。
- 同 token 重试保留原 partial 回执，正文不重复；仍可精确搜索和读取已写小节。

失败状态保真检查保留了非法 profile 的既有明确回落契约、领域错误、partial、missing 与重试边界。
本次未修改数据迁移、事实转换或业务含义，没有以数量目标改变领域结果。
初轮回归发现旧启动入口/目录数量断言仍在，已更新到新契约后重跑通过；没有删除 full 兼容断言或放宽预算。

## 工作区与运行边界

改动前保存了原 dirty 文件内容、hash 和 diff 到本机临时基线；核对原 InnerLife repository/service、migration 012、
候选池、scheduler、package-lock 及未跟踪 CLAUDE.md 等 19 个相关源/锁文件字节未变。
README、指南、维护测试、package.json 等共同文件在原内容上增量修改，保留已有 1.0.1 工作。
本次无版本变更、提交/推送、打包、发布、安装、重启或个人配置/hook 变更；未向日用 50668 发测试会话。

## 尚未验证的层

日用 1.0.1 仍是旧目录。本次不能证明 Claude/Codex 当前会话已加载 25 项、客户端运行中刷新目录、安装后的视觉/交互体验，或真实宿主后续生命周期的长期效果。
在用户后续明确安排安装/重连后，检查实际默认目录为 25 项、显式 core-compat 为 38、full 为 97，
并用真实日常任务确认体验。无需为此提前修改个人配置、重启日用应用或结束历史会话。
