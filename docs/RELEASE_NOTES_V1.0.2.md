# ClaraCore Desktop 1.0.2 — Local Lite Validation

日期：2026-10-22（Asia/Shanghai）。这是用户请求的本地 macOS Apple Silicon Lite 验证版本，未公开发布。

- 默认 MCP core 从安装版 1.0.1 的 38 项收敛至 25 项；显式 core-compat 保留原 38 项 schema。
- full 的六组能力整合后为 83 项；16 个旧名称改为薄适配，仍可调用。兼容期共 99 个可调用名称，不等于已物理删除旧接口。
- 统一 InnerLife 投料、会话读取、状态诊断、Memory 维护报告、模型配置与标签别名管理。
- 新 doctor/daemon 诊断分区不初始化状态；旧名称仅在兼容层保留其历史行为。
- 保留来源/Agent 归属、会话所有权、报告筛选、事实替代、Knowledge 预览/提交与分享投递证据边界。
- 包含现有 1.0.1 InnerLife 候选池、migration 012 及生命周期修复；本次不增加数据迁移，也不清理历史 active 会话。
- Product、lockfile 和 Agent Guide 对齐 1.0.2；Lite 不包含内置 embedding 模型与生产 node_modules。

逐项变更、保留理由和兼容退出门槛见 [能力整合](design/2026-10-22-mcp-capability-consolidation.md)。
安装包与包内验证证据见 [1.0.2 Lite 本地包](validation/2026-10-22-v1.0.2-lite-package.md)。

本地包沿用 ad-hoc hardened-runtime 签名，不申请 Apple 公证，不上传 GitHub Release。
本轮没有替换/启动日用应用或改客户端配置。安装、重连和真人视觉/交互验收由用户进行；技术测试不代表已通过这些层。

建议安装后重连 MCP，确认默认目录 25 项；需要完整工具时使用 full（83 项），旧 core 兼容目录使用 core-compat（38 项）。
检查一次真实事实读取/更新、工作线续接或知识入库，以及原 hooks 的后续生命周期。已知个人 hook 仍可调用过渡旧名，不需为安装此包先删除兼容配置。
