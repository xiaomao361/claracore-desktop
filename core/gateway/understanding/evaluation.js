const { SYSTEM, normalizeInput, validatePlan } = require("./planner");
const { assessLineSelection } = require("./line-selection");

function evaluationInput(testCase) {
  const lines = (testCase.lines || []).map(line => ({ ...line, revision: "synthetic-revision" }));
  return { caseId: testCase.id, events: testCase.events, selectedLineId: testCase.lineId || "",
    existing: { continuity: testCase.lineId ? { status: "selected", selected: { lineId: testCase.lineId, summary: lines.find(line => line.id === testCase.lineId)?.summary } }
      : { status: lines.length ? "selection_required" : "none", candidates: lines, total: lines.length, hasMore: false },
      events: testCase.events.map(event => ({ eventId: event.id, textFullyCovered: true })), objects: { memory: [], knowledge: [] }, innerlife: { status: "not_collected" } } };
}
function inspectCase(testCase, output) {
  const violations = [];
  let plan;
  try { plan = validatePlan(output, normalizeInput({ submissionId: testCase.id, events: testCase.events, allowModel: true, lineId: testCase.lineId })); }
  catch (error) { return { status: "failed", violations: [error.code || "invalid_plan"], plan: null }; }
  const kinds = plan.operations.map(operation => operation.kind);
  for (const kind of testCase.expected.requiredKinds || []) if (!kinds.includes(kind)) violations.push(`missing:${kind}`);
  for (const kind of testCase.expected.forbiddenKinds || []) if (kinds.includes(kind)) violations.push(`unexpected:${kind}`);
  if (testCase.expected.lineDecision && plan.lineSelection?.decision !== testCase.expected.lineDecision) violations.push("line_decision_mismatch");
  if (plan.lineSelection && plan.lineSelection.decision !== "ambiguous") {
    const issue = assessLineSelection(plan.lineSelection, evaluationInput(testCase).existing.continuity);
    if (issue && !testCase.lineId) violations.push(issue);
  }
  for (const op of plan.operations) if (["memory", "line_create", "line_archive"].includes(op.kind)
    && (op.certainty !== "confirmed" || !op.quotes.some(quote => testCase.events.find(event => event.id === quote.eventId)?.speaker === "user"))) violations.push("confirmed_user_evidence_required");
  return { status: violations.length ? "failed" : "passed", violations, plan };
}
function modelFailure(error) {
  // Keep diagnostic categories, never provider bodies, URLs or credentials.
  const message = String(error?.message || "");
  if (/^(?:Ollama chat|OpenAI-compatible chat endpoint) request timed out\.$/u.test(message)
    || ["ETIMEDOUT", "ABORT_ERR"].includes(error?.code)) return { code: "model_timeout" };
  const http = /^(?:Ollama chat|OpenAI-compatible chat endpoint) returned ([1-5][0-9]{2}):/u.exec(message);
  if (http) return { code: "model_http_error", httpStatus: Number(http[1]) };
  if (/^(?:Ollama chat|OpenAI-compatible chat endpoint) returned no content\.$/u.test(message)) return { code: "model_empty_response" };
  if (["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EPIPE"].includes(error?.code)) return { code: "model_transport_error", transportCode: error.code };
  if (error instanceof SyntaxError) return { code: "model_response_json_invalid" };
  return { code: "model_request_failed" };
}
async function evaluateCases(cases, generate) {
  const results = [];
  for (const testCase of cases) {
    const startedAt = Date.now();
    let result;
    try {
      const output = await generate({ system: SYSTEM, prompt: JSON.stringify(evaluationInput(testCase)), timeoutMs: 30000 });
      result = output ? inspectCase(testCase, output) : { status: "model_failed", violations: ["model_unavailable"], plan: null };
    } catch (error) {
      const failure = modelFailure(error);
      result = { status: "model_failed", violations: [failure.code], failure, plan: null };
    }
    results.push({ id: testCase.id, ...result, reviewRequired: testCase.review, latencyMs: Date.now() - startedAt });
  }
  return { contract: "understanding-evaluation-v1", dataset: "synthetic_no_user_data", total: results.length,
    passed: results.filter(result => result.status === "passed").length, results,
    claim: "Passing means only these structural/disposition checks passed. Wording, scope, omission and general semantic quality require human review; this is not production acceptance." };
}
module.exports = { evaluationInput, inspectCase, evaluateCases };
