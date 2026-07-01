function mapMemoryRecordRow(row, parseJson) {
  return {
    id: row.id,
    userId: row.user_id || "local-user",
    recordType: row.record_type,
    title: row.title || "",
    value: parseJson(row.value_json, {}),
    occurredAt: row.occurred_at,
    localDate: row.local_date || "",
    timezone: row.timezone || "Asia/Shanghai",
    schemaVersion: row.schema_version || 1,
    note: row.note || "",
    source: row.source || "",
    sourceAgent: row.source_agent || "",
    sourceRunId: row.source_run_id || "",
    dedupeKey: row.dedupe_key || "",
    status: row.status,
    memoryId: row.memory_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: parseJson(row.metadata_json, {})
  };
}

function createMemoriaRecordRepository(helpers) {
  const {
    jsonSql,
    localDateForTimezone,
    newId,
    normalizeMemoryRecordValue,
    parseAwareDate,
    parseJson,
    requiredText,
    sqlString
  } = helpers;

  return {
    async createMemoryRecord(input = {}) {
      const recordType = requiredText(input.recordType || input.type, "recordType").toLowerCase();
      const userId = requiredText(input.userId || input.user_id || input.metadata?.userId || "local-user", "userId");
      const title = String(input.title || recordType).trim() || recordType;
      const schemaVersion = Number.parseInt(String(input.schemaVersion || input.schema_version || 1), 10) || 1;
      const value = normalizeMemoryRecordValue(recordType, schemaVersion, input.value || input.data || {});
      const occurredDate = parseAwareDate(input.occurredAt || input.occurred_at || new Date().toISOString(), "occurredAt");
      const occurredAt = occurredDate.toISOString();
      const timezone = requiredText(input.timezone || input.timezoneName || input.metadata?.timezone || "Asia/Shanghai", "timezone");
      const localDate = localDateForTimezone(occurredDate, timezone);
      const source = String(input.source || "manual_desktop").trim() || "manual_desktop";
      const note = String(input.note || "").trim() || null;
      const sourceAgent = String(input.sourceAgent || input.source_agent || input.metadata?.sourceAgent || "").trim() || null;
      const sourceRunId = String(input.sourceRunId || input.source_run_id || input.metadata?.sourceRunId || "").trim() || null;
      const dedupeKey = String(input.dedupeKey || input.dedupe_key || input.metadata?.dedupeKey || "").trim() || null;
      if (dedupeKey) {
        const existingRows = await this.query(`
          SELECT id
          FROM memory_records
          WHERE user_id = ${sqlString(userId)}
            AND record_type = ${sqlString(recordType)}
            AND dedupe_key = ${sqlString(dedupeKey)}
          LIMIT 1;
        `);
        if (existingRows[0]?.id) {
          return {
            ...(await this.getMemoryRecord(existingRows[0].id)),
            writeStatus: "exists"
          };
        }
      }
      const id = newId("mem_record");
      await this.exec(`
        INSERT INTO memory_records (
          id, user_id, record_type, title, value_json, occurred_at, local_date,
          timezone, schema_version, note, source, source_agent, source_run_id,
          dedupe_key, status, metadata_json
        )
        VALUES (
          ${sqlString(id)},
          ${sqlString(userId)},
          ${sqlString(recordType)},
          ${sqlString(title)},
          ${jsonSql(value)},
          ${sqlString(occurredAt)},
          ${sqlString(localDate)},
          ${sqlString(timezone)},
          ${schemaVersion},
          ${note === null ? "NULL" : sqlString(note)},
          ${sqlString(source)},
          ${sourceAgent === null ? "NULL" : sqlString(sourceAgent)},
          ${sourceRunId === null ? "NULL" : sqlString(sourceRunId)},
          ${dedupeKey === null ? "NULL" : sqlString(dedupeKey)},
          'active',
          ${jsonSql(input.metadata || {})}
        );
      `);
      return {
        ...(await this.getMemoryRecord(id)),
        writeStatus: "created"
      };
    },

    async getMemoryRecord(id) {
      const rows = await this.query(`
        SELECT id, user_id, record_type, title, value_json, occurred_at, local_date, timezone,
               schema_version, note, source, source_agent, source_run_id, dedupe_key,
               status, memory_id, created_at, updated_at, metadata_json
        FROM memory_records
        WHERE id = ${sqlString(id)}
        LIMIT 1;
      `);
      return rows.map((row) => mapMemoryRecordRow(row, parseJson))[0] || null;
    },

    async listMemoryRecords(input = {}) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(input.limit || 20), 10) || 20));
      const safeOffset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
      const userId = String(input.userId || input.user_id || "").trim();
      const recordType = String(input.recordType || input.type || "").trim().toLowerCase();
      const filters = ["status = 'active'"];
      if (userId) filters.push(`user_id = ${sqlString(userId)}`);
      if (recordType) filters.push(`record_type = ${sqlString(recordType)}`);
      if (input.localDate || input.local_date) filters.push(`local_date = ${sqlString(input.localDate || input.local_date)}`);
      if (input.start) filters.push(`occurred_at >= ${sqlString(parseAwareDate(input.start, "start").toISOString())}`);
      if (input.end) filters.push(`occurred_at < ${sqlString(parseAwareDate(input.end, "end").toISOString())}`);
      const rows = await this.query(`
        SELECT id, user_id, record_type, title, value_json, occurred_at, local_date, timezone,
               schema_version, note, source, source_agent, source_run_id, dedupe_key,
               status, memory_id, created_at, updated_at, metadata_json
        FROM memory_records
        WHERE ${filters.join(" AND ")}
        ORDER BY occurred_at DESC, created_at DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return rows.map((row) => mapMemoryRecordRow(row, parseJson));
    },

    async getMemoryRecordStats() {
      const rows = await this.query(`
        SELECT record_type, COUNT(*) AS count, MAX(occurred_at) AS latest_at
        FROM memory_records
        WHERE status = 'active'
        GROUP BY record_type
        ORDER BY count DESC, record_type ASC
        LIMIT 50;
      `);
      return {
        totalCount: rows.reduce((sum, row) => sum + (row.count || 0), 0),
        types: rows.map((row) => ({
          recordType: row.record_type,
          count: row.count || 0,
          latestAt: row.latest_at || null
        }))
      };
    },

    async summarizeMemoryRecords(input = {}) {
      const recordType = String(input.recordType || input.type || "fitness").trim().toLowerCase();
      if (recordType !== "fitness") throw new Error("Memory record summary currently supports fitness only.");
      const records = await this.listMemoryRecords({ ...input, recordType, limit: 100 });
      const totals = {
        steps: 0,
        duration_minutes: 0,
        distance_km: 0,
        repetitions: 0,
        sets: 0
      };
      for (const record of records) {
        for (const field of Object.keys(totals)) {
          totals[field] += record.value[field] || 0;
        }
      }
      return {
        userId: input.userId || input.user_id || "",
        recordType,
        start: input.start || null,
        end: input.end || null,
        localDate: input.localDate || input.local_date || null,
        recordCount: records.length,
        activeDays: new Set(records.map((record) => record.localDate).filter(Boolean)).size,
        totalSteps: totals.steps,
        totalDurationMinutes: totals.duration_minutes,
        totalDistanceKm: totals.distance_km,
        totalRepetitions: totals.repetitions,
        totalSets: totals.sets
      };
    }
  };
}

module.exports = {
  createMemoriaRecordRepository
};
