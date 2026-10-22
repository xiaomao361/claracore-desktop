# MCP 日常目录精简与兼容契约

日期：2026-10-22（Asia/Shanghai）。状态：已包含在用户安装的 1.0.3 Lite，实时 Gateway 目录与兼容 hash 已验证；真实客户端使用和长期体验仍待用户试用。见[安装验证](../validation/2026-10-22-v1.0.3-installed.md)。
关联：[原交接计划](2026-10-22-mcp-tool-surface-handoff.md)。

## 选择与量化

第一阶段沿用 profile 机制改变目录展示；后续能力整合已移除重复 handler，旧名通过薄适配保留调用兼容，授权边界不变。
默认 core 从 38 项收敛到 25 项；显式 core-compat 固定保留本次改动前的 38 项、顺序、描述与 shaped schema，回归以基线 SHA-256 验证。full 返回现行 canonical definitions。后续完整能力整合已将其收敛为 83 项；16 个旧名称采用过渡适配，见[逐项整合与退出条件](2026-10-22-mcp-capability-consolidation.md)。
未传、空白、非法 profile 均回落 core（既有契约）；有效值忽略大小写。HTTP header 优先于 toolProfile 查询参数。

| 目录 | 工具数 | 紧凑 JSON {tools:[...]} UTF-8 字节 | 相对旧 core |
| --- | ---: | ---: | --- |
| core | 25 | 13663 | 工具减少 34.2%；schema 字节减少 35.7% |
| core-compat | 38 | 21260 | 逐字节保留 |
| full | 83 | 50496 | 现行能力整合；另保留 16 个可调用适配 |

字节数不是客户端 token 计费，也不是模型实际加载量。没有缩短事实/工作线/分享正文，未放宽任何响应预算。默认工具数组预算由 22 KiB/38 项收敛为 14 KiB/25 项。

保留 25 项而非进一步压缩的理由：事实替代与关联读写、工作线创建/选择/更新/归档必须成对完整；session_start/end 同时保留，供无 hook 客户端手工接入；gateway_auto_context 保持 Codex 每个人类用户回合的调用契约。Knowledge 索引重建属于维护，日常 read/preview/commit 三项已足够。Understanding 和结构化记录整体移至专项目录，避免只留写入端。

## 实际客户端与 hook 依赖（只读盘点）

| 来源 | 固定调用与约束 | 本次处理 |
| --- | --- | --- |
| ~/.codex/config.toml、~/.codex/hooks.json | HTTP MCP，无 profile 头；SessionStart/UserPromptSubmit/Stop 指向 ~/.codex/hooks/claracore-desktop/hook.mjs | 不修改个人配置或 hook |
| Codex hook.mjs | session_start/end、pending_shares、gateway_auto_context；显式 checkpoint 用 memoria_search/create/update、shared_line_list/create/update、submit_continuity、mark_share；直接 POST tools/call，不先验证 tools/list | pending_shares 仍可按名调用；submit_continuity 由兼容适配固定 source 后转到统一投料；auto_context 仍在默认目录 |
| ~/.claude.json、~/.claude/settings.json | ClaraCore HTTP 无 profile 头；hooks 路径来自真实 settings，位于 tools/creflex | 不修改个人配置或跨仓库文件 |
| creflex/session-start.js、session-end.js | 直接 POST session_start/end；start 提示已有 session，避免重复开始 | 默认保留手工入口；hooks 仍直接调用 |
| creflex/user-prompt-submit.js | gateway_auto_context、pending_shares；旧版回退 memory_context，直接 tools/call | 三者 handler 均保留，当前服务正常 abstain 不因移出目录回退 |
| creflex/post-memoria-create.js | memoria_search(detail=full)；无目录刷新依赖 | 保留默认入口及参数 |
| 无 hook 客户端 | 手动 session_start，保存返回 session.id，使用 session_end 收尾；重复开始/结束与 missing bestEffort 可区分 | 默认目录完整支持；不可把 conversationId 当 sessionId |

宿主/模型真实已加载目录、Claude/Codex 动态刷新支持未验证；本实现不依赖该能力。检查的是配置和调用源码，不能据此宣称客户端已采用新目录。Codex hook 生命周期另用脚本在临时 config/state 和模拟 HTTP 服务验证，不运行日用 hook。没有改动 79 个旧 active session。

## 可执行迁移与专项发现

日常连接无须新增 header。首次连接统一：claracore_connection_test → shared_line_get（不传 lineId；出现 SHARED_LINE_ID_REQUIRED 后选择候选并用精确 lineId 重试）。自动上下文、主动检索、Understanding 是不同入口，不互相替代。

需要专项时先调用默认工具 gateway_docs(section=diagnostics)，再在当前 MCP 连接的 headers 中添加下列一项，按宿主操作重连，并读取 tools/list 获取完整 schema；不把切 header 的 HTTP 能力当作客户端热刷新承诺：

- 兼容旧目录或专项：X-ClaraCore-Tool-Profile: core-compat
- 全部维护：X-ClaraCore-Tool-Profile: full

Claude Code 的现有 mcpServers.claracore-desktop.headers 中可加入：

```json
{ "X-ClaraCore-Tool-Profile": "core-compat" }
```

Codex 的现有连接 headers 表中可加入：

```toml
[mcp_servers.claracore-desktop.http_headers]
# 保留已有身份头，在现有表中添加一行，不重复创建同名表。
X-ClaraCore-Tool-Profile = "core-compat"
```

以上是合并片段，不含 URL 或凭证，也不是要整体覆盖配置。配置、重连、部署需后续明确安排，本次未执行。切回日常时移除 profile 头并重连。已知 hooks 不需适配；专项模型任务应先加载目录，不要求模型猜测未展示工具参数。

## 全量工具分流

“宿主”是实际只读 hook 源码中的固定调用；一个工具可同时属于日常或专项。现行完整目录中的其他条目仍可显式访问，不新增万能 dispatcher 或权限系统。原 97 项的替代路径见[能力整合映射](2026-10-22-mcp-capability-consolidation.md)。

| 工具 | 分流 | 宿主固定调用 | 展示/访问路径 |
| --- | --- | --- | --- |
| understanding_context | 专项 | — | core-compat 或 full；配置后重连 |
| understanding_submit | 专项 | — | core-compat 或 full；配置后重连 |
| understanding_resume | 专项 | — | core-compat 或 full；配置后重连 |
| claracore_status | 维护/诊断 | — | core-compat 或 full；配置后重连 |
| claracore_connection_test | 日常 | — | core；无需切换 |
| gateway_docs | 日常 | — | core；无需切换 |
| gateway_context | 专项 | — | core-compat 或 full；配置后重连 |
| gateway_auto_context | 日常 | 是 | core；无需切换 |
| gateway_trace_list | 维护/诊断 | — | full；配置后重连 |
| gateway_trace_get | 维护/诊断 | — | full；配置后重连 |
| agent_identity_merge | 维护/诊断 | — | full；配置后重连 |
| knowledge_index_rebuild | 维护/诊断 | — | core-compat 或 full；配置后重连 |
| knowledge_read | 日常 | — | core；无需切换 |
| knowledge_intake_preview | 日常 | — | core；无需切换 |
| knowledge_intake_commit | 日常 | — | core；无需切换 |
| memory_context_feedback | 维护/诊断 | — | full；配置后重连 |
| memory_context | 专项 | 是 | core-compat 或 full；配置后重连 |
| memoria_list | 维护/诊断 | — | full；配置后重连 |
| memoria_search | 日常 | 是 | core；无需切换 |
| memoria_get | 日常 | — | core；无需切换 |
| memoria_create | 日常 | 是 | core；无需切换 |
| memoria_update | 日常 | 是 | core；无需切换 |
| memoria_tag | 维护/诊断 | — | full；配置后重连 |
| memoria_restricted_list | 维护/诊断 | — | full；配置后重连 |
| memoria_restrict | 维护/诊断 | — | full；配置后重连 |
| memoria_unrestrict | 维护/诊断 | — | full；配置后重连 |
| memoria_delete | 维护/诊断 | — | full；配置后重连 |
| memoria_restore | 维护/诊断 | — | full；配置后重连 |
| memoria_archive | 维护/诊断 | — | full；配置后重连 |
| memoria_archived_list | 维护/诊断 | — | full；配置后重连 |
| memoria_restore_archived | 维护/诊断 | — | full；配置后重连 |
| memoria_archive_dormant | 维护/诊断 | — | full；配置后重连 |
| memoria_stats | 维护/诊断 | — | full；配置后重连 |
| memoria_graph | 维护/诊断 | — | full；配置后重连 |
| memoria_maintenance_run | 维护/诊断 | — | full；配置后重连 |
| memoria_maintenance_audit | 维护/诊断 | — | full；配置后重连 |
| memoria_export | 维护/诊断 | — | full；配置后重连 |
| memoria_import | 维护/诊断 | — | full；配置后重连 |
| memoria_merge | 维护/诊断 | — | full；配置后重连 |
| memoria_label_alias | 维护/诊断 | — | full；配置后重连 |
| memoria_link_create | 日常 | — | core；无需切换 |
| memoria_link_list | 日常 | — | core；无需切换 |
| memoria_supersede | 日常 | — | core；无需切换 |
| memoria_link_delete | 维护/诊断 | — | full；配置后重连 |
| memoria_record_create | 专项 | — | core-compat 或 full；配置后重连 |
| memoria_record_list | 专项 | — | core-compat 或 full；配置后重连 |
| memoria_record_get | 专项 | — | core-compat 或 full；配置后重连 |
| memoria_record_summary | 专项 | — | full；配置后重连 |
| memoria_record_stats | 专项 | — | full；配置后重连 |
| shared_line_get | 日常 | — | core；无需切换 |
| shared_line_list | 日常 | 是 | core；无需切换 |
| shared_line_create | 日常 | 是 | core；无需切换 |
| shared_line_activate | 日常 | — | core；无需切换 |
| shared_line_rename | 维护/诊断 | — | full；配置后重连 |
| shared_line_archive | 日常 | — | core；无需切换 |
| shared_line_restore | 维护/诊断 | — | full；配置后重连 |
| shared_line_update | 日常 | 是 | core；无需切换 |
| shared_line_handoff_create | 专项 | — | core-compat 或 full；配置后重连 |
| shared_line_agent_state | 日常 | — | core；无需切换 |
| shared_line_model_adjustment | 维护/诊断 | — | full；配置后重连 |
| shared_line_compact | 维护/诊断 | — | full；配置后重连 |
| innerlife_session_start | 日常 | 是 | core；无需切换 |
| innerlife_session_end | 日常 | 是 | core；无需切换 |
| innerlife_afterthought_resolve | 维护/诊断 | — | full；配置后重连 |
| innerlife_status | 维护/诊断 | — | core-compat 或 full；配置后重连 |
| innerlife_briefing | 维护/诊断 | — | full；配置后重连 |
| innerlife_profile_set | 维护/诊断 | — | full；配置后重连 |
| innerlife_profile_list | 维护/诊断 | — | full；配置后重连 |
| innerlife_profile_get | 维护/诊断 | — | full；配置后重连 |
| innerlife_profile_delete | 维护/诊断 | — | full；配置后重连 |
| innerlife_digest | 维护/诊断 | — | full；配置后重连 |
| innerlife_share_check | 日常 | — | core；无需切换 |
| innerlife_submit_inbox | 日常 | — | core；无需切换 |
| innerlife_pending_shares | 维护/诊断 | 是 | core-compat 或 full；配置后重连 |
| innerlife_share_actions | 维护/诊断 | — | full；配置后重连 |
| innerlife_mark_share | 日常 | 是 | core；无需切换 |
| innerlife_daemon_set | 维护/诊断 | — | full；配置后重连 |
| innerlife_daemon_tick | 维护/诊断 | — | full；配置后重连 |
| innerlife_history | 维护/诊断 | — | full；配置后重连 |
| innerlife_experiences | 维护/诊断 | — | full；配置后重连 |
| innerlife_summaries | 维护/诊断 | — | full；配置后重连 |
| innerlife_explore | 维护/诊断 | — | full；配置后重连 |
| innerlife_converge | 维护/诊断 | — | full；配置后重连 |

## 验证与交付边界

验证记录：[工程验证](../validation/2026-10-22-mcp-tool-surface.md)。原有 1.0.1 InnerLife 改动、migration 012、未跟踪 CLAUDE.md 保留；本次没有新增数据迁移。没有提交、推送、版本升级、打包、发布、安装、重启或 UI 操作。技术验证仅证明临时根中的服务与协议，客户端真实目录和人的体验验收待后续安装/重连后检查。
