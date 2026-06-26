#!/usr/bin/env node
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");
const { exportProductMemoryArchive, importProductMemoryArchive } = require("../runtime");

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = {
  name: "claracore-desktop",
  version: "0.2-reset"
};

function productPaths() {
  const dataRoot = process.env.CLARACORE_DESKTOP_DATA_DIR
    ? path.resolve(process.env.CLARACORE_DESKTOP_DATA_DIR)
    : path.join(os.homedir(), ".claracore-desktop", "product-dev");
  return {
    dataRoot,
    databasePath: path.join(dataRoot, "claracore.db"),
    exportsDir: path.join(dataRoot, "exports")
  };
}

function runtimeAppForGateway() {
  const paths = productPaths();
  process.env.CLARACORE_DESKTOP_DATA_DIR = paths.dataRoot;
  return {
    getPath(name) {
      return path.join(paths.dataRoot, name);
    },
    isPackaged: Boolean(process.versions.electron && process.argv.includes("--gateway"))
  };
}

function gatewayLaunchConfig(paths) {
  if (process.versions.electron && process.argv.includes("--gateway")) {
    return {
      command: process.execPath,
      args: ["--gateway"],
      displayCommand: `CLARACORE_DESKTOP_DATA_DIR=${paths.dataRoot} "${process.execPath}" --gateway`,
      source: "packaged app"
    };
  }
  return {
    command: "node",
    args: [__filename],
    displayCommand: `CLARACORE_DESKTOP_DATA_DIR=${paths.dataRoot} node ${__filename}`,
    source: "development checkout"
  };
}

function textResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

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
      name: "memory_list",
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
      name: "memory_search",
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
      name: "memory_create",
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
      name: "memory_update",
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
      name: "memory_restricted_list",
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
      name: "memory_restrict",
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
      name: "memory_unrestrict",
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
      name: "memory_delete",
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
      name: "memory_restore",
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
      name: "memory_archive",
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
      name: "memory_archived_list",
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
      name: "memory_restore_archived",
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
      name: "memory_archive_suggestions",
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
      name: "memory_archive_dormant",
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
      name: "memory_stats",
      title: "Memory Stats",
      description: "Read ClaraCore Desktop memory counts, embedding status counts, and active label counts.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "memory_graph",
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
      name: "memory_maintenance_check",
      title: "Memory Maintenance Check",
      description: "Check ClaraCore Desktop Memory maintenance issues such as missing embeddings, failed embeddings, orphan labels, and alias labels.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "memory_maintenance_run",
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
      name: "memory_export",
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
      name: "memory_import",
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
      name: "memory_merge_suggestions",
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
      name: "memory_merge",
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
      name: "memory_label_alias_list",
      title: "List Memory Label Aliases",
      description: "List ClaraCore Desktop Memory label aliases.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "memory_label_alias_create",
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
      name: "memory_label_alias_delete",
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
      name: "memory_record_create",
      title: "Create Structured Memory Record",
      description: "Create a typed ClaraCore Desktop structured memory record such as a fitness, metric, or recurring log entry.",
      inputSchema: {
        type: "object",
        required: ["recordType"],
        properties: {
          recordType: { type: "string" },
          title: { type: "string" },
          value: {
            type: "object",
            additionalProperties: true
          },
          occurredAt: { type: "string" },
          source: { type: "string" },
          metadata: {
            type: "object",
            additionalProperties: true
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "memory_record_list",
      title: "List Structured Memory Records",
      description: "List typed ClaraCore Desktop structured memory records.",
      inputSchema: {
        type: "object",
        properties: {
          recordType: { type: "string" },
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
      name: "memory_record_stats",
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
      description: "Read the current ClaraCore Desktop shared position and resume packet.",
      inputSchema: {
        type: "object",
        properties: {
          lineId: { type: "string" }
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
        properties: {},
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
          summary: {
            type: "string"
          },
          lineId: {
            type: "string"
          },
          interpretationStatus: {
            type: "string",
            enum: ["draft", "confirmed"]
          },
          factsUsed: {
            type: "array",
            items: {
              type: "string"
            }
          },
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
      name: "innerlife_session_start",
      title: "Start InnerLife Session",
      description: "Start a Desktop-owned InnerLife session and return the current briefing.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          userId: { type: "string" },
          host: { type: "string" },
          externalSessionId: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_session_end",
      title: "End InnerLife Session",
      description: "End a Desktop-owned InnerLife session and create a reviewable afterthought.",
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
      name: "innerlife_digest",
      title: "Run InnerLife Digest",
      description: "Run a Desktop-owned InnerLife digest and record what was digested.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          mode: { type: "string" },
          prompt: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_share_check",
      title: "Check InnerLife Share Timing",
      description: "Check whether a reviewable InnerLife share fits the current context.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
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
      description: "Submit a reviewable material item into the Desktop-owned InnerLife inbox.",
      inputSchema: {
        type: "object",
        required: ["body"],
        properties: {
          agentId: { type: "string" },
          source: { type: "string" },
          body: { type: "string" }
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
          action: { type: "string", enum: ["enable", "pause"] },
          enabled: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "innerlife_daemon_tick",
      title: "Tick InnerLife Daemon",
      description: "Run one due InnerLife daemon tick and create only reviewable output.",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          force: { type: "boolean" }
        },
        additionalProperties: false
      }
    }
  ];
}

async function openDatabase() {
  const paths = productPaths();
  const database = await initializeProductDatabase(paths.databasePath);
  return { paths, database };
}

function summarizeToolResponse(result) {
  const text = result?.content?.[0]?.text || "";
  if (!text) return "";
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

async function callToolBody(name, args = {}, paths, database) {
  if (name === "claracore_status") {
    return textResult({
      dataRoot: paths.dataRoot,
      database: await database.getSummary(),
      configuration: await database.getConfiguration({
        dataRoot: paths.dataRoot
      })
    });
  }
  if (name === "gateway_docs") {
    const launch = gatewayLaunchConfig(paths);
    return {
      content: [
        {
          type: "text",
          text: [
            "# ClaraCore Desktop Gateway",
            "",
            "Use this MCP server as the single local entry for ClaraCore Desktop product data.",
            "",
            "## MCP Config",
            "",
            "```json",
            JSON.stringify(
              {
                mcpServers: {
                  "claracore-desktop": {
                    type: "stdio",
                    command: launch.command,
                    args: launch.args,
                    env: {
                      CLARACORE_DESKTOP_DATA_DIR: paths.dataRoot
                    }
                  }
                }
              },
              null,
              2
            ),
            "```",
            "",
            "## Available Tools",
            "",
            ...toolDefinitions().map((tool) => `- ${tool.name}: ${tool.description}`),
            "",
            "## CLI Fallback",
            "",
            launch.displayCommand,
            "",
            `Source: ${launch.source}`,
            "",
            "Keep old ClaraCore service processes untouched during this product-core development phase."
          ].join("\n")
        }
      ]
    };
  }
  if (name === "gateway_context") {
    return textResult(await database.getGatewayContext(args));
  }
  if (name === "gateway_trace_list") {
    return textResult({
      traces: await database.listGatewayTraces(args)
    });
  }
  if (name === "memory_list") {
    return textResult({
      results: await database.listMemories(args.limit || 20)
    });
  }
  if (name === "memory_search") {
    return textResult(await database.searchMemories(args.query || "", args.limit || 50));
  }
  if (name === "memory_create") {
    const memory = await database.createMemory(args);
    await database.processPendingEmbeddings(1);
    return textResult({
      memory
    });
  }
  if (name === "memory_update") {
    const memory = await database.updateMemory(args.id, args);
    await database.processPendingEmbeddings(1);
    return textResult({
      memory
    });
  }
  if (name === "memory_restricted_list") {
    return textResult({
      results: await database.listRestrictedMemories(args.limit || 20)
    });
  }
  if (name === "memory_restrict") {
    return textResult({
      memory: await database.setMemorySensitivity(args.id, "restricted")
    });
  }
  if (name === "memory_unrestrict") {
    return textResult({
      memory: await database.setMemorySensitivity(args.id, "normal")
    });
  }
  if (name === "memory_delete") {
    return textResult(await database.deleteMemory(args.id));
  }
  if (name === "memory_restore") {
    return textResult({
      memory: await database.restoreMemory(args.id)
    });
  }
  if (name === "memory_archive") {
    return textResult({
      memory: await database.archiveMemory(args.id)
    });
  }
  if (name === "memory_archived_list") {
    return textResult({
      results: await database.listArchivedMemories(args.limit || 20)
    });
  }
  if (name === "memory_restore_archived") {
    return textResult({
      memory: await database.restoreArchivedMemory(args.id)
    });
  }
  if (name === "memory_archive_suggestions") {
    return textResult(await database.getMemoryArchiveSuggestions(args));
  }
  if (name === "memory_archive_dormant") {
    return textResult(await database.archiveDormantMemories(args));
  }
  if (name === "memory_stats") {
    return textResult(await database.getMemoryStats());
  }
  if (name === "memory_graph") {
    return textResult(await database.getMemoryGraph(args));
  }
  if (name === "memory_maintenance_check") {
    return textResult(await database.getMemoryMaintenanceReport());
  }
  if (name === "memory_maintenance_run") {
    return textResult(await database.runMemoryMaintenance(args));
  }
  if (name === "memory_export") {
    return textResult(await exportProductMemoryArchive(runtimeAppForGateway(), args));
  }
  if (name === "memory_import") {
    return textResult(await importProductMemoryArchive(runtimeAppForGateway(), args));
  }
  if (name === "memory_merge_suggestions") {
    return textResult(await database.getMemoryMergeSuggestions(args));
  }
  if (name === "memory_merge") {
    return textResult(await database.mergeMemories(args));
  }
  if (name === "memory_label_alias_list") {
    return textResult({
      aliases: await database.listMemoryLabelAliases()
    });
  }
  if (name === "memory_label_alias_create") {
    return textResult(await database.createMemoryLabelAlias(args));
  }
  if (name === "memory_label_alias_delete") {
    return textResult(await database.deleteMemoryLabelAlias(args.alias));
  }
  if (name === "memory_record_create") {
    const record = await database.createMemoryRecord(args);
    return textResult({
      record,
      stats: await database.getMemoryRecordStats()
    });
  }
  if (name === "memory_record_list") {
    return textResult({
      records: await database.listMemoryRecords(args),
      stats: await database.getMemoryRecordStats()
    });
  }
  if (name === "memory_record_stats") {
    return textResult(await database.getMemoryRecordStats());
  }
  if (name === "shared_line_get") {
    return textResult(await database.getResumePacket(args));
  }
  if (name === "shared_line_list") {
    return textResult({
      lines: await database.listContinuityLines(100)
    });
  }
  if (name === "shared_line_create") {
    const line = await database.createContinuityLine(args);
    return textResult({
      line,
      sharedLine: await database.getResumePacket({ lineId: line.id })
    });
  }
  if (name === "shared_line_activate") {
    const line = await database.setActiveContinuityLine(args.lineId);
    return textResult({
      line,
      sharedLine: await database.getResumePacket({ lineId: line.id })
    });
  }
  if (name === "shared_line_rename") {
    const line = await database.renameContinuityLine(args.lineId, args.title);
    return textResult({
      line,
      sharedLine: await database.getResumePacket({ lineId: line.active ? line.id : undefined })
    });
  }
  if (name === "shared_line_archive") {
    const line = await database.archiveContinuityLine(args.lineId);
    return textResult({
      line,
      sharedLine: await database.getResumePacket()
    });
  }
  if (name === "shared_line_restore") {
    const line = await database.restoreContinuityLine(args.lineId, Boolean(args.makeActive));
    return textResult({
      line,
      sharedLine: await database.getResumePacket({ lineId: line.active ? line.id : undefined })
    });
  }
  if (name === "shared_line_update") {
    await database.saveCurrentPosition(args);
    return textResult(await database.getResumePacket({ lineId: args.lineId }));
  }
  if (name === "shared_line_handoff_create") {
    const handoff = await database.createContinuityHandoff(args);
    return textResult({
      handoff,
      sharedLine: await database.getResumePacket({ lineId: args.lineId })
    });
  }
  if (name === "innerlife_session_start") {
    return textResult(await database.startInnerLifeSession(args));
  }
  if (name === "innerlife_session_end") {
    return textResult(await database.endInnerLifeSession(args.sessionId, args));
  }
  if (name === "innerlife_briefing") {
    return textResult(await database.getInnerLifeBriefing(args.agentId || "my-agent"));
  }
  if (name === "innerlife_doctor") {
    return textResult(await database.getInnerLifeDoctor(args.agentId || "my-agent"));
  }
  if (name === "innerlife_digest") {
    return textResult(await database.runInnerLifeDigest(args));
  }
  if (name === "innerlife_share_check") {
    return textResult(await database.checkInnerLifeShareTiming(args));
  }
  if (name === "innerlife_submit_inbox") {
    return textResult({
      inbox: await database.submitInnerLifeInbox(args),
      innerLife: await database.getInnerLifeSnapshot()
    });
  }
  if (name === "innerlife_mark_share") {
    return textResult(await database.markInnerLifeShare(args.id, args.action, args.reason || ""));
  }
  if (name === "innerlife_daemon_status") {
    return textResult(await database.ensureInnerLifeDaemonState(args.agentId || "my-agent"));
  }
  if (name === "innerlife_daemon_set") {
    return textResult(await database.setInnerLifeDaemonState(args));
  }
  if (name === "innerlife_daemon_tick") {
    return textResult(await database.tickInnerLifeDaemon(args));
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function callTool(name, args = {}) {
  const startedAt = Date.now();
  const { paths, database } = await openDatabase();
  const agentId = String(args.agentId || process.env.CLARACORE_AGENT_ID || "my-agent").trim() || "my-agent";
  try {
    const result = await callToolBody(name, args, paths, database);
    await database.recordGatewayTrace({
      agentId,
      toolName: name,
      status: "ok",
      durationMs: Date.now() - startedAt,
      request: args,
      responseSummary: summarizeToolResponse(result)
    });
    return result;
  } catch (error) {
    await database.recordGatewayTrace({
      agentId,
      toolName: name,
      status: "error",
      durationMs: Date.now() - startedAt,
      request: args,
      error: error.message || String(error)
    });
    throw error;
  }
}

async function handleRequest(message) {
  if (message.method === "initialize") {
    return {
      protocolVersion: message.params?.protocolVersion || PROTOCOL_VERSION,
      capabilities: {
        tools: {}
      },
      serverInfo: SERVER_INFO
    };
  }
  if (message.method === "tools/list") {
    return {
      tools: toolDefinitions()
    };
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    const args = message.params?.arguments || {};
    if (!name || typeof name !== "string") {
      throw new Error("Tool name is required.");
    }
    return callTool(name, args);
  }
  if (message.method === "ping") {
    return {};
  }
  throw new Error(`Unsupported method: ${message.method}`);
}

function writeResponse(response) {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

async function handleMessage(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") return;
  if (message.id === undefined || message.id === null) return;
  try {
    const result = await handleRequest(message);
    writeResponse({
      jsonrpc: "2.0",
      id: message.id,
      result
    });
  } catch (error) {
    writeResponse({
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32603,
        message: error.message
      }
    });
  }
}

function start() {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        handleMessage(JSON.parse(trimmed));
      } catch (error) {
        process.stderr.write(`Invalid MCP message: ${error.message}\n`);
      }
    }
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  start
};
