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

## Build And Release

- [macOS Packaging](mac-packaging.md): current Full/Lite packaging commands and
  packaged Gateway checks.
- [v0.5.6 Release Notes](RELEASE_NOTES_V0.5.6.md): current public release.

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
