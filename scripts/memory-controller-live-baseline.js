const path = require("path");
const { DatabaseSync } = require("node:sqlite");

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

const databaseArgument = argument("--db", process.env.CLARACORE_DESKTOP_LIVE_DB || "");
const days = Math.max(1, Math.min(90, Number.parseInt(argument("--days", "7"), 10) || 7));
if (!databaseArgument) {
  throw new Error("Pass the live Desktop database with --db or CLARACORE_DESKTOP_LIVE_DB.");
}

const databasePath = path.resolve(databaseArgument);
const database = new DatabaseSync(databasePath, { readOnly: true });
try {
  const rows = database.prepare(`
    SELECT duration_ms, status, created_at
    FROM gateway_traces
    WHERE tool_name = 'memoria_search'
      AND created_at >= datetime('now', ?)
    ORDER BY created_at ASC
  `).all(`-${days} days`);
  const durations = rows.map((row) => Number(row.duration_ms) || 0);
  const statusCounts = {};
  for (const row of rows) statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
  console.log(JSON.stringify({
    suite: "memory-controller-live-baseline",
    source: "read-only gateway_traces",
    databasePath,
    windowDays: days,
    count: rows.length,
    firstAt: rows[0]?.created_at || null,
    lastAt: rows.at(-1)?.created_at || null,
    statusCounts,
    latencyMs: {
      average: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0,
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      max: durations.length ? Math.max(...durations) : 0
    },
    privacy: "request_json and response_summary were not read"
  }, null, 2));
} finally {
  database.close();
}
