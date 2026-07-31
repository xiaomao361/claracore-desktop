const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const INNERLIFE_REPOSITORY_MODULES = Object.freeze([
  "daemon.js",
  "digests.js",
  "history.js",
  "inbox.js",
  "profile.js",
  "read-models.js",
  "reflection.js",
  "retention.js",
  "sessions.js",
  "shares.js",
  "source-inbox.js"
]);

function findInnerLifeRepositoryCycles() {
  const sources = new Map();
  const owners = new Map();
  for (const moduleName of INNERLIFE_REPOSITORY_MODULES) {
    const source = fs.readFileSync(
      path.join(root, "core/db/repositories/innerlife", moduleName),
      "utf8"
    );
    sources.set(moduleName, source);
    for (const match of source.matchAll(/^    (?:async )?([A-Za-z0-9_]+)\s*\(/gm)) {
      owners.set(match[1], moduleName);
    }
  }

  const adjacency = new Map(
    INNERLIFE_REPOSITORY_MODULES.map((moduleName) => [moduleName, []])
  );
  for (const [moduleName, source] of sources) {
    for (const match of source.matchAll(/this\.([A-Za-z0-9_]+)\s*\(/g)) {
      const owner = owners.get(match[1]);
      if (owner && owner !== moduleName && !adjacency.get(moduleName).includes(owner)) {
        adjacency.get(moduleName).push(owner);
      }
    }
  }

  let nextIndex = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];
  function visit(moduleName) {
    indices.set(moduleName, nextIndex);
    lowLinks.set(moduleName, nextIndex);
    nextIndex += 1;
    stack.push(moduleName);
    onStack.add(moduleName);
    for (const dependency of adjacency.get(moduleName)) {
      if (!indices.has(dependency)) {
        visit(dependency);
        lowLinks.set(
          moduleName,
          Math.min(lowLinks.get(moduleName), lowLinks.get(dependency))
        );
      } else if (onStack.has(dependency)) {
        lowLinks.set(
          moduleName,
          Math.min(lowLinks.get(moduleName), indices.get(dependency))
        );
      }
    }
    if (lowLinks.get(moduleName) !== indices.get(moduleName)) return;
    const component = [];
    let current;
    do {
      current = stack.pop();
      onStack.delete(current);
      component.push(current);
    } while (current !== moduleName);
    if (component.length > 1) cycles.push(component.sort());
  }
  for (const moduleName of INNERLIFE_REPOSITORY_MODULES) {
    if (!indices.has(moduleName)) visit(moduleName);
  }
  return cycles;
}

module.exports = {
  INNERLIFE_REPOSITORY_MODULES,
  findInnerLifeRepositoryCycles
};
