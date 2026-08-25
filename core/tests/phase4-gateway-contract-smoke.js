const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const { PRODUCT_VERSION } = require("../version");
const { createGatewayClient, parseTextResult } = require("./gateway-client");
const { CONTEXT_BUDGET_CEILINGS } = require("./fixtures/context-budget-ceilings");

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
  "memoria_supersede",
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
  "innerlife_afterthought_resolve",
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
    "innerlife.enabled": false,
    "innerlife.llm.api_key_ref": "INLINE_SECRET_MUST_NOT_ESCAPE"
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
  if (server?.env?.CLARACORE_AGENT_ID !== "<agent-stable-id>") {
    throw new Error("Agent setup does not include the stable agent id placeholder.");
  }
  if (server?.env?.CLARACORE_CLIENT_ID !== "<codex-app|claude-code|hermes>") {
    throw new Error("Agent setup does not include the host client id placeholder.");
  }
  if (server?.env?.CLARACORE_CONVERSATION_ID !== "<optional-host-conversation-id>") {
    throw new Error("Agent setup does not include the optional conversation id placeholder.");
  }
  // v0.6.6 A1: first-party setup generates the core profile explicitly.
  if (server?.env?.CLARACORE_TOOL_PROFILE !== "core") {
    throw new Error(
      `Agent setup must generate the first-party core tool profile, got ${server?.env?.CLARACORE_TOOL_PROFILE}.`
    );
  }
  if (snapshot.connections.gatewayEnvPath !== "not used in product core reset") {
    throw new Error("Agent setup should not reference old Gateway env files.");
  }
  if (snapshot.connections.mcpConfig.includes(`${path.sep}.claracore${path.sep}gateway`)) {
    throw new Error("Agent setup references old Gateway data.");
  }

  // This is the full-contract compatibility smoke: it asserts every canonical
  // tool name and schema survives. v0.6.6 keeps that surface behind the
  // explicit full profile, so this client selects it. Core-profile behavior is
  // asserted separately below and in core/tests/context-budget-smoke.js.
  const client = createGatewayClient(dataRoot, {
    env: {
      CLARACORE_AGENT_ID: "my-agent",
      CLARACORE_CLIENT_ID: "contract-smoke",
      CLARACORE_CONVERSATION_ID: "phase4-conversation",
      CLARACORE_TOOL_PROFILE: "full"
    }
  });
  try {
    const initialized = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {}
    });
    if (initialized.result?.serverInfo?.name !== "claracore-desktop") {
      throw new Error("Gateway initialize did not return ClaraCore Desktop server info.");
    }

    const tools = await client.request("tools/list");
    const listedTools = tools.result?.tools || [];
    const toolNames = new Set(listedTools.map((tool) => tool.name));
    for (const tool of EXPECTED_TOOLS) {
      if (!toolNames.has(tool)) throw new Error(`Gateway is missing expected tool: ${tool}`);
    }
    const sessionEndSchema = listedTools.find((tool) => tool.name === "innerlife_session_end")?.inputSchema;
    if (
      !sessionEndSchema?.properties?.sessionId ||
      !sessionEndSchema?.properties?.session_id ||
      !sessionEndSchema?.properties?.summary?.oneOf?.some((entry) => entry.type === "object")
    ) {
      throw new Error("Gateway innerlife_session_end schema does not expose the session_id alias and structured summaries.");
    }
    const afterthoughtResolveSchema = listedTools.find(
      (tool) => tool.name === "innerlife_afterthought_resolve"
    )?.inputSchema;
    if (
      !afterthoughtResolveSchema?.required?.includes("id") ||
      !afterthoughtResolveSchema?.required?.includes("action") ||
      !afterthoughtResolveSchema?.properties?.action?.enum?.includes("retry") ||
      !afterthoughtResolveSchema?.properties?.action?.enum?.includes("acknowledge")
    ) {
      throw new Error("Gateway afterthought recovery schema must expose explicit retry and acknowledge actions.");
    }

    // v0.6.6: the default docs read is a bounded summary plus a section index.
    // The full handbook is one explicit section and no longer restates
    // tools/list.
    const defaultDocsText = (await client.callTool("gateway_docs")).result?.content?.[0]?.text || "";
    if (Buffer.byteLength(defaultDocsText, "utf8") > 4096) {
      throw new Error(
        `Default Gateway docs are ${Buffer.byteLength(defaultDocsText, "utf8")} bytes, over the 4 KB ceiling.`
      );
    }
    for (const section of ["start", "memory", "shared-line", "innerlife", "diagnostics", "full"]) {
      if (!defaultDocsText.includes(section)) {
        throw new Error(`Default Gateway docs do not offer the ${section} section.`);
      }
    }
    const searchedDocsText = (
      await client.callTool("gateway_docs", { query: "automatic recall memory" })
    ).result?.content?.[0]?.text || "";
    if (!searchedDocsText.includes(`Guide version: ${PRODUCT_VERSION}`) || !searchedDocsText.includes("memory_context")) {
      throw new Error("Gateway docs search did not return versioned matching guidance.");
    }
    const docsResponse = await client.callTool("gateway_docs", { section: "full" });
    const docsText = docsResponse.result?.content?.[0]?.text || "";
    // section=full concatenates every section, so it is bounded as the sum
    // rather than as one more independent 8 KB section.
    if (Buffer.byteLength(docsText, "utf8") > 12288) {
      throw new Error(`Gateway docs section=full is ${Buffer.byteLength(docsText, "utf8")} bytes, over the 12 KB ceiling.`);
    }
    if (docsText.includes("[truncated")) {
      throw new Error("Gateway docs section=full was truncated; guidance must be bounded, not cut.");
    }
    if (!docsText.includes(dataRoot)) throw new Error("Gateway docs do not include the active data root.");
    if (!docsText.includes("Keep old ClaraCore service processes untouched")) {
      throw new Error("Gateway docs do not include old-service isolation guidance.");
    }
    if (!docsText.includes("Shared Line context is optional")) {
      throw new Error("Gateway docs do not explain InnerLife Shared Line ambiguity handling.");
    }
    if (!docsText.includes("CLARACORE_CLIENT_ID") || !docsText.includes("CLARACORE_CONVERSATION_ID")) {
      throw new Error("Gateway docs do not include the complete stdio caller context config.");
    }
    if (!docsText.includes("CLARACORE_TOOL_PROFILE")) {
      throw new Error("Gateway docs do not document the stdio tool-profile setting.");
    }
    if (!docsText.includes("stale id")) {
      throw new Error("Gateway docs do not explain the process-scoped stdio conversation limitation.");
    }
    const firstConnectionIndex = docsText.indexOf("## First Connection");
    const identityIndex = docsText.indexOf("## Identity");
    const detailIndex = docsText.indexOf("## MCP Config");
    if (firstConnectionIndex < 0 || identityIndex < firstConnectionIndex || detailIndex < identityIndex) {
      throw new Error("Gateway docs do not front-load first connection and identity.");
    }
    if (!defaultDocsText.includes("truthful connection result")) {
      throw new Error("Gateway docs do not require the first-connection user introduction.");
    }
    if (docsText.includes(`${path.sep}.claracore${path.sep}gateway`) || docsText.includes(`${path.sep}.claracore${path.sep}memoria`)) {
      throw new Error("Gateway docs reference old service data.");
    }

    const status = parseTextResult(await client.callTool("claracore_status"));
    if (status.dataRoot !== dataRoot) throw new Error(`Gateway status data root mismatch: ${status.dataRoot}`);
    if (!status.database?.initialized) throw new Error("Gateway status did not initialize the product database.");
    if (status.connection?.transport !== "stdio" || status.connection?.agentId !== "my-agent") {
      throw new Error(`Gateway status did not expose the actual caller connection: ${JSON.stringify(status.connection)}`);
    }
    if (
      status.configuration?.gateway?.configuredTransport !== "stdio" ||
      status.configuration?.gateway?.defaultAgentId !== "codex"
    ) {
      throw new Error(`Gateway status did not distinguish configured Gateway defaults: ${JSON.stringify(status.configuration?.gateway)}`);
    }
    if (
      status.configuration?.innerlife?.apiKeyStatus !== "configured" ||
      status.configuration?.innerlife?.apiKeyRef !== "inline" ||
      JSON.stringify(status).includes("INLINE_SECRET_MUST_NOT_ESCAPE")
    ) {
      throw new Error("Gateway status leaked an inline API key instead of returning the secret-safe source kind.");
    }
    const connection = parseTextResult(await client.callTool("claracore_connection_test"));
    // v0.6.6: the guide is no longer a mandatory startup read, so onboarding
    // points straight at bounded context. The resolved profile is reported
    // truthfully so a host can tell which manifest it received.
    if (
      JSON.stringify(connection.nextCalls) !== JSON.stringify(["gateway_context"]) ||
      connection.toolProfile !== "full" ||
      !connection.afterOnboarding?.includes("Tell the user")
    ) {
      throw new Error(`Connection test onboarding contract drifted: ${JSON.stringify(connection)}`);
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
    // v0.6.6: write acknowledgements return the resume packet shape.
    if (!contextSharedLine.summary?.includes("Gateway context phase position")) {
      throw new Error("Gateway setup failed to create context Shared Line.");
    }
    const gatewayContext = parseTextResult(
      await client.callTool("gateway_context", {
        agentId: "my-agent",
        query: "Gateway context",
        limit: 5,
        detail: "brief"
      })
    );
    if (gatewayContext.detail !== "brief") {
      throw new Error(`Gateway context did not honor detail=brief: ${gatewayContext.detail}`);
    }
    // v0.6.6: the text field is a small orientation summary. Domain content
    // lives once, in the structured fields.
    if (!gatewayContext.sharedLine?.summary?.includes("Gateway context phase position")) {
      throw new Error(`Gateway context did not include the Shared Line position: ${JSON.stringify(gatewayContext.sharedLine)}`);
    }
    if (gatewayContext.text?.includes("Gateway context phase position")) {
      throw new Error("Gateway context text must not repeat the structured Shared Line summary.");
    }
    if (gatewayContext.sharedLine?.detail !== "resume") {
      throw new Error(`Gateway brief context must embed the Shared Line resume packet: ${gatewayContext.sharedLine?.detail}`);
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
    // v0.6.6 turn-context patch: the prompt must never be persisted verbatim.
    // Long enough that the preview bound has to actually withhold something;
    // the tail is what proves the raw prompt is not persisted.
    const SECRET_TAIL = "zztailmustnotbestoredzz";
    const SECRET_PROMPT = `remember this private detail ${"x".repeat(120)} ${SECRET_TAIL}`;
    // Chinese is the case that broke the bound: slice() counts UTF-16 units, so
    // 80 Chinese characters were persisted as 240 bytes under a constant named
    // BYTES.
    const CJK_TAIL = "尾巴不许入库";
    const CJK_PROMPT = `记住这个私密细节${"中".repeat(120)}${CJK_TAIL}`;
    const autoContext = parseTextResult(
      await client.callTool("gateway_auto_context", { prompt: SECRET_PROMPT })
    );
    if (!autoContext.decision || !autoContext.domainStatus) {
      throw new Error(`gateway_auto_context prompt path did not return a decision: ${JSON.stringify(autoContext)}`);
    }
    if (autoContext.selected && autoContext.selected.evidenceState !== "selected") {
      throw new Error("Automatic context must only ever report the selected evidence state.");
    }
    let mixedRejected = false;
    try {
      await client.callTool("gateway_auto_context", { prompt: "x", memoryCandidates: [] });
    } catch (error) {
      mixedRejected = String(error.message || "").includes("not both");
    }
    if (!mixedRejected) {
      throw new Error("gateway_auto_context must refuse prompt and candidate arrays together.");
    }
    const autoTraces = parseTextResult(await client.callTool("gateway_trace_list", { limit: 20 })).traces || [];
    const autoTraceSummary = autoTraces.find((trace) => trace.toolName === "gateway_auto_context" && trace.status === "ok");
    if (!autoTraceSummary) throw new Error("gateway_auto_context call was not traced.");
    if ("request" in autoTraceSummary) throw new Error("gateway_trace_list must not hydrate request JSON.");
    const autoTrace = parseTextResult(
      await client.callTool("gateway_trace_get", { id: autoTraceSummary.id })
    ).trace;
    if (JSON.stringify(autoTrace.request).includes(SECRET_TAIL)) {
      throw new Error(`Gateway trace persisted the raw prompt: ${JSON.stringify(autoTrace.request)}`);
    }
    if (!autoTrace.request?.prompt?.redacted || !autoTrace.request?.prompt?.hash) {
      throw new Error(`Gateway trace did not redact the prompt: ${JSON.stringify(autoTrace.request)}`);
    }
    if (autoTrace.request.prompt.truncated !== true) {
      throw new Error("A prompt longer than the preview bound must be reported as truncated.");
    }
    if (Buffer.byteLength(autoTrace.request.prompt.preview, "utf8") > 80) {
      throw new Error(`Trace preview exceeded its 80-byte bound: ${autoTrace.request.prompt.preview.length}`);
    }

    await client.callTool("gateway_auto_context", { prompt: CJK_PROMPT });
    const cjkTraces = parseTextResult(await client.callTool("gateway_trace_list", { limit: 20 })).traces || [];
    const cjkTraceSummary = cjkTraces.find((trace) => trace.toolName === "gateway_auto_context" && trace.status === "ok");
    const cjkTrace = cjkTraceSummary
      ? parseTextResult(await client.callTool("gateway_trace_get", { id: cjkTraceSummary.id })).trace
      : null;
    if (cjkTrace?.request?.prompt?.bytes <= 300) {
      throw new Error(`The latest Chinese trace did not preserve bounded prompt evidence: ${JSON.stringify(cjkTrace)}`);
    }
    if (!cjkTrace) throw new Error("The Chinese gateway_auto_context call was not traced.");
    const cjkPreviewBytes = Buffer.byteLength(cjkTrace.request.prompt.preview, "utf8");
    if (cjkPreviewBytes > 80) {
      throw new Error(`Chinese trace preview is ${cjkPreviewBytes} bytes; the bound is bytes, not characters.`);
    }
    if (JSON.stringify(cjkTrace.request).includes(CJK_TAIL)) {
      throw new Error("Gateway trace persisted the raw Chinese prompt.");
    }

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
    const sessionCatalog = parseTextResult(await client.callTool("innerlife_sessions", { limit: 10 }));
    const sessionSummary = sessionCatalog.sessions?.find((session) => session.id === started.session.id);
    if (!sessionSummary || "transcript" in sessionSummary || "metadata" in sessionSummary) {
      throw new Error(`Gateway innerlife_sessions did not return a bounded session summary: ${JSON.stringify(sessionCatalog)}`);
    }
    const sessionDetail = parseTextResult(
      await client.callTool("innerlife_session_get", { id: started.session.id })
    ).session;
    if (sessionDetail.id !== started.session.id) {
      throw new Error(`Gateway innerlife_session_get returned the wrong session: ${JSON.stringify(sessionDetail)}`);
    }
    const updatedProfile = parseTextResult(await client.callTool("innerlife_profile_set", {
      agentId: "my-agent",
      displayName: "My Agent",
      profile: { role: "contract-test" },
      state: { focus: "profile-shape" }
    }));
    if (
      updatedProfile.agentId !== "my-agent" ||
      typeof updatedProfile.profileEnabled !== "boolean" ||
      "enabled" in updatedProfile ||
      "profile_json" in updatedProfile ||
      "state_json" in updatedProfile
    ) {
      throw new Error(`Gateway innerlife_profile_set did not return a normalized profile: ${JSON.stringify(updatedProfile)}`);
    }
    const profileCatalog = parseTextResult(await client.callTool("innerlife_profile_list", { limit: 10 }));
    const profileSummary = profileCatalog.profiles?.find((profile) => profile.agentId === "my-agent");
    if (
      !profileSummary ||
      "profile" in profileSummary ||
      "state" in profileSummary ||
      "enabled" in profileSummary ||
      typeof profileSummary.profileEnabled !== "boolean"
    ) {
      throw new Error(`Gateway innerlife_profile_list leaked rich profile state: ${JSON.stringify(profileCatalog)}`);
    }
    const profileDetail = parseTextResult(
      await client.callTool("innerlife_profile_get", { agentId: "my-agent" })
    ).profile;
    if (
      profileDetail.agentId !== "my-agent" ||
      !profileDetail.profile ||
      !profileDetail.state ||
      "enabled" in profileDetail ||
      typeof profileDetail.profileEnabled !== "boolean"
    ) {
      throw new Error(`Gateway innerlife_profile_get did not recover one complete profile: ${JSON.stringify(profileDetail)}`);
    }
    const activeLine = parseTextResult(
      await client.callTool("shared_line_create", {
        agentId: "my-agent",
        title: "Phase4 active Shared Line"
      })
    ).line;
    if ("active" in activeLine || typeof activeLine.isCurrent !== "boolean") {
      throw new Error(`Shared Line mutation descriptor must distinguish lifecycle from current selection: ${JSON.stringify(activeLine)}`);
    }
    const archivedLine = parseTextResult(
      await client.callTool("shared_line_create", {
        agentId: "my-agent",
        title: "Phase4 archived Shared Line"
      })
    ).line;
    parseTextResult(await client.callTool("shared_line_archive", { lineId: archivedLine.id }));
    const secondActiveLine = parseTextResult(
      await client.callTool("shared_line_create", {
        agentId: "my-agent",
        title: "Phase4 second active Shared Line",
        makeActive: false
      })
    ).line;
    const lineCatalog = parseTextResult(
      await client.callTool("shared_line_list", { agentId: "my-agent", status: "active" })
    );
    if (
      !lineCatalog.lines?.length ||
      lineCatalog.lines.some((line) => "active" in line || typeof line.isCurrent !== "boolean")
    ) {
      throw new Error(`Gateway shared_line_list must distinguish status from isCurrent: ${JSON.stringify(lineCatalog)}`);
    }
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
    if (!startedWithLines.shared_lines?.some((line) => line.id === secondActiveLine.id)) {
      throw new Error(`Gateway innerlife_session_start did not include the second active Shared Line: ${JSON.stringify(startedWithLines.shared_lines)}`);
    }
    if (startedWithLines.shared_lines?.some((line) => line.id === archivedLine.id)) {
      throw new Error(`Gateway innerlife_session_start included an archived Shared Line: ${JSON.stringify(startedWithLines.shared_lines)}`);
    }
    if (startedWithLines.shared_lines?.some((line) => "active" in line || typeof line.isCurrent !== "boolean")) {
      throw new Error(`InnerLife session line summaries must use isCurrent: ${JSON.stringify(startedWithLines.shared_lines)}`);
    }
    if (!startedWithLines.shared_line_error?.includes("SHARED_LINE_ID_REQUIRED")) {
      throw new Error(`Gateway innerlife_session_start should report Shared Line ambiguity without failing: ${JSON.stringify(startedWithLines)}`);
    }
    const structuredSummary = {
      outcome: "Phase4 Gateway session ended.",
      completed: ["Gateway contract validation", "Shared Line ambiguity handling"]
    };
    const ended = parseTextResult(
      await client.callTool("innerlife_session_end", {
        sessionId: started.session.id,
        summary: structuredSummary
      })
    );
    if (ended.session.status !== "ended" || ended.share?.status !== "drafting" || !ended.share?.body) {
      throw new Error("Gateway innerlife_session_end did not create a durable drafting afterthought.");
    }
    const expectedStructuredSummary = JSON.stringify(structuredSummary, null, 2);
    if (ended.session.summary !== expectedStructuredSummary || ended.session.summary.includes("[object Object]")) {
      throw new Error(`Gateway innerlife_session_end did not preserve a structured summary: ${ended.session.summary}`);
    }
    const aliasStarted = parseTextResult(
      await client.callTool("innerlife_session_start", {
        agentId: "my-agent",
        userId: "phase4-user",
        host: "phase4-gateway",
        externalSessionId: "phase4-session-snake-alias"
      })
    );
    const aliasEnded = parseTextResult(
      await client.callTool("innerlife_session_end", {
        session_id: aliasStarted.session.id,
        summary: "Ended through the session_id compatibility alias."
      })
    );
    if (aliasEnded.session.id !== aliasStarted.session.id || aliasEnded.session.status !== "ended") {
      throw new Error("Gateway innerlife_session_end did not accept the session_id compatibility alias.");
    }
    // v0.6.6: the briefing is a decision synthesis with counts, not an
    // aggregate dump with a parallel text block.
    const briefing = parseTextResult(await client.callTool("innerlife_briefing", { agentId: "my-agent" }));
    if (briefing.detail !== "summary" || typeof briefing.counts?.pendingShares !== "number") {
      throw new Error(`Gateway innerlife_briefing did not return the decision synthesis: ${JSON.stringify(briefing)}`);
    }
    if (briefing.sharedLineContext?.status !== "ambiguous" || "sharedLine" in briefing) {
      throw new Error("Ambiguous innerlife_briefing must not select a Shared Line.");
    }
    if ("text" in briefing || Array.isArray(briefing.pendingShares) || Array.isArray(briefing.pendingInbox)) {
      throw new Error("Default innerlife_briefing must not return the aggregate dump.");
    }
    const fullBriefing = parseTextResult(
      await client.callTool("innerlife_briefing", { agentId: "my-agent", detail: "full" })
    );
    if (!fullBriefing.text.includes("Pending shares") || fullBriefing.sharedLineContext?.status !== "ambiguous") {
      throw new Error("Gateway innerlife_briefing detail=full did not return briefing text.");
    }
    const explicitBriefing = parseTextResult(
      await client.callTool("innerlife_briefing", { agentId: "my-agent", lineId: activeLine.id })
    );
    if (explicitBriefing.sharedLineContext?.status !== "selected") {
      throw new Error(`Gateway innerlife_briefing did not honor explicit lineId: ${JSON.stringify(explicitBriefing.sharedLineContext)}`);
    }
    if (explicitBriefing.sharedLine?.lineId !== activeLine.id) {
      throw new Error(`Gateway innerlife_briefing did not select the requested line: ${JSON.stringify(explicitBriefing.sharedLine)}`);
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
    if (
      !digest.digest?.id ||
      !digest.digest?.summary ||
      digest.snapshot.counts.digest_runs_count !== 1 ||
      digest.snapshot.counts.pending_inbox_count !== 0 ||
      digest.sharedLineContext?.status !== "ambiguous" ||
      digest.digest.metadata?.sharedLineStatus !== "ambiguous"
    ) {
      throw new Error("Gateway innerlife_digest did not create a digest record from pending inbox.");
    }
    // v0.6.6: the default status read is operational state only.
    const liteStatus = parseTextResult(await client.callTool("innerlife_status"));
    if (liteStatus.mode !== "status" || liteStatus.sessions || liteStatus.digestRuns) {
      throw new Error(`Gateway innerlife_status should default to operational state: ${JSON.stringify(Object.keys(liteStatus))}`);
    }
    if (liteStatus.pendingShares || liteStatus.pendingInbox) {
      throw new Error("Default innerlife_status must not return share or Inbox bodies.");
    }
    if (typeof liteStatus.work?.hasPendingShares !== "boolean" || typeof liteStatus.work?.pendingInboxCount !== "number") {
      throw new Error(`Default innerlife_status must report pending-work indicators: ${JSON.stringify(liteStatus.work)}`);
    }
    if (
      liteStatus.profiles.some((profile) => "enabled" in profile || typeof profile.profileEnabled !== "boolean") ||
      "enabled" in liteStatus.daemon || typeof liteStatus.daemon.loopEnabled !== "boolean"
    ) {
      throw new Error(`Default innerlife_status must distinguish profile capability from daemon scheduling: ${JSON.stringify(liteStatus)}`);
    }
    const fullStatus = parseTextResult(await client.callTool("innerlife_status", { detail: true }));
    if (!Array.isArray(fullStatus.sessions) || !Array.isArray(fullStatus.digestRuns)) {
      throw new Error(`Gateway innerlife_status detail=true did not return full snapshot fields: ${JSON.stringify(Object.keys(fullStatus))}`);
    }
    const { database } = await runtime.ensureProductCore(app);
    const persistedSession = (await database.query(`
      SELECT summary
      FROM innerlife_sessions
      WHERE id = '${ended.session.id}'
      LIMIT 1;
    `))[0];
    const persistedInbox = (await database.query(`
      SELECT body
      FROM innerlife_inbox
      WHERE id = '${ended.inboxId}'
      LIMIT 1;
    `))[0];
    const persistedEvent = (await database.query(`
      SELECT body
      FROM innerlife_events
      WHERE id = '${ended.eventId}'
      LIMIT 1;
    `))[0];
    if (
      persistedSession?.summary !== expectedStructuredSummary ||
      persistedInbox?.body !== expectedStructuredSummary ||
      persistedEvent?.body !== expectedStructuredSummary
    ) {
      throw new Error("Gateway innerlife_session_end did not preserve structured summary text across session, inbox, and event rows.");
    }
    await database.exec(`
      UPDATE innerlife_shares
      SET status = 'pending',
          body = 'Generated Gateway afterthought ready for sharing review.',
          updated_at = CURRENT_TIMESTAMP
      WHERE id IN ('${ended.share.id}', '${aliasEnded.share.id}')
        AND status = 'drafting';

      UPDATE innerlife_inbox
      SET status = 'processed',
          processed_at = CURRENT_TIMESTAMP,
          metadata_json = json_set(metadata_json, '$.retryState', 'succeeded')
      WHERE source = 'session_end_afterthought'
        AND json_extract(metadata_json, '$.shareId') IN ('${ended.share.id}', '${aliasEnded.share.id}');
    `);
    const completedAfterthought = await database.getInnerLifeShare(ended.share.id);
    if (completedAfterthought.status !== "pending" || completedAfterthought.body.includes("Session afterthought")) {
      throw new Error(`Gateway afterthought did not become shareable with generated content: ${JSON.stringify(completedAfterthought)}`);
    }
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
    const daemonInbox = parseTextResult(
      await client.callTool("innerlife_submit_inbox", {
        agentId: "my-agent",
        source: "phase4-daemon-ambiguous-line",
        body: "Daemon should process this inbox even when Shared Line selection is ambiguous."
      })
    );
    if (!daemonInbox.inbox?.id) throw new Error("Gateway daemon ambiguity setup did not create inbox material.");
    const daemonTick = parseTextResult(await client.callTool("innerlife_daemon_tick", { agentId: "my-agent", force: true }));
    if (
      daemonTick.ran !== true ||
      daemonTick.reason !== "processed" ||
      daemonTick.daemon?.tickCount !== 1 ||
      daemonTick.result?.sharedLineContext?.status !== "ambiguous"
    ) {
      throw new Error(`Gateway innerlife_daemon_tick did not process inbox with ambiguous Shared Lines: ${JSON.stringify(daemonTick)}`);
    }
    const daemonPaused = parseTextResult(await client.callTool("innerlife_daemon_set", { agentId: "my-agent", action: "pause" }));
    if (daemonPaused.enabled || daemonPaused.status !== "paused") {
      throw new Error(`Gateway innerlife_daemon_set did not pause daemon: ${JSON.stringify(daemonPaused)}`);
    }
    const shareCheck = parseTextResult(
      await client.callTool("innerlife_share_check", {
        agentId: "my-agent",
        shareId: ended.share.id,
        sessionId: "phase4-session-001",
        context: "Gateway asks whether this session afterthought can be shared now."
      })
    );
    if (shareCheck.check?.decision !== "review_first") {
      throw new Error(`Gateway innerlife_share_check did not record a review-first decision: ${JSON.stringify(shareCheck.check)}`);
    }
    if (shareCheck.check?.metadata?.sharedLineStatus !== "ambiguous" || shareCheck.check?.metadata?.contextSource !== "provided") {
      throw new Error(`Gateway innerlife_share_check did not preserve provided context across Shared Line ambiguity: ${JSON.stringify(shareCheck.check)}`);
    }
    if (shareCheck.check?.sessionId !== started.session.id) {
      throw new Error(`Gateway innerlife_share_check did not resolve externalSessionId to the canonical session: ${JSON.stringify(shareCheck.check)}`);
    }
    if (!shareCheck.share?.body || shareCheck.snapshot || shareCheck.status?.pendingShares) {
      throw new Error(`Gateway innerlife_share_check must return one complete share without repeating the pending catalog: ${JSON.stringify(shareCheck)}`);
    }
    if (Buffer.byteLength(JSON.stringify(shareCheck), "utf8") > CONTEXT_BUDGET_CEILINGS.innerlifeShareCheckDefault) {
      throw new Error(`Gateway innerlife_share_check exceeded its default context budget: ${Buffer.byteLength(JSON.stringify(shareCheck), "utf8")} bytes.`);
    }
    const unknownSessionShareCheck = parseTextResult(
      await client.callTool("innerlife_share_check", {
        agentId: "my-agent",
        shareId: ended.share.id,
        sessionId: "unregistered-caller-conversation",
        context: "Gateway checks a share when the caller has no registered InnerLife session."
      })
    );
    if (unknownSessionShareCheck.check?.sessionId !== null) {
      throw new Error(`Gateway innerlife_share_check should ignore an unknown optional session id: ${JSON.stringify(unknownSessionShareCheck.check)}`);
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
    const rejectedRemark = parseTextResult(
      await client.callTool("innerlife_mark_share", {
        id: ended.share.id,
        action: "used",
        reason: "Gateway contract illegal transition",
        deliveryEvidence: {
          conversationId: "phase4-conversation",
          responseExcerpt: "The generated Gateway afterthought was included in this response.",
          sharedAt: "2026-08-25T06:00:00.000Z"
        }
      })
    );
    if (
      rejectedRemark.ok !== false ||
      rejectedRemark.error?.code !== "INNERLIFE_SHARE_INVALID_TRANSITION" ||
      rejectedRemark.share?.status !== "discarded" ||
      rejectedRemark.share?.body !== completedAfterthought.body
    ) {
      throw new Error(`Gateway illegal share transition did not return current content: ${JSON.stringify(rejectedRemark)}`);
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
