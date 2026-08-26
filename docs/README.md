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

- [v0.6.12 Release Notes](RELEASE_NOTES_V0.6.12.md): current macOS Apple
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
