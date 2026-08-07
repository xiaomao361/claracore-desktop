const HOURLY_DEFAULT_SQL = `
  UPDATE app_settings
  SET value_json = '3600',
      updated_at = CURRENT_TIMESTAMP
  WHERE key = 'innerlife.loop_seconds'
    AND value_json = '900';
`;

module.exports = {
  id: "006_innerlife_hourly_default",
  phase: "after-schema",
  async up(database) {
    await database.exec(HOURLY_DEFAULT_SQL);
  },
  schema: HOURLY_DEFAULT_SQL
};
