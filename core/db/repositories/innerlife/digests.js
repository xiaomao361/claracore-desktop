const {
  IL_SYSTEM,
  generateOrTemplate,
  summarizeInnerLifeProfile
} = require("../../../innerlife/policy");

const DIGEST_RUN_RETENTION_PER_AGENT = 200;

function createInnerLifeDigestRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    newId,
    resolveAgentIdentity,
    parseJson,
    sqlString
  } = helpers;

  function mapDigestRunRow(row) {
    return {
      id: row.id,
      agentId: row.agent_id,
      mode: row.mode,
      status: row.status,
      input: parseJson(row.input_json, {}),
      summary: row.summary || "",
      createdAt: row.created_at,
      completedAt: row.completed_at,
      metadata: parseJson(row.metadata_json, {})
    };
  }

  return {
    async listInnerLifeDigestRuns(agentId = DEFAULT_AGENT_ID, limit = 10, offset = 0) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 10));
      const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT id, agent_id, mode, status, input_json, summary, created_at, completed_at, metadata_json
        FROM innerlife_digest_runs
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return rows.map(mapDigestRunRow);
    },

    async listInnerLifeDigestRunsCompact(agentId = DEFAULT_AGENT_ID, limit = 10, offset = 0) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 10));
      const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT id, agent_id, mode, status, substr(summary, 1, 1000) AS summary, created_at, completed_at
        FROM innerlife_digest_runs
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        mode: row.mode,
        status: row.status,
        summary: row.summary || "",
        createdAt: row.created_at,
        completedAt: row.completed_at
      }));
    },

    async getInnerLifeDigestRun(id) {
      const digestId = String(id || "").trim();
      if (!digestId) throw new Error("InnerLife digest run id is required.");
      const rows = await this.query(`
        SELECT id, agent_id, mode, status, input_json, summary, created_at, completed_at, metadata_json
        FROM innerlife_digest_runs
        WHERE id = ${sqlString(digestId)}
        LIMIT 1;
      `);
      return rows[0] ? mapDigestRunRow(rows[0]) : null;
    },

    async countInnerLifeDigestRuns(agentId = "all") {
      const agentFilter = String(agentId || "all").trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`SELECT COUNT(*) AS count FROM innerlife_digest_runs ${whereClause};`);
      return rows[0]?.count || 0;
    },

    async listInnerLifeDigestRunsPage(input = {}) {
      const agentId = String(input.agentId || input.agent_id || "all").trim() || "all";
      const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 10), 10) || 10, 50));
      const offset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
      const [items, total] = await Promise.all([
        this.listInnerLifeDigestRunsCompact(agentId, limit, offset),
        this.countInnerLifeDigestRuns(agentId)
      ]);
      return {
        agentId,
        items,
        limit,
        offset,
        total,
        hasMore: offset + items.length < total
      };
    },

    async runInnerLifeDigest(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const mode = String(input.mode || "manual").trim() || "manual";
      const prompt = String(input.prompt || "").trim();
      const { resumePacket, sharedLineContext } = await this.getOptionalInnerLifeResumePacket(input, profile.agent_id);
      const memories = await this.listMemories(5);
      const inboxItems = (await this.listInnerLifeInboxPage({ agentId: profile.agent_id, status: "pending", limit: 10, offset: 0 })).items;
      const digestId = newId("inner_digest");
      const eventId = newId("inner_event");
      const thoughtId = newId("inner_thought");
      const memoryLines = memories.map((memory) => `- ${memory.title || memory.body.slice(0, 80)}`).join("\n") || "- No recent Memory records.";
      const inboxLines = inboxItems.map((item) => `- ${item.source}: ${item.body}`).join("\n") || "- No pending inbox items.";
      const currentPosition = resumePacket.currentPosition.summary || (
        sharedLineContext.status === "ambiguous"
          ? "Shared Line selection is ambiguous; no line context was used."
          : "No Shared Line position saved yet."
      );
      const template = [
        "InnerLife digest",
        "",
        summarizeInnerLifeProfile(profile),
        "",
        `Mode: ${mode}`,
        `Current position: ${currentPosition}`,
        "",
        "Inbox digested:",
        inboxLines,
        "",
        "Recent Memory context:",
        memoryLines,
        "",
        `Operator prompt: ${prompt || "Digest current state without sharing automatically."}`
      ].join("\n");
      const generated = await generateOrTemplate(this, {
        tier: mode === "deep" ? "deep" : "light",
        system: IL_SYSTEM.digest,
        prompt: template,
        template
      });
      const summary = generated.body;
      await this.exec(`
        INSERT INTO innerlife_digest_runs (id, agent_id, mode, status, input_json, summary, completed_at, metadata_json)
        VALUES (
          ${sqlString(digestId)},
          ${sqlString(profile.agent_id)},
          ${sqlString(mode)},
          'completed',
          ${jsonSql(input)},
          ${sqlString(summary)},
          CURRENT_TIMESTAMP,
          ${jsonSql({
            lineId: resumePacket.lineId,
            positionId: resumePacket.currentPosition.positionId,
            sharedLineStatus: sharedLineContext.status,
            candidateLineIds: sharedLineContext.candidateLineIds,
            memoryIds: memories.map((memory) => memory.id),
            inboxIds: inboxItems.map((item) => item.id),
            generationSource: generated.source,
            generationTier: generated.tier
          })}
        );

        INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
        VALUES (
          ${sqlString(eventId)},
          ${sqlString(profile.agent_id)},
          'digest',
          ${sqlString(prompt || "Manual digest")},
          'processed',
          ${jsonSql({ digestId, inboxIds: inboxItems.map((item) => item.id) })}
        );

        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(summary)}, 'unreviewed');
      `);
      if (inboxItems.length > 0) {
        await this.exec(`
          UPDATE innerlife_inbox
          SET status = 'processed',
              processed_at = CURRENT_TIMESTAMP
          WHERE id IN (${inboxItems.map((item) => sqlString(item.id)).join(", ")});
        `);
      }
      await this.pruneInnerLifeDigestRuns(profile.agent_id);
      return {
        digest: await this.getInnerLifeDigestRun(digestId),
        eventId,
        thoughtId,
        convergence: null,
        sharedLineContext,
        processedInboxIds: inboxItems.map((item) => item.id),
        snapshot: await this.getInnerLifeSnapshotLite(profile.agent_id)
      };
    },

    async pruneInnerLifeDigestRuns(agentId, keep = DIGEST_RUN_RETENTION_PER_AGENT) {
      const id = String(agentId || "").trim();
      if (!id) return;
      const safeLimit = Math.max(1, Number.parseInt(String(keep), 10) || DIGEST_RUN_RETENTION_PER_AGENT);
      await this.exec(`
        DELETE FROM innerlife_digest_runs
        WHERE agent_id = ${sqlString(id)}
          AND id NOT IN (
            SELECT id FROM innerlife_digest_runs
            WHERE agent_id = ${sqlString(id)}
            ORDER BY created_at DESC, id DESC
            LIMIT ${safeLimit}
          );
      `);
    },

  };
}

module.exports = {
  createInnerLifeDigestRepository
};
