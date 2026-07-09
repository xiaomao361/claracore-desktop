const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const { createGatewayClient, parseTextResult } = require("./gateway-client");

const EXPECTED_TOOLS = [
  "claracore_status",
  "gateway_docs",
  "gateway_context",
  "gateway_trace_list",
  "memoria_list",
  "memoria_search",
  "memoria_get",
  "memoria_create",
  "memoria_update",
  "memoria_tag",
  "memoria_delete",
  "memoria_restore",
  "memoria_archive",
  "memoria_archived_list",
  "memoria_restore_archived",
  "memoria_archive_suggestions",
  "memoria_archive_dormant",
  "memoria_stats",
  "memoria_graph",
  "memoria_maintenance_check",
  "memoria_maintenance_run",
  "memoria_maintenance_audit",
  "memoria_export",
  "memoria_import",
  "memoria_merge_suggestions",
  "memoria_merge",
  "memoria_restricted_list",
  "memoria_restrict",
  "memoria_unrestrict",
  "memoria_label_alias_list",
  "memoria_label_alias_create",
  "memoria_label_alias_delete",
  "memoria_record_create",
  "memoria_record_list",
  "memoria_record_summary",
  "memoria_record_stats",
  "shared_line_get",
  "shared_line_list",
  "shared_line_create",
  "shared_line_activate",
  "shared_line_rename",
  "shared_line_archive",
  "shared_line_restore",
  "shared_line_update",
  "shared_line_handoff_create",
  "innerlife_session_start",
  "innerlife_session_end",
  "innerlife_briefing",
  "innerlife_doctor",
  "innerlife_digest",
  "innerlife_share_check",
  "innerlife_submit_inbox",
  "innerlife_mark_share",
  "innerlife_daemon_status",
  "innerlife_daemon_set",
  "innerlife_daemon_tick"
];

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase4-contract-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  await runtime.saveProductSettings(app, {
    "innerlife.provider": "disabled",
    "innerlife.enabled": false
  });

  const snapshot = await runtime.buildProductSnapshot(app);
  const config = JSON.parse(snapshot.connections.mcpConfig);
  const server = config.mcpServers?.["claracore-desktop"];
  if (server?.type !== "stdio") throw new Error("Agent setup MCP server must be stdio.");
  if (server?.command !== "node") throw new Error(`Development Gateway command should be node, got ${server?.command}`);
  if (!server?.args?.[0]?.endsWith(path.join("core", "gateway", "mcp-server.js"))) {
    throw new Error(`Development Gateway args do not point at core/gateway/mcp-server.js: ${server?.args}`);
  }
  if (server?.env?.CLARACORE_DESKTOP_DATA_DIR !== dataRoot) {
    throw new Error("Agent setup does not pass the active product data root.");
  }
  if (snapshot.connections.gatewayEnvPath !== "not used in product core reset") {
    throw new Error("Agent setup should not reference old Gateway env files.");
  }
  if (snapshot.connections.mcpConfig.includes(`${path.sep}.claracore${path.sep}gateway`)) {
    throw new Error("Agent setup references old Gateway data.");
  }

  const client = createGatewayClient(dataRoot);
  try {
    const initialized = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {}
    });
    if (initialized.result?.serverInfo?.name !== "claracore-desktop") {
      throw new Error("Gateway initialize did not return ClaraCore Desktop server info.");
    }

    const tools = await client.request("tools/list");
    const toolNames = new Set((tools.result?.tools || []).map((tool) => tool.name));
    for (const tool of EXPECTED_TOOLS) {
      if (!toolNames.has(tool)) throw new Error(`Gateway is missing expected tool: ${tool}`);
    }

    const docsResponse = await client.callTool("gateway_docs");
    const docsText = docsResponse.result?.content?.[0]?.text || "";
    for (const tool of EXPECTED_TOOLS) {
      if (!docsText.includes(tool)) throw new Error(`Gateway docs do not include ${tool}.`);
    }
    if (!docsText.includes(dataRoot)) throw new Error("Gateway docs do not include the active data root.");
    if (!docsText.includes("Keep old ClaraCore service processes untouched")) {
      throw new Error("Gateway docs do not include old-service isolation guidance.");
    }
    if (docsText.includes(`${path.sep}.claracore${path.sep}gateway`) || docsText.includes(`${path.sep}.claracore${path.sep}memoria`)) {
      throw new Error("Gateway docs reference old service data.");
    }

    const status = parseTextResult(await client.callTool("claracore_status"));
    if (status.dataRoot !== dataRoot) throw new Error(`Gateway status data root mismatch: ${status.dataRoot}`);
    if (!status.database?.initialized) throw new Error("Gateway status did not initialize the product database.");
    if (status.configuration?.gateway?.transport !== "stdio") {
      throw new Error("Gateway status did not expose stdio transport.");
    }
    const contextMemory = parseTextResult(
      await client.callTool("memoria_create", {
        title: "Gateway context memory",
        body: "Gateway context should assemble this Memory with Shared Line and InnerLife.",
        labels: ["gateway", "context"]
      })
    ).memory;
    const contextSharedLine = parseTextResult(
      await client.callTool("shared_line_update", {
        summary: "Gateway context phase position.",
        interpretationStatus: "confirmed",
        factsUsed: [contextMemory.id]
      })
    );
    if (!contextSharedLine.currentPosition?.summary?.includes("Gateway context phase position")) {
      throw new Error("Gateway setup failed to create context Shared Line.");
    }
    const gatewayContext = parseTextResult(
      await client.callTool("gateway_context", {
        agentId: "my-agent",
        query: "Gateway context",
        limit: 5
      })
    );
    if (!gatewayContext.text?.includes("Gateway context phase position")) {
      throw new Error(`Gateway context text does not include Shared Line: ${gatewayContext.text}`);
    }
    if (!gatewayContext.memories?.some((memory) => memory.id === contextMemory.id)) {
      throw new Error(`Gateway context did not include matching Memory: ${JSON.stringify(gatewayContext.memories)}`);
    }
    if (gatewayContext.innerLife?.doctor?.status !== "ok") {
      throw new Error(`Gateway context did not include InnerLife Doctor: ${JSON.stringify(gatewayContext.innerLife?.doctor)}`);
    }
    if (!gatewayContext.guidance?.oldServices?.includes("Do not read or mutate old ClaraCore service databases")) {
      throw new Error("Gateway context did not include old-service safety guidance.");
    }
    let missingToolFailed = false;
    try {
      await client.callTool("missing_gateway_tool", { agentId: "my-agent" });
    } catch (error) {
      missingToolFailed = error.message.includes("Unknown tool");
    }
    if (!missingToolFailed) throw new Error("Gateway missing tool call should fail for trace coverage.");
    const traceList = parseTextResult(
      await client.callTool("gateway_trace_list", {
        limit: 20
      })
    );
    if (!traceList.traces?.some((trace) => trace.toolName === "gateway_context" && trace.status === "ok")) {
      throw new Error(`Gateway traces did not include successful gateway_context call: ${JSON.stringify(traceList.traces)}`);
    }
    if (!traceList.traces?.some((trace) => trace.toolName === "missing_gateway_tool" && trace.status === "error")) {
      throw new Error(`Gateway traces did not include failed tool call: ${JSON.stringify(traceList.traces)}`);
    }
    const started = parseTextResult(
      await client.callTool("innerlife_session_start", {
        agentId: "my-agent",
        userId: "phase4-user",
        host: "phase4-gateway",
        externalSessionId: "phase4-session-001"
      })
    );
    if (!started.session?.id || !started.share_plan || started.briefing) {
      throw new Error("Gateway innerlife_session_start did not return a compact session start packet.");
    }
    const activeLine = parseTextResult(
      await client.callTool("shared_line_create", {
        agentId: "my-agent",
        title: "Phase4 active Shared Line"
      })
    ).line;
    const archivedLine = parseTextResult(
      await client.callTool("shared_line_create", {
        agentId: "my-agent",
        title: "Phase4 archived Shared Line"
      })
    ).line;
    parseTextResult(await client.callTool("shared_line_archive", { lineId: archivedLine.id }));
    const startedWithLines = parseTextResult(
      await client.callTool("innerlife_session_start", {
        agentId: "my-agent",
        userId: "phase4-user",
        host: "phase4-gateway",
        externalSessionId: "phase4-session-lines"
      })
    );
    if (!startedWithLines.shared_lines?.some((line) => line.id === activeLine.id)) {
      throw new Error(`Gateway innerlife_session_start did not include active Shared Lines: ${JSON.stringify(startedWithLines.shared_lines)}`);
    }
    if (startedWithLines.shared_lines?.some((line) => line.id === archivedLine.id)) {
      throw new Error(`Gateway innerlife_session_start included an archived Shared Line: ${JSON.stringify(startedWithLines.shared_lines)}`);
    }
    const ended = parseTextResult(
      await client.callTool("innerlife_session_end", {
        sessionId: started.session.id,
        summary: "Phase4 Gateway session ended."
      })
    );
    if (ended.session.status !== "ended" || ended.share?.status !== "pending" || !ended.share?.body) {
      throw new Error("Gateway innerlife_session_end did not create a reviewable afterthought.");
    }
    const briefing = parseTextResult(await client.callTool("innerlife_briefing", { agentId: "my-agent" }));
    if (!briefing.text.includes("Pending shares")) {
      throw new Error("Gateway innerlife_briefing did not return briefing text.");
    }
    const doctor = parseTextResult(await client.callTool("innerlife_doctor", { agentId: "my-agent" }));
    if (!["ok", "warn"].includes(doctor.status) || !Array.isArray(doctor.nextActions)) {
      throw new Error(`Gateway innerlife_doctor did not return diagnostic guidance: ${JSON.stringify(doctor)}`);
    }
    const inboxResult = parseTextResult(
      await client.callTool("innerlife_submit_inbox", {
        agentId: "my-agent",
        source: "phase4-gateway",
        body: "Gateway inbox item should be visible to InnerLife."
      })
    );
    if (!inboxResult.inbox?.id || inboxResult.innerLife.counts.pending_inbox_count !== 1) {
      throw new Error("Gateway innerlife_submit_inbox did not create a pending inbox item.");
    }
    if (inboxResult.innerLife.sessions || inboxResult.innerLife.digestRuns) {
      throw new Error(`Gateway innerlife_submit_inbox returned a full InnerLife snapshot: ${JSON.stringify(Object.keys(inboxResult.innerLife))}`);
    }
    const digest = parseTextResult(
      await client.callTool("innerlife_digest", {
        agentId: "my-agent",
        mode: "light",
        prompt: "Gateway should create an explicit digest record."
      })
    );
    if (!digest.digest?.id || !digest.digest?.summary || digest.snapshot.counts.digest_runs_count !== 1 || digest.snapshot.counts.pending_inbox_count !== 0) {
      throw new Error("Gateway innerlife_digest did not create a digest record from pending inbox.");
    }
    const liteStatus = parseTextResult(await client.callTool("innerlife_status"));
    if (liteStatus.mode !== "lite" || liteStatus.sessions || liteStatus.digestRuns) {
      throw new Error(`Gateway innerlife_status should default to a lite snapshot: ${JSON.stringify(Object.keys(liteStatus))}`);
    }
    const fullStatus = parseTextResult(await client.callTool("innerlife_status", { detail: true }));
    if (!Array.isArray(fullStatus.sessions) || !Array.isArray(fullStatus.digestRuns)) {
      throw new Error(`Gateway innerlife_status detail=true did not return full snapshot fields: ${JSON.stringify(Object.keys(fullStatus))}`);
    }
    const { database } = await runtime.ensureProductCore(app);
    await database.ensureInnerLifeProfile("retention-agent");
    for (let index = 0; index < 205; index += 1) {
      await database.exec(`
        INSERT INTO innerlife_digest_runs (id, agent_id, mode, status, summary, completed_at, created_at, metadata_json)
        VALUES (
          'phase4_retention_${String(index).padStart(3, "0")}',
          'retention-agent',
          'light',
          'completed',
          'retention smoke ${index}',
          CURRENT_TIMESTAMP,
          datetime('now', '+${index} seconds'),
          '{}'
        );
      `);
    }
    await database.pruneInnerLifeDigestRuns("retention-agent");
    const retentionRows = await database.query(`
      SELECT COUNT(*) AS count, MIN(id) AS min_id, MAX(id) AS max_id
      FROM innerlife_digest_runs
      WHERE agent_id = 'retention-agent';
    `);
    const retention = retentionRows[0] || {};
    if (retention.count !== 200 || retention.min_id !== "phase4_retention_005" || retention.max_id !== "phase4_retention_204") {
      throw new Error(`Gateway digest retention did not keep the newest 200 rows: ${JSON.stringify(retention)}`);
    }
    const daemonStatus = parseTextResult(await client.callTool("innerlife_daemon_status", { agentId: "my-agent" }));
    if (daemonStatus.status !== "paused" || daemonStatus.enabled) {
      throw new Error(`Gateway innerlife_daemon_status should start paused: ${JSON.stringify(daemonStatus)}`);
    }
    const daemonEnabled = parseTextResult(await client.callTool("innerlife_daemon_set", { agentId: "my-agent", action: "enable" }));
    if (!daemonEnabled.enabled || daemonEnabled.status !== "enabled") {
      throw new Error(`Gateway innerlife_daemon_set did not enable daemon: ${JSON.stringify(daemonEnabled)}`);
    }
    const daemonTick = parseTextResult(await client.callTool("innerlife_daemon_tick", { agentId: "my-agent", force: true }));
    if (daemonTick.ran !== false || daemonTick.reason !== "idle" || daemonTick.daemon?.tickCount !== 1) {
      throw new Error(`Gateway innerlife_daemon_tick did not record an idle tick: ${JSON.stringify(daemonTick)}`);
    }
    const daemonPaused = parseTextResult(await client.callTool("innerlife_daemon_set", { agentId: "my-agent", action: "pause" }));
    if (daemonPaused.enabled || daemonPaused.status !== "paused") {
      throw new Error(`Gateway innerlife_daemon_set did not pause daemon: ${JSON.stringify(daemonPaused)}`);
    }
    const shareCheck = parseTextResult(
      await client.callTool("innerlife_share_check", {
        agentId: "my-agent",
        shareId: ended.share.id,
        context: "Gateway asks whether this session afterthought can be shared now."
      })
    );
    if (shareCheck.check?.decision !== "review_first") {
      throw new Error(`Gateway innerlife_share_check did not record a review-first decision: ${JSON.stringify(shareCheck.check)}`);
    }
    const shareMark = parseTextResult(
      await client.callTool("innerlife_mark_share", {
        id: ended.share.id,
        action: "discarded",
        reason: "Gateway contract smoke"
      })
    );
    if (shareMark.share.status !== "discarded") {
      throw new Error("Gateway innerlife_mark_share did not update share status.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          command: server.command,
          tools: EXPECTED_TOOLS.length,
          source: snapshot.connections.pythonSource
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
