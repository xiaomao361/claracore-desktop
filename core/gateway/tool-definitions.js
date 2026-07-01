function toolDefinitions() {
  return [
    {
      name: "claracore_status",
      title: "ClaraCore Status",
      description: "Read ClaraCore Desktop product data status.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "claracore_connection_test",
      title: "ClaraCore Connection Test",
      description: "Verify that this agent can reach ClaraCore Desktop through MCP and record a visible handshake trace.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            description: "Stable id for the calling agent, for example clara, lara, or codex."
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "gateway_docs",
      title: "Gateway Docs",
      description: "Read agent-facing ClaraCore Desktop Gateway setup and fallback notes.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "gateway_context",
      title: "Gateway Context",
      description: "Read one assembled agent context packet from Memory, Shared Line, InnerLife, and Doctor.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          lineId: { type: "string" },
          query: { type: "string" },
          limit: {
            type: "number",
            minimum: 1,
            maximum: 20
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "gateway_trace_list",
      title: "Gateway Trace List",
      description: "List recent ClaraCore Desktop Gateway tool-call traces.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            minimum: 1,
            maximum: 100
          },
          toolName: { type: "string" },
          status: { type: "string", enum: ["ok", "error"] }
        },
        additionalProperties: false
      }
    },
    {
      name: "agent_identity_merge",
      title: "Merge Agent Identity",
      description: "Merge one ClaraCore Desktop agent id into another across Desktop-owned data. Use this instead of editing SQLite directly.",
      inputSchema: {
        type: "object",
        required: ["fromAgentId", "toAgentId", "confirm"],
        properties: {
          fromAgentId: {
            type: "string",
            description: "Existing source agent id to retire, for example hermes:lara."
          },
          toAgentId: {
            type: "string",
            description: "Canonical target agent id to keep, for example lara or hermes:lara."
          },
          confirm: {
            type: "boolean",
            description: "Must be true because this updates many Desktop-owned records."
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_list",
      title: "List Memories",
      description: "List recent ClaraCore Desktop memory records.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            minimum: 1,
            maximum: 100
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_search",
      title: "Search Memories",
      description: "Search ClaraCore Desktop memory records with keyword and vector search when available.",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string"
          },
          limit: {
            type: "number",
            minimum: 1,
            maximum: 100
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_get",
      title: "Get Memory",
      description: "Get one ClaraCore Desktop memory record by id, including labels, status, sensitivity, and embedding state.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_create",
      title: "Create Memory",
      description: "Create a ClaraCore Desktop memory record. Use factual, reviewable content.",
      inputSchema: {
        type: "object",
        required: ["body"],
        properties: {
          title: {
            type: "string"
          },
          body: {
            type: "string"
          },
          labels: {
            oneOf: [
              {
                type: "string"
              },
              {
                type: "array",
                items: {
                  type: "string"
                }
              }
            ]
          },
          sensitivity: {
            type: "string",
            enum: ["normal", "restricted"]
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_update",
      title: "Update Memory",
      description: "Update an existing ClaraCore Desktop memory record.",
      inputSchema: {
        type: "object",
        required: ["id", "body"],
        properties: {
          id: {
            type: "string"
          },
          title: {
            type: "string"
          },
          body: {
            type: "string"
          },
          labels: {
            oneOf: [
              {
                type: "string"
              },
              {
                type: "array",
                items: {
                  type: "string"
                }
              }
            ]
          },
          sensitivity: {
            type: "string",
            enum: ["normal", "restricted"]
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_tag",
      title: "Tag Memory",
      description: "Incrementally add or remove labels on an active ClaraCore Desktop memory record.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string"
          },
          add: {
            oneOf: [
              { type: "string" },
              {
                type: "array",
                items: { type: "string" }
              }
            ]
          },
          remove: {
            oneOf: [
              { type: "string" },
              {
                type: "array",
                items: { type: "string" }
              }
            ]
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_restricted_list",
      title: "List Restricted Memories",
      description: "List restricted ClaraCore Desktop memory records through an explicit restricted-content tool.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            minimum: 1,
            maximum: 100
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_restrict",
      title: "Restrict Memory",
      description: "Move an active ClaraCore Desktop memory record out of normal list/search results.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_unrestrict",
      title: "Unrestrict Memory",
      description: "Restore a restricted ClaraCore Desktop memory record to normal list/search results.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_delete",
      title: "Delete Memory",
      description: "Soft-delete a ClaraCore Desktop memory record.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_restore",
      title: "Restore Memory",
      description: "Restore a soft-deleted ClaraCore Desktop memory record.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_archive",
      title: "Archive Memory",
      description: "Archive an active ClaraCore Desktop memory record so it leaves normal list/search results without being deleted.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_archived_list",
      title: "List Archived Memories",
      description: "List archived ClaraCore Desktop memory records.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            minimum: 1,
            maximum: 100
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_restore_archived",
      title: "Restore Archived Memory",
      description: "Restore an archived ClaraCore Desktop memory record to active status.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_archive_suggestions",
      title: "Memory Archive Suggestions",
      description: "List dormant active non-restricted Memory records that are candidates for archive.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            minimum: 1,
            maximum: 50
          },
          olderThanDays: {
            type: "number",
            minimum: 1,
            maximum: 3650
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_archive_dormant",
      title: "Archive Dormant Memories",
      description: "Archive dormant active non-restricted Memory records from the suggestion list.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            minimum: 1,
            maximum: 50
          },
          olderThanDays: {
            type: "number",
            minimum: 1,
            maximum: 3650
          },
          dryRun: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_stats",
      title: "Memory Stats",
      description: "Read ClaraCore Desktop memory counts, embedding status counts, and active label counts.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "memoria_graph",
      title: "Memory Graph",
      description: "Read a bounded ClaraCore Desktop Memory graph of memories, labels, and Shared Line fact references.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            minimum: 1,
            maximum: 100
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_maintenance_check",
      title: "Memory Maintenance Check",
      description: "Check ClaraCore Desktop Memory maintenance issues such as missing embeddings, failed embeddings, orphan labels, and alias labels.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "memoria_maintenance_run",
      title: "Run Memory Maintenance",
      description: "Repair ClaraCore Desktop Memory maintenance issues without touching old service data.",
      inputSchema: {
        type: "object",
        properties: {
          dryRun: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_maintenance_audit",
      title: "Memory Maintenance Audit",
      description: "Read a review-oriented Memory audit report with maintenance issues, merge/archive candidates, failed embeddings, duplicate titles, and label aliases.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            minimum: 1,
            maximum: 50
          },
          olderThanDays: {
            type: "number",
            minimum: 1,
            maximum: 3650
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_export",
      title: "Export Memory JSON",
      description: "Export ClaraCore Desktop Memory data to a portable JSON file without creating a full database backup.",
      inputSchema: {
        type: "object",
        properties: {
          targetPath: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_import",
      title: "Import Memory JSON",
      description: "Import a ClaraCore Desktop Memory JSON file by adding missing records and skipping existing IDs.",
      inputSchema: {
        type: "object",
        required: ["filePath"],
        properties: {
          filePath: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_merge_suggestions",
      title: "Memory Merge Suggestions",
      description: "List conservative merge suggestions for active non-restricted ClaraCore Desktop Memory records.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            minimum: 1,
            maximum: 50
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_merge",
      title: "Merge Memories",
      description: "Merge a source Memory into a target Memory, keep the target, and soft-delete the source.",
      inputSchema: {
        type: "object",
        required: ["targetId", "sourceId"],
        properties: {
          targetId: {
            type: "string"
          },
          sourceId: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_label_alias_list",
      title: "List Memory Label Aliases",
      description: "List ClaraCore Desktop Memory label aliases.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "memoria_label_alias_create",
      title: "Create Memory Label Alias",
      description: "Create or update a Memory label alias and merge existing alias labels into the canonical label.",
      inputSchema: {
        type: "object",
        required: ["alias", "canonicalLabel"],
        properties: {
          alias: { type: "string" },
          canonicalLabel: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_label_alias_delete",
      title: "Delete Memory Label Alias",
      description: "Delete a Memory label alias without deleting existing Memory labels.",
      inputSchema: {
        type: "object",
        required: ["alias"],
        properties: {
          alias: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_record_create",
      title: "Create Structured Memory Record",
      description: "Create a typed ClaraCore Desktop structured memory record such as a fitness, metric, or recurring log entry.",
      inputSchema: {
        type: "object",
        required: ["recordType"],
        properties: {
          userId: { type: "string" },
          recordType: { type: "string" },
          title: { type: "string" },
          value: {
            type: "object",
            additionalProperties: true
          },
          occurredAt: { type: "string" },
          timezone: { type: "string" },
          schemaVersion: { type: "number" },
          note: { type: "string" },
          source: { type: "string" },
          sourceAgent: { type: "string" },
          sourceRunId: { type: "string" },
          dedupeKey: { type: "string" },
          metadata: {
            type: "object",
            additionalProperties: true
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_record_list",
      title: "List Structured Memory Records",
      description: "List typed ClaraCore Desktop structured memory records.",
      inputSchema: {
        type: "object",
        properties: {
          userId: { type: "string" },
          recordType: { type: "string" },
          localDate: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          limit: {
            type: "number",
            minimum: 1,
            maximum: 100
          },
          offset: {
            type: "number",
            minimum: 0
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_record_summary",
      title: "Structured Memory Record Summary",
      description: "Summarize fitness structured memory records by user, date, or time range.",
      inputSchema: {
        type: "object",
        properties: {
          userId: { type: "string" },
          recordType: { type: "string" },
          localDate: { type: "string" },
          start: { type: "string" },
          end: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "memoria_record_stats",
      title: "Structured Memory Record Stats",
      description: "Read structured Memory record counts by type.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "shared_line_get",
      title: "Get Shared Line",
      description: "Read the current ClaraCore Desktop shared position and resume packet. By default the affective trace and position history are truncated to the most recent nodes plus protected (needs-review) nodes; pass fullArc to get the complete arc.",
      inputSchema: {
        type: "object",
        properties: {
          lineId: { type: "string" },
          agentId: { type: "string" },
          model: { type: "string" },
          fullArc: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_list",
      title: "List Shared Lines",
      description: "List ClaraCore Desktop Shared Lines and identify the active line.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          allAgents: { type: "boolean" },
          limit: { type: "integer", minimum: 1, maximum: 100 }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_create",
      title: "Create Shared Line",
      description: "Create a new ClaraCore Desktop Shared Line and optionally make it active.",
      inputSchema: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          agentId: { type: "string" },
          makeActive: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_activate",
      title: "Activate Shared Line",
      description: "Switch the active ClaraCore Desktop Shared Line.",
      inputSchema: {
        type: "object",
        required: ["lineId"],
        properties: {
          lineId: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_rename",
      title: "Rename Shared Line",
      description: "Rename an active ClaraCore Desktop Shared Line.",
      inputSchema: {
        type: "object",
        required: ["lineId", "title"],
        properties: {
          lineId: { type: "string" },
          title: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_archive",
      title: "Archive Shared Line",
      description: "Archive an active ClaraCore Desktop Shared Line without deleting its history.",
      inputSchema: {
        type: "object",
        required: ["lineId"],
        properties: {
          lineId: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_restore",
      title: "Restore Shared Line",
      description: "Restore an archived ClaraCore Desktop Shared Line.",
      inputSchema: {
        type: "object",
        required: ["lineId"],
        properties: {
          lineId: { type: "string" },
          makeActive: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_update",
      title: "Update Shared Line",
      description: "Update the current ClaraCore Desktop shared position.",
      inputSchema: {
        type: "object",
        required: ["summary"],
        properties: {
          agentId: { type: "string" },
          allAgents: { type: "boolean" },
          summary: {
            type: "string"
          },
          lineId: {
            type: "string"
          },
          model: { type: "string" },
          interpretationStatus: {
            type: "string",
            enum: ["draft", "confirmed", "active", "needs_review", "stale", "closed"]
          },
          factsUsed: {
            type: "array",
            items: {
              type: "string"
            }
          },
          visibility: { type: "string", enum: ["private", "shared"] },
          mode: { type: "string" },
          nextStep: { type: "string" },
          stateSummary: { type: "string" },
          currentInterpretation: { type: "string" },
          userConfirmed: { type: "boolean" },
          realityLine: { type: "string" },
          entryPosture: { type: "string" },
          confirmedGround: { type: "string" },
          provisionalRead: { type: "string" },
          boundaryNotes: { type: "string" },
          misreadRisks: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" }
          },
          affectiveTone: { type: "string" },
          affectiveValence: { type: "string", enum: ["positive", "negative", "mixed", "neutral", "unclear"] },
          affectiveSignals: {
            type: "array",
            items: { type: "string" }
          },
          affectiveIntensity: { type: "string", enum: ["low", "medium", "high"] },
          affectiveStability: { type: "string", enum: ["momentary", "session", "confirmed"] },
          affectiveNote: { type: "string" },
          affectiveNeedsReview: { type: "boolean" },
          confirmOverwrite: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_handoff_create",
      title: "Create Shared Line Handoff",
      description: "Create a formal handoff record from the current ClaraCore Desktop shared position.",
      inputSchema: {
        type: "object",
        properties: {
          lineId: {
            type: "string"
          },
          objective: {
            type: "string"
          },
          completed: {
            type: "array",
            items: {
              type: "string"
            }
          },
          openItems: {
            type: "array",
            items: {
              type: "string"
            }
          },
          nextStep: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_agent_state",
      title: "Shared Line Agent State",
      description: "Read or update Continuity agent state for communication style, relationship position, preferences, boundaries, and stable patterns.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          update: {
            type: "object",
            properties: {
              communicationStyle: { type: "string" },
              relationshipPosition: { type: "string" },
              longTermPreferences: { type: "array", items: { type: "string" } },
              boundaries: { type: "array", items: { type: "string" } },
              stablePatterns: { type: "array", items: { type: "string" } },
              notes: { type: "string" }
            },
            additionalProperties: false
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_model_adjustment_list",
      title: "List Shared Line Model Adjustments",
      description: "List model-specific negative adjustments used in Shared Line resume packets.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }
    },
    {
      name: "shared_line_model_adjustment_get",
      title: "Get Shared Line Model Adjustment",
      description: "Read model-specific negative adjustments for one model.",
      inputSchema: {
        type: "object",
        required: ["model"],
        properties: { model: { type: "string" } },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_model_adjustment_set",
      title: "Set Shared Line Model Adjustment",
      description: "Create or update model-specific negative adjustments used in Shared Line resume packets.",
      inputSchema: {
        type: "object",
        required: ["model"],
        properties: {
          model: { type: "string" },
          forbiddenPhrases: { type: "array", items: { type: "string" } },
          forbiddenPatterns: { type: "array", items: { type: "string" } },
          injectPrompt: { type: "string" },
          updatedBy: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_model_adjustment_delete",
      title: "Delete Shared Line Model Adjustment",
      description: "Delete model-specific negative adjustments.",
      inputSchema: {
        type: "object",
        required: ["model"],
        properties: { model: { type: "string" } },
        additionalProperties: false
      }
    },
    {
      name: "shared_line_compact",
      title: "Compact Shared Line Arc",
      description: "Compact a ClaraCore Desktop Shared Line by trimming its stored affective trace and position history to the most recent nodes. Protected needs-review affective nodes are always kept. Summary, interpretation status, history, and snapshots are not touched.",
      inputSchema: {
        type: "object",
        properties: {
          lineId: { type: "string" },
          keepTrace: { type: "integer", minimum: 0, maximum: 200 },
          keepHistory: { type: "integer", minimum: 0, maximum: 200 }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_session_start",
      title: "Start InnerLife Session",
      description: "Start a Desktop-owned InnerLife session and return a compact share_plan plus session id. Fetch innerlife_briefing lazily for full context.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          userId: { type: "string" },
          host: { type: "string" },
          externalSessionId: { type: "string" },
          includeBriefing: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_session_end",
      title: "End InnerLife Session",
      description: "End a Desktop-owned InnerLife session and create a waiting share afterthought.",
      inputSchema: {
        type: "object",
        required: ["sessionId"],
        properties: {
          sessionId: { type: "string" },
          summary: { type: "string" },
          transcript: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_sessions",
      title: "List InnerLife Sessions",
      description: "List recent Desktop-owned InnerLife sessions.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 100 }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_status",
      title: "InnerLife Status",
      description: "Read the Desktop-owned InnerLife snapshot, including inbox, shares, sessions, daemon, and doctor.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "innerlife_briefing",
      title: "Get InnerLife Briefing",
      description: "Read the current Desktop-owned InnerLife briefing.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_doctor",
      title: "InnerLife Doctor",
      description: "Diagnose Desktop-owned InnerLife health and recovery guidance.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_profile_set",
      title: "Set InnerLife Profile",
      description: "Update the calling agent's Desktop-owned InnerLife profile, state, focus, and sharing policy.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          displayName: { type: "string" },
          profile: { type: "object" },
          state: { type: "object" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_profile_list",
      title: "List InnerLife Profiles",
      description: "List Desktop-owned InnerLife agent profiles.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 200 }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_profile_delete",
      title: "Delete InnerLife Profile",
      description: "Delete one agent's Desktop-owned InnerLife profile and all InnerLife data for that agent.",
      inputSchema: {
        type: "object",
        required: ["agentId"],
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_digest",
      title: "Run InnerLife Digest",
      description: "Run a Desktop-owned InnerLife digest and record what was digested.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          mode: { type: "string" },
          prompt: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_share_check",
      title: "Check InnerLife Share Timing",
      description: "Check whether a waiting InnerLife share fits the current context.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          shareId: { type: "string" },
          sessionId: { type: "string" },
          context: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_submit_inbox",
      title: "Submit InnerLife Inbox",
      description: "Submit material into the Desktop-owned InnerLife inbox for autonomous processing.",
      inputSchema: {
        type: "object",
        required: ["body"],
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          source: { type: "string" },
          body: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_submit_fact",
      title: "Submit InnerLife Fact",
      description: "Submit factual material into the Desktop-owned InnerLife inbox for later digestion.",
      inputSchema: {
        type: "object",
        required: ["body"],
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          body: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_submit_continuity",
      title: "Submit InnerLife Continuity",
      description: "Submit current Shared Line material into the Desktop-owned InnerLife inbox for later digestion.",
      inputSchema: {
        type: "object",
        required: ["body"],
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          body: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_pending_shares",
      title: "List InnerLife Pending Shares",
      description: "List Desktop-owned InnerLife share candidates.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 100 }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_share_actions",
      title: "List InnerLife Share Actions",
      description: "List review, use, defer, and discard actions for InnerLife shares.",
      inputSchema: {
        type: "object",
        properties: {
          shareId: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 100 }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_mark_share",
      title: "Mark InnerLife Share",
      description: "Mark an InnerLife share as used, deferred, or discarded.",
      inputSchema: {
        type: "object",
        required: ["id", "action"],
        properties: {
          id: { type: "string" },
          action: { type: "string", enum: ["used", "deferred", "discarded"] },
          reason: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_daemon_status",
      title: "InnerLife Daemon Status",
      description: "Read the Desktop-owned InnerLife daemon state.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_daemon_set",
      title: "Set InnerLife Daemon",
      description: "Enable or pause the Desktop-owned InnerLife daemon.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          action: { type: "string", enum: ["enable", "pause"] },
          enabled: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_daemon_tick",
      title: "Tick InnerLife Daemon",
      description: "Run one due InnerLife daemon tick and create a waiting share when material is ready.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          force: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_history",
      title: "InnerLife History",
      description: "List recent Desktop-owned InnerLife internal change events (digest, explore, converge, session_end).",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 100 }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_experiences",
      title: "InnerLife Experiences",
      description: "List Desktop-owned InnerLife experiences — shares that were used and represent formed outputs.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 100 }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_summaries",
      title: "InnerLife Summaries",
      description: "List stable Desktop-owned InnerLife digest summaries.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 50 }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_explore",
      title: "Explore InnerLife",
      description: "Trigger autonomous Desktop-owned InnerLife exploration — surfaces what deserves attention from Memory and recent thoughts, creates a waiting share candidate.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" },
          prompt: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_converge",
      title: "Converge InnerLife",
      description: "Consolidate active Desktop-owned InnerLife pending shares and recent thoughts into a single converged share candidate.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          agentTool: { type: "string" },
          agentName: { type: "string" }
        },
        additionalProperties: false
      }
    }
  ];
}

module.exports = {
  toolDefinitions
};
