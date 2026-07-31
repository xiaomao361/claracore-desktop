const {
  fetchCandidates,
  hash,
  normalizeSources
} = require("../../../innerlife/source-ingest");

function createInnerLifeSourceInboxRepository(helpers) {
  const {
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  return {
    async ingestInnerLifeSources(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const sources = normalizeSources(profile.profile);
      const limitPerSource = Math.max(1, Math.min(Number.parseInt(String(input.limitPerSource || 10), 10) || 10, 20));
      const maxItems = Math.max(1, Math.min(Number.parseInt(String(input.maxItems || 10), 10) || 10, 50));
      const errors = [];
      const candidates = [];
      for (const source of sources) {
        try {
          candidates.push(...await fetchCandidates(source, { limit: limitPerSource }));
        } catch (error) {
          errors.push({ source: source.name, url: source.url, error: error.message || String(error) });
        }
      }
      const existingRows = await this.query(`
        SELECT metadata_json
        FROM innerlife_inbox
        WHERE agent_id = ${sqlString(profile.agent_id)}
        ORDER BY created_at DESC
        LIMIT 500;
      `);
      const known = new Set(
        existingRows
          .map((row) => parseJson(row.metadata_json, {}))
          .map((metadata) => metadata.contentFingerprint || metadata.candidateFingerprint || "")
          .filter(Boolean)
      );
      const seen = new Set();
      const selected = [];
      for (const candidate of candidates) {
        const body = [
          candidate.title,
          candidate.publishedAt ? `Published: ${candidate.publishedAt}` : "",
          candidate.url,
          "",
          candidate.summary
        ].filter(Boolean).join("\n");
        const contentFingerprint = hash(`${candidate.url}\n${candidate.title}\n${candidate.summary}`).slice(0, 32);
        if (known.has(contentFingerprint) || known.has(candidate.candidateFingerprint) || seen.has(contentFingerprint)) continue;
        seen.add(contentFingerprint);
        selected.push({ ...candidate, body, contentFingerprint });
        if (selected.length >= maxItems) break;
      }
      const inserted = [];
      for (const candidate of selected) {
        inserted.push(await this.submitInnerLifeInbox({
          agentId: profile.agent_id,
          source: `source:${candidate.sourceName}`,
          body: candidate.body,
          metadata: {
            sourceType: candidate.sourceType,
            sourceName: candidate.sourceName,
            url: candidate.url,
            title: candidate.title,
            publishedAt: candidate.publishedAt || "",
            candidateFingerprint: candidate.candidateFingerprint,
            contentFingerprint: candidate.contentFingerprint,
            ingestedBy: "innerlife_sources"
          }
        }));
      }
      return {
        agentId: profile.agent_id,
        sourceCount: sources.length,
        candidateCount: candidates.length,
        insertedCount: inserted.length,
        inserted,
        errors
      };
    },

  };
}

module.exports = {
  createInnerLifeSourceInboxRepository
};
