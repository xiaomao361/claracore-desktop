#!/usr/bin/env node
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { performance } = require("perf_hooks");
const { promisify } = require("util");
const { initializeProductDatabase } = require("../core/db/database");
const { sqliteCommand } = require("../core/sqlite-binary");
const { createGatewayClient, parseTextResult } = require("../core/tests/gateway-client");

const DEFAULT_AGENT_COUNTS = [1, 4, 8];
const DEFAULT_OPERATIONS_PER_AGENT = 30;
const execFileAsync = promisify(execFile);

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function agentCounts() {
  const configured = String(process.env.CLARACORE_SQLITE_BASELINE_AGENTS || "")
    .split(",")
    .map((value) => positiveInteger(value, 0))
    .filter(Boolean);
  return configured.length ? [...new Set(configured)] : DEFAULT_AGENT_COUNTS;
}

function percentile(values, quantile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
}

function summarize(samples) {
  const durations = samples.map((sample) => sample.durationMs);
  return {
    calls: samples.length,
    p50Ms: Number(percentile(durations, 0.5).toFixed(1)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(1)),
    maxMs: Number(Math.max(0, ...durations).toFixed(1))
  };
}

function operationFor(index, agentIndex) {
  const slot = index % 10;
  if (slot <= 6) {
    return { name: "memoria_list", args: { limit: 10 }, kind: "read" };
  }
  if (slot === 7) {
    return { name: "innerlife_status", args: {}, kind: "read" };
  }
  if (slot === 8) {
    return {
      name: "innerlife_submit_inbox",
      args: { source: "sqlite-baseline", body: `Concurrent inbox sample ${agentIndex}-${index}` },
      kind: "write"
    };
  }
  return {
    name: "shared_line_create",
    args: { title: `Concurrent line ${agentIndex}-${index}`, makeActive: false },
    kind: "write"
  };
}

async function closeGatewayClient(client) {
  if (client.child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      client.child.kill();
      resolve();
    }, 2000);
    timeout.unref();
    client.child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    client.child.stdin.end();
  });
}

async function runAgent(client, agentIndex, operationCount) {
  const samples = [];
  for (let index = 0; index < operationCount; index += 1) {
    const operation = operationFor(index, agentIndex);
    const startedAt = performance.now();
    try {
      parseTextResult(await client.callTool(operation.name, operation.args));
      samples.push({ ...operation, durationMs: performance.now() - startedAt, ok: true });
    } catch (error) {
      samples.push({
        ...operation,
        durationMs: performance.now() - startedAt,
        ok: false,
        error: error.message || String(error)
      });
    }
  }
  return samples;
}

async function consistentDatabaseCopy(source, destination) {
  const escapedDestination = destination.replaceAll("'", "''");
  await execFileAsync(sqliteCommand(), [source, `.backup '${escapedDestination}'`]);
}

async function runScenario(root, count, operationCount, sourceDatabase) {
  const dataRoot = path.join(root, `agents-${count}`);
  const dbPath = path.join(dataRoot, "claracore.db");
  await fs.mkdir(dataRoot, { recursive: true });
  if (sourceDatabase) await consistentDatabaseCopy(sourceDatabase, dbPath);
  const setupDatabase = await initializeProductDatabase(dbPath);
  setupDatabase.close();

  const clients = Array.from({ length: count }, (_, index) => createGatewayClient(dataRoot, {
    env: {
      CLARACORE_AGENT_ID: `sqlite-baseline:agent-${index + 1}`,
      CLARACORE_CLIENT_ID: `sqlite-baseline-client-${index + 1}`,
      CLARACORE_CONVERSATION_ID: `sqlite-baseline-${count}-${index + 1}`
    }
  }));

  try {
    await Promise.all(clients.map((client) => client.callTool("claracore_status")));
    const startedAt = performance.now();
    const samples = (await Promise.all(
      clients.map((client, index) => runAgent(client, index + 1, operationCount))
    )).flat();
    const elapsedMs = performance.now() - startedAt;
    const failures = samples.filter((sample) => !sample.ok);
    const lockFailures = failures.filter((sample) => /locked|busy/i.test(sample.error || ""));
    const byTool = Object.fromEntries(
      [...new Set(samples.map((sample) => sample.name))].map((name) => [
        name,
        summarize(samples.filter((sample) => sample.name === name && sample.ok))
      ])
    );

    await Promise.all(clients.map(closeGatewayClient));
    const database = await initializeProductDatabase(dbPath);
    const integrityRows = await database.query("PRAGMA quick_check;");
    const countRows = await database.query(`
      SELECT
        (SELECT COUNT(*) FROM gateway_traces) AS gateway_traces,
        (SELECT COUNT(*) FROM innerlife_inbox) AS innerlife_inbox,
        (SELECT COUNT(*) FROM continuity_lines) AS continuity_lines;
    `);
    database.close();
    const file = await fs.stat(dbPath);

    return {
      agents: count,
      operationsPerAgent: operationCount,
      totalCalls: samples.length,
      elapsedMs: Number(elapsedMs.toFixed(1)),
      throughputCallsPerSecond: Number((samples.length / (elapsedMs / 1000)).toFixed(1)),
      latency: summarize(samples.filter((sample) => sample.ok)),
      byKind: {
        read: summarize(samples.filter((sample) => sample.ok && sample.kind === "read")),
        write: summarize(samples.filter((sample) => sample.ok && sample.kind === "write"))
      },
      byTool,
      failures: failures.length,
      lockFailures: lockFailures.length,
      failureMessages: [...new Set(failures.map((sample) => sample.error))].slice(0, 5),
      integrity: Object.values(integrityRows[0] || {})[0] || "unknown",
      rows: countRows[0] || {},
      databaseBytes: file.size
    };
  } finally {
    await Promise.all(clients.map(closeGatewayClient));
  }
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-sqlite-baseline-"));
  const operationCount = positiveInteger(
    process.env.CLARACORE_SQLITE_BASELINE_OPERATIONS_PER_AGENT,
    DEFAULT_OPERATIONS_PER_AGENT
  );
  const configuredSource = String(process.env.CLARACORE_PERFORMANCE_DB || "").trim();
  const sourceDatabase = configuredSource ? path.resolve(configuredSource) : "";
  try {
    const scenarios = [];
    for (const count of agentCounts()) {
      scenarios.push(await runScenario(root, count, operationCount, sourceDatabase));
    }
    const result = {
      ok: scenarios.every((scenario) => scenario.failures === 0 && scenario.integrity === "ok"),
      source: sourceDatabase ? "consistent temporary copy" : "empty temporary database",
      sourceDatabaseBytes: sourceDatabase ? (await fs.stat(sourceDatabase)).size : 0,
      workload: {
        readPercent: 80,
        writePercent: 20,
        note: "Every Gateway tool call also writes one gateway_traces row."
      },
      scenarios
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
