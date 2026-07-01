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

function createContinuityAgentRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  function normalizeModelAdjustmentRow(row) {
    if (!row) return null;
    return {
      model: row.model,
      forbiddenPhrases: parseJson(row.forbidden_phrases_json, []),
      forbiddenPatterns: parseJson(row.forbidden_patterns_json, []),
      injectPrompt: row.inject_prompt || "",
      updatedBy: row.updated_by || "desktop",
      updatedAt: row.updated_at || ""
    };
  }

  return {
    async ensureContinuityAgentState(agentIdInput = DEFAULT_AGENT_ID) {
      const identity = resolveAgentIdentity({ agentId: agentIdInput });
      await this.exec(`
        INSERT INTO continuity_agent_state (agent_id)
        VALUES (${sqlString(identity.id)})
        ON CONFLICT(agent_id) DO NOTHING;
      `);
      return identity.id;
    },

    async getContinuityAgentState(agentIdInput = DEFAULT_AGENT_ID) {
      const agentId = await this.ensureContinuityAgentState(agentIdInput);
      const rows = await this.query(`
        SELECT agent_id, communication_style, relationship_position, long_term_preferences_json,
               boundaries_json, stable_patterns_json, notes, updated_at
        FROM continuity_agent_state
        WHERE agent_id = ${sqlString(agentId)}
        LIMIT 1;
      `);
      const row = rows[0] || {};
      return {
        agentId,
        communicationStyle: row.communication_style || "",
        relationshipPosition: row.relationship_position || "",
        longTermPreferences: parseJson(row.long_term_preferences_json, []),
        boundaries: parseJson(row.boundaries_json, []),
        stablePatterns: parseJson(row.stable_patterns_json, []),
        notes: row.notes || "",
        updatedAt: row.updated_at || ""
      };
    },

    async listContinuityAgentStates() {
      const rows = await this.query(`
        SELECT agent_id, communication_style, relationship_position, long_term_preferences_json,
               boundaries_json, stable_patterns_json, notes, updated_at
        FROM continuity_agent_state
        ORDER BY updated_at DESC, agent_id ASC;
      `);
      return rows.map((row) => ({
        agentId: row.agent_id || DEFAULT_AGENT_ID,
        communicationStyle: row.communication_style || "",
        relationshipPosition: row.relationship_position || "",
        longTermPreferences: parseJson(row.long_term_preferences_json, []),
        boundaries: parseJson(row.boundaries_json, []),
        stablePatterns: parseJson(row.stable_patterns_json, []),
        notes: row.notes || "",
        updatedAt: row.updated_at || ""
      }));
    },

    async updateContinuityAgentState(agentIdInput = DEFAULT_AGENT_ID, update = {}) {
      const agentId = await this.ensureContinuityAgentState(agentIdInput);
      const current = await this.getContinuityAgentState(agentId);
      const next = {
        communicationStyle: firstDefined(update, ["communicationStyle", "communication_style"]) ?? current.communicationStyle,
        relationshipPosition: firstDefined(update, ["relationshipPosition", "relationship_position"]) ?? current.relationshipPosition,
        longTermPreferences: cleanList(firstDefined(update, ["longTermPreferences", "long_term_preferences"])) ?? current.longTermPreferences,
        boundaries: cleanList(firstDefined(update, ["boundaries"])) ?? current.boundaries,
        stablePatterns: cleanList(firstDefined(update, ["stablePatterns", "stable_patterns"])) ?? current.stablePatterns,
        notes: firstDefined(update, ["notes"]) ?? current.notes
      };
      await this.exec(`
        UPDATE continuity_agent_state
        SET communication_style = ${sqlString(next.communicationStyle)},
            relationship_position = ${sqlString(next.relationshipPosition)},
            long_term_preferences_json = ${jsonSql(next.longTermPreferences)},
            boundaries_json = ${jsonSql(next.boundaries)},
            stable_patterns_json = ${jsonSql(next.stablePatterns)},
            notes = ${sqlString(next.notes)},
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_id = ${sqlString(agentId)};
      `);
      return this.getContinuityAgentState(agentId);
    },

    async listContinuityModelAdjustments() {
      const rows = await this.query(`
        SELECT model, forbidden_phrases_json, forbidden_patterns_json, inject_prompt, updated_by, updated_at
        FROM continuity_model_adjustments
        ORDER BY model ASC;
      `);
      return rows.map(normalizeModelAdjustmentRow).filter(Boolean);
    },

    async getContinuityModelAdjustment(modelInput = "") {
      const model = String(modelInput || "").trim();
      if (!model) return null;
      const rows = await this.query(`
        SELECT model, forbidden_phrases_json, forbidden_patterns_json, inject_prompt, updated_by, updated_at
        FROM continuity_model_adjustments
        WHERE model = ${sqlString(model)}
        LIMIT 1;
      `);
      return normalizeModelAdjustmentRow(rows[0]);
    },

    async setContinuityModelAdjustment(input = {}) {
      const model = String(input.model || "").trim();
      if (!model) throw new Error("Model is required.");
      const existing = (await this.getContinuityModelAdjustment(model)) || {};
      const forbiddenPhrases = cleanList(firstDefined(input, ["forbiddenPhrases", "forbidden_phrases"])) ?? existing.forbiddenPhrases ?? [];
      const forbiddenPatterns = cleanList(firstDefined(input, ["forbiddenPatterns", "forbidden_patterns"])) ?? existing.forbiddenPatterns ?? [];
      const injectPrompt = firstDefined(input, ["injectPrompt", "inject_prompt"]) ?? existing.injectPrompt ?? "";
      const updatedBy = String(input.updatedBy || input.updated_by || input.actor || "desktop").trim() || "desktop";
      await this.exec(`
        INSERT INTO continuity_model_adjustments (
          model, forbidden_phrases_json, forbidden_patterns_json, inject_prompt, updated_by, updated_at
        )
        VALUES (
          ${sqlString(model)},
          ${jsonSql(forbiddenPhrases)},
          ${jsonSql(forbiddenPatterns)},
          ${sqlString(injectPrompt)},
          ${sqlString(updatedBy)},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(model) DO UPDATE SET
          forbidden_phrases_json = excluded.forbidden_phrases_json,
          forbidden_patterns_json = excluded.forbidden_patterns_json,
          inject_prompt = excluded.inject_prompt,
          updated_by = excluded.updated_by,
          updated_at = CURRENT_TIMESTAMP;
      `);
      return this.getContinuityModelAdjustment(model);
    },

    async deleteContinuityModelAdjustment(modelInput = "") {
      const model = String(modelInput || "").trim();
      if (!model) throw new Error("Model is required.");
      const existing = await this.getContinuityModelAdjustment(model);
      await this.exec(`DELETE FROM continuity_model_adjustments WHERE model = ${sqlString(model)};`);
      return { deleted: Boolean(existing), model };
    }
  };
}

module.exports = {
  createContinuityAgentRepository
};
