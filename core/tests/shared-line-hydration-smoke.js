const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function packet(lineId, summary = lineId) {
  return {
    lineId,
    currentPosition: {
      lineId,
      summary
    },
    lines: [
      { id: "active", title: "Active", status: "active", active: true },
      { id: "parallel", title: "Parallel", status: "active", active: false },
      { id: "third", title: "Third", status: "active", active: false }
    ]
  };
}

function catalog() {
  return {
    ...packet("active", "compact active"),
    overview: true
  };
}

function card(lineId) {
  const attributes = new Map();
  return {
    dataset: { sharedLineId: lineId },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    hasAttribute(name) {
      return attributes.has(name);
    }
  };
}

function createActions(desktop, stateOverrides = {}) {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "app", "shared-line-actions.js"),
    "utf8"
  );
  const errors = [];
  const context = {
    window: {},
    console: {
      error(error) {
        errors.push(error);
      }
    }
  };
  vm.runInNewContext(source, context, { filename: "app/shared-line-actions.js" });
  const state = {
    activeSharedLineAgentFilter: "",
    selectedSharedLineId: "",
    selectedSharedLinePacket: null,
    ...stateOverrides
  };
  const dom = {
    sharedLineSelectionNotice: { textContent: "" },
    sharedLineNotice: { textContent: "" },
    sharedLineAgentFilter: {
      value: "",
      addEventListener() {}
    },
    sharedLineList: {
      addEventListener() {}
    }
  };
  let renders = 0;
  const actions = context.window.createClaraCoreSharedLineActions({
    desktop,
    dom,
    state,
    t(key) {
      return key;
    },
    renderSharedLine() {
      renders += 1;
    }
  });
  return { actions, dom, errors, renders: () => renders, state };
}

async function catalogSyncDoesNotReadDetail() {
  const reads = [];
  const fixture = createActions(
    {
      async getSharedLine({ lineId }) {
        reads.push(lineId);
        return packet(lineId, "hydrated");
      }
    },
    { selectedSharedLineId: "parallel" }
  );

  const result = fixture.actions.syncSelectedLineCatalog(catalog());
  assert.deepStrictEqual({ ...result }, { lineId: "parallel", didFallBack: false });
  assert.strictEqual(reads.length, 0, "catalog sync must not read Shared Line detail");
  assert.strictEqual(fixture.state.selectedSharedLinePacket, null);

  await fixture.actions.hydrateSelectedLine(catalog());
  assert.deepStrictEqual(reads, ["parallel"], "one hydration must issue one exact detail read");
  assert.strictEqual(fixture.state.selectedSharedLinePacket.currentPosition.summary, "hydrated");
}

async function missingSelectionFallsBackBeforeHydration() {
  const reads = [];
  const fixture = createActions(
    {
      async getSharedLine({ lineId }) {
        reads.push(lineId);
        return packet(lineId, "fallback hydrated");
      }
    },
    {
      selectedSharedLineId: "missing",
      selectedSharedLinePacket: packet("missing")
    }
  );

  const result = fixture.actions.syncSelectedLineCatalog(catalog());
  assert.deepStrictEqual({ ...result }, { lineId: "active", didFallBack: true });
  assert.strictEqual(fixture.state.selectedSharedLinePacket, null);
  assert.strictEqual(fixture.dom.sharedLineSelectionNotice.textContent, "sharedLine.selectionFallback");
  assert.strictEqual(reads.length, 0, "fallback selection must be catalog-only");

  await fixture.actions.hydrateSelectedLine(catalog());
  assert.deepStrictEqual(reads, ["active"]);
  assert.strictEqual(fixture.state.selectedSharedLinePacket.lineId, "active");
}

async function emptyCatalogDoesNotReadDetail() {
  let reads = 0;
  const fixture = createActions(
    {
      async getSharedLine() {
        reads += 1;
        return null;
      }
    },
    { selectedSharedLineId: "missing" }
  );

  fixture.actions.syncSelectedLineCatalog({ overview: true, lines: [] });
  await fixture.actions.hydrateSelectedLine({ overview: true, lines: [] });

  assert.strictEqual(reads, 0);
  assert.strictEqual(fixture.state.selectedSharedLineId, "");
  assert.strictEqual(fixture.state.selectedSharedLinePacket, null);
}

async function rapidSelectionKeepsLatestIntent() {
  const pending = new Map([
    ["parallel", deferred()],
    ["third", deferred()]
  ]);
  const fixture = createActions(
    {
      getSharedLine({ lineId }) {
        return pending.get(lineId).promise;
      }
    },
    {
      selectedSharedLineId: "active",
      selectedSharedLinePacket: packet("active", "previous")
    }
  );
  const parallelCard = card("parallel");
  const thirdCard = card("third");

  const parallelSelection = fixture.actions.selectLine(parallelCard);
  const thirdSelection = fixture.actions.selectLine(thirdCard);
  assert.strictEqual(fixture.state.selectedSharedLineId, "third", "selection intent must update before I/O");

  pending.get("third").resolve(packet("third", "latest"));
  await thirdSelection;
  pending.get("parallel").resolve(packet("parallel", "stale"));
  await parallelSelection;

  assert.strictEqual(fixture.state.selectedSharedLineId, "third");
  assert.strictEqual(fixture.state.selectedSharedLinePacket.lineId, "third");
  assert.strictEqual(fixture.state.selectedSharedLinePacket.currentPosition.summary, "latest");
  assert.strictEqual(parallelCard.hasAttribute("aria-busy"), false);
  assert.strictEqual(thirdCard.hasAttribute("aria-busy"), false);
}

async function refreshedCatalogInvalidatesOlderHydration() {
  const first = deferred();
  const second = deferred();
  let reads = 0;
  const fixture = createActions(
    {
      getSharedLine() {
        reads += 1;
        return reads === 1 ? first.promise : second.promise;
      }
    },
    { selectedSharedLineId: "parallel" }
  );

  fixture.actions.syncSelectedLineCatalog(catalog());
  const oldHydration = fixture.actions.hydrateSelectedLine(catalog());
  fixture.actions.syncSelectedLineCatalog(catalog());
  const newHydration = fixture.actions.hydrateSelectedLine(catalog());

  second.resolve(packet("parallel", "new snapshot"));
  await newHydration;
  first.resolve(packet("parallel", "old snapshot"));
  await oldHydration;

  assert.strictEqual(reads, 2, "each catalog generation should issue only its own detail read");
  assert.strictEqual(fixture.state.selectedSharedLinePacket.currentPosition.summary, "new snapshot");
}

async function userSelectionInvalidatesOlderHydration() {
  const hydration = deferred();
  const selection = deferred();
  let reads = 0;
  const fixture = createActions(
    {
      getSharedLine() {
        reads += 1;
        return reads === 1 ? hydration.promise : selection.promise;
      }
    },
    { selectedSharedLineId: "parallel" }
  );

  fixture.actions.syncSelectedLineCatalog(catalog());
  const oldHydration = fixture.actions.hydrateSelectedLine(catalog());
  const latestSelection = fixture.actions.selectLine(card("third"));

  selection.resolve(packet("third", "selected"));
  await latestSelection;
  hydration.resolve(packet("parallel", "stale hydration"));
  await oldHydration;

  assert.strictEqual(fixture.state.selectedSharedLineId, "third");
  assert.strictEqual(fixture.state.selectedSharedLinePacket.currentPosition.summary, "selected");
}

async function failedSelectionRestoresPreviousPacket() {
  const previousPacket = packet("active", "previous");
  const fixture = createActions(
    {
      async getSharedLine() {
        throw new Error("detail unavailable");
      }
    },
    {
      selectedSharedLineId: "active",
      selectedSharedLinePacket: previousPacket
    }
  );

  await fixture.actions.selectLine(card("parallel"));

  assert.strictEqual(fixture.state.selectedSharedLineId, "active");
  assert.strictEqual(fixture.state.selectedSharedLinePacket, previousPacket);
  assert.strictEqual(fixture.dom.sharedLineNotice.textContent, "sharedLine.lineFailed");
  assert.strictEqual(fixture.errors.length, 1);
}

async function mismatchedDetailFailsClosedWithoutSecondRead() {
  const reads = [];
  const fixture = createActions(
    {
      async getSharedLine({ lineId }) {
        reads.push(lineId);
        const mismatched = packet(lineId, "wrong line");
        mismatched.currentPosition.lineId = "third";
        return mismatched;
      }
    },
    { selectedSharedLineId: "parallel" }
  );

  fixture.actions.syncSelectedLineCatalog(catalog());
  await fixture.actions.hydrateSelectedLine(catalog());

  assert.deepStrictEqual(reads, ["parallel"], "a failed hydration must not cascade into a second detail IPC");
  assert.strictEqual(fixture.state.selectedSharedLineId, "active");
  assert.strictEqual(fixture.state.selectedSharedLinePacket, null);
  assert.strictEqual(fixture.dom.sharedLineSelectionNotice.textContent, "sharedLine.selectionFallback");
  assert.strictEqual(fixture.dom.sharedLineNotice.textContent, "sharedLine.lineFailed");
  assert.strictEqual(fixture.errors.length, 1);
}

async function main() {
  await catalogSyncDoesNotReadDetail();
  await missingSelectionFallsBackBeforeHydration();
  await emptyCatalogDoesNotReadDetail();
  await rapidSelectionKeepsLatestIntent();
  await refreshedCatalogInvalidatesOlderHydration();
  await userSelectionInvalidatesOlderHydration();
  await failedSelectionRestoresPreviousPacket();
  await mismatchedDetailFailsClosedWithoutSecondRead();
  console.log(JSON.stringify({
    ok: true,
    catalogSyncDetailReads: 0,
    detailReadsPerHydration: 1,
    missingSelectionFallback: "passed",
    emptyCatalogReads: 0,
    rapidSelectionRace: "passed",
    refreshRace: "passed",
    selectionFailureRestore: "passed",
    packetIdentityGuard: "passed"
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
