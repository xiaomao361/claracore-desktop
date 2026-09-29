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

## 兼容与验收

宿主只在新协议 decision=deliver_context 时注入 blocks，保留来源和角色。不能同时注入旧 block.body 和新 blocks。goal_continuation 返回空块且不执行检索。当前Codex配置仍明确Memory-only；本轮只实现仓库服务端协议与接入说明，没有修改外部宿主指令。

`knowledge-context-smoke` 覆盖完整小节、双域序列化预算、长小节命中尾部摘录、过期拒绝、零结果、旧协议和goal兼容。`knowledge-gateway-http-smoke` 经真实认证临时HTTP MCP取得新协议知识正文，验证来源指针与数据库trace不保存正文。HCT-2026-09-08-01/02：源变化可区分、独立Memory可继续，检索/选中/投递/使用证据分开。

这些检查证明源码与临时服务返回协议，不代表当前安装版或实际宿主已经注入知识。后续接入宿主时必须更新其消费约定，并用有来源的小节完成实际对话验收。

## 0.8.1 宿主接入边界

服务端协议及临时认证 HTTP MCP 回归继续有效。当前 Codex 的宿主级指令仍要求每用户轮只消费 Memory block；Desktop 仓库不能覆盖这个指令，也没有在 0.8.1 中自动开启知识投递。宿主维护方改为协商 memory-knowledge-v1 后，需用同一真实问题核对：返回 blocks 的来源小节、宿主实际注入内容、回答的明确引用；无结果、索引过期和 Memory-only 兼容路径分别验收。任何自动回召选中都不作为使用回执。Jev 保持 query-only shadow。
