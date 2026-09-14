const { sqlString } = require('../db/helpers');

// Settings-only aggregate: no memory bodies, vectors, tokens or query text.
async function operationalStatus(database) {
  const settings = await database.getSettings();
  const provider = settings['memory.embedding.provider'];
  const model = settings['memory.embedding.model'];
  const dimension = Number(settings['memory.embedding.dimension']);
  const [coverage, events, successes] = await Promise.all([
    database.query(`SELECT count(*) AS total,
      coalesce(sum(CASE WHEN e.status = 'ready' AND e.vector_json IS NOT NULL AND e.provider = ${sqlString(provider)}
        AND e.model = ${sqlString(model)} AND e.dimension = ${Number.isInteger(dimension) ? dimension : 0}
        THEN 1 ELSE 0 END), 0) AS ready,
      coalesce(sum(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
      FROM memories m LEFT JOIN memory_embeddings e ON e.memory_id = m.id
      WHERE m.status = 'active' AND m.sensitivity != 'restricted';`),
    database.query(`SELECT level, created_at, metadata_json FROM runtime_events
      WHERE source = 'backup' AND message IN ('Automatic backup verified',
        'Automatic backup verified; expired backup cleanup is pending', 'Automatic backup did not complete')
      ORDER BY created_at DESC, id DESC LIMIT 1;`),
    database.query("SELECT created_at FROM backups WHERE status = 'verified' ORDER BY created_at DESC LIMIT 1;")
  ]);
  const event = events[0];
  if (event) event.metadata = JSON.parse(event.metadata_json);
  return {
    observedAt: new Date().toISOString(),
    backup: {
      lastVerifiedAt: successes[0]?.created_at || null,
      lastCompletedDay: settings['backup.last_run_date'] || null,
      event: event ? { at: event.created_at, level: event.level,
        stage: event.metadata?.stage || null, code: event.metadata?.code || null,
        mirrorPath: event.metadata?.mirrorPath || null,
        pending: event.metadata?.retention?.pending?.length || 0 } : null
    },
    vectors: { ...coverage[0], enabled: provider !== 'disabled', provider, model, dimension,
      lastSearch: database.lastVectorSearch ? { ...database.lastVectorSearch } : null }
  };
}
module.exports = { operationalStatus };
