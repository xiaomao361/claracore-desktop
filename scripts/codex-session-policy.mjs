import { isAbsolute, relative, resolve, sep } from "node:path";
import { realpathSync } from "node:fs";

function canonicalPath(value) {
  try { return realpathSync(value); } catch { return resolve(value); }
}

// Match only the host's own memory-job directories, never a repository or
// conversation merely containing "memory" in its name. No age-based ending.
export function codexSessionKind(cwd, codexHome) {
  if (!cwd || !codexHome) return "conversation";
  const location = canonicalPath(cwd);
  for (const directory of ["memories", "memories_v2"]) {
    const remainder = relative(canonicalPath(resolve(codexHome, directory)), location);
    if (remainder === "" || (!remainder.startsWith(`..${sep}`) && remainder !== ".." && !isAbsolute(remainder))) {
      return "background_memory";
    }
  }
  return "conversation";
}
