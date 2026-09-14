# ClaraCore Desktop Documentation

This directory contains current product and engineering contracts. Start here;
documents under `archive/` are historical evidence and are not active
instructions.

## Start Here

- [Positioning](POSITIONING.md): product boundary and north star.
- [Context Delivery](CONTEXT_DELIVERY.md): minimum-sufficient defaults,
  progressive disclosure, bounded explicit reads, and Agent-facing budgets.
- [UI Design Language](UI_DESIGN_LANGUAGE.md): shared product reading order,
  visual restraint, and detail-layer rules.
- [Architecture](ARCHITECTURE.md): runtime, renderer, database, Gateway,
  packaging, validation, and documentation boundaries.
- [Code Map](CODE_MAP.md): shortest source-reading paths by task.
- [Version and Branching](VERSION_BRANCHING.md): current version truth,
  isolated development, checkpoint, and release rules.

## Product Contracts

- [Agent MCP Playbook](AGENT_MCP_PLAYBOOK.md): agent-facing tool workflow.
- [Multi-Agent Clients](MULTI_AGENT_CLIENTS.md): caller identity, session, and
  Shared Line contracts for Codex, Claude, and Hermes.
- [Runtime Memory Policy](RUNTIME_MEMORY_POLICY.md): bounded snapshots,
  pagination, resource ownership, and long-run behavior.
- [Home Shared Horizon](HOME_SHARED_HORIZON.md): current Home presence and
  performance contract.
- [Trace Page](TRACE_PAGE.md): read-only narrative hierarchy and maintained
  definitions for accumulated statistics.

## Build And Release

- [v0.7.0 Development Plan](V0.7.0_DEVELOPMENT_PLAN.md): planned sqlite-vec
  migration and MCP 2026-07-28 integration, with staged acceptance and session handoff.
- [v0.7.7 Release Notes](RELEASE_NOTES_V0.7.7.md): current public Full/Lite release
  for vector retrieval, HTTP migration, verified maintenance and InnerLife grounding.
- [v0.6.14 Release Notes](RELEASE_NOTES_V0.6.14.md): previous public Full/Lite release
  for recovery safety, complete semantic retrieval, and source CI.
- [v0.6.13 Release Notes](RELEASE_NOTES_V0.6.13.md): previous local macOS Lite
  trial checkpoint for memory search and Memoria graph readability.
- [v0.6.12 Release Notes](RELEASE_NOTES_V0.6.12.md): previous public macOS Apple
  Silicon and Windows x64 Full/Lite release, including the Shared Line refresh
  fix, InnerLife share integrity, and installed-app login startup.
- [v0.6.11 Release Notes](RELEASE_NOTES_V0.6.11.md): previous unpublished
  login-startup development checkpoint.
- [v0.6.10 Release Notes](RELEASE_NOTES_V0.6.10.md): previous macOS Apple
  Silicon and Windows x64 Full/Lite release for minimum-sufficient context
  delivery.
- [macOS Packaging](mac-packaging.md): current Full/Lite packaging commands and
  packaged Gateway checks.
- [v0.6.9 Release Notes](RELEASE_NOTES_V0.6.9.md): previous macOS Apple Silicon
  and Windows x64 Full/Lite GitHub Release.

Older release notes, completed handoffs, superseded plans, and historical
performance evidence live under [archive](archive/README.md). They remain
available for traceability but are not active implementation instructions.

## Module Notes

- [Renderer modules](../app/README.md)
- [Runtime](../core/runtime/README.md)
- [Database repositories](../core/db/repositories/README.md)
- [Memoria](../core/memoria/README.md)
- [Continuity / Shared Line](../core/continuity/README.md)
- [InnerLife](../core/innerlife/README.md)
- [Gateway](../core/gateway/README.md)

## Historical Material

See [archive/README.md](archive/README.md) for completed handoffs, superseded
plans, old release notes, and research that is not part of the current product
direction.

- [HTTP MCP 迁移](HTTP_MCP_MIGRATION.md)：0.7.2 接入收敛与内部 CLI 边界。
- [0.7.2 说明](RELEASE_NOTES_V0.7.2.md)：代码、文档及验证范围。
- [0.7.3 数据维护](RELEASE_NOTES_V0.7.3.md)：向量覆盖、每日备份、InnerLife 候选范围和本机维护证据。
- [0.7.4 可配置备份](RELEASE_NOTES_V0.7.4.md)：可选额外目录、七天自动备份保留和清理边界。

- [0.7.5：运行状态与恢复验证](RELEASE_NOTES_V0.7.5.md)

- [0.7.7：InnerLife 旧念头重复与事实边界](RELEASE_NOTES_V0.7.7.md)
- [0.7.6：紧凑运行状态](RELEASE_NOTES_V0.7.6.md)
