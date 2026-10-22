# ClaraCore Desktop 1.0.3 — Local Lite Validation

日期：2026-10-22（Asia/Shanghai）。本地 macOS Apple Silicon Lite 验证版本，未公开发布。

- 修复 Memory 维护审计漏掉已有 embedding 记录、状态为 pending 的记忆。
- `counts.pendingEmbeddings` 独立统计 active 且非 restricted 的待处理记忆；与完全缺失、failed 和 stale 分开。
- 维护报告状态为 `ok` / `pending` / `needs_repair`：仅有待处理任务时为 `pending`，综合审计为 `needs_review`，不再误报全部正常；已有修复问题优先为 `needs_repair`。
- pending 表示尚未完成，不证明卡死；未增加超时阈值。provider disabled 时仍显示待处理，不伪造 failed。
- 修复 runtime 维护结果的 `after`：完成实际补算后重新审计，保留批次未完成和失败状态。
- 保留现有凌晨维护和每 15 秒后台队列处理；已有 pending 不被重复入队或重置时间戳。
- 继承 1.0.2 的 core 25 / core-compat 38 / full 83 目录与 16 个过渡旧名适配。无新增数据迁移。

包内验证见 [1.0.3 Lite 验证记录](validation/2026-10-22-v1.0.3-lite-package.md)。
沿用本地 ad-hoc hardened-runtime 签名，不申请 Apple 公证或公开发布。
本轮不安装或重启日用应用；用户安装、真实客户端和视觉/交互验收仍待进行。
