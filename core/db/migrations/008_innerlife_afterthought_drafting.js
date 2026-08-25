const AFTERTHOUGHT_DRAFTING_SQL = `
  -- Older Desktop builds exposed session afterthought placeholders as pending
  -- shares before their persisted generation jobs completed. Reclassify only
  -- shares that are still linked to unfinished afterthought jobs; ordinary
  -- pending shares and completed jobs remain untouched.
  UPDATE innerlife_shares
  SET status = 'drafting',
      updated_at = CURRENT_TIMESTAMP
  WHERE status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM innerlife_inbox
      WHERE source = 'session_end_afterthought'
        AND status IN ('pending', 'processing', 'failed')
        AND json_extract(metadata_json, '$.shareId') = innerlife_shares.id
    );
`;

module.exports = {
  id: "008_innerlife_afterthought_drafting",
  phase: "after-schema",
  async up(database) {
    await database.exec(AFTERTHOUGHT_DRAFTING_SQL);
  },
  schema: AFTERTHOUGHT_DRAFTING_SQL
};
