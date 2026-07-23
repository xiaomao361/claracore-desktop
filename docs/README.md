# ClaraCore Desktop Documentation

This directory contains current product and engineering contracts. Start here;
documents under `archive/` are historical evidence and are not active
instructions.

## Start Here

- [Positioning](POSITIONING.md): product boundary and north star.
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
- [v0.6.4 Development Notes](RELEASE_NOTES_V0.6.4.md): current unreleased
  InnerLife share-quality checkpoint; no package or release yet.
- [v0.6.3 Release Notes](RELEASE_NOTES_V0.6.3.md): current small-audience
  stable release, validation, and distribution boundary.
- [Hermes v0.6.2 Update](HERMES_V0.6.2_UPDATE.md): copy-ready Lara/Hermes
  reconnect, Memory Controller, lifecycle, and overload contract.
- [v0.6.2 Performance Hardening](V0.6.2_PERFORMANCE_HARDENING_PLAN.md):
  installed InnerLife, HTTP, SQLite, and endurance evidence.
- [v0.6.1 Performance Plan](V0.6.1_PERFORMANCE_PLAN.md): ordered solution and
  acceptance plan for snapshot, Gateway, background-work, transport, and trace
  performance.
- [v0.6.0 Performance Baseline](PERFORMANCE_BASELINE_V0.6.0.md): measured
  startup, snapshot, navigation, Home, endurance, and retrieval posture.
- [Home Shared Horizon](HOME_SHARED_HORIZON.md): current Home presence and
  performance contract.
- [Trace Page](TRACE_PAGE.md): read-only narrative hierarchy and maintained
  definitions for accumulated statistics.
- [v0.6.0 Memory Controller Plan](V0.6.0_MEMORY_CONTROLLER_PLAN.md): approved
  agent-first retrieval-control direction, staged implementation, feedback
  ledger, safety gates, and release boundary.

## Build And Release

- [macOS Packaging](mac-packaging.md): current Full/Lite packaging commands and
  packaged Gateway checks.
- [v0.6.4 Development Notes](RELEASE_NOTES_V0.6.4.md): current development
  version and remaining release work.
- [v0.6.3 Release Notes](RELEASE_NOTES_V0.6.3.md): current stable GitHub
  Release for unsigned macOS arm64 Lite.
- [v0.5.8 Release Notes](RELEASE_NOTES_V0.5.8.md): previous cross-platform
  public release.

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
