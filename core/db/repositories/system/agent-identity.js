const { DIRECT_AGENT_REFERENCES } = require("../../agent-identity-references");

const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SINGLETON_SNAPSHOT_CONSTRAINT = "agent_identity_singleton_snapshot_unchanged";
const SINGLETON_POLICIES = Object.freeze({
  continuity_agent_state: Object.freeze({
    columns: Object.freeze([
      "agent_id",
      "communication_style",
      "relationship_position",
      "long_term_preferences_json",
      "boundaries_json",
      "stable_patterns_json",
      "notes",
      "updated_at"
    ]),
    semanticColumns: Object.freeze([
      "communication_style",
      "relationship_position",
      "long_term_preferences_json",
      "boundaries_json",
      "stable_patterns_json",
      "notes"
    ]),
    jsonColumns: Object.freeze([
      "long_term_preferences_json",
      "boundaries_json",
      "stable_patterns_json"
    ]),
    resolution:
      "Align the two states with shared_line_agent_state, then retry the identity merge."
  }),
  innerlife_daemon_state: Object.freeze({
    columns: Object.freeze([
      "agent_id",
      "status",
      "enabled",
      "last_tick_at",
      "next_run_at",
      "last_result",
      "last_error",
      "tick_count",
      "updated_at",
      "metadata_json"
    ]),
    semanticColumns: Object.freeze([
      "status",
      "enabled",
      "last_tick_at",
      "next_run_at",
      "last_result",
      "last_error",
      "tick_count",
      "metadata_json"
    ]),
    jsonColumns: Object.freeze(["metadata_json"]),
    resolution:
      "Reconcile daemon state with innerlife_daemon_status and innerlife_daemon_set, then retry the identity merge."
  }),
  innerlife_profiles: Object.freeze({
    columns: Object.freeze([
      "agent_id",
      "display_name",
      "enabled",
      "profile_json",
      "state_json",
      "created_at",
      "updated_at"
    ]),
    semanticColumns: Object.freeze([
      "display_name",
      "enabled",
      "profile_json",
      "state_json"
    ]),
    jsonColumns: Object.freeze(["profile_json", "state_json"]),
    identityJsonColumns: Object.freeze(["profile_json"]),
    resolution:
      "Align the two profiles with innerlife_profile_set, then retry the identity merge."
  })
});

class AgentIdentityMergeConflictError extends Error {
  constructor(sourceAgentId, targetAgentId, conflicts) {
    const locations = conflicts
      .map((conflict) => {
        const differences = conflict.differingFields
          .map((field) => {
            const source = JSON.stringify(field.sourceValue) ?? "null";
            const target = JSON.stringify(field.targetValue) ?? "null";
            const sourcePreview = source.length > 180 ? `${source.slice(0, 177)}...` : source;
            const targetPreview = target.length > 180 ? `${target.slice(0, 177)}...` : target;
            return `${field.field}: source=${sourcePreview}, target=${targetPreview}`;
          })
          .join(", ");
        return `${conflict.table} [${differences}]. ${conflict.resolution}`;
      })
      .join("; ");
    super(
      `Agent identity merge blocked by conflicting singleton state: ${locations} ` +
      "No records were changed and the source Agent was preserved. " +
      "Reconcile the listed fields through the supported domain tools, then retry."
    );
    this.name = "AgentIdentityMergeConflictError";
    this.code = "AGENT_IDENTITY_SINGLETON_CONFLICT";
    this.sourceAgentId = sourceAgentId;
    this.targetAgentId = targetAgentId;
    this.conflicts = conflicts;
    this.details = {
      code: this.code,
      sourceAgentId,
      targetAgentId,
      changed: false,
      conflicts
    };
  }
}

function sqlIdentifier(value) {
  if (!SQL_IDENTIFIER.test(value)) {
    throw new Error(`Unsafe static SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function countKey(reference) {
  return reference.table;
}

function buildReferenceCountsSql(id, sqlString) {
  const columns = [
    `(SELECT COUNT(*) FROM agents WHERE id = ${sqlString(id)}) AS agents`,
    ...DIRECT_AGENT_REFERENCES.map((reference) => (
      "(SELECT COUNT(*) FROM " +
      sqlIdentifier(reference.table) +
      " WHERE " +
      sqlIdentifier(reference.column) +
      " = " +
      sqlString(id) +
      ") AS " +
      sqlIdentifier(countKey(reference))
    ))
  ];
  return "SELECT\n  " + columns.join(",\n  ") + ";";
}

function buildDirectUpdatesSql(sourceAgentId, targetAgentId, sqlString) {
  return DIRECT_AGENT_REFERENCES
    .filter((reference) => reference.strategy === "direct")
    .map((reference) => (
      "UPDATE " +
      sqlIdentifier(reference.table) +
      " SET " +
      sqlIdentifier(reference.column) +
      " = " +
      sqlString(targetAgentId) +
      (reference.updatedAt ? ", updated_at = CURRENT_TIMESTAMP" : "") +
      " WHERE " +
      sqlIdentifier(reference.column) +
      " = " +
      sqlString(sourceAgentId) +
      ";"
    ))
    .join("\n");
}

function buildNoDirectReferencesSql(sourceAgentId, sqlString) {
  return DIRECT_AGENT_REFERENCES
    .map((reference) => (
      "NOT EXISTS (SELECT 1 FROM " +
      sqlIdentifier(reference.table) +
      " WHERE " +
      sqlIdentifier(reference.column) +
      " = " +
      sqlString(sourceAgentId) +
      ")"
    ))
    .join("\n        AND ");
}

function stableJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableJsonValue(item));
  }
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableJsonValue(value[key]);
      return result;
    }, {});
}

function jsonComparisonValue(rawValue, context) {
  try {
    const parsed = JSON.parse(String(rawValue));
    if (
      context.identityJson &&
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      const normalized = { ...parsed };
      if (normalized.agentId === context.rowAgentId) {
        normalized.agentId = context.targetAgentId;
      }
      if (normalized.agent_id === context.rowAgentId) {
        normalized.agent_id = context.targetAgentId;
      }
      return { valid: true, value: stableJsonValue(normalized) };
    }
    return { valid: true, value: stableJsonValue(parsed) };
  } catch (_error) {
    return { valid: false, value: String(rawValue) };
  }
}

function singletonComparisonValue(policy, column, rawValue, rowAgentId, targetAgentId) {
  if (!policy.jsonColumns.includes(column)) return rawValue;
  return jsonComparisonValue(rawValue, {
    identityJson: (policy.identityJsonColumns || []).includes(column),
    rowAgentId,
    targetAgentId
  });
}

function comparableValue(value) {
  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "valid")) {
    return JSON.stringify(value);
  }
  return JSON.stringify(value ?? null);
}

function compactConflictValue(policy, column, rawValue) {
  if (!policy.jsonColumns.includes(column)) {
    const text = String(rawValue ?? "");
    return text.length <= 500
      ? rawValue
      : { preview: text.slice(0, 500), truncated: true };
  }
  const parsed = jsonComparisonValue(rawValue, {
    identityJson: false,
    rowAgentId: "",
    targetAgentId: ""
  });
  const value = parsed.valid ? parsed.value : rawValue;
  const serialized = JSON.stringify(value);
  return serialized.length <= 500
    ? value
    : { preview: serialized.slice(0, 500), truncated: true };
}

function singletonDifferingFields(snapshot, targetAgentId) {
  const { policy, source, target } = snapshot;
  return policy.semanticColumns
    .filter((column) => {
      const sourceValue = singletonComparisonValue(
        policy,
        column,
        source[column],
        source.agent_id,
        targetAgentId
      );
      const targetValue = singletonComparisonValue(
        policy,
        column,
        target[column],
        target.agent_id,
        targetAgentId
      );
      return comparableValue(sourceValue) !== comparableValue(targetValue);
    })
    .map((column) => ({
      field: column,
      sourceValue: compactConflictValue(policy, column, source[column]),
      targetValue: compactConflictValue(policy, column, target[column])
    }));
}

async function readSingletonSnapshots(database, sourceAgentId, targetAgentId, sqlString) {
  const singletonReferences = DIRECT_AGENT_REFERENCES
    .filter((reference) => reference.strategy === "singleton-safe");
  const snapshots = [];
  for (const reference of singletonReferences) {
    const policy = SINGLETON_POLICIES[reference.table];
    if (!policy) {
      throw new Error(`Missing singleton Agent merge policy for ${reference.table}.`);
    }
    const rows = await database.query(`
      SELECT ${policy.columns.map((column) => sqlIdentifier(column)).join(", ")}
      FROM ${sqlIdentifier(reference.table)}
      WHERE ${sqlIdentifier(reference.column)} IN (
        ${sqlString(sourceAgentId)},
        ${sqlString(targetAgentId)}
      );
    `);
    snapshots.push({
      table: reference.table,
      column: reference.column,
      policy,
      source: rows.find((row) => row[reference.column] === sourceAgentId) || null,
      target: rows.find((row) => row[reference.column] === targetAgentId) || null
    });
  }
  return snapshots;
}

function sqlSnapshotValue(value, sqlString) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return sqlString(String(value));
}

function buildSnapshotCondition(snapshot, side, agentId, sqlString) {
  const row = snapshot[side];
  if (!row) {
    return (
      "NOT EXISTS (SELECT 1 FROM " +
      sqlIdentifier(snapshot.table) +
      " WHERE " +
      sqlIdentifier(snapshot.column) +
      " = " +
      sqlString(agentId) +
      ")"
    );
  }
  const fieldChecks = snapshot.policy.columns
    .map((column) => (
      sqlIdentifier(column) + " IS " + sqlSnapshotValue(row[column], sqlString)
    ))
    .join("\n              AND ");
  return (
    "EXISTS (SELECT 1 FROM " +
    sqlIdentifier(snapshot.table) +
    "\n            WHERE " +
    fieldChecks +
    ")"
  );
}

function buildSingletonSnapshotGuardSql(snapshots, sourceAgentId, targetAgentId, sqlString) {
  const conditions = snapshots.flatMap((snapshot) => [
    buildSnapshotCondition(snapshot, "source", sourceAgentId, sqlString),
    buildSnapshotCondition(snapshot, "target", targetAgentId, sqlString)
  ]);
  return `
    CREATE TEMP TABLE agent_identity_singleton_guard (
      ok INTEGER CONSTRAINT ${SINGLETON_SNAPSHOT_CONSTRAINT} CHECK (ok = 1)
    );
    INSERT INTO agent_identity_singleton_guard (ok)
    VALUES (
      CASE WHEN
        ${conditions.join("\n        AND ")}
      THEN 1 ELSE 0 END
    );
    DROP TABLE agent_identity_singleton_guard;
  `;
}

function singletonResolutionSummary(snapshots) {
  return snapshots.map((snapshot) => {
    let action = "absent";
    if (snapshot.source && !snapshot.target) action = "moved";
    if (!snapshot.source && snapshot.target) action = "target-unchanged";
    if (snapshot.source && snapshot.target) action = "deduplicated-equivalent";
    return { table: snapshot.table, action };
  });
}

function createAgentIdentityRepository(helpers) {
  const {
    normalizeAgentId,
    sqlString
  } = helpers;

  return {
    async agentReferenceCounts(agentId) {
      const id = normalizeAgentId(agentId);
      if (!id) return {};
      const rows = await this.query(buildReferenceCountsSql(id, sqlString));
      const canonicalLabelRows = await this.query(`
        SELECT COUNT(*) AS c
        FROM memory_labels
        WHERE label = ${sqlString(`agent-id:${id}`)};
      `);
      return {
        ...(rows[0] || {}),
        memory_labels: Number(canonicalLabelRows[0]?.c || 0)
      };
    },

    async mergeAgentIdentity(input = {}) {
      const sourceAgentId = normalizeAgentId(
        input.fromAgentId || input.from_agent_id || input.sourceAgentId || input.source_agent_id || ""
      );
      const targetAgentId = normalizeAgentId(
        input.toAgentId || input.to_agent_id || input.targetAgentId || input.target_agent_id || ""
      );
      if (!sourceAgentId) throw new Error("Source agent id is required.");
      if (!targetAgentId) throw new Error("Target agent id is required.");
      if (sourceAgentId === targetAgentId) throw new Error("Source and target agent ids are the same.");
      if (input.confirm !== true) throw new Error("Agent identity merge requires confirm=true.");

      const sourceBefore = await this.agentReferenceCounts(sourceAgentId);
      const targetBefore = await this.agentReferenceCounts(targetAgentId);
      const singletonSnapshots = await readSingletonSnapshots(
        this,
        sourceAgentId,
        targetAgentId,
        sqlString
      );
      const singletonConflicts = singletonSnapshots
        .filter((snapshot) => snapshot.source && snapshot.target)
        .map((snapshot) => ({
          table: snapshot.table,
          differingFields: singletonDifferingFields(snapshot, targetAgentId),
          resolution: snapshot.policy.resolution
        }))
        .filter((conflict) => conflict.differingFields.length > 0);
      if (singletonConflicts.length > 0) {
        throw new AgentIdentityMergeConflictError(
          sourceAgentId,
          targetAgentId,
          singletonConflicts
        );
      }
      const singletonSnapshotGuardSql = buildSingletonSnapshotGuardSql(
        singletonSnapshots,
        sourceAgentId,
        targetAgentId,
        sqlString
      );
      const singletonResolutions = singletonResolutionSummary(singletonSnapshots);
      const sourceTail = sourceAgentId.split(":").filter(Boolean).pop() || sourceAgentId;
      const targetTail = targetAgentId.split(":").filter(Boolean).pop() || targetAgentId;
      const positionMatchRows = await this.query(`
        SELECT COUNT(*) AS c
        FROM current_positions
        WHERE json_valid(metadata_json)
          AND (
            json_extract(metadata_json, '$.agentId') = ${sqlString(sourceAgentId)}
            OR json_extract(metadata_json, '$.writerAgentId') = ${sqlString(sourceAgentId)}
          );
      `);
      const currentPositionMetadataUpdated = Number(positionMatchRows[0]?.c || 0);
      const directUpdatesSql = buildDirectUpdatesSql(sourceAgentId, targetAgentId, sqlString);
      const noDirectReferencesSql = buildNoDirectReferencesSql(sourceAgentId, sqlString);
      const sourceCanonicalLabel = `agent-id:${sourceAgentId}`;
      const targetCanonicalLabel = `agent-id:${targetAgentId}`;
      const sourceTailLabel = `agent:${sourceTail}`;
      const targetTailLabel = `agent:${targetTail}`;
      const tailLabelMigrationSql = sourceTail === targetTail
        ? ""
        : [
            "INSERT OR IGNORE INTO memory_labels (memory_id, label)",
            "SELECT memory_id, " + sqlString(targetTailLabel),
            "FROM memory_labels",
            "WHERE label = " + sqlString(sourceCanonicalLabel) + ";",
            "DELETE FROM memory_labels",
            "WHERE label = " + sqlString(sourceTailLabel),
            "  AND memory_id IN (",
            "    SELECT memory_id FROM memory_labels WHERE label = " + sqlString(sourceCanonicalLabel),
            "  );"
          ].join("\n");

      try {
        await this.exec(`
          BEGIN IMMEDIATE;

          ${singletonSnapshotGuardSql}

          INSERT INTO agents (id, label, role, status)
          VALUES (${sqlString(targetAgentId)}, ${sqlString(targetTail)}, 'agent', 'active')
          ON CONFLICT(id) DO UPDATE SET
            label = CASE WHEN label = '' OR label = id THEN excluded.label ELSE label END,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP;

          ${directUpdatesSql}

          UPDATE current_positions
          SET metadata_json = json_set(metadata_json, '$.agentId', ${sqlString(targetAgentId)})
          WHERE json_valid(metadata_json)
            AND json_extract(metadata_json, '$.agentId') = ${sqlString(sourceAgentId)};
          UPDATE current_positions
          SET metadata_json = json_set(metadata_json, '$.writerAgentId', ${sqlString(targetAgentId)})
          WHERE json_valid(metadata_json)
            AND json_extract(metadata_json, '$.writerAgentId') = ${sqlString(sourceAgentId)};

          UPDATE gateway_traces
          SET request_json = json_remove(
            json_set(request_json, '$.agentId', ${sqlString(targetAgentId)}),
            '$.agent_id'
          )
          WHERE json_valid(request_json)
            AND (
              json_extract(request_json, '$.agentId') = ${sqlString(sourceAgentId)}
              OR json_extract(request_json, '$.agent_id') = ${sqlString(sourceAgentId)}
            );

          UPDATE innerlife_sessions
          SET external_session_id = external_session_id || ':' || id
          WHERE agent_id = ${sqlString(sourceAgentId)}
            AND external_session_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM innerlife_sessions existing
              WHERE existing.agent_id = ${sqlString(targetAgentId)}
                AND existing.external_session_id = innerlife_sessions.external_session_id
            );
          UPDATE innerlife_sessions
          SET agent_id = ${sqlString(targetAgentId)}
          WHERE agent_id = ${sqlString(sourceAgentId)};

          INSERT INTO innerlife_profiles (agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at)
          SELECT ${sqlString(targetAgentId)}, display_name, enabled, profile_json, state_json, created_at, updated_at
          FROM innerlife_profiles
          WHERE agent_id = ${sqlString(sourceAgentId)}
            AND NOT EXISTS (SELECT 1 FROM innerlife_profiles WHERE agent_id = ${sqlString(targetAgentId)});
          UPDATE innerlife_profiles
          SET created_at = MIN(
                created_at,
                (SELECT created_at FROM innerlife_profiles WHERE agent_id = ${sqlString(sourceAgentId)})
              ),
              updated_at = MAX(
                updated_at,
                (SELECT updated_at FROM innerlife_profiles WHERE agent_id = ${sqlString(sourceAgentId)})
              )
          WHERE agent_id = ${sqlString(targetAgentId)}
            AND EXISTS (SELECT 1 FROM innerlife_profiles WHERE agent_id = ${sqlString(sourceAgentId)});
          DELETE FROM innerlife_profiles WHERE agent_id = ${sqlString(sourceAgentId)};
          UPDATE innerlife_profiles
          SET profile_json = json_set(profile_json, '$.agentId', ${sqlString(targetAgentId)})
          WHERE agent_id = ${sqlString(targetAgentId)}
            AND json_valid(profile_json)
            AND json_extract(profile_json, '$.agentId') = ${sqlString(sourceAgentId)};

          INSERT INTO innerlife_daemon_state (
            agent_id, status, enabled, last_tick_at, next_run_at, last_result,
            last_error, tick_count, metadata_json, updated_at
          )
          SELECT
            ${sqlString(targetAgentId)}, status, enabled, last_tick_at, next_run_at, last_result,
            last_error, tick_count, metadata_json, updated_at
          FROM innerlife_daemon_state
          WHERE agent_id = ${sqlString(sourceAgentId)}
            AND NOT EXISTS (SELECT 1 FROM innerlife_daemon_state WHERE agent_id = ${sqlString(targetAgentId)});
          UPDATE innerlife_daemon_state
          SET updated_at = MAX(
                updated_at,
                (SELECT updated_at FROM innerlife_daemon_state WHERE agent_id = ${sqlString(sourceAgentId)})
              )
          WHERE agent_id = ${sqlString(targetAgentId)}
            AND EXISTS (SELECT 1 FROM innerlife_daemon_state WHERE agent_id = ${sqlString(sourceAgentId)});
          DELETE FROM innerlife_daemon_state WHERE agent_id = ${sqlString(sourceAgentId)};

          INSERT INTO continuity_agent_state (
            agent_id, communication_style, relationship_position,
            long_term_preferences_json, boundaries_json, stable_patterns_json,
            notes, updated_at
          )
          SELECT
            ${sqlString(targetAgentId)}, communication_style, relationship_position,
            long_term_preferences_json, boundaries_json, stable_patterns_json,
            notes, updated_at
          FROM continuity_agent_state
          WHERE agent_id = ${sqlString(sourceAgentId)}
            AND NOT EXISTS (SELECT 1 FROM continuity_agent_state WHERE agent_id = ${sqlString(targetAgentId)});
          UPDATE continuity_agent_state
          SET updated_at = MAX(
                updated_at,
                (SELECT updated_at FROM continuity_agent_state WHERE agent_id = ${sqlString(sourceAgentId)})
              )
          WHERE agent_id = ${sqlString(targetAgentId)}
            AND EXISTS (SELECT 1 FROM continuity_agent_state WHERE agent_id = ${sqlString(sourceAgentId)});
          DELETE FROM continuity_agent_state WHERE agent_id = ${sqlString(sourceAgentId)};

          ${tailLabelMigrationSql}
          INSERT OR IGNORE INTO memory_labels (memory_id, label)
          SELECT memory_id, ${sqlString(targetCanonicalLabel)}
          FROM memory_labels
          WHERE label = ${sqlString(sourceCanonicalLabel)};
          DELETE FROM memory_labels WHERE label = ${sqlString(sourceCanonicalLabel)};

          UPDATE memory_label_aliases
          SET canonical_label = ${sqlString(targetCanonicalLabel)}
          WHERE canonical_label = ${sqlString(sourceCanonicalLabel)};
          INSERT INTO memory_label_aliases (alias, canonical_label)
          VALUES (${sqlString(sourceCanonicalLabel)}, ${sqlString(targetCanonicalLabel)})
          ON CONFLICT(alias) DO UPDATE SET canonical_label = excluded.canonical_label;

          UPDATE app_settings
          SET value_json = (
            SELECT json_group_array(agent_id)
            FROM (
              SELECT
                MIN(key) AS first_index,
                CASE WHEN value = ${sqlString(sourceAgentId)} THEN ${sqlString(targetAgentId)} ELSE value END AS agent_id
              FROM json_each(app_settings.value_json)
              GROUP BY CASE WHEN value = ${sqlString(sourceAgentId)} THEN ${sqlString(targetAgentId)} ELSE value END
              ORDER BY first_index
            )
          ),
          updated_at = CURRENT_TIMESTAMP
          WHERE key = 'memory.controller.canary_agent_ids'
            AND json_valid(value_json)
            AND json_type(value_json) = 'array'
            AND NOT EXISTS (SELECT 1 FROM json_each(value_json) WHERE type <> 'text')
            AND EXISTS (SELECT 1 FROM json_each(value_json) WHERE value = ${sqlString(sourceAgentId)});

          UPDATE app_settings
          SET value_json = ${sqlString(JSON.stringify(targetAgentId))},
              updated_at = CURRENT_TIMESTAMP
          WHERE key = 'agent.default_id'
            AND json_valid(value_json)
            AND json_type(value_json) = 'text'
            AND json_extract(value_json, '$') = ${sqlString(sourceAgentId)};

          DELETE FROM agents
          WHERE id = ${sqlString(sourceAgentId)}
            AND ${noDirectReferencesSql};

          COMMIT;
        `);
      } catch (error) {
        try {
          await this.exec("ROLLBACK;");
        } catch (_rollbackError) {
          // The sqlite3 CLI connection closes and rolls back automatically.
        }
        if (String(error?.message || error).includes(SINGLETON_SNAPSHOT_CONSTRAINT)) {
          const changedError = new Error(
            "Agent identity merge stopped because singleton state changed while the merge was being prepared. " +
            "No records were changed and the source Agent was preserved. Review the source and target state, then retry."
          );
          changedError.name = "AgentIdentityMergeRetryError";
          changedError.code = "AGENT_IDENTITY_SINGLETON_STATE_CHANGED";
          changedError.sourceAgentId = sourceAgentId;
          changedError.targetAgentId = targetAgentId;
          throw changedError;
        }
        throw error;
      }

      return {
        sourceAgentId,
        targetAgentId,
        sourceBefore,
        targetBefore,
        sourceAfter: await this.agentReferenceCounts(sourceAgentId),
        targetAfter: await this.agentReferenceCounts(targetAgentId),
        currentPositionMetadataUpdated,
        singletonResolutions
      };
    }
  };
}

module.exports = {
  createAgentIdentityRepository
};
