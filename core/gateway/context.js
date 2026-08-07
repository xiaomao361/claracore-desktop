const continuity = require("../continuity");
const innerlife = require("../innerlife");
const memoria = require("../memoria");
const { shapeSharedLinePacket } = require("../continuity/resume-detail");
const { shapeInnerLifeStatus } = require("../innerlife/selective");
const { resolveAgentIdentity } = require("../db/helpers");

// v0.6.6: brief context composes the new default domain contracts instead of
// carrying a second, larger copy of each one. One canonical representation per
// fact: the text field is a genuinely small summary, not a restatement.
const BRIEF_MEMORY_LIMIT = 3;
const BRIEF_TEXT_BYTES = 1024;
// The aggregate is orientation, not the record. Each domain already exposes a
// detailRef, so previews here are tighter than the per-domain default read.
const BRIEF_MEMORY_BODY_BYTES = 480;
const BRIEF_SHARE_PREVIEW_BYTES = 400;
const BRIEF_LINE_BOUNDS = Object.freeze({ summary: 480, title: 160, fact: 96, factLimit: 6, handoff: 240, nextStep: 240 });
const BRIEF_DOCTOR_ISSUE_LIMIT = 2;
const BRIEF_DOCTOR_ISSUE_BYTES = 200;

const GUIDANCE = Object.freeze({
  useSharedLine: "Treat Shared Line as the current resumable position.",
  useMemory: "Treat Memory as durable reviewed facts.",
  useInnerLife: "Use this agent's InnerLife waiting shares only when they fit the current moment.",
  oldServices: "Do not read or mutate old ClaraCore service databases from this Gateway context."
});

function truncateUtf8(value, maxBytes) {
  const text = String(value || "");
  if (Buffer.byteLength(text, "utf8") <= maxBytes) {
    return { text, truncated: false };
  }
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(characters.slice(0, middle).join(""), "utf8") <= maxBytes) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return {
    text: characters.slice(0, low).join(""),
    truncated: true
  };
}

function boundedText(value, maxBytes) {
  return truncateUtf8(value, maxBytes).text;
}

function normalizeDetail(value) {
  const detail = String(value || "full").trim().toLowerCase() || "full";
  if (!["brief", "full"].includes(detail)) {
    throw new Error("gateway_context detail must be brief or full.");
  }
  return detail;
}

function compactSharedLine(sharedLine) {
  const current = sharedLine?.currentPosition || {};
  const compactReality = Object.fromEntries(
    Object.entries(sharedLine?.sharedReality || {})
      .filter(([, value]) => typeof value === "boolean" || String(value || "").trim())
      .map(([key, value]) => [key, typeof value === "boolean" ? value : boundedText(value, 320)])
  );
  return {
    lineId: sharedLine?.lineId || current.lineId || "",
    agentId: sharedLine?.agentId || current.agentId || "",
    lineTitle: boundedText(sharedLine?.lineTitle || current.lineTitle || "", 256),
    currentPosition: {
      lineId: current.lineId || sharedLine?.lineId || "",
      agentId: current.agentId || sharedLine?.agentId || "",
      positionId: current.positionId || "",
      summary: boundedText(current.summary, 1600),
      interpretationStatus: current.interpretationStatus || "",
      factsUsed: (current.factsUsed || []).slice(0, 6).map((item) => boundedText(item, 160)),
      updatedAt: current.updatedAt || null
    },
    sharedReality: compactReality,
    history: (sharedLine?.history || []).slice(0, 2).map((item) => ({
      id: item.id,
      summary: boundedText(item.summary, 400),
      interpretationStatus: item.interpretationStatus,
      createdAt: item.createdAt
    })),
    handoffs: (sharedLine?.handoffs || []).slice(0, 1).map((item) => ({
      id: item.id,
      objective: boundedText(item.objective, 400),
      openItems: (item.openItems || []).slice(0, 3).map((entry) => boundedText(entry, 160)),
      nextStep: boundedText(item.nextStep, 400),
      createdAt: item.createdAt
    })),
    nextStep: boundedText(sharedLine?.nextStep, 500),
    detailRef: {
      tool: "shared_line_get",
      arguments: sharedLine?.lineId ? { lineId: sharedLine.lineId } : {}
    }
  };
}

function compactMemory(memory, bodyBytes = 1200) {
  const body = truncateUtf8(memory?.body, bodyBytes);
  return {
    id: memory?.id || "",
    title: boundedText(memory?.title || memory?.body, 256),
    bodyPreview: body.text,
    bodyTruncated: body.truncated,
    labels: (memory?.labels || []).slice(0, 6).map((label) => boundedText(label, 64)),
    status: memory?.status || "active",
    sensitivity: memory?.sensitivity || "normal",
    updatedAt: memory?.updated_at || memory?.updatedAt || null,
    detailRef: {
      tool: "memoria_get",
      arguments: { id: memory?.id || "" }
    }
  };
}

function compactIssue(issue) {
  return {
    level: issue?.level || "",
    code: issue?.code || "",
    message: boundedText(issue?.message, 300),
    action: boundedText(issue?.action, 300)
  };
}

function belongsToAgent(item, agentId) {
  return String(item?.agentId || item?.agent_id || "") === agentId;
}

// v0.6.6: the aggregate carries InnerLife operational state plus at most one
// candidate preview. Inbox bodies and the share catalog are explicit reads.
function compactInnerLife(innerLife, limit, agentId = "") {
  const scoped = {
    ...innerLife,
    pendingShares: (innerLife?.pendingShares || []).filter((share) => belongsToAgent(share, agentId)),
    pendingInbox: (innerLife?.pendingInbox || []).filter((item) => belongsToAgent(item, agentId))
  };
  const status = shapeInnerLifeStatus(scoped);
  const pendingShares = scoped.pendingShares.slice(0, Math.max(1, Math.min(limit, 1))).map((share) => ({
    id: share.id,
    agentId: share.agent_id || share.agentId || "",
    status: share.status,
    preview: boundedText(share.preview || share.body, BRIEF_SHARE_PREVIEW_BYTES),
    createdAt: share.created_at || share.createdAt || null
  }));
  return {
    counts: status.counts,
    daemon: status.daemon,
    doctor: {
      ...status.doctor,
      summary: boundedText(status.doctor.summary, 300),
      issues: status.doctor.issues.slice(0, BRIEF_DOCTOR_ISSUE_LIMIT).map((issue) => ({
        level: issue.level,
        code: issue.code,
        message: boundedText(issue.message, BRIEF_DOCTOR_ISSUE_BYTES)
      }))
    },
    work: status.work,
    pendingShares,
    detailRef: {
      tool: "innerlife_status",
      arguments: { agentId, detail: true }
    }
  };
}

function doctorText(doctor) {
  return doctor.issues?.length
    ? doctor.issues
        .map((issue, index) => `${index + 1}. ${issue.level}/${issue.code}: ${issue.message} Action: ${issue.action}`)
        .join("\n")
    : "No recovery action is needed.";
}

function fullText({ agentId, doctor, generatedAt, innerLife, memories, pendingInbox, pendingShares, sharedLine }) {
  const memoryText = memories.length
    ? memories.map((memory, index) => `${index + 1}. ${memory.title || String(memory.body || "").slice(0, 80)} [${memory.id}]`).join("\n")
    : "(none)";
  const shareText = pendingShares.length
    ? pendingShares.map((share, index) => `${index + 1}. ${String(share.body || share.preview || "").split("\n")[0]} [${share.id}]`).join("\n")
    : "(none)";
  const inboxText = pendingInbox.length
    ? pendingInbox.map((item, index) => `${index + 1}. ${item.source}: ${item.body}`).join("\n")
    : "(none)";
  return [
    "# ClaraCore Gateway Context",
    "",
    `Agent: ${agentId}`,
    `Generated at: ${generatedAt}`,
    `Doctor: ${doctor.status} - ${doctor.summary}`,
    "",
    "## Shared Line",
    sharedLine.text,
    "",
    "## Recent Memory",
    memoryText,
    "",
    "## InnerLife",
    `Daemon: ${innerLife.daemon?.status || "paused"}`,
    `Pending shares: ${innerLife.counts?.pending_shares_count || 0}`,
    `Pending inbox: ${innerLife.counts?.pending_inbox_count || 0}`,
    "Pending shares:",
    shareText,
    "Pending inbox:",
    inboxText,
    "",
    "## Recovery",
    doctorText(doctor),
    "",
    "## Agent Guidance",
    "Use Shared Line as the current position, Memory as durable facts, and InnerLife waiting shares only when they fit the current moment."
  ].join("\n");
}

// A genuinely small orientation summary, not a second copy of the structured
// fields. Bodies, previews, and summaries live once, in the structured packet.
function briefText({ agentId, doctor, innerLife, memories, sharedLine, generatedAt }) {
  const text = [
    "# ClaraCore Gateway Context (brief)",
    `Agent: ${agentId} | Generated at: ${generatedAt}`,
    `Doctor: ${doctor.status}`,
    `Shared Line: ${sharedLine.lineTitle || sharedLine.lineId || "(none selected)"}`,
    `Memory summaries: ${memories.length} | InnerLife share candidates: ${innerLife.pendingShares.length}`,
    "Read the structured fields above. Use detailRef entries for a full record; detail=full is a compatibility payload."
  ].join("\n");
  return boundedText(text, BRIEF_TEXT_BYTES);
}

function createGatewayContextService(ports) {
  return {
    async get(core, input = {}) {
      const detail = normalizeDetail(input.detail);
      const identity = resolveAgentIdentity(input || {});
      const agentId = identity.id;
      const query = String(input.query || "").trim();
      const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 5), 10) || 5, 20));
      const sharedLine = await ports.getSharedLine(
        core,
        input.lineId ? { lineId: input.lineId, lite: true } : { agentId, lite: true }
      );
      const requestedMemoryLimit = detail === "brief" ? Math.min(limit, BRIEF_MEMORY_LIMIT) : limit;
      const memoryPromise = query
        ? ports.searchMemories(core, { query, limit: requestedMemoryLimit, agentId, timeView: "current" })
        : ports.listMemories(core, { limit: requestedMemoryLimit, agentId });
      const innerLifePromise = ports.getInnerLifeSnapshot(core, agentId);

      if (detail === "brief") {
        const [memoryResult, innerLifeResult] = await Promise.all([memoryPromise, innerLifePromise]);
        const rawMemories = Array.isArray(memoryResult) ? memoryResult : memoryResult?.results || [];
        const generatedAt = (ports.now || (() => new Date()))().toISOString();
        // One Shared Line resume packet, up to three Memory summaries, and
        // InnerLife status with at most one candidate preview.
        const resumeLine = shapeSharedLinePacket(sharedLine, "resume", { bounds: BRIEF_LINE_BOUNDS });
        const memories = rawMemories
          .slice(0, BRIEF_MEMORY_LIMIT)
          .map((memory) => compactMemory(memory, BRIEF_MEMORY_BODY_BYTES));
        const compactLife = compactInnerLife(innerLifeResult, 1, agentId);
        return {
          detail,
          agentId,
          generatedAt,
          query,
          sharedLine: resumeLine,
          memories,
          memoryPage: {
            requestedLimit: limit,
            appliedLimit: requestedMemoryLimit,
            returned: memories.length,
            requestCapped: limit > requestedMemoryLimit,
            mayHaveMore: rawMemories.length === requestedMemoryLimit
          },
          innerLife: compactLife,
          guidance: { ...GUIDANCE },
          text: briefText({
            agentId,
            doctor: compactLife.doctor,
            innerLife: compactLife,
            memories,
            sharedLine: resumeLine,
            generatedAt
          })
        };
      }

      const [memoryResult, innerLifeResult, pendingInbox, recentShares, recentThoughts] = await Promise.all([
        memoryPromise,
        innerLifePromise,
        ports.listInnerLifeInbox(core, agentId, limit),
        ports.listInnerLifeShares(core, agentId, limit),
        ports.listInnerLifeThoughts(core, agentId, limit)
      ]);
      const memories = Array.isArray(memoryResult) ? memoryResult : memoryResult?.results || [];
      const doctor = innerLifeResult.doctor || {
        status: "ok",
        summary: "InnerLife is not configured for this agent.",
        issues: []
      };
      const pendingShares = (innerLifeResult.pendingShares || [])
        .filter((share) => belongsToAgent(share, agentId))
        .slice(0, limit);
      const scopedPendingInbox = (pendingInbox || []).filter((item) => belongsToAgent(item, agentId));
      const scopedRecentShares = (recentShares || []).filter((share) => belongsToAgent(share, agentId));
      const generatedAt = (ports.now || (() => new Date()))().toISOString();
      return {
        detail,
        agentId,
        generatedAt,
        query,
        sharedLine,
        memories,
        innerLife: {
          counts: innerLifeResult.counts,
          daemon: innerLifeResult.daemon,
          doctor,
          pendingShares,
          pendingInbox: scopedPendingInbox,
          recentShares: scopedRecentShares,
          recentThoughts
        },
        guidance: { ...GUIDANCE },
        text: fullText({
          agentId,
          doctor,
          generatedAt,
          innerLife: innerLifeResult,
          memories,
          pendingInbox: scopedPendingInbox,
          pendingShares,
          sharedLine
        })
      };
    }
  };
}

const gatewayContextService = createGatewayContextService({
  getSharedLine: (core, input) => continuity.get(core, input),
  searchMemories: (core, input) => memoria.search(core, input),
  listMemories: (core, input) => memoria.list(core, input),
  getInnerLifeSnapshot: (core, agentId) => innerlife.snapshotLite(core, agentId),
  listInnerLifeInbox: (core, agentId, limit) => innerlife.pendingInbox(core, agentId, limit),
  listInnerLifeShares: (core, agentId, limit) => innerlife.pendingShares(core, "all", limit, agentId),
  listInnerLifeThoughts: (core, agentId, limit) => innerlife.recentThoughts(core, agentId, limit),
  now: () => new Date()
});

async function getGatewayContext(core, input = {}) {
  return gatewayContextService.get(core, input);
}

module.exports = {
  BRIEF_MEMORY_LIMIT,
  compactInnerLife,
  compactMemory,
  compactSharedLine,
  createGatewayContextService,
  getGatewayContext,
  normalizeDetail,
  truncateUtf8
};
