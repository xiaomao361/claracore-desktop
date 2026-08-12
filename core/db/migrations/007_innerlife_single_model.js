const SINGLE_MODEL_SQL = `
  -- The former light model handled most InnerLife work, so preserving it first
  -- keeps existing installations on their effective default. The deep model is
  -- only a fallback when no light model was configured.
  INSERT INTO app_settings (key, value_json, updated_at)
  SELECT
    'innerlife.model',
    COALESCE(
      NULLIF((SELECT value_json FROM app_settings WHERE key = 'innerlife.light_model'), '\"\"'),
      NULLIF((SELECT value_json FROM app_settings WHERE key = 'innerlife.deep_model'), '\"\"')
    ),
    CURRENT_TIMESTAMP
  WHERE NOT EXISTS (
    SELECT 1 FROM app_settings WHERE key = 'innerlife.model'
  )
    AND COALESCE(
      NULLIF((SELECT value_json FROM app_settings WHERE key = 'innerlife.light_model'), '\"\"'),
      NULLIF((SELECT value_json FROM app_settings WHERE key = 'innerlife.deep_model'), '\"\"')
    ) IS NOT NULL;
`;

module.exports = {
  id: "007_innerlife_single_model",
  phase: "after-schema",
  async up(database) {
    await database.exec(SINGLE_MODEL_SQL);
  },
  schema: SINGLE_MODEL_SQL
};
