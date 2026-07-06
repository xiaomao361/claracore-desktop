const LINK_KINDS = ["related", "causes", "evolved-from", "contradicts", "part-of"];
const LINK_SOURCES = ["manual", "innerlife", "co-recall"];

function createMemoriaLinkRepository(helpers) {
  const { newId, sqlString } = helpers;

  function normalizeKind(value) {
    const kind = String(value || "related").trim().toLowerCase();
    if (!LINK_KINDS.includes(kind)) {
      throw new Error(`Link kind must be one of: ${LINK_KINDS.join(", ")}.`);
    }
    return kind;
  }

  function normalizeSource(value) {
    const source = String(value || "manual").trim().toLowerCase();
    if (!LINK_SOURCES.includes(source)) {
      throw new Error(`Link source must be one of: ${LINK_SOURCES.join(", ")}.`);
    }
    return source;
  }

  function normalizeStrength(value, fallback = 0.5) {
    if (value === undefined || value === null || value === "") return fallback;
    const strength = Number.parseFloat(String(value));
    if (!Number.isFinite(strength)) return fallback;
    return Math.min(1, Math.max(0, strength));
  }

  function normalizeLinkRow(row) {
    return {
      id: row.id,
      fromMemoryId: row.from_memory_id,
      toMemoryId: row.to_memory_id,
      fromTitle: row.from_title || "",
      toTitle: row.to_title || "",
      kind: row.kind,
      strength: row.strength,
      source: row.source,
      note: row.note || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  return {
    async createMemoryLink(input = {}) {
      const fromId = String(input.fromMemoryId || input.from_memory_id || input.fromId || "").trim();
      const toId = String(input.toMemoryId || input.to_memory_id || input.toId || "").trim();
      if (!fromId || !toId) throw new Error("Both fromMemoryId and toMemoryId are required.");
      if (fromId === toId) throw new Error("A memory cannot link to itself.");
      const kind = normalizeKind(input.kind);
      const source = normalizeSource(input.source);
      const strength = normalizeStrength(input.strength);
      const note = String(input.note || "").trim();

      const endpoints = await this.query(`
        SELECT id FROM memories
        WHERE id IN (${sqlString(fromId)}, ${sqlString(toId)})
          AND status = 'active';
      `);
      const foundIds = new Set(endpoints.map((row) => row.id));
      for (const memoryId of [fromId, toId]) {
        if (!foundIds.has(memoryId)) {
          throw new Error(`Memory '${memoryId}' not found or not active.`);
        }
      }

      const id = newId("memlink");
      const updatedAt = new Date().toISOString();
      await this.exec(`
        INSERT INTO memory_links (id, from_memory_id, to_memory_id, kind, strength, source, note)
        VALUES (
          ${sqlString(id)},
          ${sqlString(fromId)},
          ${sqlString(toId)},
          ${sqlString(kind)},
          ${strength},
          ${sqlString(source)},
          ${note ? sqlString(note) : "NULL"}
        )
        ON CONFLICT(from_memory_id, to_memory_id, kind) DO UPDATE SET
          strength = excluded.strength,
          source = excluded.source,
          note = COALESCE(excluded.note, memory_links.note),
          updated_at = ${sqlString(updatedAt)};
      `);
      const rows = await this.query(`
        SELECT
          k.*,
          f.title AS from_title,
          t.title AS to_title
        FROM memory_links k
        JOIN memories f ON f.id = k.from_memory_id
        JOIN memories t ON t.id = k.to_memory_id
        WHERE k.from_memory_id = ${sqlString(fromId)}
          AND k.to_memory_id = ${sqlString(toId)}
          AND k.kind = ${sqlString(kind)};
      `);
      if (rows.length === 0) throw new Error("Memory link was not persisted.");
      return normalizeLinkRow(rows[0]);
    },

    async listMemoryLinks(input = {}) {
      const memoryId = String(input.memoryId || input.memory_id || input.id || "").trim();
      const kind = String(input.kind || "").trim().toLowerCase();
      const safeLimit = Math.max(1, Math.min(200, Number.parseInt(String(input.limit || 50), 10) || 50));
      const clauses = [];
      if (memoryId) {
        clauses.push(`(k.from_memory_id = ${sqlString(memoryId)} OR k.to_memory_id = ${sqlString(memoryId)})`);
      }
      if (kind) {
        clauses.push(`k.kind = ${sqlString(kind)}`);
      }
      const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = await this.query(`
        SELECT
          k.*,
          f.title AS from_title,
          t.title AS to_title
        FROM memory_links k
        JOIN memories f ON f.id = k.from_memory_id
        JOIN memories t ON t.id = k.to_memory_id
        ${whereClause}
        ORDER BY k.strength DESC, k.updated_at DESC
        LIMIT ${safeLimit};
      `);
      return rows.map(normalizeLinkRow);
    },

    async deleteMemoryLink(id) {
      const linkId = String(id || "").trim();
      if (!linkId) throw new Error("Link id is required.");
      const rows = await this.query(`
        SELECT id FROM memory_links WHERE id = ${sqlString(linkId)};
      `);
      if (rows.length === 0) throw new Error("Memory link not found.");
      await this.exec(`
        DELETE FROM memory_links WHERE id = ${sqlString(linkId)};
      `);
      return { deleted: true, id: linkId };
    },

    async getMemoryNeighbors(memoryIds = [], input = {}) {
      const ids = [...new Set(memoryIds.map((value) => String(value || "").trim()).filter(Boolean))];
      if (ids.length === 0) return [];
      const safeLimit = Math.max(1, Math.min(50, Number.parseInt(String(input.limit || 10), 10) || 10));
      const idList = ids.map(sqlString).join(", ");
      const rows = await this.query(`
        SELECT
          k.id AS link_id,
          k.kind,
          k.strength,
          k.note,
          k.from_memory_id,
          k.to_memory_id,
          n.id AS neighbor_id,
          n.title AS neighbor_title,
          n.body AS neighbor_body,
          COALESCE(group_concat(l.label, ','), '') AS neighbor_labels
        FROM memory_links k
        JOIN memories n
          ON n.id = CASE
            WHEN k.from_memory_id IN (${idList}) THEN k.to_memory_id
            ELSE k.from_memory_id
          END
        LEFT JOIN memory_labels l ON l.memory_id = n.id
        WHERE (k.from_memory_id IN (${idList}) OR k.to_memory_id IN (${idList}))
          AND n.id NOT IN (${idList})
          AND n.status = 'active'
          AND n.sensitivity != 'restricted'
        GROUP BY k.id
        ORDER BY k.strength DESC, k.updated_at DESC
        LIMIT ${safeLimit};
      `);
      const idSet = new Set(ids);
      const seenNeighbors = new Set();
      const neighbors = [];
      for (const row of rows) {
        if (seenNeighbors.has(row.neighbor_id)) continue;
        seenNeighbors.add(row.neighbor_id);
        neighbors.push({
          memory: {
            id: row.neighbor_id,
            title: row.neighbor_title || "",
            bodyPreview: String(row.neighbor_body || "").slice(0, 200),
            labels: row.neighbor_labels ? row.neighbor_labels.split(",").filter(Boolean) : []
          },
          via: {
            linkId: row.link_id,
            kind: row.kind,
            strength: row.strength,
            note: row.note || "",
            linkedMemoryId: idSet.has(row.from_memory_id) ? row.from_memory_id : row.to_memory_id
          }
        });
      }
      return neighbors;
    },

    async listMemoryLinkEdges(memoryIds = []) {
      const ids = [...new Set(memoryIds.map((value) => String(value || "").trim()).filter(Boolean))];
      if (ids.length === 0) return [];
      const idList = ids.map(sqlString).join(", ");
      const rows = await this.query(`
        SELECT k.*, f.title AS from_title, t.title AS to_title
        FROM memory_links k
        JOIN memories f ON f.id = k.from_memory_id
        JOIN memories t ON t.id = k.to_memory_id
        WHERE k.from_memory_id IN (${idList})
           OR k.to_memory_id IN (${idList});
      `);
      return rows.map(normalizeLinkRow);
    }
  };
}

module.exports = {
  createMemoriaLinkRepository,
  LINK_KINDS,
  LINK_SOURCES
};
