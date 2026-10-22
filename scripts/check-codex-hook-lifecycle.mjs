import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Operator check for a personal host hook. All calls and state stay isolated;
// this never runs a hook against the user's Gateway or changes its configuration.
const args = process.argv.slice(2);
assert(args.length === 2 && args[0] === "--hook", "Usage: --hook path/to/hook.mjs");
const hookPath = resolve(args[1]);
const root = await mkdtemp(join(tmpdir(), "claracore-hook-lifecycle-"));
const calls = [];
let endMode = "success";
const server = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  const rpc = JSON.parse(body);
  const { name, arguments: input } = rpc.params;
  calls.push({ name, input });
  let result;
  if (name === "innerlife_session_start") result = { session: { id: `inner-${input.externalSessionId}`, status: "active" } };
  else if (name === "innerlife_pending_shares") result = { totalPending: 0, shares: [] };
  else if (name === "innerlife_session_end") result = endMode === "missing"
    ? { session: null, missing: true }
    : { session: { id: input.sessionId, status: "ended" } };
  else throw new Error(`Unexpected tool: ${name}`);
  const failed = name === "innerlife_session_end" && endMode === "error";
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: {
    ...(failed ? { isError: true } : {}),
    content: [{ type: "text", text: JSON.stringify(failed ? { error: "fixture end failure" } : result) }]
  } }));
});

try {
  await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
  const home = join(root, "codex");
  await mkdir(join(home, "memories"), { recursive: true });
  await mkdir(join(home, "memories_v2"));
  const configPath = join(home, "config.toml");
  await writeFile(configPath, "[mcp_servers.claracore-desktop]\n");
  const gatewayConfig = join(root, "gateway.json");
  await writeFile(gatewayConfig, JSON.stringify({
    endpoint: `http://127.0.0.1:${server.address().port}/mcp`, token: "isolated-fixture"
  }));
  let source = await readFile(hookPath, "utf8");
  const configAnchor = /^const CODEX_CONFIG_PATH = [^\n]+;$/m;
  assert(configAnchor.test(source), "Unknown config layout; refusing to run hook.");
  source = source.replace(configAnchor, `const CODEX_CONFIG_PATH = ${JSON.stringify(configPath)};`);
  await writeFile(join(root, "hook.mjs"), source);
  if (source.includes('"./session-policy.mjs"')) {
    await copyFile(join(dirname(hookPath), "session-policy.mjs"), join(root, "session-policy.mjs"));
  }
  const run = async (event, payload, stateName, options = {}) => {
    const child = execFile(process.execPath, [join(root, "hook.mjs"), event], {
      cwd: options.cwd || root,
      env: { ...process.env, CODEX_THREAD_ID: options.thread || "fixture-thread",
        CLARACORE_GATEWAY_CONFIG: gatewayConfig,
        CLARACORE_HOOK_STATE_DIR: join(root, stateName) },
      timeout: 12000
    });
    child.stdin.end(JSON.stringify(payload));
    await new Promise((resolveRun, reject) => {
      child.on("error", reject);
      child.on("exit", code => code === 0 ? resolveRun() : reject(new Error(`Hook exited ${code}`)));
    });
  };
  const state = async name => JSON.parse(await readFile(join(root, name, "state.json"), "utf8"));
  for (const directory of ["memories", "memories_v2"]) {
    const before = calls.length;
    await run("SessionStart", { session_id: "background" }, directory, { cwd: join(home, directory) });
    await run("Stop", { session_id: "background" }, directory, { cwd: join(home, directory) });
    assert.equal(calls.length, before, "Background memory jobs must not call the Gateway.");
    const legacy = JSON.parse(await readFile(join(root, directory, "state.json"), "utf8"));
    legacy.sessions = { background: { innerLifeSessionId: "legacy-background" } };
    await writeFile(join(root, directory, "state.json"), JSON.stringify(legacy));
    await run("Stop", { session_id: "background" }, directory, { cwd: join(home, directory) });
    assert.equal(calls.at(-1).input.sessionId, "legacy-background");
    assert(!(await state(directory)).sessions.background, "A real Stop must still close a previously registered background session.");
  }
  await run("SessionStart", { session_id: "normal" }, "normal");
  await run("Stop", { session_id: "normal", last_assistant_message: "Fixture completed." }, "normal");
  assert(!(await state("normal")).sessions.normal);
  assert.equal(calls.find(c => c.name === "innerlife_session_end" && c.input.sessionId === "inner-normal").input.summary, "Fixture completed.");

  await run("SessionStart", {}, "env-identity", { thread: "env-thread" });
  assert((await state("env-identity")).sessions["env-thread"], "Use the host thread id when the payload has no identity.");
  await run("Stop", { last_assistant_message: "Env fixture." }, "env-identity", { thread: "env-thread" });
  assert(!(await state("env-identity")).sessions["env-thread"]);

  await run("SessionStart", { session_id: "retry" }, "retry");
  for (const mode of ["error", "missing"]) {
    endMode = mode;
    await run("Stop", { session_id: "retry" }, "retry");
    assert((await state("retry")).sessions.retry, `${mode}: preserve the mapping until an ended receipt is confirmed.`);
    const events = (await readFile(join(root, "retry", "hook-events.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(events.at(-1).mcp.innerlife_session_end.ok, false);
  }
  endMode = "success";
  await run("Stop", { session_id: "retry" }, "retry");
  assert(!(await state("retry")).sessions.retry);

  await run("Stop", { session_id: "lost-mapping" }, "lost-mapping");
  assert(calls.some(c => c.name === "innerlife_session_end" && c.input.sessionId === "lost-mapping"),
    "Recover a missing local mapping through the server's exact external-id lookup.");
  console.log("Codex hook lifecycle passed: background isolation, normal end, host identity, failed/missing end retention, retry and external-id recovery.");
} finally {
  await new Promise(resolveClose => server.close(resolveClose));
  await rm(root, { recursive: true, force: true });
}
