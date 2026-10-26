// Only wire adapters live here. Domain policies and state transitions belong
// to the canonical handlers. Removal requires the migration gates documented
// in docs/MCP_COMPATIBILITY.md, never a timer.
const LEGACY_TOOL_ROUTES = Object.freeze({
  innerlife_submit_fact: { name: "innerlife_submit_inbox", fixed: { source: "fact" } },
  innerlife_submit_continuity: { name: "innerlife_submit_inbox", fixed: { source: "continuity" } },
  innerlife_sessions: { name: "innerlife_status", fixed: { detail: "full", section: "sessions" }, projection: "sessions" },
  innerlife_session_get: { name: "innerlife_status", fixed: { detail: "full", section: "sessions" }, projection: "session" },
  innerlife_doctor: { name: "innerlife_status", fixed: { detail: "full", section: "doctor" }, projection: "record", legacyDoctor: true },
  innerlife_daemon_status: { name: "innerlife_status", fixed: { detail: "full", section: "daemon" }, projection: "record", initializeDaemon: true },
  memoria_maintenance_check: { name: "memoria_maintenance_audit", fixed: { section: "maintenance" } },
  memoria_merge_suggestions: { name: "memoria_maintenance_audit", fixed: { section: "merge-suggestions" } },
  memoria_archive_suggestions: { name: "memoria_maintenance_audit", fixed: { section: "archive-suggestions" } },
  shared_line_model_adjustment_list: { name: "shared_line_model_adjustment", fixed: { action: "list" } },
  shared_line_model_adjustment_get: { name: "shared_line_model_adjustment", fixed: { action: "get" } },
  shared_line_model_adjustment_set: { name: "shared_line_model_adjustment", fixed: { action: "set" } },
  shared_line_model_adjustment_delete: { name: "shared_line_model_adjustment", fixed: { action: "delete" } },
  memoria_label_alias_list: { name: "memoria_label_alias", fixed: { action: "list" } },
  memoria_label_alias_create: { name: "memoria_label_alias", fixed: { action: "upsert" } },
  memoria_label_alias_delete: { name: "memoria_label_alias", fixed: { action: "delete" } }
});

module.exports = { LEGACY_TOOL_ROUTES };
