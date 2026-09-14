const crypto = require("crypto");
const { sqlString, normalizeSearchRows } = require("./helpers");
const { SQLITE_VEC_VERSION } = require("../sqlite-vec-extension");

function validateQueryEmbedding(embedding) {
  const vector = embedding?.vector;
  if (!Array.isArray(vector) || !vector.length || vector.some((value) => typeof value !== "number" || !Number.isFinite(value) || !Number.isFinite(Math.fround(value)))) {
    throw new Error("VECTOR_QUERY_INVALID: expected nonempty finite float32-compatible numbers");
  }
  if (!vector.some((value) => value !== 0)) throw new Error("VECTOR_QUERY_ZERO_NORM: cosine requires a nonzero vector");
  if (typeof embedding.provider !== "string" || !embedding.provider || typeof embedding.model !== "string" || !embedding.model) {
    throw new Error("VECTOR_SPACE_INVALID: provider and model are required");
  }
}

async function searchVectorProjection(database, { embedding, agentClause, statusClause, limit, minimumScore, candidateLimit = 32, fullScan = false }) {
  validateQueryEmbedding(embedding);
  const dimension = embedding.vector.length;
  const table = `v_${crypto.createHash("sha256").update(JSON.stringify([embedding.provider, embedding.model, dimension])).digest("hex")}`;
  const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
  const spaceClause = `e.provider = ${sqlString(embedding.provider)} AND e.model = ${sqlString(embedding.model)} AND e.dimension = ${dimension}`;
  // Preserve the legacy JS localeCompare tie order, including imported IDs.
  // Only IDs cross to JS on revision changes; vector bytes stay in SQLite.
  const revision = (await database.query("SELECT revision FROM memory_vector_revision WHERE singleton=1;"))[0].revision;
  database.vectorIdOrders ||= new Map();
  let idOrder = database.vectorIdOrders.get(table);
  if (idOrder?.revision !== revision) {
    const snapshot = (await database.query(`SELECT
      (SELECT revision FROM memory_vector_revision WHERE singleton=1) AS revision,
      (SELECT json_group_array(memory_id) FROM memory_embeddings e WHERE ${spaceClause}) AS ids;`))[0];
    idOrder = { revision: snapshot.revision, ids: JSON.parse(snapshot.ids).sort((a, b) => a.localeCompare(b)) };
    database.vectorIdOrders.set(table, idOrder);
  }
  const sourceRevision = Number(idOrder.revision);
  const orderValues = database.vectorCacheRoot && idOrder.cacheRoot === database.vectorCacheRoot ? [] : idOrder.ids;
  const querySql = sqlString(JSON.stringify(embedding.vector));
  const queryNorm = Math.sqrt(embedding.vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(queryNorm) || queryNorm === 0) throw new Error("VECTOR_QUERY_UNUSABLE_NORM: cosine is undefined");
  // Conservative dimension-scaled float32 accumulation margin. Near the
  // threshold/cutoff, recompute against source JSON in double precision so a
  // value just below 0.55 is not promoted by float32 rounding.
  const scoreMargin = Math.min(2, dimension * 2 ** -20);
  const safeCandidateLimit = Math.max(32, Math.min(4096, Math.trunc(candidateLimit)));
  const eligibilityClause = `${statusClause} AND m.sensitivity != 'restricted' AND e.status = 'ready' AND ${spaceClause} ${agentClause}`;
  const changedClause = `(SELECT revision FROM main.memory_vector_revision WHERE singleton=1) = ${sourceRevision} AND
    (SELECT revision FROM main.memory_vector_revision WHERE singleton=1) !=
    (SELECT revision FROM vector_cache.spaces WHERE name=${sqlString(table)})`;
  let setupSql = "";
  if (!database.vectorCacheRoot || idOrder.cacheRoot !== database.vectorCacheRoot) setupSql = `
    CREATE TABLE IF NOT EXISTS vector_cache.spaces(name TEXT PRIMARY KEY, revision INTEGER NOT NULL, projected_count INTEGER NOT NULL);
    INSERT OR IGNORE INTO vector_cache.spaces VALUES(${sqlString(table)}, -1, 0);
    CREATE VIRTUAL TABLE IF NOT EXISTS vector_cache.${table} USING vec0(memory_id TEXT PRIMARY KEY, embedding FLOAT[${dimension}] distance_metric=cosine);
    CREATE TABLE IF NOT EXISTS vector_cache.issues(space TEXT, memory_id TEXT, reason TEXT, PRIMARY KEY(space,memory_id));
    CREATE TABLE IF NOT EXISTS vector_cache.id_order(space TEXT, memory_id TEXT, ordinal INTEGER, PRIMARY KEY(space,memory_id));
    DELETE FROM vector_cache.id_order WHERE space=${sqlString(table)} AND ${changedClause};
    INSERT INTO vector_cache.id_order SELECT ${sqlString(table)}, value, key FROM json_each(${sqlString(JSON.stringify(orderValues))}) WHERE ${changedClause};
    DROP TABLE IF EXISTS temp.vector_changed;
    CREATE TEMP TABLE vector_changed(memory_id TEXT PRIMARY KEY);
    INSERT INTO vector_changed
      SELECT memory_id FROM main.memory_vector_changes
      WHERE revision > (SELECT revision FROM vector_cache.spaces WHERE name=${sqlString(table)}) AND ${changedClause};
    INSERT OR IGNORE INTO vector_changed
      SELECT e.memory_id FROM main.memory_embeddings e WHERE ${spaceClause} AND ${changedClause}
        AND (SELECT revision FROM vector_cache.spaces WHERE name=${sqlString(table)}) = -1;
    DROP TABLE IF EXISTS temp.vector_input;
    CREATE TEMP TABLE vector_input AS
      SELECT e.memory_id,
        CASE
          WHEN e.status != 'ready' THEN 'not_ready'
          WHEN e.vector_json IS NULL THEN 'missing_vector'
          WHEN NOT json_valid(e.vector_json) THEN 'invalid_json'
          WHEN json_type(e.vector_json) != 'array' THEN 'not_array'
          WHEN json_array_length(e.vector_json) = 0 THEN 'empty_vector'
          WHEN json_array_length(e.vector_json) != e.dimension THEN 'dimension_mismatch'
          WHEN EXISTS(SELECT 1 FROM json_each(e.vector_json) WHERE type NOT IN ('integer','real')) THEN 'non_numeric'
          WHEN EXISTS(SELECT 1 FROM json_each(e.vector_json) WHERE abs(value) > 3.4028234663852886e38) THEN 'non_finite_float32'
          WHEN NOT EXISTS(SELECT 1 FROM json_each(e.vector_json) WHERE value != 0) THEN 'zero_norm'
          WHEN vec_distance_cosine(vec_f32(e.vector_json),vec_f32(e.vector_json)) IS NULL THEN 'unusable_norm'
          ELSE NULL
        END AS reason
      FROM temp.vector_changed c JOIN main.memory_embeddings e ON e.memory_id=c.memory_id WHERE ${spaceClause};
    DELETE FROM vector_cache.${table} WHERE memory_id IN (SELECT memory_id FROM vector_changed);
    DELETE FROM vector_cache.issues WHERE space=${sqlString(table)} AND memory_id IN (SELECT memory_id FROM vector_changed);
    INSERT INTO vector_cache.issues SELECT ${sqlString(table)}, memory_id, reason FROM vector_input WHERE reason IS NOT NULL;
    INSERT INTO vector_cache.${table}(memory_id,embedding)
      SELECT i.memory_id,vec_f32(e.vector_json) FROM vector_input i
      JOIN main.memory_embeddings e ON e.memory_id=i.memory_id WHERE i.reason IS NULL;
    UPDATE vector_cache.spaces SET revision=(SELECT revision FROM main.memory_vector_revision WHERE singleton=1),
      projected_count=(SELECT count(*) FROM vector_cache.${table}) WHERE name=${sqlString(table)} AND ${changedClause};
    DROP TABLE temp.vector_input;
    DROP TABLE temp.vector_changed;
  `;
  setupSql += `
    CREATE TEMP TABLE IF NOT EXISTS vector_query(key INTEGER PRIMARY KEY, value REAL);
    DELETE FROM vector_query;
    INSERT INTO vector_query SELECT key,value FROM json_each(${querySql});
  `;
  // Grow K when the candidate boundary could hide a tie or precision-sensitive
  // result. At vec0's K limit, a full native scan preserves complete coverage.
  // No fixed candidate limit becomes a retrieval horizon.
  const nativeSourceSql = fullScan
    ? `SELECT v.memory_id, vec_distance_cosine(v.embedding,${querySql}) AS distance
        FROM vector_cache.${table} v JOIN eligible ON eligible.id=v.memory_id`
    : `SELECT memory_id,distance FROM vector_cache.${table}
        WHERE embedding MATCH ${querySql} AND k=${safeCandidateLimit}
          AND memory_id IN (SELECT id FROM eligible) ORDER BY distance`;
  const selectSql = `
    WITH eligible AS MATERIALIZED (
      SELECT m.id
      FROM main.memories m JOIN main.memory_embeddings e ON e.memory_id=m.id
      WHERE ${eligibilityClause}
    ), nearest AS MATERIALIZED (${nativeSourceSql}), native_scores AS MATERIALIZED (
      SELECT v.memory_id AS id, o.ordinal, 1-v.distance AS native_score
      FROM nearest v
      JOIN vector_cache.id_order o ON o.space=${sqlString(table)} AND o.memory_id=v.memory_id
    ), cutoff AS (
      SELECT max(${Number(minimumScore)}, coalesce((SELECT native_score FROM native_scores
        ORDER BY native_score DESC LIMIT 1 OFFSET ${safeLimit - 1}), -1)) AS score
    ), scored AS (
      SELECT native_scores.*, (SELECT sum(x.value*q.value)/(sqrt(sum(x.value*x.value))*${queryNorm})
        FROM json_each(e.vector_json) x JOIN vector_query q ON q.key=x.key) AS search_score
      FROM native_scores JOIN main.memory_embeddings e ON e.memory_id=native_scores.id
      WHERE native_score >= (SELECT score FROM cutoff) - ${scoreMargin}
    ), top_results AS (
      SELECT * FROM scored WHERE search_score >= ${Number(minimumScore)}
      ORDER BY search_score DESC, ordinal ASC LIMIT ${safeLimit}
    ), ranked AS (
      SELECT m.*, t.search_score, e.status AS embedding_status, e.provider AS embedding_provider,
        e.model AS embedding_model, e.dimension AS embedding_dimension, e.error AS embedding_error,
        e.embedded_at, (SELECT group_concat(l.label,',') FROM main.memory_labels l WHERE l.memory_id=m.id) AS labels
      FROM top_results t JOIN main.memories m ON m.id=t.id JOIN main.memory_embeddings e ON e.memory_id=t.id
      ORDER BY t.search_score DESC, t.ordinal ASC
    )
    SELECT json_object(
      'version',vec_version(),
      'sourceRevision',(SELECT revision FROM main.memory_vector_revision WHERE singleton=1),
      'querySelfDistance',vec_distance_cosine(${querySql},${querySql}),
      'candidateCount',(SELECT count(*) FROM native_scores),
      'tailScore',(SELECT min(native_score) FROM native_scores),
      'cutoffScore',(SELECT score FROM cutoff),
      'revision',(SELECT revision FROM vector_cache.spaces WHERE name=${sqlString(table)}),
      'projectedCount',(SELECT projected_count FROM vector_cache.spaces WHERE name=${sqlString(table)}),
      'issues',json((SELECT json_group_array(json_object('reason',reason,'count',n)) FROM (
        SELECT i.reason,count(*) AS n FROM vector_cache.issues i JOIN eligible ON eligible.id=i.memory_id
        WHERE i.space=${sqlString(table)} GROUP BY i.reason ORDER BY i.reason
      ))),
      'results',json((SELECT json_group_array(json_object(
        'id',id,'title',title,'body',body,'status',status,'sensitivity',sensitivity,
        'created_at',created_at,'updated_at',updated_at,'labels',COALESCE(labels,''),
        'embedding_status',embedding_status,'embedding_provider',embedding_provider,
        'embedding_model',embedding_model,'embedding_dimension',embedding_dimension,
        'embedding_error',embedding_error,'embedded_at',embedded_at,
        'search_source','vector','search_score',search_score
      )) FROM ranked))
    ) AS payload;
  `;
  const rows = await database.queryVectorProjection(setupSql, selectSql);
  const payload = JSON.parse(rows[0].payload);
  if (payload.sourceRevision !== sourceRevision || payload.revision !== sourceRevision) {
    throw new Error("VECTOR_SOURCE_CHANGED: source changed during projection preparation; retry the search");
  }
  if (payload.version !== `v${SQLITE_VEC_VERSION}`) throw new Error(`VECTOR_EXTENSION_VERSION: ${payload.version}`);
  if (!Number.isFinite(payload.querySelfDistance)) throw new Error("VECTOR_QUERY_UNUSABLE_NORM: float32 cosine is undefined");
  if (payload.issues.length) {
    const error = new Error(`VECTOR_SOURCE_INVALID: ${payload.issues.map((issue) => `${issue.reason}=${issue.count}`).join(", ")}`);
    error.code = "VECTOR_SOURCE_INVALID";
    error.issues = payload.issues;
    throw error;
  }
  idOrder.cacheRoot = database.vectorCacheRoot;
  if (!fullScan && payload.candidateCount === safeCandidateLimit && payload.tailScore >= payload.cutoffScore - scoreMargin) {
    return searchVectorProjection(database, {
      embedding, agentClause, statusClause, limit, minimumScore,
      candidateLimit: safeCandidateLimit * 2,
      fullScan: safeCandidateLimit === 4096
    });
  }
  return {
    results: normalizeSearchRows(payload.results),
    status: { engine: "sqlite-vec", status: "ready", revision: payload.revision, projectedCount: payload.projectedCount, queryMode: fullScan ? "full-scan" : "knn", candidateLimit: safeCandidateLimit }
  };
}

module.exports = { searchVectorProjection };
