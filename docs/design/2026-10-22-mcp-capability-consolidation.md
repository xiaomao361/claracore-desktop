# MCP 完整能力整合

日期：2026-10-22（Asia/Shanghai）。状态：源码实施、隔离验证；未发布或安装。

## 范围与结果

用户明确要求继续整理完整 97 项的能力重叠，承接上一阶段默认目录精简。
本次处理同义投料、重复会话读取、状态诊断、维护报告、模型配置与标签别名六组。
保留事实/知识/工作线/想法之间的业务边界，不把自动召回和主动读取混成一个入口。

| 指标 | 上一阶段 | 当前源码 |
| --- | ---: | ---: |
| 默认 core | 25 项 / 13,663 B | 25 项 / 13,663 B |
| core-compat | 38 项 / 21,260 B | 38 项 / 21,260 B，基线 hash 不变 |
| full 现行目录 | 97 项 / 53,697 B | 83 项 / 50,496 B |
| 已合并旧名称 | 0 | 16 个过渡适配，不展示在 full |
| 可按名调用的名称 | 97 | 99（83 现行 + 16 适配） |

B 为紧凑 JSON {tools:[...]} 的 UTF-8 字节，不是客户端 token 计费。现行目录减少 14 项（14.4%），schema 减少 3,201 B（约 6.0%）。16 个旧入口合并，同时新增两个配置对象的管理入口，所以结果为 97−16+2=83。

可调用名称暂时增加，是为了不打断已核实的 hooks 和旧调用。16 项没有保留独立业务 handler；适配只固定来源/动作、投影旧回执、保留已确认的旧副作用，然后调用共享能力。不能宣称旧名称已经物理删除，也不能把 83 认定为已经证明最优的最终数量。

## 六组实施决策

| 旧能力/入口 | 现行承接 | 语义与约束 |
| --- | --- | --- |
| innerlife_submit_fact / innerlife_submit_continuity | innerlife_submit_inbox(source=fact/continuity) | 同一个 submitInbox 服务；旧名字固定来源，传入相反 source 也不能改变旧动作 |
| innerlife_sessions / innerlife_session_get | innerlife_status(detail=full, section=sessions)，分页或 recordId | 公用数据库读取与归属校验；旧 get 的缺失回执仍为 error:not found，canonical 记录读取仍明确失败；跨 Agent 均拒绝 |
| innerlife_doctor / innerlife_daemon_status | innerlife_status(detail=full, section=doctor/daemon) | 新诊断读取不初始化 daemon。旧两个工具曾可能初始化状态，只在适配层保留该历史行为；读副作用不扩散到新入口 |
| memoria_maintenance_check / merge_suggestions / archive_suggestions | memoria_maintenance_audit(section=maintenance/merge-suggestions/archive-suggestions) | 各分区调用原报告函数，不改变 limit/olderThanDays；省略 section 仍是原 combined audit。维护执行、实际合并、实际归档单独保留 |
| shared_line_model_adjustment_list/get/set/delete | shared_line_model_adjustment(action=list/get/set/delete) | 同一配置对象；动作显式、读写参数检查；get 空 model 保留原 null，set/delete 的空值仍由原策略拒绝 |
| memoria_label_alias_list/create/delete | memoria_label_alias(action=list/upsert/delete) | 复用原 alias 规则；upsert 仍迁移标签到规范名称，delete 只删除映射不删除标签 |

这六组分为真实重复的领域入口/视图，以及同一配置对象被拆散的 CRUD；后者没有删除业务动作。旧名字传入其他 action 或 section 时，适配固定字段优先，不能把旧读取名字变成写入。适配回执 _meta.claracore/compatibility 给出 status=deprecated 和 replacementTool，不复制正文或完整参数。

## 保留理由与未合并边界

- gateway_context、gateway_auto_context、memory_context、understanding_context、innerlife_briefing 的触发、选择、暴露内容、授权与预算不同。当前未证明等价，不用一个万能 context 代替；内部仍沿既有共享服务复用。
- Memory 的同事实修正、事实替代、记录去重各自改变不同关系；删除、归档、限制可见性也不是同一状态。受限内容维持显式访问入口。
- 结构化记录的值、日期、时区和领域汇总不是事实正文或单纯计数；本次不迁移/删除记录，也不将 fitness summary 合到通用 stats。
- Knowledge 预览/提交、Understanding 规划/持久化恢复、分享候选读取/投递反馈继续分明；partial、missing、失败和未知不得抹成完成。
- InnerLife digest/explore/converge 是不同处理阶段，session_start/end 属于生命周期，daemon_set/tick 属于显式后台控制。它们没有被证实为重复，保留现有语义。
- 身份合并、profile 删除、历史压缩等具有数据影响，需要独立目标/授权；不会合成一个宽泛写接口。

下面逐项给出原 97 项的位置；这是当前审阅决策，不是实际调用频率统计。没有用“未看到调用”推断某项无用。机器可读版本：[97 项映射 JSON](2026-10-22-mcp-capability-map.json)。

## 兼容迁移和退出条件

full 仅返回当前 canonical definitions；现代协议校验使用独立 callable catalog 接受已知的 16 个旧名称，未知工具仍失败。core-compat 仍冻结上一阶段 38 项展示 schema（包括旧 status 的 section enum）；新 doctor/daemon 分区通过 full 获取 schema。profile 仍不是权限隔离。

当前已核实的个人 Codex hook checkpoint 仍调用 innerlife_submit_continuity；源码提供的替代是 innerlife_submit_inbox(source=continuity)。本次不编辑个人 hook 或客户端配置。示例、指南与受影响回归已指向现行能力，兼容回归故意继续调用旧名称。

16 个适配的移除条件（不会按日期或启动次数自动执行）：

1. 仓库内正式接入说明和调用方已迁移；保留旧名称的兼容测试单独处理。
2. 已识别的外部/个人 hooks 与客户端完成经授权的迁移，并有端到端证据；现阶段尚未满足。
3. 旧调用观察与明确客户端声明支持退出，不能仅凭缺少 trace 宣称没有依赖。
4. 在明确允许破坏兼容的后续版本中记录变更，用户确认退出后，一并移除 route、适配逻辑、legacy schema 和相应旧测试。

现在没有宣布任何旧接口不可调用，也没有把“兼容”当永久产品定位。core-compat profile 的退出也需独立的客户端迁移证据；不随本任务自动删除。

## 原 97 项逐项决策

| 原工具 | 决策 | 现行承接 | 理由 |
| --- | --- | --- | --- |
| understanding_context | 保留 | understanding_context | 跨领域授权计划与持久化恢复，保留与直接读写的区别 |
| understanding_submit | 保留 | understanding_submit | 跨领域授权计划与持久化恢复，保留与直接读写的区别 |
| understanding_resume | 保留 | understanding_resume | 跨领域授权计划与持久化恢复，保留与直接读写的区别 |
| claracore_status | 保留 | claracore_status | 连接、说明、诊断或检索反馈具有独立契约 |
| claracore_connection_test | 保留 | claracore_connection_test | 连接、说明、诊断或检索反馈具有独立契约 |
| gateway_docs | 保留 | gateway_docs | 连接、说明、诊断或检索反馈具有独立契约 |
| gateway_context | 保留 | gateway_context | 触发、选择、隐私和预算契约不同，不视为等价替代 |
| gateway_auto_context | 保留 | gateway_auto_context | 触发、选择、隐私和预算契约不同，不视为等价替代 |
| gateway_trace_list | 保留 | gateway_trace_list | 连接、说明、诊断或检索反馈具有独立契约 |
| gateway_trace_get | 保留 | gateway_trace_get | 连接、说明、诊断或检索反馈具有独立契约 |
| agent_identity_merge | 保留 | agent_identity_merge | 跨记录或不可逆数据操作，保持明确目标和独立授权 |
| knowledge_index_rebuild | 保留 | knowledge_index_rebuild | 阅读/预览/确认写入/索引维护职责明确，保持失败和重试语义 |
| knowledge_read | 保留 | knowledge_read | 阅读/预览/确认写入/索引维护职责明确，保持失败和重试语义 |
| knowledge_intake_preview | 保留 | knowledge_intake_preview | 阅读/预览/确认写入/索引维护职责明确，保持失败和重试语义 |
| knowledge_intake_commit | 保留 | knowledge_intake_commit | 阅读/预览/确认写入/索引维护职责明确，保持失败和重试语义 |
| memory_context_feedback | 保留 | memory_context_feedback | 连接、说明、诊断或检索反馈具有独立契约 |
| memory_context | 保留 | memory_context | 触发、选择、隐私和预算契约不同，不视为等价替代 |
| memoria_list | 保留 | memoria_list | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_search | 保留 | memoria_search | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_get | 保留 | memoria_get | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_create | 保留 | memoria_create | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_update | 保留 | memoria_update | 分别表示事实替代、同事实修正、记录去重，不互相替代 |
| memoria_tag | 保留 | memoria_tag | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_restricted_list | 保留 | memoria_restricted_list | 受限内容必须显式访问，保留独立边界 |
| memoria_restrict | 保留 | memoria_restrict | 受限内容必须显式访问，保留独立边界 |
| memoria_unrestrict | 保留 | memoria_unrestrict | 受限内容必须显式访问，保留独立边界 |
| memoria_delete | 保留 | memoria_delete | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_restore | 保留 | memoria_restore | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_archive | 保留 | memoria_archive | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_archived_list | 保留 | memoria_archived_list | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_restore_archived | 保留 | memoria_restore_archived | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_archive_suggestions | 合并，旧名过渡适配 | memoria_maintenance_audit {"section":"archive-suggestions"} | 维护报告的分区，执行修复/合并/归档仍分开 |
| memoria_archive_dormant | 保留 | memoria_archive_dormant | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_stats | 保留 | memoria_stats | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_graph | 保留 | memoria_graph | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_maintenance_check | 合并，旧名过渡适配 | memoria_maintenance_audit {"section":"maintenance"} | 维护报告的分区，执行修复/合并/归档仍分开 |
| memoria_maintenance_run | 保留 | memoria_maintenance_run | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_maintenance_audit | 保留 | memoria_maintenance_audit | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_export | 保留 | memoria_export | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_import | 保留 | memoria_import | 保留事实生命周期、明确读写或维护执行动作，未证实等价 |
| memoria_merge_suggestions | 合并，旧名过渡适配 | memoria_maintenance_audit {"section":"merge-suggestions"} | 维护报告的分区，执行修复/合并/归档仍分开 |
| memoria_merge | 保留 | memoria_merge | 分别表示事实替代、同事实修正、记录去重，不互相替代 |
| memoria_label_alias_list | 合并，旧名过渡适配 | memoria_label_alias {"action":"list"} | 同一标签别名对象的显式管理动作 |
| memoria_label_alias_create | 合并，旧名过渡适配 | memoria_label_alias {"action":"upsert"} | 同一标签别名对象的显式管理动作 |
| memoria_label_alias_delete | 合并，旧名过渡适配 | memoria_label_alias {"action":"delete"} | 同一标签别名对象的显式管理动作 |
| memoria_link_create | 保留 | memoria_link_create | 关系维护能力，保留与事实替代和正文修改的区别 |
| memoria_link_list | 保留 | memoria_link_list | 关系维护能力，保留与事实替代和正文修改的区别 |
| memoria_supersede | 保留 | memoria_supersede | 分别表示事实替代、同事实修正、记录去重，不互相替代 |
| memoria_link_delete | 保留 | memoria_link_delete | 关系维护能力，保留与事实替代和正文修改的区别 |
| memoria_record_create | 保留 | memoria_record_create | 结构化记录及领域汇总，不等同于事实正文或简单计数 |
| memoria_record_list | 保留 | memoria_record_list | 结构化记录及领域汇总，不等同于事实正文或简单计数 |
| memoria_record_get | 保留 | memoria_record_get | 结构化记录及领域汇总，不等同于事实正文或简单计数 |
| memoria_record_summary | 保留 | memoria_record_summary | 结构化记录及领域汇总，不等同于事实正文或简单计数 |
| memoria_record_stats | 保留 | memoria_record_stats | 结构化记录及领域汇总，不等同于事实正文或简单计数 |
| shared_line_get | 保留 | shared_line_get | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| shared_line_list | 保留 | shared_line_list | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| shared_line_create | 保留 | shared_line_create | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| shared_line_activate | 保留 | shared_line_activate | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| shared_line_rename | 保留 | shared_line_rename | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| shared_line_archive | 保留 | shared_line_archive | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| shared_line_restore | 保留 | shared_line_restore | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| shared_line_update | 保留 | shared_line_update | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| shared_line_handoff_create | 保留 | shared_line_handoff_create | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| shared_line_agent_state | 保留 | shared_line_agent_state | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| shared_line_model_adjustment_list | 合并，旧名过渡适配 | shared_line_model_adjustment {"action":"list"} | 同一模型配置对象的显式管理动作 |
| shared_line_model_adjustment_get | 合并，旧名过渡适配 | shared_line_model_adjustment {"action":"get"} | 同一模型配置对象的显式管理动作 |
| shared_line_model_adjustment_set | 合并，旧名过渡适配 | shared_line_model_adjustment {"action":"set"} | 同一模型配置对象的显式管理动作 |
| shared_line_model_adjustment_delete | 合并，旧名过渡适配 | shared_line_model_adjustment {"action":"delete"} | 同一模型配置对象的显式管理动作 |
| shared_line_compact | 保留 | shared_line_compact | 保留工作线位置、生命周期、正式交接及 Agent 状态的区别 |
| innerlife_session_start | 保留 | innerlife_session_start | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_session_end | 保留 | innerlife_session_end | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_afterthought_resolve | 保留 | innerlife_afterthought_resolve | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_sessions | 合并，旧名过渡适配 | innerlife_status {"detail":"full","section":"sessions"} | 会话分页/详情已由 status 的 sessions 分区承接 |
| innerlife_session_get | 合并，旧名过渡适配 | innerlife_status {"detail":"full","section":"sessions"} | 会话分页/详情已由 status 的 sessions 分区承接 |
| innerlife_status | 保留 | innerlife_status | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_briefing | 保留 | innerlife_briefing | 触发、选择、隐私和预算契约不同，不视为等价替代 |
| innerlife_doctor | 合并，旧名过渡适配 | innerlife_status {"detail":"full","section":"doctor"} | 统一诊断读取；旧初始化副作用只留在适配层 |
| innerlife_profile_set | 保留 | innerlife_profile_set | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_profile_list | 保留 | innerlife_profile_list | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_profile_get | 保留 | innerlife_profile_get | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_profile_delete | 保留 | innerlife_profile_delete | 跨记录或不可逆数据操作，保持明确目标和独立授权 |
| innerlife_digest | 保留 | innerlife_digest | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_share_check | 保留 | innerlife_share_check | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_submit_inbox | 保留 | innerlife_submit_inbox | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_submit_fact | 合并，旧名过渡适配 | innerlife_submit_inbox {"source":"fact"} | 相同投料服务，仅来源类型不同 |
| innerlife_submit_continuity | 合并，旧名过渡适配 | innerlife_submit_inbox {"source":"continuity"} | 相同投料服务，仅来源类型不同 |
| innerlife_pending_shares | 保留 | innerlife_pending_shares | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_share_actions | 保留 | innerlife_share_actions | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_mark_share | 保留 | innerlife_mark_share | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_daemon_status | 合并，旧名过渡适配 | innerlife_status {"detail":"full","section":"daemon"} | 统一诊断读取；旧初始化副作用只留在适配层 |
| innerlife_daemon_set | 保留 | innerlife_daemon_set | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_daemon_tick | 保留 | innerlife_daemon_tick | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_history | 保留 | innerlife_history | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_experiences | 保留 | innerlife_experiences | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_summaries | 保留 | innerlife_summaries | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_explore | 保留 | innerlife_explore | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |
| innerlife_converge | 保留 | innerlife_converge | 会话/生成阶段/投递/后台控制或不同记录类型，未证实为重复 |

新增的两个 canonical 工具为 shared_line_model_adjustment、memoria_label_alias，均已计入 83。验证见 [工程记录](../validation/2026-10-22-mcp-capability-consolidation.md)。
