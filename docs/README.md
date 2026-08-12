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
- [Home Shared Horizon](HOME_SHARED_HORIZON.md): current Home presence and
  performance contract.
- [Trace Page](TRACE_PAGE.md): read-only narrative hierarchy and maintained
  definitions for accumulated statistics.

## Build And Release

- [macOS Packaging](mac-packaging.md): current Full/Lite packaging commands and
  packaged Gateway checks.
- [v0.6.9 Release Notes](RELEASE_NOTES_V0.6.9.md): current signed and notarized
  macOS Apple Silicon Lite GitHub Release.
- [v0.6.7 Release Notes](RELEASE_NOTES_V0.6.7.md): previous signed and notarized
  macOS Apple Silicon Lite GitHub Release.
- [v0.6.5 Release Notes](RELEASE_NOTES_V0.6.5.md): previous signed and notarized
  macOS Apple Silicon Lite GitHub Release.
- [v0.6.4 Release Notes](RELEASE_NOTES_V0.6.4.md): previous GitHub Release for
  macOS Apple Silicon and Windows x64 Full/Lite.
- [v0.5.8 Release Notes](RELEASE_NOTES_V0.5.8.md): previous cross-platform
  public release.

## Versioned Design And Acceptance Records

These documents preserve the decisions and evidence of the version named in
the file. They are not the source of current version or release truth; use
[Version and Branching](VERSION_BRANCHING.md) for that.

- [v0.6.6 Context Budget Plan](V0.6.6_CONTEXT_BUDGET_PLAN.md): MCP interface
  reduction, progressive disclosure, byte budgets, and staged acceptance.
- [v0.6.6 Turn Context Patch](V0.6.6_TURN_CONTEXT_PATCH.md): the single-call
  automatic-context host integration and its v0.6.7 supersession note.
- [v0.6.6 Release Notes](RELEASE_NOTES_V0.6.6.md): unpublished source and local
  package checkpoint.
- [Memory Controller Canary Handoff](MEMORY_CONTROLLER_CANARY_HANDOFF.md):
  authenticated multi-Agent trusted-context boundary and canary evidence.
- [Hermes v0.6.2 Update](HERMES_V0.6.2_UPDATE.md): checkpoint-specific Agent
  reconnect and lifecycle guidance.
- [v0.6.2 Performance Hardening](V0.6.2_PERFORMANCE_HARDENING_PLAN.md),
  [v0.6.1 Performance Plan](V0.6.1_PERFORMANCE_PLAN.md), and
  [v0.6.0 Performance Baseline](PERFORMANCE_BASELINE_V0.6.0.md): measured
  performance history and acceptance evidence.
- [v0.6.0 Memory Controller Plan](V0.6.0_MEMORY_CONTROLLER_PLAN.md): original
  staged retrieval-control plan and safety boundary.

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
