const DEFAULT_CATALOG_LIMIT = 10;
const MAX_CATALOG_LIMIT = 50;

function boundedText(value, maxBytes) {
  const text = String(value || "");
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(characters.slice(0, middle).join(""), "utf8") <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return characters.slice(0, low).join("");
}

function normalizeCatalogPaging(input = {}, options = {}) {
  const defaultLimit = Number(options.defaultLimit || DEFAULT_CATALOG_LIMIT);
  const maxLimit = Number(options.maxLimit || MAX_CATALOG_LIMIT);
  const requestedLimit = Number.parseInt(String(input.limit ?? defaultLimit), 10);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : defaultLimit, maxLimit));
  const offset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
  return { requestedLimit, limit, offset };
}

function catalogPage(items, total, paging, extra = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeTotal = Math.max(0, Number(total || 0));
  return {
    ...extra,
    returned: safeItems.length,
    total: safeTotal,
    limit: paging.limit,
    offset: paging.offset,
    requestCapped: Number.isFinite(paging.requestedLimit) && paging.requestedLimit > paging.limit,
    hasMore: paging.offset + safeItems.length < safeTotal
  };
}

function shapeSharedLineCatalogEntry(line = {}) {
  return {
    id: line.id || "",
    agentId: line.agentId || "",
    title: boundedText(line.title, 160),
    status: line.status || "active",
    isCurrent: Boolean(line.active),
    summary: boundedText(line.summary, 360),
    interpretationStatus: line.interpretationStatus || "draft",
    nextStep: boundedText(line.nextStep, 240),
    createdAt: line.createdAt || null,
    updatedAt: line.updatedAt || null,
    positionUpdatedAt: line.positionUpdatedAt || null,
    detailRef: { tool: "shared_line_get", arguments: { lineId: line.id || "" } }
  };
}

function shapeMemoryLinkCatalogEntry(link = {}) {
  return {
    id: link.id || "",
    fromMemoryId: link.fromMemoryId || "",
    toMemoryId: link.toMemoryId || "",
    fromTitle: boundedText(link.fromTitle, 160),
    toTitle: boundedText(link.toTitle, 160),
    fromStatus: link.fromStatus || "active",
    toStatus: link.toStatus || "active",
    kind: link.kind || "related",
    strength: Number(link.strength || 0),
    source: link.source || "",
    note: boundedText(link.note, 240),
    createdAt: link.createdAt || null,
    updatedAt: link.updatedAt || null,
    detailRefs: {
      from: { tool: "memoria_get", arguments: { id: link.fromMemoryId || "" } },
      to: { tool: "memoria_get", arguments: { id: link.toMemoryId || "" } }
    }
  };
}

function shapeMemoryAck(memory = {}) {
  return {
    id: memory.id || "",
    title: boundedText(memory.title, 160),
    status: memory.status || "active",
    sensitivity: memory.sensitivity || "normal",
    labels: (memory.labels || []).slice(0, 8).map((label) => boundedText(label, 80)),
    embeddingStatus: memory.embedding_status || memory.embeddingStatus || "pending",
    createdAt: memory.created_at || memory.createdAt || null,
    updatedAt: memory.updated_at || memory.updatedAt || null,
    detailRef: { tool: "memoria_get", arguments: { id: memory.id || "" } }
  };
}

function shapeMemoryCatalogEntry(memory = {}) {
  return {
    id: memory.id || "",
    title: boundedText(memory.title, 240),
    status: memory.status || "active",
    sensitivity: memory.sensitivity || "normal",
    labels: (memory.labels || []).slice(0, 8).map((label) => boundedText(label, 80)),
    createdAt: memory.createdAt || memory.created_at || null,
    updatedAt: memory.updatedAt || memory.updated_at || null,
    detailRef: { tool: "memoria_get", arguments: { id: memory.id || "" } }
  };
}

function shapeMemoryRecordCatalogEntry(record = {}) {
  return {
    id: record.id || "",
    userId: record.userId || "local-user",
    recordType: record.recordType || "",
    title: boundedText(record.title, 160),
    valueType: record.valueType || "object",
    notePreview: boundedText(record.notePreview || record.note, 240),
    occurredAt: record.occurredAt || null,
    localDate: record.localDate || "",
    timezone: record.timezone || "",
    status: record.status || "active",
    memoryId: record.memoryId || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    detailRef: { tool: "memoria_record_get", arguments: { id: record.id || "" } }
  };
}

function shapeInnerLifeSessionCatalogEntry(session = {}) {
  return {
    id: session.id || "",
    agentId: session.agentId || "",
    userId: boundedText(session.userId, 100),
    host: boundedText(session.host, 120),
    externalSessionId: boundedText(session.externalSessionId, 200),
    status: session.status || "",
    startedAt: session.startedAt || null,
    endedAt: session.endedAt || null,
    summary: boundedText(session.summary, 600),
    detailRef: { tool: "innerlife_session_get", arguments: { id: session.id || "" } }
  };
}

function shapeGatewayTraceCatalogEntry(trace = {}) {
  return {
    id: trace.id || "",
    agentId: boundedText(trace.agentId, 100),
    clientId: boundedText(trace.clientId, 120),
    conversationId: boundedText(trace.conversationId, 160),
    transport: trace.transport || "stdio",
    toolName: boundedText(trace.toolName, 120),
    status: trace.status || "",
    durationMs: Number(trace.durationMs || 0),
    responseSummary: boundedText(trace.responseSummary, 400),
    error: boundedText(trace.error, 400),
    createdAt: trace.createdAt || null,
    detailRef: { tool: "gateway_trace_get", arguments: { id: trace.id || "" } }
  };
}

function shapeSharedLineDescriptor(line = {}) {
  return {
    id: line.id || "",
    agentId: line.agentId || "",
    title: boundedText(line.title, 240),
    status: line.status || "active",
    isCurrent: Boolean(line.active),
    summary: boundedText(line.summary, 600),
    interpretationStatus: line.interpretationStatus || "draft",
    updatedAt: line.updatedAt || null,
    detailRef: { tool: "shared_line_get", arguments: { lineId: line.id || "" } }
  };
}

function shapeHandoffAck(handoff = {}) {
  return {
    id: handoff.id || "",
    lineId: handoff.lineId || "",
    objective: boundedText(handoff.objective, 400),
    nextStep: boundedText(handoff.nextStep, 400),
    openItemCount: Array.isArray(handoff.openItems) ? handoff.openItems.length : 0,
    createdAt: handoff.createdAt || null,
    detailRef: handoff.lineId
      ? { tool: "shared_line_get", arguments: { lineId: handoff.lineId, detail: "full" } }
      : { tool: "shared_line_get", arguments: { detail: "full" } }
  };
}

function shapeMemoryRecordDetail(record = {}) {
  return {
    ...record,
    title: boundedText(record.title, 1000),
    note: boundedText(record.note, 16 * 1024)
  };
}

module.exports = {
  DEFAULT_CATALOG_LIMIT,
  MAX_CATALOG_LIMIT,
  boundedText,
  catalogPage,
  normalizeCatalogPaging,
  shapeHandoffAck,
  shapeGatewayTraceCatalogEntry,
  shapeInnerLifeSessionCatalogEntry,
  shapeMemoryAck,
  shapeMemoryCatalogEntry,
  shapeMemoryLinkCatalogEntry,
  shapeMemoryRecordCatalogEntry,
  shapeMemoryRecordDetail,
  shapeSharedLineCatalogEntry,
  shapeSharedLineDescriptor
};
