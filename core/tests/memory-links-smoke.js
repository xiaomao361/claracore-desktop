const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

async function expectRejection(promise, label) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error(`${label} should have been rejected.`);
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-memory-links-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  await runtime.saveProductSettings(app, {
    "memory.embedding.base_url": "http://127.0.0.1:9",
    "memory.embedding.model": "bge-m3-links-smoke"
  });

  const first = await runtime.createProductMemory(app, {
    title: "Link smoke A",
    body: "First memory for link smoke.",
    labels: "link-smoke"
  });
  const second = await runtime.createProductMemory(app, {
    title: "Link smoke B",
    body: "Second memory for link smoke.",
    labels: "link-smoke"
  });
  const { database } = await runtime.ensureProductCore(app);

  const link = await database.createMemoryLink({
    fromMemoryId: first.id,
    toMemoryId: second.id,
    kind: "related",
    strength: 0.4,
    note: "Formed during smoke run."
  });
  if (!link.id || link.fromMemoryId !== first.id || link.toMemoryId !== second.id) {
    throw new Error(`Memory link was not created: ${JSON.stringify(link)}`);
  }
  if (link.kind !== "related" || link.strength !== 0.4 || link.source !== "manual") {
    throw new Error(`Memory link fields were not normalized: ${JSON.stringify(link)}`);
  }

  const upserted = await database.createMemoryLink({
    fromMemoryId: first.id,
    toMemoryId: second.id,
    kind: "related",
    strength: 0.9,
    source: "co-recall"
  });
  if (upserted.id !== link.id || upserted.strength !== 0.9 || upserted.source !== "co-recall") {
    throw new Error(`Duplicate link create should upsert in place: ${JSON.stringify(upserted)}`);
  }
  if (upserted.note !== "Formed during smoke run.") {
    throw new Error(`Upsert should keep the existing note when none is provided: ${JSON.stringify(upserted)}`);
  }

  const neighborhood = await database.listMemoryLinks({ memoryId: second.id });
  if (neighborhood.length !== 1 || neighborhood[0].id !== link.id) {
    throw new Error(`Neighborhood list should find the link from either endpoint: ${JSON.stringify(neighborhood)}`);
  }

  const graph = await database.getMemoryGraph({ limit: 30 });
  const linkEdge = graph.edges.find((edge) => edge.kind === "link:related");
  if (!linkEdge || linkEdge.strength !== 0.9) {
    throw new Error(`Memory graph is missing the link edge: ${JSON.stringify(graph.edges)}`);
  }
  if ((graph.summary.memoryLinkCount || 0) !== 1) {
    throw new Error(`Graph summary should count link edges: ${JSON.stringify(graph.summary)}`);
  }

  const searchResult = await database.searchMemories("First memory for link smoke", 10);
  if (!searchResult.results.some((memory) => memory.id === first.id)) {
    throw new Error(`Search should hit the first memory: ${JSON.stringify(searchResult.results.map((memory) => memory.id))}`);
  }
  const relatedIds = (searchResult.related || []).map((entry) => entry.memory.id);
  if (searchResult.results.some((memory) => memory.id === second.id)) {
    throw new Error("Search precondition failed: second memory should not be a direct hit.");
  }
  if (!relatedIds.includes(second.id)) {
    throw new Error(`Search should return the linked neighbor: ${JSON.stringify(searchResult.related)}`);
  }
  const neighborEntry = searchResult.related.find((entry) => entry.memory.id === second.id);
  if (neighborEntry.via.kind !== "related" || neighborEntry.via.strength !== 0.9 || neighborEntry.via.linkedMemoryId !== first.id) {
    throw new Error(`Neighbor link metadata is wrong: ${JSON.stringify(neighborEntry.via)}`);
  }

  const historicalFact = await runtime.createProductMemory(app, {
    title: "Historical residence",
    body: "Temporal smoke user currently lives in Shanghai.",
    labels: "temporal-smoke"
  });
  const currentFact = await runtime.createProductMemory(app, {
    title: "Current residence",
    body: "Temporal smoke user currently lives in Hangzhou.",
    labels: "temporal-smoke"
  });
  const supersession = await database.supersedeMemory({
    currentMemoryId: currentFact.id,
    historicalMemoryId: historicalFact.id,
    note: "The confirmed residence changed."
  });
  if (supersession.link.kind !== "supersedes" || supersession.historical.status !== "superseded") {
    throw new Error(`Supersession was not applied atomically: ${JSON.stringify(supersession)}`);
  }
  const repeatedSupersession = await database.supersedeMemory({
    currentMemoryId: currentFact.id,
    historicalMemoryId: historicalFact.id
  });
  if (repeatedSupersession.link.id !== supersession.link.id) {
    throw new Error("Repeated supersession should be idempotent.");
  }
  const currentSearch = await database.searchMemories("Temporal smoke user currently lives", 10);
  if (!currentSearch.results.some((memory) => memory.id === currentFact.id && memory.stateRole === "current")) {
    throw new Error(`Current recall missed the replacement fact: ${JSON.stringify(currentSearch.results)}`);
  }
  if (currentSearch.results.some((memory) => memory.id === historicalFact.id)) {
    throw new Error("Default current recall returned a superseded fact.");
  }
  const historicalSearch = await database.searchMemories("Temporal smoke user currently lives", 10, { timeView: "historical" });
  const historicalHit = historicalSearch.results.find((memory) => memory.id === historicalFact.id);
  if (historicalHit?.stateRole !== "historical" || !historicalHit.supersededBy.includes(currentFact.id)) {
    throw new Error(`Historical recall did not explain its replacement: ${JSON.stringify(historicalSearch.results)}`);
  }
  const allSearch = await database.searchMemories("Temporal smoke user currently lives", 10, { timeView: "all" });
  const allCurrent = allSearch.results.find((memory) => memory.id === currentFact.id);
  if (!allCurrent?.supersedes.includes(historicalFact.id) || !allSearch.results.some((memory) => memory.id === historicalFact.id)) {
    throw new Error(`All-state recall did not preserve both states: ${JSON.stringify(allSearch.results)}`);
  }

  const chainOldest = await runtime.createProductMemory(app, {
    title: "State chain oldest",
    body: "The project used its first state model.",
    labels: "state-chain-closure"
  });
  const chainMiddle = await runtime.createProductMemory(app, {
    title: "State chain middle",
    body: "The project used its second state model.",
    labels: "state-chain-closure"
  });
  const chainCurrent = await runtime.createProductMemory(app, {
    title: "State chain current",
    body: "The project uses its current state model.",
    labels: "state-chain-closure"
  });
  await database.supersedeMemory({ currentMemoryId: chainMiddle.id, historicalMemoryId: chainOldest.id });
  await database.supersedeMemory({ currentMemoryId: chainCurrent.id, historicalMemoryId: chainMiddle.id });
  const chainGraph = await database.getMemoryGraph({ limit: 100 });
  const chainEdges = chainGraph.edges.filter((edge) => edge.kind === "link:supersedes" && [
    `memory:${chainOldest.id}`,
    `memory:${chainMiddle.id}`,
    `memory:${chainCurrent.id}`
  ].includes(edge.from));
  if (chainEdges.length !== 2) {
    throw new Error(`Graph should preserve the complete three-state supersession chain: ${JSON.stringify(chainEdges)}`);
  }
  const chainNodeIds = new Set(chainGraph.nodes.map((node) => node.id));
  if (![chainOldest.id, chainMiddle.id, chainCurrent.id].every((id) => chainNodeIds.has(`memory:${id}`))) {
    throw new Error(`Graph should include every state in a supersession chain: ${JSON.stringify([...chainNodeIds])}`);
  }

  await database.archiveMemory(second.id);
  const searchAfterArchive = await database.searchMemories("First memory for link smoke", 10);
  if ((searchAfterArchive.related || []).some((entry) => entry.memory.id === second.id)) {
    throw new Error("Archived memories must not appear as neighbors.");
  }
  await database.restoreArchivedMemory(second.id);

  await expectRejection(
    database.createMemoryLink({ fromMemoryId: first.id, toMemoryId: first.id }),
    "Self link"
  );
  await expectRejection(
    database.createMemoryLink({ fromMemoryId: currentFact.id, toMemoryId: historicalFact.id, kind: "supersedes" }),
    "Direct supersedes link"
  );
  await expectRejection(
    database.supersedeMemory({ currentMemoryId: currentFact.id, historicalMemoryId: currentFact.id }),
    "Self supersession"
  );
  await expectRejection(
    database.createMemoryLink({ fromMemoryId: first.id, toMemoryId: "mem_missing" }),
    "Link to missing memory"
  );
  await expectRejection(
    database.createMemoryLink({ fromMemoryId: first.id, toMemoryId: second.id, kind: "friends" }),
    "Unknown link kind"
  );

  const removed = await database.deleteMemoryLink(link.id);
  if (!removed.deleted) {
    throw new Error(`Memory link delete failed: ${JSON.stringify(removed)}`);
  }
  const afterDelete = await database.listMemoryLinks({ memoryId: first.id });
  if (afterDelete.length !== 0) {
    throw new Error(`Memory link should be gone after delete: ${JSON.stringify(afterDelete)}`);
  }

  console.log("memory-links-smoke: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
