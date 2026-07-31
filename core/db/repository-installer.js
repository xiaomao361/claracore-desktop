const installedRepositoryMethods = new WeakMap();

function requiredOwner(owner) {
  const normalized = String(owner || "").trim();
  if (!normalized) throw new Error("Repository owner is required.");
  return normalized;
}

function requiredMethodGroup(owner, source, methods) {
  if (!methods || typeof methods !== "object" || Array.isArray(methods)) {
    throw new Error(`Repository method group ${owner}/${source} must be an object.`);
  }
  for (const [name, method] of Object.entries(methods)) {
    if (typeof method !== "function") {
      throw new Error(`Repository method ${owner}/${source}.${name} must be a function.`);
    }
  }
  return methods;
}

function composeRepositoryMethods(ownerInput, groups) {
  const owner = requiredOwner(ownerInput);
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error(`Repository ${owner} must declare at least one method group.`);
  }
  const methods = {};
  const sources = new Map();

  for (const group of groups) {
    if (!Array.isArray(group) || group.length !== 2) {
      throw new Error(`Repository ${owner} method groups must use [source, methods] entries.`);
    }
    const source = requiredOwner(group[0]);
    const candidate = requiredMethodGroup(owner, source, group[1]);
    for (const [name, method] of Object.entries(candidate)) {
      if (Object.prototype.hasOwnProperty.call(methods, name)) {
        throw new Error(
          `Repository method collision in ${owner}: ${name} is owned by both ${sources.get(name)} and ${source}.`
        );
      }
      methods[name] = method;
      sources.set(name, source);
    }
  }
  return methods;
}

function installRepositoryMethods(ProductDatabase, ownerInput, methodsInput) {
  if (typeof ProductDatabase !== "function" || !ProductDatabase.prototype) {
    throw new Error("ProductDatabase constructor is required.");
  }
  const owner = requiredOwner(ownerInput);
  const methods = requiredMethodGroup(owner, owner, methodsInput);
  let owners = installedRepositoryMethods.get(ProductDatabase);
  if (!owners) {
    owners = new Map();
    installedRepositoryMethods.set(ProductDatabase, owners);
  }

  const collisions = Object.keys(methods)
    .filter((name) => name in ProductDatabase.prototype)
    .map((name) => {
      const inheritedOwner = Object.prototype.hasOwnProperty.call(ProductDatabase.prototype, name)
        ? "ProductDatabase"
        : "prototype chain";
      return `${name} (${owners.get(name) || inheritedOwner})`;
    });
  if (collisions.length) {
    throw new Error(
      `Repository method collision while installing ${owner}: ${collisions.sort().join(", ")}.`
    );
  }

  Object.assign(ProductDatabase.prototype, methods);
  for (const name of Object.keys(methods)) owners.set(name, owner);
  return methods;
}

function listInstalledRepositoryMethods(ProductDatabase) {
  const owners = installedRepositoryMethods.get(ProductDatabase) || new Map();
  return [...owners.entries()]
    .map(([name, owner]) => ({ name, owner }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

module.exports = {
  composeRepositoryMethods,
  installRepositoryMethods,
  listInstalledRepositoryMethods
};
