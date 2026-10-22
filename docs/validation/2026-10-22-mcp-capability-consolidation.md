# MCP 完整能力整合工程验证

日期：2026-10-22（Asia/Shanghai）。验证层：源码、隔离数据库/文件与真实 HTTP 协议；未发布、安装或执行宿主 UI 操作。

仓库 `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`；分支 `codex/v0.8.0-local-knowledge`；
HEAD 仍为 `3736ae9331fc0f3ecf000b8e33f2074d97b13d55`，本轮及上一阶段均未提交/推送。
任务承接上一阶段 25 项默认目录，用户进一步明确要求整合完整 97 项能力。

实施决策、全部 97 项映射、兼容退出门槛见 [能力整合](../design/2026-10-22-mcp-capability-consolidation.md)，
机器可读映射见 [JSON](../design/2026-10-22-mcp-capability-map.json)。

## 实际结果

| 项目 | 原基线 | 当前源码 |
| --- | ---: | ---: |
| core | 25 项 / 13,663 B | 25 项 / 13,663 B |
| core-compat | 38 项 / 21,260 B | 38 项 / 21,260 B |
| full 现行契约 | 97 项 / 53,697 B | 83 项 / 50,496 B |
| 旧名过渡适配 | 0 | 16 个，不在 full 展示 |
| 可调用名称 | 97 | 99（83 个现行 + 16 个适配） |

B 为同一紧凑 `{tools:[...]}` 序列化方式的 UTF-8 字节。工具数组不含包装时分别为
13,653 / 21,250 / 50,486 B。现行 full 减少 14 项（14.4%）、3,201 B（约 6.0%）。
这不是模型真实加载量或 token 计费测量。16 个旧名仍可调用，不能宣称物理删除，也不能证明 83 是最优数量。

core-compat 工具数组 SHA-256：`8af4c88799c89f448c3ede435c1fc8f67c836504333972318042b60a2fe12240`；
与上一阶段的固定基线一致，包含顺序、描述和 schema。

## 已通过的检查

| 命令 | 证明范围 |
| --- | --- |
| `git diff --check` | 包括原 dirty 工作在内的 diff 无空白错误 |
| `npm run check` | 语法、SQL/IPC、架构、接入/预算、默认工作流、完整能力整合、自动上下文、Understanding、Knowledge、维护与候选池回归；只有内存 DOM，没有宿主 UI |
| `npm run test:gateway` | Memory、工作线、正式 handoff、既有完整工具业务调用、legacy/modern HTTP 与背压 |
| `node core/tests/phase5-innerlife-smoke.js` | 原 InnerLife 生命周期、生成/投递状态与后台流程，没有真实模型调用 |
| `node core/tests/mcp-capability-consolidation-smoke.js` | 新增整合与兼容语义的专项回归，亦已纳入 check |

所有最终运行退出 0。运行时测试使用临时 data/userData 根、测试实例与随机端口，Gateway 在 finally 中停止；没有把测试请求发送到日用 50668。

专项回归的证据：

- 静态核对原 97 个名称全部仍在可调用目录；现行 full 为 83，16 个旧名称均不再展示，且都能找到现行替代。
- 16 个旧名分别在 legacy HTTP 和官方 SDK 实际 modern 协议下执行；回执包含只指明替代工具名的 deprecation metadata。没有复制投料正文或完整输入进 metadata。
- 旧 schema 保存 hash 与基线一致；除扩展 status/audit、修正 pending_shares 默认数量说明三项外，其余保留 schema 与原 97 项基线逐一 hash 相等。默认 25 和兼容 38 的既有预算回归保留。
- 投料 fact/continuity 的来源按原名字固定，传入相反 source 也不改变含义；正文保留。直接集成没有 HTTP 注入 agentId 时，仍写给解析出的 Agent，避免落入默认身份。
- 会话分页/过滤/详情由统一读取承接；分页真值一致。旧列表的 status 精确枚举及错误含义保留，大小写/空白错误不能被整理成有效筛选。新 detailRef 指向现行 status 记录读取。
- 旧 session_get 对不存在记录仍返回明确 error:not found；现行 status 读取不存在记录仍失败；两条路径对外 Agent 的记录都拒绝，不抹成空成功。
- 已存在 profile 而无 daemon 行时，新 doctor/daemon 分区读取后行数仍为 0；旧诊断适配仍能保留其历史初始化行为。旧副作用没有蔓延至新读取。
- Memory 维护各分区与旧报告的非生成时间字段相等，limit/olderThanDays 不变；综合审计仍含原检查与建议。非法 section 显式失败，读取不会执行修复/合并/归档。
- 模型配置和标签别名的新入口与旧名往返一致；缺少/无效 action、必要字段缺失、给读取传入写入字段均失败。旧 get 名即使传 action=delete 也仍执行 get；空 model 的旧 get 保留原 null 行为。
- 未知名称（含对象原型名称 constructor）明确失败，不落入兼容映射。

报告比较只排除 generatedAt/checkedAt 两个生成时刻，不排除业务值、来源、日期范围或记录状态。
本次未执行全部 97 种业务动作逐项实调：所有旧名的可达性由目录/映射静态核对，16 个适配做了双协议实调，其余保留业务由既有回归覆盖。

## 业务含义与失败状态

业务口径一致性检查重点核对来源分类、Agent 归属、会话所有权、报告分区与筛选、配置更新的遗漏字段、只读诊断的初始化差异。
整合时发现并处理了直接投料调用的身份补全、旧空 model 读取的 null、旧会话 status 严格枚举，以及旧诊断初始化等容易被同名/同类型掩盖的差别。
这些差别都有明确保留或新契约说明，没有依赖“执行通过”推断等价，也没有要求用户决定可由原实现确定的行为。

失败状态保真检查保留了非法动作/section 的错误、缺失记录与跨 Agent 拒绝的区别、Knowledge 的 partial/同 token 重试，以及分享投递证据门槛。
Knowledge、Understanding、Memory 替代和分享的原回归继续通过；本轮没有把这些流程合成宽泛写入口。

## 工作区与交付边界

动手前保留了完整源码/dirty 文件快照及 diff；原 1.0.1 InnerLife repository/service、migration 012、候选池、scheduler、package-lock 和未跟踪 CLAUDE.md 保持原字节。
修改原本已 dirty 的共同文件时在原内容上增量调整，未 reset/clean/stash，也未从 HEAD 重建丢弃既有工作。

未新增数据库迁移，未改变工作区原版本，未提交/推送、打包、发布、安装、替换/重启日用 app，未改个人 hooks/客户端配置，未结束真实历史会话。

日用安装版、Claude/Codex 实际已加载目录、个人 hook 的真实后续事件与视觉/交互体验仍待后续明确安排后验收。
兼容退出尚未完成：个人 Codex checkpoint 仍有 submit_continuity 依赖；只有完成授权迁移及退出证据后，才能在明确破坏兼容的版本一并移除适配、旧 schema 和旧测试。
