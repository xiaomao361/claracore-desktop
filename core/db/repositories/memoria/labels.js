function createMemoriaLabelRepository(helpers) {
  const {
    normalizeLabels,
    sqlString
  } = helpers;

  return {
    async canonicalizeMemoryLabels(labels) {
      const normalized = [...new Set(normalizeLabels(labels))];
      if (normalized.length === 0) return [];
      const rows = await this.query(`
        SELECT alias, canonical_label
        FROM memory_label_aliases
        WHERE alias IN (${normalized.map(sqlString).join(", ")});
      `);
      const aliases = new Map(rows.map((row) => [row.alias, row.canonical_label]));
      return [...new Set(normalized.map((label) => aliases.get(label) || label))];
    },

    async listMemoryLabelAliases() {
      const rows = await this.query(`
        SELECT alias, canonical_label, created_at
        FROM memory_label_aliases
        ORDER BY canonical_label ASC, alias ASC;
      `);
      return rows.map((row) => ({
        alias: row.alias,
        canonicalLabel: row.canonical_label,
        createdAt: row.created_at
      }));
    },

    async createMemoryLabelAlias(input = {}) {
      const alias = normalizeLabels(input.alias || "")[0] || "";
      const canonicalLabel = normalizeLabels(input.canonicalLabel || input.label || "")[0] || "";
      if (!alias || !canonicalLabel) throw new Error("Alias and canonical label are required.");
      if (alias === canonicalLabel) throw new Error("Alias must be different from canonical label.");
      await this.exec(`
        BEGIN;
        INSERT INTO memory_label_aliases (alias, canonical_label)
        VALUES (${sqlString(alias)}, ${sqlString(canonicalLabel)})
        ON CONFLICT(alias) DO UPDATE SET canonical_label = excluded.canonical_label;

        INSERT INTO memory_labels (memory_id, label)
        SELECT memory_id, ${sqlString(canonicalLabel)}
        FROM memory_labels
        WHERE label = ${sqlString(alias)}
        ON CONFLICT(memory_id, label) DO NOTHING;

        DELETE FROM memory_labels
        WHERE label = ${sqlString(alias)};
        COMMIT;
      `);
      return {
        alias,
        canonicalLabel,
        aliases: await this.listMemoryLabelAliases(),
        stats: await this.getMemoryStats()
      };
    },

    async deleteMemoryLabelAlias(aliasValue) {
      const alias = normalizeLabels(aliasValue || "")[0] || "";
      if (!alias) throw new Error("Alias is required.");
      await this.exec(`
        DELETE FROM memory_label_aliases
        WHERE alias = ${sqlString(alias)};
      `);
      return {
        alias,
        deleted: true,
        aliases: await this.listMemoryLabelAliases()
      };
    }
  };
}

module.exports = {
  createMemoriaLabelRepository
};
