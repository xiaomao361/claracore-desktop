#!/usr/bin/env node

const os = require("os");
const path = require("path");
const runtime = require("./runtime");

function createCliApp() {
  const userData = process.env.CLARACORE_DESKTOP_USER_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "claracore-desktop");
  return {
    isPackaged: false,
    getPath(name) {
      if (name === "userData") return userData;
      if (name === "home") return os.homedir();
      return path.join(userData, name);
    }
  };
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      positional.push(item);
      continue;
    }
    const rawKey = item.slice(2);
    const inlineIndex = rawKey.indexOf("=");
    if (inlineIndex >= 0) {
      options[rawKey.slice(0, inlineIndex)] = rawKey.slice(inlineIndex + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      options[rawKey] = true;
      continue;
    }
    options[rawKey] = next;
    index += 1;
  }
  return { positional, options };
}

function splitLabels(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
}

function parseJsonObject(raw, fallback = {}) {
  if (!raw) return fallback;
  const parsed = JSON.parse(String(raw));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object.");
  return parsed;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return {
    usage: "node core/cli.js <command> [options]",
    commands: [
      "store --body <text> [--title <text>] [--labels a,b] [--restricted]",
      "recall [--query <text>] [--limit N] [--include-restricted]",
      "get --id <memory_id>",
      "update --id <memory_id> --body <text> [--title <text>] [--labels a,b] [--restricted]",
      "delete --id <memory_id>",
      "restore --id <memory_id>",
      "archive --id <memory_id>",
      "restore-archived --id <memory_id>",
      "tag --id <memory_id> [--add a,b] [--remove c,d]",
      "stats",
      "labels",
      "maintenance check|run|audit [--dry-run]",
      "export [--target-path <path>] [--allow-external-path]",
      "import --file-path <path> [--allow-external-path]",
      "record add --type <type> --data <json> [--title <text>] [--occurred-at <iso>] [--user-id <id>] [--timezone <tz>] [--dedupe-key <key>] [--note <text>]",
      "record query [--user-id <id>] [--type <type>] [--local-date YYYY-MM-DD] [--start <iso>] [--end <iso>] [--limit N] [--offset N]",
      "record summary [--user-id <id>] [--type fitness] [--local-date YYYY-MM-DD] [--start <iso>] [--end <iso>]",
      "shared-line get [--line-id <id>]",
      "shared-line list [--limit N]",
      "shared-line create --title <text> [--no-activate]",
      "shared-line activate --line-id <id>",
      "shared-line rename --line-id <id> --title <text>",
      "shared-line archive --line-id <id>",
      "shared-line restore --line-id <id> [--activate]",
      "shared-line update --summary <text> [--line-id <id>] [--status draft|confirmed] [--facts-used a,b] [--confirm-overwrite]",
      "shared-line handoff [--line-id <id>] [--objective <text>] [--completed a,b] [--open-items a,b] [--next-step <text>]",
      "innerlife status",
      "innerlife doctor [--agent <id>]",
      "innerlife briefing [--agent <id>]",
      "innerlife sessions [--agent <id>] [--limit N]",
      "innerlife session-start [--agent <id>] [--user <id>] [--host <host>] [--external-session-id <id>]",
      "innerlife session-end --session-id <id> [--summary <text>] [--transcript <text>]",
      "innerlife inbox --body <text> [--agent <id>] [--source <text>]",
      "innerlife submit-fact --body <text> [--agent <id>]",
      "innerlife submit-continuity --body <text> [--agent <id>]",
      "innerlife digest [--agent <id>] [--mode <mode>] [--prompt <text>]",
      "innerlife process-once [--prompt <text>]",
      "innerlife pending [--status pending|approved|all] [--limit N]",
      "innerlife share-check [--share-id <id>] [--session-id <id>] [--context <text>]",
      "innerlife mark-share --id <id> --action used|deferred|discarded [--reason <text>]",
      "innerlife share-actions [--share-id <id>] [--limit N]",
      "innerlife daemon status|enable|pause|tick [--force]"
    ]
  };
}

function requireOption(options, key) {
  const value = options[key];
  if (value === undefined || value === null || String(value).trim() === "") throw new Error(`--${key} is required.`);
  return value;
}

async function runMemoryCommand(app, command, subcommand, options) {
  if (command === "store") {
    return {
      memory: await runtime.createProductMemory(app, {
        title: options.title || "",
        body: requireOption(options, "body"),
        labels: splitLabels(options.labels),
        sensitivity: options.restricted ? "restricted" : options.sensitivity || "normal"
      })
    };
  }
  if (command === "recall") {
    const limit = Number.parseInt(String(options.limit || 20), 10) || 20;
    if (options.query) {
      return runtime.searchProductMemories(app, String(options.query));
    }
    const { database } = await runtime.ensureProductCore(app);
    return {
      mode: "list",
      query: "",
      results: await database.listMemories(limit, "", { includeRestricted: Boolean(options["include-restricted"]) }),
      error: null
    };
  }
  if (command === "get") {
    const { database } = await runtime.ensureProductCore(app);
    const memory = await database.getMemory(requireOption(options, "id"));
    if (!memory) throw new Error("Memory not found.");
    return { memory };
  }
  if (command === "update") {
    return {
      memory: await runtime.updateProductMemory(app, requireOption(options, "id"), {
        title: options.title || "",
        body: requireOption(options, "body"),
        labels: splitLabels(options.labels),
        sensitivity: options.restricted ? "restricted" : options.sensitivity || "normal"
      })
    };
  }
  if (command === "delete") return { memory: await runtime.deleteProductMemory(app, requireOption(options, "id")) };
  if (command === "restore") return { memory: await runtime.restoreProductMemory(app, requireOption(options, "id")) };
  if (command === "archive") return { memory: await runtime.archiveProductMemory(app, requireOption(options, "id")) };
  if (command === "restore-archived") return { memory: await runtime.restoreArchivedProductMemory(app, requireOption(options, "id")) };
  if (command === "tag") {
    const { database } = await runtime.ensureProductCore(app);
    return database.updateMemoryLabels(requireOption(options, "id"), {
      add: splitLabels(options.add || options.labels),
      remove: splitLabels(options.remove)
    });
  }
  if (command === "stats") return { stats: await runtime.getProductMemoryStats(app) };
  if (command === "labels") return { aliases: await runtime.getProductMemoryLabelAliases(app), stats: await runtime.getProductMemoryStats(app) };
  if (command === "maintenance") {
    if (subcommand === "check") return runtime.getProductMemoryMaintenance(app);
    if (subcommand === "run") return runtime.runProductMemoryMaintenance(app, { dryRun: Boolean(options["dry-run"] || options.dryRun) });
    if (subcommand === "audit") {
      const { database } = await runtime.ensureProductCore(app);
      return database.getMemoryAuditReport({
        limit: Number.parseInt(String(options.limit || 10), 10) || 10,
        olderThanDays: Number.parseInt(String(options["older-than-days"] || 30), 10) || 30
      });
    }
    throw new Error("maintenance requires check, run, or audit.");
  }
  if (command === "export") {
    return runtime.exportProductMemoryArchive(app, {
      targetPath: options["target-path"],
      allowExternalPath: Boolean(options["allow-external-path"])
    });
  }
  if (command === "import") {
    return runtime.importProductMemoryArchive(app, {
      filePath: requireOption(options, "file-path"),
      allowExternalPath: Boolean(options["allow-external-path"])
    });
  }
  if (command === "record") {
    if (subcommand === "add") {
      return {
        record: await runtime.createProductMemoryRecord(app, {
          userId: options["user-id"] || "local-user",
          recordType: requireOption(options, "type"),
          title: options.title || options.type,
          value: parseJsonObject(requireOption(options, "data")),
          occurredAt: options["occurred-at"] || new Date().toISOString(),
          timezone: options.timezone || "Asia/Shanghai",
          schemaVersion: Number.parseInt(String(options["schema-version"] || 1), 10) || 1,
          note: options.note || "",
          source: options.source || "cli",
          sourceAgent: options["source-agent"] || "codex",
          sourceRunId: options["source-run-id"] || "",
          dedupeKey: options["dedupe-key"] || "",
          metadata: parseJsonObject(options.metadata, {})
        })
      };
    }
    if (subcommand === "query") {
      return runtime.getProductMemoryRecords(app, {
        userId: options["user-id"] || "",
        recordType: options.type || "",
        localDate: options["local-date"] || "",
        start: options.start || "",
        end: options.end || "",
        limit: Number.parseInt(String(options.limit || 20), 10) || 20,
        offset: Number.parseInt(String(options.offset || 0), 10) || 0
      });
    }
    if (subcommand === "summary") {
      const { database } = await runtime.ensureProductCore(app);
      return {
        summary: await database.summarizeMemoryRecords({
          userId: options["user-id"] || "local-user",
          recordType: options.type || "fitness",
          localDate: options["local-date"] || "",
          start: options.start || "",
          end: options.end || ""
        }),
        stats: await database.getMemoryRecordStats()
      };
    }
    throw new Error("record requires add, query, or summary.");
  }
  if (command === "shared-line") {
    if (subcommand === "get") {
      return { sharedLine: await runtime.getProductSharedLine(app, { lineId: options["line-id"] || options.lineId }) };
    }
    if (subcommand === "list") {
      const { database } = await runtime.ensureProductCore(app);
      return {
        lines: await database.listContinuityLines(Number.parseInt(String(options.limit || 20), 10) || 20)
      };
    }
    if (subcommand === "create") {
      return runtime.createProductSharedLine(app, {
        title: requireOption(options, "title"),
        makeActive: !Boolean(options["no-activate"])
      });
    }
    if (subcommand === "activate") {
      return runtime.activateProductSharedLine(app, requireOption(options, "line-id"));
    }
    if (subcommand === "rename") {
      return runtime.renameProductSharedLine(app, requireOption(options, "line-id"), requireOption(options, "title"));
    }
    if (subcommand === "archive") {
      return runtime.archiveProductSharedLine(app, requireOption(options, "line-id"));
    }
    if (subcommand === "restore") {
      return runtime.restoreProductSharedLine(app, requireOption(options, "line-id"), Boolean(options.activate));
    }
    if (subcommand === "update") {
      return {
        sharedLine: await runtime.saveProductSharedLine(app, {
          lineId: options["line-id"] || options.lineId,
          summary: requireOption(options, "summary"),
          interpretationStatus: options.status || options["interpretation-status"] || "draft",
          factsUsed: splitLabels(options["facts-used"] || options.factsUsed),
          confirmOverwrite: Boolean(options["confirm-overwrite"])
        })
      };
    }
    if (subcommand === "handoff") {
      return runtime.createProductSharedLineHandoff(app, {
        lineId: options["line-id"] || options.lineId,
        objective: options.objective || "",
        completed: splitLabels(options.completed),
        openItems: splitLabels(options["open-items"] || options.openItems),
        nextStep: options["next-step"] || options.nextStep || ""
      });
    }
    throw new Error("shared-line requires get, list, create, activate, rename, archive, restore, update, or handoff.");
  }
  if (command === "innerlife") {
    const agentId = options.agent || options.agentId || process.env.CLARACORE_AGENT_ID || "codex";
    if (subcommand === "status") return { innerLife: await runtime.getProductInnerLife(app) };
    if (subcommand === "doctor") return { doctor: await runtime.getProductInnerLifeDoctor(app, agentId) };
    if (subcommand === "briefing") {
      const { database } = await runtime.ensureProductCore(app);
      return { briefing: await database.getInnerLifeBriefing(agentId) };
    }
    if (subcommand === "sessions") {
      const { database } = await runtime.ensureProductCore(app);
      return {
        sessions: await database.listInnerLifeSessions(agentId, Number.parseInt(String(options.limit || 20), 10) || 20)
      };
    }
    if (subcommand === "session-start") {
      return runtime.startProductInnerLifeSession(app, {
        agentId,
        userId: options.user || options.userId || "local-user",
        host: options.host || "cli",
        externalSessionId: options["external-session-id"] || options.externalSessionId || ""
      });
    }
    if (subcommand === "session-end") {
      return runtime.endProductInnerLifeSession(app, requireOption(options, "session-id"), {
        summary: options.summary || "",
        transcript: options.transcript || ""
      });
    }
    if (subcommand === "inbox" || subcommand === "submit-fact" || subcommand === "submit-continuity") {
      const sourceByCommand = {
        inbox: options.source || "cli",
        "submit-fact": "fact",
        "submit-continuity": "continuity"
      };
      return {
        inbox: await runtime.submitProductInnerLifeInbox(app, {
          agentId,
          source: sourceByCommand[subcommand],
          body: requireOption(options, "body")
        }),
        innerLife: await runtime.getProductInnerLife(app)
      };
    }
    if (subcommand === "digest") {
      return runtime.runProductInnerLifeDigest(app, {
        agentId,
        mode: options.mode || "manual",
        prompt: options.prompt || ""
      });
    }
    if (subcommand === "process-once") return runtime.processProductInnerLifeOnce(app, { prompt: options.prompt || "" });
    if (subcommand === "pending") {
      const { database } = await runtime.ensureProductCore(app);
      return {
        shares: await database.listInnerLifeShares(options.status || "pending", Number.parseInt(String(options.limit || 20), 10) || 20)
      };
    }
    if (subcommand === "share-check") {
      return runtime.checkProductInnerLifeShareTiming(app, {
        agentId,
        shareId: options["share-id"] || options.shareId || "",
        sessionId: options["session-id"] || options.sessionId || "",
        context: options.context || ""
      });
    }
    if (subcommand === "mark-share") {
      return runtime.markProductInnerLifeShare(app, requireOption(options, "id"), requireOption(options, "action"), options.reason || "");
    }
    if (subcommand === "share-actions") {
      const { database } = await runtime.ensureProductCore(app);
      return {
        actions: await database.listInnerLifeShareActions(options["share-id"] || options.shareId || null, Number.parseInt(String(options.limit || 20), 10) || 20)
      };
    }
    if (subcommand === "daemon") {
      const action = options.daemonAction || options.action || "status";
      if (action === "status") {
        const { database } = await runtime.ensureProductCore(app);
        return { daemon: await database.ensureInnerLifeDaemonState(agentId) };
      }
      if (action === "enable" || action === "pause") return runtime.setProductInnerLifeDaemon(app, { agentId, action });
      if (action === "tick") return runtime.tickProductInnerLifeDaemon(app, { agentId, force: Boolean(options.force) });
      throw new Error("innerlife daemon requires status, enable, pause, or tick.");
    }
    throw new Error("innerlife requires status, doctor, briefing, sessions, session-start, session-end, inbox, submit-fact, submit-continuity, digest, process-once, pending, share-check, mark-share, share-actions, or daemon.");
  }
  throw new Error(`Unknown command: ${command || ""}`);
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const [command, subcommand, daemonAction] = positional;
  if (daemonAction) options.daemonAction = daemonAction;
  if (!command || command === "help" || options.help) {
    printJson(usage());
    return;
  }
  const app = createCliApp();
  const result = await runMemoryCommand(app, command, subcommand, options);
  printJson(result);
}

main().catch((error) => {
  process.stderr.write(`${error.message || String(error)}\n`);
  process.exit(1);
});
