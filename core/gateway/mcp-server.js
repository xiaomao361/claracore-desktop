#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { initializeProductDatabase } = require("../db/database");
const { defaultUserDataPath: defaultPlatformUserDataPath } = require("../platform-paths");
const { PRODUCT_VERSION } = require("../version");
const { createGatewayTools } = require("./tools");

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = {
  name: "claracore-desktop",
  version: PRODUCT_VERSION
};
const UNKNOWN_AGENT_ID = "unknown-agent";
let cachedDatabase = null;
let cachedDatabasePath = "";
let cachedDatabaseInit = null;

function applyCliEnvArgs(argv = process.argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--env") continue;
    const assignment = String(argv[index + 1] || "");
    const equalsIndex = assignment.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = assignment.slice(0, equalsIndex).trim();
    const value = assignment.slice(equalsIndex + 1);
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      process.env[key] = value;
    }
    index += 1;
  }
}

applyCliEnvArgs();

function closeCachedDatabase() {
  if (cachedDatabase && typeof cachedDatabase.close === "function") {
    cachedDatabase.close();
  }
  cachedDatabase = null;
  cachedDatabaseInit = null;
  cachedDatabasePath = "";
}

process.once("exit", closeCachedDatabase);
process.once("SIGINT", () => {
  closeCachedDatabase();
  process.exit(130);
});
process.once("SIGTERM", () => {
  closeCachedDatabase();
  process.exit(143);
});

let inFlightRequests = 0;
let transportClosed = false;

function maybeExitAfterDrain() {
  if (!transportClosed || inFlightRequests > 0) return;
  closeCachedDatabase();
  process.exit(0);
}

function exitWhenTransportCloses() {
  // Drain in-flight tools/call requests before exiting so one-shot piped
  // clients still receive their responses after stdin closes.
  transportClosed = true;
  maybeExitAfterDrain();
}

function isPackagedGatewayProcess() {
  // Legacy full-Electron mode uses --gateway; run-as-node mode is detected by
  // the script living inside the packaged app.asar archive.
  return process.argv.includes("--gateway") || __filename.includes(".asar");
}

const ORPHAN_CHECK_INTERVAL_MS = 60 * 1000;
function watchForOrphanedParent() {
  if (process.platform === "win32") return;
  const timer = setInterval(() => {
    // ppid 1 means the MCP client that spawned this Gateway died without
    // closing the stdio pipes (crash, sleep/wake edge cases). Exit so the
    // packaged app bundle is not held open by orphaned helpers.
    if (process.ppid === 1) exitWhenTransportCloses();
  }, ORPHAN_CHECK_INTERVAL_MS);
  timer.unref();
}

function defaultUserDataPath() {
  if (process.versions.electron) {
    try {
      return require("electron").app.getPath("userData");
    } catch (_error) {
      // Fall back to the development CLI path below when Electron is not ready.
    }
  }
  return defaultPlatformUserDataPath();
}

function configuredDataRoot(userDataPath) {
  try {
    const raw = fs.readFileSync(path.join(userDataPath, "desktop-settings.json"), "utf8");
    const settings = JSON.parse(raw);
    const dataRoot = String(settings?.dataRoot || "").trim();
    return dataRoot ? path.resolve(dataRoot) : "";
  } catch (_error) {
    return "";
  }
}

function productPaths() {
  const userDataPath = defaultUserDataPath();
  const dataRoot = process.env.CLARACORE_DESKTOP_DATA_DIR
    ? path.resolve(process.env.CLARACORE_DESKTOP_DATA_DIR)
    : configuredDataRoot(userDataPath) || path.join(userDataPath, "data");
  return {
    dataRoot,
    databasePath: path.join(dataRoot, "claracore.db"),
    exportsDir: path.join(dataRoot, "exports")
  };
}

function runtimeAppForGateway() {
  const paths = productPaths();
  process.env.CLARACORE_DESKTOP_DATA_DIR = paths.dataRoot;
  return {
    getPath(name) {
      return path.join(paths.dataRoot, name);
    },
    isPackaged: isPackagedGatewayProcess()
  };
}

function gatewayLaunchConfig(paths) {
  if (isPackagedGatewayProcess()) {
    return {
      command: process.execPath,
      args: [__filename],
      env: { ELECTRON_RUN_AS_NODE: "1" },
      displayCommand: `ELECTRON_RUN_AS_NODE=1 CLARACORE_DESKTOP_DATA_DIR=${paths.dataRoot} "${process.execPath}" "${__filename}"`,
      source: "packaged app"
    };
  }
  return {
    command: "node",
    args: [__filename],
    env: {},
    displayCommand: `CLARACORE_DESKTOP_DATA_DIR=${paths.dataRoot} node ${__filename}`,
    source: "development checkout"
  };
}

function textResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

function currentMcpAgentId(args = {}) {
  return String(process.env.CLARACORE_AGENT_ID || args.agentId || args.agent_id || "").trim() || UNKNOWN_AGENT_ID;
}
const { toolDefinitions, callToolBody } = createGatewayTools({
  serverInfo: SERVER_INFO,
  currentMcpAgentId,
  gatewayLaunchConfig,
  runtimeAppForGateway,
  textResult
});


async function openDatabase() {
  const paths = productPaths();
  if (cachedDatabase && cachedDatabasePath === paths.databasePath) {
    return { paths, database: cachedDatabase };
  }
  if (!cachedDatabaseInit || cachedDatabasePath !== paths.databasePath) {
    cachedDatabasePath = paths.databasePath;
    cachedDatabaseInit = initializeProductDatabase(paths.databasePath)
      .then((database) => {
        cachedDatabase = database;
        return database;
      })
      .catch((error) => {
        cachedDatabase = null;
        cachedDatabaseInit = null;
        cachedDatabasePath = "";
        throw error;
      });
  }
  const database = await cachedDatabaseInit;
  return { paths, database };
}

function summarizeToolResponse(result) {
  const text = result?.content?.[0]?.text || "";
  if (!text) return "";
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}


async function callTool(name, args = {}) {
  const startedAt = Date.now();
  const { paths, database } = await openDatabase();
  const agentId = currentMcpAgentId(args);
  const callArgs = { ...args, agentId };
  delete callArgs.agent_id;
  try {
    const result = await callToolBody(name, callArgs, paths, database);
    await database.recordGatewayTrace({
      agentId,
      toolName: name,
      status: "ok",
      durationMs: Date.now() - startedAt,
      request: callArgs,
      responseSummary: summarizeToolResponse(result)
    });
    return result;
  } catch (error) {
    await database.recordGatewayTrace({
      agentId,
      toolName: name,
      status: "error",
      durationMs: Date.now() - startedAt,
      request: callArgs,
      error: error.message || String(error)
    });
    throw error;
  }
}

async function handleRequest(message) {
  if (message.method === "initialize") {
    return {
      protocolVersion: message.params?.protocolVersion || PROTOCOL_VERSION,
      capabilities: {
        tools: {}
      },
      serverInfo: SERVER_INFO
    };
  }
  if (message.method === "tools/list") {
    return {
      tools: toolDefinitions()
    };
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    const args = message.params?.arguments || {};
    if (!name || typeof name !== "string") {
      throw new Error("Tool name is required.");
    }
    return callTool(name, args);
  }
  if (message.method === "ping") {
    return {};
  }
  throw new Error(`Unsupported method: ${message.method}`);
}

function writeResponse(response) {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

async function handleMessage(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") return;
  if (message.id === undefined || message.id === null) return;
  inFlightRequests += 1;
  try {
    const result = await handleRequest(message);
    writeResponse({
      jsonrpc: "2.0",
      id: message.id,
      result
    });
  } catch (error) {
    writeResponse({
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32603,
        message: error.message
      }
    });
  } finally {
    inFlightRequests -= 1;
    maybeExitAfterDrain();
  }
}

function start() {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        handleMessage(JSON.parse(trimmed));
      } catch (error) {
        process.stderr.write(`Invalid MCP message: ${error.message}\n`);
      }
    }
  });
  process.stdin.once("end", exitWhenTransportCloses);
  process.stdin.once("close", exitWhenTransportCloses);
  watchForOrphanedParent();
}

if (require.main === module) {
  start();
}

module.exports = {
  start
};
