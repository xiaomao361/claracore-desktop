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
