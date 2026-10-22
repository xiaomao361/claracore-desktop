import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) {
    throw new Error("Unsupported or already repaired Codex hook; inspect the session close integration.");
  }
  return source.replace(before, after);
}

// Prepare only: installation is an explicit host maintenance operation.
export function prepareSessionCloseHook(source) {
  if (!source.includes('import { codexSessionKind } from "./session-policy.mjs";')) {
    throw new Error("Install the background session policy before preparing the close repair.");
  }
  source = replaceOnce(source,
    '    const text = message.result?.content?.[0]?.text || "";',
    `    if (!message.result || message.result.isError) {
      return { ok: false, error: message.result?.content?.[0]?.text || "Missing MCP tool result." };
    }
    const text = message.result?.content?.[0]?.text || "";`);
  source = replaceOnce(source,
    `    "conversationId",
    "transcript_path",`,
    `    "conversationId"
  ]) || String(process.env.CODEX_THREAD_ID || "").trim() || findFirstString(json, [
    "transcript_path",`);
  source = replaceOnce(source,
    `  if (sessionState?.innerLifeSessionId) {
    const ended = await callMcpTool("innerlife_session_end", {
      agentId: AGENT_ID,
      sessionId: sessionState.innerLifeSessionId,`,
    `  const endSessionId = sessionState?.innerLifeSessionId || sessionKey;
  if (endSessionId && (sessionState || codexSessionKind(process.cwd(), dirname(CODEX_CONFIG_PATH)) !== "background_memory")) {
    const ended = await callMcpTool("innerlife_session_end", {
      agentId: AGENT_ID,
      sessionId: endSessionId,`);
  source = replaceOnce(source,
    `    mcp.innerlife_session_end = { ok: ended.ok, error: ended.error || ended.skipped || "" };
    if (ended.ok) {`,
    `    const confirmedEnd = ended.ok && ended.result?.session?.status === "ended";
    const missing = ended.ok && ended.result?.missing === true;
    mcp.innerlife_session_end = {
      ok: confirmedEnd,
      missing,
      error: confirmedEnd ? "" : ended.error || ended.skipped || (missing
        ? "Session not found; closure is unconfirmed."
        : "Session end acknowledgement is unconfirmed.")
    };
    if (confirmedEnd) {`);
  return source;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--hook" || args[2] !== "--output") {
    throw new Error("Usage: --hook existing/hook.mjs --output new/staging-directory");
  }
  const hookPath = resolve(args[1]);
  const output = resolve(args[3]);
  if (output === dirname(hookPath)) throw new Error("Output must be separate from the installed hook directory.");
  const source = prepareSessionCloseHook(await readFile(hookPath, "utf8"));
  const policy = await readFile(join(dirname(hookPath), "session-policy.mjs"), "utf8");
  await mkdir(output, { recursive: false });
  await writeFile(join(output, "hook.mjs"), source, { flag: "wx" });
  await writeFile(join(output, "session-policy.mjs"), policy, { flag: "wx" });
  console.log(JSON.stringify({ prepared: output, installed: false }));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
