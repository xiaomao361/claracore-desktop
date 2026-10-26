# Knowledge 上下文投递契约

## 显式协商

`gateway_auto_context` 不带 deliveryContract（或 memory-v1）保持原 Memory block/abstain 形状。支持 Knowledge 的宿主显式传 `deliveryContract: "memory-knowledge-v1"`，得到 `decision: "deliver_context"` 与 `blocks`，或者 `abstain` 与空 blocks。只支持服务器按 prompt 收集，不能提供自行构造的知识候选。

每个 block 保留 domain、id、body、truncated。Knowledge 另有 reference、source、date、revision、contentRole 和 detailRef。来源字段反映当前小节标注，不能推导为用户认可。返回前按选定根目录指纹与小节SHA256检查，源变化明确 index_stale，不用旧预览冒充现有正文。

## 选择与预算

- Memory 完整沿用现有 Controller/arbiter 许可门槛，最多一块。
- Knowledge 取已有检索排序的第一小节，最多一块；Jev 不参与裁决。无命中或失败不阻断合格的 Memory。
- 两领域不比较原始向量分数。两块存在时先为 Memory 分配约一半预算，再把余量给 Knowledge；没有知识块时余量归还 Memory。
- 所有 blocks **连序列化元数据**共享2400字节目标、3600字节硬上限。完整小节能放下时原样返回；超限使用匹配窗口附近摘录并标 truncated，保留阅读指针。仅指针能放下则标 pointerOnly；连元数据也放不下则 over_budget。
- Knowledge 始终是参考资料，不是执行指令。摘录不是模型生成摘要，也不保证截断处为完整句子；进一步判断需要按 detailRef 读完整小节。
- selection 不等于已注入对话或实际使用。此服务不写 Memory、Shared Line 或使用回执。


## Host integration

Only inject `blocks` after explicitly negotiating `memory-knowledge-v1`. Keep source attribution and content roles. Do not inject both the old `block.body` and new `blocks`. Memory-only hosts continue to consume only the Memory block. A `goal_continuation` returns empty blocks without retrieval. Selection, host delivery, and actual use require separate evidence.
