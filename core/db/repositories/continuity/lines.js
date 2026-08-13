function createContinuityLineRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    ambiguousSharedLineError,
    jsonSql,
    newId,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  const CONTINUITY_LINE_SELECT = `
    SELECT
      l.id,
      l.agent_id,
      l.title,
      l.status,
      l.created_at,
      l.updated_at,
      substr(p.summary, 1, 360) AS summary,
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

  const CONTINUITY_LINE_SUMMARY_SELECT = `
    SELECT
      l.id,
      l.agent_id,
      l.title,
      l.status,
      l.created_at,
      l.updated_at,
      p.summary,
      p.interpretation_status,
      substr(json_extract(p.metadata_json, '$.nextStep'), 1, 240) AS next_step,
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

  function mapContinuityLineSummaryRow(row, activeLineId) {
    return {
      id: row.id,
      agentId: row.agent_id || DEFAULT_AGENT_ID,
      title: row.title || "Shared Line",
      status: row.status || "active",
      active: row.id === activeLineId,
      summary: row.summary || "",
      interpretationStatus: row.interpretation_status || "draft",
      nextStep: row.next_step || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      positionUpdatedAt: row.position_updated_at
    };
  }

  const buildAmbiguousSharedLineError = ambiguousSharedLineError;

  return {
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

    async getActiveContinuityLineIdReadOnly() {
      const settings = await this.getSettings();
      const configured = String(settings["continuity.active_line_id"] || "").trim();
      const rows = await this.query(`
        SELECT id
        FROM continuity_lines
        WHERE status = 'active'
        ORDER BY
          CASE WHEN id = ${sqlString(configured)} THEN 0 ELSE 1 END,
          CASE WHEN id = 'line_default' THEN 0 ELSE 1 END,
          updated_at DESC,
          created_at DESC
        LIMIT 1;
      `);
      return rows[0]?.id || null;
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

    async resolveContinuityLineIdReadOnly(lineId = null) {
      const requested = String(lineId || "").trim();
      if (!requested) return (await this.getActiveContinuityLineIdReadOnly()) || "line_default";
      const rows = await this.query(`
        SELECT id
        FROM continuity_lines
        WHERE id = ${sqlString(requested)} AND status = 'active'
        LIMIT 1;
      `);
      if (!rows[0]?.id && requested !== "line_default") throw new Error("Shared Line not found.");
      return requested;
    },

    async findContinuityLineIdForAgent(agentIdInput = "") {
      const agentId = String(agentIdInput || "").trim();
      if (!agentId) return null;
      if (agentId === "http-agent" || agentId === "unknown-agent") return null;
      const rows = await this.query(`
        ${CONTINUITY_LINE_SELECT}
        WHERE l.agent_id = ${sqlString(agentId)} AND l.status = 'active' AND l.id != 'line_default'
        ORDER BY l.updated_at DESC, l.created_at DESC
        LIMIT 20;
      `);
      const lines = rows.map((row) => mapContinuityLineRow(row, null));
      if (lines.length > 1) {
        // The candidate query is capped, so count separately rather than
        // reporting the page size as the total. This runs only on the refusal
        // path, which is rare and already an error.
        const totals = await this.query(`
          SELECT COUNT(*) AS total
          FROM continuity_lines
          WHERE agent_id = ${sqlString(agentId)} AND status = 'active' AND id != 'line_default';
        `);
        throw buildAmbiguousSharedLineError(agentId, lines, Number(totals?.[0]?.total ?? lines.length));
      }
      return lines[0]?.id || null;
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
      const activeLineId = await this.getActiveContinuityLineIdReadOnly();
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

    async listContinuityLineSummaries(input = {}) {
      const activeLineId = await this.getActiveContinuityLineIdReadOnly();
      const options = typeof input === "object" && input !== null ? input : { limit: input };
      const requestedLimit = Number.parseInt(String(options.limit ?? 10), 10);
      const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 10, 50));
      const offset = Math.max(0, Number.parseInt(String(options.offset || 0), 10) || 0);
      const agentId = String(options.agentId || options.agent_id || "").trim();
      const status = String(options.status || "").trim();
      const filters = ["l.status != 'deleted'"];
      if (status === "active") filters.push("l.status = 'active'");
      if (status === "archived") filters.push("l.status = 'archived'");
      if (agentId && !options.allAgents) filters.push(`l.agent_id = ${sqlString(agentId)}`);
      const where = filters.join(" AND ");
      const [rows, totals] = await Promise.all([
        this.query(`
          ${CONTINUITY_LINE_SUMMARY_SELECT}
          WHERE ${where}
          ORDER BY
            CASE WHEN l.id = ${sqlString(activeLineId)} THEN 0 ELSE 1 END,
            l.updated_at DESC,
            l.created_at DESC
          LIMIT ${limit} OFFSET ${offset};
        `),
        this.query(`SELECT COUNT(*) AS total FROM continuity_lines l WHERE ${where};`)
      ]);
      return {
        items: rows.map((row) => mapContinuityLineSummaryRow(row, activeLineId)),
        total: Number(totals[0]?.total || 0),
        limit,
        offset,
        requestedLimit
      };
    },

    async getContinuityLine(lineId) {
      const id = String(lineId || "").trim();
      if (!id) return null;
      const activeLineId = await this.getActiveContinuityLineIdReadOnly();
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
    }
  };
}

module.exports = {
  createContinuityLineRepository
};
