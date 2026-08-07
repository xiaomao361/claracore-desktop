const { toolDefinitions } = require("./tool-definitions");

const DEFAULT_PROFILE = "core";
const PROFILE_NAMES = Object.freeze(["core", "full"]);

// Core profile shaping.
//
// `full` returns the canonical definitions byte-for-byte. `core` is a smaller
// maintained manifest for normal connection, recall, continuation, and
// selective sharing work. Gateway tool input is not schema-validated, so a
// narrowed `properties` allowlist only reduces what is advertised to the model;
// handlers still accept every argument the full profile documents.
//
// Shape fields per tool:
//   description  compact replacement for the canonical tool description
//   properties   allowlist of advertised inputSchema properties (null = all)
//   propertyDescriptions  short descriptions to keep; every other nested
//                         `description` in the schema is stripped
const CORE_TOOL_SHAPES = Object.freeze({
  claracore_status: {
    description: "Read ClaraCore Desktop product data status."
  },
  claracore_connection_test: {
    description: "Verify this agent can reach ClaraCore Desktop and record a visible handshake trace."
  },
  gateway_docs: {
    description:
      "Read the ClaraCore Desktop agent guide. Returns a small default summary; pass section for a specific topic."
  },
  gateway_context: {
    description:
      "Read one assembled context packet from Memory, Shared Line, and InnerLife. Start with detail=brief and no lineId; SHARED_LINE_ID_REQUIRED means multiple active lines, so retry with one candidate lineId."
  },
  gateway_auto_context: {
    // core advertises only the host contract. The candidate arrays are the
    // compatibility/test path and stay in the full profile, which also keeps
    // this tool smaller in core than it was before prompt existed.
    description:
      "Arbitrate automatic per-prompt Memory context in one call. Pass prompt; the Gateway runs the Memory Controller and returns one bounded block or abstains. InnerLife is not collected here — a waiting thought is gated by register, not topic, so use innerlife_share_check. Read-only; it never marks delivery or use.",
    properties: ["prompt", "sessionId", "agentId"]
  },
  memory_context: {
    description:
      "Run the deterministic Memory Controller for the authenticated caller. Off by default; observe mode records decisions without context. Use memoria_search for explicit research.",
    properties: ["prompt", "timeView"]
  },
  memoria_search: {
    description:
      "Search Memory. Search before writing a possibly changed fact. Returns three bounded summaries with memoria_get detail refs. Defaults to current facts; use timeView=historical or all only when prior state matters.",
    properties: ["query", "limit", "timeView", "detail"]
  },
  memoria_get: {
    description: "Get one full Memory record by id."
  },
  memoria_create: {
    description:
      "Create a Memory record. Search first. Keep one record to one fact and add stable labels."
  },
  memoria_update: {
    description:
      "Update an active Memory when correcting or refining the same fact. Omitted fields are preserved. A confirmed replacement is a new Memory plus memoria_supersede."
  },
  memoria_link_create: {
    description:
      "Link two Memories. Kinds: related, causes, evolved-from, contradicts, part-of. Use contradicts for unresolved conflict.",
    properties: ["fromMemoryId", "toMemoryId", "kind", "note"]
  },
  memoria_record_create: {
    description:
      "Create a typed structured record such as a metric or recurring log entry. Use dedupeKey when the event may be written again.",
    properties: ["userId", "recordType", "title", "value", "occurredAt", "note", "dedupeKey"]
  },
  shared_line_list: {
    description: "List Shared Lines and identify the active line. Pass status to narrow to active or archived."
  },
  shared_line_get: {
    description:
      "Read one Shared Line as a resume packet. Agent-level state is not repeated per line; load it once per session with shared_line_agent_state. Pass lineId for an exact line. Without lineId an identified agent defaults only when it owns zero or one active line; otherwise SHARED_LINE_ID_REQUIRED returns candidates.",
    properties: ["lineId", "agentId", "detail"]
  },
  shared_line_create: {
    description: "Create a Shared Line and optionally make it active."
  },
  shared_line_activate: {
    description: "Switch the active Shared Line."
  },
  shared_line_update: {
    description:
      "Update a Shared Line after meaningful progress. Pass lineId to write an exact line; without it, multiple active lines return SHARED_LINE_ID_REQUIRED and nothing is written. Use interpretationStatus=needs_review when state is uncertain.",
    properties: [
      "lineId",
      "agentId",
      "summary",
      "interpretationStatus",
      "factsUsed",
      "nextStep",
      "model",
      "confirmOverwrite",
      "detail"
    ]
  },
  shared_line_handoff_create: {
    description: "Record a formal handoff from the current shared position."
  },
  shared_line_agent_state: {
    description:
      "Read or update agent-level Continuity state: communication style, relationship position, preferences, boundaries, patterns. Load once per session, not per line read."
  },
  innerlife_session_start: {
    description:
      "Start an InnerLife session. Returns session id, a compact share_plan, and a Shared Line resume packet. Pass lineId to select an exact line.",
    properties: ["agentId", "userId", "host", "externalSessionId", "lineId", "includeBriefing", "detail"]
  },
  innerlife_session_end: {
    description:
      "End an InnerLife session with a structured summary of the real conversation. Hosts may pass bestEffort=true so a missing session is a safe no-op.",
    properties: ["sessionId", "summary", "transcript", "bestEffort"],
    required: ["sessionId"]
  },
  innerlife_status: {
    description:
      "Read InnerLife operational state: counts, daemon, doctor, and indicators that work is waiting. No share or Inbox bodies. Pass detail=true for the full snapshot."
  },
  innerlife_pending_shares: {
    description:
      "List InnerLife share candidates as bounded previews, three by default. Reading candidates never marks delivery.",
    properties: ["status", "limit", "detail"]
  },
  innerlife_share_check: {
    description:
      "Check whether a waiting share fits the current context. Pass the real conversation context, not keywords.",
    properties: ["agentId", "lineId", "shareId", "sessionId", "context"]
  },
  innerlife_mark_share: {
    description:
      "Mark a share used, deferred, or discarded. action=used requires deliveryEvidence taken from the response that actually said it."
  },
  innerlife_submit_inbox: {
    description: "Submit material into the InnerLife inbox for later autonomous processing.",
    properties: ["agentId", "source", "body"]
  }
});

const CORE_TOOL_NAMES = Object.freeze(Object.keys(CORE_TOOL_SHAPES));

function normalizeProfile(value) {
  const name = String(value || "").trim().toLowerCase();
  return PROFILE_NAMES.includes(name) ? name : DEFAULT_PROFILE;
}

function stripDescriptions(node, keep) {
  if (Array.isArray(node)) return node.map((item) => stripDescriptions(item, keep));
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "description") continue;
    out[key] = stripDescriptions(value, keep);
  }
  return out;
}

function shapeSchema(schema, shape) {
  const source = schema && typeof schema === "object" ? schema : { type: "object", properties: {} };
  const allowed = Array.isArray(shape.properties) ? new Set(shape.properties) : null;
  const properties = {};
  for (const [name, definition] of Object.entries(source.properties || {})) {
    if (allowed && !allowed.has(name)) continue;
    const stripped = stripDescriptions(definition);
    const kept = shape.propertyDescriptions?.[name];
    properties[name] = kept ? { ...stripped, description: kept } : stripped;
  }

  const shaped = { type: source.type || "object" };
  const required = Array.isArray(shape.required)
    ? shape.required
    : (source.required || []).filter((name) => !allowed || allowed.has(name));
  if (required.length) shaped.required = required;
  shaped.properties = properties;
  if (source.additionalProperties === false) shaped.additionalProperties = false;
  return shaped;
}

function shapeCoreTool(definition) {
  const shape = CORE_TOOL_SHAPES[definition.name];
  return {
    name: definition.name,
    title: definition.title,
    description: shape.description || definition.description,
    inputSchema: shapeSchema(definition.inputSchema, shape)
  };
}

function profileToolDefinitions(profile) {
  const name = normalizeProfile(profile);
  const canonical = toolDefinitions();
  if (name === "full") return canonical;
  const byName = new Map(canonical.map((tool) => [tool.name, tool]));
  return CORE_TOOL_NAMES.map((toolName) => {
    const definition = byName.get(toolName);
    if (!definition) throw new Error(`Core tool profile references unknown tool: ${toolName}`);
    return shapeCoreTool(definition);
  });
}

function createProfileToolDefinitions(profile) {
  const name = normalizeProfile(profile);
  return () => profileToolDefinitions(name);
}

module.exports = {
  CORE_TOOL_NAMES,
  CORE_TOOL_SHAPES,
  DEFAULT_PROFILE,
  PROFILE_NAMES,
  createProfileToolDefinitions,
  normalizeProfile,
  profileToolDefinitions
};
