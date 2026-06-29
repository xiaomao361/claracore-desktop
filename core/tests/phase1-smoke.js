const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase1-smoke-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  const paths = runtime.resolveProductPaths(app);
  if (paths.dataRoot !== dataRoot) {
    throw new Error(`Expected isolated data root ${dataRoot}, got ${paths.dataRoot}`);
  }
  if (paths.databasePath !== path.join(dataRoot, "claracore.db")) {
    throw new Error(`Unexpected database path: ${paths.databasePath}`);
  }
  if (paths.databasePath.includes(`${path.sep}.claracore${path.sep}`)) {
    throw new Error(`Phase 1 database points at old service data: ${paths.databasePath}`);
  }

  const { database } = await runtime.ensureProductCore(app);
  await fs.access(paths.databasePath);

  const tableRows = await database.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;");
  const tables = new Set(tableRows.map((row) => row.name));
  for (const table of [
    "schema_migrations",
    "app_settings",
    "secret_refs",
    "agents",
    "memories",
    "continuity_lines",
    "current_positions",
    "continuity_position_history",
    "innerlife_profiles",
    "innerlife_events",
    "gateway_sessions",
    "runtime_events",
    "backups"
  ]) {
    if (!tables.has(table)) throw new Error(`Missing table: ${table}`);
  }

  const settings = await database.getSettings();
  const expectedSettings = {
    "memory.embedding.provider": "ollama",
    "memory.embedding.base_url": "http://127.0.0.1:11434",
    "memory.embedding.model": "bge-m3",
    "memory.embedding.dimension": 1024,
    "memory.embedding.max_chars": 2000,
    "innerlife.enabled": false,
    "innerlife.provider": "disabled",
    "innerlife.base_url": "http://127.0.0.1:11434",
    "innerlife.loop_seconds": 900,
    "gateway.enabled": true,
    "gateway.transport": "stdio",
    "gateway.local_only": true,
    "backup.enabled": true,
    "backup.schedule": "manual"
  };
  for (const [key, value] of Object.entries(expectedSettings)) {
    if (settings[key] !== value) {
      throw new Error(`Default setting mismatch for ${key}: ${settings[key]} !== ${value}`);
    }
  }

  const secrets = await database.getSecretRefs();
  if (secrets["innerlife.llm.api_key"]?.status !== "not-configured") {
    throw new Error("InnerLife secret reference default is missing.");
  }
  if (secrets["innerlife.llm.api_key"]?.ref) {
    throw new Error("InnerLife secret reference should not store a visible secret value.");
  }

  await runtime.saveProductSettings(app, {
    "memory.embedding.base_url": "http://127.0.0.1:11436",
    "memory.embedding.model": "bge-m3-phase1-smoke",
    "memory.embedding.dimension": "768",
    "innerlife.provider": "openai-compatible",
    "innerlife.base_url": "http://127.0.0.1:11439",
    "innerlife.light_model": "phase1-light",
    "innerlife.deep_model": "phase1-deep",
    "innerlife.loop_seconds": "1980",
    "innerlife.llm.api_key_ref": "env:PHASE1_INNERLIFE_API_KEY"
  });

  const snapshot = await runtime.buildProductSnapshot(app);
  if (snapshot.data.databasePath !== paths.databasePath) {
    throw new Error("Snapshot does not point at the product database.");
  }
  if (snapshot.configuration.memoria.endpoint !== "http://127.0.0.1:11436") {
    throw new Error("Saved Memoria endpoint did not read back from SQLite.");
  }
  if (snapshot.configuration.memoria.model !== "bge-m3-phase1-smoke") {
    throw new Error("Saved Memoria model did not read back from SQLite.");
  }
  if (snapshot.configuration.memoria.dimension !== "768") {
    throw new Error("Saved Memoria dimension did not read back from SQLite.");
  }
  if (snapshot.configuration.innerlife.backend !== "openai-compatible") {
    throw new Error("Saved InnerLife provider did not read back from SQLite.");
  }
  if (snapshot.configuration.innerlife.baseUrl !== "http://127.0.0.1:11439") {
    throw new Error("Saved InnerLife endpoint did not read back from SQLite.");
  }
  if (snapshot.configuration.innerlife.lightModel !== "phase1-light") {
    throw new Error("Saved InnerLife light model did not read back from SQLite.");
  }
  if (snapshot.configuration.innerlife.deepModel !== "phase1-deep") {
    throw new Error("Saved InnerLife deep model did not read back from SQLite.");
  }
  if (snapshot.configuration.innerlife.pollSeconds !== "1980") {
    throw new Error("Saved InnerLife loop seconds did not read back from SQLite.");
  }
  if (
    snapshot.configuration.innerlife.apiKeyStatus !== "configured" ||
    snapshot.configuration.innerlife.apiKeyRef !== "env:PHASE1_INNERLIFE_API_KEY"
  ) {
    throw new Error("Saved InnerLife API key reference did not read back from SQLite.");
  }
  const oldServices = snapshot.health.checks.find((check) => check.id === "old-services");
  if (oldServices?.detail !== "not controlled by Desktop") {
    throw new Error("Old services are not explicitly isolated in the runtime health check.");
  }
  await database.recordRuntimeEvent({
    level: "info",
    source: "phase1-smoke",
    message: "Phase 1 log clear test"
  });
  await database.recordGatewayTrace({
    agentId: "codex",
    toolName: "phase1_log_clear",
    status: "ok",
    durationMs: 3,
    request: { smoke: true },
    responseSummary: "ok"
  });
  const clearResult = await runtime.clearProductLogs(app);
  if (clearResult.runtimeEventsDeleted < 1 || clearResult.gatewayTracesDeleted < 1) {
    throw new Error(`Log clear did not report deleted rows: ${JSON.stringify(clearResult)}`);
  }
  const clearedSnapshot = await runtime.buildProductSnapshot(app);
  if (clearedSnapshot.runtimeEvents.length !== 0 || clearedSnapshot.gatewayTraces.length !== 0) {
    throw new Error("Log clear did not remove runtime events and Gateway traces.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dataRoot,
        databasePath: paths.databasePath,
        settingsCount: snapshot.database.settings_count,
        oldServices: oldServices.detail
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
