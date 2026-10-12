const { evaluateDecisionModel, getDecisionModelSettings } = require('../decision-model/service');
const { CONTRACT } = require('../gateway/knowledge-context');

// Advice changes only unspecified choices, and only on a compatible host.
// An evaluator result is never evidence that retrieval, delivery or use happened.
function chooseRecallRoute(input, advice, allowApply = true) {
  const effective = { ...input };
  const reasons = {};
  let domainApplied = false, modeApplied = false;
  const eligible = allowApply && advice.mode === 'apply' && input.deliveryContract === CONTRACT;
  const blocked = advice.mode !== 'apply' ? 'mode_not_apply' : input.deliveryContract !== CONTRACT ? 'host_contract_required' : 'settings_changed';
  if (input.domain) reasons.domain = 'explicit_choice';
  else if (!eligible) reasons.domain = blocked;
  else if (advice.status !== 'ok') reasons.domain = advice.status;
  else if (!['none', 'memory', 'knowledge', 'both'].includes(advice.suggestedDomain)) reasons.domain = 'invalid_advice';
  else { effective.domain = advice.suggestedDomain; domainApplied = true; reasons.domain = 'adopted'; }
  const domain = effective.domain || 'both';
  if (input.mode) reasons.mode = 'explicit_choice';
  else if (!['knowledge', 'both'].includes(domain)) reasons.mode = 'knowledge_not_requested';
  else if (!eligible) reasons.mode = blocked;
  else if (advice.knowledgeMode?.status !== 'ok') reasons.mode = advice.knowledgeMode?.status || advice.status;
  else if (!['exact', 'semantic'].includes(advice.knowledgeMode.suggestedMode)) reasons.mode = 'invalid_advice';
  else { effective.mode = advice.knowledgeMode.suggestedMode; modeApplied = true; reasons.mode = 'adopted'; }
  return { effective, jev: { ...advice, applied: domainApplied || modeApplied, domainApplied,
    knowledgeMode: { ...advice.knowledgeMode, applied: modeApplied },
    route: { baseline: { domain: input.domain || 'both', mode: input.mode || 'semantic' },
      effective: { domain, mode: effective.mode || 'semantic' }, reasons } } };
}
async function collectWithJev(app, core, input, collect, { evaluate = evaluateDecisionModel } = {}) {
  const started = Date.now();
  const advicePromise = input.domain === 'none' ? Promise.resolve({ status: 'skipped', mode: 'off', applied: false })
    : evaluate(app, input.query || input.prompt, { budgetMs: 1200 });
  // Observation and old hosts retain parallel baseline retrieval. Applying
  // advice requires waiting for it before collecting the selected domains.
  let apply = false;
  try { apply = getDecisionModelSettings(app).mode === 'apply' && input.deliveryContract === CONTRACT; } catch { /* evaluator exposes config failure */ }
  let collected, route;
  if (apply) {
    route = chooseRecallRoute(input, await advicePromise);
    collected = await collect(core, route.effective);
  } else {
    [collected, route] = await Promise.all([collect(core, input), advicePromise.then(advice => chooseRecallRoute(input, advice, false))]);
  }
  return { ...collected, jev: route.jev, latencyMs: Date.now() - started };
}
function recallReceipt(result, collected) {
  return { route: collected.jev.route, modelStatus: collected.jev.status,
    decisionId: collected.memoryDecisionId || "",
    ...(collected.memoryDecisionId ? { feedbackRef: { tool: "memory_context_feedback", arguments: { decisionId: collected.memoryDecisionId } } } : {}),
    ...(collected.jev.provider ? { provider: collected.jev.provider } : {}),
    ...(collected.jev.httpStatus ? { httpStatus: collected.jev.httpStatus } : {}),
    ...(collected.jev.confidenceSource ? { confidenceSource: collected.jev.confidenceSource } : {}),
    domainStatus: result.domainStatus, decision: result.decision,
    selected: result.selected || (result.block ? [{ domain: result.block.domain, id: result.block.id }] : []),
    preparedBytes: Buffer.byteLength(JSON.stringify(result.blocks || (result.block ? [result.block] : []))),
    hostDelivery: 'unknown', used: 'unknown', outcome: 'unknown', latencyMs: collected.latencyMs };
}
module.exports = { chooseRecallRoute, collectWithJev, recallReceipt };
