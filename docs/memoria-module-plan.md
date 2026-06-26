# Desktop Memory Module Plan

## Goal

Desktop Memory is the product-owned Memoria module inside ClaraCore Desktop.

The reference implementation is `/Users/zhouwei/Documents/ClaraCore/services/memoria`, but Desktop must not depend on that service at runtime. Existing Memoria data is a migration source, not the live product database.

The primary operator is the agent. Human UI is for visibility, light correction, and high-risk data operations such as import, export, backup, and restore.

## Target Capability

Agent-facing surfaces must cover the complete Memory capability set:

- CLI fallback for local agent workflows.
- Desktop-owned MCP tools through `core/gateway/mcp-server.js`.
- Memory create, recall/search, get, update, delete, restore, archive, label, stats, graph, export/import, and maintenance.
- Structured records add/query/summary.
- Safe restricted-content handling through explicit tools and UI sections.

Human UI should cover the old Memoria Web UI's useful viewing and light-operation workflows:

- Overview and counts.
- Search and recent memories.
- Labels and aliases.
- Memory graph.
- Active, restricted, deleted, and archived lists.
- Structured records.
- Maintenance, merge suggestions, archive suggestions.
- Import/export and backup entry points.

## Safety Boundary

- Do not mutate existing `~/.claracore/memoria` during product-core work.
- Use Desktop's isolated product data root and `claracore.db`.
- Old Memoria data must enter through read-only preview plus backup-gated copy import.
- Keep Memoria as observable facts and records. Current-position interpretation belongs to Shared Line / Continuity.

## Development Sequence

1. Add Desktop-owned Memory CLI backed by the product database.
2. Align Desktop MCP names and coverage with the Memoria source surface.
3. Fill product-core gaps where Desktop is weaker than `services/memoria`, especially structured records and maintenance.
4. Bring the Memory UI to old Web UI parity for viewing and light correction.
5. Improve migration fidelity from old Memoria only after product contracts are stable.

## Source Comparison Notes

The source Memoria records contract in `services/memoria` uses a separate `records` table for high-frequency event streams. Records have `user_id`, `record_type`, timezone-aware `occurred_at`, derived `local_date`, `timezone`, `schema_version`, optional `note`, source metadata, and `dedupe_key`.

Important behavioral boundary: records do not enter long-term memory storage or normal recall. Agents query and summarize them through record-specific tools.

Desktop now mirrors the first useful slice of that contract:

- The Desktop structured records table has user, local date, timezone, schema version, note, source agent/run, and dedupe fields.
- CLI can add/query/summarize records by user, type, local date, and time range.
- MCP exposes `memoria_record_create`, `memoria_record_list`, `memoria_record_summary`, and `memoria_record_stats`.
- Backup/export includes the structured record fields.

Remaining parity gaps:

- Agent-facing MCP and CLI names now use `memoria`.
- Generic structured record schemas are still broad outside `fitness` v1.
- UI parity for structured records is still pending.

## Current First Step

Implemented a focused CLI:

```bash
npm run memoria -- store --body "fact" --labels codex
npm run memoria -- recall --query "fact"
npm run memoria -- get --id <memoria_id>
npm run memoria -- update --id <memoria_id> --body "updated" --labels codex
npm run memoria -- delete --id <memoria_id>
npm run memoria -- restore --id <memoria_id>
npm run memoria -- record add --user-id local-user --type fitness --occurred-at "2026-06-20T20:00:00+08:00" --timezone Asia/Shanghai --dedupe-key fitness-2026-06-20 --data '{"activity":"步行","steps":10000,"duration_minutes":60}'
npm run memoria -- record query --user-id local-user --type fitness --local-date 2026-06-20
npm run memoria -- record summary --user-id local-user --type fitness
```

Targeted validation:

```bash
npm run check
npm run test:memoria:cli
node core/tests/phase2-gateway-smoke.js
PYTHONPATH=/Users/zhouwei/Documents/ClaraCore/services/memoria python3 /Users/zhouwei/Documents/ClaraCore/services/memoria/tests/test_records.py
```
