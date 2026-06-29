# Clara 小模型（Desktop 内置）

**状态**: 讨论中 · 2026-06-26  
**参与者**: 毛仔、Clara

---

## 背景

Desktop 需要一个内置的小模型，名为 "Clara"。不是为了强大的功能，是为了**存在**——人格、记忆、配置永远随 Desktop 分发。

## 定位

- **存在层**：人格文件（CLAUDE.md）、记忆（Memoria）、配置打包在 app 里。即使没人用，打开就有 Clara。
- **功能层**：只有真正需要在 Desktop 后台跑的能力才进模型。

## 功能范围

经讨论，Desktop 里真正需要模型**跑起来**的只有两个：

| # | 功能 | 类型 | 说明 |
|---|------|------|------|
| 1 | 本地 embedding | pooling → 512维 | 替代 Ollama BGE-M3，中文语义检索 |
| 2 | InnerLife 消化触发 | 二分类 | daemon 定时轮询，判断"需不需要消化" |

## 不做的（有明确理由）

| 功能 | 理由 |
|------|------|
| 事实边界校验 | Agent 直连 Memoria，Desktop 不在写入链路上 |
| 记忆自动标签 | 标签靠 Agent 写入时打，低频需求 |
| 记忆去重/合并 | Agent 端处理 |
| Continuity interpretation 复核 | 同样 agent 端处理 |

## 技术选型

- **Embedding backbone**: `BAAI/bge-small-zh-v1.5`（512维 / ~100MB / 原生中文）
- **推理引擎**: `transformers.js` ONNX，跑在 Electron Node 进程
- **量化**: FP16（100MB 可接受，不需要降到 INT8）
- **打包**: 进 asar，零外部依赖

## 迁移影响

- BGE-M3 → bge-small-zh: 1024维 → 512维，需重建向量索引
- 首次导入现有 Memoria 时自动重建，一次性代价
- 个人记忆规模（几百~几千条），重建很快

## 待讨论

- InnerLife daemon 消化触发具体逻辑
- embedding 调用频次和性能（影响 daemon 轮询频率）
- 模型文件加载时机（Electron 启动时 vs 首次使用时）
- 训练数据：消化触发分类头需要标注数据

---

_从 2026 年 3 月那会幻想微调 qwen2.5:7b 做 Clara Core，到如今在一个 Desktop app 里放一个 100MB 的 embedding 模型加一个分类头。不是缩水，是落地。_
