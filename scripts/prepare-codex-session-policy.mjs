import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const importLine = 'import { codexSessionKind } from "./session-policy.mjs";\n';
const anchor = 'if (eventName === "SessionStart") {';
const guard = `if (eventName === "SessionStart" && codexSessionKind(process.cwd(), dirname(CODEX_CONFIG_PATH)) === "background_memory") {
  appendEvent({ lifecycle: { decision: "skipped", reason: "background_memory_job", sessionCreated: false } });
  process.exit(0);
}

`;

// This prepares a reviewable copy only. Installing a host hook is a separate
// operator action; an unfamiliar hook layout must not be guessed at.
export function prepareHook(source) {
  if (source.includes("codexSessionKind") || source.split(anchor).length !== 2
    || !source.includes("CODEX_CONFIG_PATH") || !source.includes("appendEvent")
    || !/import\s*\{[^}]*\bdirname\b[^}]*\}\s*from\s*["']node:path["']/.test(source)) {
    throw new Error("Unsupported or already patched Codex hook; inspect its lifecycle integration manually.");
  }
  return importLine + source.replace(anchor, guard + anchor);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--hook" || args[2] !== "--output") throw new Error("Usage: --hook existing/hook.mjs --output new/staging-directory");
  const sourcePath = resolve(args[1]);
  const output = resolve(args[3]);
  if (output === dirname(sourcePath)) throw new Error("Output must be separate from the installed hook directory.");
  const source = await readFile(sourcePath, "utf8");
  const prepared = prepareHook(source);
  const policy = await readFile(new URL("./codex-session-policy.mjs", import.meta.url), "utf8");
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "hook.mjs"), prepared, { flag: "wx" });
  await writeFile(join(output, "session-policy.mjs"), policy, { flag: "wx" });
  console.log(JSON.stringify({ prepared: output, installed: false, source: sourcePath }));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
