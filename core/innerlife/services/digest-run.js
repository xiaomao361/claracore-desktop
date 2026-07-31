const {
  IL_SYSTEM,
  summarizeInnerLifeProfile
} = require("../policy");

const DIGEST_RUN_PORTS = [
  "ensureProfile",
  "generateDigest",
  "getDigestRun",
  "getOptionalResumePacket",
  "getSnapshotLite",
  "listInboxPage",
  "listMemories",
  "newId",
  "persistDigestRun",
  "pruneDigestRuns",
  "resolveAgentIdentity"
];

function createInnerLifeDigestRunService(inputPorts = {}) {
  const missingPorts = DIGEST_RUN_PORTS.filter((name) => typeof inputPorts[name] !== "function");
  if (missingPorts.length) {
    throw new Error(`InnerLife digest run service requires ports: ${missingPorts.join(", ")}.`);
  }

  const ports = Object.freeze({ ...inputPorts });

  return async function runInnerLifeDigest(database, input = {}) {
    const agentId = ports.resolveAgentIdentity(input || {}).id;
    const profile = await ports.ensureProfile(database, agentId);
    const mode = String(input.mode || "manual").trim() || "manual";
    const prompt = String(input.prompt || "").trim();
    const { resumePacket, sharedLineContext } = await ports.getOptionalResumePacket(
      database,
      input,
      profile.agent_id
    );
    const memories = await ports.listMemories(database, 5);
    const inboxItems = (await ports.listInboxPage(database, {
      agentId: profile.agent_id,
      status: "pending",
      limit: 10,
      offset: 0
    })).items;
    const digestId = ports.newId("inner_digest");
    const eventId = ports.newId("inner_event");
    const thoughtId = ports.newId("inner_thought");
    const memoryLines = memories
      .map((memory) => `- ${memory.title || memory.body.slice(0, 80)}`)
      .join("\n") || "- No recent Memory records.";
    const inboxLines = inboxItems
      .map((item) => `- ${item.source}: ${item.body}`)
      .join("\n") || "- No pending inbox items.";
    const currentPosition = resumePacket.currentPosition.summary || (
      sharedLineContext.status === "ambiguous"
        ? "Shared Line selection is ambiguous; no line context was used."
        : "No Shared Line position saved yet."
    );
    const template = [
      "InnerLife digest",
      "",
      summarizeInnerLifeProfile(profile),
      "",
      `Mode: ${mode}`,
      `Current position: ${currentPosition}`,
      "",
      "Inbox digested:",
      inboxLines,
      "",
      "Recent Memory context:",
      memoryLines,
      "",
      `Operator prompt: ${prompt || "Digest current state without sharing automatically."}`
    ].join("\n");
    const generated = await ports.generateDigest(database, {
      tier: mode === "deep" ? "deep" : "light",
      system: IL_SYSTEM.digest,
      prompt: template,
      template
    });
    await ports.persistDigestRun(database, {
      agentId: profile.agent_id,
      digestId,
      eventId,
      generated,
      inboxItems,
      memories,
      mode,
      prompt,
      request: input,
      resumePacket,
      sharedLineContext,
      summary: generated.body,
      thoughtId
    });
    await ports.pruneDigestRuns(database, profile.agent_id);
    return {
      digest: await ports.getDigestRun(database, digestId),
      eventId,
      thoughtId,
      convergence: null,
      sharedLineContext,
      processedInboxIds: inboxItems.map((item) => item.id),
      snapshot: await ports.getSnapshotLite(database, profile.agent_id)
    };
  };
}

module.exports = {
  DIGEST_RUN_PORTS,
  createInnerLifeDigestRunService
};
