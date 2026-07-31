const assert = require("assert");
const {
  createClaraCoreMemoryHydrationCoordinator
} = require("../../app/memory-hydration");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function flushMicrotasks() {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

async function main() {
  let generation = 1;
  let snapshot = { memories: [] };
  const coordinator = createClaraCoreMemoryHydrationCoordinator({
    getGeneration: () => generation,
    getSnapshot: () => snapshot
  });

  const firstIpc = deferred();
  let firstLoadCalls = 0;
  let firstApplyCalls = 0;
  const first = coordinator.run("all", {
    load: () => {
      firstLoadCalls += 1;
      return firstIpc.promise;
    },
    apply: (rows, targetSnapshot) => {
      firstApplyCalls += 1;
      targetSnapshot.memories = rows;
    }
  });
  const duplicate = coordinator.run("all", {
    load: () => {
      throw new Error("Singleflight started a duplicate Memory IPC.");
    },
    apply: () => {
      throw new Error("Singleflight applied a duplicate Memory IPC.");
    }
  });
  assert.strictEqual(duplicate, first, "Same-generation Memory hydration must share one promise.");
  await flushMicrotasks();
  assert.strictEqual(firstLoadCalls, 1);
  firstIpc.resolve([{ id: "first" }]);
  assert.deepStrictEqual(await first, {
    applied: true,
    stale: false,
    value: [{ id: "first" }]
  });
  assert.strictEqual(firstApplyCalls, 1);
  assert.deepStrictEqual(snapshot.memories, [{ id: "first" }]);
  assert.deepStrictEqual(coordinator.state().inFlight, []);

  const oldSlowIpc = deferred();
  const newFastIpc = deferred();
  const rendered = [];
  const oldSlow = coordinator.run("all", {
    force: true,
    load: () => oldSlowIpc.promise,
    apply: (rows, targetSnapshot) => {
      targetSnapshot.memories = rows;
      rendered.push(rows[0].id);
    }
  });
  const newFast = coordinator.run("all", {
    force: true,
    load: () => newFastIpc.promise,
    apply: (rows, targetSnapshot) => {
      targetSnapshot.memories = rows;
      rendered.push(rows[0].id);
    }
  });
  newFastIpc.resolve([{ id: "new-fast" }]);
  assert.strictEqual((await newFast).applied, true);
  assert.deepStrictEqual(snapshot.memories, [{ id: "new-fast" }]);
  assert.deepStrictEqual(rendered, ["new-fast"]);
  oldSlowIpc.resolve([{ id: "old-slow" }]);
  assert.deepStrictEqual(await oldSlow, {
    applied: false,
    stale: true,
    value: [{ id: "old-slow" }]
  });
  assert.deepStrictEqual(snapshot.memories, [{ id: "new-fast" }], "A late old IPC must not overwrite the new snapshot.");
  assert.deepStrictEqual(rendered, ["new-fast"], "A late old IPC must not redraw the Memory DOM.");

  const previousSnapshot = snapshot;
  const previousGenerationIpc = deferred();
  const previousGeneration = coordinator.run("all", {
    force: true,
    load: () => previousGenerationIpc.promise,
    apply: (rows, targetSnapshot) => {
      targetSnapshot.memories = rows;
      rendered.push("stale-generation");
    }
  });
  generation += 1;
  previousGenerationIpc.resolve([{ id: "stale-generation" }]);
  assert.strictEqual((await previousGeneration).stale, true);
  assert.deepStrictEqual(previousSnapshot.memories, [{ id: "new-fast" }]);
  assert(!rendered.includes("stale-generation"), "A prior snapshot generation must lose DOM authority immediately.");

  snapshot = { memories: [] };
  const currentGeneration = await coordinator.run("all", {
    load: async () => [{ id: "current-generation" }],
    apply: (rows, targetSnapshot) => {
      targetSnapshot.memories = rows;
      rendered.push(rows[0].id);
    }
  });
  assert.strictEqual(currentGeneration.applied, true);
  assert.deepStrictEqual(snapshot.memories, [{ id: "current-generation" }]);

  let retryAttempts = 0;
  await assert.rejects(
    coordinator.run("graph", {
      load: async () => {
        retryAttempts += 1;
        throw new Error("controlled hydration failure");
      },
      apply: () => {
        throw new Error("Failed hydration must not apply.");
      }
    }),
    /controlled hydration failure/
  );
  assert.deepStrictEqual(coordinator.state().inFlight, [], "A failed hydration must release its singleflight slot.");
  const retry = await coordinator.run("graph", {
    load: async () => {
      retryAttempts += 1;
      return { nodes: [{ id: "retry-ok" }] };
    },
    apply: (graph, targetSnapshot) => {
      targetSnapshot.memoryGraph = graph;
      rendered.push("retry-ok");
    }
  });
  assert.strictEqual(retry.applied, true);
  assert.strictEqual(retryAttempts, 2);
  assert.deepStrictEqual(snapshot.memoryGraph, { nodes: [{ id: "retry-ok" }] });
  assert(rendered.includes("retry-ok"));

  const invalidatedIpc = deferred();
  const invalidated = coordinator.run("all", {
    force: true,
    load: () => invalidatedIpc.promise,
    apply: () => {
      throw new Error("Explicitly invalidated hydration must not apply.");
    }
  });
  coordinator.invalidate();
  invalidatedIpc.resolve([{ id: "invalidated" }]);
  assert.strictEqual((await invalidated).stale, true);

  process.stdout.write("Memory hydration smoke passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
