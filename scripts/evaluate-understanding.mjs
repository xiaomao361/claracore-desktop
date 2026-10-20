import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const require = createRequire(import.meta.url);
const { evaluateCases } = require("../core/gateway/understanding/evaluation");
const { ProductDatabase } = require("../core/db/database");
const { sqliteCommand } = require("../core/sqlite-binary");
const cases = require("../core/tests/fixtures/understanding-semantics.json");
const execute = promisify(execFile);
const errorFor = code => Object.assign(new Error(code), { code });

export async function runExistingModelEvaluation(dataRoot, selectedCases = cases) {
  if (!path.isAbsolute(dataRoot || "") || selectedCases.length > 8) throw errorFor("explicit_existing_data_root_required");
  const databaseFile = path.join(dataRoot, "claracore.db");
  const expectedFile = await fs.realpath(databaseFile);
  let rows;
  try {
    // Prove the selected database in the same read-only execution that reads
    // only the exact provider settings and its authentication reference.
    const sql = `SELECT 'setting' AS kind, key, value_json AS value,
      (SELECT file FROM pragma_database_list WHERE name = 'main') AS database_file
      FROM app_settings WHERE key IN ('innerlife.provider','innerlife.base_url','innerlife.model','innerlife.light_model','innerlife.deep_model')
      UNION ALL SELECT 'secret', key, ref,
      (SELECT file FROM pragma_database_list WHERE name = 'main') FROM secret_refs WHERE key = 'innerlife.llm.api_key';`;
    const { stdout } = await execute(sqliteCommand(), ["-readonly", "-json", databaseFile, sql], { encoding: "utf8", timeout: 5000, maxBuffer: 64 * 1024 });
    rows = JSON.parse(stdout);
  } catch { throw errorFor("existing_model_configuration_unavailable"); }
  if (!Array.isArray(rows) || !rows.length) throw errorFor("existing_model_configuration_unavailable");
  for (const row of rows) if (await fs.realpath(row.database_file) !== expectedFile) throw errorFor("evaluation_database_target_mismatch");
  const settings = Object.fromEntries(rows.filter(row => row.kind === "setting").map(row => [row.key, JSON.parse(row.value)]));
  const provider = settings["innerlife.provider"], model = settings["innerlife.model"] || settings["innerlife.light_model"] || settings["innerlife.deep_model"];
  if (!["ollama", "openai-compatible"].includes(provider) || !model) throw errorFor("existing_model_unavailable");
  const reference = rows.find(row => row.kind === "secret")?.value || "";
  const apiKey = reference.startsWith("env:") ? process.env[reference.slice(4)] || "" : reference;
  if (reference && !apiKey) throw errorFor("existing_model_key_environment_missing");
  const report = await evaluateCases(selectedCases, input => ProductDatabase.prototype.chatCompletion.call({}, {
    ...input, provider, model, baseUrl: settings["innerlife.base_url"] || "http://127.0.0.1:11434", apiKey
  }));
  return { ...report, model: { provider, model }, requests: selectedCases.length,
    configurationDatabaseAccess: "sqlite_readonly_exact_model_settings_and_auth", businessDataRead: false };
}

export async function runEvaluation(config, selectedCases = cases) {
  if (!["ollama", "openai-compatible"].includes(config.provider) || !config.model || !config.baseUrl || config.apiKey) throw new Error("explicit_existing_model_configuration_required");
  if (selectedCases.length > 8) throw new Error("evaluation_request_budget_exceeded");
  if (config.apiKeyEnv && (!/^[A-Z_][A-Z0-9_]*$/u.test(config.apiKeyEnv) || !process.env[config.apiKeyEnv])) throw new Error("evaluation_model_key_environment_missing");
  // Reuse the existing provider implementation without initializing or opening
  // any product database. Only synthetic fixture evidence is sent.
  const generate = input => ProductDatabase.prototype.chatCompletion.call({}, { ...input, provider: config.provider,
    baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKeyEnv ? process.env[config.apiKeyEnv] : "" });
  const report = await evaluateCases(selectedCases, generate);
  return { ...report, model: { provider: config.provider, model: config.model }, userDatabaseOpened: false, requests: selectedCases.length };
}
async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    process.stdout.write(JSON.stringify({ status: "ready", cases: cases.length, modelCalls: 0, installed: false,
      usage: "--model-config explicit-existing-model.json OR --existing-data-root explicit/data/root; then --allow-model-calls --output report.json" }) + "\n");
    return;
  }
  if (args.length !== 5 || !["--model-config", "--existing-data-root"].includes(args[0]) || args[2] !== "--allow-model-calls" || args[3] !== "--output") throw errorFor("explicit_model_call_authorization_required");
  let report;
  if (args[0] === "--existing-data-root") report = await runExistingModelEvaluation(path.resolve(args[1]));
  else {
    const text = await fs.readFile(path.resolve(args[1]), "utf8");
    if (Buffer.byteLength(text) > 16 * 1024) throw errorFor("evaluation_configuration_too_large");
    report = await runEvaluation(JSON.parse(text));
  }
  await fs.writeFile(path.resolve(args[4]), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify({ total: report.total, passed: report.passed, requests: report.requests,
    configurationDatabaseAccess: report.configurationDatabaseAccess || "none", businessDataRead: false, output: path.resolve(args[4]) }) + "\n");
  if (report.passed !== report.total) process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { process.stderr.write((error.code || "evaluation_failed") + "\n"); process.exitCode = 1; });
}
