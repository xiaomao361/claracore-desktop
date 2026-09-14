const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");
const { buildInnerLifeProfileContext } = require("../innerlife/policy");
const { REVIEW_SYSTEM, collectConvergenceSources, reviewInnerLifeCandidate } = require("../innerlife/grounding");

async function main() {
  const now = Date.parse("2026-09-14T00:00:00Z");
  const makeLoop = (id, date, content = "memory transparency personal boundaries") => ({ id, content, status: "open", lastReviewedAt: date });
  const state = { recent_focus: "old relationship focus", open_loops: [
    makeLoop("undated", null), makeLoop("old", "2026-06-24T00:00:00Z"),
    makeLoop("fresh", "2026-09-13T00:00:00Z"), makeLoop("future", "2026-09-15T00:00:00Z"),
    makeLoop("unrelated", "2026-09-13T00:00:00Z", "database backups retention"),
    { ...makeLoop("closed", "2026-09-13T00:00:00Z"), status: "closed" }
  ] };
  const profile = { profile: {}, state, updated_at: "2026-09-14 00:00:00" };
  const projection = buildInnerLifeProfileContext(profile, { now, triggerText: "memory transparency" });
  assert.deepEqual(projection.decisions.map((item) => item.reason), ["undated", "stale", "selected", "future_review", "unrelated", "closed"]);
  assert(!projection.text.includes("old relationship focus"));
  assert(projection.text.includes('"fresh"'));
  assert(!projection.text.includes('"undated"'));
  assert.equal(state.open_loops.length, 6);
  assert.equal(buildInnerLifeProfileContext(profile, { now, triggerText: "Gabriel Marcel philosopher" }).decisions.filter((x) => x.reason === "selected").length, 0);
  const boundary = { profile: {}, state: { open_loops: [makeLoop("boundary", new Date(now - 30 * 86400000).toISOString())] } };
  assert.equal(buildInnerLifeProfileContext(boundary, { now, triggerText: "memory transparency" }).decisions[0].reason, "selected");
  assert.equal(buildInnerLifeProfileContext(boundary, { now: now + 1, triggerText: "memory transparency" }).decisions[0].reason, "stale");

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "innerlife-grounding-"));
  const db = await initializeProductDatabase(path.join(root, "db.sqlite"));
  try {
    await db.updateSettings({ "innerlife.provider": "disabled" });
    const agentId = "grounding-test";
    await db.updateInnerLifeProfile({ agentId, state });
    const originalState = (await db.ensureInnerLifeProfile(agentId)).state;
    let draft = "A question can remain open without requiring the same answer every day.";
    let verdict = { decision: "allow", reason: "new general reflection", personalClaims: [] };
    let failReview = false;
    let invalidReview = false;
    let prompts = [];
    db.innerLifeGenerate = async (input) => {
      prompts.push(input);
      if (input.system === REVIEW_SYSTEM) {
        if (failReview) throw new Error("offline-review");
        return invalidReview ? "not JSON" : JSON.stringify(verdict);
      }
      return draft;
    };
    const submit = (body) => db.submitInnerLifeInbox({ agentId, source: "observation", body });
    await submit("Gabriel Marcel: philosophy of questions and mysteries.");
    const first = await db.processInnerLifeOnce({ agentId });
    assert(first.share);
    assert(!prompts[0].prompt.includes("old relationship focus"));
    assert(!prompts[0].prompt.includes('"undated"'));
    const event = JSON.parse((await db.query(`SELECT metadata_json FROM innerlife_events WHERE id='${first.eventId}'`))[0].metadata_json);
    assert.equal(event.generationContext, prompts[0].prompt);
    assert.equal(event.grounding.audit.review.decision, "allow");
    assert.equal(event.contextPolicy.decisions[0].reason, "undated");

    // Different source, identical final thought: the old source-only comparison missed this.
    await submit("Julia programming language uses multiple dispatch and compiler specialization.");
    const repeated = await db.processInnerLifeOnce({ agentId });
    assert.equal(repeated.share, null);
    assert.equal(repeated.shareDecision.duplicateOf, first.share.id);
    const repeatedMeta = JSON.parse((await db.query(`SELECT metadata_json FROM innerlife_events WHERE id='${repeated.eventId}'`))[0].metadata_json);
    assert.equal(repeatedMeta.duplicateBasis, "output");

    draft = "你最近把全部记忆打开了。";
    verdict = { decision: "stale_fact", reason: "no dated recent personal event", personalClaims: [] };
    await submit("Botanical gardens preserve plant biodiversity.");
    const stale = await db.processInnerLifeOnce({ agentId });
    assert.equal(stale.share, null);
    assert.equal(stale.shareDecision.reason, "stale_fact");

    // Reviewer approval alone cannot invent an evidence ID or quote.
    verdict = { decision: "allow", reason: "supported", personalClaims: [{ claim: draft, sourceId: "missing", quote: "invented" }] };
    await submit("Ocean currents carry heat across the planet.");
    const fabricated = await db.processInnerLifeOnce({ agentId });
    assert.equal(fabricated.shareDecision.reason, "invalid_evidence");
    assert.equal(fabricated.share, null);

    const supportedInput = await submit("On 2026-06-24 the user enabled memory access. The event is historical.");
    draft = "你在 2026-06-24 开启了记忆访问。";
    verdict = { decision: "allow", reason: "dated historical fact", personalClaims: [{ claim: draft, sourceId: supportedInput.id, quote: "The user shared every secret yesterday" }] };
    assert.equal((await db.processInnerLifeOnce({ agentId })).shareDecision.reason, "invalid_evidence");
    const supportedAgain = await submit("On 2026-06-24 the user enabled memory access. The event is historical.");
    verdict.personalClaims[0] = { claim: draft, sourceId: supportedAgain.id, quote: "On 2026-06-24 the user enabled memory access." };
    assert((await db.processInnerLifeOnce({ agentId })).share);

    draft = "给一个未解疑问换上新比喻，并不能每天增添一个答案。";
    verdict = { decision: "repeated_thought", reason: "same conclusion under a different metaphor", personalClaims: [] };
    await submit("A telescope can observe distant galaxies.");
    const semanticRepeat = await db.processInnerLifeOnce({ agentId });
    assert.equal(semanticRepeat.shareDecision.reason, "repeated_thought");
    assert.equal(semanticRepeat.share, null);
    const semanticInput = JSON.parse(prompts.at(-1).prompt);
    assert(semanticInput.previousThoughts.some((item) => item.id === first.share.id));

    draft = "失败必须保留为可观察的失败。";
    const retryItem = await submit("Reliable systems preserve error state rather than hiding failure.");
    failReview = true;
    const failed = await db.processInnerLifeOnce({ agentId });
    assert.equal(failed.shareDecision.reason, "review_unavailable");
    assert.equal(failed.shareDecision.retryable, true);
    assert.equal(failed.share, null);
    assert.equal((await db.getInnerLifeInboxItem(retryItem.id)).status, "pending");
    await db.setInnerLifeDaemonState({ agentId, action: "enable" });
    await assert.rejects(db.tickInnerLifeDaemon({ agentId, force: true }), /review_unavailable/);
    assert.equal((await db.ensureInnerLifeDaemonState(agentId)).metadata.failureCount, 1);
    assert.equal((await db.getInnerLifeInboxItem(retryItem.id)).status, "pending");
    await db.setInnerLifeDaemonState({ agentId, action: "pause" });
    failReview = false;
    invalidReview = true;
    assert.equal((await db.processInnerLifeOnce({ agentId })).shareDecision.reason, "review_invalid");
    invalidReview = false;
    verdict = { decision: "allow", reason: "new general observation", personalClaims: [] };
    assert((await db.processInnerLifeOnce({ agentId })).share);
    assert.equal((await db.getInnerLifeInboxItem(retryItem.id)).status, "processed");

    draft = "[NO_SHARE]";
    await submit("No substantive new topic.");
    assert.equal((await db.processInnerLifeOnce({ agentId })).shareDecision.reason, "model_no_share");
    db.innerLifeGenerate = async () => null;
    await submit("Provider unavailable must not expose the prompt template.");
    const absent = await db.processInnerLifeOnce({ agentId });
    assert.equal(absent.shareDecision.reason, "generation_unavailable");
    assert.equal(absent.share, null);
    assert.deepEqual((await db.ensureInnerLifeProfile(agentId)).state, originalState);

    // Secondary entry points cannot publish fallback templates either.
    assert.equal((await db.exploreInnerLife({ agentId, ingestSources: false })).share, null);
    assert.equal((await db.convergeInnerLife({ agentId })).share, null);

    let oversizedCalls = 0;
    db.innerLifeGenerate = async () => { oversizedCalls += 1; return "unexpected call"; };
    const oversized = await db.processInnerLifeOnce({ agentId, prompt: "x".repeat(25000) });
    assert.equal(oversized.shareDecision.reason, "context_limit_exceeded");
    assert.equal(oversized.share, null);
    assert.equal(oversizedCalls, 0);
    assert.equal(oversized.shareDecision.retryable, true);
    const pending = await db.listInnerLifeInboxForAgent(agentId, "pending", 5);
    assert(pending.length > 0, "Unsent input must remain pending after a context limit");
    for (const args of [
      { generated: { source: "model", body: "x".repeat(4001) }, context: "small", sources: [] },
      { generated: { source: "model", body: "small" }, context: "small", sources: [{ text: "x".repeat(25000) }] }
    ]) {
      const limited = await reviewInnerLifeCandidate(db, args);
      assert.equal(limited.reason, "context_limit_exceeded");
      assert.equal(limited.retryable, true);
    }
    assert.equal(oversizedCalls, 0);
    db.innerLifeGenerate = async () => "[NO_SHARE]";
    await db.processInnerLifeOnce({ agentId });
    assert.equal((await db.getInnerLifeInboxItem(pending[0].id)).status, "processed");

    // Preserve real evidence from the originating event during convergence.
    const originAgent = "convergence-origin";
    await db.ensureInnerLifeProfile(originAgent);
    const originalSource = { id: "fact-1", kind: "inbox", recordedAt: "2026-06-24T00:00:00Z",
      text: "On 2026-06-24 the user enabled memory access." };
    const originMetadata = JSON.stringify({ grounding: { audit: { sources: [originalSource] } } });
    await db.exec(`INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
      VALUES ('origin-event', '${originAgent}', 'manual_process_once', 'source', 'processed', '${originMetadata}');
      INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
      VALUES ('origin-thought', 'origin-event', 'Historical memory access suggests a question about trust.', 'unreviewed');`);
    let convergencePrompt = "";
    let convergenceReview;
    const candidate = "The user enabled memory access on 2026-06-24; availability need not mean constant use.";
    db.innerLifeGenerate = async (input) => {
      if (input.system !== REVIEW_SYSTEM) { convergencePrompt = input.prompt; return candidate; }
      convergenceReview = JSON.parse(input.prompt);
      const source = convergenceReview.sources.find((s) => s.text === originalSource.text);
      assert(source, "Convergence reviewer must receive the original evidence");
      return JSON.stringify({ decision: "allow", reason: "explicit historical source",
        personalClaims: [{ claim: "The user enabled memory access on 2026-06-24", sourceId: source.id, quote: originalSource.text }] });
    };
    assert((await db.convergeInnerLife({ agentId: originAgent, sourceThoughtId: "origin-thought" })).share);
    assert(convergencePrompt.includes(originalSource.text));
    assert.equal(convergenceReview.sources[1].recordedAt, originalSource.recordedAt);
    assert.equal(convergenceReview.sources[1].originEventId, "origin-event");
    const collected = collectConvergenceSources({}, [
      { metadata_json: "bad JSON" },
      { event_id: "old", metadata_json: JSON.stringify({ grounding: { audit: { sources: [
        { kind: "thought", text: "AI guesses are not evidence" }, originalSource, originalSource,
        { kind: "inbox", text: "x".repeat(10000) }
      ] } } }) }
    ]);
    assert.equal(collected.length, 2);
    assert(JSON.stringify(collected).length <= 9000);
    console.log("InnerLife grounding: state isolation, output dedup, evidence gate, time rejection, retry and secondary entry points passed.");
  } finally { db.close(); await fs.rm(root, { recursive: true, force: true }); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
