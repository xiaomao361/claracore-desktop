const { BUILD_FLAVOR, HAS_BUILT_IN_EMBEDDING } = require("../build-flavor");

// This value is intentionally not derived from package.json. Every product
// version bump must explicitly confirm that the Agent Guide still describes
// the shipped product; context-budget-smoke enforces parity.
const DOCS_RELEASE = Object.freeze({
  version: "0.6.10",
  updatedAt: "2026-08-13"
});

const DOCS_SECTIONS = Object.freeze([
  "start",
  "memory",
  "shared-line",
  "innerlife",
  "diagnostics",
  "full"
]);

const DEFAULT_DOCS_BYTES = 4096;
const SECTION_DOCS_BYTES = 8192;
// `full` is the concatenation of every section, not an independent one, so the
// 8 KB per-section bound does not apply to it. Truncating it would silently
// drop guidance; give it room for the sum instead.
const FULL_SECTION_DOCS_BYTES = 12288;
const SEARCH_DOCS_BYTES = 6144;

const STARTUP_SEQUENCE =
  "claracore_connection_test -> gateway_context(detail=brief, no lineId) -> retry with one candidate lineId only after SHARED_LINE_ID_REQUIRED";

function normalizeSection(value) {
  const section = String(value || "").trim().toLowerCase();
  if (!section) return "";
  if (!DOCS_SECTIONS.includes(section)) {
    throw new Error(`gateway_docs section must be one of: ${DOCS_SECTIONS.join(", ")}.`);
  }
  return section;
}

function normalizeQuery(value) {
  const query = String(value || "").replace(/\s+/g, " ").trim();
  if (query.length > 200) throw new Error("gateway_docs query must be 200 characters or fewer.");
  return query;
}

function releaseHeader() {
  return `Guide version: ${DOCS_RELEASE.version} · Updated: ${DOCS_RELEASE.updatedAt}`;
}

function boundText(text, maxBytes) {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  const notice = "\n\n[truncated: request a narrower gateway_docs section]";
  const budget = maxBytes - Buffer.byteLength(notice, "utf8");
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(characters.slice(0, middle).join(""), "utf8") <= budget) low = middle;
    else high = middle - 1;
  }
  return characters.slice(0, low).join("") + notice;
}

function embeddingLine() {
  return HAS_BUILT_IN_EMBEDDING
    ? "Memory embedding uses the built-in Xenova/bge-small-zh-v1.5 model. It is not a chat or InnerLife model."
    : "This Lite build has no built-in Memory embedding model. Select an installed Ollama embedding model or disable semantic embeddings.";
}

function defaultDocs({ toolProfile }) {
  return [
    "# ClaraCore Desktop Agent Guide",
    releaseHeader(),
    "",
    "You are connected through MCP. MCP tools are the product contract; do not read packaged app source.",
    `Tool profile: ${toolProfile}. The core profile advertises a smaller manifest; full-profile tools still execute if called by name.`,
    "",
    "## Domains",
    "",
    "- Memory: durable reviewed facts, preferences, and decisions. Search before writing.",
    "- Shared Line: the current resumable working position, not long-term fact storage.",
    "- InnerLife: background thoughts shared only when timely. Never auto-promote into Memory or Shared Line.",
    "",
    "## Startup",
    "",
    STARTUP_SEQUENCE,
    "",
    "Then tell the user the truthful connection result and a bounded summary of the context you actually read. If context is empty or ambiguous, say so.",
    "",
    "## Safety",
    "",
    "- Do not mutate SQLite directly; use MCP tools.",
    "- Do not stop or replace external legacy ClaraCore services.",
    "- Never claim a line, memory, thought, model, or health state that tools did not return.",
    "",
    "## Defaults",
    "",
    "Minimum sufficient by default; disclose more through explicit scope; explicit reads remain bounded. General catalogs default to 10 and accept an explicit limit up to 50:",
    "",
    "- memoria_search: 3 bounded summaries -> memoria_get, or detail=full",
    "- memoria_link_list and memoria_record_list: bounded catalogs -> memoria_get or memoria_record_get",
    "- writes: bounded acknowledgement -> returned detailRef",
    "- shared_line_list: bounded catalog -> shared_line_get",
    "- shared_line_get: a resume packet -> detail=context, detail=full",
    "- innerlife_status: operational state only -> detail=true",
    "- innerlife_pending_shares: 3 previews -> innerlife_share_check returns one complete share without repeating the catalog, or detail=full",
    "- innerlife_briefing: one decision synthesis -> detail=full",
    "- gateway_context: omitted detail defaults to brief -> detail=full",
    "- gateway_trace_list: bounded summaries -> gateway_trace_get",
    "",
    "## Sections",
    "",
    "Call gateway_docs with section= for detail:",
    "",
    "- start: first connection, identity headers, MCP config, model defaults",
    "- memory: Memoria write/search/link/supersede rules and automatic recall",
    "- shared-line: line selection, ambiguity recovery, update and handoff rules",
    "- innerlife: sessions, share timing, delivery evidence",
    "- diagnostics: health, traces, CLI fallback",
    "- full: every section at once",
    "- query: search maintained passages across all sections",
    "",
    "Tool names and argument schemas come from tools/list, not from this guide."
  ].join("\n");
}

function startSection({ launch, paths, toolProfile }) {
  return [
    "## First Connection",
    "",
    "1. Call claracore_connection_test once after installing or changing MCP config.",
    "2. Call gateway_context with detail=brief and no lineId.",
    "3. If it returns SHARED_LINE_ID_REQUIRED, choose one returned candidate and retry with that lineId.",
    "4. Tell the user, in their language, what ClaraCore enables and what resumable context you found.",
    "",
    "## Identity",
    "",
    "Use a stable persona id per agent. Preferred ids: lara, clara, codex.",
    "Streamable HTTP: X-ClaraCore-Agent-ID, X-ClaraCore-Client-ID, X-ClaraCore-Conversation-ID, and optional X-ClaraCore-Tool-Profile.",
    "Stdio: CLARACORE_AGENT_ID, optional CLARACORE_CLIENT_ID, CLARACORE_CONVERSATION_ID, and CLARACORE_TOOL_PROFILE.",
    `Tool profile values are core or full; an unknown or missing value resolves to core. Current profile: ${toolProfile}.`,
    "Caller conversation ids never replace domain ids such as InnerLife sessionId.",
    "To consolidate an old tool-prefixed id, use agent_identity_merge instead of editing SQLite.",
    "",
    "## Model Defaults",
    "",
    `- Desktop build flavor: ${BUILD_FLAVOR}.`,
    `- ${embeddingLine()}`,
    "- InnerLife defaults to an OpenAI-compatible DeepSeek provider when Desktop configures one.",
    "- A disabled or unreachable provider must be reported, not replaced with invented output.",
    "",
    "## MCP Config",
    "",
    "Prefer the Streamable HTTP endpoint shown in Agent Access. Use this stdio config only as a compatibility fallback.",
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
              ...launch.env,
              CLARACORE_AGENT_ID: "<agent-stable-id>",
              CLARACORE_CLIENT_ID: "<codex-app|claude-code|hermes>",
              CLARACORE_TOOL_PROFILE: "core",
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
    "Replace the placeholders before use. Add CLARACORE_CONVERSATION_ID only when the client relaunches the MCP process per host conversation; otherwise a stale id is traced across unrelated conversations."
  ].join("\n");
}

function searchDocs(query, parts) {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9_-]{2,}/g) || [])];
  const candidates = Object.entries(parts).flatMap(([section, build]) =>
    build()
      .split(/\n{2,}/)
      .map((text, index) => ({ section, index, text: text.trim() }))
      .filter((item) => item.text)
  );
  const matches = candidates
    .map((item) => ({
      ...item,
      score: terms.reduce((total, term) => total + (item.text.toLowerCase().includes(term) ? 1 : 0), 0)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.section.localeCompare(right.section) || left.index - right.index)
    .slice(0, 8);

  const body = matches.length
    ? matches.map((item) => `## ${item.section}\n\n${item.text}`).join("\n\n")
    : [
        "No matching guide passage was found.",
        "Try gateway_docs with one section: start, memory, shared-line, innerlife, diagnostics, or full.",
        "Tool names and argument schemas come from tools/list."
      ].join("\n\n");
  return [
    "# ClaraCore Desktop Agent Guide Search",
    releaseHeader(),
    `Query: ${query}`,
    "",
    body
  ].join("\n");
}

function memorySection() {
  return [
    "## Memory / Memoria",
    "",
    "- Search with memoria_search before creating a memory. It returns three bounded summaries; raise limit only when one read genuinely needs more, and use detail=full or memoria_get for a whole record.",
    "- A default search does not carry embedding operational metadata or related records. Ask for them explicitly.",
    "- Default timeView=current; use historical or all only when prior state is the question.",
    "- memoria_create is for durable, factual, reviewable information. One memory holds one fact or decision.",
    "- Label at write time: agent-id:<your-agent-id>, project/module labels, stable topic labels.",
    "- memoria_update corrects or refines the same fact. For a confirmed changed state, create the new fact and call memoria_supersede.",
    "- memoria_supersede direction is currentMemoryId (new) -> historicalMemoryId (old). Never delete history merely because it is no longer current.",
    "- memoria_link_create kinds: related, causes, evolved-from, contradicts, part-of. Use contradicts when the conflict is unresolved.",
    "- Add a short link note explaining why the connection exists. Call memoria_link_list before adding more links.",
    "- memoria_link_list is a bounded catalog; use memoria_get on one endpoint for its body.",
    "- memoria_record_create is for structured recurring logs or metrics, not prose. Its acknowledgement omits value and metadata; use memoria_record_get for one complete record.",
    "",
    "### Record a durable fact",
    "",
    "1. memoria_search the topic.",
    "2. Same fact -> memoria_update.",
    "3. Confirmed replacement -> memoria_create the new fact, then memoria_supersede.",
    "4. Unresolved conflict -> memoria_link_create with kind=contradicts.",
    "5. Independent and new -> memoria_create with stable labels.",
    "",
    "### Automatic recall",
    "",
    "- memory_context runs the deterministic Memory Controller for the authenticated caller. Off is the default; observe returns bounded evidence with empty context.",
    "- The trusted canary returns at most one current project-scoped Memory owned by the authenticated caller. Unidentified callers and historical/all views stay context-free.",
    "- Treat canary context as prior read-only evidence. Verify current code, runtime, data, and user statements before acting, and never mutate Memory because of that block.",
    "- Use explicit memoria_search for user-requested research, maintenance, audit, or historical comparison."
  ].join("\n");
}

function sharedLineSection() {
  return [
    "## Shared Line",
    "",
    "- Shared Line is the current resumable working position, not long-term fact storage.",
    "- shared_line_get returns a resume packet: line, summary, interpretation status, facts used, next step, and at most one recent handoff. Use detail=context for relevant Shared Reality and detail=full for history, snapshots, arcs, and agent state.",
    "- Start resume reads with gateway_context; omitted detail defaults to brief. shared_line_list is a bounded catalog and shared_line_get expands one selected line. In the catalog, status is lifecycle and isCurrent is only the globally selected fallback; an Agent-filtered page may have no current row.",
    "- SHARED_LINE_ID_REQUIRED is a safe refusal: nothing was read or written. Pick a candidate and retry with lineId.",
    "- A request without lineId is allowed only when your agent owns zero or one active non-default line.",
    "- shared_line_update after meaningful progress, handoff, or changed interpretation. Keep summary concise and actionable.",
    "- When a dynamic line has no concrete resumable next step, record its verified final position, set interpretationStatus=closed, then shared_line_archive it. Archiving preserves history.",
    "- interpretationStatus=needs_review when the state is uncertain and the next agent should be cautious.",
    "- shared_line_handoff_create when explicitly handing work to another agent or a future session.",
    "- Agent-level state (style, preferences, boundaries, patterns) lives in shared_line_agent_state. Load it once per session, not once per line read.",
    "",
    "### Update the current line",
    "",
    "1. shared_line_list with status=active and choose the intended line.",
    "2. Pass that explicit lineId to shared_line_get or gateway_context.",
    "3. Pass the same lineId to shared_line_update after progress.",
    "4. Use confirmOverwrite only when knowingly replacing a confirmed position."
  ].join("\n");
}

function innerLifeSection() {
  return [
    "## InnerLife",
    "",
    "- innerlife_session_start at the beginning of a real work session; it returns the session id, a compact share_plan, and a Shared Line resume packet.",
    "- innerlife_session_end with a structured summary of the actual conversation. Do not invent an afterthought; InnerLife decides whether one exists.",
    "- innerlife_status returns operational state only: counts, daemon, doctor, and whether work is waiting. profileEnabled is profile participation across all InnerLife profile tools; loopEnabled is daemon scheduling. Pass detail=true for the full snapshot.",
    "- In Gateway trace request detail, truncated means one text field was shortened, previewOnly means the whole request was replaced by a bounded preview, and serializationFailed means JSON conversion failed.",
    "- innerlife_pending_shares returns three bounded previews. General catalogs default to 10 rows and accept an explicit page up to 50; expand one object or one useful page instead of treating the ceiling as a target.",
    "- innerlife_share_check before surfacing a waiting share. It returns one complete share plus compact timing and operational evidence, not a repeated pending catalog. Pass real conversation context, not keywords. Topic overlap is supporting evidence rather than a hard gate; review the returned thought against the conversational register. Use at most one share per turn.",
    "- A waiting thought does not have to be about the current topic. The gate is register, not relevance: an off-topic engineering thought during engineering work is fine, the same thought during an intimate conversation is not. Automatic context never delivers shares for exactly this reason — only the model can read register.",
    "- innerlife_mark_share reports the outcome. action=used requires deliveryEvidence with conversationId, a responseExcerpt of at least 12 characters taken from what you actually said, and sharedAt. deferred and discarded need no evidence.",
    "- Reading candidates never marks delivery. Pending content stays pending until an explicit action.",
    "- innerlife_submit_inbox, innerlife_submit_fact, and innerlife_submit_continuity are for material to digest later, not immediate factual recall.",
    "- Shared Line context is optional. Pass lineId when one line matters; when several are active and lineId is omitted, briefing, digest, daemon tick, and share checks continue with sharedLineContext.status=ambiguous.",
    "- innerlife_doctor when InnerLife seems idle, paused, or misconfigured.",
    "- InnerLife may only open a topic inside a live session. It never authorizes out-of-session notifications."
  ].join("\n");
}

function diagnosticsSection({ launch, paths }) {
  return [
    "## Gateway / Diagnostics",
    "",
    "- claracore_status for product health, this authenticated connection, and secret-safe configuration. Inline API keys are reported only as inline; env references remain visible.",
    "- gateway_trace_list returns bounded recent summaries; gateway_trace_get opens one request record. The operator can see these traces.",
    "- Every final tool response is capped. GATEWAY_RESPONSE_TOO_LARGE means narrow a page, select one object, or request an artifact.",
    "- gateway_auto_context arbitrates automatic per-prompt Memory context and returns one bounded block or abstains. It never marks delivery or use, and it never delivers InnerLife shares.",
    "- Keep tool calls bounded. Never mutate SQLite directly.",
    "- Do not read local source files as the normal workflow; packaged Desktop runs from app.asar.",
    "",
    "## CLI Fallback",
    "",
    "Use only when MCP is unavailable and the operator has granted local shell access:",
    "",
    launch.displayCommand,
    "",
    `Source: ${launch.source}`,
    `Data root: ${paths.dataRoot}`,
    "",
    "Keep old ClaraCore service processes untouched."
  ].join("\n");
}

function buildGatewayDocs({ section, query, launch, paths, toolProfile }) {
  const requested = normalizeSection(section);
  const normalizedQuery = normalizeQuery(query);
  if (requested && normalizedQuery) {
    throw new Error("gateway_docs accepts either section or query, not both.");
  }
  const context = { launch, paths, toolProfile: toolProfile || "core" };

  if (!requested && !normalizedQuery) {
    return {
      section: "default",
      sections: DOCS_SECTIONS,
      text: boundText(defaultDocs(context), DEFAULT_DOCS_BYTES)
    };
  }

  const parts = {
    start: () => startSection(context),
    memory: () => memorySection(),
    "shared-line": () => sharedLineSection(),
    innerlife: () => innerLifeSection(),
    diagnostics: () => diagnosticsSection(context)
  };

  if (normalizedQuery) {
    return {
      section: "search",
      sections: DOCS_SECTIONS,
      text: boundText(searchDocs(normalizedQuery, parts), SEARCH_DOCS_BYTES)
    };
  }

  const text =
    requested === "full"
      ? ["# ClaraCore Desktop Agent Guide", releaseHeader(), "", ...Object.values(parts).map((build) => `${build()}\n`)].join("\n")
      : [releaseHeader(), "", parts[requested]()].join("\n");

  return {
    section: requested,
    sections: DOCS_SECTIONS,
    text: boundText(text, requested === "full" ? FULL_SECTION_DOCS_BYTES : SECTION_DOCS_BYTES)
  };
}

module.exports = {
  DEFAULT_DOCS_BYTES,
  DOCS_RELEASE,
  DOCS_SECTIONS,
  FULL_SECTION_DOCS_BYTES,
  SECTION_DOCS_BYTES,
  SEARCH_DOCS_BYTES,
  buildGatewayDocs,
  normalizeQuery,
  normalizeSection
};
