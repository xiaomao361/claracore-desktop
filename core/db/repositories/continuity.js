function installContinuityRepository(ProductDatabase, helpers) {
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    newId,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  Object.assign(ProductDatabase.prototype, {
    async ensureDefaultContinuityLine() {
      const lineId = "line_default";
      await this.exec(`
        INSERT INTO continuity_lines (id, title, status)
        VALUES (${sqlString(lineId)}, 'Default Shared Line', 'active')
        ON CONFLICT(id) DO UPDATE SET
          status = 'active',
          updated_at = CURRENT_TIMESTAMP;
      `);
      return lineId;
    }
    ,
    
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
    }
    ,
    
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
    }
    ,
    
    async listContinuityLines(limit = 20) {
      await this.ensureDefaultContinuityLine();
      const activeLineId = await this.getActiveContinuityLineId();
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 20, 100));
      const rows = await this.query(`
        SELECT
          l.id,
          l.title,
          l.status,
          l.created_at,
          l.updated_at,
          p.summary,
          p.interpretation_status,
          p.metadata_json,
          p.updated_at AS position_updated_at
        FROM continuity_lines l
        LEFT JOIN current_positions p ON p.line_id = l.id
        WHERE l.status != 'deleted'
        ORDER BY
          CASE WHEN l.id = ${sqlString(activeLineId)} THEN 0 ELSE 1 END,
          l.updated_at DESC,
          l.created_at DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => ({
        id: row.id,
        title: row.title || "Shared Line",
        status: row.status || "active",
        active: row.id === activeLineId,
        summary: row.summary || "",
        interpretationStatus: row.interpretation_status || "draft",
        metadata: parseJson(row.metadata_json, {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        positionUpdatedAt: row.position_updated_at
      }));
    }
    ,
    
    async createContinuityLine(input = {}) {
      const title = String(input.title || "").trim();
      if (!title) throw new Error("Shared Line title is required.");
      const id = String(input.id || newId("line")).trim();
      await this.exec(`
        INSERT INTO continuity_lines (id, title, status)
        VALUES (${sqlString(id)}, ${sqlString(title)}, 'active');
      `);
      if (input.makeActive !== false) {
        await this.setActiveContinuityLine(id);
      }
      return (await this.listContinuityLines(100)).find((line) => line.id === id);
    }
    ,
    
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
      return (await this.listContinuityLines(100)).find((line) => line.id === id);
    }
    ,
    
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
      return (await this.listContinuityLines(100)).find((line) => line.id === id);
    }
    ,
    
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
      return (await this.listContinuityLines(100)).find((line) => line.id === id);
    }
    ,
    
    async setActiveContinuityLine(lineId) {
      const id = await this.resolveContinuityLineId(lineId);
      await this.exec(`
        INSERT INTO app_settings (key, value_json, updated_at)
        VALUES ('continuity.active_line_id', ${jsonSql(id)}, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = CURRENT_TIMESTAMP;
      `);
      return (await this.listContinuityLines(100)).find((line) => line.id === id);
    }
    ,
    
    async getCurrentPosition(lineIdInput = null) {
      const lineId = await this.resolveContinuityLineId(lineIdInput);
      const rows = await this.query(`
        SELECT
          l.id AS line_id,
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
        lineTitle: row.line_title || "Default Shared Line",
        lineStatus: row.line_status || "active",
        positionId: row.position_id || "position_default",
        summary: row.summary || "",
        interpretationStatus: row.interpretation_status || "draft",
        factsUsed: parseJson(row.facts_used_json, []),
        metadata: parseJson(row.metadata_json, {}),
        updatedAt: row.updated_at || null
      };
    }
    ,
    
    async saveCurrentPosition(input) {
      const lineId = await this.resolveContinuityLineId(input?.lineId || null);
      const positionId = `position_${lineId}`;
      const summary = String(input?.summary || "").trim();
      if (!summary) throw new Error("Current position summary is required.");
      const status = ["draft", "confirmed"].includes(String(input?.interpretationStatus || "").trim())
        ? String(input.interpretationStatus).trim()
        : "draft";
      const factsUsed = Array.isArray(input?.factsUsed) ? input.factsUsed.map((item) => String(item).trim()).filter(Boolean) : [];
      const source = String(input?.source || "desktop").trim() || "desktop";
      const current = await this.getCurrentPosition(lineId);
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
      await this.exec(`
        INSERT INTO current_positions (id, line_id, summary, interpretation_status, facts_used_json, metadata_json, updated_at)
        VALUES (${sqlString(positionId)}, ${sqlString(lineId)}, ${sqlString(summary)}, ${sqlString(status)}, ${jsonSql(factsUsed)}, ${jsonSql(input?.metadata || {})}, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
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
    }
    ,
    
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
    }
    ,
    
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
    }
    ,
    
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
    }
    ,
    
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
    }
    ,
    
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
    }
    ,
    
    async getResumePacket(input = {}) {
      const currentPosition = await this.getCurrentPosition(input.lineId || null);
      const lines = await this.listContinuityLines(20);
      const history = await this.listContinuityPositionHistory(5, currentPosition.lineId);
      const snapshots = await this.listContinuitySnapshots(5, currentPosition.lineId);
      const handoffs = await this.listContinuityHandoffs(3, currentPosition.lineId);
      const nextStep = currentPosition.summary
        ? "Resume from the current shared position and ask before overwriting it."
        : "No shared position has been saved yet.";
      const historyText = history.length
        ? history.map((item, index) => `${index + 1}. ${item.summary} (${item.interpretationStatus}, ${item.createdAt})`).join("\n")
        : "(none)";
      const handoffText = handoffs.length
        ? handoffs.map((item, index) => `${index + 1}. ${item.objective} -> ${item.nextStep} (${item.createdAt})`).join("\n")
        : "(none)";
      return {
        lineId: currentPosition.lineId,
        lineTitle: currentPosition.lineTitle,
        lines,
        currentPosition,
        history,
        snapshots,
        handoffs,
        nextStep,
        text: [
          `Shared Line: ${currentPosition.lineTitle}`,
          `Current position: ${currentPosition.summary || "(empty)"}`,
          `Interpretation status: ${currentPosition.interpretationStatus}`,
          `Updated at: ${currentPosition.updatedAt || "(not saved)"}`,
          `Recent history:\n${historyText}`,
          `Recent handoffs:\n${handoffText}`,
          `Next step: ${nextStep}`
        ].join("\n")
      };
    }
    ,
    
    async getGatewayContext(input = {}) {
      const identity = resolveAgentIdentity(input || {});
      const agentId = identity.id;
      const query = String(input.query || "").trim();
      const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 5), 10) || 5, 20));
      const sharedLine = await this.getResumePacket(input.lineId ? { lineId: input.lineId } : {});
      const memories = query
        ? (await this.searchMemories(query, limit)).results.slice(0, limit)
        : await this.listMemories(limit);
      const innerLife = await this.getInnerLifeSnapshot();
      const doctor = await this.getInnerLifeDoctor(agentId);
      const pendingShares = (innerLife.pendingShares || []).slice(0, limit);
      const pendingInbox = (innerLife.inbox || []).filter((item) => item.status === "pending").slice(0, limit);
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
        "Use Shared Line as the current position, Memory as durable facts, and InnerLife output only after review."
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
          recentShares: (innerLife.recentShares || []).slice(0, limit),
          recentThoughts: (innerLife.recentThoughts || []).slice(0, limit)
        },
        guidance: {
          useSharedLine: "Treat Shared Line as the current resumable position.",
          useMemory: "Treat Memory as durable reviewed facts.",
          useInnerLife: "Use InnerLife shares only after explicit review or approved status.",
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
