const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const { initializeProductDatabase } = require("../db/database");
const cases = require("./fixtures/understanding-semantics.json");
const { inspectCase, evaluateCases } = require("../gateway/understanding/evaluation");

function fixturePlan(event) {
  return JSON.stringify({ operations: [{ kind: "memory", certainty: "confirmed", eventIds: [event.id], quotes: [{ eventId: event.id, text: event.text }],
    rationale: "Fixture deliberately treats every user sentence as a decision.", body: event.text }], coverage: [{ eventId: event.id,
    ...Object.fromEntries(["memory", "knowledge", "continuity", "innerlife"].map(domain => [domain, { status: domain === "memory" ? "planned" : "none", reason: "Fixture", operations: domain === "memory" ? [0] : [] }])) }] });
}
async function main() {
  let requests = 0;
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(request.url, "/v1/chat/completions");
    const data = JSON.parse(input.messages.find(item => item.role === "user").content);
    assert(data.events.every(event => event.sourceRef.startsWith("synthetic:")));
    requests++;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: fixturePlan(data.events[0]) } }] }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const { runEvaluation, runExistingModelEvaluation } = await import(pathToFileURL(path.resolve(__dirname, "../../scripts/evaluate-understanding.mjs")).href);
    const report = await runEvaluation({ provider: "openai-compatible", model: "fixture", baseUrl: `http://127.0.0.1:${server.address().port}` }, cases.slice(0, 2));
    assert.equal(requests, 2); assert.equal(report.total, 2); assert.equal(report.passed, 1);
    assert(report.results[1].violations.includes("unexpected:memory"), "A model can satisfy JSON/quote constraints while misreading negation");
    assert.equal(report.userDatabaseOpened, false);
    const forged = JSON.parse(fixturePlan(cases[0].events[0])); forged.operations[0].quotes[0].text = "invented evidence";
    assert(inspectCase(cases[0], JSON.stringify(forged)).violations.includes("evidence_mismatch"));
    const readiness = spawnSync(process.execPath, [path.resolve(__dirname, "../../scripts/evaluate-understanding.mjs")], { encoding: "utf8" });
    assert.equal(readiness.status, 0, readiness.stderr); assert.equal(JSON.parse(readiness.stdout).modelCalls, 0);
    assert.equal(requests, 2);
    const diagnosticErrors = [new Error("OpenAI-compatible chat endpoint returned 502: PRIVATE_RESPONSE_AND_CREDENTIAL"),
      new Error("OpenAI-compatible chat endpoint request timed out."), new Error("OpenAI-compatible chat endpoint returned no content."),
      Object.assign(new Error("PRIVATE_TRANSPORT_DETAIL"), { code: "ECONNRESET" }), new SyntaxError("PRIVATE_PROVIDER_RESPONSE"),
      Object.assign(new Error("PRIVATE_UNKNOWN_DETAIL"), { code: "PRIVATE_UNKNOWN_CODE" })];
    let diagnosticCalls = 0;
    const diagnostics = await evaluateCases(Array.from({ length: diagnosticErrors.length }, () => cases[0]), async () => { throw diagnosticErrors[diagnosticCalls++]; });
    assert.equal(diagnosticCalls, diagnosticErrors.length, "Failed calls must not retry");
    assert.equal(diagnostics.passed, 0);
    assert.deepEqual(diagnostics.results.map(result => result.violations[0]), ["model_http_error", "model_timeout", "model_empty_response", "model_transport_error", "model_response_json_invalid", "model_request_failed"]);
    assert.equal(diagnostics.results[0].failure.httpStatus, 502);
    assert(!JSON.stringify(diagnostics).includes("PRIVATE_"), "Failure evidence must not contain provider text or arbitrary error codes");
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "understanding-evaluation-config-"));
    try {
      const database = await initializeProductDatabase(path.join(root, "claracore.db"));
      await database.updateSettings({ "innerlife.provider": "openai-compatible", "innerlife.model": "fixture-existing", "innerlife.base_url": `http://127.0.0.1:${server.address().port}`,
        "innerlife.llm.api_key_ref": "fixture-private-credential" });
      await database.createMemory({ body: "PRIVATE_BUSINESS_MEMORY_MUST_NOT_BE_READ" });
      await database.close();
      const before = await fs.readFile(path.join(root, "claracore.db"));
      const existing = await runExistingModelEvaluation(root, cases.slice(0, 1));
      assert.equal(existing.passed, 1); assert.equal(existing.businessDataRead, false);
      assert.equal(existing.configurationDatabaseAccess, "sqlite_readonly_exact_model_settings_and_auth");
      assert.deepEqual(await fs.readFile(path.join(root, "claracore.db")), before);
      assert(!JSON.stringify(existing).includes("fixture-private-credential"));
      assert(!JSON.stringify(existing).includes("PRIVATE_BUSINESS_MEMORY"));
    } finally { await fs.rm(root, { recursive: true, force: true }); }
    console.log(JSON.stringify({ suite: "understanding-evaluation", existingProviderAdapter: true, negationMistakeDetected: true, structuralSuccessNotSemanticProof: true,
      liveModelCalls: 0, defaultZeroRequests: true, diagnosticCallsWithoutRetries: diagnosticCalls, privateDiagnosticsExcluded: true, syntheticCases: cases.length }));
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
