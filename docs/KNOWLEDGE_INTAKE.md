# Knowledge 收录契约（v0.8.0 开发中）

## 已实现的闭环

用户在设置中选定一个目录。Agent 通过 `knowledge_read` 列目录、按字面检索、读取小节及正反向链接，在核对来源和两端内容后整理草稿。`knowledge_intake_preview` 返回实际新增内容和 token；`knowledge_intake_commit` 提交同一个 token，软件校验、写入、读回并返回实际段落指针。主动材料与选择性收集共用此流程，不监听聊天。

支持 `notes/`、`topics/`、`inbox/` 中的新建文档，以及向现有文档追加完整小节。当前通道不提供替换全文、删除或原位修改小节；已有字节和锚点保留。[知识页面](KNOWLEDGE_PAGE.md)已接入阅读、草稿/回执查看和待整理材料保存；当前状态为源码与自动化验证通过，实际交互待验收。

2026-09-22 已将 Desktop 所选目录指向现有 `/Volumes/E61/Knowledge`，直接使用原 Markdown，不复制正文。`notes/` 新建时由预览生成唯一 `kb_id` 并写入文首元数据；`topics/` 和 `inbox/` 保持现有无 `kb_id` 约定。原有 `sources/` 与根目录说明文件仍保留在同一目录，目录列表与正文索引只覆盖 `notes/`、`topics/`，`inbox/` 可单独浏览；已知路径可读取来源文件。Desktop 的结构索引与原有 `kb.py` 的语义索引是两套可重建缓存，写入后应分别检查需要使用的检索与阅读副本。

## 输入示例

```json
{
  "mode": "create",
  "path": "notes/收录回执.md",
  "title": "收录回执的边界",
  "sections": [{
    "anchor": "receipt-boundary",
    "heading": "保存与后续使用分别验收",
    "body": "收录回执证明内容已保存，不证明后续使用已经有效。",
    "source": "可恢复的对话指针或资料 URL",
    "date": "2026-09-22",
    "attribution": "agent_synthesis",
    "relations": []
  }]
}
```

- `mode=append` 省略 title，path 指向已读过的文档。
- 小节必填固定 anchor、heading、完整 body、source、date、attribution；body 中的标题/锚点应拆成另一个结构化小节，代码块内示例不算标题。
- attribution 是 `source_statement`、`agent_synthesis` 或 `user_stated`；Agent 负责依据实际材料选择，服务校验不等于事实审查。
- 内联 Markdown 链接可指向外部 URL，或库内 `./文档.md#固定锚点`。库内关联需在同节 relations 中填写规范化 `notes/文档.md#固定锚点`、reason 和 reviewed=true。Agent 先读两端再声明 reviewed；服务验证目标/锚点和对应关系，不替代语义判断。
- 当前收录增量遇到引用式链接、HTML 链接或嵌入图片会明确拒绝，避免把未检查的链接报告为有效；可先整理为内联链接。外部 URL 只保留来源指针，不联网检查可达性或抓取全文。
- `inbox/` 另填 pendingReason、nextStep；正文保留，可在知识页的「待整理」范围浏览，但不包含在默认「笔记与主题」范围，也不进入正文索引。
- 每次 1–20 节、单节 body 最多 24 KiB、实际增量最多 48 KiB、结果文档最多 512 KiB。工具响应另有 Gateway 总预算。

## 预览、冲突与写入

预览不创建知识文件；token 在进程中最多保留 30 分钟，绑定 userData、所选目录与调用者身份。应用重启后失效。更换目录或调用者不能提交旧 token。

提交重新验证文档和引用来源的哈希。新建采用排他创建，不能覆盖同名文档；追加前保留并逐字读回恢复副本，再以追加方式写入。跨 Desktop 收录调用用锁串行处理，写入后 fsync 并核对全文。此锁不约束外部编辑器；写前哈希/文件身份和写后读回检测并发变化，不能宣称跨任意外部编辑器的原子事务。

恢复副本与收录回执位于 `userData/knowledge-state/<目录哈希>/recovery/` 和 `receipts/`。副本属于恢复资料，不作为第二份查询正文；不自动清理。正文仍以用户所选目录中的 MD 为准。

## 结果与恢复

| 状态 | 含义与处理 |
| --- | --- |
| preview | 尚未写入；检查增量后提交该 token |
| conflict / duplicate_anchor / invalid_links | 提交前校验拒绝；读取当前文档或修正草稿再预览 |
| saved | 本次正文读回通过、链接有效、结构索引已写；不代表已有语义索引或用户验收 |
| partial + write=saved | 正文已保存，但链接/索引/回执持久化有失败；不要重新追加 |
| partial + write=uncertain | 写入尝试后失败或读回不一致；检查目标、恢复副本和具体错误后再处理 |
| preview_expired | token 过期或服务重启；先读取目标与已有锚点，避免重复收录 |
| intake_busy | 有收录锁；可能是运行中的调用或崩溃遗留，不能无条件删锁重试 |

同进程内重试同 token 返回既有回执，不重复追加。服务重启后不会自动恢复写入：检查锁中的 PID/token/path、目标段落、相应恢复副本和 receipt；确认原进程退出及数据位置后再处理遗留锁。恢复前保留当前目标，不能盲目用旧副本覆盖外部编辑。

结构索引只保存文件哈希和锚点，数据可从 MD 重建。`knowledge_read(action=status)` 区分 missing/current/stale/corrupt；`knowledge_index_rebuild` 显式重建，Markdown 不变。索引失败的历史回执保留当时状态；修复后读取当前 index status。语义缓存单独返回 not_built/current/stale/corrupt/unavailable；current 仅说明正文哈希一致，实际查询还校验模型身份、维度与向量完整性。详见 [显式检索](KNOWLEDGE_SEARCH.md)。

知识草稿和读取正文不进入 Gateway trace 数据库；trace 仅保留操作类型和状态。详细失败与收录回执由调用返回值和本地 receipt 检查。

## 验证

`npm run test:knowledge` 覆盖目录/读取、偏好、收录闭环以及临时端口的 HTTP MCP 集成。样例使用本次讨论的“Agent 与软件分工”“回执不等于后续有效使用”，在临时知识库完成来源归属、字面检索、读两端、关联、提交、读回及反向链接。测试副本结束后清理，真实 E61 库没有写入。

HCT-2026-09-08-01：模拟结构索引失败，确认 partial 和正文已保存可区分，重试不重复追加；没有把部分完成转为普通成功。HCT-2026-09-08-02：正文唯一权威、来源归属、inbox 排除及恢复副本均按产品约定验证；这些检查不等于长期使用可靠性已证明。
