const { spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

function runCli(dataRoot, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(__dirname, "..", "cli.js"), ...args], {
      cwd: path.resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: dataRoot
      }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`CLI failed (${code}): ${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`CLI returned non-JSON output: ${stdout}\n${error.message}`));
      }
    });
  });
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-memory-cli-"));

  const created = await runCli(dataRoot, [
    "store",
    "--title",
    "CLI Memory smoke",
    "--body",
    "Desktop Memory CLI should let agents use product memory without MCP.",
    "--labels",
    "cli,smoke"
  ]);
  const memoryId = created.memory?.id;
  if (!memoryId || !created.memory.labels.includes("cli")) {
    throw new Error(`CLI store failed: ${JSON.stringify(created)}`);
  }

  const recalled = await runCli(dataRoot, ["recall", "--query", "product memory", "--limit", "5"]);
  if (!recalled.results?.some((memory) => memory.id === memoryId)) {
    throw new Error(`CLI recall did not find created memory: ${JSON.stringify(recalled)}`);
  }

  const tagged = await runCli(dataRoot, ["tag", "--id", memoryId, "--labels", "cli,agent"]);
  if (!tagged.memory.labels.includes("agent") || tagged.memory.labels.includes("smoke")) {
    throw new Error(`CLI tag did not replace labels: ${JSON.stringify(tagged)}`);
  }

  const updated = await runCli(dataRoot, [
    "update",
    "--id",
    memoryId,
    "--title",
    "CLI Memory smoke updated",
    "--body",
    "Updated Memory CLI body.",
    "--labels",
    "cli,updated"
  ]);
  if (updated.memory.title !== "CLI Memory smoke updated" || !updated.memory.labels.includes("updated")) {
    throw new Error(`CLI update failed: ${JSON.stringify(updated)}`);
  }

  const fetched = await runCli(dataRoot, ["get", "--id", memoryId]);
  if (fetched.memory?.id !== memoryId || fetched.memory.body !== "Updated Memory CLI body.") {
    throw new Error(`CLI get failed: ${JSON.stringify(fetched)}`);
  }

  const firstRecord = await runCli(dataRoot, [
    "record",
    "add",
    "--type",
    "fitness",
    "--title",
    "CLI steps day one",
    "--occurred-at",
    "2026-06-20T20:00:00+08:00",
    "--data",
    "{\"activity\":\"步行\",\"steps\":10000,\"duration_minutes\":60}",
    "--user-id",
    "local-user",
    "--timezone",
    "Asia/Shanghai",
    "--dedupe-key",
    "fitness-2026-06-20",
    "--note",
    "evening walk"
  ]);
  if (firstRecord.record?.recordType !== "fitness" || firstRecord.record.value.steps !== 10000 || firstRecord.record.localDate !== "2026-06-20") {
    throw new Error(`CLI first record add failed: ${JSON.stringify(firstRecord)}`);
  }

  const secondRecord = await runCli(dataRoot, [
    "record",
    "add",
    "--type",
    "fitness",
    "--title",
    "CLI steps day two",
    "--occurred-at",
    "2026-06-21T20:00:00+08:00",
    "--data",
    "{\"activity\":\"步行\",\"steps\":16000,\"duration_minutes\":90}",
    "--user-id",
    "local-user",
    "--timezone",
    "Asia/Shanghai",
    "--dedupe-key",
    "fitness-2026-06-21"
  ]);
  if (secondRecord.record?.writeStatus !== "created" || secondRecord.record.value.steps !== 16000) {
    throw new Error(`CLI second record add failed: ${JSON.stringify(secondRecord)}`);
  }

  const duplicate = await runCli(dataRoot, [
    "record",
    "add",
    "--type",
    "fitness",
    "--occurred-at",
    "2026-06-21T20:00:00+08:00",
    "--data",
    "{\"activity\":\"步行\",\"steps\":16000,\"duration_minutes\":90}",
    "--user-id",
    "local-user",
    "--timezone",
    "Asia/Shanghai",
    "--dedupe-key",
    "fitness-2026-06-21"
  ]);
  if (duplicate.record?.writeStatus !== "exists" || duplicate.record.id !== secondRecord.record.id) {
    throw new Error(`CLI record dedupe failed: ${JSON.stringify(duplicate)}`);
  }

  const records = await runCli(dataRoot, ["record", "query", "--user-id", "local-user", "--type", "fitness"]);
  if (records.records?.length !== 2 || !records.records.some((item) => item.id === firstRecord.record.id)) {
    throw new Error(`CLI record query failed: ${JSON.stringify(records)}`);
  }

  const dayRecords = await runCli(dataRoot, ["record", "query", "--user-id", "local-user", "--type", "fitness", "--local-date", "2026-06-21"]);
  if (dayRecords.records?.length !== 1 || dayRecords.records[0].id !== secondRecord.record.id) {
    throw new Error(`CLI record local date query failed: ${JSON.stringify(dayRecords)}`);
  }

  const summary = await runCli(dataRoot, ["record", "summary", "--user-id", "local-user", "--type", "fitness"]);
  if (summary.summary?.recordCount !== 2 || summary.summary?.totalSteps !== 26000 || summary.summary?.totalDurationMinutes !== 150) {
    throw new Error(`CLI record summary failed: ${JSON.stringify(summary)}`);
  }

  const stats = await runCli(dataRoot, ["stats"]);
  if (stats.stats?.activeCount !== 1 || stats.stats?.structuredRecordCount !== 2) {
    throw new Error(`CLI stats failed: ${JSON.stringify(stats)}`);
  }

  const recordRecall = await runCli(dataRoot, ["recall", "--query", "16000", "--limit", "5"]);
  if (recordRecall.results?.some((item) => item.id === firstRecord.record.id || item.id === secondRecord.record.id)) {
    throw new Error(`CLI recall should not return structured records: ${JSON.stringify(recordRecall)}`);
  }

  await runCli(dataRoot, ["delete", "--id", memoryId]);
  const restored = await runCli(dataRoot, ["restore", "--id", memoryId]);
  if (restored.memory?.status !== "active") {
    throw new Error(`CLI restore failed: ${JSON.stringify(restored)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dataRoot,
        memoryId,
        recordIds: [firstRecord.record.id, secondRecord.record.id],
        totalSteps: summary.summary.totalSteps
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
