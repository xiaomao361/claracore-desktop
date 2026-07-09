const { createContinuityAgentRepository } = require("./continuity/agents");

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
    ["agentId", ["agentId", "agent_id"]],
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

  const CONTINUITY_LINE_SELECT = `
    SELECT
      l.id,
      l.agent_id,
      l.title,
      l.status,
      l.created_at,
      l.updated_at,
      p.summary,
      p.interpretation_status,
      p.metadata_json,
      p.updated_at AS position_updated_at
    FROM continuity_lines l
    LEFT JOIN current_positions p ON p.rowid = (
      SELECT candidate.rowid
      FROM current_positions candidate
      WHERE candidate.line_id = l.id
      ORDER BY
        candidate.updated_at DESC,
        CASE WHEN candidate.id = 'position_' || candidate.line_id THEN 0 ELSE 1 END,
        candidate.id DESC
      LIMIT 1
    )
  `;

  function mapContinuityLineRow(row, activeLineId) {
    return {
      id: row.id,
      agentId: row.agent_id || DEFAULT_AGENT_ID,
      title: row.title || "Shared Line",
      status: row.status || "active",
      active: row.id === activeLineId,
      summary: row.summary || "",
      interpretationStatus: row.interpretation_status || "draft",
      metadata: parseJson(row.metadata_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      positionUpdatedAt: row.position_updated_at
    };
  }

  Object.assign(ProductDatabase.prototype, {
    async ensureDefaultContinuityLine() {
      const lineId = "line_default";
      await this.exec(`
        INSERT INTO continuity_lines (id, agent_id, title, status)
        VALUES (${sqlString(lineId)}, ${sqlString(DEFAULT_AGENT_ID)}, 'Default Shared Line', 'active')
        ON CONFLICT(id) DO UPDATE SET
          status = 'active',
          updated_at = CASE
            WHEN continuity_lines.status != 'active' THEN CURRENT_TIMESTAMP
            ELSE continuity_lines.updated_at
          END
        WHERE continuity_lines.status != 'active';
      `);
      return lineId;
    },

    async getActiveContinuityLineId() {
      const defaultLineId = await this.ensureDefaultContinuityLine();
      const settings = await this.getSettings();
      const configured = String(settings["continuity.active_line_id"] || defaultLineId).trim() || defaultLineId;
      const rows = await this.query(`
        SELECT id
        FROM continuity_lines
        WHERE id = ${sqlString(configured)} AND status = 'active'
        LIMIT 1;
      `);
      const lineId = rows[0]?.id || defaultLineId;
      if (lineId !== configured) {
        await this.setActiveContinuityLine(lineId);
      }
      return lineId;
    },

    async resolveContinuityLineId(lineId = null) {
      const requested = String(lineId || "").trim();
      if (!requested) return this.getActiveContinuityLineId();
      await this.ensureDefaultContinuityLine();
      const rows = await this.query(`
        SELECT id
        FROM continuity_lines
        WHERE id = ${sqlString(requested)} AND status = 'active'
        LIMIT 1;
      `);
      if (!rows[0]?.id) throw new Error("Shared Line not found.");
      return rows[0].id;
    },

    async findContinuityLineIdForAgent(agentIdInput = "") {
      const agentId = String(agentIdInput || "").trim();
      if (!agentId) return null;
      await this.ensureDefaultContinuityLine();
      const rows = await this.query(`
        SELECT id
        FROM continuity_lines
        WHERE agent_id = ${sqlString(agentId)} AND status = 'active' AND id != 'line_default'
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1;
      `);
      return rows[0]?.id || null;
    },

    async ensureContinuityLineForAgent(agentIdInput = "") {
      if (!String(agentIdInput || "").trim()) return null;
      const identity = resolveAgentIdentity({ agentId: agentIdInput });
      const agentId = String(identity.id || "").trim();
      if (!agentId) return null;
      // Unidentified callers fall back to sentinel ids ("http-agent" for HTTP,
      // "unknown-agent" for stdio without CLARACORE_AGENT_ID); do not mint a
      // dedicated Shared Line for them — they use the default line.
      if (agentId === "http-agent" || agentId === "unknown-agent") return null;
      const existing = await this.findContinuityLineIdForAgent(agentId);
      if (existing) return existing;
      const id = newId("line");
      const title = `${agentId} Shared Line`;
      await this.exec(`
        INSERT INTO continuity_lines (id, agent_id, title, status)
        VALUES (${sqlString(id)}, ${sqlString(agentId)}, ${sqlString(title)}, 'active');
      `);
      return id;
    },

    async listContinuityLines(input = 20) {
      await this.ensureDefaultContinuityLine();
      const activeLineId = await this.getActiveContinuityLineId();
      const options = typeof input === "object" && input !== null ? input : { limit: input };
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(options.limit || 20), 10) || 20, 100));
      const agentId = String(options.agentId || options.agent_id || "").trim();
      const status = String(options.status || "").trim();
      const filters = ["l.status != 'deleted'"];
      if (status === "active") filters.push("l.status = 'active'");
      if (status === "archived") filters.push("l.status = 'archived'");
      if (agentId && !options.allAgents) filters.push(`l.agent_id = ${sqlString(agentId)}`);
      const rows = await this.query(`
        ${CONTINUITY_LINE_SELECT}
        WHERE ${filters.join(" AND ")}
        ORDER BY
          CASE WHEN l.id = ${sqlString(activeLineId)} THEN 0 ELSE 1 END,
          l.updated_at DESC,
          l.created_at DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => mapContinuityLineRow(row, activeLineId));
    },

    async getContinuityLine(lineId) {
      const id = String(lineId || "").trim();
      if (!id) return null;
      const activeLineId = await this.getActiveContinuityLineId();
      const rows = await this.query(`
        ${CONTINUITY_LINE_SELECT}
        WHERE l.id = ${sqlString(id)} AND l.status != 'deleted'
        LIMIT 1;
      `);
      return rows[0] ? mapContinuityLineRow(rows[0], activeLineId) : null;
    },

    async createContinuityLine(input = {}) {
      const title = String(input.title || "").trim();
      if (!title) throw new Error("Shared Line title is required.");
      const id = String(input.id || newId("line")).trim();
      const identity = resolveAgentIdentity(input || {});
      await this.exec(`
        INSERT INTO continuity_lines (id, agent_id, title, status)
        VALUES (${sqlString(id)}, ${sqlString(identity.id)}, ${sqlString(title)}, 'active');
      `);
      if (input.makeActive !== false) {
        await this.setActiveContinuityLine(id);
      }
      return this.getContinuityLine(id);
    },

    async renameContinuityLine(lineId, title) {
      const id = await this.resolveContinuityLineId(lineId);
      const nextTitle = String(title || "").trim();
      if (!nextTitle) throw new Error("Shared Line title is required.");
      await this.exec(`
        UPDATE continuity_lines
        SET title = ${sqlString(nextTitle)},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(id)} AND status = 'active';
      `);
      return this.getContinuityLine(id);
    },

    async archiveContinuityLine(lineId) {
      const id = String(lineId || "").trim();
      if (!id) throw new Error("Shared Line id is required.");
      if (id === "line_default") throw new Error("Default Shared Line cannot be archived.");
      await this.ensureDefaultContinuityLine();
      const rows = await this.query(`
        SELECT id
        FROM continuity_lines
        WHERE id = ${sqlString(id)} AND status = 'active'
        LIMIT 1;
      `);
      if (!rows[0]?.id) throw new Error("Active Shared Line not found.");
      await this.exec(`
        UPDATE continuity_lines
        SET status = 'archived',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(id)};
      `);
      const activeLineId = await this.getActiveContinuityLineId();
      if (activeLineId === id) {
        await this.setActiveContinuityLine("line_default");
      }
      return this.getContinuityLine(id);
    },

    async restoreContinuityLine(lineId, makeActive = false) {
      const id = String(lineId || "").trim();
      if (!id) throw new Error("Shared Line id is required.");
      await this.ensureDefaultContinuityLine();
      const rows = await this.query(`
        SELECT id
        FROM continuity_lines
        WHERE id = ${sqlString(id)} AND status = 'archived'
        LIMIT 1;
      `);
      if (!rows[0]?.id) throw new Error("Archived Shared Line not found.");
      await this.exec(`
        UPDATE continuity_lines
        SET status = 'active',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(id)};
      `);
      if (makeActive) {
        await this.setActiveContinuityLine(id);
      }
      return this.getContinuityLine(id);
    },

    async setActiveContinuityLine(lineId) {
      const id = await this.resolveContinuityLineId(lineId);
      await this.exec(`
        INSERT INTO app_settings (key, value_json, updated_at)
        VALUES ('continuity.active_line_id', ${jsonSql(id)}, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = CURRENT_TIMESTAMP;
      `);
      return this.getContinuityLine(id);
    },

    async getCurrentPosition(lineIdInput = null) {
      const lineId = await this.resolveContinuityLineId(lineIdInput);
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
      if (metadata.agentId) {
        await this.exec(`
          UPDATE continuity_lines
          SET agent_id = ${sqlString(metadata.agentId)},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${sqlString(lineId)};
        `);
      }
      return this.getCurrentPosition(lineId);
    },

    async listContinuitySnapshots(limit = 8, lineIdInput = null) {
      const lineId = await this.resolveContinuityLineId(lineIdInput);
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 8, 30));
      const rows = await this.query(`
        SELECT id, line_id, position_id, summary, interpretation_status, facts_used_json, reason, created_at
        FROM continuity_snapshots
        WHERE line_id = ${sqlString(lineId)}
        ORDER BY created_at DESC, id DESC
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
      const lineId = await this.resolveContinuityLineId(lineIdInput);
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 8, 30));
      const rows = await this.query(`
        SELECT id, line_id, position_id, summary, interpretation_status, facts_used_json, source, created_at
        FROM continuity_position_history
        WHERE line_id = ${sqlString(lineId)}
        ORDER BY created_at DESC, id DESC
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
      const lineId = await this.resolveContinuityLineId(lineIdInput);
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 5, 20));
      const rows = await this.query(`
        SELECT id, line_id, objective, completed_json, open_items_json, next_step, created_at
        FROM continuity_handoffs
        WHERE line_id = ${sqlString(lineId)}
        ORDER BY created_at DESC, id DESC
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

    ...createContinuityAgentRepository(helpers),
    
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
    },

    async getGatewayContext(input = {}) {
      const identity = resolveAgentIdentity(input || {});
      const agentId = identity.id;
      const query = String(input.query || "").trim();
      const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 5), 10) || 5, 20));
      const [sharedLine, memories, innerLife, doctor] = await Promise.all([
        this.getResumePacket(input.lineId ? { lineId: input.lineId } : { agentId }),
        query ? this.searchMemories(query, limit).then((result) => result.results.slice(0, limit)) : this.listMemories(limit),
        this.getInnerLifeSnapshot(),
        this.getInnerLifeDoctor(agentId)
      ]);
      const sameAgent = (item) => String(item?.agentId || item?.agent_id || "").trim() === agentId;
      const pendingShares = (innerLife.pendingShares || []).filter(sameAgent).slice(0, limit);
      const pendingInbox = (innerLife.inbox || []).filter((item) => item.status === "pending" && sameAgent(item)).slice(0, limit);
      const recentShares = (innerLife.recentShares || []).filter(sameAgent).slice(0, limit);
      const memoryText = memories.length
        ? memories.map((memory, index) => `${index + 1}. ${memory.title || memory.body.slice(0, 80)} [${memory.id}]`).join("\n")
        : "(none)";
      const shareText = pendingShares.length
        ? pendingShares.map((share, index) => `${index + 1}. ${String(share.body || "").split("\n")[0]} [${share.id}]`).join("\n")
        : "(none)";
      const inboxText = pendingInbox.length
        ? pendingInbox.map((item, index) => `${index + 1}. ${item.source}: ${item.body}`).join("\n")
        : "(none)";
      const doctorText = doctor.issues.length
        ? doctor.issues.map((issue, index) => `${index + 1}. ${issue.level}/${issue.code}: ${issue.message} Action: ${issue.action}`).join("\n")
        : "No recovery action is needed.";
      const text = [
        "# ClaraCore Gateway Context",
        "",
        `Agent: ${agentId}`,
        `Generated at: ${new Date().toISOString()}`,
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
        doctorText,
        "",
        "## Agent Guidance",
        "Use Shared Line as the current position, Memory as durable facts, and InnerLife waiting shares only when they fit the current moment."
      ].join("\n");
      return {
        agentId,
        generatedAt: new Date().toISOString(),
        query,
        sharedLine,
        memories,
        innerLife: {
          counts: innerLife.counts,
          daemon: innerLife.daemon,
          doctor,
          pendingShares,
          pendingInbox,
          recentShares,
          recentThoughts: (innerLife.recentThoughts || []).slice(0, limit)
        },
        guidance: {
          useSharedLine: "Treat Shared Line as the current resumable position.",
          useMemory: "Treat Memory as durable reviewed facts.",
          useInnerLife: "Use this agent's InnerLife waiting shares only when they fit the current moment.",
          oldServices: "Do not read or mutate old ClaraCore service databases from this Gateway context."
        },
        text
      };
    }
  });
}

module.exports = {
  installContinuityRepository
};
