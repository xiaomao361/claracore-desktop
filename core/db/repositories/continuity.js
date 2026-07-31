const { createContinuityAgentRepository } = require("./continuity/agents");
const { createContinuityLineRepository } = require("./continuity/lines");
const { composeRepositoryMethods, installRepositoryMethods } = require("../repository-installer");

function installContinuityRepository(ProductDatabase, helpers) {
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    newId,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;
  const VALID_INTERPRETATION_STATUSES = new Set(["draft", "confirmed", "active", "needs_review", "stale", "closed"]);
  // Persisted arc caps keep current_positions.metadata_json from growing without
  // bound across many captures. Resume caps keep the resume packet small unless
  // the caller explicitly asks for the full arc.
  const MAX_AFFECTIVE_TRACE = 50;
  const MAX_POSITION_HISTORY = 50;
  const RESUME_TRACE_LIMIT = 5;
  const RESUME_HISTORY_LIMIT = 5;

  // An affective node is "protected" when it still needs review: it must survive
  // capping and resume truncation so a flagged emotional reading is never lost.
  function isProtectedAffective(node) {
    return Boolean(node && node.needs_review);
  }

  function isSameAffective(left, right) {
    if (!left || !right) return false;
    return (
      String(left.tone || "") === String(right.tone || "") &&
      String(left.valence || "") === String(right.valence || "") &&
      String(left.intensity || "") === String(right.intensity || "") &&
      (Array.isArray(left.signals) ? left.signals.join("|") : "") ===
        (Array.isArray(right.signals) ? right.signals.join("|") : "")
    );
  }

  // Cap a persisted arc to a maximum length while always keeping protected
  // nodes. Older non-protected nodes are dropped first.
  function capArc(arr, max, isProtected = () => false) {
    if (!Array.isArray(arr) || arr.length <= max) return Array.isArray(arr) ? arr : [];
    const protectedNodes = arr.filter((node) => isProtected(node));
    const rest = arr.filter((node) => !isProtected(node));
    const keepRest = Math.max(0, max - protectedNodes.length);
    const trimmedRest = rest.slice(rest.length - keepRest);
    // Preserve original order: walk source, keep node if protected or in trimmedRest.
    const restSet = new Set(trimmedRest);
    return arr.filter((node) => isProtected(node) || restSet.has(node));
  }

  // Truncate an arc for a resume packet: keep protected nodes plus the most
  // recent `limit` nodes, preserving order.
  function truncateArc(arr, limit, isProtected = () => false) {
    if (!Array.isArray(arr)) return { items: [], total: 0, truncated: false };
    if (arr.length <= limit) return { items: arr, total: arr.length, truncated: false };
    const recent = new Set(arr.slice(arr.length - limit));
    const items = arr.filter((node) => isProtected(node) || recent.has(node));
    return { items, total: arr.length, truncated: items.length < arr.length };
  }
  const SHARED_REALITY_FIELDS = [
    ["visibility", ["visibility"]],
    ["mode", ["mode"]],
    ["nextStep", ["nextStep", "next_step"]],
    ["stateSummary", ["stateSummary", "state_summary"]],
    ["currentInterpretation", ["currentInterpretation", "current_interpretation"]],
    ["userConfirmed", ["userConfirmed", "user_confirmed"]],
    ["realityLine", ["realityLine", "reality_line"]],
    ["entryPosture", ["entryPosture", "entry_posture"]],
    ["confirmedGround", ["confirmedGround", "confirmed_ground"]],
    ["provisionalRead", ["provisionalRead", "provisional_read"]],
    ["boundaryNotes", ["boundaryNotes", "boundary_notes"]],
    ["misreadRisks", ["misreadRisks", "misread_risks"]],
    ["sourceSession", ["sourceSession", "source_session"]],
    ["notes", ["notes"]]
  ];

  function firstDefined(input, keys) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(input || {}, key) && input[key] !== undefined) return input[key];
    }
    return undefined;
  }

  function cleanList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
    if (value === undefined || value === null || value === "") return undefined;
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeInterpretationStatus(value) {
    const status = String(value || "draft").trim();
    return VALID_INTERPRETATION_STATUSES.has(status) ? status : "draft";
  }

  function buildAffectiveNode(input = {}) {
    const tone = firstDefined(input, ["affectiveTone", "affective_tone"]);
    const note = firstDefined(input, ["affectiveNote", "affective_note"]);
    if (!tone && !note) return null;
    return {
      time: new Date().toISOString(),
      tone: String(tone || ""),
      valence: String(firstDefined(input, ["affectiveValence", "affective_valence"]) || "unclear"),
      signals: cleanList(firstDefined(input, ["affectiveSignals", "affective_signals"])) || [],
      intensity: String(firstDefined(input, ["affectiveIntensity", "affective_intensity"]) || "medium"),
      stability: String(firstDefined(input, ["affectiveStability", "affective_stability"]) || "session"),
      source: String(firstDefined(input, ["actor", "source"]) || "desktop"),
      note: String(note || ""),
      needs_review: Boolean(firstDefined(input, ["affectiveNeedsReview", "affective_needs_review"]) || false)
    };
  }

  function buildContinuityMetadata(input = {}, current = {}) {
    const currentMetadata = current?.metadata && typeof current.metadata === "object" ? current.metadata : {};
    const explicitMetadata = input?.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {};
    const metadata = { ...currentMetadata, ...explicitMetadata };
    for (const [targetKey, sourceKeys] of SHARED_REALITY_FIELDS) {
      const value = firstDefined(input, sourceKeys);
      if (value !== undefined) {
        metadata[targetKey] = typeof value === "boolean" ? value : String(value || "").trim();
      }
    }
    const tags = cleanList(firstDefined(input, ["tags"]));
    if (tags) metadata.tags = tags;
    const positionHistory = firstDefined(input, ["positionHistory", "position_history", "emotionalArc", "emotional_arc"]);
    if (Array.isArray(positionHistory)) metadata.positionHistory = positionHistory;
    const affectiveTrace = firstDefined(input, ["affectiveTrace", "affective_trace"]);
    if (Array.isArray(affectiveTrace)) {
      metadata.affectiveTrace = capArc(affectiveTrace, MAX_AFFECTIVE_TRACE, isProtectedAffective);
    }
    const affNode = buildAffectiveNode(input);
    // momentary readings are transient: they must not be persisted into the arc
    // or alter shared reality. Same-as-previous readings are de-duplicated.
    if (affNode && affNode.stability !== "momentary") {
      const trace = Array.isArray(metadata.affectiveTrace) ? metadata.affectiveTrace : [];
      const last = trace[trace.length - 1];
      if (!isSameAffective(last, affNode)) {
        metadata.affectiveTrace = capArc([...trace, affNode], MAX_AFFECTIVE_TRACE, isProtectedAffective);
      }
    }
    const summary = String(input?.summary || "").trim();
    if (current?.summary && summary && current.summary !== summary) {
      const ph = Array.isArray(metadata.positionHistory) ? metadata.positionHistory : [];
      metadata.positionHistory = capArc(
        [
          ...ph,
          {
            time: current.updatedAt || new Date().toISOString(),
            position: current.summary,
            source: String(input?.source || "desktop")
          }
        ],
        MAX_POSITION_HISTORY
      );
    }
    return metadata;
  }

  const positionMethods = {
    async getCurrentPosition(lineIdInput = null) {
      const requestedLineId = String(lineIdInput || "").trim();
      const lineId = requestedLineId || (await this.getActiveContinuityLineIdReadOnly());
      if (!lineId) {
        return {
          lineId: "line_default",
          agentId: DEFAULT_AGENT_ID,
          lineTitle: "Default Shared Line",
          lineStatus: "empty",
          positionId: "position_default",
          summary: "",
          interpretationStatus: "unconfirmed",
          factsUsed: [],
          metadata: {},
          updatedAt: null
        };
      }
      const rows = await this.query(`
        SELECT
          l.id AS line_id,
          l.agent_id,
          l.title AS line_title,
          l.status AS line_status,
          p.id AS position_id,
          p.summary,
          p.interpretation_status,
          p.facts_used_json,
          p.metadata_json,
          p.updated_at
        FROM continuity_lines l
        LEFT JOIN current_positions p ON p.line_id = l.id
        WHERE l.id = ${sqlString(lineId)}
        ORDER BY p.updated_at DESC
        LIMIT 1;
      `);
      if (requestedLineId && !rows[0]) throw new Error("Shared Line not found.");
      const row = rows[0] || {};
      return {
        lineId,
        agentId: row.agent_id || DEFAULT_AGENT_ID,
        lineTitle: row.line_title || "Default Shared Line",
        lineStatus: row.line_status || "active",
        positionId: row.position_id || "position_default",
        summary: row.summary || "",
        interpretationStatus: row.interpretation_status || "draft",
        factsUsed: parseJson(row.facts_used_json, []),
        metadata: parseJson(row.metadata_json, {}),
        updatedAt: row.updated_at || null
      };
    },

    async saveCurrentPosition(input) {
      const explicitLineId = input?.lineId || input?.line_id || null;
      const agentLineId = explicitLineId ? null : await this.ensureContinuityLineForAgent(input?.agentId || input?.agent_id || "");
      const lineId = await this.resolveContinuityLineId(explicitLineId || agentLineId || null);
      const summary = String(input?.summary || "").trim();
      if (!summary) throw new Error("Current position summary is required.");
      const status = normalizeInterpretationStatus(input?.interpretationStatus || input?.interpretation_status || "draft");
      const factsUsed = Array.isArray(input?.factsUsed) ? input.factsUsed.map((item) => String(item).trim()).filter(Boolean) : [];
      const source = String(input?.source || "desktop").trim() || "desktop";
      const current = await this.getCurrentPosition(lineId);
      const positionId = current.summary && current.positionId ? current.positionId : `position_${lineId}`;
      const currentFacts = JSON.stringify(current.factsUsed || []);
      const nextFacts = JSON.stringify(factsUsed);
      const changesConfirmedPosition =
        current.summary &&
        current.interpretationStatus === "confirmed" &&
        (current.summary !== summary || current.interpretationStatus !== status || currentFacts !== nextFacts);
      if (changesConfirmedPosition && input?.confirmOverwrite !== true) {
        const error = new Error("Confirmed Shared Line overwrite requires explicit confirmation.");
        error.code = "SHARED_LINE_CONFIRM_OVERWRITE_REQUIRED";
        error.currentPosition = current;
        throw error;
      }
      const historyId = newId("position_history");
      const snapshotId = newId("position_snapshot");
      const snapshotReason = changesConfirmedPosition ? "confirmed_overwrite" : "save";
      const metadata = buildContinuityMetadata(input || {}, current);
      const writerAgentId = String(input?.agentId || input?.agent_id || "").trim();
      if (writerAgentId) metadata.writerAgentId = resolveAgentIdentity({ agentId: writerAgentId }).id;
      await this.exec(`
        INSERT INTO current_positions (id, line_id, summary, interpretation_status, facts_used_json, metadata_json, updated_at)
        VALUES (${sqlString(positionId)}, ${sqlString(lineId)}, ${sqlString(summary)}, ${sqlString(status)}, ${jsonSql(factsUsed)}, ${jsonSql(metadata)}, CURRENT_TIMESTAMP)
        ON CONFLICT(line_id) DO UPDATE SET
          summary = excluded.summary,
          interpretation_status = excluded.interpretation_status,
          facts_used_json = excluded.facts_used_json,
          metadata_json = excluded.metadata_json,
          updated_at = CURRENT_TIMESTAMP;
    
        INSERT INTO continuity_position_history (id, line_id, position_id, summary, interpretation_status, facts_used_json, source)
        VALUES (${sqlString(historyId)}, ${sqlString(lineId)}, ${sqlString(positionId)}, ${sqlString(summary)}, ${sqlString(status)}, ${jsonSql(factsUsed)}, ${sqlString(source)});
    
        INSERT INTO continuity_snapshots (id, line_id, position_id, summary, interpretation_status, facts_used_json, reason)
        VALUES (${sqlString(snapshotId)}, ${sqlString(lineId)}, ${sqlString(positionId)}, ${sqlString(summary)}, ${sqlString(status)}, ${jsonSql(factsUsed)}, ${sqlString(snapshotReason)});
    
        UPDATE continuity_lines
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(lineId)};
      `);
      return this.getCurrentPosition(lineId);
    },

    async listContinuitySnapshots(limit = 8, lineIdInput = null) {
      const lineId = await this.resolveContinuityLineIdReadOnly(lineIdInput);
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 8, 30));
      const rows = await this.query(`
        SELECT id, line_id, position_id, summary, interpretation_status, facts_used_json, reason, created_at
        FROM continuity_snapshots
        WHERE line_id = ${sqlString(lineId)}
        ORDER BY created_at DESC, rowid DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => ({
        id: row.id,
        lineId: row.line_id,
        positionId: row.position_id,
        summary: row.summary || "",
        interpretationStatus: row.interpretation_status || "draft",
        factsUsed: parseJson(row.facts_used_json, []),
        reason: row.reason || "save",
        createdAt: row.created_at
      }));
    },

    async listContinuityPositionHistory(limit = 8, lineIdInput = null) {
      const lineId = await this.resolveContinuityLineIdReadOnly(lineIdInput);
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 8, 30));
      const rows = await this.query(`
        SELECT id, line_id, position_id, summary, interpretation_status, facts_used_json, source, created_at
        FROM continuity_position_history
        WHERE line_id = ${sqlString(lineId)}
        ORDER BY created_at DESC, rowid DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => ({
        id: row.id,
        lineId: row.line_id,
        positionId: row.position_id,
        summary: row.summary || "",
        interpretationStatus: row.interpretation_status || "draft",
        factsUsed: parseJson(row.facts_used_json, []),
        source: row.source || "desktop",
        createdAt: row.created_at
      }));
    },

    async listContinuityHandoffs(limit = 5, lineIdInput = null) {
      const lineId = await this.resolveContinuityLineIdReadOnly(lineIdInput);
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 5, 20));
      const rows = await this.query(`
        SELECT id, line_id, objective, completed_json, open_items_json, next_step, created_at
        FROM continuity_handoffs
        WHERE line_id = ${sqlString(lineId)}
        ORDER BY created_at DESC, rowid DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => ({
        id: row.id,
        lineId: row.line_id,
        objective: row.objective || "",
        completed: parseJson(row.completed_json, []),
        openItems: parseJson(row.open_items_json, []),
        nextStep: row.next_step || "",
        createdAt: row.created_at
      }));
    },

    async createContinuityHandoff(input = {}) {
      const currentPosition = await this.getCurrentPosition(input.lineId || null);
      const id = newId("handoff");
      const objective = String(input.objective || currentPosition.summary || "Continue from the current Shared Line.").trim();
      const completed = Array.isArray(input.completed)
        ? input.completed.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const openItems = Array.isArray(input.openItems)
        ? input.openItems.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const nextStep = String(
        input.nextStep ||
          (currentPosition.summary ? "Resume from the current Shared Line and keep history updated." : "Read the Shared Line before starting.")
      ).trim();
      if (!objective) throw new Error("Handoff objective is required.");
      await this.exec(`
        INSERT INTO continuity_handoffs (id, line_id, objective, completed_json, open_items_json, next_step)
        VALUES (
          ${sqlString(id)},
          ${sqlString(currentPosition.lineId)},
          ${sqlString(objective)},
          ${jsonSql(completed)},
          ${jsonSql(openItems)},
          ${sqlString(nextStep)}
        );
      `);
      return this.getContinuityHandoff(id);
    },

  };
  const contextMethods = {
    async getContinuityHandoff(id) {
      const rows = await this.query(`
        SELECT id, line_id, objective, completed_json, open_items_json, next_step, created_at
        FROM continuity_handoffs
        WHERE id = ${sqlString(id)}
        LIMIT 1;
      `);
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        lineId: row.line_id,
        objective: row.objective || "",
        completed: parseJson(row.completed_json, []),
        openItems: parseJson(row.open_items_json, []),
        nextStep: row.next_step || "",
        createdAt: row.created_at
      };
    },

    async getResumePacket(input = {}) {
      // lite skips the full line lists and other agents' states; write
      // acknowledgements only need the saved position plus recent context.
      const lite = input.lite === true;
      // Read path: never materialize a line as a side effect. A dedicated line
      // is created on the first write (saveCurrentPosition); until then a fresh
      // agent resumes from the active line.
      const agentLineId = input?.lineId ? null : await this.findContinuityLineIdForAgent(input?.agentId || input?.agent_id || "");
      const currentPosition = await this.getCurrentPosition(input.lineId || agentLineId || null);
      const metadata = currentPosition.metadata || {};
      const [lines, archivedLines, history, snapshots, handoffs, agentState, agentStates, modelAdjustment] = await Promise.all([
        lite ? [] : this.listContinuityLines({ limit: 100, agentId: input.agentId || input.agent_id || "", allAgents: true, status: "active" }),
        lite ? [] : this.listContinuityLines({ limit: 100, agentId: input.agentId || input.agent_id || "", allAgents: true, status: "archived" }),
        this.listContinuityPositionHistory(5, currentPosition.lineId),
        this.listContinuitySnapshots(5, currentPosition.lineId),
        this.listContinuityHandoffs(3, currentPosition.lineId),
        this.getContinuityAgentState(currentPosition.agentId || DEFAULT_AGENT_ID),
        lite ? [] : this.listContinuityAgentStates(),
        input.model ? this.getContinuityModelAdjustment(input.model) : null
      ]);
      const sharedReality = {
        realityLine: metadata.realityLine || "",
        entryPosture: metadata.entryPosture || "",
        confirmedGround: metadata.confirmedGround || "",
        provisionalRead: metadata.provisionalRead || "",
        boundaryNotes: metadata.boundaryNotes || "",
        misreadRisks: metadata.misreadRisks || "",
        currentInterpretation: metadata.currentInterpretation || "",
        userConfirmed: Boolean(metadata.userConfirmed)
      };
      const fullArc = input.fullArc === true || input.full_arc === true;
      const allPositionHistory = Array.isArray(metadata.positionHistory) ? metadata.positionHistory : [];
      const allAffectiveTrace = Array.isArray(metadata.affectiveTrace) ? metadata.affectiveTrace : [];
      const truncatedHistory = fullArc
        ? { items: allPositionHistory, total: allPositionHistory.length, truncated: false }
        : truncateArc(allPositionHistory, RESUME_HISTORY_LIMIT);
      const truncatedTrace = fullArc
        ? { items: allAffectiveTrace, total: allAffectiveTrace.length, truncated: false }
        : truncateArc(allAffectiveTrace, RESUME_TRACE_LIMIT, isProtectedAffective);
      const positionHistory = truncatedHistory.items;
      const affectiveTrace = truncatedTrace.items;
      const arcMeta = {
        fullArc,
        positionHistoryTotal: truncatedHistory.total,
        positionHistoryTruncated: truncatedHistory.truncated,
        affectiveTraceTotal: truncatedTrace.total,
        affectiveTraceTruncated: truncatedTrace.truncated
      };
      const nextStep = currentPosition.summary
        ? "Resume from the current shared position and ask before overwriting it."
        : "No shared position has been saved yet.";
      const historyText = history.length
        ? history.map((item, index) => `${index + 1}. ${item.summary} (${item.interpretationStatus}, ${item.createdAt})`).join("\n")
        : "(none)";
      const handoffText = handoffs.length
        ? handoffs.map((item, index) => `${index + 1}. ${item.objective} -> ${item.nextStep} (${item.createdAt})`).join("\n")
        : "(none)";
      const sharedRealityText = [
        sharedReality.realityLine ? `Reality line: ${sharedReality.realityLine}` : "",
        sharedReality.confirmedGround ? `Confirmed ground: ${sharedReality.confirmedGround}` : "",
        sharedReality.provisionalRead ? `Provisional read: ${sharedReality.provisionalRead}` : "",
        sharedReality.boundaryNotes ? `Boundary notes: ${sharedReality.boundaryNotes}` : "",
        sharedReality.misreadRisks ? `Misread risks: ${sharedReality.misreadRisks}` : "",
        sharedReality.entryPosture ? `Entry posture: ${sharedReality.entryPosture}` : ""
      ].filter(Boolean).join("\n") || "(none)";
      return {
        lineId: currentPosition.lineId,
        agentId: currentPosition.agentId,
        lineTitle: currentPosition.lineTitle,
        lines,
        archivedLines,
        currentPosition,
        history,
        snapshots,
        handoffs,
        sharedReality,
        agentState,
        agentStates,
        modelAdjustment,
        positionHistory,
        affectiveTrace,
        arcMeta,
        nextStep,
        text: [
          `Shared Line: ${currentPosition.lineTitle}`,
          `Agent: ${currentPosition.agentId}`,
          `Current position: ${currentPosition.summary || "(empty)"}`,
          `Interpretation status: ${currentPosition.interpretationStatus}`,
          `Shared reality:\n${sharedRealityText}`,
          agentState.communicationStyle ? `Agent style: ${agentState.communicationStyle}` : "",
          modelAdjustment ? `Model adjustment (${modelAdjustment.model}): ${modelAdjustment.injectPrompt || "(no prompt)"}` : "",
          `Updated at: ${currentPosition.updatedAt || "(not saved)"}`,
          `Recent history:\n${historyText}`,
          `Recent handoffs:\n${handoffText}`,
          `Next step: ${nextStep}`
        ].join("\n")
      };
    },

    async compactContinuityLine(input = {}) {
      const lineId = await this.resolveContinuityLineId(input?.lineId || null);
      const positionId = `position_${lineId}`;
      const current = await this.getCurrentPosition(lineId);
      const metadata = current?.metadata && typeof current.metadata === "object" ? { ...current.metadata } : {};
      const keepTrace = Math.max(0, Number.parseInt(String(input?.keepTrace ?? input?.keep_trace ?? 20), 10) || 0);
      const keepHistory = Math.max(0, Number.parseInt(String(input?.keepHistory ?? input?.keep_history ?? 20), 10) || 0);
      const beforeTrace = Array.isArray(metadata.affectiveTrace) ? metadata.affectiveTrace : [];
      const beforeHistory = Array.isArray(metadata.positionHistory) ? metadata.positionHistory : [];
      const afterTrace = capArc(beforeTrace, keepTrace, isProtectedAffective);
      const afterHistory = capArc(beforeHistory, keepHistory);
      metadata.affectiveTrace = afterTrace;
      metadata.positionHistory = afterHistory;
      // Compact only rewrites the metadata arcs; it does not touch summary,
      // interpretation status, history, or snapshots, so it cannot bypass the
      // confirmed-position overwrite guard.
      await this.exec(`
        UPDATE current_positions
        SET metadata_json = ${jsonSql(metadata)},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(positionId)};
      `);
      return {
        lineId,
        affectiveTrace: { before: beforeTrace.length, after: afterTrace.length, removed: beforeTrace.length - afterTrace.length },
        positionHistory: { before: beforeHistory.length, after: afterHistory.length, removed: beforeHistory.length - afterHistory.length },
        protectedAffective: beforeTrace.filter(isProtectedAffective).length,
        currentPosition: await this.getCurrentPosition(lineId)
      };
    }
  };
  const methods = composeRepositoryMethods("continuity", [
    ["lines", createContinuityLineRepository(helpers)],
    ["position", positionMethods],
    ["agents", createContinuityAgentRepository(helpers)],
    ["context", contextMethods]
  ]);
  installRepositoryMethods(ProductDatabase, "continuity", methods);
}

module.exports = {
  installContinuityRepository
};
